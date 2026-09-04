import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupAction } from "@/commands/setup.ts";
import { resolveScoutPaths } from "@/paths.ts";
import type { ScoutPaths } from "@/paths.ts";

let homeDir: string;

beforeEach(async () => {
  homeDir = await mkdtemp(join(tmpdir(), "scout-setup-test-"));
});

afterEach(async () => {
  mock.restore();
  await rm(homeDir, { recursive: true, force: true });
});

function scoutPaths(): ScoutPaths {
  return resolveScoutPaths(join(homeDir, ".scout"));
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("setupAction", () => {
  test("creates the cache and overwrites the canonical skill byte-for-byte", async () => {
    const paths = scoutPaths();
    const installedPath = join(homeDir, ".agents", "skills", "scout", "SKILL.md");
    await mkdir(join(homeDir, ".agents", "skills", "scout"), { recursive: true });
    await writeFile(installedPath, "stale skill");

    await setupAction(paths, homeDir);
    await writeFile(installedPath, "stale again");
    await setupAction(paths, homeDir);

    const [config, installedSkill, packagedSkill, claudeExists] = await Promise.all([
      readFile(paths.configPath, "utf-8"),
      readFile(installedPath),
      readFile(new URL("../../skills/scout/SKILL.md", import.meta.url)),
      pathExists(join(homeDir, ".claude")),
    ]);
    expect(JSON.parse(config)).toEqual({ repos: [] });
    expect(installedSkill.equals(packagedSkill)).toBe(true);
    expect(claudeExists).toBe(false);
    expect(await stat(paths.reposDir)).toBeDefined();
  });

  test("creates Claude Code's relative symlink when .claude exists", async () => {
    await mkdir(join(homeDir, ".claude"));

    await setupAction(scoutPaths(), homeDir);

    expect(await readlink(join(homeDir, ".claude", "skills", "scout"))).toBe(
      "../../.agents/skills/scout",
    );
  });

  test("leaves an existing correct Claude Code symlink unchanged and silent", async () => {
    const linkPath = join(homeDir, ".claude", "skills", "scout");
    await mkdir(join(homeDir, ".claude", "skills"), { recursive: true });
    await symlink("../../.agents/skills/scout", linkPath, "dir");
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    await setupAction(scoutPaths(), homeDir);

    expect(await readlink(linkPath)).toBe("../../.agents/skills/scout");
    expect(warn).not.toHaveBeenCalled();
  });

  test("warns and preserves a real directory at Claude Code's skill path", async () => {
    const conflictPath = join(homeDir, ".claude", "skills", "scout");
    await mkdir(conflictPath, { recursive: true });
    await writeFile(join(conflictPath, "keep.txt"), "keep");
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    await setupAction(scoutPaths(), homeDir);

    expect(await readFile(join(conflictPath, "keep.txt"), "utf-8")).toBe("keep");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(conflictPath));
  });
});
