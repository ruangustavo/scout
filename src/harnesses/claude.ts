import { lstat, mkdir, readlink, stat, symlink } from "node:fs/promises";
import { join } from "node:path";

const SCOUT_SKILL_TARGET = "../../.agents/skills/scout";

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

export async function installClaudeSkill(homeDir: string): Promise<string | undefined> {
  const claudeDir = join(homeDir, ".claude");
  if (!(await exists(claudeDir))) return undefined;

  const skillsDir = join(claudeDir, "skills");
  const linkPath = join(skillsDir, "scout");
  await mkdir(skillsDir, { recursive: true });

  try {
    const link = await lstat(linkPath);
    if (link.isSymbolicLink() && (await readlink(linkPath)) === SCOUT_SKILL_TARGET) {
      return undefined;
    }
    return `Scout did not change ${linkPath} because something else already exists there`;
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  await symlink(SCOUT_SKILL_TARGET, linkPath, "dir");
  return undefined;
}
