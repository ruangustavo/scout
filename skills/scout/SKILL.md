---
name: scout
description: Use Scout for questions about a library's internals or implementation, API behaviour the types do not explain, or the urge to read source code inside node_modules.
---

# Scout

0. Infer the repository from context: imports, the library name, and the API mentioned.
1. Run `scout list <query>` to find matching cached repositories and their paths.
2. Follow exactly one branch:
   - **Cached repository:** Run `scout update <owner/repo>`, then search and read the files at the path reported by `scout list`.
   - **Repository not cached:** Run `scout add <github-url>`, keep it in the cache, run `scout list <query>` to get its path, then search and read the files there.
   - **More than one repository is plausible:** Ask the user which repository they mean.
   - **Only types, exports, or the installed version are needed:** Read those directly from `node_modules`.
