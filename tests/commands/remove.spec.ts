import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { saveConfig, loadConfig, emptyConfig, addRepo } from "@/config.ts";
import type { RepoEntry } from "@/config.ts";
import { resolveScoutPaths } from "@/paths.ts";
import { removeAction } from "@/commands/remove.ts";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "scout-remove-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("removeAction", () => {
  test("removes repo from config and deletes directory", async () => {
    const scoutDir = join(tmpDir, ".scout");
    const paths = resolveScoutPaths(scoutDir);
    await mkdir(paths.reposDir, { recursive: true });

    const repoDir = join(paths.reposDir, "honojs", "hono");
    await mkdir(repoDir, { recursive: true });

    const entry: RepoEntry = {
      name: "honojs/hono",
      url: "https://github.com/honojs/hono",
      path: repoDir,
      branch: "main",
      lastUpdated: new Date().toISOString(),
    };
    await saveConfig(paths.configPath, addRepo(emptyConfig(), entry));

    await removeAction("honojs/hono", paths);

    const config = await loadConfig(paths.configPath);
    expect(config.repos).toHaveLength(0);

    const dirExists = await stat(repoDir).then(() => true).catch(() => false);
    expect(dirExists).toBe(false);
  });

  test("prints error when repo not found", async () => {
    const scoutDir = join(tmpDir, ".scout");
    const paths = resolveScoutPaths(scoutDir);
    await mkdir(paths.reposDir, { recursive: true });
    await saveConfig(paths.configPath, emptyConfig());

    const errors: string[] = [];
    const errorSpy = spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" "));
    });

    await removeAction("unknown/repo", paths);

    errorSpy.mockRestore();
    expect(errors.some((e) => e.includes("not found"))).toBe(true);
  });
});
