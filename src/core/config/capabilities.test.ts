import { describe, expect, it } from "vitest";
import { isMcpAllowed, isSkillAllowed, resolveMcps, resolveSkills } from "./capabilities";

describe("resolveSkills", () => {
  it("combines additions and local skills, then applies removals", () => {
    expect(resolveSkills({ skills: ["base"], skills_add: ["extra"], skills_remove: ["base"], skills_include_local: true }, ["local"])).toEqual(["extra", "local"]);
  });
});

describe("resolveMcps", () => {
  it("supports wildcard grants and exclusions", () => {
    expect(resolveMcps(["*", "!secrets"], ["context7", "gh_grep", "secrets"])).toEqual(["context7", "gh_grep"]);
  });
});

it("checks effective capability grants", () => {
  expect(isSkillAllowed("review", ["review"])).toBe(true);
  expect(isSkillAllowed("deploy", ["review"])).toBe(false);
  expect(isMcpAllowed("context7", ["*"])).toBe(true);
});