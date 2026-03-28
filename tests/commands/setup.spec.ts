import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveScoutPaths, resolveClaudePaths } from "@/paths.ts";
import { setupAction } from "@/commands/setup.ts";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "scout-setup-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("setupAction", () => {
  test("creates scout directory structure", async () => {
    const scoutPaths = resolveScoutPaths(join(tmpDir, ".scout"));
    const claudePaths = resolveClaudePaths(join(tmpDir, ".claude"));

    await setupAction(scoutPaths, claudePaths);

    const reposDirExists = await stat(scoutPaths.reposDir).then(() => true).catch(() => false);
    expect(reposDirExists).toBe(true);
  });

  test("creates empty config.json", async () => {
    const scoutPaths = resolveScoutPaths(join(tmpDir, ".scout"));
    const claudePaths = resolveClaudePaths(join(tmpDir, ".claude"));

    await setupAction(scoutPaths, claudePaths);

    const config = JSON.parse(await readFile(scoutPaths.configPath, "utf-8"));
    expect(config).toEqual({ repos: [] });
  });

  test("creates Claude Code skill file", async () => {
    const scoutPaths = resolveScoutPaths(join(tmpDir, ".scout"));
    const claudePaths = resolveClaudePaths(join(tmpDir, ".claude"));

    await setupAction(scoutPaths, claudePaths);

    const skill = await readFile(claudePaths.skillPath, "utf-8");
    expect(skill).toContain("scout list");
    expect(skill).toContain(scoutPaths.reposDir);
  });

  test("appends section to CLAUDE.md", async () => {
    const scoutPaths = resolveScoutPaths(join(tmpDir, ".scout"));
    const claudePaths = resolveClaudePaths(join(tmpDir, ".claude"));

    await setupAction(scoutPaths, claudePaths);

    const claudeMd = await readFile(claudePaths.claudeMdPath, "utf-8");
    expect(claudeMd).toContain("Scout");
    expect(claudeMd).toContain(scoutPaths.reposDir);
  });

  test("appends to existing CLAUDE.md without overwriting", async () => {
    const scoutPaths = resolveScoutPaths(join(tmpDir, ".scout"));
    const claudePaths = resolveClaudePaths(join(tmpDir, ".claude"));

    await mkdir(join(tmpDir, ".claude"), { recursive: true });
    await writeFile(claudePaths.claudeMdPath, "# Existing Content\n\nKeep this.\n");

    await setupAction(scoutPaths, claudePaths);

    const claudeMd = await readFile(claudePaths.claudeMdPath, "utf-8");
    expect(claudeMd).toContain("# Existing Content");
    expect(claudeMd).toContain("Keep this.");
    expect(claudeMd).toContain("Scout");
  });

  test("is idempotent — running twice does not duplicate CLAUDE.md section", async () => {
    const scoutPaths = resolveScoutPaths(join(tmpDir, ".scout"));
    const claudePaths = resolveClaudePaths(join(tmpDir, ".claude"));

    await setupAction(scoutPaths, claudePaths);
    await setupAction(scoutPaths, claudePaths);

    const claudeMd = await readFile(claudePaths.claudeMdPath, "utf-8");
    const matches = claudeMd.match(/## Scout - Source Code Repository Cache/g);
    expect(matches).toHaveLength(1);
  });
});
