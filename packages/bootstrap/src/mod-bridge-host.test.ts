import { describe, expect, it, vi } from "vitest";

import {
  installKinkyDungeonModBridgeHost,
  readPersistedKDHybridModSettings
} from "./mod-bridge-host.js";

describe("KD Hybrid native mod bridge host", () => {
  it("exposes a capability-limited settings API", () => {
    const target: {
      KDHybridModBridge?: unknown;
    } = {};
    const runtime = {
      status: vi.fn(() => ({ version: "0.1.1" })),
      setPathfindingMode: vi.fn((mode: "fast" | "quality" | "human") => mode)
    };
    const rendering = {
      setFramePacingMode: vi.fn()
    };
    const handle = installKinkyDungeonModBridgeHost({
      runtime,
      rendering,
      initialSettings: {
        pathfindingMode: "fast",
        textureMode: "mobile",
        adaptiveFramePacing: true
      },
      storage: null,
      target
    });

    expect(target.KDHybridModBridge).toBe(handle.api);
    expect(handle.api).toEqual({
      version: "0.1.1",
      status: expect.any(Function),
      applySettings: expect.any(Function)
    });

    expect(
      handle.api.applySettings({
        pathfindingMode: "human",
        textureMode: "full",
        adaptiveFramePacing: false
      })
    ).toMatchObject({
      available: true,
      restartRequired: true,
      applyCount: 1,
      settings: {
        pathfindingMode: "human",
        textureMode: "full",
        adaptiveFramePacing: false
      }
    });
    expect(runtime.setPathfindingMode).toHaveBeenCalledWith("human");
    expect(rendering.setFramePacingMode).toHaveBeenCalledWith("off");

    handle.dispose();
    expect(target.KDHybridModBridge).toBeUndefined();
    expect(() => handle.api.applySettings({ pathfindingMode: "fast" })).toThrow(
      /disposed/u
    );
  });

  it("rejects settings outside the supported native contract", () => {
    const handle = installKinkyDungeonModBridgeHost({
      runtime: {
        status: () => ({ version: "0.1.1" }),
        setPathfindingMode: (mode) => mode
      },
      rendering: {
        setFramePacingMode: () => undefined
      },
      initialSettings: {
        pathfindingMode: "fast",
        textureMode: "mobile",
        adaptiveFramePacing: true
      },
      storage: null,
      target: {}
    });

    expect(() =>
      handle.api.applySettings({
        pathfindingMode: "impossible" as "fast"
      })
    ).toThrow(/Unknown pathfinding mode/u);
    expect(handle.status().applyCount).toBe(0);
  });

  it("merges persisted settings without removing other mods", () => {
    let serialized = JSON.stringify({
      EarPlugsRedux: { enabled: true }
    });
    const storage = {
      getItem: vi.fn(() => serialized),
      setItem: vi.fn((_key: string, value: string) => {
        serialized = value;
      })
    };
    const handle = installKinkyDungeonModBridgeHost({
      runtime: {
        status: () => ({ version: "0.1.1" }),
        setPathfindingMode: (mode) => mode
      },
      rendering: {
        setFramePacingMode: () => undefined
      },
      initialSettings: {
        pathfindingMode: "fast",
        textureMode: "mobile",
        adaptiveFramePacing: true
      },
      storage,
      target: {}
    });

    handle.api.applySettings({ pathfindingMode: "quality" });

    expect(JSON.parse(serialized)).toEqual({
      EarPlugsRedux: { enabled: true },
      KDHybrid: {
        pathfindingMode: "quality",
        textureMode: "mobile",
        adaptiveFramePacing: true
      }
    });
    expect(readPersistedKDHybridModSettings(storage)).toEqual({
      pathfindingMode: "quality",
      textureMode: "mobile",
      adaptiveFramePacing: true
    });
  });
});
