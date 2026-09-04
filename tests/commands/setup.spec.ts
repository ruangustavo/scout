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
    },
    async installSkill() {
      calls.push(`${name}:installSkill`);
    },
    async injectInstructions(reposDir: string) {
      calls.push(`${name}:injectInstructions:${reposDir}`);
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

    expect(calls).toContain("claude:installSkill");
    expect(calls).toContain(`claude:injectInstructions:${scoutPaths.reposDir}`);
    expect(calls).toContain("codex:installSkill");
    expect(calls).toContain(`codex:injectInstructions:${scoutPaths.reposDir}`);
  });

  test("writes content byte-identical to the packaged skill", async () => {
    const scoutPaths = resolveScoutPaths(join(tmpDir, ".scout"));
    const installedPath = join(tmpDir, "installed", "SKILL.md");
    const agent: AgentModule = {
      descriptor: { name: "codex", displayName: "Codex", detectPaths: [] },
      async installSkill(skillContent: string) {
        await mkdir(join(tmpDir, "installed"), { recursive: true });
        await writeFile(installedPath, skillContent, "utf-8");
      },
      async injectInstructions() {},
    };

    await setupAction(scoutPaths, [agent]);

    const packagedPath = new URL("../../skills/scout/SKILL.md", import.meta.url);
    const [installed, packaged] = await Promise.all([
      readFile(installedPath),
      readFile(packagedPath),
    ]);
    expect(installed.equals(packaged)).toBe(true);
  });

  test("does not fail when no agents are provided", async () => {
    const scoutPaths = resolveScoutPaths(join(tmpDir, ".scout"));
    await setupAction(scoutPaths, []);

    // Should still create scout dirs and config
    const config = JSON.parse(await readFile(scoutPaths.configPath, "utf-8"));
    expect(config).toEqual({ repos: [] });
  });
});
