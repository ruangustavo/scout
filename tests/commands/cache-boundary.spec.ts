import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeAction } from "@/commands/remove.ts";
import { addAction } from "@/commands/add.ts";
import { updateAction } from "@/commands/update.ts";
import { loadConfig, saveConfig, type ScoutConfig } from "@/config.ts";
import { resolveScoutPaths } from "@/paths.ts";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "scout-boundary-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test.each(["external", "symlink", "cache root"])("remove and update reject a cached path pointing to %s", async (location) => {
  const paths = resolveScoutPaths(join(root, "cache"));
  const external = join(root, "external");
  await Promise.all([mkdir(paths.reposDir, { recursive: true }), mkdir(external)]);
  const source = location === "cache root" ? paths.reposDir : external;
  const path = location === "symlink" ? join(paths.reposDir, "linked") : source;
  if (location === "symlink") await symlink(external, path);
  await Bun.write(join(source, "source.txt"), "must remain untouched");
  const before: ScoutConfig = { repos: [{
    name: "test/repo", url: join(root, "missing-remote.git"), path,
    reference: { kind: "branch", name: "main" },
    revision: "a".repeat(40), lastUpdated: "2000-01-01T00:00:00.000Z",
  }] };
  await saveConfig(paths.configPath, before);

  await expect(removeAction("test/repo", paths)).rejects.toThrow("outside the cache");
  await expect(updateAction("test/repo", paths)).rejects.toMatchObject({
    errors: [expect.objectContaining({ message: expect.stringContaining("outside the cache") })],
  });
  expect(await loadConfig(paths.configPath)).toEqual(before);
  expect(await Bun.file(join(source, "source.txt")).text()).toBe("must remain untouched");
});

test("a dangling ancestor symlink is rejected before cache removal is published", async () => {
  const paths = resolveScoutPaths(join(root, "cache"));
  const external = join(root, "not-created-yet");
  await mkdir(paths.reposDir, { recursive: true });
  const link = join(paths.reposDir, "link");
  await symlink(external, link);
  const before: ScoutConfig = { repos: [{
    name: "test/repo", url: join(root, "missing-remote.git"), path: join(link, "source"),
    reference: { kind: "branch", name: "main" }, revision: "a".repeat(40),
    lastUpdated: "2000-01-01T00:00:00.000Z",
  }] };
  await saveConfig(paths.configPath, before);
  await expect(removeAction("test/repo", paths)).rejects.toThrow();
  expect(await loadConfig(paths.configPath)).toEqual(before);
  await mkdir(join(external, "source"), { recursive: true });
  await Bun.write(join(external, "source", "keep.txt"), "external source");
  await expect(removeAction("test/repo", paths)).rejects.toThrow("outside the cache");
  expect(await Bun.file(join(external, "source", "keep.txt")).text()).toBe("external source");
});

test("missing cached source can be refreshed or removed without leaving an unusable entry", async () => {
  const paths = resolveScoutPaths(join(root, "cache"));
  const remote = join(root, "remote");
  await Bun.$`git init -b main ${remote}`.quiet();
  await Bun.write(join(remote, "source.txt"), "remote source");
  await Bun.$`git -C ${remote} add .`.quiet();
  await Bun.$`git -C ${remote} -c user.name=Test -c user.email=test@example.com commit -m initial`.quiet();
  await addAction(remote, paths, "test/repo");
  const before = await loadConfig(paths.configPath);
  const original = before.repos[0];
  if (!original) throw new Error("Expected cached branch");
  original.lastUpdated = "2000-01-01T00:00:00.000Z";
  await Promise.all([saveConfig(paths.configPath, before), rm(original.path, { recursive: true })]);

  await updateAction("test/repo", paths);
  const { repos } = await loadConfig(paths.configPath);
  const refreshed = repos[0];
  if (!refreshed) throw new Error("Expected refreshed branch");
  expect(await Bun.file(join(refreshed.path, "source.txt")).text()).toBe("remote source");
  expect(refreshed.revision).toBe(original.revision);
  await rm(refreshed.path, { recursive: true });
  await removeAction("test/repo", paths);
  expect((await loadConfig(paths.configPath)).repos).toEqual([]);
});
