import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { saveConfig, loadConfig, emptyConfig, addRepo } from "@/config.ts";
import type { RepoEntry } from "@/config.ts";
import { resolveScoutPaths } from "@/paths.ts";
import { cloneRepo } from "@/repo.ts";
import { updateAction } from "@/commands/update.ts";

const execFile = promisify(execFileCb);

let tmpDir: string;
let bareRepoPath: string;
let workDir: string;

async function advanceRemote(content: string): Promise<string> {
  await Bun.write(join(workDir, "README.md"), content);
  await execFile("git", ["add", "."], { cwd: workDir });
  await execFile("git", ["commit", "-m", "update"], { cwd: workDir });
  await execFile("git", ["push", bareRepoPath, "main"], { cwd: workDir });
  const { stdout } = await execFile("git", ["rev-parse", "HEAD"], { cwd: workDir });
  return stdout.trim();
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "scout-update-test-"));

  bareRepoPath = join(tmpDir, "bare-repo.git");
  workDir = join(tmpDir, "work");
  await execFile("git", ["init", workDir]);
  await execFile("git", ["checkout", "-b", "main"], { cwd: workDir });
  await execFile("git", ["-C", workDir, "config", "user.email", "test@test.com"]);
  await execFile("git", ["-C", workDir, "config", "user.name", "Test"]);
  await Bun.write(join(workDir, "README.md"), "# Test");
  await execFile("git", ["add", "."], { cwd: workDir });
  await execFile("git", ["commit", "-m", "init"], { cwd: workDir });
  await execFile("git", ["clone", "--bare", workDir, bareRepoPath]);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("updateAction", () => {
  test("skips update when repo is fresh", async () => {
    const scoutDir = join(tmpDir, ".scout");
    const paths = resolveScoutPaths(scoutDir);
    await mkdir(paths.reposDir, { recursive: true });

    const clonedPath = join(paths.reposDir, "test", "repo");
    const snapshot = await cloneRepo(bareRepoPath, clonedPath);

    const entry: RepoEntry = {
      name: "test/repo",
      url: bareRepoPath,
      path: clonedPath,
      lastUpdated: new Date().toISOString(),
      ...snapshot,
    };
    await saveConfig(paths.configPath, addRepo(emptyConfig(), entry));
    await advanceRemote("# Changed upstream");

    const logs: string[] = [];
    const logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });

    await updateAction("test/repo", paths);

    logSpy.mockRestore();
    const config = await loadConfig(paths.configPath);
    const cachedEntry = config.repos[0];
    expect(cachedEntry).toBeDefined();
    if (cachedEntry === undefined) throw new Error("Expected the cached repository in config");
    expect(await Bun.file(join(cachedEntry.path, "README.md")).text()).toBe("# Test");
    expect(cachedEntry.revision).toBe(snapshot.revision);
    expect(cachedEntry.lastUpdated).toBe(entry.lastUpdated);
    expect(logs.some((l) => l.includes("up to date or fixed snapshots"))).toBe(true);
  });

  test("updates stale repo and refreshes lastUpdated", async () => {
    const scoutDir = join(tmpDir, ".scout");
    const paths = resolveScoutPaths(scoutDir);
    await mkdir(paths.reposDir, { recursive: true });

    const clonedPath = join(paths.reposDir, "test", "repo");
    const snapshot = await cloneRepo(bareRepoPath, clonedPath);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const entry: RepoEntry = {
      name: "test/repo",
      url: bareRepoPath,
      path: clonedPath,
      lastUpdated: twoHoursAgo,
      ...snapshot,
    };
    await saveConfig(paths.configPath, addRepo(emptyConfig(), entry));
    const expectedRevision = await advanceRemote("# Updated by name");

    await updateAction("test/repo", paths);

    const config = await loadConfig(paths.configPath);
    const updatedEntry = config.repos[0];
    expect(updatedEntry).toBeDefined();
    if (updatedEntry === undefined) throw new Error("Expected the updated repository in config");
    expect(await Bun.file(join(updatedEntry.path, "README.md")).text()).toBe("# Updated by name");
    expect(updatedEntry.revision).toBe(expectedRevision);
    expect(new Date(updatedEntry.lastUpdated).getTime()).toBeGreaterThan(
      new Date(twoHoursAgo).getTime(),
    );
  });

  test("updates all stale repos when no name given", async () => {
    const scoutDir = join(tmpDir, ".scout");
    const paths = resolveScoutPaths(scoutDir);
    await mkdir(paths.reposDir, { recursive: true });

    const clonedPath = join(paths.reposDir, "test", "repo");
    const snapshot = await cloneRepo(bareRepoPath, clonedPath);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const entry: RepoEntry = {
      name: "test/repo",
      url: bareRepoPath,
      path: clonedPath,
      lastUpdated: twoHoursAgo,
      ...snapshot,
    };
    await saveConfig(paths.configPath, addRepo(emptyConfig(), entry));
    const expectedRevision = await advanceRemote("# Updated globally");

    await updateAction(undefined, paths);

    const config = await loadConfig(paths.configPath);
    const updatedEntry = config.repos[0];
    expect(updatedEntry).toBeDefined();
    if (updatedEntry === undefined) throw new Error("Expected the updated repository in config");
    expect(await Bun.file(join(updatedEntry.path, "README.md")).text()).toBe("# Updated globally");
    expect(updatedEntry.revision).toBe(expectedRevision);
    expect(new Date(updatedEntry.lastUpdated).getTime()).toBeGreaterThan(
      new Date(twoHoursAgo).getTime(),
    );
  });

  test("throws when named repo not found", async () => {
    const scoutDir = join(tmpDir, ".scout");
    const paths = resolveScoutPaths(scoutDir);
    await mkdir(scoutDir, { recursive: true });
    await saveConfig(paths.configPath, emptyConfig());

    await expect(updateAction("unknown/repo", paths)).rejects.toThrow("not found");
  });
});
