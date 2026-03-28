import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as codex from "@/agents/codex.ts";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "scout-codex-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("codex descriptor", () => {
  test("has correct name and displayName", () => {
    expect(codex.descriptor.name).toBe("codex");
    expect(codex.descriptor.displayName).toBe("Codex");
  });

  test("does not support passive awareness", () => {
    expect(codex.descriptor.supportsPassiveAwareness).toBe(false);
  });
});

describe("installSkill", () => {
  test("writes SKILL.md to skills/scout/ directory", async () => {
    const agentsDir = join(tmpDir, ".agents");
    await codex.installSkill("/home/user/.scout/repos", agentsDir);

    const content = await readFile(join(agentsDir, "skills", "scout", "SKILL.md"), "utf-8");
    expect(content).toContain("scout list");
    expect(content).toContain("/home/user/.scout/repos");
  });

  test("includes YAML frontmatter with name and description", async () => {
    const agentsDir = join(tmpDir, ".agents");
    await codex.installSkill("/home/user/.scout/repos", agentsDir);

    const content = await readFile(join(agentsDir, "skills", "scout", "SKILL.md"), "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("name: scout");
    expect(content).toContain("description:");
  });
});

describe("uninstallSkill", () => {
  test("removes the scout skill directory", async () => {
    const agentsDir = join(tmpDir, ".agents");
    await codex.installSkill("/home/user/.scout/repos", agentsDir);
    await codex.uninstallSkill(agentsDir);

    const exists = await stat(join(agentsDir, "skills", "scout")).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
});

describe("injectInstructions", () => {
  test("is a no-op", async () => {
    const agentsDir = join(tmpDir, ".agents");
    await mkdir(agentsDir, { recursive: true });

    // Should not throw, should not create any files
    await codex.injectInstructions("/home/user/.scout/repos", agentsDir);

    const files = await readFile(join(agentsDir, "AGENTS.md"), "utf-8").catch(() => null);
    expect(files).toBeNull();
  });
});
