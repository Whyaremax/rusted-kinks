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
  readonly #path: readonly Position[];

  constructor(path: readonly Position[]) {
    this.#path = path;
  }

  loadSnapshot(bytes: Uint8Array): void {
    this.snapshot = decodeSnapshot(bytes);
  }

  query(): Uint8Array {
    const writer = new BinaryWriter("KDZ1");
    writer.u16(ABI_VERSION);
    writer.u8(1);
    writer.u8(0);
    writer.u32(this.#path.length);
    writer.u32(this.#path.length);
    for (const position of this.#path) {
      writer.position(position);
    }
    return writer.finish();
  }
}

const environment: KDPathfindingEnvironment = {
  mapData: () => ({
    Grid: ".....\n.###.\n.....\n",
    GridWidth: 5,
    GridHeight: 3,
    Tiles: {},
    TilesMemory: {},
    Traffic: []
  }),
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
