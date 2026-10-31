import { afterEach, describe, expect, it } from "vitest";

import { KDHybridRuntime } from "./runtime.js";
import { KNOWN_UPSTREAM, KNOWN_UPSTREAM_5_5_1 } from "./upstream.js";

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
    expect(() => api.setPathfindingMode("invalid" as "fast")).toThrow(
      /unknown pathfinding mode/iu,
    );
  });

  it("honors the persisted bootstrap default", () => {
    runtime = new KDHybridRuntime({
      target: {},
      pathfindingMode: "human",
    });
    expect(runtime.installGlobal().getPathfindingMode()).toBe("human");
  });

  it("exports configured JavaScript mods under privacy-hashed identities", () => {
    runtime = new KDHybridRuntime({
      target: {},
      mods: [
        {
          name: "Private JavaScript Mod",
          version: "2.0.0",
          capabilities: ["replaces-pathfinding"],
        },
      ],
    });
    const diagnostics = runtime.exportDiagnostics();
    expect(diagnostics).not.toContain("Private JavaScript Mod");
    expect(JSON.parse(diagnostics).mods).toEqual([
      {
        id: expect.any(String),
        kind: "javascript",
        version: "2.0.0",
        capabilities: ["replaces-pathfinding"],
        systems: [],
      },
    ]);
  });
});

describe("known upstream adapter gating", () => {
  function KinkyDungeonCreateMap(
    _mapParams: unknown,
    _roomType: unknown,
    _mapMod: unknown,
    _floor: unknown,
    _seed: unknown,
    _forceFaction: unknown,
    _forceEnemy: unknown,
    _forceTiles: unknown,
  ): string {
    return "KinkyDungeonMapParams";
  }

  it("fails closed when both exact-build identity signals are missing", () => {
    const target: Record<string, unknown> = { KinkyDungeonCreateMap };
    runtime = new KDHybridRuntime({ target });

    const status = runtime.registerKnownAdapter(
      "KinkyDungeonCreateMap",
      () => "native",
    );

    expect(status).toMatchObject({
      mode: "js-fallback",
      reason: "unknown-signature",
    });
    expect(target.KinkyDungeonCreateMap).toBe(KinkyDungeonCreateMap);
  });

  it("does not trust a menu version without the complete release fingerprint", () => {
    const target: Record<string, unknown> = { KinkyDungeonCreateMap };
    runtime = new KDHybridRuntime({
      target,
      upstreamVersion: KNOWN_UPSTREAM.gameVersion,
    });

    const status = runtime.registerKnownAdapter(
      "KinkyDungeonCreateMap",
      () => "native",
    );

    expect(status).toMatchObject({
      mode: "js-fallback",
      reason: "unknown-signature",
    });
    expect(target.KinkyDungeonCreateMap).toBe(KinkyDungeonCreateMap);
  });

  it("fingerprints a portable target once before registering facades", () => {
    const reads = new Map<string, number>();
    const target = new Proxy<Record<string, unknown>>(
      {
        KinkyDungeonCreateMap,
        KDNearbyEnemies: function KDNearbyEnemies() {
          return [];
        },
      },
      {
        get(source, property, receiver) {
          if (typeof property === "string") {
            reads.set(property, (reads.get(property) ?? 0) + 1);
          }
          return Reflect.get(source, property, receiver);
        },
      },
    );
    runtime = new KDHybridRuntime({ target });
    const fingerprintReads = reads.get("KinkyDungeonFindPath");

    runtime.registerKnownAdapter("KinkyDungeonCreateMap", () => "native");
    runtime.registerKnownAdapter("KDNearbyEnemies", () => []);

    expect(fingerprintReads).toBe(1);
    expect(reads.get("KinkyDungeonFindPath")).toBe(fingerprintReads);
  });

  it("fails closed when bundle and in-game version identify different releases", () => {
    const target: Record<string, unknown> = { KinkyDungeonCreateMap };
    runtime = new KDHybridRuntime({
      target,
      upstreamVersion: KNOWN_UPSTREAM_5_5_1.gameVersion,
      upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256,
    });

    const status = runtime.registerKnownAdapter(
      "KinkyDungeonCreateMap",
      () => "native",
    );

    expect(status).toMatchObject({
      mode: "js-fallback",
      reason: "unknown-signature",
    });
    expect(target.KinkyDungeonCreateMap).toBe(KinkyDungeonCreateMap);
  });

  it("fails closed when bundle and Electron package version disagree", () => {
    const target: Record<string, unknown> = { KinkyDungeonCreateMap };
    runtime = new KDHybridRuntime({
      target,
      upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256,
      upstreamPackageVersion: "5.1.13",
    });

    const status = runtime.registerKnownAdapter(
      "KinkyDungeonCreateMap",
      () => "native",
    );

    expect(status).toMatchObject({
      mode: "js-fallback",
      reason: "unknown-signature",
    });
    expect(target.KinkyDungeonCreateMap).toBe(KinkyDungeonCreateMap);
  });

  it("enables a matching adapter only for the exact bundle hash", () => {
    const target: Record<string, unknown> = { KinkyDungeonCreateMap };
    runtime = new KDHybridRuntime({
      target,
      upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256.toUpperCase(),
    });

    const status = runtime.registerKnownAdapter(
      "KinkyDungeonCreateMap",
      () => "native",
    );

    expect(status).toMatchObject({
      mode: "native",
      reason: null,
    });
    expect(
      (target.KinkyDungeonCreateMap as (...args: unknown[]) => unknown)(
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ),
    ).toBe("native");
  });

  it("does not reuse a changed 5.4.92 facade on the exact 5.5.1 bundle", () => {
    const target: Record<string, unknown> = { KinkyDungeonCreateMap };
    runtime = new KDHybridRuntime({
      target,
      upstreamBundleSha256: KNOWN_UPSTREAM_5_5_1.bundleSha256,
    });

    const status = runtime.registerKnownAdapter(
      "KinkyDungeonCreateMap",
      () => "native",
    );

    expect(status).toMatchObject({
      mode: "js-fallback",
      reason: "unknown-signature",
    });
    expect(target.KinkyDungeonCreateMap).toBe(KinkyDungeonCreateMap);
  });
});
