import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { parseGitHubUrl, isStale, cloneRepo } from "@/repo.ts";

import { updateAction } from "@/commands/update.ts";
import { loadConfig, saveConfig } from "@/config.ts";
import { resolveScoutPaths } from "@/paths.ts";

const execFile = promisify(execFileCb);

describe("parseGitHubUrl", () => {
  test("parses HTTPS URL without .git suffix", () => {
    expect(parseGitHubUrl("https://github.com/honojs/hono")).toEqual({
      owner: "honojs",
      repo: "hono",
    });
  });

  test("parses HTTPS URL with .git suffix", () => {
    expect(parseGitHubUrl("https://github.com/honojs/hono.git")).toEqual({
      owner: "honojs",
      repo: "hono",
    });
  });

  test("parses SSH URL", () => {
    expect(parseGitHubUrl("git@github.com:honojs/hono.git")).toEqual({
      owner: "honojs",
      repo: "hono",
    });
  });

  test("handles repo names with dots (e.g., next.js)", () => {
    expect(parseGitHubUrl("https://github.com/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  test("handles repo names with dots and .git suffix", () => {
    expect(parseGitHubUrl("https://github.com/vercel/next.js.git")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  test("parses HTTPS URL with trailing slash", () => {
    expect(parseGitHubUrl("https://github.com/vercel/next.js/")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  test("parses HTTPS URL with .git suffix and trailing slash", () => {
    expect(parseGitHubUrl("https://github.com/honojs/hono.git/")).toEqual({
      owner: "honojs",
      repo: "hono",
    });
  });

  test("throws on invalid URL", () => {
    expect(() => parseGitHubUrl("not-a-url")).toThrow("Invalid GitHub URL");
  });
});

describe("isStale", () => {
  test("returns true when older than threshold", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(isStale(twoHoursAgo)).toBe(true);
  });

  test("returns false when newer than threshold", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(isStale(fiveMinutesAgo)).toBe(false);
  });

  test("returns false when exactly at threshold", () => {
    const exactlyOneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(isStale(exactlyOneHourAgo)).toBe(false);
  });
});

describe("git operations", () => {
  let tmpDir: string;
  let bareRepoPath: string;
  let clonedRepoPath: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "scout-repo-test-"));
    bareRepoPath = join(tmpDir, "bare-repo.git");
    clonedRepoPath = join(tmpDir, "cache", "repos", "cloned-repo");

    const workDir = join(tmpDir, "work");
    await execFile("git", ["init", workDir]);
    await execFile("git", ["checkout", "-b", "main"], { cwd: workDir });
    await execFile("git", ["-C", workDir, "config", "user.email", "test@test.com"]);
    await execFile("git", ["-C", workDir, "config", "user.name", "Test"]);
    await Bun.write(join(workDir, "README.md"), "# Test Repo");
    await execFile("git", ["add", "."], { cwd: workDir });
    await execFile("git", ["commit", "-m", "initial commit"], { cwd: workDir });
    await execFile("git", ["clone", "--bare", workDir, bareRepoPath]);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("cloneRepo clones a repository to the destination path", async () => {
    await cloneRepo(bareRepoPath, clonedRepoPath);
    const readme = await Bun.file(join(clonedRepoPath, "README.md")).text();
    expect(readme).toBe("# Test Repo");
  });

  test("cloning without a selector records the resolved default branch", async () => {
    const { reference, revision } = await cloneRepo(bareRepoPath, clonedRepoPath);
    const { stdout } = await execFile("git", ["rev-parse", "main"], { cwd: bareRepoPath });
    expect(reference).toEqual({ kind: "branch", name: "main" });
    expect(revision).toBe(stdout.trim());
  });

  test("updating a cached branch publishes newly added source files", async () => {
    const snapshot = await cloneRepo(bareRepoPath, clonedRepoPath);
    const paths = resolveScoutPaths(join(tmpDir, "cache"));
    await saveConfig(paths.configPath, { repos: [{
      name: "test/repo", url: bareRepoPath, path: clonedRepoPath,
      ...snapshot, lastUpdated: "2000-01-01T00:00:00.000Z",
    }] });

    const pushDir = join(tmpDir, "push-work");
    await execFile("git", ["clone", bareRepoPath, pushDir]);
    await Bun.write(join(pushDir, "NEW.md"), "new content");
    await execFile("git", ["-C", pushDir, "config", "user.email", "test@test.com"]);
    await execFile("git", ["-C", pushDir, "config", "user.name", "Test"]);
    await execFile("git", ["add", "."], { cwd: pushDir });
    await execFile("git", ["commit", "-m", "second commit"], { cwd: pushDir });
    await execFile("git", ["push"], { cwd: pushDir });

    await updateAction("test/repo", paths);
    const { repos } = await loadConfig(paths.configPath);
    const entry = repos[0];
    if (!entry) throw new Error("Expected updated repository");
    const newFile = await Bun.file(join(entry.path, "NEW.md")).text();
    expect(newFile).toBe("new content");
  });
});
