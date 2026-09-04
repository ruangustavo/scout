import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const skillUrl = new URL("../skills/scout/SKILL.md", import.meta.url);

export function readSkill(): Promise<string> {
  return readFile(skillUrl, "utf-8");
}

export async function installCanonicalSkill(
  homeDir: string,
  content: string,
): Promise<string> {
  const skillDir = join(homeDir, ".agents", "skills", "scout");
  const skillPath = join(skillDir, "SKILL.md");
  await mkdir(skillDir, { recursive: true });
  await writeFile(skillPath, content, "utf-8");
  return skillPath;
}
