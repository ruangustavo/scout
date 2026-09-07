import pc from "picocolors";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, saveConfig, findRepo, addRepo } from "../config.ts";
import { parseGitHubUrl, cloneRepo, resolveReference } from "../repo.ts";
import { createSpinner } from "../spinner.ts";
import type { ScoutPaths } from "../paths.ts";
import type { GitReference } from "../reference.ts";

export function resolveRepoName(url: string): string {
  const { owner, repo } = parseGitHubUrl(url);
  return `${owner}/${repo}`;
}

export async function addAction(
  url: string,
  paths: ScoutPaths,
  nameOverride?: string,
  selection?: GitReference,
): Promise<void> {
  const name = nameOverride ?? resolveRepoName(url);
  const [config, reference] = await Promise.all([
    loadConfig(paths.configPath), resolveReference(url, selection),
  ]);
  const label = `${name} (${reference.kind}: ${reference.name})`;
  const existing = findRepo(config, name, reference);
  if (existing) {
    console.log(pc.yellow(`Repository ${pc.bold(label)} is already cached at ${existing.path}.`));
    return;
  }

  await mkdir(paths.reposDir, { recursive: true });
  const destPath = await mkdtemp(join(paths.reposDir, "reference-"));
  const spinner = createSpinner(`Caching ${pc.cyan(label)}...`);
  try {
    const snapshot = await cloneRepo(url, destPath, reference);
    await saveConfig(paths.configPath, addRepo(config, {
      name, url, path: destPath, ...snapshot, lastUpdated: new Date().toISOString(),
    }));
  } catch (error) {
    await rm(destPath, { recursive: true, force: true });
    throw error;
  } finally {
    spinner.stop();
  }
  console.log(pc.green("✓"), `Added ${pc.bold(label)} at ${destPath}`);
}
