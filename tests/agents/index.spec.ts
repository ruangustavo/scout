import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectInstalledAgents, allAgents } from "@/agents/index.ts";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "scout-agents-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("allAgents", () => {
  test("exports claude and codex agents", () => {
    const names = allAgents.map((a) => a.descriptor.name);
    expect(names).toContain("claude");
    expect(names).toContain("codex");
  });
});

describe("detectInstalledAgents", () => {
  test("returns empty array when no agent dirs exist", async () => {
    const detected = await detectInstalledAgents([
      {
        descriptor: {
          name: "claude",
          displayName: "Claude Code",
          detectPaths: [join(tmpDir, ".claude")],
        },
        installSkill: async () => {},
        injectInstructions: async () => {},
      },
    ]);
    expect(detected).toHaveLength(0);
  });

  test("returns agent when its directory exists", async () => {
    const claudeDir = join(tmpDir, ".claude");
    await mkdir(claudeDir, { recursive: true });

    const mockAgent = {
      descriptor: {
        name: "claude" as const,
        displayName: "Claude Code",
        detectPaths: [claudeDir],
        supportsPassiveAwareness: true,
      },
      installSkill: async () => {},
      uninstallSkill: async () => {},
      injectInstructions: async () => {},
      removeInstructions: async () => {},
    };

    const detected = await detectInstalledAgents([mockAgent]);
    expect(detected).toHaveLength(1);
    expect(detected[0]!.descriptor.name).toBe("claude");
  });

  test("returns multiple agents when multiple dirs exist", async () => {
    await mkdir(join(tmpDir, ".claude"), { recursive: true });
    await mkdir(join(tmpDir, ".codex"), { recursive: true });

    const agents = [
      {
        descriptor: {
          name: "claude" as const,
          displayName: "Claude Code",
          detectPaths: [join(tmpDir, ".claude")],
        },
        installSkill: async () => {},
        injectInstructions: async () => {},
      },
      {
        descriptor: {
          name: "codex" as const,
          displayName: "Codex",
          detectPaths: [join(tmpDir, ".codex")],
        },
        installSkill: async () => {},
        injectInstructions: async () => {},
      },
    ];

    const detected = await detectInstalledAgents(agents);
    expect(detected).toHaveLength(2);
  });
});
