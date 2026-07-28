import { describe, expect, it } from "vitest";

import {
  ABI_VERSION,
  BinaryWriter,
  decodeSnapshot,
  isCompletedJavaScriptCall,
  isNativeFallbackRequest,
  type Position,
  type Snapshot,
} from "@kd-hybrid/runtime";

import {
  createKDCommanderHelpShortcutHandler,
  createKDEnemySelectorHandler,
  createKDEnemyUpdateCacheHandler,
  enemySelectorLongTagQueryKey,
  createKDFindMasterHandler,
  createKDJailKeyEarlyReturnHandler,
  createKDNearestPlayerHandler,
  createKDNearbyEnemiesHandler,
  createKinkyDungeonMapGenerationHandler,
  createKinkyDungeonPathfindingHandler,
  runWithKDSourcePathCacheEdgeIdentitySkip,
  type KDCommanderEntity,
  type KDCommanderHelpEnvironment,
  type KDCommanderOrdersLike,
  type KDEnemySelectorDefinition,
  type KDEnemySelectorEnvironment,
  type KDEnemySelectorState,
  type KDEnemyPositionCache,
  type KDEnemyUpdateCacheEnvironment,
  type KDEnemyUpdateEntity,
  type KDEnemyUpdateMapData,
  type KDMutableEnemyPositionCache,
  type KDMapGenerationGuardState,
  type KDFindMasterEnemy,
  type KDFindMasterEnvironment,
  type KDJailKeyEarlyReturnEnvironment,
  type KDNearestPlayerEnemy,
  type KDNearestPlayerEnvironment,
  type KDNearbyEnemy,
  type KDNearbyEnemiesEnvironment,
  type KDPathfindingEnvironment,
} from "./kd-adapters.js";

class FixtureBridge {
  snapshot: Snapshot | null = null;
  path: readonly Position[];
  responseStatus: 0 | 1 | 2 = 0;
  loadSnapshotCalls = 0;
  queryCalls = 0;
  queryKinds: number[] = [];
  queryFlags: number[] = [];

  constructor(path: readonly Position[]) {
    this.path = path;
  }

  loadSnapshot(bytes: Uint8Array): void {
    this.loadSnapshotCalls += 1;
    this.snapshot = decodeSnapshot(bytes);
  }

  query(bytes: Uint8Array): Uint8Array {
    this.queryCalls += 1;
    this.queryKinds.push(bytes[6] ?? -1);
    this.queryFlags.push(bytes[7] ?? -1);
    const writer = new BinaryWriter("KDZ1");
    writer.u16(ABI_VERSION);
    writer.u8(1);
    writer.u8(this.responseStatus);
    writer.u32(this.path.length);
    writer.u32(this.path.length);
    for (const position of this.path) {
      writer.position(position);
    }
    return writer.finish();
  }
}

const mapFixture = {
  Grid: ".....\n.###.\n.....\n",
  GridWidth: 5,
  GridHeight: 3,
  Tiles: {},
  TilesMemory: {},
  Traffic: [],
} as const;

const environment: KDPathfindingEnvironment = {
  mapData: () => mapFixture,
  visionAt: () => 1,
  effectTagsAt: () => undefined,
  playerPosition: () => ({ x: 4, y: 2 }),
  openDoorTiles: () => [],
};

describe("Kinky Dungeon pathfinding adapter", () => {
  it("uses the official pathfinder while a transient map is being generated", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    const fallbacks: string[] = [];
    const handler = createKinkyDungeonPathfindingHandler(bridge, {
      ...environment,
      mapGenerationActive: () => true,
      recordFallback: (reason) => {
        fallbacks.push(reason);
      },
    });

    const result = handler(
      0,
      0,
      2,
      0,
      false,
      false,
      true,
      ".",
      false,
      false,
      false,
      undefined,
      false,
      undefined,
      false,
      true,
      false,
      true,
      undefined,
    );

    expect(isNativeFallbackRequest(result)).toBe(true);
    expect(bridge.loadSnapshotCalls).toBe(0);
    expect(bridge.queryCalls).toBe(0);
    expect(fallbacks).toEqual(["map-generation"]);
  });

  it("loads a compact snapshot and omits the source from the KD path", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    const handler = createKinkyDungeonPathfindingHandler(bridge, environment);

    const result = handler(
      0,
      0,
      4,
      0,
      false,
      false,
      true,
      ".",
      false,
      false,
      false,
      undefined,
      false,
      undefined,
      false,
      true,
      false,
      true,
      undefined,
    );

    expect(result).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(bridge.snapshot?.width).toBe(5);
    expect(bridge.snapshot?.tiles[1 + 5]).toBe(1);
  });

  it("reuses KD's suffix cache before crossing into WASM", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    const cache = new Map<string, readonly Position[]>();
    let cacheHits = 0;
    let cacheFills = 0;
    const handler = createKinkyDungeonPathfindingHandler(bridge, {
      ...environment,
      pathCache: () => cache,
      recordCacheHit: () => {
        cacheHits += 1;
      },
      recordCacheFill: () => {
        cacheFills += 1;
      },
    });

    expect(handler(0, 0, 4, 0, false, false, false, ".")).toHaveLength(4);
    expect(handler(1, 0, 4, 0, false, false, false, ".")).toEqual([
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(cache.get("0,0,4,0,.")).toHaveLength(4);
    expect(cache.get("1,0,4,0,.")).toHaveLength(3);
    expect(cacheHits).toBe(1);
    expect(cacheFills).toBe(1);
    expect(bridge.loadSnapshotCalls).toBe(1);
    expect(bridge.queryCalls).toBe(1);
  });

  it("loads one native grid for multiple cache misses on the same map", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    const cache = new Map<string, readonly Position[]>();
    const handler = createKinkyDungeonPathfindingHandler(bridge, {
      ...environment,
      pathCache: () => cache,
    });

    expect(handler(0, 0, 4, 0, false, false, false, ".")).toHaveLength(4);
    bridge.path = [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ];
    expect(handler(0, 2, 4, 2, false, false, false, ".")).toHaveLength(4);

    expect(bridge.loadSnapshotCalls).toBe(1);
    expect(bridge.queryCalls).toBe(2);
  });

  it("keeps cache-assisted misses in the optimized native planner", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    const cache = new Map<string, readonly Position[]>();
    const handler = createKinkyDungeonPathfindingHandler(bridge, {
      ...environment,
      pathCache: () => cache,
    });

    handler(0, 0, 4, 0, false, false, false, ".");
    bridge.path = [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ];
    const assisted = handler(0, 2, 4, 0, false, false, false, ".");
    expect(isNativeFallbackRequest(assisted)).toBe(false);
    expect(assisted).toHaveLength(6);

    expect(bridge.queryKinds).toEqual([3, 3]);
    expect(bridge.loadSnapshotCalls).toBe(1);
    expect(bridge.queryCalls).toBe(2);
  });

  it("reuses an unchanged native grid when KD clears only its path cache", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    const cache = new Map<string, readonly Position[]>();
    const handler = createKinkyDungeonPathfindingHandler(bridge, {
      ...environment,
      pathCache: () => cache,
    });

    handler(0, 0, 4, 0, false, false, false, ".");
    cache.clear();
    handler(0, 0, 4, 0, false, false, false, ".");

    expect(bridge.loadSnapshotCalls).toBe(1);
    expect(bridge.queryCalls).toBe(2);
  });

  it("reloads the native grid when cache invalidation accompanies a map change", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    const cache = new Map<string, readonly Position[]>();
    const map = { ...mapFixture, Grid: String(mapFixture.Grid) };
    const handler = createKinkyDungeonPathfindingHandler(bridge, {
      ...environment,
      mapData: () => map,
      pathCache: () => cache,
    });

    handler(0, 0, 4, 0, false, false, false, ".");
    cache.clear();
    map.Grid = ".....\n.###.\n..#..\n";
    handler(0, 0, 4, 0, false, false, false, ".");

    expect(bridge.loadSnapshotCalls).toBe(2);
    expect(bridge.queryCalls).toBe(2);
  });

  it("reuses an unreachable result until KD invalidates the cache", () => {
    const bridge = new FixtureBridge([]);
    bridge.responseStatus = 1;
    const cache = new Map<string, readonly Position[]>();
    const handler = createKinkyDungeonPathfindingHandler(bridge, {
      ...environment,
      pathCache: () => cache,
    });

    expect(handler(0, 0, 4, 0, false, false, false, ".")).toBeUndefined();
    expect(handler(0, 0, 4, 0, false, false, false, ".")).toBeUndefined();
    cache.set("external-entry", []);
    expect(handler(0, 0, 4, 0, false, false, false, ".")).toBeUndefined();
    cache.clear();
    expect(handler(0, 0, 4, 0, false, false, false, ".")).toBeUndefined();

    expect(bridge.loadSnapshotCalls).toBe(1);
    expect(bridge.queryCalls).toBe(2);
  });

  it("keeps blocked source and target tiles in the reusable snapshot", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 1 },
    ]);
    const handler = createKinkyDungeonPathfindingHandler(bridge, environment);

    expect(handler(0, 0, 2, 1, false, false, false, ".")).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 1 },
    ]);
    expect(bridge.snapshot?.tiles[2 + 5]).toBe(1);
  });

  it("requests a one-call fallback for enemy-aware searches", () => {
    const bridge = new FixtureBridge([]);
    const reasons: string[] = [];
    const handler = createKinkyDungeonPathfindingHandler(bridge, {
      ...environment,
      recordFallback: (reason) => reasons.push(reason),
    });
    const result = handler(
      0,
      0,
      4,
      0,
      false,
      false,
      false,
      ".",
      false,
      false,
      false,
      { id: 7 },
    );

    expect(isNativeFallbackRequest(result)).toBe(true);
    expect(reasons).toEqual(["enemy-context"]);
    expect(bridge.snapshot).toBeNull();
  });

  it("preserves KD's direct adjacent-square result", () => {
    const bridge = new FixtureBridge([]);
    const handler = createKinkyDungeonPathfindingHandler(bridge, environment);

    expect(handler(1, 1, 2, 2, true, true, false, ".")).toEqual([
      { x: 2, y: 2 },
    ]);
    expect(bridge.snapshot).toBeNull();
  });

  it("encodes live planner changes and invalidates route caches", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    const cache = new Map<string, readonly Position[]>();
    let mode: "fast" | "quality" | "human" = "fast";
    let clears = 0;
    const handler = createKinkyDungeonPathfindingHandler(
      bridge,
      {
        ...environment,
        pathCache: () => cache,
        clearPathCaches: () => {
          clears += 1;
          cache.clear();
        },
      },
      () => mode,
    );

    handler(0, 0, 4, 0, false, false, false, ".");
    mode = "quality";
    handler(0, 0, 4, 0, false, false, false, ".");
    mode = "human";
    handler(0, 0, 4, 0, false, false, false, ".");

    expect(bridge.queryFlags).toEqual([1, 3, 5]);
    expect(clears).toBe(2);
    expect(cache.has("0,0,4,0,.\u001fkdhybrid:human")).toBe(true);
  });
});

