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

  it("does not admit a changed function through a patched Array.filter", () => {
    function Changed(value: number): number {
      return value - 1;
    }
    const candidate = {
      id: "official",
      name: "Official",
      arity: 7,
      normalizedHash: "0000000000000000"
    };
    const original = Array.prototype.filter;
    let result: ReturnType<typeof matchFunctionSignature> | undefined;
    try {
      Array.prototype.filter = (() => [candidate]) as typeof original;
      result = matchFunctionSignature(Changed, [candidate]);
    } finally {
      Array.prototype.filter = original;
    }

    expect(result?.matched).toBe(false);
    expect(result?.reason).toBe("unknown-signature");
  });

  it("does not admit a missing sentinel through a patched Array.every", () => {
    function Official(value: number): number {
      return value + 1;
    }
    const candidate = {
      id: "official",
      name: "Official",
      arity: 1,
      sentinels: ["not-present-in-the-function"]
    };
    const original = Array.prototype.every;
    let result: ReturnType<typeof matchFunctionSignature> | undefined;
    try {
      Array.prototype.every = (() => true) as typeof original;
      result = matchFunctionSignature(Official, [candidate]);
    } finally {
      Array.prototype.every = original;
    }

    expect(result?.matched).toBe(false);
    expect(result?.reason).toBe("unknown-signature");
  });

  it("fails closed when Function.toString changes", () => {
    function Official(value: number): number {
      return value + 1;
    }
    const candidate = {
      id: "official",
      name: "Official",
      arity: 1,
      normalizedHash: functionSignature(Official).normalizedHash
    };
    const original = Function.prototype.toString;
    let result: ReturnType<typeof matchFunctionSignature> | undefined;
    try {
      Function.prototype.toString = (() =>
        "function Official(value){return value+1}") as typeof original;
      result = matchFunctionSignature(Official, [candidate]);
    } finally {
      Function.prototype.toString = original;
    }

    expect(result?.matched).toBe(false);
    expect(result?.reason).toBe("signature-intrinsics-changed");
  });
});
