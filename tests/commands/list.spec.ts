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
  branch: "main",
  lastUpdated: "2026-03-28T15:00:00.000Z",
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

    expect(logs.some((l) => l.includes("honojs/hono"))).toBe(true);
  });
});
