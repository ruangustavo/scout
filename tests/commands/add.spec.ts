import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { saveConfig, loadConfig, emptyConfig, addRepo } from "@/config.ts";
import type { RepoEntry } from "@/config.ts";
import { resolveScoutPaths } from "@/paths.ts";
import { addAction } from "@/commands/add.ts";

const execFile = promisify(execFileCb);

let tmpDir: string;
let bareRepoPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "scout-add-test-"));

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

describe("addAction", () => {
  test("clones repo and adds it to config", async () => {
    const scoutDir = join(tmpDir, ".scout");
    await mkdir(scoutDir, { recursive: true });
    await mkdir(join(scoutDir, "repos"), { recursive: true });
    const paths = resolveScoutPaths(scoutDir);
    await saveConfig(paths.configPath, emptyConfig());

    await addAction(bareRepoPath, paths, "test/repo");

    const config = await loadConfig(paths.configPath);
    expect(config.repos).toHaveLength(1);
    expect(config.repos[0]!.name).toBe("test/repo");
    expect(config.repos[0]!.branch).toBe("main");
  });

  test("warns when repo is already cached", async () => {
    const scoutDir = join(tmpDir, ".scout");
    await mkdir(scoutDir, { recursive: true });
    await mkdir(join(scoutDir, "repos"), { recursive: true });
    const paths = resolveScoutPaths(scoutDir);

    const entry: RepoEntry = {
      name: "test/repo",
      url: bareRepoPath,
      path: join(paths.reposDir, "test", "repo"),
      branch: "main",
      lastUpdated: new Date().toISOString(),
    };
    await saveConfig(paths.configPath, addRepo(emptyConfig(), entry));

    const logs: string[] = [];
    const logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });

    await addAction(bareRepoPath, paths, "test/repo");

    logSpy.mockRestore();
    expect(logs.some((l) => l.includes("already cached"))).toBe(true);
  });
});
