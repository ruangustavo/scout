import pc from "picocolors";
import { rm } from "node:fs/promises";
import { loadConfig, saveConfig, findRepo, removeRepo } from "../config.ts";
import { createSpinner } from "../spinner.ts";
import type { ScoutPaths } from "../paths.ts";

export async function removeAction(name: string, paths: ScoutPaths): Promise<void> {
  const config = await loadConfig(paths.configPath);
  const entry = findRepo(config, name);

  if (!entry) {
    console.error(pc.red(`Repository ${pc.bold(name)} not found.`));
    console.error(`Run ${pc.cyan("scout list")} to see cached repositories.`);
    return;
  }

  const spinner = createSpinner(`Removing ${pc.cyan(name)}...`);

  try {
    await rm(entry.path, { recursive: true, force: true });
  } catch (error) {
    spinner.stop();
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc.red(`Failed to remove ${pc.bold(name)}:`), message);
    return;
  }

  spinner.stop();

  const updated = removeRepo(config, name);
  await saveConfig(paths.configPath, updated);

  console.log(pc.green("✓"), `Removed ${pc.bold(name)}`);
}
