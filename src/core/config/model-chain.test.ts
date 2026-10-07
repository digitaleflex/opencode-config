import { describe, expect, it } from "vitest";
import { normalizeModelChain, selectFirstEligible } from "./model-chain";

describe("normalizeModelChain", () => {
  it("normalizes a single model", () => {
    expect(normalizeModelChain("provider/model")).toEqual({
      primary: { id: "provider/model" },
      fallbacks: [],
    });
  });

  it("preserves ordered fallbacks and removes duplicates", () => {
    expect(
      normalizeModelChain([
        "a/model",
        { id: "b/model", variant: "fast" },
        "a/model",
      ]),
    ).toEqual({
      primary: { id: "a/model" },
      fallbacks: [{ id: "b/model", variant: "fast" }],
    });
  });
});

describe("selectFirstEligible", () => {
  it("selects the first eligible candidate in configured order", () => {
    const chain = normalizeModelChain(["a/model", "b/model", "c/model"]);
    expect(
      selectFirstEligible(chain, (candidate) => candidate.id !== "a/model"),
    ).toEqual({ id: "b/model" });
  });
});
