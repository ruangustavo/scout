import { join } from "node:path";
import { homedir } from "node:os";

export interface ScoutPaths {
  scoutDir: string;
  configPath: string;
  reposDir: string;
}

export interface ClaudePaths {
  claudeDir: string;
  claudeMdPath: string;
  skillPath: string;
}

export function resolveScoutPaths(baseDir?: string): ScoutPaths {
  const scoutDir = baseDir ?? join(homedir(), ".scout");
  return {
    scoutDir,
    configPath: join(scoutDir, "config.json"),
    reposDir: join(scoutDir, "repos"),
  };
}

export function resolveClaudePaths(baseDir?: string): ClaudePaths {
  const claudeDir = baseDir ?? join(homedir(), ".claude");
  return {
    claudeDir,
    claudeMdPath: join(claudeDir, "CLAUDE.md"),
    skillPath: join(claudeDir, "commands", "scout.md"),
  };
}
