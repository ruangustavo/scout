---
name: scout
description: Use Scout for questions about a library's internals or implementation, API behaviour the types do not explain, or the urge to read source code inside node_modules.
---

# Scout

0. Infer only the repository from context: imports, the library name, lockfiles, and the API mentioned. Use a branch, tag, or commit only when the user explicitly names it; package versions do not imply tags.
1. Run `scout list <query>`. Treat its reported reference, revision, and path as the source of truth; read files only at that path.
2. Follow exactly one branch:
   - **Cached branch:** Run `scout update <owner/repo>`, run `scout list <query>` again, then search and read the reported path. Scout refreshes the recorded branch and never redirects it when the remote default branch changes.
   - **Cached tag or commit:** Search and read the reported path without updating. These are fixed snapshots and do not become stale with age.
   - **Requested reference not cached:** Run `scout add <github-url>` for the default branch, or add `--branch <name>`, `--tag <name>`, or `--commit <full-sha>` for an explicit reference. Then run `scout list <query>` and read the reported path.
   - **The user explicitly requests a moved tag's new destination:** Run `scout remove <owner/repo> --tag <name>`, add the tag again, then run `scout list <query>` and read the newly reported path.
   - **More than one repository or cached reference is plausible:** Ask the user which one they mean.
   - **Only types, exports, or the installed version are needed:** Read those directly from `node_modules`.

Use a full 40- or 64-character hexadecimal SHA with `--commit`. Use `scout remove <owner/repo> --all` only when every cached reference of that repository should be deleted.
