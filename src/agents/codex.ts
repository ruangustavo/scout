import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir, writeFile, rm } from "node:fs/promises";
import type { AgentDescriptor } from "./descriptor.ts";

export const descriptor: AgentDescriptor = {
  name: "codex",
  displayName: "Codex",
  detectPaths: [
    join(homedir(), ".codex"),
    ...(process.env["CODEX_HOME"] ? [process.env["CODEX_HOME"]] : []),
  ],
  supportsPassiveAwareness: false,
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

export async function installSkill(reposDir: string, baseDir?: string): Promise<void> {
  const dir = join(baseDir ?? join(homedir(), ".agents"), "skills", "scout");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), generateSkillContent(reposDir), "utf-8");
}

export async function uninstallSkill(baseDir?: string): Promise<void> {
  const dir = join(baseDir ?? join(homedir(), ".agents"), "skills", "scout");
  await rm(dir, { recursive: true, force: true });
}

export async function injectInstructions(_reposDir: string, _baseDir?: string): Promise<void> {
  // Codex has no global instructions file
}

export async function removeInstructions(_baseDir?: string): Promise<void> {
  // Codex has no global instructions file
}