describe("Kinky Dungeon map-generation guard", () => {
  it("marks only the official map-generation call and always clears the guard", () => {
    const state = { depth: 0 };
    let observedDepth = 0;
    const handler = createKinkyDungeonMapGenerationHandler((value) => {
      observedDepth = state.depth;
      return `generated:${String(value)}`;
    }, state);

    const result = handler("fixture");

    expect(isCompletedJavaScriptCall(result)).toBe(true);
    if (!isCompletedJavaScriptCall(result)) {
      throw new Error("map-generation handler did not complete JavaScript");
    }
    expect(result).toMatchObject({ ok: true, value: "generated:fixture" });
    expect(observedDepth).toBe(1);
    expect(state.depth).toBe(0);

    const failed = createKinkyDungeonMapGenerationHandler(() => {
      throw new Error("map generation failed");
    }, state)();
    expect(isCompletedJavaScriptCall(failed)).toBe(true);
    if (!isCompletedJavaScriptCall(failed)) {
      throw new Error("map-generation error was not captured");
    }
    expect(failed.ok).toBe(false);
    expect(state.depth).toBe(0);
  });

  it("scopes direct pathfinding fallback to the official map generator", () => {
    const state = { depth: 0 };
    const activations: boolean[] = [];
    let scopes = 0;
    const handler = createKinkyDungeonMapGenerationHandler(
      () => {
        expect(state.depth).toBe(1);
        return "generated";
      },
      state,
      {
        runWithDirectPathfindingFallback: (callback, recordActivation) => {
          scopes += 1;
          recordActivation?.(true);
          return callback();
        },
        directPathfindingFallbackEnabled: () => true,
        recordDirectPathfindingFallback: (active) => {
          activations.push(active);
        },
      },
    );

    expect(handler()).toMatchObject({ ok: true, value: "generated" });
    expect(scopes).toBe(1);
    expect(activations).toEqual([true]);
    expect(state.depth).toBe(0);
  });

  it("keeps the dispatcher path when the direct fallback control is disabled", () => {
    const state = { depth: 0 };
    const activations: boolean[] = [];
    let scopes = 0;
    const handler = createKinkyDungeonMapGenerationHandler(
      () => "generated",
      state,
      {
        runWithDirectPathfindingFallback: (callback) => {
          scopes += 1;
          return callback();
        },
        directPathfindingFallbackEnabled: () => false,
        recordDirectPathfindingFallback: (active) => {
          activations.push(active);
        },
      },
    );

    expect(handler()).toMatchObject({ ok: true, value: "generated" });
    expect(scopes).toBe(0);
    expect(activations).toEqual([false]);
    expect(state.depth).toBe(0);
  });

  it("shares one selector-cache epoch across nested map generation and restores it", () => {
    const previousEpoch = {};
    const state: KDMapGenerationGuardState = {
      depth: 0,
      enemySelectorCacheEpoch: previousEpoch,
    };
    const observedEpochs: object[] = [];
    let nested: (...args: unknown[]) => unknown;
    nested = createKinkyDungeonMapGenerationHandler(() => {
      expect(state.depth).toBe(2);
      observedEpochs.push(state.enemySelectorCacheEpoch!);
      return "nested";
    }, state);
    const outer = createKinkyDungeonMapGenerationHandler(() => {
      expect(state.depth).toBe(1);
      observedEpochs.push(state.enemySelectorCacheEpoch!);
      nested();
      observedEpochs.push(state.enemySelectorCacheEpoch!);
      return "outer";
    }, state);

    expect(outer()).toMatchObject({ ok: true, value: "outer" });
    expect(observedEpochs).toHaveLength(3);
    expect(observedEpochs[0]).not.toBe(previousEpoch);
    expect(observedEpochs[1]).toBe(observedEpochs[0]);
    expect(observedEpochs[2]).toBe(observedEpochs[0]);
    expect(state.enemySelectorCacheEpoch).toBe(previousEpoch);
    expect(state.depth).toBe(0);
  });

  it("does not create a selector-cache epoch when compatibility disables it", () => {
    const state: KDMapGenerationGuardState = { depth: 0 };
    let observedEpoch: object | undefined = {};
    const handler = createKinkyDungeonMapGenerationHandler(
      () => {
        observedEpoch = state.enemySelectorCacheEpoch;
        return "generated";
      },
      state,
      { enemySelectorAngerCacheEnabled: () => false },
    );

    expect(handler()).toMatchObject({ ok: true, value: "generated" });
    expect(observedEpoch).toBeUndefined();
    expect(state.enemySelectorCacheEpoch).toBeUndefined();
  });

  it("scopes the source path-cache edge-identity opt-in and restores it", () => {
    const target = globalThis as typeof globalThis & {
      KDHybridSourcePatchControl?: Record<string, unknown>;
    };
    const previousControlDescriptor = Object.getOwnPropertyDescriptor(
      target,
      "KDHybridSourcePatchControl",
    );
    const activations: boolean[] = [];
    try {
      Reflect.deleteProperty(target, "KDHybridSourcePatchControl");
      const result = runWithKDSourcePathCacheEdgeIdentitySkip(
        () => {
          expect(
            target.KDHybridSourcePatchControl
              ?.enablePathCacheEdgeIdentitySkip,
          ).toBe(true);
          return "generated";
        },
        (active) => activations.push(active),
      );

      expect(result).toBe("generated");
      expect(activations).toEqual([true]);
      expect(
        Object.prototype.hasOwnProperty.call(
          target,
          "KDHybridSourcePatchControl",
        ),
      ).toBe(false);
    } finally {
      Reflect.deleteProperty(target, "KDHybridSourcePatchControl");
      if (previousControlDescriptor !== undefined) {
        Object.defineProperty(
          target,
          "KDHybridSourcePatchControl",
          previousControlDescriptor,
        );
      }
    }
  });

  it("preserves an existing source control and refuses an accessor flag", () => {
    const target = globalThis as typeof globalThis & {
      KDHybridSourcePatchControl?: Record<string, unknown>;
    };
    const previousControlDescriptor = Object.getOwnPropertyDescriptor(
      target,
      "KDHybridSourcePatchControl",
    );
    const control: Record<string, unknown> = { marker: "keep" };
    let getterCalls = 0;
    Object.defineProperty(control, "enablePathCacheEdgeIdentitySkip", {
      configurable: true,
      enumerable: false,
      get: () => {
        getterCalls += 1;
        return false;
      },
    });
    const flagDescriptor = Object.getOwnPropertyDescriptor(
      control,
      "enablePathCacheEdgeIdentitySkip",
    );
    const activations: boolean[] = [];
    try {
      Object.defineProperty(target, "KDHybridSourcePatchControl", {
        configurable: true,
        enumerable: true,
        value: control,
        writable: true,
      });
      const result = runWithKDSourcePathCacheEdgeIdentitySkip(
        () => "official",
        (active) => activations.push(active),
      );

      expect(result).toBe("official");
      expect(activations).toEqual([false]);
      expect(getterCalls).toBe(0);
      expect(target.KDHybridSourcePatchControl).toBe(control);
      expect(
        Object.getOwnPropertyDescriptor(
          control,
          "enablePathCacheEdgeIdentitySkip",
        ),
      ).toEqual(flagDescriptor);
    } finally {
      Reflect.deleteProperty(target, "KDHybridSourcePatchControl");
      if (previousControlDescriptor !== undefined) {
        Object.defineProperty(
          target,
          "KDHybridSourcePatchControl",
          previousControlDescriptor,
        );
      }
    }
  });
});

