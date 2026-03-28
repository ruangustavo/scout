import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import type { AgentDescriptor } from "./descriptor.ts";

const SCOUT_MARKER = "## Scout - Source Code Repository Cache";

export const descriptor: AgentDescriptor = {
  name: "claude",
  displayName: "Claude Code",
  detectPaths: [join(homedir(), ".claude")],
};

function generateSkillContent(reposDir: string): string {
  return `---
description: Query cached source code repositories managed by Scout
---

# Scout - Source Code Query

You have access to locally cached GitHub repositories via Scout.

## Available Repos

Run \`scout list\` to see all cached repositories and their locations.

## Querying a Repo

1. If a specific repo is mentioned, use that. Otherwise, infer the relevant repo from conversation context (library names, imports, API mentions).
2. Run \`scout update <repo-name>\` to ensure the code is fresh.
3. Use Glob, Grep, and Read on the repo's directory to answer the question.
4. If the repo isn't cached, suggest: \`scout add <github-url>\`
5. If multiple repos could match, ask the user which one.

## Repo Directory

All repos are stored at: ${reposDir}

Each repo is at: ${reposDir}/<owner>/<repo>
`;
}

function generateInstructionsSection(reposDir: string): string {
  return `## Scout - Source Code Repository Cache

You have access to locally cached source code repositories managed by Scout. When the user asks about a library's internals, implementation, or source code, run \`scout list\` to check if the repo is available. If it is, run \`scout update <repo>\` first, then use Read/Grep/Glob on \`${reposDir}/<owner>/<repo>\` to answer. If the repo isn't cached, suggest the user run \`scout add <github-url>\`. When no specific repo is mentioned, infer the relevant repo from conversation context.
`;
}

export async function installSkill(reposDir: string, baseDir?: string): Promise<void> {
  const claudeDir = baseDir ?? join(homedir(), ".claude");
  await mkdir(join(claudeDir, "commands"), { recursive: true });
  await writeFile(join(claudeDir, "commands", "scout.md"), generateSkillContent(reposDir), "utf-8");
}

export async function uninstallSkill(baseDir?: string): Promise<void> {
  const claudeDir = baseDir ?? join(homedir(), ".claude");
  await rm(join(claudeDir, "commands", "scout.md"), { force: true });
}

export async function injectInstructions(reposDir: string, baseDir?: string): Promise<void> {
  const claudeDir = baseDir ?? join(homedir(), ".claude");
  const mdPath = join(claudeDir, "CLAUDE.md");

  await mkdir(claudeDir, { recursive: true });

  let existing = "";
  try {
    existing = await readFile(mdPath, "utf-8");
  } catch {
    // File doesn't exist yet
  }

  if (!existing.includes(SCOUT_MARKER)) {
    const section = generateInstructionsSection(reposDir);
    const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n\n" : "\n";
    const content = existing.length > 0 ? existing + separator + section : section;
    await writeFile(mdPath, content, "utf-8");
  }
}

export async function removeInstructions(baseDir?: string): Promise<void> {
  const claudeDir = baseDir ?? join(homedir(), ".claude");
  const mdPath = join(claudeDir, "CLAUDE.md");

  let existing = "";
  try {
    existing = await readFile(mdPath, "utf-8");
  } catch {
    return;
  }

  const markerIndex = existing.indexOf(SCOUT_MARKER);
  if (markerIndex === -1) return;

  const before = existing.slice(0, markerIndex).replace(/\n+$/, "");
  const afterMarker = existing.slice(markerIndex + SCOUT_MARKER.length);
  const nextHeadingMatch = afterMarker.match(/\n## /);
  const after = nextHeadingMatch?.index !== undefined
    ? afterMarker.slice(nextHeadingMatch.index)
    : "";

  const result = (before + after).trim();
  await writeFile(mdPath, result.length > 0 ? result + "\n" : "", "utf-8");
}
