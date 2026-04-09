# Scout

Scout is a CLI tool that maintains a local cache of GitHub repositories for AI coding agents. It gives agents like [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [Codex](https://github.com/openai/codex) direct filesystem access to library source code, so they can answer questions about internals, trace implementations, and read documentation without relying on web searches or stale training data.

## Why

AI coding agents are good at reading code but have no built-in way to access third-party source repositories. When you ask "how does Hono's router work?" or "what parameters does this Next.js function accept?", the agent either guesses from training data or asks you to look it up.

Scout solves this by keeping shallow clones of repositories you care about in `~/.scout/repos/`, and teaching your agent how to query them. Repos are cloned with `--depth=1` to minimize disk usage and clone time.

## Installation

Scout is not yet published to npm. To use it locally:

```bash
git clone https://github.com/ruangustavo/scout.git
cd scout
bun install
bun run build
npm link
```

This makes the `scout` command available globally.

## Setup

Run setup to initialize Scout and configure your installed agents:

```bash
scout setup
```

This will:

1. Create the `~/.scout/` directory and config file.
2. Detect which agents are installed (Claude Code, Codex).
3. Install a skill file for each detected agent so it knows how to query cached repos.
4. Inject passive instructions into the agent's global config so it automatically checks the cache when you ask about a library.

### What gets installed

**Claude Code** (`~/.claude/`):
- `~/.claude/commands/scout.md` -- a slash command (`/scout`) the agent can invoke.
- A section appended to `~/.claude/CLAUDE.md` that teaches the agent to check the Scout cache when answering source code questions.

**Codex** (`~/.codex/` or `$CODEX_HOME`):
- `~/.agents/skills/scout/SKILL.md` -- a skill file Codex can discover.
- A section appended to `~/.codex/AGENTS.md` with passive instructions for cache awareness.

## Commands

### `scout add <url>`

Clone a GitHub repository into the cache.

```bash
scout add https://github.com/honojs/hono
```

Accepts HTTPS and SSH URLs. The repo is stored at `~/.scout/repos/<owner>/<repo>`.

### `scout list [query]`

List all cached repositories with their paths and last-updated timestamps. When a
query is provided, Scout filters repositories by name using a case-insensitive
substring match.

```bash
scout list
scout list hono
scout list next
```

### `scout update [name]`

Pull the latest changes for a cached repository. If no name is given, all stale repos are updated. A repo is considered stale after 1 hour.

```bash
scout update honojs/hono   # update a specific repo
scout update               # update all stale repos
```

### `scout remove <name>`

Remove a cached repository from disk and config.

```bash
scout remove honojs/hono
```

### `scout setup`

Initialize Scout and install agent skills. Safe to re-run -- it will not duplicate instructions.

```bash
scout setup
```

## Usage with Claude Code

After running `scout setup`, Claude Code gains two capabilities:

1. **Passive awareness.** When you ask about a library's source code, Claude Code will automatically check if the repo is cached and read from it. No special syntax required -- just ask naturally:

   ```
   > How does Hono's router match routes?
   > What does the `createApp` function in Next.js actually do?
   ```

2. **The `/scout` slash command.** You can explicitly invoke it to query a cached repo:

   ```
   > /scout How does Hono handle middleware?
   ```

If a repo isn't cached, the agent will suggest running `scout add <url>`.

## Usage with Codex

After running `scout setup`, Codex discovers the Scout skill automatically. It works the same way -- ask about a library and the agent will check the cache, update if needed, and read the source to answer.

If Codex uses a custom home directory, set the `CODEX_HOME` environment variable before running setup so Scout can detect it.

## How it works

- Repos are shallow-cloned (`--depth=1`, `--single-branch`, `--no-tags`) to keep disk usage low.
- Updates use `git fetch --depth=1` followed by `git reset --hard` to the remote HEAD.
- Config is stored in `~/.scout/config.json` with repo metadata and timestamps.
- Agent detection is based on the existence of known config directories (`~/.claude/`, `~/.codex/`).

## Development

```bash
bun install          # install dependencies
bun run build        # build to dist/
bun test             # run tests
```