describe("Kinky Dungeon enemy-selector invariant hoists", () => {
  const angerTags = [
    "imprisonable",
    "ropeAnger",
    "ropeRage",
    "metalAnger",
    "metalRage",
    "latexAnger",
    "latexRage",
    "conjureAnger",
    "conjureRage",
    "elementsAnger",
    "elementsRage",
    "illusionAnger",
    "illusionRage",
    "leatherAnger",
    "leatherRage",
    "willAnger",
    "willRage",
  ] as const;

  function enemy(
    name: string,
    weight: number,
    overrides: Partial<KDEnemySelectorDefinition> = {},
  ): KDEnemySelectorDefinition {
    return {
      name,
      minLevel: 0,
      weight,
      allFloors: true,
      tags: {},
      terrainTags: {},
      ...overrides,
    };
  }

  function fixture(
    enemies: readonly KDEnemySelectorDefinition[],
    randomValues: readonly number[],
  ): {
    readonly environment: KDEnemySelectorEnvironment;
    readonly statsChoice: Map<unknown, unknown>;
    readonly randomCalls: () => number;
    setCompatible(value: boolean): void;
  } {
    const statsChoice = new Map<unknown, unknown>();
    let compatible = true;
    let randomIndex = 0;
    const state: KDEnemySelectorState = {
      enemies,
      perkToggleTags: ["perkTag"],
      statsChoice,
      newGame: 0,
      goddessRep: {},
      groundTiles: ".",
      avoidTiles: "X",
      levelsPerCheckpoint: 4,
      factionRelation: () => -1,
      random: () => {
        const value = randomValues[randomIndex] ?? 0;
        randomIndex += 1;
        return value;
      },
    };
    return {
      environment: {
        state: () => state,
        compatible: () => compatible,
      },
      statsChoice,
      randomCalls: () => randomIndex,
      setCompatible: (value: boolean) => {
        compatible = value;
      },
    };
  }

  it("keys general long-tag queries by their exact dense contents", () => {
    const tags = Array.from({ length: 100 }, (_, index) => `tag-${index}`);
    const originalKey = enemySelectorLongTagQueryKey(tags);
    expect(originalKey).toMatch(/^general:/);
    expect(enemySelectorLongTagQueryKey([...tags])).toBe(originalKey);

    const mutated = [...tags];
    mutated[99] = "changed";
    expect(enemySelectorLongTagQueryKey(mutated)).not.toBe(originalKey);

    const left = [...tags];
    left[0] = "ab";
    left[1] = "c";
    const right = [...tags];
    right[0] = "a";
    right[1] = "bc";
    expect(enemySelectorLongTagQueryKey(left)).not.toBe(
      enemySelectorLongTagQueryKey(right),
    );
    expect(enemySelectorLongTagQueryKey(tags, false)).toBeUndefined();
    expect(enemySelectorLongTagQueryKey(tags.slice(0, 99))).toBeUndefined();
  });

  it("keeps special floor tags and non-data long arrays off the general cache", () => {
    for (const specialTag of ["boss", "miniboss", "elite", "minor"]) {
      const tags = Array.from({ length: 100 }, (_, index) => `tag-${index}`);
      tags[50] = specialTag;
      expect(enemySelectorLongTagQueryKey(tags)).toBeUndefined();
    }

    let getterCalls = 0;
    const accessorTags = Array.from(
      { length: 100 },
      (_, index) => `tag-${index}`,
    );
    Object.defineProperty(accessorTags, "50", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return "accessor";
      },
    });
    expect(enemySelectorLongTagQueryKey(accessorTags)).toBeUndefined();
    expect(getterCalls).toBe(0);

    const sparseTags = new Array<string>(100);
    sparseTags[0] = "general";
    expect(enemySelectorLongTagQueryKey(sparseTags)).toBeUndefined();

    class ModTagArray extends Array<string> {}
    const subclassTags = new ModTagArray(
      ...Array.from({ length: 100 }, (_, index) => `tag-${index}`),
    );
    expect(enemySelectorLongTagQueryKey(subclassTags)).toBeUndefined();
  });

  it("keeps general long-query weighted tables separated after tag mutation", () => {
    const first = enemy("First", 10, { tags: { "tag-0": true } });
    const second = enemy("Second", 10);
    const test = fixture([first, second], [0.1, 0.9, 0.1]);
    const epoch = {};
    const weightedStats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      longTagQueryKey: (tags) => enemySelectorLongTagQueryKey(tags),
      weightedQueryCacheEnabled: () => true,
      weightedQueryCacheStats: () => weightedStats,
    });
    const tags = Array.from({ length: 100 }, (_, index) => `tag-${index}`);

    handler(tags, 1, "grv", ".");
    handler(tags, 1, "grv", ".");
    tags[99] = "changed";
    handler(tags, 1, "grv", ".");

    expect(test.randomCalls()).toBe(3);
    expect(weightedStats).toEqual({
      optimizedCalls: 1,
      fallbackCalls: 2,
      cacheBuilds: 2,
      cacheHits: 1,
      enemiesElided: 2,
      validationFailures: 0,
    });
  });

  it("keeps KD's catalog order, random threshold, and selected object", () => {
    const first = enemy("First", 10);
    const second = enemy("Second", 5);
    const test = fixture([first, second], [0.2, 0.9]);
    const handler = createKDEnemySelectorHandler(test.environment);

    const firstResult = handler([], 1, "grv", ".");
    const secondResult = handler([], 1, "grv", ".");

    expect(isCompletedJavaScriptCall(firstResult)).toBe(true);
    expect(isCompletedJavaScriptCall(secondResult)).toBe(true);
    if (
      !isCompletedJavaScriptCall(firstResult) ||
      !isCompletedJavaScriptCall(secondResult)
    ) {
      throw new Error("enemy-selector calls did not complete in JavaScript");
    }
    expect(firstResult).toMatchObject({ ok: true, value: first });
    expect(secondResult).toMatchObject({ ok: true, value: second });
    expect(test.randomCalls()).toBe(2);
  });

  it("applies tags, requirements, alliances, and bonus weights in KD order", () => {
    const filtered = enemy("Filtered", 100, {
      faction: "Enemy",
      tags: { blocked: true },
      terrainTags: {},
    });
    const guard = enemy("Guard", 8, {
      faction: "Enemy",
      tags: { guard: true, bonus: true },
      terrainTags: { patrol: 2 },
    });
    const test = fixture([filtered, guard], [0.5]);
    let relationCalls = 0;
    const originalState = test.environment.state()!;
    const environment: KDEnemySelectorEnvironment = {
      state: () => ({
        ...originalState,
        factionRelation: () => {
          relationCalls += 1;
          return -1;
        },
      }),
      compatible: () => true,
    };
    const handler = createKDEnemySelectorHandler(environment);

    const result = handler(
      ["patrol"],
      8,
      "grv",
      ".",
      ["guard"],
      { requireHostile: "Player" },
      { bonus: { bonus: 3, mult: 2 } },
      ["blocked"],
      ["guard"],
    );

    expect(isCompletedJavaScriptCall(result)).toBe(true);
    if (!isCompletedJavaScriptCall(result)) {
      throw new Error("enemy-selector call did not complete in JavaScript");
    }
    expect(result).toMatchObject({ ok: true, value: guard });
    expect(relationCalls).toBe(1);
    expect(test.randomCalls()).toBe(1);
  });

  it("falls back before consuming RNG for dynamic or incompatible calls", () => {
    const test = fixture([enemy("Fixture", 10)], [0.5]);
    const handler = createKDEnemySelectorHandler(test.environment);
    const dynamicBonusTags = Object.defineProperty({}, "guard", {
      enumerable: true,
      get: () => ({ bonus: 1, mult: 1 }),
    });
    const throwingBonusTags = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error("mod-owned proxy");
        },
      },
    );

    expect(
      isNativeFallbackRequest(
        handler([], 1, "grv", ".", undefined, undefined, dynamicBonusTags),
      ),
    ).toBe(true);
    expect(
      isNativeFallbackRequest(
        handler([], 1, "grv", ".", undefined, undefined, throwingBonusTags),
      ),
    ).toBe(true);
    expect(
      isNativeFallbackRequest(
        handler(
          [],
          1,
          "grv",
          ".",
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          2,
          true,
        ),
      ),
    ).toBe(true);
    test.setCompatible(false);
    expect(isNativeFallbackRequest(handler([], 1, "grv", "."))).toBe(true);
    expect(test.randomCalls()).toBe(0);
  });

  it("captures optimized-path exceptions without retrying mutated state", () => {
    const malformed = enemy("Malformed", 10, {
      terrainTags:
        undefined as unknown as KDEnemySelectorDefinition["terrainTags"],
    });
    const test = fixture([malformed], [0.5]);
    const result = createKDEnemySelectorHandler(test.environment)(
      [],
      1,
      "grv",
      ".",
    );

    expect(isCompletedJavaScriptCall(result)).toBe(true);
    if (!isCompletedJavaScriptCall(result)) {
      throw new Error("enemy-selector exception was not captured");
    }
    expect(result.ok).toBe(false);
    expect(test.randomCalls()).toBe(0);
  });

  it("reuses canonical anger-tag match counts only within one map epoch", () => {
    const first = enemy("First", 10);
    const second = enemy("Second", 10, {
      tags: { ropeAnger: true },
    });
    const test = fixture([first, second], [0.1, 0.1, 0.1]);
    let epoch: object | undefined = {};
    const stats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      tagChecksElided: 0,
      validationFailures: 0,
      perEnemyFallbacks: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      angerMatchIndices: [1],
      angerCacheStats: () => stats,
    });

    expect(handler(angerTags, 1, "grv", ".")).toMatchObject({
      ok: true,
      value: first,
    });
    expect(handler(angerTags, 1, "grv", ".")).toMatchObject({
      ok: true,
      value: first,
    });
    expect(stats).toEqual({
      optimizedCalls: 2,
      fallbackCalls: 0,
      cacheBuilds: 2,
      cacheHits: 4,
      tagChecksElided: 68,
      validationFailures: 0,
      perEnemyFallbacks: 0,
    });

    epoch = {};
    expect(handler(angerTags, 1, "grv", ".")).toMatchObject({
      ok: true,
      value: first,
    });
    expect(stats.cacheBuilds).toBe(4);
    expect(stats.optimizedCalls).toBe(3);
  });

  it("rejects a changed anger-tag catalog pattern for the whole epoch", () => {
    const first = enemy("First", 10);
    const second = enemy("Second", 10, {
      tags: { ropeAnger: true },
    });
    const test = fixture([first, second], [0.1]);
    const stats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      tagChecksElided: 0,
      validationFailures: 0,
      perEnemyFallbacks: 0,
    };
    (first.tags as Record<string, unknown>).metalAnger = true;
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => ({}),
      angerMatchIndices: [1],
      angerCacheStats: () => stats,
    });

    expect(handler(angerTags, 1, "grv", ".")).toMatchObject({
      ok: true,
      value: first,
    });
    expect(stats).toMatchObject({
      optimizedCalls: 0,
      fallbackCalls: 1,
      cacheBuilds: 0,
      cacheHits: 0,
      validationFailures: 1,
    });
  });

  it("falls back per enemy when a mod replaces its tag object mid-epoch", () => {
    const mutable = enemy("Mutable", 10) as KDEnemySelectorDefinition & {
      tags: Record<string, unknown>;
    };
    const tagged = enemy("Tagged", 10, {
      tags: { ropeAnger: true },
    });
    const test = fixture([mutable, tagged], [0.1, 0.1]);
    const epoch = {};
    const stats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      tagChecksElided: 0,
      validationFailures: 0,
      perEnemyFallbacks: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      angerMatchIndices: [1],
      angerCacheStats: () => stats,
    });

    handler(angerTags, 1, "grv", ".");
    mutable.tags = { latexAnger: true };
    expect(handler(angerTags, 1, "grv", ".")).toMatchObject({
      ok: true,
      value: mutable,
    });
    expect(stats).toMatchObject({
      optimizedCalls: 2,
      fallbackCalls: 0,
      cacheHits: 3,
      perEnemyFallbacks: 1,
    });
  });

  it("reuses exact long-query match counts only within one map epoch", () => {
    const queryTags = ["trap", "fixture", "EnemyEnemy"] as const;
    const first = enemy("First", 10);
    const second = enemy("Second", 10, {
      tags: { trap: true, EnemyEnemy: true },
    });
    const test = fixture([first, second], [0.1, 0.1, 0.1]);
    let epoch: object | undefined = {};
    const stats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      tagChecksElided: 0,
      validationFailures: 0,
      perEnemyFallbacks: 0,
      querySequences: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      longTagQueryKey: (tags) =>
        tags.length === queryTags.length &&
        tags.every((tag, index) => tag === queryTags[index])
          ? "fixture"
          : undefined,
      longTagCacheStats: () => stats,
    });

    expect(handler(queryTags, 1, "grv", ".")).toMatchObject({
      ok: true,
      value: first,
    });
    expect(handler(queryTags, 1, "grv", ".")).toMatchObject({
      ok: true,
      value: first,
    });
    expect(stats).toEqual({
      optimizedCalls: 2,
      fallbackCalls: 0,
      cacheBuilds: 2,
      cacheHits: 4,
      tagChecksElided: 12,
      validationFailures: 0,
      perEnemyFallbacks: 0,
      querySequences: 1,
    });

    epoch = {};
    expect(handler(queryTags, 1, "grv", ".")).toMatchObject({
      ok: true,
      value: first,
    });
    expect(stats).toMatchObject({
      optimizedCalls: 3,
      cacheBuilds: 4,
      cacheHits: 6,
      querySequences: 2,
    });
  });

  it("rejects accessor-backed long-query tags without invoking them during validation", () => {
    let getterCalls = 0;
    const tags = Object.defineProperty({}, "trap", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return true;
      },
    });
    const guarded = enemy("Guarded", 10, { tags });
    const test = fixture([guarded], [0.1]);
    const stats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      tagChecksElided: 0,
      validationFailures: 0,
      perEnemyFallbacks: 0,
      querySequences: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => ({}),
      longTagQueryKey: () => "fixture",
      longTagCacheStats: () => stats,
    });

    const result = handler(["trap", "fixture"], 1, "grv", ".");
    expect(getterCalls).toBe(1);
    expect(isCompletedJavaScriptCall(result)).toBe(true);
    if (!isCompletedJavaScriptCall(result) || !result.ok) {
      throw new Error("accessor fallback did not complete in JavaScript");
    }
    expect(result.value).toBe(guarded);
    expect(stats).toEqual({
      optimizedCalls: 0,
      fallbackCalls: 1,
      cacheBuilds: 0,
      cacheHits: 0,
      tagChecksElided: 0,
      validationFailures: 1,
      perEnemyFallbacks: 0,
      querySequences: 1,
    });
  });

  it("falls back per enemy when a mod replaces a long-query tag object", () => {
    const mutable = enemy("Mutable", 10) as KDEnemySelectorDefinition & {
      tags: Record<string, unknown>;
    };
    const tagged = enemy("Tagged", 10, {
      tags: { trap: true },
    });
    const test = fixture([mutable, tagged], [0.1, 0.1]);
    const epoch = {};
    const stats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      tagChecksElided: 0,
      validationFailures: 0,
      perEnemyFallbacks: 0,
      querySequences: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      longTagQueryKey: () => "fixture",
      longTagCacheStats: () => stats,
    });

    handler(["trap", "fixture"], 1, "grv", ".");
    mutable.tags = { fixture: true };
    expect(handler(["trap", "fixture"], 1, "grv", ".")).toMatchObject({
      ok: true,
      value: mutable,
    });
    expect(stats).toMatchObject({
      optimizedCalls: 2,
      fallbackCalls: 0,
      cacheHits: 3,
      perEnemyFallbacks: 1,
      validationFailures: 0,
    });
  });

  it("uses the official long-query loop when the cache control is disabled", () => {
    const tagged = enemy("Tagged", 10, { tags: { trap: true } });
    const test = fixture([tagged], [0.1]);
    const stats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      tagChecksElided: 0,
      validationFailures: 0,
      perEnemyFallbacks: 0,
      querySequences: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => ({}),
      longTagCacheEnabled: () => false,
      longTagQueryKey: () => "fixture",
      longTagCacheStats: () => stats,
    });

    expect(handler(["trap", "fixture"], 1, "grv", ".")).toMatchObject({
      ok: true,
      value: tagged,
    });
    expect(stats).toEqual({
      optimizedCalls: 0,
      fallbackCalls: 1,
      cacheBuilds: 0,
      cacheHits: 0,
      tagChecksElided: 0,
      validationFailures: 0,
      perEnemyFallbacks: 0,
      querySequences: 0,
    });
  });

  it("reuses an exact weighted selector table without changing the random stream", () => {
    const first = enemy("First", 10, {
      faction: "Enemy",
      tags: { eligible: true },
    });
    const second = enemy("Second", 10, {
      faction: "Enemy",
      tags: { eligible: true, ropeAnger: true },
    });
    const test = fixture([first, second], [0.1, 0.9]);
    const epoch = {};
    const weightedStats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      angerMatchIndices: [1],
      weightedQueryCacheEnabled: () => true,
      weightedQueryCacheStats: () => weightedStats,
    });

    expect(
      handler(
        angerTags,
        1,
        "grv",
        ".",
        ["eligible"],
        { requireHostile: "Player" },
      ),
    ).toMatchObject({ ok: true, value: first });
    expect(
      handler(
        angerTags,
        1,
        "grv",
        ".",
        ["eligible"],
        { requireHostile: "Player" },
      ),
    ).toMatchObject({ ok: true, value: second });
    expect(test.randomCalls()).toBe(2);
    expect(weightedStats).toEqual({
      optimizedCalls: 1,
      fallbackCalls: 1,
      cacheBuilds: 1,
      cacheHits: 1,
      enemiesElided: 2,
      validationFailures: 0,
    });
  });

  it("reuses an exact weighted table for a canonical single-tag query", () => {
    const first = enemy("First", 10);
    const second = enemy("Second", 10, {
      tags: { mushroom: true },
    });
    const test = fixture([first, second], [0.1, 0.9]);
    const epoch = {};
    const weightedStats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      weightedQueryCacheEnabled: () => true,
      weightedSingleTagCacheEnabled: () => true,
      weightedQueryCacheStats: () => weightedStats,
    });

    expect(handler(["mushroom"], 1, "grv", ".")).toMatchObject({
      ok: true,
      value: first,
    });
    expect(handler(["mushroom"], 1, "grv", ".")).toMatchObject({
      ok: true,
      value: second,
    });
    expect(test.randomCalls()).toBe(2);
    expect(weightedStats).toEqual({
      optimizedCalls: 1,
      fallbackCalls: 1,
      cacheBuilds: 1,
      cacheHits: 1,
      enemiesElided: 2,
      validationFailures: 0,
    });
  });

  it("reuses an exact weighted table for plain filtered queries", () => {
    const blocked = enemy("Blocked", 10, {
      tags: { blocked: true, mushroom: true },
    });
    const allowed = enemy("Allowed", 10, {
      tags: { mushroom: true },
    });
    const test = fixture([blocked, allowed], [0.1, 0.9]);
    const epoch = {};
    const weightedStats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      weightedQueryCacheEnabled: () => true,
      weightedSingleTagCacheEnabled: () => true,
      weightedFilterTagCacheEnabled: () => true,
      weightedQueryCacheStats: () => weightedStats,
    });

    expect(
      handler(
        ["mushroom"],
        1,
        "grv",
        ".",
        undefined,
        undefined,
        undefined,
        ["blocked"],
      ),
    ).toMatchObject({ ok: true, value: allowed });
    expect(
      handler(
        ["mushroom"],
        1,
        "grv",
        ".",
        undefined,
        undefined,
        undefined,
        ["blocked"],
      ),
    ).toMatchObject({ ok: true, value: allowed });
    expect(test.randomCalls()).toBe(2);
    expect(weightedStats).toEqual({
      optimizedCalls: 1,
      fallbackCalls: 1,
      cacheBuilds: 1,
      cacheHits: 1,
      enemiesElided: 2,
      validationFailures: 0,
    });
  });

  it("keys filtered tables by the filter array's current contents", () => {
    const blocked = enemy("Blocked", 10, {
      tags: { blocked: true, mushroom: true },
    });
    const other = enemy("Other", 10, {
      tags: { mushroom: true, other: true },
    });
    const test = fixture([blocked, other], [0.1, 0.1, 0.9]);
    const epoch = {};
    const filterTags = ["blocked"];
    const weightedStats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      weightedQueryCacheEnabled: () => true,
      weightedSingleTagCacheEnabled: () => true,
      weightedFilterTagCacheEnabled: () => true,
      weightedQueryCacheStats: () => weightedStats,
    });
    const call = () =>
      handler(
        ["mushroom"],
        1,
        "grv",
        ".",
        undefined,
        undefined,
        undefined,
        filterTags,
      );

    expect(call()).toMatchObject({ ok: true, value: other });
    filterTags[0] = "other";
    expect(call()).toMatchObject({ ok: true, value: blocked });
    expect(call()).toMatchObject({ ok: true, value: blocked });
    expect(test.randomCalls()).toBe(3);
    expect(weightedStats).toEqual({
      optimizedCalls: 1,
      fallbackCalls: 2,
      cacheBuilds: 2,
      cacheHits: 1,
      enemiesElided: 2,
      validationFailures: 0,
    });
  });

  it("keeps accessor-backed filter arrays on the exact selector loop", () => {
    const blocked = enemy("Blocked", 10, {
      tags: { blocked: true, mushroom: true },
    });
    const allowed = enemy("Allowed", 10, {
      tags: { mushroom: true },
    });
    const test = fixture([blocked, allowed], [0.1, 0.9]);
    const epoch = {};
    const filterTags: string[] = [];
    let getterCalls = 0;
    Object.defineProperty(filterTags, "0", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return "blocked";
      },
    });
    filterTags.length = 1;
    const weightedStats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      weightedQueryCacheEnabled: () => true,
      weightedSingleTagCacheEnabled: () => true,
      weightedFilterTagCacheEnabled: () => true,
      weightedQueryCacheStats: () => weightedStats,
    });

    for (let call = 0; call < 2; call += 1) {
      expect(
        handler(
          ["mushroom"],
          1,
          "grv",
          ".",
          undefined,
          undefined,
          undefined,
          filterTags,
        ),
      ).toMatchObject({ ok: true, value: allowed });
    }
    expect(getterCalls).toBe(4);
    expect(test.randomCalls()).toBe(2);
    expect(weightedStats).toEqual({
      optimizedCalls: 0,
      fallbackCalls: 2,
      cacheBuilds: 0,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 0,
    });
  });

  it("disables filtered tables without clearing unfiltered single-tag tables", () => {
    const blocked = enemy("Blocked", 10, {
      tags: { blocked: true, mushroom: true },
    });
    const allowed = enemy("Allowed", 10, {
      tags: { mushroom: true },
    });
    const test = fixture([blocked, allowed], [0.1, 0.9, 0.1, 0.9]);
    const epoch = {};
    const weightedStats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      weightedQueryCacheEnabled: () => true,
      weightedSingleTagCacheEnabled: () => true,
      weightedFilterTagCacheEnabled: () => false,
      weightedQueryCacheStats: () => weightedStats,
    });

    for (let call = 0; call < 2; call += 1) {
      expect(
        handler(
          ["mushroom"],
          1,
          "grv",
          ".",
          undefined,
          undefined,
          undefined,
          ["blocked"],
        ),
      ).toMatchObject({ ok: true, value: allowed });
    }
    expect(handler(["mushroom"], 1, "grv", ".")).toMatchObject({
      ok: true,
      value: blocked,
    });
    expect(handler(["mushroom"], 1, "grv", ".")).toMatchObject({
      ok: true,
      value: allowed,
    });
    expect(test.randomCalls()).toBe(4);
    expect(weightedStats).toEqual({
      optimizedCalls: 1,
      fallbackCalls: 3,
      cacheBuilds: 1,
      cacheHits: 1,
      enemiesElided: 2,
      validationFailures: 0,
    });
  });

  it("disables single-tag tables without clearing an anger table", () => {
    const first = enemy("First", 10);
    const second = enemy("Second", 10, {
      tags: { ropeAnger: true },
    });
    const test = fixture([first, second], [0.1, 0.1, 0.9]);
    const epoch = {};
    const weightedStats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      angerMatchIndices: [1],
      weightedQueryCacheEnabled: () => true,
      weightedSingleTagCacheEnabled: () => false,
      weightedQueryCacheStats: () => weightedStats,
    });

    expect(handler(angerTags, 1, "grv", ".")).toMatchObject({
      ok: true,
      value: first,
    });
    expect(handler(["mushroom"], 1, "grv", ".")).toMatchObject({
      ok: true,
      value: first,
    });
    expect(handler(angerTags, 1, "grv", ".")).toMatchObject({
      ok: true,
      value: second,
    });
    expect(test.randomCalls()).toBe(3);
    expect(weightedStats).toEqual({
      optimizedCalls: 1,
      fallbackCalls: 1,
      cacheBuilds: 1,
      cacheHits: 1,
      enemiesElided: 2,
      validationFailures: 0,
    });
  });

  it("rebuilds a weighted selector table at the next map epoch", () => {
    const first = enemy("First", 10, {
      tags: { eligible: true },
    }) as KDEnemySelectorDefinition & { weight: number };
    const second = enemy("Second", 10, {
      tags: { eligible: true, ropeAnger: true },
    });
    const test = fixture([first, second], [0.1, 0.1]);
    let epoch = {};
    const weightedStats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      angerMatchIndices: [1],
      weightedQueryCacheEnabled: () => true,
      weightedQueryCacheStats: () => weightedStats,
    });

    expect(
      handler(angerTags, 1, "grv", ".", ["eligible"]),
    ).toMatchObject({ ok: true, value: first });
    first.weight = 0;
    epoch = {};
    expect(
      handler(angerTags, 1, "grv", ".", ["eligible"]),
    ).toMatchObject({ ok: true, value: second });
    expect(test.randomCalls()).toBe(2);
    expect(weightedStats).toEqual({
      optimizedCalls: 0,
      fallbackCalls: 2,
      cacheBuilds: 2,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 0,
    });
  });

  it("abandons the weighted cache after an in-epoch catalog resize", () => {
    const first = enemy("First", 10, {
      tags: { eligible: true },
    });
    const second = enemy("Second", 10, {
      tags: { eligible: true, ropeAnger: true },
    });
    const third = enemy("Third", 10, {
      tags: { eligible: true },
    });
    const enemies = [first, second];
    const test = fixture(enemies, [0.1, 0.9]);
    const epoch = {};
    const weightedStats = {
      optimizedCalls: 0,
      fallbackCalls: 0,
      cacheBuilds: 0,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 0,
    };
    const handler = createKDEnemySelectorHandler({
      ...test.environment,
      mapGenerationCacheEpoch: () => epoch,
      angerMatchIndices: [1],
      weightedQueryCacheEnabled: () => true,
      weightedQueryCacheStats: () => weightedStats,
    });

    expect(
      handler(angerTags, 1, "grv", ".", ["eligible"]),
    ).toMatchObject({ ok: true, value: first });
    enemies.push(third);
    expect(
      handler(angerTags, 1, "grv", ".", ["eligible"]),
    ).toMatchObject({ ok: true, value: third });
    expect(test.randomCalls()).toBe(2);
    expect(weightedStats).toEqual({
      optimizedCalls: 0,
      fallbackCalls: 2,
      cacheBuilds: 1,
      cacheHits: 0,
      enemiesElided: 0,
      validationFailures: 1,
    });
  });
});

