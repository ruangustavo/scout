import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const execFile = promisify(execFileCb);

const STALENESS_MS = 60 * 60 * 1000;

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const cleaned = url.replace(/\.git$/, "");

  const httpsMatch = cleaned.match(/github\.com\/([^/]+)\/([^/]+)$/);
  if (httpsMatch) return { owner: httpsMatch[1]!, repo: httpsMatch[2]! };

  const sshMatch = cleaned.match(/github\.com:([^/]+)\/([^/]+)$/);
  if (sshMatch) return { owner: sshMatch[1]!, repo: sshMatch[2]! };

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
