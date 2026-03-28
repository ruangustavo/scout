import { readFile, writeFile } from "node:fs/promises";

export interface RepoEntry {
  name: string;
  url: string;
  path: string;
  branch: string;
  lastUpdated: string;
}

export interface ScoutConfig {
  repos: RepoEntry[];
}

/** Returns a fresh object each call to prevent shared-reference mutation bugs. */
export function emptyConfig(): ScoutConfig {
  return { repos: [] };
}

export async function loadConfig(configPath: string): Promise<ScoutConfig> {
  try {
    const raw = await readFile(configPath, "utf-8");
    return JSON.parse(raw) as ScoutConfig;
  } catch {
    return emptyConfig();
  }
}

export async function saveConfig(configPath: string, config: ScoutConfig): Promise<void> {
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function findRepo(config: ScoutConfig, name: string): RepoEntry | undefined {
  return config.repos.find((r) => r.name === name);
}

export function addRepo(config: ScoutConfig, entry: RepoEntry): ScoutConfig {
  return { repos: [...config.repos, entry] };
}

export function removeRepo(config: ScoutConfig, name: string): ScoutConfig {
  return { repos: config.repos.filter((r) => r.name !== name) };
}
