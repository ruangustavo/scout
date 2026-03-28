## TypeScript

- MUST: Prefer union string literals over `enum` (use `const enum` only when safe)
- MUST: Prefer `type` for unions/intersections; use `interface` for object contracts you want to extend/implement
- MUST: Prefer named exports for clarity and better refactors
- MUST NOT: Infer the return type of method
- MUST NOT: Use non-null assertions (`!`) or type assertions (`as`) to silence errors instead of narrowing
- MUST: Use `Pick`, `Omit`, `Exclude`, `Extract`, and mapped types to derive safe variants instead of replicating shapes

## Promises & Async/Await

- MUST: Use `async`/`await` over raw `.then()` chains for readability
- MUST: Wrap `await` calls in `try`/`catch` at the boundary where you can meaningfully handle the error — don't catch just to rethrow
- MUST: Use `Promise.all()` when running independent async operations concurrently — never `await` them sequentially if they don't depend on each other
- MUST NOT: Use `async` on functions that don't contain `await` — return the Promise directly instead
- MUST NOT: Swallow errors with empty `catch` blocks — at minimum log or propagate

## Git

- MUST: Use semantic commit messages (feat, fix, chore, docs, etc.)