import { Command } from "commander";
import { resolveScoutPaths, resolveClaudePaths } from "./paths.ts";
import { setupAction } from "./commands/setup.ts";
import { addAction } from "./commands/add.ts";
import { removeAction } from "./commands/remove.ts";
import { listAction } from "./commands/list.ts";
import { updateAction } from "./commands/update.ts";

const scoutPaths = resolveScoutPaths();
const claudePaths = resolveClaudePaths();

const program = new Command();

program
  .name("scout")
  .description("Manage a local cache of GitHub repositories for Claude Code")
  .version("1.0.0");

program
  .command("setup")
  .description("Initialize Scout and install Claude Code skill")
  .action(async () => {
    await setupAction(scoutPaths, claudePaths);
  });

program
  .command("add")
  .argument("<url>", "GitHub repository URL")
  .description("Clone a GitHub repository into the Scout cache")
  .action(async (url: string) => {
    await addAction(url, scoutPaths);
  });

program
  .command("remove")
  .argument("<name>", "Repository name (owner/repo)")
  .description("Remove a cached repository")
  .action(async (name: string) => {
    await removeAction(name, scoutPaths);
  });

program
  .command("list")
  .description("List all cached repositories")
  .action(async () => {
    await listAction(scoutPaths);
  });

program
  .command("update")
  .argument("[name]", "Repository name (owner/repo) — updates all if omitted")
  .description("Update cached repository(s) to latest")
  .action(async (name?: string) => {
    await updateAction(name, scoutPaths);
  });

program.parse();
