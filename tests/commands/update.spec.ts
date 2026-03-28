import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { saveConfig, loadConfig, emptyConfig, addRepo } from "@/config.ts";
import type { RepoEntry } from "@/config.ts";
import { resolveScoutPaths } from "@/paths.ts";
import { cloneRepo, detectBranch } from "@/repo.ts";
import { updateAction } from "@/commands/update.ts";

const execFile = promisify(execFileCb);

let tmpDir: string;
let bareRepoPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "scout-update-test-"));

  bareRepoPath = join(tmpDir, "bare-repo.git");
  const workDir = join(tmpDir, "work");
  await execFile("git", ["init", workDir]);
  await execFile("git", ["checkout", "-b", "main"], { cwd: workDir });
  await execFile("git", ["-C", workDir, "config", "user.email", "test@test.com"]);
  await execFile("git", ["-C", workDir, "config", "user.name", "Test"]);
  await writeFile(join(workDir, "README.md"), "# Test");
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
    await cloneRepo(bareRepoPath, clonedPath);
    const branch = await detectBranch(clonedPath);

    const entry: RepoEntry = {
      name: "test/repo",
      url: bareRepoPath,
      path: clonedPath,
      branch,
      lastUpdated: new Date().toISOString(),
    };
    await saveConfig(paths.configPath, addRepo(emptyConfig(), entry));

    const logs: string[] = [];
    const logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });

    await updateAction("test/repo", paths);

    logSpy.mockRestore();
    expect(logs.some((l) => l.includes("up to date"))).toBe(true);
  });

  test("updates stale repo and refreshes lastUpdated", async () => {
    const scoutDir = join(tmpDir, ".scout");
    const paths = resolveScoutPaths(scoutDir);
    await mkdir(paths.reposDir, { recursive: true });

    const clonedPath = join(paths.reposDir, "test", "repo");
    await cloneRepo(bareRepoPath, clonedPath);
    const branch = await detectBranch(clonedPath);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const entry: RepoEntry = {
      name: "test/repo",
      url: bareRepoPath,
      path: clonedPath,
      branch,
      lastUpdated: twoHoursAgo,
    };
    await saveConfig(paths.configPath, addRepo(emptyConfig(), entry));

    await updateAction("test/repo", paths);

    const config = await loadConfig(paths.configPath);
    const updatedEntry = config.repos[0]!;
    expect(new Date(updatedEntry.lastUpdated).getTime()).toBeGreaterThan(
      new Date(twoHoursAgo).getTime(),
    );
  });

  test("updates all stale repos when no name given", async () => {
    const scoutDir = join(tmpDir, ".scout");
    const paths = resolveScoutPaths(scoutDir);
    await mkdir(paths.reposDir, { recursive: true });

    const clonedPath = join(paths.reposDir, "test", "repo");
    await cloneRepo(bareRepoPath, clonedPath);
    const branch = await detectBranch(clonedPath);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const entry: RepoEntry = {
      name: "test/repo",
      url: bareRepoPath,
      path: clonedPath,
      branch,
      lastUpdated: twoHoursAgo,
    };
    await saveConfig(paths.configPath, addRepo(emptyConfig(), entry));

    await updateAction(undefined, paths);

    const config = await loadConfig(paths.configPath);
    expect(new Date(config.repos[0]!.lastUpdated).getTime()).toBeGreaterThan(
      new Date(twoHoursAgo).getTime(),
    );
  });

  test("prints error when named repo not found", async () => {
    const scoutDir = join(tmpDir, ".scout");
    const paths = resolveScoutPaths(scoutDir);
    await mkdir(scoutDir, { recursive: true });
    await saveConfig(paths.configPath, emptyConfig());

    const errors: string[] = [];
    const errorSpy = spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" "));
    });

    await updateAction("unknown/repo", paths);

    errorSpy.mockRestore();
    expect(errors.some((e) => e.includes("not found"))).toBe(true);
  });
});
