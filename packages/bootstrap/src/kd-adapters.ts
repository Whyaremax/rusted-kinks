// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Compatibility behavior in this file is adapted from Kinky Dungeon 5.4.92.

import {
  decodeQueryResponse,
  encodeQuery,
  encodeSnapshot,
  useJavaScriptFallback,
  type KDHybridRuntime,
  type NativeFallbackRequest,
  type Position,
  type SystemStatus,
  type WasmBatchBridge
} from "@kd-hybrid/runtime";

const MAX_DIMENSION = 4_096;
const MAX_TILES = 16_777_216;
const MAX_VISITED = 1_000_000;
const MAX_WEIGHT_UNITS = 0x7f;

declare const KDMapData: KDMapDataLike | undefined;
declare const KinkyDungeonVisionGet:
  | ((x: number, y: number) => number)
  | undefined;
declare const KDEffectTileTagsLoc:
  | ((location: string) => EffectTileTags | undefined)
  | undefined;
declare const KinkyDungeonPlayerEntity: Position | undefined;
declare const KDOpenDoorTiles: readonly unknown[] | undefined;

interface KDMapTile {
  readonly Lock?: unknown;
  readonly OL?: unknown;
  readonly Sfty?: unknown;
}

export interface KDMapDataLike {
  readonly Grid: string;
  readonly GridWidth: number;
  readonly GridHeight: number;
  readonly Tiles?: Readonly<Record<string, KDMapTile | undefined>>;
  readonly TilesMemory?: Readonly<Record<string, unknown>>;
  readonly Traffic?: readonly (readonly number[] | undefined)[];
}

export interface EffectTileTags {
  readonly danger?: unknown;
}

export interface KDPathfindingEnvironment {
  mapData(): KDMapDataLike | undefined;
  visionAt(x: number, y: number): number | undefined;
  effectTagsAt(location: string): EffectTileTags | undefined;
  playerPosition(): Position | undefined;
  openDoorTiles(): readonly unknown[] | undefined;
}

type NativePathBridge = Pick<WasmBatchBridge, "loadSnapshot" | "query">;
type AdapterResult =
  | readonly Position[]
  | undefined
  | NativeFallbackRequest;

/**
 * Creates the native implementation behind the signature-gated KD facade.
 *
 * Unsupported dynamic argument combinations request a one-call JavaScript
 * fallback. No game state is changed until a complete native path has been
 * decoded and validated.
 */
export function createKinkyDungeonPathfindingHandler(
  bridge: NativePathBridge,
  environment: KDPathfindingEnvironment = browserEnvironment
): (...args: unknown[]) => AdapterResult {
  return (...args: unknown[]): AdapterResult => {
    const start = integerPosition(args[0], args[1]);
    const goal = integerPosition(args[2], args[3]);
    const movableTiles = args[7];
    if (start === null || goal === null || typeof movableTiles !== "string") {
      return useJavaScriptFallback();
    }

    // The upstream function returns the target directly for the same or an
    // adjacent square, before performing a graph search.
    if (
      Math.max(Math.abs(start.x - goal.x), Math.abs(start.y - goal.y)) <= 1
    ) {
      return [{ x: goal.x, y: goal.y }];
    }

    const blockEnemy = Boolean(args[4]);
    const enemy = args[11];
    const trimLongDistance = Boolean(args[12]);
    const heuristicOverride = args[13];
    const allowPassable = Boolean(args[16]);
    const leashTarget = args[18];
    if (
      blockEnemy ||
      (enemy !== undefined && enemy !== null) ||
      trimLongDistance ||
      (heuristicOverride !== undefined && heuristicOverride !== null) ||
      allowPassable ||
      (leashTarget !== undefined && leashTarget !== null && leashTarget !== 0)
    ) {
      return useJavaScriptFallback();
    }

    const map = environment.mapData();
    if (map === undefined || !validMap(map) || !inMap(map, start) || !inMap(map, goal)) {
      return useJavaScriptFallback();
    }

    const tiles = encodeKinkyDungeonGrid(map, start, goal, movableTiles, {
      blockPlayer: Boolean(args[5]),
      ignoreLocks: Boolean(args[6]),
      requireLight: Boolean(args[8]),
      noDoors: Boolean(args[9]),
      needDoorMemory: Boolean(args[10]),
      ignoreTrafficLaws: Boolean(args[15]),
      ignoreAllWeighting: Boolean(args[17])
    }, environment);
    if (tiles === null) {
      return useJavaScriptFallback();
    }

    bridge.loadSnapshot(
      encodeSnapshot({
        width: map.GridWidth,
        height: map.GridHeight,
        turn: 0n,
        seed: 0n,
        tiles,
        entities: [],
        buffs: []
      })
    );
    const response = decodeQueryResponse(
      bridge.query(
        encodeQuery({
          kind: "gridPath",
          start,
          goal,
          maxVisited: Math.min(tiles.length * 4, MAX_VISITED),
          diagonal: !Boolean(args[14])
        })
      )
    );
    if (response.kind !== "path") {
      throw new TypeError("Native grid path returned a non-path response");
    }
    if (response.status !== "found") {
      return undefined;
    }
    validatePath(response.positions, start, goal, tiles, map.GridWidth, !Boolean(args[14]));
    return response.positions.slice(1).map(({ x, y }) => ({ x, y }));
  };
}

