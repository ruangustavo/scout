import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveScoutPaths } from "@/paths.ts";
import { setupAction } from "@/commands/setup.ts";
import type { AgentModule } from "@/agents/descriptor.ts";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "scout-setup-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function makeTestAgent(
  name: "claude" | "codex",
  displayName: string,
  calls: string[],
): AgentModule {
  return {
    descriptor: {
      name,
      displayName,
      detectPaths: [],
      supportsPassiveAwareness: name === "claude",
    },
    async installSkill(reposDir: string) {
      calls.push(`${name}:installSkill:${reposDir}`);
    },
    async uninstallSkill() {
      calls.push(`${name}:uninstallSkill`);
    },
    async injectInstructions(reposDir: string) {
      calls.push(`${name}:injectInstructions:${reposDir}`);
    },
    async removeInstructions() {
      calls.push(`${name}:removeInstructions`);
    },
  };
}

describe("setupAction", () => {
  test("creates scout directory structure", async () => {
    const scoutPaths = resolveScoutPaths(join(tmpDir, ".scout"));
    await setupAction(scoutPaths, []);

    const reposDirExists = await stat(scoutPaths.reposDir).then(() => true).catch(() => false);
    expect(reposDirExists).toBe(true);
  });

  test("creates empty config.json", async () => {
    const scoutPaths = resolveScoutPaths(join(tmpDir, ".scout"));
    await setupAction(scoutPaths, []);

    const config = JSON.parse(await readFile(scoutPaths.configPath, "utf-8"));
    expect(config).toEqual({ repos: [] });
  });

  test("calls installSkill and injectInstructions for each agent", async () => {
    const scoutPaths = resolveScoutPaths(join(tmpDir, ".scout"));
    const calls: string[] = [];
    const agents = [
      makeTestAgent("claude", "Claude Code", calls),
      makeTestAgent("codex", "Codex", calls),
    ];

    await setupAction(scoutPaths, agents);

    expect(calls).toContain(`claude:installSkill:${scoutPaths.reposDir}`);
    expect(calls).toContain(`claude:injectInstructions:${scoutPaths.reposDir}`);
    expect(calls).toContain(`codex:installSkill:${scoutPaths.reposDir}`);
  });

  test("does not fail when no agents are provided", async () => {
    const scoutPaths = resolveScoutPaths(join(tmpDir, ".scout"));
    await setupAction(scoutPaths, []);

    // Should still create scout dirs and config
    const config = JSON.parse(await readFile(scoutPaths.configPath, "utf-8"));
    expect(config).toEqual({ repos: [] });
  });
});
