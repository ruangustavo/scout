import pc from "picocolors";
import { rm } from "node:fs/promises";
import { loadConfig, saveConfig, findRepo, removeRepo } from "../config.ts";
import type { ScoutPaths } from "../paths.ts";

export async function removeAction(name: string, paths: ScoutPaths): Promise<void> {
  const config = await loadConfig(paths.configPath);
  const entry = findRepo(config, name);

  if (!entry) {
    console.error(pc.red(`Repository ${pc.bold(name)} not found.`));
    console.error(`Run ${pc.cyan("scout list")} to see cached repositories.`);
    return;
  }

  await rm(entry.path, { recursive: true, force: true });

  const updated = removeRepo(config, name);
  await saveConfig(paths.configPath, updated);

  console.log(pc.green("✓"), `Removed ${pc.bold(name)}`);
}
