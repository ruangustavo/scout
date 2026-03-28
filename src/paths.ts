import { join } from "node:path";
import { homedir } from "node:os";

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
