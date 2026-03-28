import { stat } from "node:fs/promises";

export type AgentName = "claude" | "codex";

export interface AgentDescriptor {
  name: AgentName;
  displayName: string;
  detectPaths: string[];
}

export interface AgentModule {
  descriptor: AgentDescriptor;
  installSkill(reposDir: string): Promise<void>;
  uninstallSkill(): Promise<void>;
  injectInstructions(reposDir: string): Promise<void>;
  removeInstructions(): Promise<void>;
}

export async function detect(paths: string[]): Promise<boolean> {
  for (const p of paths) {
    const exists = await stat(p).then(() => true).catch(() => false);
    if (exists) return true;
  }
  return false;
}
