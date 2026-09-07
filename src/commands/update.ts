import pc from "picocolors";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, saveConfig } from "../config.ts";
import { isStale, cloneRepo } from "../repo.ts";
import { createSpinner } from "../spinner.ts";
import { assertCachedPath, type ScoutPaths } from "../paths.ts";

export async function updateAction(
  name: string | undefined,
  paths: ScoutPaths,
): Promise<void> {
  const config = await loadConfig(paths.configPath);
  const entries = name ? config.repos.filter((entry) => entry.name === name) : config.repos;
  if (name && entries.length === 0) {
    throw new Error(`Repository ${name} not found. Run scout list to see cached repositories.`);
  }

  const failures: Error[] = [];
  const spinner = createSpinner("Updating cached branches...");
  try {
    const results = await Promise.all(entries.map(async (entry) => {
      if (entry.reference.kind !== "branch" || !isStale(entry.lastUpdated)) return undefined;
      try {
        await assertCachedPath(paths, entry.path);
        const path = await mkdtemp(join(paths.reposDir, "reference-"));
        try {
          const snapshot = await cloneRepo(entry.url, path, entry.reference);
          return { previous: entry, next: { ...entry, ...snapshot, path, lastUpdated: new Date().toISOString() } };
        } catch (error) {
          await rm(path, { recursive: true, force: true });
          throw error;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failure = new Error(`Failed to update ${entry.name} (branch: ${entry.reference.name}): ${message}`);
        failures.push(failure);
        console.error(pc.red(failure.message));
        return undefined;
      }
    }));
    const replacements = results.filter((result) => result !== undefined);
    const nextEntries = new Map(replacements.map(({ previous, next }) => [previous, next]));
    try {
      if (replacements.length > 0) {
        // Publishing the path and revision together keeps the previous source valid on failure.
        await saveConfig(paths.configPath, {
          repos: config.repos.map((entry) => nextEntries.get(entry) ?? entry),
        });
      }
    } catch (error) {
      await Promise.all(replacements.map(({ next }) => rm(next.path, { recursive: true, force: true })));
      throw error;
    }
    await Promise.all(replacements.map(async ({ previous }) => {
      try {
        await rm(previous.path, { recursive: true, force: true });
      } catch (error) {
        console.error(`Updated successfully but could not remove previous source at ${previous.path}:`, error);
      }
    }));
    if (failures.length > 0) {
      throw new AggregateError(failures, `${failures.length} reference(s) failed to update; updated ${replacements.length}.`);
    }
    if (replacements.length === 0) {
      console.log(pc.green("✓"), "All selected references are up to date or fixed snapshots.");
    } else {
      console.log(pc.green("✓"), `Updated ${replacements.length} reference(s).`);
    }
  } finally {
    spinner.stop();
  }
}
