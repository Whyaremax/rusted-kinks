import { describe, expect, it, vi } from "vitest";

import {
  discoverKinkyDungeonControlModOnce,
  type KinkyDungeonControlModDiscoveryBindings
} from "./control-mod-discovery.js";

function fixture(options: {
  readonly bridgePresent?: boolean;
  readonly bridgeLoaded?: boolean;
} = {}) {
  const order = options.bridgeLoaded ? ["KDHybridBridge.zip"] : [];
  const bridgeBytes = Uint8Array.of(80, 75, 3, 4);
  const unrelatedBytes = Uint8Array.of(1, 2, 3);
  const getPhysicalMods = vi.fn(async () => [
    { base: "Unrelated.zip", file: unrelatedBytes },
    ...(options.bridgePresent === false
      ? []
      : [{ base: "KDHybridBridge.zip", file: bridgeBytes }])
  ]);
  const loadMods = vi.fn(async (files: File[]) => {
    order.push(...files.map((file) => file.name));
  });
  const installControlMod = vi.fn(() => ({
    status: () => ({
      installed: true,
      nativeAvailable: true,
      settings: {
        pathfindingMode: "fast" as const,
        textureMode: "mobile" as const,
        adaptiveFramePacing: true
      },
      lastError: null
    }),
    dispose: vi.fn()
  }));
  const bindings: KinkyDungeonControlModDiscoveryBindings = {
    loadOrderNames: () => [...order],
    getPhysicalMods,
    loadMods,
    installControlMod
  };
  return {
    bindings,
    order,
    getPhysicalMods,
    loadMods,
    installControlMod
  };
}

describe("KD Hybrid control mod physical discovery", () => {
  it("loads only the owned bridge when KD autoload is disabled", async () => {
    const state = fixture();

    await expect(
      discoverKinkyDungeonControlModOnce(state.bindings)
    ).resolves.toBe("ready");

    expect(state.order).toEqual(["KDHybridBridge.zip"]);
    expect(state.loadMods).toHaveBeenCalledOnce();
    expect(state.loadMods.mock.calls[0]?.[0].map((file) => file.name)).toEqual([
      "KDHybridBridge.zip"
    ]);
    expect(state.installControlMod).toHaveBeenCalledOnce();
  });

  it("does not rescan or reload an already registered bridge", async () => {
    const state = fixture({ bridgeLoaded: true });

    await expect(
      discoverKinkyDungeonControlModOnce(state.bindings)
    ).resolves.toBe("ready");

    expect(state.getPhysicalMods).not.toHaveBeenCalled();
    expect(state.loadMods).not.toHaveBeenCalled();
    expect(state.installControlMod).toHaveBeenCalledOnce();
  });

  it("does not synthesize a row when the owned bridge is absent", async () => {
    const state = fixture({ bridgePresent: false });

    await expect(
      discoverKinkyDungeonControlModOnce(state.bindings)
    ).resolves.toBe("bridge-missing");

    expect(state.order).toEqual([]);
    expect(state.loadMods).not.toHaveBeenCalled();
    expect(state.installControlMod).not.toHaveBeenCalled();
  });
});
