import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const execFile = promisify(execFileCb);

const STALENESS_MS = 60 * 60 * 1000;

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const cleaned = url.replace(/\.git$/, "");

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
  await mkdir(dirname(destPath), { recursive: true });
  await execFile("git", [
    "clone",
    "--depth=1",
    "--single-branch",
    "--no-tags",
    "--no-recurse-submodules",
    url,
    destPath,
  ]);
}

export async function updateRepo(repoPath: string, branch: string): Promise<void> {
  await execFile("git", ["fetch", "--depth=1", "--no-tags"], { cwd: repoPath });
  await execFile("git", ["reset", "--hard", `origin/${branch}`], { cwd: repoPath });
}

export async function detectBranch(repoPath: string): Promise<string> {
  const { stdout } = await execFile("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repoPath,
  });
  return stdout.trim();
}
