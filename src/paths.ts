import { lstat, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export interface ScoutPaths {
  scoutDir: string;
  configPath: string;
  reposDir: string;
}

export function resolveScoutPaths(baseDir?: string): ScoutPaths {
  const scoutDir = baseDir ?? join(homedir(), ".scout");
  return {
    scoutDir,
    configPath: join(scoutDir, "config.json"),
    reposDir: join(scoutDir, "repos"),
  };
}

async function resolveCachedPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      try {
        // A dangling symlink exists even though realpath reports ENOENT.
        await lstat(path);
      } catch (statError) {
        if (statError instanceof Error && "code" in statError && statError.code === "ENOENT") {
          return join(await resolveCachedPath(dirname(path)), basename(path));
        }
        throw statError;
      }
    }
    throw error;
  }
}

export async function assertCachedPath(paths: ScoutPaths, path: string): Promise<void> {
  const [reposDir, candidate] = await Promise.all([
    realpath(paths.reposDir),
    resolveCachedPath(resolve(path)),
  ]);
  const relativePath = relative(reposDir, candidate);
  if (relativePath === "" || relativePath === ".." || relativePath.startsWith(`..${sep}`)
    || isAbsolute(relativePath)) {
    throw new Error(`Path is outside the cache: ${path}`);
  }
}
