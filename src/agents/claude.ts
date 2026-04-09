import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import type { AgentDescriptor } from "./descriptor.ts";
import { injectSection } from "./markdown.ts";

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
Run \`scout list <query>\` to filter cached repositories by a case-insensitive name match when there are many.

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

You have access to locally cached source code repositories managed by Scout. When the user asks about a library's internals, implementation, or source code, run \`scout list\` to check if the repo is available. If there are many cached repos, use \`scout list <query>\` to narrow the results by a case-insensitive repository name match. If the repo is available, run \`scout update <repo>\` first, then use Read/Grep/Glob on \`${reposDir}/<owner>/<repo>\` to answer. If the repo isn't cached, suggest the user run \`scout add <github-url>\`. When no specific repo is mentioned, infer the relevant repo from conversation context.
`;
}

export async function installSkill(reposDir: string, baseDir?: string): Promise<void> {
  const claudeDir = baseDir ?? join(homedir(), ".claude");
  await mkdir(join(claudeDir, "commands"), { recursive: true });
  await writeFile(join(claudeDir, "commands", "scout.md"), generateSkillContent(reposDir), "utf-8");
}

export async function injectInstructions(reposDir: string, baseDir?: string): Promise<void> {
  const claudeDir = baseDir ?? join(homedir(), ".claude");
  await injectSection(join(claudeDir, "CLAUDE.md"), generateInstructionsSection(reposDir));
}
