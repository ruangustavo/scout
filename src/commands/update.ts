import pc from "picocolors";
import { loadConfig, saveConfig, findRepo } from "../config.ts";
import { isStale, updateRepo } from "../repo.ts";
import type { ScoutPaths } from "../paths.ts";

export async function updateAction(
  name: string | undefined,
  paths: ScoutPaths,
): Promise<void> {
  const config = await loadConfig(paths.configPath);

  if (name) {
    const entry = findRepo(config, name);
    if (!entry) {
      console.error(pc.red(`Repository ${pc.bold(name)} not found.`));
      console.error(`Run ${pc.cyan("scout list")} to see cached repositories.`);
      return;
    }

    if (!isStale(entry.lastUpdated)) {
      console.log(pc.green("✓"), `${pc.bold(name)} is already up to date.`);
      return;
    }

    console.log(`Updating ${pc.cyan(name)}...`);
    await updateRepo(entry.path, entry.branch);
    entry.lastUpdated = new Date().toISOString();
    await saveConfig(paths.configPath, config);
    console.log(pc.green("✓"), `Updated ${pc.bold(name)}`);
    return;
  }

  let updatedCount = 0;
  for (const entry of config.repos) {
    if (!isStale(entry.lastUpdated)) continue;

    console.log(`Updating ${pc.cyan(entry.name)}...`);
    await updateRepo(entry.path, entry.branch);
    entry.lastUpdated = new Date().toISOString();
    updatedCount++;
  }

  await saveConfig(paths.configPath, config);

  if (updatedCount === 0) {
    console.log(pc.green("✓"), "All repositories are up to date.");
  } else {
    console.log(pc.green("✓"), `Updated ${updatedCount} repository(s).`);
  }
}
