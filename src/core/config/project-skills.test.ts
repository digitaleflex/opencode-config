import { describe, expect, it } from "vitest";
import { resolveSkills } from "./capabilities";

describe("project-local skill discovery contract", () => {
  it("allows discovered names to be fed into skills_include_local", () => {
    expect(
      resolveSkills(
        { skills: ["base"], skills_include_local: true, skills_remove: ["unsafe"] },
        ["local-a", "unsafe"],
      ),
    ).toEqual(["base", "local-a"]);
  });
});
