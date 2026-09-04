import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";
import { pipeline } from "node:stream/promises";

const STALENESS_MS = 60 * 60 * 1000;

const CLONE_FLAGS = [
  "clone",
  "--depth=1",
  "--single-branch",
  "--no-tags",
  "--no-recurse-submodules",
] as const satisfies readonly string[];

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const cleaned = url.replace(/\/+$/, "").replace(/\.git$/, "");

  const httpsMatch = cleaned.match(/github\.com\/([^/]+)\/([^/]+)$/);
  if (httpsMatch) {
    const [, owner, repo] = httpsMatch;
    if (owner && repo) return { owner, repo };
  }

  const sshMatch = cleaned.match(/github\.com:([^/]+)\/([^/]+)$/);
  if (sshMatch) {
    const [, owner, repo] = sshMatch;
    if (owner && repo) return { owner, repo };
  }

  throw new Error(`Invalid GitHub URL: ${url}`);
}

export function isStale(lastUpdated: string): boolean {
  const updatedAt = new Date(lastUpdated).getTime();
  return Date.now() - updatedAt > STALENESS_MS;
}

export async function cloneRepo(url: string, destPath: string): Promise<void> {
  const gh = tryParseGitHub(url);
  
  if (gh) {
    await cloneViaTarball(gh.owner, gh.repo, url, destPath);
    return;
  }

  await mkdir(dirname(destPath), { recursive: true });
  await runGit([...CLONE_FLAGS, url, destPath]);
}

function tryParseGitHub(url: string): { owner: string; repo: string } | undefined {
  try {
    return parseGitHubUrl(url);
  } catch {
    return undefined;
  }
}

async function cloneViaTarball(
  owner: string,
  repo: string,
  url: string,
  destPath: string,
): Promise<void> {
  const tarballUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/HEAD`;
  await mkdir(destPath, { recursive: true });

  const [tarballRes, branch] = await Promise.all([
    fetch(tarballUrl, { redirect: "follow" }),
    resolveDefaultBranch(owner, repo),
  ]);

  if (!tarballRes.ok || !tarballRes.body) {
    throw new Error(`tarball ${tarballUrl} failed: ${tarballRes.status}`);
  }

  const tarProc = spawn("tar", ["-xz", "--strip-components=1", "-C", destPath], {
    stdio: ["pipe", "ignore", "pipe"],
  });

  const [stderr, exitCode] = await Promise.all([
    text(tarProc.stderr),
    waitForExit(tarProc),
    pipeline(Readable.fromWeb(tarballRes.body), tarProc.stdin),
    initMinimalGitDir(destPath, url, branch),
  ]);

  if (exitCode !== 0) {
    throw new Error(`tar exited ${exitCode}: ${stderr.trim().slice(-300)}`);
  }
}

async function initMinimalGitDir(destPath: string, url: string, branch: string): Promise<void> {
  const gitDir = join(destPath, ".git");

  await Promise.all([
    mkdir(join(gitDir, "refs", "heads"), { recursive: true }),
    mkdir(join(gitDir, "refs", "remotes", "origin"), { recursive: true }),
    mkdir(join(gitDir, "objects", "pack"), { recursive: true }),
    mkdir(join(gitDir, "objects", "info"), { recursive: true }),
  ]);

  await Promise.all([
    writeFile(join(gitDir, "HEAD"), `ref: refs/heads/${branch}\n`),
    writeFile(
      join(gitDir, "config"),
      [
        "[core]",
        "\trepositoryformatversion = 0",
        "\tfilemode = true",
        "\tbare = false",
        "\tlogallrefupdates = true",
        `[remote "origin"]`,
        `\turl = ${url}`,
        "\tfetch = +refs/heads/*:refs/remotes/origin/*",
        "",
      ].join("\n"),
    ),
  ]);
}

async function resolveDefaultBranch(owner: string, repo: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!res.ok) return "main";
  const body = (await res.json()) as { default_branch?: unknown };
  
  return typeof body.default_branch === "string" && body.default_branch.length > 0
    ? body.default_branch
    : "main";
}

export async function updateRepo(repoPath: string, branch: string): Promise<void> {
  await runGit(["fetch", "--depth=1", "--no-tags"], repoPath);
  await runGit(["reset", "--hard", `origin/${branch}`], repoPath);
}

export async function detectBranch(repoPath: string): Promise<string> {
  try {
    const stdout = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], repoPath);
    const name = stdout.trim();
    if (name && name !== "HEAD") return name;
  } catch {
    // unborn HEAD — fall through to reading .git/HEAD
  }

  const head = await readFile(join(repoPath, ".git", "HEAD"), "utf8");
  const match = head.match(/^ref: refs\/heads\/(.+)$/m);
  if (!match?.[1]) throw new Error(`could not detect branch from ${repoPath}`);
  return match[1];
}

async function runGit(args: string[], cwd?: string): Promise<string> {
  const process = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const [stdout, stderr, exitCode] = await Promise.all([
    text(process.stdout),
    text(process.stderr),
    waitForExit(process),
  ]);

  if (exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed (${exitCode}): ${stderr.trim()}`);
  }

  return stdout;
}

function waitForExit(process: ReturnType<typeof spawn>): Promise<number> {
  return new Promise((resolve, reject) => {
    process.once("error", reject);
    process.once("close", (code) => {
      if (code === null) {
        reject(new Error("process exited without a status code"));
        return;
      }
      resolve(code);
    });
  });
}
