import { describe, expect, it } from "vitest";

import { validateManifest } from "./plugins.js";

describe("WASM plugin manifests", () => {
  it("accepts only the versioned capability surface", () => {
    expect(() =>
      validateManifest({
        id: "safe-plugin",
        name: "Safe",
        version: "1.0.0",
        abi: 1,
        capabilities: ["read-state", "path-query"],
        systems: ["pathfinding"],
        maxMemoryPages: 64
      })
    ).not.toThrow();
    expect(() =>
      validateManifest({
        id: "safe-plugin",
        name: "Unsafe",
        version: "1.0.0",
        abi: 1,
        capabilities: ["network" as "read-state"],
        systems: ["pathfinding"],
        maxMemoryPages: 64
      })
    ).toThrow(/Unknown plugin capability/u);
  });

  it("rejects ABI mismatch and excessive memory", () => {
    expect(() =>
      validateManifest({
        id: "wrong-abi",
        name: "Wrong",
        version: "1",
        abi: 2,
        capabilities: [],
        systems: [],
        maxMemoryPages: 64
      })
    ).toThrow(/does not match/u);
    expect(() =>
      validateManifest({
        id: "too-large",
        name: "Large",
        version: "1",
        abi: 1,
        capabilities: [],
        systems: [],
        maxMemoryPages: 2_000
      })
    ).toThrow(/1..1024/u);
  });

  it("rejects incomplete identity metadata and unknown systems", () => {
    expect(() =>
      validateManifest({
        id: "unnamed-plugin",
        name: " ",
        version: "1.0.0",
        abi: 1,
        capabilities: [],
        systems: [],
        maxMemoryPages: 16
      })
    ).toThrow(/Plugin name/u);
    expect(() =>
      validateManifest({
        id: "unknown-system",
        name: "Unknown system",
        version: "1.0.0",
        abi: 1,
        capabilities: [],
        systems: ["rendering" as "pathfinding"],
        maxMemoryPages: 16
      })
    ).toThrow(/Unknown plugin system rendering/u);
  });
});
