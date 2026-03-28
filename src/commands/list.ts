import pc from "picocolors";
import { loadConfig } from "../config.ts";
import type { ScoutPaths } from "../paths.ts";

export async function listAction(paths: ScoutPaths): Promise<void> {
  const config = await loadConfig(paths.configPath);

  if (config.repos.length === 0) {
    console.log(pc.yellow("No repositories cached."));
    console.log(`Run ${pc.cyan("scout add <github-url>")} to add one.`);
    return;
  }

  console.log(pc.bold("Cached repositories:\n"));

  for (const repo of config.repos) {
    const updated = new Date(repo.lastUpdated).toLocaleString();
    console.log(`  ${pc.green(repo.name)}`);
    console.log(`    URL:     ${repo.url}`);
    console.log(`    Path:    ${repo.path}`);
    console.log(`    Updated: ${updated}\n`);
  }
}
