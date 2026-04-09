import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
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

});

describe("installSkill", () => {
  test("writes SKILL.md to skills/scout/ directory", async () => {
    const agentsDir = join(tmpDir, ".agents");
    await codex.installSkill("/home/user/.scout/repos", agentsDir);

    const content = await readFile(join(agentsDir, "skills", "scout", "SKILL.md"), "utf-8");
    expect(content).toContain("scout list");
    expect(content).toContain("scout list <query>");
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

describe("injectInstructions", () => {
  test("creates AGENTS.md with scout section when file doesn't exist", async () => {
    const codexDir = join(tmpDir, ".codex");

    await codex.injectInstructions("/home/user/.scout/repos", codexDir);

    const content = await readFile(join(codexDir, "AGENTS.md"), "utf-8");
    expect(content).toContain("## Scout - Source Code Repository Cache");
    expect(content).toContain("scout list <query>");
    expect(content).toContain("/home/user/.scout/repos");
  });

  test("preserves existing AGENTS.md content", async () => {
    const codexDir = join(tmpDir, ".codex");
    await mkdir(codexDir, { recursive: true });
    await writeFile(join(codexDir, "AGENTS.md"), "# Existing\n\nKeep this.\n");

    await codex.injectInstructions("/home/user/.scout/repos", codexDir);

    const content = await readFile(join(codexDir, "AGENTS.md"), "utf-8");
    expect(content).toContain("# Existing");
    expect(content).toContain("Keep this.");
    expect(content).toContain("## Scout");
  });

  test("is idempotent", async () => {
    const codexDir = join(tmpDir, ".codex");

    await codex.injectInstructions("/home/user/.scout/repos", codexDir);
    await codex.injectInstructions("/home/user/.scout/repos", codexDir);

    const content = await readFile(join(codexDir, "AGENTS.md"), "utf-8");
    const matches = content.match(/## Scout - Source Code Repository Cache/g);
    expect(matches).toHaveLength(1);
  });

  test("references shell commands for file operations", async () => {
    const codexDir = join(tmpDir, ".codex");

    await codex.injectInstructions("/home/user/.scout/repos", codexDir);

    const content = await readFile(join(codexDir, "AGENTS.md"), "utf-8");
    expect(content).toContain("shell commands");
  });
});

