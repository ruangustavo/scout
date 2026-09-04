import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import pc from "picocolors";
import { saveConfig, emptyConfig } from "../config.ts";
import { installClaudeSkill } from "../harnesses/claude.ts";
import type { ScoutPaths } from "../paths.ts";
import { installCanonicalSkill, readSkill } from "../skill.ts";

export async function setupAction(
  scoutPaths: ScoutPaths,
  homeDir: string = homedir(),
): Promise<void> {
  await mkdir(scoutPaths.reposDir, { recursive: true });

  const configExists = await readFile(scoutPaths.configPath, "utf-8")
    .then(() => true)
    .catch(() => false);

  if (!configExists) {
    await saveConfig(scoutPaths.configPath, emptyConfig());
    console.log(pc.green("✓"), "Created config at", pc.dim(scoutPaths.configPath));
  }

  const skillContent = await readSkill();
  const skillPath = await installCanonicalSkill(homeDir, skillContent);
  console.log(pc.green("✓"), "Installed skill at", pc.dim(skillPath));

  const claudeWarning = await installClaudeSkill(homeDir);
  if (claudeWarning !== undefined) {
    console.warn(`${pc.yellow("⚠")} ${claudeWarning}`);
  }

  console.log(
    `\n${pc.bold("Setup complete!")} Add repos with ${pc.cyan("scout add <github-url>")}`,
  );
}
