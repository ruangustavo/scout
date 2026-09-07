import { z } from "zod";

export const gitReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("branch"), name: z.string().min(1) }),
  z.object({ kind: z.literal("tag"), name: z.string().min(1) }),
  z.object({ kind: z.literal("commit"), name: z.string().min(1) }),
]);

export type GitReference = z.infer<typeof gitReferenceSchema>;

export function sameReference(left: GitReference, right: GitReference): boolean {
  return left.kind === right.kind && left.name === right.name;
}

export function fullRef(reference: Exclude<GitReference, { kind: "commit" }>): string {
  return `refs/${reference.kind === "branch" ? "heads" : "tags"}/${reference.name}`;
}
