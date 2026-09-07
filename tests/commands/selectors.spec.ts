import { afterEach, beforeEach, expect, test } from "bun:test";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { loadConfig, saveConfig, type RepoEntry } from "@/config.ts";
import { resolveScoutPaths } from "@/paths.ts";

const execFile = promisify(execFileCallback);
const projectRoot = join(import.meta.dir, "../..");
const repositoryUrl = "https://github.com/example/project";
const commitSha = "abcdef0123456789abcdef0123456789abcdef01";
let home: string;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "scout-selectors-"));
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

async function runScout(isolatedHome: string, ...args: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const child = Bun.spawn(["bun", "run", "src/index.ts", ...args], {
    cwd: projectRoot,
    env: { ...process.env, HOME: isolatedHome },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

async function cacheFixture(): Promise<{
  branchPath: string;
  tagPath: string;
  commitPath: string;
  configPath: string;
}> {
  const paths = resolveScoutPaths(join(home, ".scout"));
  const branchPath = join(paths.reposDir, "branch");
  const tagPath = join(paths.reposDir, "tag");
  const commitPath = join(paths.reposDir, "commit");
  await Promise.all([
    mkdir(paths.scoutDir, { recursive: true }),
    mkdir(branchPath, { recursive: true }),
    mkdir(tagPath, { recursive: true }),
    mkdir(commitPath, { recursive: true }),
  ]);
  await Promise.all([
    Bun.write(join(branchPath, "source.txt"), "branch source"),
    Bun.write(join(tagPath, "source.txt"), "tag source"),
    Bun.write(join(commitPath, "source.txt"), "commit source"),
  ]);

  const timestamp = "2025-01-01T00:00:00.000Z";
  const entries: RepoEntry[] = [
    {
      name: "example/project",
      url: repositoryUrl,
      path: branchPath,
      lastUpdated: timestamp,
      reference: { kind: "branch", name: "main" },
      revision: "1".repeat(40),
    },
    {
      name: "example/project",
      url: repositoryUrl,
      path: tagPath,
      lastUpdated: timestamp,
      reference: { kind: "tag", name: "main" },
      revision: "2".repeat(40),
    },
    {
      name: "example/project",
      url: repositoryUrl,
      path: commitPath,
      lastUpdated: timestamp,
      reference: { kind: "commit", name: commitSha },
      revision: commitSha,
    },
  ];
  await saveConfig(paths.configPath, { repos: entries });
  return { branchPath, tagPath, commitPath, configPath: paths.configPath };
}

async function configureLocalGitHubRewrite(): Promise<void> {
  const workPath = join(home, "git-work");
  const remotePath = join(home, "remote.git");
  await execFile("git", ["init", "-b", "main", workPath]);
  await execFile("git", ["-C", workPath, "config", "user.name", "Test"]);
  await execFile("git", ["-C", workPath, "config", "user.email", "test@example.com"]);
  await Bun.write(join(workPath, "README.md"), "local remote");
  await execFile("git", ["-C", workPath, "add", "."]);
  await execFile("git", ["-C", workPath, "commit", "-m", "initial"]);
  await execFile("git", ["clone", "--bare", workPath, remotePath]);
  await execFile(
    "git",
    ["config", "--file", join(home, ".gitconfig"), `url.${remotePath}.insteadOf`, repositoryUrl],
  );
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

test("add rejects incompatible reference selectors before accessing the repository", async () => {
  const result = await runScout(
    home,
    "add",
    "https://example.invalid/owner/repo",
    "--branch",
    "main",
    "--tag",
    "v1.0.0",
  );

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("cannot be used with option '--tag <name>'");
});

test("remove rejects incompatible reference selectors before reading the cache", async () => {
  const result = await runScout(
    home,
    "remove",
    "owner/repo",
    "--tag",
    "v1.0.0",
    "--commit",
    "a".repeat(40),
  );

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("cannot be used with option '--commit <sha>'");
});

test("commit selectors reject abbreviated SHAs", async () => {
  const result = await runScout(
    home,
    "add",
    "https://example.invalid/owner/repo",
    "--commit",
    "deadbeef",
  );

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("commit must be a full 40- or 64-character hexadecimal SHA");
});

test("remove rejects --all combined with a reference selector", async () => {
  const result = await runScout(home, "remove", "owner/repo", "--all", "--branch", "main");

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("cannot be used with option '--all'");
});

test("command help documents reference selection", async () => {
  const [addHelp, removeHelp] = await Promise.all([
    runScout(home, "add", "--help"),
    runScout(home, "remove", "--help"),
  ]);

  expect(addHelp.exitCode).toBe(0);
  expect(addHelp.stdout).toContain("--branch <name>");
  expect(addHelp.stdout).toContain("--tag <name>");
  expect(addHelp.stdout).toContain("--commit <sha>");
  expect(removeHelp.exitCode).toBe(0);
  expect(removeHelp.stdout).toContain("--all");
});

test("add routes explicit selectors to their existing cached references", async () => {
  const fixture = await cacheFixture();
  await configureLocalGitHubRewrite();
  const originalConfig = await Bun.file(fixture.configPath).text();

  const [branch, tag, commit] = await Promise.all([
    runScout(home, "add", repositoryUrl, "--branch", "main"),
    runScout(home, "add", repositoryUrl, "--tag", "main"),
    runScout(home, "add", repositoryUrl, "--commit", commitSha.toUpperCase()),
  ]);

  expect(branch.exitCode).toBe(0);
  expect(branch.stdout).toContain(fixture.branchPath);
  expect(tag.exitCode).toBe(0);
  expect(tag.stdout).toContain(fixture.tagPath);
  expect(commit.exitCode).toBe(0);
  expect(commit.stdout).toContain(fixture.commitPath);
  expect(commit.stdout).toContain(commitSha);
  expect(await Bun.file(fixture.configPath).text()).toBe(originalConfig);
});

test("remove routes tag and all selectors without crossing reference boundaries", async () => {
  const fixture = await cacheFixture();

  const tagRemoval = await runScout(home, "remove", "example/project", "--tag", "main");
  const afterTag = await loadConfig(fixture.configPath);

  const [tagExists, branchExists, commitExists] = await Promise.all([
    exists(fixture.tagPath),
    exists(fixture.branchPath),
    exists(fixture.commitPath),
  ]);
  expect(tagRemoval.exitCode).toBe(0);
  expect(tagExists).toBe(false);
  expect(branchExists).toBe(true);
  expect(commitExists).toBe(true);
  expect(afterTag.repos.map((entry) => `${entry.reference.kind}:${entry.reference.name}`)).toEqual([
    "branch:main",
    `commit:${commitSha}`,
  ]);

  const allRemoval = await runScout(home, "remove", "example/project", "--all");
  const afterAll = await loadConfig(fixture.configPath);

  const [branchExistsAfterAll, commitExistsAfterAll] = await Promise.all([
    exists(fixture.branchPath),
    exists(fixture.commitPath),
  ]);
  expect(allRemoval.exitCode).toBe(0);
  expect(branchExistsAfterAll).toBe(false);
  expect(commitExistsAfterAll).toBe(false);
  expect(afterAll.repos).toEqual([]);
});