interface EnemyUpdateFixtureEntity extends KDEnemyUpdateEntity {
  readonly id: number;
  x: number;
  y: number;
  lastx?: number;
  lasty?: number;
}

describe("Kinky Dungeon enemy-update position cache", () => {
  type AnyFunction = (...args: unknown[]) => unknown;
  type RecordEntry = {
    readonly event: string;
    readonly detail?: Readonly<Record<string, unknown>>;
  };

  function fixture(initialEntities: readonly EnemyUpdateFixtureEntity[]) {
    const entities = [...initialEntities];
    const map = {
      Entities: entities,
      Bullets: [] as unknown[],
      EffectTiles: {} as Record<
        string,
        Record<
          string,
          {
            duration?: unknown;
            name?: unknown;
          }
        >
      >,
    } satisfies KDEnemyUpdateMapData;
    const records: RecordEntry[] = [];
    let compatible = true;
    let dirty = false;
    let generation = 0;
    const generationChanges: {
      readonly cache: KDMutableEnemyPositionCache | undefined;
      readonly changes: readonly { readonly x: number; readonly y: number }[];
    }[] = [];
    let tick: unknown = 1;
    let risks: readonly string[] = [];
    let rebuilds = 0;
    let moveCalls = 0;
    let updateCalls = 0;
    const effectHandlers = new Set<string>();

    const rebuildCache = (): Map<string, EnemyUpdateFixtureEntity> => {
      rebuilds += 1;
      const rebuilt = new Map<string, EnemyUpdateFixtureEntity>();
      for (const entity of entities) {
        rebuilt.set(`${entity.x},${entity.y}`, entity);
      }
      return rebuilt;
    };
    let cache = rebuildCache();
    let updateImplementation: (
      thisArgument: unknown,
      args: readonly unknown[],
    ) => unknown = () => undefined;
    const officialMove: AnyFunction = (...args: unknown[]) => {
      moveCalls += 1;
      const enemy = args[0] as EnemyUpdateFixtureEntity;
      const x = Number(args[1]);
      const y = Number(args[2]);
      enemy.lastx = enemy.x;
      enemy.lasty = enemy.y;
      if (enemy.x !== x || enemy.y !== y) {
        enemy.x = x;
        enemy.y = y;
        dirty = true;
      }
      return false;
    };
    let currentMove = officialMove;

    const environment: KDEnemyUpdateCacheEnvironment = {
      compatible: () => compatible,
      mapData: () => map,
      currentTick: () => tick,
      enemyCache: () => {
        if (dirty) {
          cache = rebuildCache();
          dirty = false;
        }
        return cache;
      },
      currentEnemyCache: () => cache,
      replaceEnemyCache: (replacement: KDMutableEnemyPositionCache) => {
        cache = replacement as Map<string, EnemyUpdateFixtureEntity>;
      },
      cacheDirty: () => dirty,
      setCacheDirty: (value: boolean) => {
        dirty = value;
      },
      moveFunction: () => currentMove,
      replaceMoveFunction: (replacement: AnyFunction) => {
        currentMove = replacement;
      },
      updateEnemies: (thisArgument: unknown, args: readonly unknown[]) => {
        updateCalls += 1;
        return updateImplementation(thisArgument, args);
      },
      moveEntity: (thisArgument: unknown, args: readonly unknown[]) =>
        Reflect.apply(officialMove, thisArgument, args),
      effectMoveHandler: (name: unknown) =>
        effectHandlers.has(String(name)) ? () => undefined : undefined,
      eventRiskReasons: () => risks,
      advanceCacheGeneration: (generationCache, changes = []) => {
        generation += 1;
        generationChanges.push({
          cache: generationCache,
          changes: changes.map(({ x, y }) => ({ x, y })),
        });
      },
      record: (event, detail) => {
        records.push(detail === undefined ? { event } : { event, detail });
      },
    };

    return {
      entities,
      map,
      records,
      environment,
      officialMove,
      cache: () => cache,
      generation: () => generation,
      generationChanges: () => generationChanges,
      isDirty: () => dirty,
      moveCalls: () => moveCalls,
      updateCalls: () => updateCalls,
      rebuilds: () => rebuilds,
      moveFunction: () => currentMove,
      callMove: (...args: unknown[]) =>
        Reflect.apply(currentMove, undefined, args),
      setCompatible(value: boolean) {
        compatible = value;
      },
      setRisks(value: readonly string[]) {
        risks = value;
      },
      setTick(value: unknown) {
        tick = value;
      },
      setUpdate(
        implementation: (
          thisArgument: unknown,
          args: readonly unknown[],
        ) => unknown,
      ) {
        updateImplementation = implementation;
      },
      setMoveFunction(replacement: AnyFunction) {
        currentMove = replacement;
      },
      addEffectHandler(name: string) {
        effectHandlers.add(name);
      },
    };
  }

  function completedValue(result: unknown): unknown {
    expect(isCompletedJavaScriptCall(result)).toBe(true);
    if (!isCompletedJavaScriptCall(result)) {
      throw new Error("enemy-update handler did not complete JavaScript");
    }
    if (!result.ok) {
      throw result.error;
    }
    return result.value;
  }

  it("updates a clean working cache in constant time and restores KDMoveEntity", () => {
    const first: EnemyUpdateFixtureEntity = { id: 1, x: 1, y: 1 };
    const second: EnemyUpdateFixtureEntity = { id: 2, x: 3, y: 1 };
    const state = fixture([first, second]);
    const originalCache = state.cache();
    let duringUpdate: Map<string, KDEnemyUpdateEntity> | undefined;
    state.setUpdate(() => {
      state.callMove(first, 2, 1, false, false, false, false, false, undefined);
      duringUpdate = new Map(state.cache());
      return "updated";
    });
    const handler = createKDEnemyUpdateCacheHandler(state.environment);

    expect(completedValue(handler(1, false))).toBe("updated");
    expect(duringUpdate?.get("1,1")).toBeUndefined();
    expect(duringUpdate?.get("2,1")).toBe(first);
    expect(duringUpdate?.get("3,1")).toBe(second);
    expect(state.cache()).not.toBe(originalCache);
    expect(state.isDirty()).toBe(true);
    expect(state.moveFunction()).toBe(state.officialMove);
    expect(state.records.map(({ event }) => event)).toContain("fast-move");
    expect(state.records.map(({ event }) => event)).not.toContain(
      "scanned-move",
    );
    expect(state.generationChanges()).toEqual([
      { cache: state.cache(), changes: [] },
      {
        cache: state.cache(),
        changes: [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
        ],
      },
    ]);
    expect(state.moveCalls()).toBe(1);
    expect(state.updateCalls()).toBe(1);
  });

  it("repairs both affected keys when moves temporarily overlap", () => {
    const first: EnemyUpdateFixtureEntity = { id: 1, x: 1, y: 1 };
    const second: EnemyUpdateFixtureEntity = { id: 2, x: 2, y: 1 };
    const state = fixture([first, second]);
    let duringUpdate: Map<string, KDEnemyUpdateEntity> | undefined;
    state.setUpdate(() => {
      state.callMove(first, 2, 1, false, false, false, false, true, undefined);
      expect(state.cache().get("2,1")).toBe(second);
      state.callMove(second, 3, 1, false, false, false, false, true, undefined);
      duringUpdate = new Map(state.cache());
    });
    const handler = createKDEnemyUpdateCacheHandler(state.environment);

    completedValue(handler(1, false));
    expect(duringUpdate).toEqual(
      new Map([
        ["2,1", first],
        ["3,1", second],
      ]),
    );
    expect(
      state.records.filter(({ event }) => event === "scanned-move"),
    ).toHaveLength(2);
    expect(state.generationChanges().map(({ changes }) => changes)).toEqual([
      [],
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ],
    ]);
  });

  it("falls back before mutation when movement events are active", () => {
    const state = fixture([{ id: 1, x: 1, y: 1 }]);
    const originalCache = state.cache();
    state.setRisks(["enemy-definition-event"]);
    state.setUpdate(() => {
      throw new Error("fallback must not execute the captured update");
    });
    const handler = createKDEnemyUpdateCacheHandler(state.environment);

    expect(isNativeFallbackRequest(handler(1, false))).toBe(true);
    expect(state.cache()).toBe(originalCache);
    expect(state.generation()).toBe(0);
    expect(state.updateCalls()).toBe(0);
    expect(state.records).toContainEqual({
      event: "fallback",
      detail: {
        reason: "active-movement-events",
        reasons: ["enemy-definition-event"],
      },
    });
  });

  it("falls back before mutation when a dependency is no longer compatible", () => {
    const state = fixture([{ id: 1, x: 1, y: 1 }]);
    state.setCompatible(false);
    const handler = createKDEnemyUpdateCacheHandler(state.environment);

    expect(isNativeFallbackRequest(handler(1, false))).toBe(true);
    expect(state.updateCalls()).toBe(0);
    expect(state.generation()).toBe(0);
  });

  it.each(["bullet", "effect"] as const)(
    "leaves KD's full rebuild armed for a %s-sensitive move",
    (risk) => {
      const enemy: EnemyUpdateFixtureEntity = { id: 1, x: 1, y: 1 };
      const state = fixture([enemy]);
      if (risk === "bullet") {
        state.map.Bullets.push({});
      } else {
        state.map.EffectTiles["2,1"] = {
          test: { duration: 2, name: "TestMove" },
        };
        state.addEffectHandler("TestMove");
      }
      state.setUpdate(() => {
        state.callMove(
          enemy,
          2,
          1,
          false,
          false,
          false,
          false,
          false,
          undefined,
        );
      });
      const handler = createKDEnemyUpdateCacheHandler(state.environment);

      completedValue(handler(1, false));
      expect(state.isDirty()).toBe(true);
      expect(state.records.map(({ event }) => event)).toContain("unsafe-move");
      expect(state.records.map(({ event }) => event)).not.toContain(
        "fast-move",
      );
      expect(state.moveFunction()).toBe(state.officialMove);
    },
  );

  it("marks an upstream exception complete so the update cannot run twice", () => {
    const enemy: EnemyUpdateFixtureEntity = { id: 1, x: 1, y: 1 };
    const state = fixture([enemy]);
    state.setUpdate(() => {
      state.callMove(enemy, 2, 1, false, false, false, false, true, undefined);
      throw new Error("upstream update failed");
    });
    const handler = createKDEnemyUpdateCacheHandler(state.environment);
    const result = handler(1, false);

    expect(isCompletedJavaScriptCall(result)).toBe(true);
    if (!isCompletedJavaScriptCall(result)) {
      throw new Error("enemy-update handler did not complete JavaScript");
    }
    expect(result.ok).toBe(false);
    expect(state.updateCalls()).toBe(1);
    expect(state.moveCalls()).toBe(1);
    expect(state.moveFunction()).toBe(state.officialMove);
    expect(state.isDirty()).toBe(true);
  });

  it("does not overwrite a mod that replaces KDMoveEntity mid-update", () => {
    const state = fixture([{ id: 1, x: 1, y: 1 }]);
    const replacement = () => "modded";
    state.setUpdate(() => {
      state.setMoveFunction(replacement);
    });
    const handler = createKDEnemyUpdateCacheHandler(state.environment);

    completedValue(handler(1, false));
    expect(state.moveFunction()).toBe(replacement);
    expect(state.isDirty()).toBe(false);
  });
});

