import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { addAction } from "@/commands/add.ts";
import { updateAction } from "@/commands/update.ts";
import { loadConfig, saveConfig } from "@/config.ts";
import { resolveScoutPaths } from "@/paths.ts";

const execFile = promisify(execFileCallback);
const githubUrl = "https://github.com/test/repo";

let root: string;
let work: string;
let remote: string;
let previousGlobalConfig: string | undefined;
let archives: Map<string, string>;
let failedDownloads: Set<string>;

async function git(...args: string[]): Promise<string> {
  const result = await execFile("git", args, { cwd: work });
  return result.stdout.trim();
}

async function archive(revision: string, name: string): Promise<void> {
  const path = join(root, `${name}.tar.gz`);
  await execFile("git", [
    "--git-dir",
    remote,
    "archive",
    "--format=tar.gz",
    `--prefix=repo-${revision}/`,
    `--output=${path}`,
    revision,
  ]);
  archives.set(revision, path);
}

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

beforeEach(async () => {
  previousGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
  root = await mkdtemp(join(tmpdir(), "scout-github-references-"));
  work = join(root, "work");
  remote = join(root, "remote.git");
  archives = new Map();
  failedDownloads = new Set();

  await mkdir(work);
  await git("init", "-b", "main");
  await git("config", "user.name", "Test");
  await git("config", "user.email", "test@example.com");
  await Bun.write(join(work, "source.txt"), "tag content");
  await git("add", ".");
  await git("commit", "-m", "initial");
  await git("tag", "-a", "shared", "-m", "annotated release");
  await git("checkout", "-b", "shared");
  await Bun.write(join(work, "source.txt"), "branch content");
  await git("commit", "-am", "branch source");
  await git("checkout", "main");
  await git("checkout", "-b", "survivor");
  await Bun.write(join(work, "source.txt"), "survivor old");
  await git("commit", "-am", "survivor source");
  await git("checkout", "main");
  await git("clone", "--bare", work, remote);
  await git("--git-dir", remote, "symbolic-ref", "HEAD", "refs/heads/main");

  const globalConfig = join(root, "gitconfig");
  await execFile("git", [
    "config",
    "--file",
    globalConfig,
    `url.${remote}.insteadOf`,
    githubUrl,
  ]);
  process.env.GIT_CONFIG_GLOBAL = globalConfig;

  const fetchMock = Object.assign(
    async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
      const revision = new URL(urlOf(input)).pathname.split("/").at(-1);
      if (!revision) return new Response("missing revision", { status: 400 });
      if (failedDownloads.has(revision)) return new Response("download failed", { status: 503 });
      const path = archives.get(revision);
      if (!path) return new Response("unknown revision", { status: 404 });
      return new Response(await Bun.file(path).arrayBuffer(), { status: 200 });
    },
    { preconnect: globalThis.fetch.preconnect },
  );
  spyOn(globalThis, "fetch").mockImplementation(fetchMock);
});

afterEach(async () => {
  mock.restore();
  if (previousGlobalConfig === undefined) {
    delete process.env.GIT_CONFIG_GLOBAL;
  } else {
    process.env.GIT_CONFIG_GLOBAL = previousGlobalConfig;
  }
  await rm(root, { recursive: true, force: true });
});

test("GitHub branch and annotated tag download their effective commit SHAs", async () => {
  const [branchRevision, tagObject, tagRevision] = await Promise.all([
    git("rev-parse", "refs/heads/shared"),
    git("rev-parse", "refs/tags/shared"),
    git("rev-parse", "refs/tags/shared^{}"),
  ]);
  expect(tagRevision).not.toBe(tagObject);
  await Promise.all([
    archive(branchRevision, "branch"),
    archive(tagRevision, "tag"),
  ]);

  const paths = resolveScoutPaths(join(root, "cache"));
  await addAction(githubUrl, paths, undefined, { kind: "branch", name: "shared" });
  await addAction(githubUrl, paths, undefined, { kind: "tag", name: "shared" });

  const { repos } = await loadConfig(paths.configPath);
  expect(repos.map((entry) => entry.revision)).toEqual([branchRevision, tagRevision]);
  expect(await Promise.all(repos.map((entry) => Bun.file(join(entry.path, "source.txt")).text())))
    .toEqual(["branch content", "tag content"]);
});

test("a failed GitHub update preserves its source and config while another branch updates", async () => {
  const [oldMainRevision, oldSurvivorRevision] = await Promise.all([
    git("rev-parse", "refs/heads/main"),
    git("rev-parse", "refs/heads/survivor"),
  ]);
  await Promise.all([
    archive(oldMainRevision, "main-old"),
    archive(oldSurvivorRevision, "survivor-old"),
  ]);

  const paths = resolveScoutPaths(join(root, "cache"));
  await addAction(githubUrl, paths, undefined, { kind: "branch", name: "main" });
  await addAction(githubUrl, paths, undefined, { kind: "branch", name: "survivor" });
  const staleConfig = await loadConfig(paths.configPath);
  for (const entry of staleConfig.repos) entry.lastUpdated = "2000-01-01T00:00:00.000Z";
  await saveConfig(paths.configPath, staleConfig);
  const before = await loadConfig(paths.configPath);
  const failedEntry = before.repos.find((entry) => entry.reference.name === "main");
  if (!failedEntry) throw new Error("main cache entry was not created");
  await git("checkout", "main");
  await Bun.write(join(work, "source.txt"), "main new");
  await git("commit", "-am", "advance main");
  await git("checkout", "survivor");
  await Bun.write(join(work, "source.txt"), "survivor new");
  await git("commit", "-am", "advance survivor");
  await git("push", remote, "refs/heads/main", "refs/heads/survivor");
  const [newMainRevision, newSurvivorRevision] = await Promise.all([
    git("rev-parse", "refs/heads/main"),
    git("rev-parse", "refs/heads/survivor"),
  ]);
  await archive(newSurvivorRevision, "survivor-new");
  failedDownloads.add(newMainRevision);

  await expect(updateAction("test/repo", paths)).rejects.toThrow("1 reference(s) failed");

  const after = await loadConfig(paths.configPath);
  const mainAfter = after.repos.find((entry) => entry.reference.name === "main");
  const survivorAfter = after.repos.find((entry) => entry.reference.name === "survivor");
  if (!mainAfter || !survivorAfter) throw new Error("updated cache entries are missing");
  const [mainSource, survivorSource] = await Promise.all([
    Bun.file(join(mainAfter.path, "source.txt")).text(),
    Bun.file(join(survivorAfter.path, "source.txt")).text(),
  ]);
  expect(mainAfter).toEqual(failedEntry);
  expect(mainSource).toBe("tag content");
  expect(survivorAfter.revision).toBe(newSurvivorRevision);
  expect(survivorSource).toBe("survivor new");
});
