# Scout

Scout is a CLI tool that maintains a local cache of GitHub repositories for coding agents. It gives agents direct filesystem access to library source code, so they can answer questions about internals, trace implementations, and read documentation without relying on web searches or stale training data.

## Why

AI coding agents are good at reading code but have no built-in way to access third-party source repositories. When you ask "how does Hono's router work?" or "what parameters does this Next.js function accept?", the agent either guesses from training data or asks you to look it up.

Scout solves this by keeping shallow clones of repositories you care about in `~/.scout/repos/`, and teaching your agent how to query them. Repos are cloned with `--depth=1` to minimize disk usage and clone time.

## Installation

Scout supports Node.js 20 or newer and Bun.

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

Run setup to initialize Scout and install its skill:

```bash
scout setup
```

This creates the `~/.scout/` cache and config, then installs Scout's canonical skill. Re-running setup is safe.

### What gets installed

- `~/.agents/skills/scout/SKILL.md` -- the canonical Scout skill, read directly by Codex, Cursor, Gemini CLI, GitHub Copilot, OpenCode, Amp, Cline, Zed, Warp, Antigravity, and other harnesses that discover `.agents/skills`.
- `~/.claude/skills/scout -> ../../.agents/skills/scout` -- a relative symlink created when `~/.claude` exists, allowing Claude Code to discover the same skill.

Scout does not modify `CLAUDE.md` or `AGENTS.md`. If a real file or directory already exists at Claude Code's skill path, setup warns and leaves it untouched.

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

Initialize Scout and install its canonical skill. Safe to re-run.

```bash
scout setup
```

## Usage

After running `scout setup`, supported harnesses discover the Scout skill automatically. Ask about a library's source naturally:

```
> How does Hono's router match routes?
> What does the `createApp` function in Next.js actually do?
```

The agent will check the cache, update a cached repository before reading it, or add a repository that is not cached.

## How it works

- Repos are shallow-cloned (`--depth=1`, `--single-branch`, `--no-tags`) to keep disk usage low.
- Updates use `git fetch --depth=1` followed by `git reset --hard` to the remote HEAD.
- Config is stored in `~/.scout/config.json` with repo metadata and timestamps.
- Harnesses discover the canonical skill from `~/.agents/skills`; Claude Code uses the setup-created symlink.

## Development

```bash
bun install          # install dependencies
bun run build        # build to dist/
bun test             # run tests
bun run typecheck    # check TypeScript types
```
