import { describe, expect, it } from "vitest";

import {
  functionSignature,
  matchFunctionSignature,
  normalizeFunctionSource
} from "./signatures.js";

describe("structural signature detection", () => {
  it("normalizes comments and whitespace", () => {
    function Example(left: number, right: number): number {
      // Deliberately ignored.
      return left + right;
    }
    expect(normalizeFunctionSource(Example)).not.toContain("Deliberately");
    expect(functionSignature(Example).arity).toBe(2);
  });

  it("requires exactly one matching candidate", () => {
    function Upstream(value: number): number {
      return value + 1;
    }
    const known = {
      id: "known",
      name: "Upstream",
      arity: 1,
      sentinels: ["returnvalue+1"]
    };
    expect(matchFunctionSignature(Upstream, [known]).matched).toBe(true);
    const ambiguous = matchFunctionSignature(Upstream, [
      known,
      { ...known, id: "duplicate" }
    ]);
    expect(ambiguous.matched).toBe(false);
    expect(ambiguous.ambiguous).toBe(true);
  });
});
