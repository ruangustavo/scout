import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { sameReference, type GitReference } from "./reference.ts";
import { validateReference } from "./repo.ts";

export interface RepoEntry {
  name: string;
  url: string;
  path: string;
  lastUpdated: string;
  reference: GitReference;
  revision: string;
}

export interface ScoutConfig {
  repos: RepoEntry[];
}

/** Returns a fresh object each call to prevent shared-reference mutation bugs. */
export function emptyConfig(): ScoutConfig {
  return { repos: [] };
}

function parseReference(value: unknown): GitReference | undefined {
  if (typeof value !== "object" || value === null
    || !("kind" in value) || !("name" in value)
    || (value.kind !== "branch" && value.kind !== "tag" && value.kind !== "commit")
    || typeof value.name !== "string" || value.name.length === 0) return undefined;
  return { kind: value.kind, name: value.name };
}

async function parseRepoEntry(value: unknown): Promise<RepoEntry | undefined> {
  if (typeof value !== "object" || value === null
    || !("name" in value) || typeof value.name !== "string" || value.name.length === 0
    || !("url" in value) || typeof value.url !== "string" || value.url.length === 0
    || !("path" in value) || typeof value.path !== "string" || value.path.length === 0
    || !("lastUpdated" in value) || typeof value.lastUpdated !== "string"
    || !Number.isFinite(Date.parse(value.lastUpdated))
    || !("revision" in value) || typeof value.revision !== "string"
    || !/^(?:[\da-f]{40}|[\da-f]{64})$/.test(value.revision)
    || !("reference" in value)) return undefined;

  const reference = parseReference(value.reference);
  if (reference === undefined) return undefined;
  const normalizedReference = await validateReference(reference);
  if (normalizedReference.kind === "commit" && normalizedReference.name !== value.revision) {
    return undefined;
  }
  return {
    name: value.name,
    url: value.url,
    path: value.path,
    lastUpdated: value.lastUpdated,
    reference: normalizedReference,
    revision: value.revision,
  };
}

export async function loadConfig(configPath: string): Promise<ScoutConfig> {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return emptyConfig();
    throw error;
  }
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null || !("repos" in value)
    || !Array.isArray(value.repos)) {
    throw new Error(`Invalid Scout config: ${configPath}`);
  }
  const repos = await Promise.all(value.repos.map(parseRepoEntry));
  if (repos.some((entry) => entry === undefined)) {
    throw new Error(`Invalid Scout config: ${configPath}`);
  }
  return { repos: repos.filter((entry) => entry !== undefined) };
}

export async function saveConfig(configPath: string, config: ScoutConfig): Promise<void> {
  const tempDir = await mkdtemp(join(dirname(configPath), ".scout-config-"));
  try {
    const tempPath = join(tempDir, basename(configPath));
    await writeFile(tempPath, JSON.stringify(config, null, 2), "utf-8");
    await rename(tempPath, configPath);
  } finally {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Could not clean up ${tempDir}:`, error);
    }
  }
}

export function findRepo(config: ScoutConfig, name: string, reference?: GitReference): RepoEntry | undefined {
  const matches = config.repos.filter((entry) => entry.name === name
    && (reference === undefined || sameReference(entry.reference, reference)));
  return matches.length === 1 ? matches[0] : undefined;
}

export function addRepo(config: ScoutConfig, entry: RepoEntry): ScoutConfig {
  return { repos: [...config.repos, entry] };
}

export function removeRepo(config: ScoutConfig, name: string, reference?: GitReference): ScoutConfig {
  return { repos: config.repos.filter((entry) => entry.name !== name
    || (reference !== undefined && !sameReference(entry.reference, reference))) };
}
