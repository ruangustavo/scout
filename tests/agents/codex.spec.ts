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
  test("writes the provided skill byte-for-byte to skills/scout/SKILL.md", async () => {
    const agentsDir = join(tmpDir, ".agents");
    const skillContent = "---\nname: scout\n---\n";
    await codex.installSkill(skillContent, agentsDir);

    const content = await readFile(join(agentsDir, "skills", "scout", "SKILL.md"), "utf-8");
    expect(content).toBe(skillContent);
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

