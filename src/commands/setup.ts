import pc from "picocolors";
import { mkdir, readFile } from "node:fs/promises";
import { saveConfig, emptyConfig } from "../config.ts";
import type { ScoutPaths } from "../paths.ts";
import type { AgentModule } from "../agents/descriptor.ts";

export async function setupAction(
  scoutPaths: ScoutPaths,
  detectedAgents: AgentModule[],
): Promise<void> {
  await mkdir(scoutPaths.reposDir, { recursive: true });

  const configExists = await readFile(scoutPaths.configPath, "utf-8")
    .then(() => true)
    .catch(() => false);

  if (!configExists) {
    await saveConfig(scoutPaths.configPath, emptyConfig());
    console.log(pc.green("✓"), "Created config at", pc.dim(scoutPaths.configPath));
  }

  if (detectedAgents.length === 0) {
    console.log(
      pc.yellow("⚠"),
      "No supported agents detected. Supported agents: Claude Code, Codex",
    );
  }

  for (const agent of detectedAgents) {
    await agent.installSkill(scoutPaths.reposDir);
    console.log(pc.green("✓"), `Installed skill for ${agent.descriptor.displayName}`);

    await agent.injectInstructions(scoutPaths.reposDir);
    console.log(pc.green("✓"), `Injected instructions for ${agent.descriptor.displayName}`);
  }

  console.log(
    `\n${pc.bold("Setup complete!")} Add repos with ${pc.cyan("scout add <github-url>")}`,
  );
}