export function installKinkyDungeonPathfindingAdapter(
  runtime: KDHybridRuntime,
  environment: KDPathfindingEnvironment = browserEnvironment
): SystemStatus | null {
  const target = globalThis as Record<string, unknown>;
  if (typeof target.KinkyDungeonFindPath !== "function") {
    return null;
  }
  return runtime.registerKnownAdapter(
    "KinkyDungeonFindPath",
    createKinkyDungeonPathfindingHandler(runtime.bridge, environment)
  );
}

export async function waitForKinkyDungeonPathfindingAdapter(
  runtime: KDHybridRuntime,
  timeoutMs = 15_000,
  pollMs = 50,
  environment: KDPathfindingEnvironment = browserEnvironment
): Promise<SystemStatus | null> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    const status = installKinkyDungeonPathfindingAdapter(runtime, environment);
    if (status !== null) {
      return status;
    }
    await delay(Math.max(1, pollMs));
  } while (Date.now() <= deadline);
  return null;
}

interface GridOptions {
  readonly blockPlayer: boolean;
  readonly ignoreLocks: boolean;
  readonly requireLight: boolean;
  readonly noDoors: boolean;
  readonly needDoorMemory: boolean;
  readonly ignoreTrafficLaws: boolean;
  readonly ignoreAllWeighting: boolean;
}

function encodeKinkyDungeonGrid(
  map: KDMapDataLike,
  start: Position,
  goal: Position,
  movableTiles: string,
  options: GridOptions,
  environment: KDPathfindingEnvironment
): Uint8Array | null {
  const allowed = options.noDoors ? movableTiles.replace("D", "") : movableTiles;
  const output = new Uint8Array(map.GridWidth * map.GridHeight);
  const mapTiles = map.Tiles ?? {};
  const tileMemory = map.TilesMemory ?? {};
  const openDoorTiles = options.needDoorMemory
    ? environment.openDoorTiles()
    : undefined;
  if (options.needDoorMemory && openDoorTiles === undefined) {
    return null;
  }
  const player = options.blockPlayer ? environment.playerPosition() : undefined;
  if (options.blockPlayer && player === undefined) {
    return null;
  }

  for (let y = 0; y < map.GridHeight; y += 1) {
    for (let x = 0; x < map.GridWidth; x += 1) {
      const index = x + y * map.GridWidth;
      const location = `${x},${y}`;
      const tile = map.Grid[x + y * (map.GridWidth + 1)];
      const metadata = mapTiles[location];
      if (tile === undefined) {
        output[index] = 1;
        continue;
      }
      let blocked =
        !allowed.includes(tile) ||
        (!options.ignoreLocks && Boolean(metadata?.Lock)) ||
        (options.blockPlayer && player?.x === x && player.y === y) ||
        (options.needDoorMemory &&
          tile === "d" &&
          !openDoorTiles?.includes(tileMemory[location]));

      if (!blocked && options.requireLight) {
        const vision = environment.visionAt(x, y);
        if (typeof vision !== "number" || !Number.isFinite(vision)) {
          return null;
        }
        blocked = vision <= 0;
      }

      if (blocked) {
        output[index] = 1;
        continue;
      }
      const weight = movementWeight(
        tile,
        metadata,
        map.Traffic?.[y]?.[x],
        location,
        options,
        environment
      );
      if (weight === null) {
        return null;
      }
      output[index] = weight << 1;
    }
  }

  // KD accepts the source and target independently of their map tile.
  output[start.x + start.y * map.GridWidth] = 0;
  output[goal.x + goal.y * map.GridWidth] = 0;
  return output;
}

