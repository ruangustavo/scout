import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
import { gitReferenceSchema, sameReference, type GitReference } from "./reference.ts";
import { validateReference } from "./repo.ts";

const repoEntrySchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  path: z.string().min(1),
  lastUpdated: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  reference: gitReferenceSchema,
  revision: z.string().regex(/^(?:[\da-f]{40}|[\da-f]{64})$/),
}).transform(async (entry): Promise<typeof entry> => ({
  ...entry,
  reference: await validateReference(entry.reference),
})).refine((entry) => entry.reference.kind !== "commit" || entry.reference.name === entry.revision);

const scoutConfigSchema = z.object({ repos: z.array(repoEntrySchema) });

export type RepoEntry = z.infer<typeof repoEntrySchema>;
export type ScoutConfig = z.infer<typeof scoutConfigSchema>;

/** Returns a fresh object each call to prevent shared-reference mutation bugs. */
export function emptyConfig(): ScoutConfig {
  return { repos: [] };
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
  const result = await scoutConfigSchema.safeParseAsync(value);
  if (!result.success) {
    throw new Error(`Invalid Scout config: ${configPath}`);
  }
  return result.data;
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
