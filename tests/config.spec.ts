import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { chmod, mkdtemp, rm } from "node:fs/promises";
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
  lastUpdated: "2026-03-28T15:00:00.000Z",
  reference: { kind: "branch", name: "main" },
  revision: "0123456789abcdef0123456789abcdef01234567",
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

  const invalidConfigs: Array<{ name: string; config: unknown }> = [
    { name: "an empty repository name", config: { repos: [{ ...SAMPLE_ENTRY, name: "" }] } },
    { name: "an empty repository URL", config: { repos: [{ ...SAMPLE_ENTRY, url: "" }] } },
    { name: "an empty cache path", config: { repos: [{ ...SAMPLE_ENTRY, path: "" }] } },
    {
      name: "an invalid update date",
      config: { repos: [{ ...SAMPLE_ENTRY, lastUpdated: "not-a-date" }] },
    },
    {
      name: "an invalid Git reference",
      config: { repos: [{ ...SAMPLE_ENTRY, reference: { kind: "branch", name: "bad..branch" } }] },
    },
    {
      name: "a commit reference that differs from its revision",
      config: {
        repos: [{
          ...SAMPLE_ENTRY,
          reference: { kind: "commit", name: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        }],
      },
    },
    {
      name: "the legacy branch-only format",
      config: {
        repos: [{
          name: SAMPLE_ENTRY.name,
          url: SAMPLE_ENTRY.url,
          path: SAMPLE_ENTRY.path,
          branch: "main",
          lastUpdated: SAMPLE_ENTRY.lastUpdated,
        }],
      },
    },
  ];

  for (const { name, config } of invalidConfigs) {
    test(`rejects ${name} without modifying the file`, async () => {
      const contents = JSON.stringify(config);
      await Bun.write(configPath, contents);

      await expect(loadConfig(configPath)).rejects.toThrow();

      expect(await Bun.file(configPath).text()).toBe(contents);
    });
  }

  test("normalizes an uppercase commit reference", async () => {
    const revision = "abcdef0123456789abcdef0123456789abcdef01";
    await Bun.write(configPath, JSON.stringify({
      repos: [{
        ...SAMPLE_ENTRY,
        reference: { kind: "commit", name: revision.toUpperCase() },
        revision,
      }],
    }));

    const loaded = await loadConfig(configPath);

    expect(loaded.repos[0]?.reference).toEqual({ kind: "commit", name: revision });
  });

  test("does not replace an existing config when atomic staging fails", async () => {
    const original = JSON.stringify({ repos: [SAMPLE_ENTRY] });
    await Bun.write(configPath, original);
    await chmod(tmpDir, 0o555);
    try {
      await expect(saveConfig(configPath, { repos: [] })).rejects.toThrow();
    } finally {
      await chmod(tmpDir, 0o755);
    }

    expect(await Bun.file(configPath).text()).toBe(original);
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
