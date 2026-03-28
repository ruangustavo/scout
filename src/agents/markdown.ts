import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const SCOUT_MARKER = "## Scout - Source Code Repository Cache";

export async function injectSection(filePath: string, section: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });

  let existing = "";
  try {
    existing = await readFile(filePath, "utf-8");
  } catch {
    // File doesn't exist yet
  }

  if (existing.includes(SCOUT_MARKER)) return;

  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n\n" : "\n";
  const content = existing.length > 0 ? existing + separator + section : section;
  await writeFile(filePath, content, "utf-8");
}

