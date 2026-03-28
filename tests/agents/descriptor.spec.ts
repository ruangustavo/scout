import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detect } from "@/agents/descriptor.ts";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "scout-descriptor-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("detect", () => {
  test("returns true when any detect path exists", async () => {
    const testDir = join(tmpDir, ".agent");
    await mkdir(testDir, { recursive: true });

    const result = await detect([testDir]);
    expect(result).toBe(true);
  });

  test("returns false when no detect paths exist", async () => {
    const result = await detect([join(tmpDir, ".nonexistent")]);
    expect(result).toBe(false);
  });

  test("returns true when at least one path exists among many", async () => {
    const existingDir = join(tmpDir, ".exists");
    await mkdir(existingDir, { recursive: true });

    const result = await detect([
      join(tmpDir, ".missing1"),
      existingDir,
      join(tmpDir, ".missing2"),
    ]);
    expect(result).toBe(true);
  });
});
