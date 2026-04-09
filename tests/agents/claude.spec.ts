import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as claude from "@/agents/claude.ts";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "scout-claude-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("claude descriptor", () => {
  test("has correct name and displayName", () => {
    expect(claude.descriptor.name).toBe("claude");
    expect(claude.descriptor.displayName).toBe("Claude Code");
  });

});

describe("installSkill", () => {
  test("writes skill file to commands/scout.md", async () => {
    const claudeDir = join(tmpDir, ".claude");
    await claude.installSkill("/home/user/.scout/repos", claudeDir);

    const content = await readFile(join(claudeDir, "commands", "scout.md"), "utf-8");
    expect(content).toContain("scout list");
    expect(content).toContain("scout list <query>");
    expect(content).toContain("/home/user/.scout/repos");
  });
});

describe("injectInstructions", () => {
  test("appends Scout section to CLAUDE.md", async () => {
    const claudeDir = join(tmpDir, ".claude");
    await mkdir(claudeDir, { recursive: true });

    await claude.injectInstructions("/home/user/.scout/repos", claudeDir);

    const content = await readFile(join(claudeDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("## Scout - Source Code Repository Cache");
    expect(content).toContain("scout list <query>");
    expect(content).toContain("/home/user/.scout/repos");
  });

  test("preserves existing CLAUDE.md content", async () => {
    const claudeDir = join(tmpDir, ".claude");
    await mkdir(claudeDir, { recursive: true });
    await writeFile(join(claudeDir, "CLAUDE.md"), "# Existing\n\nKeep this.\n");

    await claude.injectInstructions("/home/user/.scout/repos", claudeDir);

    const content = await readFile(join(claudeDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("# Existing");
    expect(content).toContain("Keep this.");
    expect(content).toContain("## Scout");
  });

  test("is idempotent", async () => {
    const claudeDir = join(tmpDir, ".claude");
    await mkdir(claudeDir, { recursive: true });

    await claude.injectInstructions("/home/user/.scout/repos", claudeDir);
    await claude.injectInstructions("/home/user/.scout/repos", claudeDir);

    const content = await readFile(join(claudeDir, "CLAUDE.md"), "utf-8");
    const matches = content.match(/## Scout - Source Code Repository Cache/g);
    expect(matches).toHaveLength(1);
  });
});
