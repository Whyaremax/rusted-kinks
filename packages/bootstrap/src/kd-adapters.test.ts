import { describe, expect, it } from "vitest";

import {
  ABI_VERSION,
  BinaryWriter,
  decodeSnapshot,
  isNativeFallbackRequest,
  type Position,
  type Snapshot
} from "@kd-hybrid/runtime";

import {
  createKinkyDungeonPathfindingHandler,
  type KDPathfindingEnvironment
} from "./kd-adapters.js";

class FixtureBridge {
  snapshot: Snapshot | null = null;
  path: readonly Position[];
  responseStatus: 0 | 1 | 2 = 0;
  loadSnapshotCalls = 0;
  queryCalls = 0;
  queryKinds: number[] = [];

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
  Traffic: []
} as const;

const environment: KDPathfindingEnvironment = {
  mapData: () => mapFixture,
  visionAt: () => 1,
  effectTagsAt: () => undefined,
  playerPosition: () => ({ x: 4, y: 2 }),
  openDoorTiles: () => []
};

describe("Kinky Dungeon pathfinding adapter", () => {
  it("loads a compact snapshot and omits the source from the KD path", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 }
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
      undefined
    );

    expect(result).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 }
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
      { x: 4, y: 0 }
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
      }
    });

    expect(
      handler(0, 0, 4, 0, false, false, false, ".")
    ).toHaveLength(4);
    expect(handler(1, 0, 4, 0, false, false, false, ".")).toEqual([
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 }
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
      { x: 4, y: 0 }
    ]);
    const cache = new Map<string, readonly Position[]>();
    const handler = createKinkyDungeonPathfindingHandler(bridge, {
      ...environment,
      pathCache: () => cache
    });

    expect(
      handler(0, 0, 4, 0, false, false, false, ".")
    ).toHaveLength(4);
    bridge.path = [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 }
    ];
    expect(
      handler(0, 2, 4, 2, false, false, false, ".")
    ).toHaveLength(4);

    expect(bridge.loadSnapshotCalls).toBe(1);
    expect(bridge.queryCalls).toBe(2);
  });

  it("routes cache-assisted misses through KD's suffix splicer", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 }
    ]);
    const cache = new Map<string, readonly Position[]>();
    const handler = createKinkyDungeonPathfindingHandler(bridge, {
      ...environment,
      pathCache: () => cache
    });

    handler(0, 0, 4, 0, false, false, false, ".");
    const assisted = handler(0, 2, 4, 0, false, false, false, ".");
    expect(isNativeFallbackRequest(assisted)).toBe(true);

    expect(bridge.queryKinds).toEqual([3]);
    expect(bridge.loadSnapshotCalls).toBe(1);
    expect(bridge.queryCalls).toBe(1);
  });

  it("reloads the native grid when KD clears its path cache", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 }
    ]);
    const cache = new Map<string, readonly Position[]>();
    const handler = createKinkyDungeonPathfindingHandler(bridge, {
      ...environment,
      pathCache: () => cache
    });

    handler(0, 0, 4, 0, false, false, false, ".");
    cache.clear();
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
      pathCache: () => cache
    });

    expect(
      handler(0, 0, 4, 0, false, false, false, ".")
    ).toBeUndefined();
    expect(
      handler(0, 0, 4, 0, false, false, false, ".")
    ).toBeUndefined();
    cache.set("external-entry", []);
    expect(
      handler(0, 0, 4, 0, false, false, false, ".")
    ).toBeUndefined();
    cache.clear();
    expect(
      handler(0, 0, 4, 0, false, false, false, ".")
    ).toBeUndefined();

    expect(bridge.loadSnapshotCalls).toBe(2);
    expect(bridge.queryCalls).toBe(2);
  });

  it("keeps blocked source and target tiles in the reusable snapshot", () => {
    const bridge = new FixtureBridge([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 1 }
    ]);
    const handler = createKinkyDungeonPathfindingHandler(bridge, environment);

    expect(
      handler(0, 0, 2, 1, false, false, false, ".")
    ).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 1 }
    ]);
    expect(bridge.snapshot?.tiles[2 + 5]).toBe(1);
  });

  it("requests a one-call fallback for enemy-aware searches", () => {
    const bridge = new FixtureBridge([]);
    const handler = createKinkyDungeonPathfindingHandler(bridge, environment);
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
      { id: 7 }
    );

    expect(isNativeFallbackRequest(result)).toBe(true);
    expect(bridge.snapshot).toBeNull();
  });

  it("preserves KD's direct adjacent-square result", () => {
    const bridge = new FixtureBridge([]);
    const handler = createKinkyDungeonPathfindingHandler(bridge, environment);

    expect(handler(1, 1, 2, 2, true, true, false, ".")).toEqual([
      { x: 2, y: 2 }
    ]);
    expect(bridge.snapshot).toBeNull();
  });
});
