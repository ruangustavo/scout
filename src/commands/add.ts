import pc from "picocolors";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, saveConfig, findRepo, addRepo } from "../config.ts";
import { parseGitHubUrl, cloneRepo, detectBranch } from "../repo.ts";
import { createSpinner } from "../spinner.ts";
import type { ScoutPaths } from "../paths.ts";

export function resolveRepoName(url: string): string {
  const { owner, repo } = parseGitHubUrl(url);
  return `${owner}/${repo}`;
}

export async function addAction(
  url: string,
  paths: ScoutPaths,
  nameOverride?: string,
): Promise<void> {
  const name = nameOverride ?? resolveRepoName(url);
  const config = await loadConfig(paths.configPath);

  if (findRepo(config, name)) {
    console.log(pc.yellow(`Repository ${pc.bold(name)} is already cached.`));
    return;
  }

  const destPath = join(paths.reposDir, ...name.split("/"));

  const spinner = createSpinner(`Cloning ${pc.cyan(name)}...`);

  try {
    await cloneRepo(url, destPath);
  } catch (error) {
    spinner.stop();
    await rm(destPath, { recursive: true, force: true }).catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc.red(`Failed to clone ${pc.bold(name)}:`), message);
    return;
  }

  spinner.stop();

  const branch = await detectBranch(destPath);

  const updated = addRepo(config, {
    name,
    url,
    path: destPath,
    branch,
    lastUpdated: new Date().toISOString(),
  });

  await saveConfig(paths.configPath, updated);
  console.log(pc.green("✓"), `Added ${pc.bold(name)} (branch: ${branch})`);
}
