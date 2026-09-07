import { Command, InvalidArgumentError, Option } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { addAction } from "./commands/add.ts";
import { listAction } from "./commands/list.ts";
import { removeAction } from "./commands/remove.ts";
import { setupAction } from "./commands/setup.ts";
import { updateAction } from "./commands/update.ts";
import { resolveScoutPaths } from "./paths.ts";
import type { GitReference } from "./reference.ts";

interface ReferenceOptions {
  branch?: string;
  tag?: string;
  commit?: string;
}

interface RemoveOptions extends ReferenceOptions {
  all?: boolean;
}

function parseCommit(value: string): string {
  if (!/^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/.test(value)) {
    throw new InvalidArgumentError("commit must be a full 40- or 64-character hexadecimal SHA");
  }
  return value.toLowerCase();
}

function selectedReference(options: ReferenceOptions): GitReference | undefined {
  if (options.branch !== undefined) return { kind: "branch", name: options.branch };
  if (options.tag !== undefined) return { kind: "tag", name: options.tag };
  if (options.commit !== undefined) return { kind: "commit", name: options.commit };
  return undefined;
}

function referenceOptions(): Option[] {
  return [
    new Option("--branch <name>", "select a branch").conflicts(["tag", "commit"]),
    new Option("--tag <name>", "select a tag").conflicts(["branch", "commit"]),
    new Option("--commit <sha>", "select a full commit SHA")
      .argParser(parseCommit)
      .conflicts(["branch", "tag"]),
  ];
}

const scoutPaths = resolveScoutPaths();
const program = new Command();

program
  .name("scout")
  .description("Manage a local cache of GitHub repositories for AI coding agents")
  .version(packageJson.version);

program
  .command("setup")
  .description("Initialize Scout and install its skill")
  .action(async () => {
    await setupAction(scoutPaths);
  });

const addCommand = program
  .command("add")
  .argument("<url>", "GitHub repository URL")
  .description("Clone a GitHub repository into the Scout cache");
for (const option of referenceOptions()) addCommand.addOption(option);
addCommand.action(async (url: string, options: ReferenceOptions) => {
  await addAction(url, scoutPaths, undefined, selectedReference(options));
});

const removeCommand = program
  .command("remove")
  .argument("<name>", "Repository name (owner/repo)")
  .description("Remove a cached repository");
for (const option of referenceOptions()) {
  option.conflicts(["all"]);
  removeCommand.addOption(option);
}
removeCommand.addOption(
  new Option("--all", "remove every cached reference").conflicts(["branch", "tag", "commit"]),
);
removeCommand.action(async (name: string, options: RemoveOptions) => {
  const selection = options.all ? "all" : selectedReference(options);
  await removeAction(name, scoutPaths, selection);
});

program
  .command("list")
  .argument("[query]", "Filter repositories by name")
  .description("List all cached repositories")
  .action(async (query?: string) => {
    await listAction(scoutPaths, query);
  });

program
  .command("update")
  .argument("[name]", "Repository name (owner/repo) — updates all if omitted")
  .description("Update cached repository(s) to latest")
  .action(async (name?: string) => {
    await updateAction(name, scoutPaths);
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
