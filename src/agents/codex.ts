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

function generateInstructionsSection(reposDir: string): string {
  return `## Scout - Source Code Repository Cache

You have access to locally cached source code repositories managed by Scout. When the user asks about a library's internals, implementation, or source code, run \`scout list\` to check if the repo is available. If there are many cached repos, use \`scout list <query>\` to narrow the results by a case-insensitive repository name match. If the repo is available, run \`scout update <repo>\` first, then use shell commands (\`cat\`, \`grep\`, \`find\`) on \`${reposDir}/<owner>/<repo>\` to answer. If the repo isn't cached, suggest the user run \`scout add <github-url>\`. When no specific repo is mentioned, infer the relevant repo from conversation context.
`;
}

export async function installSkill(skillContent: string, baseDir?: string): Promise<void> {
  const dir = join(baseDir ?? join(homedir(), ".agents"), "skills", "scout");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), skillContent, "utf-8");
}

export async function injectInstructions(reposDir: string, baseDir?: string): Promise<void> {
  const codexDir = baseDir ?? join(homedir(), ".codex");
  await injectSection(join(codexDir, "AGENTS.md"), generateInstructionsSection(reposDir));
}
