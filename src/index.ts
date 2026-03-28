import { Command } from "commander";

const program = new Command();

program
  .name("scout")
  .description("Manage a local cache of GitHub repositories for Claude Code")
  .version("1.0.0");

program.parse();
