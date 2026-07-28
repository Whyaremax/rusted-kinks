import { afterEach, describe, expect, it } from "vitest";

import { KDHybridRuntime } from "./runtime.js";

let runtime: KDHybridRuntime | undefined;

afterEach(() => {
  runtime?.dispose();
  runtime = undefined;
});

describe("runtime pathfinding strategy", () => {
  it("defaults to fast and supports live mode changes", () => {
    runtime = new KDHybridRuntime({ target: {} });
    const api = runtime.installGlobal();

    expect(api.getPathfindingMode()).toBe("fast");
    expect(api.setPathfindingMode("quality")).toBe("quality");
    expect(api.getPathfindingMode()).toBe("quality");
    expect(api.status().pathfindingMode).toBe("quality");
    expect(() =>
      api.setPathfindingMode("invalid" as "fast")
    ).toThrow(/unknown pathfinding mode/iu);
  });

  it("honors the persisted bootstrap default", () => {
    runtime = new KDHybridRuntime({
      target: {},
      pathfindingMode: "human"
    });
    expect(runtime.installGlobal().getPathfindingMode()).toBe("human");
  });

  it("exports configured JavaScript mods under privacy-hashed identities", () => {
    runtime = new KDHybridRuntime({
      target: {},
      mods: [{
        name: "Private JavaScript Mod",
        version: "2.0.0",
        capabilities: ["replaces-pathfinding"]
      }]
    });
    const diagnostics = runtime.exportDiagnostics();
    expect(diagnostics).not.toContain("Private JavaScript Mod");
    expect(JSON.parse(diagnostics).mods).toEqual([
      {
        id: expect.any(String),
        kind: "javascript",
        version: "2.0.0",
        capabilities: ["replaces-pathfinding"],
        systems: []
      }
    ]);
  });
});
