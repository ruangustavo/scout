import { readFile } from "node:fs/promises";

const skillUrl = new URL("../skills/scout/SKILL.md", import.meta.url);

export function readSkill(): Promise<string> {
  return readFile(skillUrl, "utf-8");
}