describe("Kinky Dungeon jail-key scan shortcut", () => {
  function fixture(
    names: readonly unknown[],
    maxKeys = 3,
  ): {
    readonly environment: KDJailKeyEarlyReturnEnvironment;
    readonly events: string[];
  } {
    const events: string[] = [];
    return {
      events,
      environment: {
        compatible: () => true,
        groundItems: () => names.map((name) => ({ name })),
        maxKeys: () => maxKeys,
        record: (event) => {
          events.push(event);
        },
      },
    };
  }

  it("completes without the official map scan when enough keyrings exist", () => {
    const state = fixture(["Keyring", "Potion", "Keyring", "Keyring"]);
    const handler = createKDJailKeyEarlyReturnHandler(state.environment);
    const result = handler();

    expect(isCompletedJavaScriptCall(result)).toBe(true);
    if (!isCompletedJavaScriptCall(result)) {
      throw new Error("jail-key handler did not complete JavaScript");
    }
    expect(result).toMatchObject({ ok: true, value: undefined });
    expect(state.events).toEqual(["skipped-scan"]);
  });

  it("uses the official function whenever another key can be placed", () => {
    const state = fixture(["Keyring", "Potion", "Keyring"]);
    const handler = createKDJailKeyEarlyReturnHandler(state.environment);

    expect(isNativeFallbackRequest(handler())).toBe(true);
    expect(state.events).toEqual(["fallback"]);
  });

  it("also skips the official no-op scan when the configured maximum is zero", () => {
    const state = fixture([], 0);
    const handler = createKDJailKeyEarlyReturnHandler(state.environment);

    expect(isCompletedJavaScriptCall(handler())).toBe(true);
    expect(state.events).toEqual(["skipped-scan"]);
  });

  it("falls back before reading map state when compatibility changes", () => {
    const events: string[] = [];
    const handler = createKDJailKeyEarlyReturnHandler({
      compatible: () => false,
      groundItems: () => {
        throw new Error("map state must not be read");
      },
      maxKeys: () => 3,
      record: (event) => {
        events.push(event);
      },
    });

    expect(isNativeFallbackRequest(handler())).toBe(true);
    expect(events).toEqual(["fallback"]);
  });

  it("falls back safely when live state access throws", () => {
    const events: string[] = [];
    const handler = createKDJailKeyEarlyReturnHandler({
      compatible: () => true,
      groundItems: () => {
        throw new Error("modded getter failed");
      },
      maxKeys: () => 3,
      record: (event) => {
        events.push(event);
      },
    });

    expect(isNativeFallbackRequest(handler())).toBe(true);
    expect(events).toEqual(["fallback"]);
  });
});

interface FixtureEnemy extends KDNearbyEnemy {
  readonly id: number;
  readonly faction: "A" | "B";
}

