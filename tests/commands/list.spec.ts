import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { saveConfig, emptyConfig, addRepo } from "@/config.ts";
import type { RepoEntry } from "@/config.ts";
import { resolveScoutPaths } from "@/paths.ts";
import { listAction } from "@/commands/list.ts";

const SAMPLE_ENTRY: RepoEntry = {
  name: "honojs/hono",
  url: "https://github.com/honojs/hono",
  path: "/tmp/.scout/repos/honojs/hono",
  lastUpdated: "2026-03-28T15:00:00.000Z",
  reference: { kind: "branch", name: "main" },
  revision: "0123456789abcdef0123456789abcdef01234567",
};

const SECOND_ENTRY: RepoEntry = {
  name: "vercel/next.js",
  url: "https://github.com/vercel/next.js",
  path: "/tmp/.scout/repos/vercel/next.js",
  lastUpdated: "2026-03-28T16:00:00.000Z",
  reference: { kind: "branch", name: "canary" },
  revision: "abcdef0123456789abcdef0123456789abcdef01",
};

let tmpDir: string;
let logSpy: ReturnType<typeof spyOn>;
let logs: string[];

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "scout-list-test-"));
  logs = [];
  logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.push(args.join(" "));
  });
});

afterEach(async () => {
  logSpy.mockRestore();
  await rm(tmpDir, { recursive: true, force: true });
});

describe("listAction", () => {
  test("prints hint when no repos are cached", async () => {
    const paths = resolveScoutPaths(tmpDir);
    await saveConfig(paths.configPath, emptyConfig());

    await listAction(paths);

    expect(logs.some((l) => l.includes("scout add"))).toBe(true);
  });

  test("prints repo information when repos exist", async () => {
    const paths = resolveScoutPaths(tmpDir);
    const config = addRepo(emptyConfig(), SAMPLE_ENTRY);
    await saveConfig(paths.configPath, config);

    await listAction(paths);

    const output = logs.join("\n");
    expect(output).toContain("honojs/hono");
    expect(output).toContain("branch: main");
    expect(output).toContain("0123456789abcdef0123456789abcdef01234567");
    expect(output).toContain("/tmp/.scout/repos/honojs/hono");
  });

  test("filters repos by substring", async () => {
    const paths = resolveScoutPaths(tmpDir);
    const withFirstRepo = addRepo(emptyConfig(), SAMPLE_ENTRY);
    const config = addRepo(withFirstRepo, SECOND_ENTRY);
    await saveConfig(paths.configPath, config);

    await listAction(paths, "hono");

    expect(logs.some((l) => l.includes("honojs/hono"))).toBe(true);
    expect(logs.some((l) => l.includes("vercel/next.js"))).toBe(false);
  });

  test("filters repos case-insensitively", async () => {
    const paths = resolveScoutPaths(tmpDir);
    const withFirstRepo = addRepo(emptyConfig(), SAMPLE_ENTRY);
    const config = addRepo(withFirstRepo, SECOND_ENTRY);
    await saveConfig(paths.configPath, config);

    await listAction(paths, "HONO");

    expect(logs.some((l) => l.includes("honojs/hono"))).toBe(true);
    expect(logs.some((l) => l.includes("vercel/next.js"))).toBe(false);
  });

  test("prints a message when no repos match the query", async () => {
    const paths = resolveScoutPaths(tmpDir);
    const withFirstRepo = addRepo(emptyConfig(), SAMPLE_ENTRY);
    const config = addRepo(withFirstRepo, SECOND_ENTRY);
    await saveConfig(paths.configPath, config);

    await listAction(paths, "express");

    expect(logs.some((l) => l.includes('No cached repositories match "express".'))).toBe(true);
    expect(logs.some((l) => l.includes("honojs/hono"))).toBe(false);
    expect(logs.some((l) => l.includes("vercel/next.js"))).toBe(false);
  });
});
