import pc from "picocolors";
import { rm } from "node:fs/promises";
import { loadConfig, saveConfig, removeRepo } from "../config.ts";
import { sameReference, type GitReference } from "../reference.ts";
import { validateReference } from "../repo.ts";
import { createSpinner } from "../spinner.ts";
import { assertCachedPath, type ScoutPaths } from "../paths.ts";

export async function removeAction(
  name: string,
  paths: ScoutPaths,
  selection?: GitReference | "all",
): Promise<void> {
  const [config, reference] = await Promise.all([
    loadConfig(paths.configPath),
    selection && selection !== "all" ? validateReference(selection) : undefined,
  ]);
  const entries = config.repos.filter((entry) => entry.name === name
    && (reference === undefined || sameReference(entry.reference, reference)));
  if (entries.length === 0) {
    throw new Error(`Repository ${name} not found. Run scout list to see cached repositories.`);
  }
  if (entries.length > 1 && selection === undefined) {
    throw new Error(`Repository ${name} has multiple references. Select --branch, --tag, --commit, or --all.`);
  }

  await Promise.all(entries.map((entry) => assertCachedPath(paths, entry.path)));
  const spinner = createSpinner(`Removing ${pc.cyan(name)}...`);
  try {
    await saveConfig(paths.configPath, removeRepo(config, name, reference));
    const results = await Promise.all(entries.map(async (entry) => {
      try {
        await rm(entry.path, { recursive: true, force: true });
        return undefined;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failure = new Error(`Could not remove source at ${entry.path}: ${message}`);
        console.error(failure.message);
        return failure;
      }
    }));
    const failures = results.filter((result) => result !== undefined);
    if (failures.length > 0) {
      throw new AggregateError(failures, `Removed cache entries but ${failures.length} source directory(s) could not be deleted.`);
    }
  } finally {
    spinner.stop();
  }
  console.log(pc.green("✓"), `Removed ${entries.length} reference(s) of ${pc.bold(name)}`);
}
