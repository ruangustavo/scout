import { afterEach, beforeEach, expect, test } from "bun:test";
import { execFile as execFileCb } from "node:child_process";
import { chmod, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { addAction } from "@/commands/add.ts";
import { loadConfig, saveConfig } from "@/config.ts";
import { updateAction } from "@/commands/update.ts";
import { removeAction } from "@/commands/remove.ts";
import { resolveScoutPaths } from "@/paths.ts";
import type { GitReference } from "@/reference.ts";

const execFile = promisify(execFileCb);
let root: string;
let remote: string;
let work: string;

async function git(...args: string[]): Promise<string> {
  const result = await execFile("git", args, { cwd: work });
  return result.stdout.trim();
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "scout-references-"));
  work = join(root, "work");
  remote = join(root, "remote.git");
  await mkdir(work);
  await git("init", "-b", "main");
  await git("config", "user.name", "Test");
  await git("config", "user.email", "test@example.com");
  await Bun.write(join(work, "source.txt"), "original");
  await git("add", ".");
  await git("commit", "-m", "initial");
  await git("tag", "-a", "core@1.2.3", "-m", "release");
  await git("checkout", "-b", "core@1.2.3");
  await Bun.write(join(work, "source.txt"), "branch content");
  await git("commit", "-am", "branch change");
  await git("clone", "--bare", work, remote);
  await git("--git-dir", remote, "symbolic-ref", "HEAD", "refs/heads/main");
  await mkdir(join(root, "cache"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test("branch and annotated tag with the same monorepo name coexist with distinct source", async () => {
  const paths = resolveScoutPaths(join(root, "cache"));
  await addAction(remote, paths, "test/repo", { kind: "branch", name: "core@1.2.3" });
  await addAction(remote, paths, "test/repo", { kind: "tag", name: "core@1.2.3" });
  const { repos } = await loadConfig(paths.configPath);
  expect(repos).toHaveLength(2);
  const contents = await Promise.all(repos.map((repo) => Bun.file(join(repo.path, "source.txt")).text()));
  expect(contents).toEqual(["branch content", "original"]);
  expect(repos[0]?.path).not.toBe(repos[1]?.path);
});

test("update follows the selected branch but preserves moved tags and fixed commits", async () => {
  const paths = resolveScoutPaths(join(root, "cache"));
  const commit = await git("rev-parse", "main");
  await addAction(remote, paths, "test/repo");
  await addAction(remote, paths, "test/repo", { kind: "tag", name: "core@1.2.3" });
  await addAction(remote, paths, "test/repo", { kind: "commit", name: commit });
  const before = await loadConfig(paths.configPath);
  for (const entry of before.repos) entry.lastUpdated = "2000-01-01T00:00:00.000Z";
  await saveConfig(paths.configPath, before);
  await git("checkout", "main");
  await Bun.write(join(work, "source.txt"), "updated main");
  await git("commit", "-am", "main change");
  await git("tag", "-f", "core@1.2.3");
  await git("push", "--force", remote, "refs/heads/main", "refs/tags/core@1.2.3");
  await git("--git-dir", remote, "symbolic-ref", "HEAD", "refs/heads/core@1.2.3");
  await addAction(remote, paths, "test/repo", { kind: "tag", name: "core@1.2.3" });
  await updateAction("test/repo", paths);
  const after = await loadConfig(paths.configPath);
  expect(after.repos).toHaveLength(3);
  expect(await Promise.all(after.repos.map((entry) => Bun.file(join(entry.path, "source.txt")).text())))
    .toEqual(["updated main", "original", "original"]);
  expect(after.repos[0]?.reference).toEqual({ kind: "branch", name: "main" });
  expect(after.repos[0]?.revision).toBe(await git("rev-parse", "main"));
  expect(after.repos.slice(1)).toEqual(before.repos.slice(1));
});

test("remove requires a selection when ambiguous and can remove one or all references", async () => {
  const paths = resolveScoutPaths(join(root, "cache"));
  await addAction(remote, paths, "test/repo", { kind: "branch", name: "core@1.2.3" });
  await addAction(remote, paths, "test/repo", { kind: "tag", name: "core@1.2.3" });
  const before = await loadConfig(paths.configPath);
  const [branch, tag] = before.repos;
  if (!branch || !tag) throw new Error("Expected cached branch and tag");
  await expect(removeAction("test/repo", paths)).rejects.toThrow("--all");
  expect(await loadConfig(paths.configPath)).toEqual(before);
  expect(await Promise.all(before.repos.map((entry) => Bun.file(join(entry.path, "source.txt")).text())))
    .toEqual(["branch content", "original"]);
  await removeAction("test/repo", paths, { kind: "tag", name: "core@1.2.3" });
  const remaining = await loadConfig(paths.configPath);
  expect(remaining.repos.map((entry) => entry.reference)).toEqual([{ kind: "branch", name: "core@1.2.3" }]);
  await expect(Bun.file(join(tag.path, "source.txt")).text()).rejects.toThrow();
  await addAction(remote, paths, "test/repo", { kind: "tag", name: "core@1.2.3" });
  await removeAction("test/repo", paths, "all");
  expect((await loadConfig(paths.configPath)).repos).toEqual([]);
  await expect(Bun.file(join(branch.path, "source.txt")).text()).rejects.toThrow();
});

test("a deleted branch fails without falling back or preventing other references from updating", async () => {
  const paths = resolveScoutPaths(join(root, "cache"));
  await addAction(remote, paths, "test/repo");
  await addAction(remote, paths, "test/repo", { kind: "branch", name: "core@1.2.3" });
  const before = await loadConfig(paths.configPath);
  for (const entry of before.repos) entry.lastUpdated = "2000-01-01T00:00:00.000Z";
  await saveConfig(paths.configPath, before);
  await git("--git-dir", remote, "symbolic-ref", "HEAD", "refs/heads/core@1.2.3");
  await git("--git-dir", remote, "update-ref", "-d", "refs/heads/main");
  await Bun.write(join(work, "source.txt"), "surviving branch updated");
  await git("commit", "-am", "advance survivor");
  await git("push", remote, "refs/heads/core@1.2.3");
  await expect(updateAction("test/repo", paths)).rejects.toThrow("1 reference(s) failed");
  const after = await loadConfig(paths.configPath);
  expect(after.repos[0]).toEqual(before.repos[0]);
  expect(await Promise.all(after.repos.map((entry) => Bun.file(join(entry.path, "source.txt")).text())))
    .toEqual(["original", "surviving branch updated"]);
  expect(after.repos[1]?.revision).toBe(await git("rev-parse", "HEAD"));
});

test("only removing and re-adding a tag obtains its moved destination", async () => {
  const paths = resolveScoutPaths(join(root, "cache"));
  const reference: GitReference = { kind: "tag", name: "core@1.2.3" };
  await addAction(remote, paths, "test/repo", reference);
  await git("tag", "-f", "core@1.2.3");
  await git("push", "--force", remote, "refs/tags/core@1.2.3");
  await removeAction("test/repo", paths, reference);
  await addAction(remote, paths, "test/repo", reference);
  const { repos } = await loadConfig(paths.configPath);
  expect(repos).toHaveLength(1);
  const entry = repos[0];
  if (!entry) throw new Error("Expected cached tag");
  expect(await Bun.file(join(entry.path, "source.txt")).text()).toBe("branch content");
  expect(entry.revision).toBe(await git("rev-parse", "HEAD"));
});

test("default selection reuses its branch and selects the new default only on a later add", async () => {
  const paths = resolveScoutPaths(join(root, "cache"));
  await addAction(remote, paths, "test/repo");
  await addAction(remote, paths, "test/repo", { kind: "branch", name: "main" });
  const before = await loadConfig(paths.configPath);
  expect(before.repos).toHaveLength(1);
  await git("--git-dir", remote, "symbolic-ref", "HEAD", "refs/heads/core@1.2.3");
  await addAction(remote, paths, "test/repo");
  const after = await loadConfig(paths.configPath);
  expect(after.repos.map((entry) => entry.reference)).toEqual([
    { kind: "branch", name: "main" }, { kind: "branch", name: "core@1.2.3" },
  ]);
  expect(after.repos[0]).toEqual(before.repos[0]);
});

test("invalid or missing references do not publish cache entries or disturb valid content", async () => {
  const paths = resolveScoutPaths(join(root, "cache"));
  await addAction(remote, paths, "test/repo");
  const before = await loadConfig(paths.configPath);
  await expect(addAction(remote, paths, "test/repo", { kind: "commit", name: "1234567" })).rejects.toThrow("full");
  await expect(addAction(remote, paths, "test/repo", { kind: "branch", name: "missing" })).rejects.toThrow();
  await expect(addAction(remote, paths, "test/repo", { kind: "tag", name: "main" })).rejects.toThrow();
  expect(await loadConfig(paths.configPath)).toEqual(before);
  const entry = before.repos[0];
  if (!entry) throw new Error("Expected cached branch");
  expect(await Bun.file(join(entry.path, "source.txt")).text()).toBe("original");
});

test("remove preserves source and metadata when config publication fails", async () => {
  const paths = resolveScoutPaths(join(root, "cache"));
  await addAction(remote, paths, "test/repo");
  const before = await loadConfig(paths.configPath);
  const entry = before.repos[0];
  if (!entry) throw new Error("Expected cached branch");
  await chmod(paths.scoutDir, 0o555);
  try {
    await expect(removeAction("test/repo", paths)).rejects.toThrow();
    expect(await loadConfig(paths.configPath)).toEqual(before);
    expect(await Bun.file(join(entry.path, "source.txt")).text()).toBe("original");
  } finally {
    await chmod(paths.scoutDir, 0o755);
  }
});

test("a config publication failure leaves the previous source, revision and timestamp intact", async () => {
  const paths = resolveScoutPaths(join(root, "cache"));
  await addAction(remote, paths, "test/repo");
  const before = await loadConfig(paths.configPath);
  const entry = before.repos[0];
  if (!entry) throw new Error("Expected cached branch");
  entry.lastUpdated = "2000-01-01T00:00:00.000Z";
  await saveConfig(paths.configPath, before);
  await git("checkout", "main");
  await Bun.write(join(work, "source.txt"), "unpublished source");
  await git("commit", "-am", "advance main");
  await git("push", remote, "refs/heads/main");
  await Promise.all([chmod(paths.configPath, 0o444), chmod(paths.scoutDir, 0o555)]);
  try {
    await expect(updateAction("test/repo", paths)).rejects.toThrow();
    expect(await loadConfig(paths.configPath)).toEqual(before);
    expect(await Bun.file(join(entry.path, "source.txt")).text()).toBe("original");
  } finally {
    await Promise.all([chmod(paths.configPath, 0o644), chmod(paths.scoutDir, 0o755)]);
  }
});
