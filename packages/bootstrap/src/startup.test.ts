import { describe, expect, it } from "vitest";

import {
  installKinkyDungeonStartup,
  type KinkyDungeonStartupObservation
} from "./startup.js";

describe("Kinky Dungeon startup readiness", () => {
  it("records each readiness milestone once and stops after the first room", () => {
    let now = 10;
    let observation = startupObservation();
    let scheduled: (() => void) | null = null;
    const cancelled: unknown[] = [];
    const target: {
      KDHybridStartup?: ReturnType<typeof installKinkyDungeonStartup>;
    } = {};
    const startup = installKinkyDungeonStartup(
      {
        now: () => now,
        navigationStartEpochMs: 1_000,
        read: () => observation,
        schedule: (callback) => {
          scheduled = callback;
          return "timer";
        },
        cancel: (handle) => cancelled.push(handle)
      },
      target
    );

    expect(startup.status()).toMatchObject({
      navigationStartEpochMs: 1_000,
      bootstrapInstalledAtMs: 10,
      firstInteractiveAtMs: null,
      firstRoomReadyAtMs: null
    });

    now = 120;
    observation = startupObservation({
      documentReady: "interactive",
      hasRenderer: true,
      gameState: "Intro",
      loadingDone: 10,
      loadingFinished: true,
      loadingMax: 10
    });
    scheduled?.();
    expect(startup.status()).toMatchObject({
      documentInteractiveAtMs: 120,
      rendererReadyAtMs: 120,
      assetsReadyAtMs: 120,
      firstInteractiveAtMs: 120,
      introReadyAtMs: 120,
      menuReadyAtMs: null,
      firstRoomReadyAtMs: null
    });

    now = 250;
    observation = startupObservation({
      documentReady: "complete",
      hasRenderer: true,
      gameState: "Menu",
      loadingDone: 10,
      loadingFinished: true,
      loadingMax: 10
    });
    scheduled?.();
    expect(startup.status()).toMatchObject({
      documentInteractiveAtMs: 120,
      windowLoadedAtMs: 250,
      firstInteractiveAtMs: 120,
      menuReadyAtMs: 250
    });

    now = 400;
    observation = startupObservation({
      documentReady: "complete",
      hasRenderer: true,
      gameState: "Game",
      loadingDone: 10,
      loadingFinished: true,
      loadingMax: 10,
      mapWidth: 51,
      mapHeight: 37,
      hasPlayer: true
    });
    scheduled?.();
    expect(startup.status().firstRoomReadyAtMs).toBe(400);
    expect(cancelled).toEqual(["timer"]);
  });

  it("rejects the initial 1/1 counters and requires a real map for room readiness", () => {
    let now = 50;
    let observation = startupObservation({
      documentReady: "complete",
      hasRenderer: true,
      gameState: "Game",
      loadingDone: 1,
      loadingFinished: false,
      loadingMax: 1,
      mapWidth: 51,
      mapHeight: 37,
      hasPlayer: true
    });
    let poll: (() => void) | null = null;
    const startup = installKinkyDungeonStartup(
      {
        now: () => now,
        navigationStartEpochMs: 2_000,
        read: () => observation,
        schedule: (callback) => {
          poll = callback;
          return 1;
        },
        cancel: () => undefined
      },
      {}
    );

    expect(startup.status().assetsReadyAtMs).toBeNull();
    expect(startup.status().firstRoomReadyAtMs).toBeNull();
    now = 100;
    observation = {
      ...observation,
      loadingDone: 10,
      loadingFinished: true,
      loadingMax: 10,
      mapWidth: null
    };
    poll?.();
    expect(startup.status().assetsReadyAtMs).toBe(100);
    expect(startup.status().firstRoomReadyAtMs).toBeNull();
  });

  it("restores a previous startup API when disposed", () => {
    const previous = {
      status: () => {
        throw new Error("unused");
      },
      dispose: () => undefined
    };
    const target = { KDHybridStartup: previous };
    let cancelled = false;
    const startup = installKinkyDungeonStartup(
      {
        now: () => 0,
        navigationStartEpochMs: 0,
        read: () => startupObservation(),
        schedule: () => "timer",
        cancel: () => {
          cancelled = true;
        }
      },
      target
    );

    startup.dispose();

    expect(cancelled).toBe(true);
    expect(target.KDHybridStartup).toBe(previous);
  });

  it("keeps observing after an individual top-level binding read throws", () => {
    const globals = globalThis as Record<string, unknown>;
    const names = [
      "CurrentLoading",
      "KDMapData",
      "KinkyDungeonPlayerEntity"
    ] as const;
    const previous = new Map(
      names.map((name) => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
      ])
    );
    Object.defineProperty(globalThis, "CurrentLoading", {
      configurable: true,
      get: () => {
        throw new ReferenceError(
          "Cannot access 'CurrentLoading' before initialization"
        );
      }
    });
    Object.defineProperty(globalThis, "KDMapData", {
      configurable: true,
      value: { GridWidth: 51, GridHeight: 37 }
    });
    Object.defineProperty(globalThis, "KinkyDungeonPlayerEntity", {
      configurable: true,
      value: {}
    });

    try {
      const startup = installKinkyDungeonStartup(
        {
          now: () => 25,
          navigationStartEpochMs: 1_000,
          schedule: () => "timer",
          cancel: () => undefined
        },
        {}
      );

      expect(startup.status()).toMatchObject({
        currentLoading: null,
        mapWidth: 51,
        mapHeight: 37,
        hasPlayer: true
      });
      startup.dispose();
    } finally {
      for (const name of names) {
        const descriptor = previous.get(name);
        if (descriptor === undefined) {
          delete globals[name];
        } else {
          Object.defineProperty(globalThis, name, descriptor);
        }
      }
    }
  });
});

function startupObservation(
  overrides: Partial<KinkyDungeonStartupObservation> = {}
): KinkyDungeonStartupObservation {
  return {
    documentReady: "loading",
    hasRenderer: false,
    gameState: null,
    loadingDone: null,
    loadingFinished: null,
    loadingMax: null,
    currentLoading: null,
    mapWidth: null,
    mapHeight: null,
    hasPlayer: false,
    ...overrides
  };
}
