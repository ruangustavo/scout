import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";
import { pipeline } from "node:stream/promises";
import { fullRef, type GitReference } from "./reference.ts";

const STALENESS_MS = 60 * 60 * 1000;

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const cleaned = url.replace(/\/+$/, "").replace(/\.git$/, "");
  const match = cleaned.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+)\/([\w.-]+)$/);
  const owner = match?.[1];
  const repo = match?.[2];
  if (owner && repo && owner !== "." && owner !== ".." && repo !== "." && repo !== "..") {
    return { owner, repo };
  }
  throw new Error(`Invalid GitHub URL: ${url}`);
}

export function isStale(lastUpdated: string): boolean {
  return Date.now() - new Date(lastUpdated).getTime() > STALENESS_MS;
}

export async function validateReference(reference: GitReference): Promise<GitReference> {
  if (reference.kind === "commit") {
    if (!/^(?:[\da-f]{40}|[\da-f]{64})$/i.test(reference.name)) {
      throw new Error("Commit requires a full hexadecimal SHA (40 or 64 characters).");
    }
    return { kind: "commit", name: reference.name.toLowerCase() };
  }
  await runGit(["check-ref-format", fullRef(reference)]);
  return reference;
}

export async function resolveReference(url: string, reference?: GitReference): Promise<GitReference> {
  if (reference) return validateReference(reference);
  const output = await runGit(["ls-remote", "--symref", "--", url, "HEAD"]);
  const name = output.match(/^ref: refs\/heads\/(.+)\tHEAD$/m)?.[1];
  if (!name) throw new Error(`Could not resolve the default branch of ${url}`);
  return { kind: "branch", name };
}

async function resolveRevision(url: string, reference: GitReference): Promise<string> {
  if (reference.kind === "commit") return reference.name;
  const ref = fullRef(reference);
  const output = await runGit(["ls-remote", "--", url, ref, `${ref}^{}`]);
  const refs = new Map(output.trim().split("\n").map((line) => {
    const [revision, name] = line.split("\t");
    return [name, revision];
  }));
  const revision = refs.get(`${ref}^{}`) ?? refs.get(ref);
  if (!revision || !/^(?:[\da-f]{40}|[\da-f]{64})$/.test(revision)) {
    throw new Error(`Remote reference not found: ${ref}`);
  }
  return revision;
}

export async function cloneRepo(
  url: string,
  destPath: string,
  selection?: GitReference,
): Promise<{ reference: GitReference; revision: string }> {
  const reference = await resolveReference(url, selection);
  const gh = tryParseGitHub(url);
  await mkdir(dirname(destPath), { recursive: true });
  if (gh) {
    const revision = await resolveRevision(url, reference);
    await cloneViaTarball(gh.owner, gh.repo, destPath, revision);
    return { reference, revision };
  }

  await runGit(["init", destPath]);
  await runGit(["remote", "add", "origin", url], destPath);
  await runGit(["fetch", "--depth=1", "--no-tags", "--no-recurse-submodules", "origin",
    reference.kind === "commit" ? reference.name : fullRef(reference)], destPath);
  const revision = (await runGit(["rev-parse", "FETCH_HEAD^{commit}"], destPath)).trim();
  if (reference.kind === "branch") {
    await runGit(["checkout", "-B", reference.name, revision, "--"], destPath);
  } else {
    await runGit(["checkout", "--detach", revision, "--"], destPath);
  }
  return { reference, revision };
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
  destPath: string,
  revision: string,
): Promise<void> {
  const tarballUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/${revision}`;
  const response = await fetch(tarballUrl, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`tarball ${tarballUrl} failed: ${response.status}`);
  }
  await mkdir(destPath, { recursive: true });
  const tarProc = spawn("tar", ["-xz", "--strip-components=1", "-C", destPath], {
    stdio: ["pipe", "ignore", "pipe"],
  });
  const results = await Promise.allSettled([
    text(tarProc.stderr),
    waitForExit(tarProc),
    pipeline(Readable.fromWeb(response.body), tarProc.stdin),
  ]);
  const [stderr, exitCode] = results;
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
  }
  if (exitCode.status === "fulfilled" && exitCode.value !== 0) {
    throw new Error(`tar exited ${exitCode.value}: ${stderr.status === "fulfilled" ? stderr.value.trim().slice(-300) : ""}`);
  }
}

async function runGit(args: string[], cwd?: string): Promise<string> {
  const process = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const [stdout, stderr, exitCode] = await Promise.all([
    text(process.stdout), text(process.stderr), waitForExit(process),
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
