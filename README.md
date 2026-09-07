# Scout

Scout is a CLI tool that maintains a local cache of GitHub repositories for coding agents. It gives agents direct filesystem access to library source code, so they can answer questions about internals, trace implementations, and read documentation without relying on web searches or stale training data.

A repository can be cached at multiple Git references. Branches track remote changes; tags and commits are fixed snapshots of the revision resolved when they are added. These snapshots are for source inspection only: Scout does not install packages or expose their executables.

## Why

AI coding agents are good at reading code but have no built-in way to access third-party source repositories. When you ask "how does Hono's router work?" or "what parameters does this Next.js function accept?", the agent either guesses from training data or asks you to look it up.

Scout keeps shallow copies of repositories you care about and teaches your agent how to query them. Use `scout list` to obtain the actual filesystem path for any cached reference.

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

This creates the Scout cache and config, then installs Scout's canonical skill. Re-running setup is safe.

### What gets installed

- `~/.agents/skills/scout/SKILL.md` -- the canonical Scout skill, read directly by Codex, Cursor, Gemini CLI, GitHub Copilot, OpenCode, Amp, Cline, Zed, Warp, Antigravity, and other harnesses that discover `.agents/skills`.
- `~/.claude/skills/scout -> ../../.agents/skills/scout` -- a relative symlink created when `~/.claude` exists, allowing Claude Code to discover the same skill.

Scout does not modify `CLAUDE.md` or `AGENTS.md`. If a real file or directory already exists at Claude Code's skill path, setup warns and leaves it untouched.

## Commands

### `scout add <url>`

Add a repository at its default branch, a named branch, a tag, or a commit:

```bash
scout add https://github.com/honojs/hono
scout add https://github.com/honojs/hono --branch feature/router
scout add https://github.com/honojs/hono --tag core@1.2.3
scout add https://github.com/honojs/hono --commit 0123456789abcdef0123456789abcdef01234567
```

`--branch`, `--tag`, and `--commit` are mutually exclusive. A commit must be a full 40- or 64-character hexadecimal SHA.

When no selector is supplied, Scout resolves and records the repository's current default branch during `add`. That cached branch continues to track the recorded branch if the remote later changes its default. Run `scout add <url>` again without a selector to cache the new default alongside the old branch.

Reference names are matched in full, including monorepo-style names such as `core@1.2.3`. Branches, tags, and commits are distinct references, so a branch and tag with the same name can coexist. Adding the same reference again reuses its existing cache. Run `scout list` to find each cached reference's actual path.

### `scout list [query]`

List cached repositories, their references, revisions, actual paths, and last-updated timestamps. A query filters repository names using a case-insensitive substring match.

```bash
scout list
scout list hono
scout list next
```

### `scout update [name]`

Refresh cached branches. If no name is given, all stale branches are updated. A branch is stale after 1 hour. Tags and commits are fixed snapshots and are not made stale by age.

```bash
scout update honojs/hono   # update cached branches for this repository
scout update               # update all stale branches
```

Scout stages each branch download and replaces its cached source only after the download succeeds. If an update fails, Scout reports it, preserves that reference, and continues with the other selected branches; it does not fall back to another branch or revision.

### `scout remove <name>`

Remove one cached reference, or every reference of a repository:

```bash
scout remove honojs/hono --branch main
scout remove honojs/hono --tag release-2025-01
scout remove honojs/hono --commit 0123456789abcdef0123456789abcdef01234567
scout remove honojs/hono --all
```

`--branch`, `--tag`, `--commit`, and `--all` are mutually exclusive. The selector may be omitted when only one reference of that repository is cached; choose a selector or `--all` when several references exist.

If you want a moved upstream tag's new destination, remove its fixed cached snapshot and add the tag again:

```bash
scout remove honojs/hono --tag release-2025-01
scout add https://github.com/honojs/hono --tag release-2025-01
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

The agent will check the cache, refresh a cached branch before reading it, or add a repository that is not cached. It uses `scout list` as the source of truth for each cached reference's filesystem path.

## How it works

- Each cached repository records a branch, tag, or commit and the exact revision resolved by `add`.
- Branch updates resolve the recorded remote branch, download its source into a staging path, and replace the cached snapshot only after success. They never follow a redirected default branch.
- Tags and commits remain at their recorded revisions.
- Config is stored in `~/.scout/config.json`.
- Harnesses discover the canonical skill from `~/.agents/skills`; Claude Code uses the setup-created symlink.

## Development

```bash
bun install          # install dependencies
bun run build        # build to dist/
bun test             # run tests
bun run typecheck    # check TypeScript types
```
