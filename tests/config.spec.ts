import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadConfig,
  saveConfig,
  findRepo,
  addRepo,
  removeRepo,
  emptyConfig,
} from "@/config.ts";
import type { ScoutConfig, RepoEntry } from "@/config.ts";

const SAMPLE_ENTRY: RepoEntry = {
  name: "honojs/hono",
  url: "https://github.com/honojs/hono",
  path: "/tmp/test/.scout/repos/honojs/hono",
  branch: "main",
  lastUpdated: "2026-03-28T15:00:00.000Z",
};

let tmpDir: string;
let configPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "scout-test-"));
  configPath = join(tmpDir, "config.json");
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("emptyConfig", () => {
  test("returns config with empty repos array", () => {
    const config = emptyConfig();
    expect(config).toEqual({ repos: [] });
  });
});

describe("saveConfig and loadConfig", () => {
  test("round-trips a config through the filesystem", async () => {
    const config: ScoutConfig = { repos: [SAMPLE_ENTRY] };
    await saveConfig(configPath, config);
    const loaded = await loadConfig(configPath);
    expect(loaded).toEqual(config);
  });

  test("loadConfig returns empty config when file does not exist", async () => {
    const config = await loadConfig(join(tmpDir, "missing.json"));
    expect(config).toEqual({ repos: [] });
  });
});

describe("findRepo", () => {
  test("returns the matching entry", () => {
    const config: ScoutConfig = { repos: [SAMPLE_ENTRY] };
    expect(findRepo(config, "honojs/hono")).toEqual(SAMPLE_ENTRY);
  });

  test("returns undefined when not found", () => {
    const config: ScoutConfig = { repos: [SAMPLE_ENTRY] };
    expect(findRepo(config, "vercel/next.js")).toBeUndefined();
  });
});

describe("addRepo", () => {
  test("appends a new entry to the repos array", () => {
    const config = emptyConfig();
    const updated = addRepo(config, SAMPLE_ENTRY);
    expect(updated.repos).toHaveLength(1);
    expect(updated.repos[0]).toEqual(SAMPLE_ENTRY);
  });

  test("does not mutate the original config", () => {
    const config = emptyConfig();
    addRepo(config, SAMPLE_ENTRY);
    expect(config.repos).toHaveLength(0);
  });
});

describe("removeRepo", () => {
  test("removes the entry with matching name", () => {
    const config: ScoutConfig = { repos: [SAMPLE_ENTRY] };
    const updated = removeRepo(config, "honojs/hono");
    expect(updated.repos).toHaveLength(0);
  });

  test("returns unchanged config when name not found", () => {
    const config: ScoutConfig = { repos: [SAMPLE_ENTRY] };
    const updated = removeRepo(config, "vercel/next.js");
    expect(updated.repos).toHaveLength(1);
  });

  test("does not mutate the original config", () => {
    const config: ScoutConfig = { repos: [SAMPLE_ENTRY] };
    removeRepo(config, "honojs/hono");
    expect(config.repos).toHaveLength(1);
  });
});
