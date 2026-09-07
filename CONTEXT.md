# Scout

Scout keeps a local cache of third-party source repositories and teaches coding agents to read from it, so questions about a library's internals are answered from real source instead of memory.

## Language

**Harness**:
The program that hosts a coding agent and discovers skills on the user's machine (Claude Code, Codex, Cursor).
_Avoid_: Agent (for the program), tool, IDE

**Agent**:
The model acting inside a harness; the reader of the skill.
_Avoid_: Harness, assistant

**Skill**:
The single document Scout installs that tells an agent when and how to read from the cache. One canonical text for every harness.
_Avoid_: Slash command, instructions, prompt, template

**Cache**:
The collection of repository source code kept locally for consultation, not installed packages or executable artifacts.
_Avoid_: Store, library

**Cached repository**:
The source code of a repository at a selected branch, tag, or commit, identified by repository, reference kind, and full reference. Different references of the same repository can coexist in the cache; branches track remote changes, while tags and commits preserve the revision originally obtained.
_Avoid_: Repo entry, clone

**Stale**:
A cached repository tracking a branch whose last update is older than the staleness window and should be refreshed before being read. Cached tags and commits are fixed snapshots, not stale merely because time has passed.
_Avoid_: Outdated, old