describe("Kinky Dungeon nearby-enemy adapter", () => {
  const targetA = { faction: "A" } as const;
  const targetB = { faction: "B" } as const;

  function hostile(enemy: KDNearbyEnemy, target: unknown): boolean {
    const enemyFaction = (enemy as FixtureEnemy).faction;
    const targetFaction =
      typeof target === "object" && target !== null && "faction" in target
        ? (target as { readonly faction?: unknown }).faction
        : undefined;
    return targetFaction === undefined || enemyFaction !== targetFaction;
  }

  function fixture() {
    const enemies: FixtureEnemy[] = [
      { id: 1, x: 1, y: 1, faction: "A" },
      { id: 2, x: 2, y: 2, faction: "B" },
      { id: 3, x: 4, y: 2, faction: "A" },
      { id: 4, x: 3, y: 4, faction: "B" },
      { id: 5, x: 6, y: 6, faction: "A" },
      { id: 6, x: 0, y: 3, faction: "B" },
      { id: 7, x: 5, y: 1, faction: "A" },
      { id: 8, x: 2, y: 5, faction: "B" },
      { id: 9, x: 6, y: 3, faction: "A" },
      { id: 10, x: 4, y: 6, faction: "B" },
      { id: 11, x: 0, y: 6, faction: "A" },
      { id: 12, x: 6, y: 0, faction: "B" },
    ];
    let cache: KDEnemyPositionCache = new Map(
      enemies.map((enemy) => [`${enemy.x},${enemy.y}`, enemy]),
    );
    let cacheGeneration = 0;
    const map = {
      ...mapFixture,
      Grid: ".......\n".repeat(7),
      GridWidth: 7,
      GridHeight: 7,
      Entities: enemies,
    };
    const nearbyEnvironment: KDNearbyEnemiesEnvironment = {
      mapData: () => map,
      enemyCache: () => cache,
      enemyCacheGeneration: () => cacheGeneration,
      hostile,
    };
    return {
      enemies,
      map,
      environment: nearbyEnvironment,
      replaceCache(next: KDEnemyPositionCache) {
        cache = next;
      },
      advanceCacheGeneration() {
        cacheGeneration += 1;
      },
    };
  }

  it("matches cached Chebyshev and Euclidean queries exactly", () => {
    const state = fixture();
    const handler = createKDNearbyEnemiesHandler(state.environment);
    const targets: readonly unknown[] = [undefined, targetA, targetB];

    for (const chebyshev of [false, true]) {
      for (const distance of [1, 1.5, 2, 2.5]) {
        for (const hostileTarget of targets) {
          for (const nonhostileTarget of targets) {
            const expected = referenceNearby(
              state.enemies,
              state.environment.enemyCache(),
              3,
              3,
              distance,
              hostileTarget,
              chebyshev,
              nonhostileTarget,
              hostile,
            );
            expect(
              handler(
                3,
                3,
                distance,
                hostileTarget,
                chebyshev,
                nonhostileTarget,
              ),
            ).toEqual(expected);
          }
        }
      }
    }
  });

  it("preserves entity order on full-array scans", () => {
    const state = fixture();
    const handler = createKDNearbyEnemiesHandler(state.environment);
    const expected = referenceNearby(
      state.enemies,
      state.environment.enemyCache(),
      3,
      3,
      10,
      undefined,
      true,
      targetA,
      hostile,
    );

    const result = handler(3, 3, 10, undefined, true, targetA);
    expect(result).toEqual(expected);
    expect(result).toEqual([
      state.enemies[0],
      state.enemies[2],
      state.enemies[4],
      state.enemies[6],
      state.enemies[8],
      state.enemies[10],
    ]);
  });

  it("matches cached query ordering at clipped map boundaries", () => {
    const state = fixture();
    const handler = createKDNearbyEnemiesHandler(state.environment);
    for (const [x, y] of [
      [0, 0],
      [6, 6],
      [0, 3],
      [3, 0],
    ]) {
      for (const chebyshev of [false, true]) {
        for (const distance of [1, 1.5, 2.5]) {
          expect(handler(x, y, distance, targetA, chebyshev, targetB)).toEqual(
            referenceNearby(
              state.enemies,
              state.environment.enemyCache(),
              x,
              y,
              distance,
              targetA,
              chebyshev,
              targetB,
              hostile,
            ),
          );
        }
      }
    }
  });

  it("rebuilds the dense index when KD replaces its cache generation", () => {
    const state = fixture();
    const handler = createKDNearbyEnemiesHandler(state.environment);
    expect(handler(1, 1, 1, undefined, true, undefined)).toContain(
      state.enemies[0],
    );

    const moved = state.enemies[0];
    if (moved === undefined) {
      throw new Error("missing fixture enemy");
    }
    Object.assign(moved, { x: 5, y: 5 });
    state.replaceCache(
      new Map(state.enemies.map((enemy) => [`${enemy.x},${enemy.y}`, enemy])),
    );

    expect(handler(1, 1, 1, undefined, true, undefined)).not.toContain(moved);
    expect(handler(5, 5, 1, undefined, true, undefined)).toContain(moved);
  });

  it("rebuilds the dense index when an explicit cache generation changes", () => {
    const state = fixture();
    const handler = createKDNearbyEnemiesHandler(state.environment);
    const moved = state.enemies[0]!;
    expect(handler(1, 1, 1, undefined, true, undefined)).toContain(moved);

    const cache = state.environment.enemyCache() as Map<string, KDNearbyEnemy>;
    cache.delete("1,1");
    Object.assign(moved, { x: 5, y: 5 });
    cache.set("5,5", moved);
    state.advanceCacheGeneration();

    expect(handler(1, 1, 1, undefined, true, undefined)).not.toContain(moved);
    expect(handler(5, 5, 1, undefined, true, undefined)).toContain(moved);
  });

  it("patches only journaled cells across multiple cache generations", () => {
    const state = fixture();
    const cache = state.environment.enemyCache() as Map<string, KDNearbyEnemy>;
    let cacheGets = 0;
    const countedCache: KDEnemyPositionCache = {
      get size() {
        return cache.size;
      },
      get(location: string) {
        cacheGets += 1;
        return cache.get(location);
      },
    };
    const changes = [
      { x: 1, y: 1 },
      { x: 5, y: 5 },
      { x: 2, y: 2 },
      { x: 1, y: 5 },
    ];
    const windows: [unknown, unknown][] = [];
    const handler = createKDNearbyEnemiesHandler({
      ...state.environment,
      enemyCache: () => countedCache,
      enemyCacheChanges: (_cache, fromGeneration, toGeneration) => {
        windows.push([fromGeneration, toGeneration]);
        return changes;
      },
    });
    const first = state.enemies[0]!;
    const second = state.enemies[1]!;

    expect(handler(1, 1, 1, undefined, true, undefined)).toContain(first);
    expect(cacheGets).toBe(state.enemies.length);

    cache.delete("1,1");
    Object.assign(first, { x: 5, y: 5 });
    cache.set("5,5", first);
    state.advanceCacheGeneration();
    cache.delete("2,2");
    Object.assign(second, { x: 1, y: 5 });
    cache.set("1,5", second);
    state.advanceCacheGeneration();

    expect(handler(1, 1, 1, undefined, true, undefined)).not.toContain(first);
    expect(handler(5, 5, 1, undefined, true, undefined)).toContain(first);
    expect(handler(1, 5, 1, undefined, true, undefined)).toContain(second);
    expect(cacheGets).toBe(state.enemies.length + changes.length);
    expect(windows).toEqual([[0, 2]]);
  });

  it("rebuilds instead of applying a malformed cell journal", () => {
    const state = fixture();
    const cache = state.environment.enemyCache() as Map<string, KDNearbyEnemy>;
    let cacheGets = 0;
    const countedCache: KDEnemyPositionCache = {
      get size() {
        return cache.size;
      },
      get(location: string) {
        cacheGets += 1;
        return cache.get(location);
      },
    };
    const handler = createKDNearbyEnemiesHandler({
      ...state.environment,
      enemyCache: () => countedCache,
      enemyCacheChanges: () => [
        { x: -1, y: 1 },
        { x: 5, y: 5 },
      ],
    });
    const moved = state.enemies[0]!;
    expect(handler(1, 1, 1, undefined, true, undefined)).toContain(moved);

    cache.delete("1,1");
    Object.assign(moved, { x: 5, y: 5 });
    cache.set("5,5", moved);
    state.advanceCacheGeneration();

    expect(handler(5, 5, 1, undefined, true, undefined)).toContain(moved);
    expect(cacheGets).toBe(state.enemies.length * 2);
  });

  it("falls back without mutating state for unsupported coordinates", () => {
    const state = fixture();
    const handler = createKDNearbyEnemiesHandler(state.environment);
    expect(isNativeFallbackRequest(handler(1.25, 2, 3))).toBe(true);
    expect(
      isNativeFallbackRequest(handler(1, 2, Number.POSITIVE_INFINITY)),
    ).toBe(true);
  });

  it("falls back when a mod replaces a captured dependency", () => {
    const state = fixture();
    let compatible = true;
    const handler = createKDNearbyEnemiesHandler({
      ...state.environment,
      compatible: () => compatible,
    });

    expect(handler(3, 3, 2, undefined, true, undefined)).toEqual(
      referenceNearby(
        state.enemies,
        state.environment.enemyCache(),
        3,
        3,
        2,
        undefined,
        true,
        undefined,
        hostile,
      ),
    );
    compatible = false;
    expect(
      isNativeFallbackRequest(handler(3, 3, 2, undefined, true, undefined)),
    ).toBe(true);
  });
});

interface MasterFixtureEnemy extends KDFindMasterEnemy {
  readonly id: number;
  readonly Enemy: Record<string, never>;
  rank: number;
  faction: string;
  leader?: boolean;
  led?: boolean;
  hostile?: boolean;
}