function movementWeight(
  tile: string,
  metadata: KDMapTile | undefined,
  traffic: number | undefined,
  location: string,
  options: GridOptions,
  environment: KDPathfindingEnvironment
): number | null {
  let bonus = 0;
  if (!options.ignoreTrafficLaws) {
    if (environment.effectTagsAt(location)?.danger) {
      bonus += 30;
    } else if (tile === "V" && !metadata?.Sfty) {
      bonus = 14;
    } else if (tile === "N") {
      bonus = 30;
    } else if (tile === "D") {
      bonus = 3;
    } else if (tile === "d") {
      bonus = -2;
    } else if (tile === "g" || tile === "L") {
      bonus = 9;
    } else if (tile === "T") {
      bonus = 4;
    }
    if (metadata?.Lock) {
      bonus += 2;
    }
    if (metadata?.OL) {
      bonus += 12;
    }
    if (traffic !== undefined) {
      if (typeof traffic !== "number" || !Number.isFinite(traffic)) {
        return null;
      }
      bonus += traffic || 0;
    }
    bonus = Math.max(0, bonus);
  } else if (!options.ignoreAllWeighting) {
    if (tile === "V" && !metadata?.Sfty) {
      bonus = 3;
    } else if (tile === "N") {
      bonus = 8;
    } else if (tile === "L") {
      bonus = 2;
    }
  }

  const units = bonus * 4;
  return Number.isSafeInteger(units) && units >= 0 && units <= MAX_WEIGHT_UNITS
    ? units
    : null;
}

function validatePath(
  path: readonly Position[],
  start: Position,
  goal: Position,
  tiles: Uint8Array,
  width: number,
  diagonal: boolean
): void {
  if (
    path.length < 2 ||
    !samePosition(path[0], start) ||
    !samePosition(path.at(-1), goal)
  ) {
    throw new RangeError("Native grid path endpoints are invalid");
  }
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (previous === undefined || current === undefined) {
      throw new RangeError("Native grid path contains a missing position");
    }
    const dx = Math.abs(current.x - previous.x);
    const dy = Math.abs(current.y - previous.y);
    if (
      dx > 1 ||
      dy > 1 ||
      dx + dy === 0 ||
      (!diagonal && dx !== 0 && dy !== 0)
    ) {
      throw new RangeError("Native grid path contains a non-adjacent step");
    }
    const tile = tiles[current.x + current.y * width];
    if (tile === undefined || (tile & 1) !== 0) {
      throw new RangeError("Native grid path crosses a blocked tile");
    }
  }
}

function integerPosition(x: unknown, y: unknown): Position | null {
  return typeof x === "number" &&
    typeof y === "number" &&
    Number.isSafeInteger(x) &&
    Number.isSafeInteger(y) &&
    x >= -0x8000 &&
    x <= 0x7fff &&
    y >= -0x8000 &&
    y <= 0x7fff
    ? { x, y }
    : null;
}

function validMap(map: KDMapDataLike): boolean {
  const { Grid: grid, GridWidth: width, GridHeight: height } = map;
  return (
    typeof grid === "string" &&
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_DIMENSION &&
    height <= MAX_DIMENSION &&
    width * height <= MAX_TILES &&
    grid.length >= (height - 1) * (width + 1) + width
  );
}

function inMap(map: KDMapDataLike, position: Position): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < map.GridWidth &&
    position.y < map.GridHeight
  );
}

function samePosition(
  left: Position | undefined,
  right: Position
): boolean {
  return left?.x === right.x && left.y === right.y;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function readBinding<T>(
  lexical: () => T | undefined,
  globalName: string
): T | undefined {
  try {
    const value = lexical();
    if (value !== undefined) {
      return value;
    }
  } catch {
    // A bootstrap loaded before KD can observe an uninitialized global lexical
    // binding. The same value may later be exposed as a global property.
  }
  return (globalThis as Record<string, unknown>)[globalName] as T | undefined;
}

const browserEnvironment: KDPathfindingEnvironment = Object.freeze({
  mapData: () => readBinding(() => KDMapData, "KDMapData"),
  visionAt: (x: number, y: number) => {
    const functionValue = readBinding(
      () => KinkyDungeonVisionGet,
      "KinkyDungeonVisionGet"
    );
    return typeof functionValue === "function" ? functionValue(x, y) : undefined;
  },
  effectTagsAt: (location: string) => {
    const functionValue = readBinding(
      () => KDEffectTileTagsLoc,
      "KDEffectTileTagsLoc"
    );
    return typeof functionValue === "function"
      ? functionValue(location)
      : undefined;
  },
  playerPosition: () =>
    readBinding(() => KinkyDungeonPlayerEntity, "KinkyDungeonPlayerEntity"),
  openDoorTiles: () => readBinding(() => KDOpenDoorTiles, "KDOpenDoorTiles")
});
