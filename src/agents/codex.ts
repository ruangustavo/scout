import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import type { AgentDescriptor } from "./descriptor.ts";
import { injectSection } from "./markdown.ts";

export const descriptor: AgentDescriptor = {
  name: "codex",
  displayName: "Codex",
  detectPaths: [
    join(homedir(), ".codex"),
    ...(process.env["CODEX_HOME"] ? [process.env["CODEX_HOME"]] : []),
  ],
};

function generateSkillContent(reposDir: string): string {
  return `---
name: scout
description: Query cached source code repositories managed by Scout
---

# Scout - Source Code Query

You have access to locally cached GitHub repositories via Scout.

## Available Repos

Run \`scout list\` to see all cached repositories and their locations.

## Querying a Repo

1. If a specific repo is mentioned, use that. Otherwise, infer the relevant repo from conversation context (library names, imports, API mentions).
2. Run \`scout update <repo-name>\` to ensure the code is fresh.
3. Search files and read source code in the repo's directory to answer the question.
4. If the repo isn't cached, suggest: \`scout add <github-url>\`
5. If multiple repos could match, ask the user which one.

## Repo Directory

All repos are stored at: ${reposDir}

Each repo is at: ${reposDir}/<owner>/<repo>
`;
}

function generateInstructionsSection(reposDir: string): string {
  return `## Scout - Source Code Repository Cache

You have access to locally cached source code repositories managed by Scout. When the user asks about a library's internals, implementation, or source code, run \`scout list\` to check if the repo is available. If it is, run \`scout update <repo>\` first, then use shell commands (\`cat\`, \`grep\`, \`find\`) on \`${reposDir}/<owner>/<repo>\` to answer. If the repo isn't cached, suggest the user run \`scout add <github-url>\`. When no specific repo is mentioned, infer the relevant repo from conversation context.
`;
}

export async function installSkill(reposDir: string, baseDir?: string): Promise<void> {
  const dir = join(baseDir ?? join(homedir(), ".agents"), "skills", "scout");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), generateSkillContent(reposDir), "utf-8");
}

export async function injectInstructions(reposDir: string, baseDir?: string): Promise<void> {
  const codexDir = baseDir ?? join(homedir(), ".codex");
  await injectSection(join(codexDir, "AGENTS.md"), generateInstructionsSection(reposDir));
}