describe("Kinky Dungeon implicit-master adapter", () => {
  function fixture() {
    const enemies: MasterFixtureEnemy[] = [];
    for (let y = 1; y < 14 && enemies.length < 60; y += 1) {
      for (let x = 1; x < 14 && enemies.length < 60; x += 1) {
        enemies.push({
          id: enemies.length + 1,
          x,
          y,
          Enemy: {},
          rank: 1,
          faction: "A",
        });
      }
    }
    const subject = enemies.find((enemy) => enemy.x === 7 && enemy.y === 4)!;
    let cache: KDEnemyPositionCache = new Map(
      enemies.map((enemy) => [`${enemy.x},${enemy.y}`, enemy]),
    );
    let cacheGeneration = 0;
    let compatible = true;
    const calls = {
      hostile: 0,
      faction: 0,
      rank: 0,
      flags: 0,
      optimized: 0,
      fallback: 0,
      builds: 0,
      patches: 0,
    };
    const map = {
      Grid: "",
      GridWidth: 15,
      GridHeight: 15,
      Entities: enemies,
    };
    const environment: KDFindMasterEnvironment = {
      mapData: () => map,
      enemyCache: () => cache,
      enemyCacheGeneration: () => cacheGeneration,
      hostile: (enemy) => {
        calls.hostile += 1;
        return (enemy as MasterFixtureEnemy).hostile === true;
      },
      getFaction: (enemy) => {
        calls.faction += 1;
        return (enemy as MasterFixtureEnemy).faction;
      },
      enemyRank: (enemy) => {
        calls.rank += 1;
        return (enemy as MasterFixtureEnemy).rank;
      },
      entityHasFlag: (enemy, flag) => {
        calls.flags += 1;
        return (
          (flag === "leader" &&
            (enemy as MasterFixtureEnemy).leader === true) ||
          (flag === "led" && (enemy as MasterFixtureEnemy).led === true)
        );
      },
      chebyshev: (x, y) => Math.max(Math.abs(x), Math.abs(y)),
      compatible: () => compatible,
      record: (event) => {
        if (event === "optimized") calls.optimized += 1;
        else if (event === "fallback") calls.fallback += 1;
        else if (event === "dense-build") calls.builds += 1;
        else calls.patches += 1;
      },
    };
    return {
      enemies,
      subject,
      calls,
      environment,
      setCompatible(value: boolean) {
        compatible = value;
      },
      replaceCache() {
        cache = new Map(
          enemies.map((enemy) => [`${enemy.x},${enemy.y}`, enemy]),
        );
      },
      advanceCacheGeneration() {
        cacheGeneration += 1;
      },
    };
  }

  it("rejects impossible ranks before faction and hostility work", () => {
    const state = fixture();
    const handler = createKDFindMasterHandler(state.environment);

    expect(handler(state.subject)).toEqual({
      master: undefined,
      dist: 1000,
      info: undefined,
    });
    expect(state.calls.rank).toBeGreaterThan(1);
    expect(state.calls.hostile).toBe(0);
    expect(state.calls.faction).toBe(0);
    expect(state.calls.optimized).toBe(1);
    expect(state.calls.builds).toBe(1);
  });

  it("preserves cached coordinate order while filtering rank, hostility, and faction", () => {
    const state = fixture();
    const firstAtEqualDistance = state.enemies.find(
      (enemy) => enemy.x === 6 && enemy.y === 4,
    )!;
    const secondAtEqualDistance = state.enemies.find(
      (enemy) => enemy.x === 7 && enemy.y === 3,
    )!;
    const hostileCandidate = state.enemies.find(
      (enemy) => enemy.x === 6 && enemy.y === 3,
    )!;
    const otherFaction = state.enemies.find(
      (enemy) => enemy.x === 8 && enemy.y === 4,
    )!;
    firstAtEqualDistance.rank = 3;
    secondAtEqualDistance.leader = true;
    hostileCandidate.rank = 5;
    hostileCandidate.hostile = true;
    otherFaction.rank = 5;
    otherFaction.faction = "B";
    const handler = createKDFindMasterHandler(state.environment);

    expect(handler(state.subject)).toEqual({
      master: firstAtEqualDistance,
      dist: 1,
      info: undefined,
    });
    expect(state.calls.hostile).toBeGreaterThan(0);
    expect(state.calls.faction).toBeGreaterThan(0);
  });

  it("rebuilds its dense generation when KD replaces the enemy cache", () => {
    const state = fixture();
    const master = state.enemies.find(
      (enemy) => enemy.x === 6 && enemy.y === 4,
    )!;
    master.rank = 3;
    const handler = createKDFindMasterHandler(state.environment);
    expect(handler(state.subject)).toMatchObject({ master });

    Object.assign(master, { x: 13, y: 13 });
    state.replaceCache();
    expect(handler(state.subject)).toEqual({
      master: undefined,
      dist: 1000,
      info: undefined,
    });
    expect(state.calls.builds).toBe(2);
  });

  it("rebuilds its dense generation when a cache generation changes", () => {
    const state = fixture();
    const master = state.enemies.find(
      (enemy) => enemy.x === 6 && enemy.y === 4,
    )!;
    master.rank = 3;
    const handler = createKDFindMasterHandler(state.environment);
    expect(handler(state.subject)).toMatchObject({ master });

    const cache = state.environment.enemyCache() as Map<
      string,
      KDFindMasterEnemy
    >;
    cache.delete("6,4");
    Object.assign(master, { x: 13, y: 13 });
    cache.set("13,13", master);
    state.advanceCacheGeneration();

    expect(handler(state.subject)).toEqual({
      master: undefined,
      dist: 1000,
      info: undefined,
    });
    expect(state.calls.builds).toBe(2);
  });

  it("patches its dense generation when the complete cell journal is available", () => {
    const state = fixture();
    const master = state.enemies.find(
      (enemy) => enemy.x === 6 && enemy.y === 4,
    )!;
    master.rank = 3;
    const handler = createKDFindMasterHandler({
      ...state.environment,
      enemyCacheChanges: (_cache, fromGeneration, toGeneration) =>
        fromGeneration === 0 && toGeneration === 1
          ? [
              { x: 6, y: 4 },
              { x: 13, y: 13 },
            ]
          : undefined,
    });
    expect(handler(state.subject)).toMatchObject({ master });

    const cache = state.environment.enemyCache() as Map<
      string,
      KDFindMasterEnemy
    >;
    cache.delete("6,4");
    Object.assign(master, { x: 13, y: 13 });
    cache.set("13,13", master);
    state.advanceCacheGeneration();

    expect(handler(state.subject)).toEqual({
      master: undefined,
      dist: 1000,
      info: undefined,
    });
    expect(state.calls.builds).toBe(1);
    expect(state.calls.patches).toBe(1);
  });

  it("falls back before mutation-visible work for unsupported or modded calls", () => {
    const state = fixture();
    const handler = createKDFindMasterHandler(state.environment);

    state.subject.led = true;
    expect(isNativeFallbackRequest(handler(state.subject))).toBe(true);
    state.subject.led = false;
    state.setCompatible(false);
    const callsBefore = { ...state.calls };
    expect(isNativeFallbackRequest(handler(state.subject))).toBe(true);
    expect(state.calls.hostile).toBe(callsBefore.hostile);
    expect(state.calls.faction).toBe(callsBefore.faction);
    expect(state.calls.rank).toBe(callsBefore.rank);
    expect(isNativeFallbackRequest(handler(null))).toBe(true);
  });
});

interface NearestFixtureEnemy extends KDNearestPlayerEnemy {
  readonly label: string;
  readonly Enemy: {
    readonly name: string;
    readonly maxhp?: number;
    readonly visionRadius?: number;
    readonly noAttack?: boolean;
    readonly lowpriority?: boolean;
  };
  readonly fixtureHostile?: boolean;
  readonly fixtureHelpless?: boolean;
  readonly fixtureImprisoned?: boolean;
  readonly fixtureFaction?: string;
}

describe("Kinky Dungeon nearest-player adapter", () => {
  function fixture(
    candidates: NearestFixtureEnemy[],
    factionRelation: (left: unknown, right: unknown) => number = (
      left,
      right,
    ) => (left === right ? 0 : -1),
  ) {
    const player: KDNearestPlayerEnemy = {
      id: -1,
      x: 0,
      y: 0,
      player: true,
    };
    const subject: NearestFixtureEnemy = {
      id: 100,
      label: "subject",
      x: 5,
      y: 5,
      Enemy: {
        name: "subject",
        maxhp: 10,
        visionRadius: 10,
      },
    };
    const definitions = new Map<string, NearestFixtureEnemy["Enemy"]>([
      [subject.Enemy.name, subject.Enemy],
      ...candidates.map(
        (candidate) => [candidate.Enemy.name, candidate.Enemy] as const,
      ),
    ]);
    const log: string[] = [];
    let compatible = true;
    const flags = new Map<string, number>();
    const environment: KDNearestPlayerEnvironment = {
      player: () => player,
      gameData: () => ({}),
      flags: () => flags,
      enemyVisionRadius: (enemy) => {
        log.push(
          `vision:${(enemy as NearestFixtureEnemy).label ?? "coordinate"}`,
        );
        return 10;
      },
      checkLOS: () => true,
      checkPath: () => true,
      hostile: (_enemy, target) => {
        log.push(
          `hostile:${(target as NearestFixtureEnemy | undefined)?.label ?? "none"}`,
        );
        return target === undefined
          ? true
          : (target as NearestFixtureEnemy).fixtureHostile === true;
      },
      getFaction: (enemy) => {
        const fixtureEnemy = enemy as NearestFixtureEnemy;
        log.push(`faction:${fixtureEnemy.label}`);
        return (
          fixtureEnemy.fixtureFaction ??
          (fixtureEnemy.fixtureHostile ? "Hostile" : "Enemy")
        );
      },
      factionRelation,
      enemyHasFlag: () => false,
      nearbyEnemies: () => [subject, ...candidates],
      helpless: (enemy) => {
        const fixtureEnemy = enemy as NearestFixtureEnemy;
        log.push(`helpless:${fixtureEnemy.label}`);
        return fixtureEnemy.fixtureHelpless === true;
      },
      imprisoned: (enemy) => {
        const fixtureEnemy = enemy as NearestFixtureEnemy;
        log.push(`imprisoned:${fixtureEnemy.label}`);
        return fixtureEnemy.fixtureImprisoned === true;
      },
      chebyshev: (x, y) => Math.max(Math.abs(x), Math.abs(y)),
      visionGet: () => 1,
      allied: () => false,
      inParty: () => false,
      jailGuard: () => null,
      setFlag: (flag, duration) => {
        flags.set(flag, duration);
      },
      getEnemyByName: (name) => {
        log.push(`canonical:${String(name)}`);
        return definitions.get(String(name));
      },
      compatible: () => compatible,
    };
    return {
      player,
      subject,
      definitions,
      log,
      environment,
      setCompatible(value: boolean) {
        compatible = value;
      },
    };
  }

  function enemy(
    label: string,
    options: Partial<NearestFixtureEnemy> = {},
  ): NearestFixtureEnemy {
    return {
      id: label.charCodeAt(0),
      label,
      x: 6,
      y: 5,
      Enemy: {
        name: label,
        maxhp: 10,
      },
      ...options,
    };
  }

  it("rejects canonical nonhostile candidates before expensive classifiers", () => {
    const candidate = enemy("candidate");
    const state = fixture([candidate]);
    const handler = createKDNearestPlayerHandler(state.environment);

    expect(handler(state.subject, false, true, 10)).toBe(state.player);
    expect(state.log.filter((entry) => entry.endsWith(":candidate"))).toEqual([
      "canonical:candidate",
      "faction:candidate",
    ]);
  });

  it("keeps the upstream classifiers for hostile canonical candidates", () => {
    const candidate = enemy("candidate", { fixtureHostile: true });
    const state = fixture([candidate]);
    const handler = createKDNearestPlayerHandler(state.environment);

    expect(handler(state.subject, false, true, 10)).toBe(candidate);
    expect(state.log.filter((entry) => entry.endsWith(":candidate"))).toEqual([
      "canonical:candidate",
      "faction:candidate",
      "helpless:candidate",
      "imprisoned:candidate",
      "faction:candidate",
    ]);
  });

  it("preserves classifier order for packed or noncanonical mod entities", () => {
    const packed = enemy("packed", {
      Enemy: { name: "packed" },
      fixtureHostile: true,
    });
    const noncanonical = enemy("custom", { fixtureHostile: true });
    const state = fixture([packed, noncanonical]);
    state.definitions.set("custom", { ...noncanonical.Enemy });
    const handler = createKDNearestPlayerHandler(state.environment);

    expect(handler(state.subject, false, true, 10)).toBe(noncanonical);
    expect(state.log.filter((entry) => entry.endsWith(":packed"))).toEqual([
      "helpless:packed",
      "imprisoned:packed",
      "faction:packed",
      "hostile:packed",
    ]);
    expect(state.log.filter((entry) => entry.endsWith(":custom"))).toEqual([
      "canonical:custom",
      "helpless:custom",
      "imprisoned:custom",
      "faction:custom",
      "hostile:custom",
    ]);
  });

  it("preserves KD's later-wins tie behavior", () => {
    const first = enemy("first", { fixtureHostile: true });
    const second = enemy("second", { fixtureHostile: true });
    const state = fixture([first, second]);
    const handler = createKDNearestPlayerHandler(state.environment);

    expect(handler(state.subject, false, true, 10)).toBe(second);
  });

  it.each([
    {
      name: "same faction",
      subject: {},
      candidate: {},
      relation: 0,
      hostile: false,
    },
    {
      name: "dynamic hostile relation",
      subject: { fixtureFaction: "Maid" },
      candidate: { fixtureFaction: "Bandit" },
      relation: -0.5,
      hostile: true,
    },
    {
      name: "subject rage",
      subject: { rage: 1 },
      candidate: {},
      relation: 0,
      hostile: true,
    },
    {
      name: "candidate ceasefire before faction relation",
      subject: { fixtureFaction: "Maid" },
      candidate: { fixtureFaction: "Bandit", ceasefire: 1 },
      relation: -1,
      hostile: false,
    },
    {
      name: "hostile target of a player-faction subject",
      subject: { fixtureFaction: "Player" },
      candidate: { hostile: 1 },
      relation: 0,
      hostile: true,
    },
    {
      name: "allied target of a player-faction subject",
      subject: { fixtureFaction: "Player" },
      candidate: { allied: 1 },
      relation: -1,
      hostile: false,
    },
    {
      name: "player-faction target of a hostile subject",
      subject: { hostile: 1 },
      candidate: { fixtureFaction: "Player" },
      relation: 0,
      hostile: true,
    },
    {
      name: "enemy versus player faction",
      subject: { fixtureFaction: "Enemy" },
      candidate: { fixtureFaction: "Player" },
      relation: 0,
      hostile: true,
    },
    {
      name: "rage faction",
      subject: { fixtureFaction: "Maid" },
      candidate: { fixtureFaction: "Rage" },
      relation: 0,
      hostile: true,
    },
  ])(
    "matches KDHostile for $name",
    ({
      subject: subjectPatch,
      candidate: candidatePatch,
      relation,
      hostile,
    }) => {
      const candidate = enemy("candidate", candidatePatch);
      const state = fixture([candidate], () => relation);
      Object.assign(state.subject, subjectPatch);
      const handler = createKDNearestPlayerHandler(state.environment);

      expect(handler(state.subject, false, true, 10)).toBe(
        hostile ? candidate : state.player,
      );
    },
  );

  it("returns the player natively for KD's coordinate-only no-decoy calls", () => {
    const state = fixture([]);
    const handler = createKDNearestPlayerHandler(state.environment);

    expect(handler({ x: 12, y: 4 })).toBe(state.player);
    expect(state.log).toEqual([]);
  });

  it("preserves the no-decoy enemy vision-radius read", () => {
    const state = fixture([]);
    const handler = createKDNearestPlayerHandler(state.environment);

    expect(handler(state.subject)).toBe(state.player);
    expect(state.log).toEqual(["vision:subject"]);
  });

  it("falls back before helper-visible work for incompatible call shapes", () => {
    const candidate = enemy("candidate", { fixtureHostile: true });
    const state = fixture([candidate]);
    const handler = createKDNearestPlayerHandler(state.environment);

    state.setCompatible(false);
    expect(
      isNativeFallbackRequest(handler(state.subject, false, true, 10)),
    ).toBe(true);
    expect(state.log).toEqual([]);
    state.setCompatible(true);
    expect(
      isNativeFallbackRequest(
        handler(state.subject, false, true, "modded-radius"),
      ),
    ).toBe(true);
    expect(state.log).toEqual([]);
  });
});

