import { detect } from "./descriptor.ts";
import type { AgentModule } from "./descriptor.ts";
import * as claude from "./claude.ts";
import * as codex from "./codex.ts";

export type { AgentModule } from "./descriptor.ts";

export const allAgents: AgentModule[] = [claude, codex];

export async function detectInstalledAgents(
  agents: AgentModule[] = allAgents,
): Promise<AgentModule[]> {
  const results = await Promise.all(
    agents.map(async (agent) => {
      const found = await detect(agent.descriptor.detectPaths);
      return found ? agent : null;
    }),
  );
  return results.filter((a): a is AgentModule => a !== null);
}
