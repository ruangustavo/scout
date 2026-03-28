import { describe, test, expect } from "bun:test";
import { generateSkillContent, generateClaudeMdSection } from "@/skill.ts";

describe("generateSkillContent", () => {
  test("includes the repos directory path", () => {
    const content = generateSkillContent("/home/user/.scout/repos");
    expect(content).toContain("/home/user/.scout/repos");
  });

  test("includes instructions to run scout list", () => {
    const content = generateSkillContent("/home/user/.scout/repos");
    expect(content).toContain("scout list");
  });

  test("includes instructions to run scout update", () => {
    const content = generateSkillContent("/home/user/.scout/repos");
    expect(content).toContain("scout update");
  });

  test("includes instructions to infer repo from context", () => {
    const content = generateSkillContent("/home/user/.scout/repos");
    expect(content).toContain("infer");
  });

  test("includes scout add suggestion for missing repos", () => {
    const content = generateSkillContent("/home/user/.scout/repos");
    expect(content).toContain("scout add");
  });
});

describe("generateClaudeMdSection", () => {
  test("includes the repos directory path", () => {
    const section = generateClaudeMdSection("/home/user/.scout/repos");
    expect(section).toContain("/home/user/.scout/repos");
  });

  test("includes Read/Grep/Glob instructions", () => {
    const section = generateClaudeMdSection("/home/user/.scout/repos");
    expect(section).toContain("Read");
    expect(section).toContain("Grep");
    expect(section).toContain("Glob");
  });

  test("starts with a section header", () => {
    const section = generateClaudeMdSection("/home/user/.scout/repos");
    expect(section).toMatch(/^## /);
  });
});
