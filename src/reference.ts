export type GitReference =
  | { kind: "branch"; name: string }
  | { kind: "tag"; name: string }
  | { kind: "commit"; name: string };

export function sameReference(left: GitReference, right: GitReference): boolean {
  return left.kind === right.kind && left.name === right.name;
}

export function fullRef(reference: Exclude<GitReference, { kind: "commit" }>): string {
  return `refs/${reference.kind === "branch" ? "heads" : "tags"}/${reference.name}`;
}
