import pc from "picocolors";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { saveConfig, emptyConfig } from "../config.ts";
import { generateSkillContent, generateClaudeMdSection } from "../skill.ts";
import type { ScoutPaths, ClaudePaths } from "../paths.ts";

const SCOUT_MARKER = "## Scout - Source Code Repository Cache";

export async function setupAction(
  scoutPaths: ScoutPaths,
  claudePaths: ClaudePaths,
): Promise<void> {
  await mkdir(scoutPaths.reposDir, { recursive: true });

  const configExists = await readFile(scoutPaths.configPath, "utf-8")
    .then(() => true)
    .catch(() => false);

  if (!configExists) {
    await saveConfig(scoutPaths.configPath, emptyConfig());
    console.log(pc.green("✓"), "Created config at", pc.dim(scoutPaths.configPath));
  }

  await mkdir(dirname(claudePaths.skillPath), { recursive: true });
  await writeFile(claudePaths.skillPath, generateSkillContent(scoutPaths.reposDir), "utf-8");
  console.log(pc.green("✓"), "Installed skill at", pc.dim(claudePaths.skillPath));

  await mkdir(dirname(claudePaths.claudeMdPath), { recursive: true });

  let existing = "";
  try {
    existing = await readFile(claudePaths.claudeMdPath, "utf-8");
  } catch {
    // File doesn't exist yet
  }

  if (!existing.includes(SCOUT_MARKER)) {
    const section = generateClaudeMdSection(scoutPaths.reposDir);
    const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n\n" : "\n";
    const content = existing.length > 0 ? existing + separator + section : section;
    await writeFile(claudePaths.claudeMdPath, content, "utf-8");
    console.log(pc.green("✓"), "Added Scout section to", pc.dim(claudePaths.claudeMdPath));
  }

  console.log(
    `\n${pc.bold("Setup complete!")} Add repos with ${pc.cyan("scout add <github-url>")}`,
  );
}
