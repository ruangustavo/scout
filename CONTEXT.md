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
The set of repositories Scout has cloned locally.
_Avoid_: Store, library

**Cached repository**:
One repository in the cache, identified by `owner/repo`.
_Avoid_: Repo entry, clone

**Stale**:
A cached repository whose last update is older than the staleness window and should be refreshed before being read.
_Avoid_: Outdated, old