describe("KD commander help shortcuts", () => {
  interface CommanderFixtureEntity extends KDCommanderEntity {
    bound?: boolean;
    danger?: boolean;
    disabled?: boolean;
    eligible?: boolean;
  }

  function fixture(entities: CommanderFixtureEntity[]) {
    const calls = {
      struggle: 0,
      danger: 0,
      scans: 0,
      stopped: 0,
    };
    let compatible = true;
    let mutationObserver: (() => void) | null = null;
    const orders: KDCommanderOrdersLike = {
      helpStruggle: {
        filter: () => {
          calls.struggle += 1;
          return entities.some((entity) => entity.bound === true);
        },
      },
      helpDanger: {
        filter: () => {
          calls.danger += 1;
          return entities.some(
            (entity) => entity.disabled === true && entity.danger === true,
          );
        },
      },
    };
    const map = {
      ...mapFixture,
      Entities: entities,
    };
    const environment: KDCommanderHelpEnvironment = {
      mapData: () => map,
      orders: () => orders,
      boundEffects: (enemy) =>
        (enemy as CommanderFixtureEntity).bound === true ? 2 : 0,
      imprisoned: () => false,
      tileDangerous: (enemy, x, y) => {
        const fixtureEnemy = enemy as CommanderFixtureEntity;
        return (
          fixtureEnemy.danger === true &&
          x === fixtureEnemy.x &&
          y === fixtureEnemy.y
        );
      },
      disabled: (enemy) => (enemy as CommanderFixtureEntity).disabled === true,
      nearbyMapTiles: (x, y) => [
        { x, y, tile: "." },
        { x: x + 1, y, tile: "." },
      ],
      entityAt: () => null,
      movableEnemyTiles: () => ".",
      candidateMayNeedHelp: (enemy) =>
        (enemy as CommanderFixtureEntity).eligible !== false,
      compatible: () => compatible,
      observeMutations: (observer) => {
        mutationObserver = observer;
        return () => {
          calls.stopped += 1;
          mutationObserver = null;
        };
      },
      record: (event) => {
        if (event === "scan") calls.scans += 1;
      },
    };
    return {
      calls,
      environment,
      orders,
      mutate(callback: () => void) {
        mutationObserver?.();
        callback();
        mutationObserver?.();
      },
      setCompatible(value: boolean) {
        compatible = value;
      },
    };
  }

  function completedValue(result: unknown): unknown {
    expect(isCompletedJavaScriptCall(result)).toBe(true);
    if (!isCompletedJavaScriptCall(result)) {
      throw new Error("commander handler did not complete JavaScript");
    }
    if (!result.ok) {
      throw result.error;
    }
    return result.value;
  }

  it("proves both rescue filters false when no target category exists", () => {
    const state = fixture([{ id: 1, x: 1, y: 1 }]);
    const official = (data: unknown) => [
      state.orders.helpStruggle?.filter(data),
      state.orders.helpDanger?.filter(data),
    ];
    const handler = createKDCommanderHelpShortcutHandler(
      official,
      state.environment,
    );

    expect(completedValue(handler({ delta: 1 }))).toEqual([false, false]);
    expect(state.calls).toMatchObject({
      struggle: 0,
      danger: 0,
      scans: 1,
      stopped: 1,
    });
  });

  it("rejects an ineligible candidate before refreshing map-wide potentials", () => {
    const state = fixture([
      { id: 1, x: 1, y: 1, eligible: false },
      { id: 2, x: 2, y: 1, bound: true, danger: true, disabled: true },
    ]);
    const official = (data: unknown) => [
      state.orders.helpStruggle?.filter(
        state.environment.mapData()?.Entities?.[0],
        data,
      ),
      state.orders.helpDanger?.filter(
        state.environment.mapData()?.Entities?.[0],
        data,
      ),
    ];
    const handler = createKDCommanderHelpShortcutHandler(
      official,
      state.environment,
    );

    expect(completedValue(handler({ delta: 1 }))).toEqual([false, false]);
    expect(state.calls).toMatchObject({
      struggle: 0,
      danger: 0,
      scans: 0,
      stopped: 1,
    });
  });

  it("uses the exact struggle filter when a bound target may exist", () => {
    const state = fixture([{ id: 1, x: 1, y: 1, bound: true }]);
    const official = (data: unknown) => [
      state.orders.helpStruggle?.filter(data),
      state.orders.helpDanger?.filter(data),
    ];
    const handler = createKDCommanderHelpShortcutHandler(
      official,
      state.environment,
    );

    expect(completedValue(handler({ delta: 1 }))).toEqual([true, false]);
    expect(state.calls.struggle).toBe(1);
    expect(state.calls.danger).toBe(0);
  });

  it("uses the exact danger filter when a disabled target can escape", () => {
    const state = fixture([
      { id: 1, x: 1, y: 1, danger: true, disabled: true },
    ]);
    const official = (data: unknown) => [
      state.orders.helpStruggle?.filter(data),
      state.orders.helpDanger?.filter(data),
    ];
    const handler = createKDCommanderHelpShortcutHandler(
      official,
      state.environment,
    );

    expect(completedValue(handler({ delta: 1 }))).toEqual([false, true]);
    expect(state.calls.struggle).toBe(0);
    expect(state.calls.danger).toBe(1);
  });

  it("rescans after a synchronous event mutation", () => {
    const target: CommanderFixtureEntity = { id: 1, x: 1, y: 1 };
    const state = fixture([target]);
    const official = (data: unknown) => {
      const before = state.orders.helpStruggle?.filter(data);
      state.mutate(() => {
        target.bound = true;
      });
      const after = state.orders.helpStruggle?.filter(data);
      return [before, after];
    };
    const handler = createKDCommanderHelpShortcutHandler(
      official,
      state.environment,
    );

    expect(completedValue(handler({ delta: 1 }))).toEqual([false, true]);
    expect(state.calls.struggle).toBe(1);
    expect(state.calls.scans).toBe(2);
  });

  it("uses exact filters after high mutation churn exhausts the scan budget", () => {
    const target: CommanderFixtureEntity = { id: 1, x: 1, y: 1 };
    const state = fixture([target]);
    const official = (data: unknown) => {
      const results: unknown[] = [];
      for (let index = 0; index < 30; index += 1) {
        if (index > 0) {
          state.mutate(() => {
            if (index === 16) target.bound = true;
          });
        }
        results.push(state.orders.helpStruggle?.filter(data));
      }
      return results;
    };
    const handler = createKDCommanderHelpShortcutHandler(
      official,
      state.environment,
    );

    expect(completedValue(handler({ delta: 1 }))).toEqual([
      ...Array.from({ length: 16 }, () => false),
      ...Array.from({ length: 14 }, () => true),
    ]);
    expect(state.calls).toMatchObject({
      struggle: 14,
      scans: 16,
      stopped: 1,
    });
  });

  it("falls back before mutation when compatibility changes", () => {
    const state = fixture([{ id: 1, x: 1, y: 1 }]);
    const handler = createKDCommanderHelpShortcutHandler(
      () => undefined,
      state.environment,
    );
    state.setCompatible(false);

    expect(isNativeFallbackRequest(handler({ delta: 1 }))).toBe(true);
    expect(state.calls.stopped).toBe(0);
  });

  it("restores both filters when upstream throws", () => {
    const state = fixture([{ id: 1, x: 1, y: 1 }]);
    const struggle = state.orders.helpStruggle?.filter;
    const danger = state.orders.helpDanger?.filter;
    const handler = createKDCommanderHelpShortcutHandler(() => {
      throw new Error("upstream commander failure");
    }, state.environment);
    const result = handler({ delta: 1 });

    expect(isCompletedJavaScriptCall(result)).toBe(true);
    if (!isCompletedJavaScriptCall(result)) {
      throw new Error("commander handler did not complete JavaScript");
    }
    expect(result.ok).toBe(false);
    expect(state.orders.helpStruggle?.filter).toBe(struggle);
    expect(state.orders.helpDanger?.filter).toBe(danger);
    expect(state.calls.stopped).toBe(1);
  });
});

function referenceNearby(
  entities: readonly KDNearbyEnemy[],
  cache: KDEnemyPositionCache | undefined,
  x: number,
  y: number,
  distance: number,
  hostileEnemy: unknown,
  chebyshev: boolean,
  nonhostileEnemy: unknown,
  hostile: (enemy: KDNearbyEnemy, target: unknown) => boolean,
): readonly KDNearbyEnemy[] {
  const result: KDNearbyEnemy[] = [];
  if (cache === undefined || 3 * distance * distance > entities.length) {
    for (const enemy of entities) {
      const dx = x - enemy.x;
      const dy = y - enemy.y;
      const inside = chebyshev
        ? Math.max(Math.abs(dx), Math.abs(dy)) <= distance
        : dx * dx + dy * dy <= distance * distance;
      if (
        inside &&
        (!hostileEnemy || hostile(enemy, hostileEnemy)) &&
        (!nonhostileEnemy || !hostile(enemy, nonhostileEnemy))
      ) {
        result.push(enemy);
      }
    }
    return result;
  }

  for (
    let entityX = Math.floor(x - distance);
    entityX < Math.ceil(x + distance);
    entityX += 1
  ) {
    for (
      let entityY = Math.floor(y - distance);
      entityY < Math.ceil(y + distance);
      entityY += 1
    ) {
      const enemy = cache.get(`${entityX},${entityY}`);
      const dx = entityX - x;
      const dy = entityY - y;
      const inside = chebyshev
        ? Math.max(Math.abs(dx), Math.abs(dy)) <= distance
        : dx * dx + dy * dy <= distance * distance;
      if (
        enemy !== undefined &&
        inside &&
        (!hostileEnemy || hostile(enemy, hostileEnemy)) &&
        (!nonhostileEnemy ||
          !hostile(enemy, chebyshev ? nonhostileEnemy : hostileEnemy))
      ) {
        result.push(enemy);
      }
    }
  }
  return result;
}
