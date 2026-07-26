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
declare const KinkyDungeonMovableTilesSmartEnemy: string | undefined;
declare const KinkyDungeonMovableTilesEnemy: string | undefined;
declare const KinkyDungeonGroundTiles: string | undefined;
declare let KDPathCache: KDPathCacheLike | undefined;
declare let KDPathCacheIgnoreLocks: KDPathCacheLike | undefined;
declare let KDPathfindingCacheHits: number | undefined;
declare let KDPathfindingCacheFails: number | undefined;

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

export interface KDPathCacheLike {
  readonly size: number;
  has(key: string): boolean;
  get(key: string): readonly Position[] | undefined;
  set(key: string, path: readonly Position[]): unknown;
  delete(key: string): boolean;
}

export interface KDPathfindingEnvironment {
  mapData(): KDMapDataLike | undefined;
  visionAt(x: number, y: number): number | undefined;
  effectTagsAt(location: string): EffectTileTags | undefined;
  playerPosition(): Position | undefined;
  openDoorTiles(): readonly unknown[] | undefined;
  pathCache?(ignoreLocks: boolean): KDPathCacheLike | undefined;
  tileShort?(movableTiles: string): string;
  recordCacheHit?(): void;
  recordCacheFill?(): void;
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
  const cacheStates = new WeakMap<object, CacheState>();
  let loadedGrid: LoadedGrid | null = null;

  return (...args: unknown[]): AdapterResult => {
    const startX = integerCoordinate(args[0]);
    const startY = integerCoordinate(args[1]);
    const goalX = integerCoordinate(args[2]);
    const goalY = integerCoordinate(args[3]);
    const movableTiles = args[7];
    if (
      startX === null ||
      startY === null ||
      goalX === null ||
      goalY === null ||
      typeof movableTiles !== "string"
    ) {
      return useJavaScriptFallback();
    }

    const blockEnemy = Boolean(args[4]);
    const blockPlayer = Boolean(args[5]);
    const ignoreLocks = Boolean(args[6]);
    const requireLight = Boolean(args[8]);
    const noDoors = Boolean(args[9]);
    const needDoorMemory = Boolean(args[10]);
    const cacheEligible =
      !blockEnemy &&
      !blockPlayer &&
      !requireLight &&
      !noDoors &&
      !needDoorMemory;
    const tileShort = environment.tileShort?.(movableTiles) ?? movableTiles;
    const pathCache = cacheEligible
      ? environment.pathCache?.(ignoreLocks)
      : undefined;
    const cacheKey = `${startX},${startY},${goalX},${goalY},${tileShort}`;
    const cached = pathCache?.get(cacheKey);
    if (cached !== undefined) {
      environment.recordCacheHit?.();
      const first = cached[0];
      if (
        first !== undefined &&
        Math.max(
          Math.abs(first.x - startX),
          Math.abs(first.y - startY)
        ) < 1.5
      ) {
        return cached.slice();
      }
      pathCache?.delete(cacheKey);
    }

    // The upstream function returns the target directly for the same or an
    // adjacent square, before performing a graph search.
    if (
      Math.max(Math.abs(startX - goalX), Math.abs(startY - goalY)) <= 1
    ) {
      return [{ x: goalX, y: goalY }];
    }

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

    const cacheEpoch =
      pathCache === undefined
        ? -1
        : observeCache(cacheStates, pathCache);
    const start = { x: startX, y: startY };
    const goal = { x: goalX, y: goalY };
    const map = environment.mapData();
    if (map === undefined || !validMap(map) || !inMap(map, start) || !inMap(map, goal)) {
      return useJavaScriptFallback();
    }

    const gridOptions = {
      blockPlayer,
      ignoreLocks,
      requireLight,
      noDoors,
      needDoorMemory,
      ignoreTrafficLaws: Boolean(args[15]),
      ignoreAllWeighting: Boolean(args[17])
    };
    const canReuseGrid = pathCache !== undefined;
    const unreachableKey = `${cacheKey},${Number(Boolean(args[14]))}`;
    let tiles: Uint8Array;
    if (
      canReuseGrid &&
      loadedGrid !== null &&
      sameLoadedGrid(
        loadedGrid,
        map,
        movableTiles,
        gridOptions,
        pathCache,
        cacheEpoch
      )
    ) {
      tiles = loadedGrid.tiles;
      if (loadedGrid.unreachableKeys.has(unreachableKey)) {
        return undefined;
      }
    } else {
      const encoded = encodeKinkyDungeonGrid(
        map,
        movableTiles,
        gridOptions,
        environment
      );
      if (encoded === null) {
        return useJavaScriptFallback();
      }
      tiles = encoded;
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
      loadedGrid = canReuseGrid
        ? {
            map,
            grid: map.Grid,
            mapTiles: map.Tiles,
            traffic: map.Traffic,
            movableTiles,
            options: gridOptions,
            cache: pathCache,
            cacheEpoch,
            tiles,
            unreachableKeys: new Set()
          }
        : null;
    }

    if (
      pathCache !== undefined &&
      hasIndexedCachePath(cacheStates, pathCache, goal, tileShort)
    ) {
      // KD's official search can splice an existing suffix from any expanded
      // node. That partial-cache path is faster than serializing the whole
      // frontier into WASM, so preserve it as a one-call hybrid fallback.
      return useJavaScriptFallback();
    }
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
      if (
        response.status === "unreachable" &&
        canReuseGrid &&
        loadedGrid !== null
      ) {
        loadedGrid.unreachableKeys.add(unreachableKey);
      }
      return undefined;
    }
    validatePath(response.positions, start, goal, tiles, map.GridWidth, !Boolean(args[14]));
    const result = response.positions
      .slice(1)
      .map(({ x, y }) => ({ x, y }));
    if (pathCache !== undefined && !pathCache.has(cacheKey)) {
      setPathCache(pathCache, result, goal, tileShort, cacheKey);
      indexCachedPath(
        cacheStates,
        pathCache,
        start,
        result,
        goal,
        tileShort
      );
      synchronizeCache(cacheStates, pathCache);
    }
    environment.recordCacheFill?.();
    return result;
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

interface CacheState {
  size: number;
  epoch: number;
  readonly indexedPaths: Map<string, Map<string, Position>>;
}

interface LoadedGrid {
  readonly map: KDMapDataLike;
  readonly grid: string;
  readonly mapTiles: KDMapDataLike["Tiles"];
  readonly traffic: KDMapDataLike["Traffic"];
  readonly movableTiles: string;
  readonly options: GridOptions;
  readonly cache: KDPathCacheLike;
  readonly cacheEpoch: number;
  readonly tiles: Uint8Array;
  readonly unreachableKeys: Set<string>;
}

function encodeKinkyDungeonGrid(
  map: KDMapDataLike,
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
  return output;
}

function observeCache(
  states: WeakMap<object, CacheState>,
  cache: KDPathCacheLike
): number {
  const key = cache as object;
  const current = states.get(key);
  if (current === undefined) {
    states.set(key, {
      size: cache.size,
      epoch: 0,
      indexedPaths: new Map()
    });
    return 0;
  }
  if (cache.size < current.size) {
    current.epoch += 1;
    current.indexedPaths.clear();
  }
  current.size = cache.size;
  return current.epoch;
}

function synchronizeCache(
  states: WeakMap<object, CacheState>,
  cache: KDPathCacheLike
): void {
  const current = states.get(cache as object);
  if (current === undefined) {
    states.set(cache as object, {
      size: cache.size,
      epoch: 0,
      indexedPaths: new Map()
    });
  } else {
    current.size = cache.size;
  }
}

function hasIndexedCachePath(
  states: WeakMap<object, CacheState>,
  cache: KDPathCacheLike,
  goal: Position,
  tileShort: string
): boolean {
  const state = states.get(cache as object);
  if (state === undefined) {
    return false;
  }
  return (
    (state.indexedPaths.get(cacheGroupKey(goal, tileShort))?.size ?? 0) > 0
  );
}

function indexCachedPath(
  states: WeakMap<object, CacheState>,
  cache: KDPathCacheLike,
  start: Position,
  path: readonly Position[],
  goal: Position,
  tileShort: string
): void {
  const state = states.get(cache as object);
  if (state === undefined) {
    return;
  }
  const groupKey = cacheGroupKey(goal, tileShort);
  let indexed = state.indexedPaths.get(groupKey);
  if (indexed === undefined) {
    indexed = new Map();
    state.indexedPaths.set(groupKey, indexed);
  }
  for (const position of [start, ...path.slice(0, -1)]) {
    indexed.set(`${position.x},${position.y}`, position);
  }
}

function cacheGroupKey(goal: Position, tileShort: string): string {
  return `${goal.x},${goal.y},${tileShort}`;
}

function sameLoadedGrid(
  loaded: LoadedGrid,
  map: KDMapDataLike,
  movableTiles: string,
  options: GridOptions,
  cache: KDPathCacheLike,
  cacheEpoch: number
): boolean {
  return (
    loaded.map === map &&
    loaded.grid === map.Grid &&
    loaded.mapTiles === map.Tiles &&
    loaded.traffic === map.Traffic &&
    loaded.movableTiles === movableTiles &&
    loaded.cache === cache &&
    loaded.cacheEpoch === cacheEpoch &&
    sameGridOptions(loaded.options, options)
  );
}

function sameGridOptions(left: GridOptions, right: GridOptions): boolean {
  return (
    left.blockPlayer === right.blockPlayer &&
    left.ignoreLocks === right.ignoreLocks &&
    left.requireLight === right.requireLight &&
    left.noDoors === right.noDoors &&
    left.needDoorMemory === right.needDoorMemory &&
    left.ignoreTrafficLaws === right.ignoreTrafficLaws &&
    left.ignoreAllWeighting === right.ignoreAllWeighting
  );
}

function setPathCache(
  cache: KDPathCacheLike,
  path: readonly Position[],
  goal: Position,
  tileShort: string,
  finalKey: string
): void {
  for (let index = 0; index < path.length - 1; index += 1) {
    const suffix = path.slice(index);
    const first = suffix[0];
    if (first !== undefined) {
      cache.set(
        `${first.x},${first.y},${goal.x},${goal.y},${tileShort}`,
        suffix.slice(1)
      );
    }
  }
  cache.set(finalKey, path.slice());
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
    if (
      tile === undefined ||
      ((tile & 1) !== 0 && !samePosition(current, goal))
    ) {
      throw new RangeError("Native grid path crosses a blocked tile");
    }
  }
}

function integerCoordinate(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= -0x8000 &&
    value <= 0x7fff
    ? value
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

let browserTileAliases:
  | {
      readonly smartEnemy: string | undefined;
      readonly enemy: string | undefined;
      readonly ground: string | undefined;
    }
  | undefined;

function browserTileShort(movableTiles: string): string {
  browserTileAliases ??= {
    smartEnemy: readBinding(
      () => KinkyDungeonMovableTilesSmartEnemy,
      "KinkyDungeonMovableTilesSmartEnemy"
    ),
    enemy: readBinding(
      () => KinkyDungeonMovableTilesEnemy,
      "KinkyDungeonMovableTilesEnemy"
    ),
    ground: readBinding(
      () => KinkyDungeonGroundTiles,
      "KinkyDungeonGroundTiles"
    )
  };
  if (movableTiles === browserTileAliases.smartEnemy) {
    return "TSE";
  }
  if (movableTiles === browserTileAliases.enemy) {
    return "TE";
  }
  if (movableTiles === browserTileAliases.ground) {
    return "TG";
  }
  return movableTiles;
}

function browserPathCache(ignoreLocks: boolean): KDPathCacheLike | undefined {
  try {
    const cache = ignoreLocks ? KDPathCacheIgnoreLocks : KDPathCache;
    if (cache !== undefined) {
      return cache;
    }
  } catch {
    // Fall through for loaders that expose KD state as global properties.
  }
  return (globalThis as Record<string, unknown>)[
    ignoreLocks ? "KDPathCacheIgnoreLocks" : "KDPathCache"
  ] as KDPathCacheLike | undefined;
}

function browserRecordCacheHit(): void {
  try {
    if (typeof KDPathfindingCacheHits === "number") {
      KDPathfindingCacheHits += 1;
      return;
    }
  } catch {
    // Fall through for loaders that expose KD state as global properties.
  }
  incrementGlobalNumber("KDPathfindingCacheHits");
}

function browserRecordCacheFill(): void {
  try {
    if (typeof KDPathfindingCacheFails === "number") {
      KDPathfindingCacheFails += 1;
      return;
    }
  } catch {
    // Fall through for loaders that expose KD state as global properties.
  }
  incrementGlobalNumber("KDPathfindingCacheFails");
}

function incrementGlobalNumber(globalName: string): void {
  const target = globalThis as Record<string, unknown>;
  const value = target[globalName];
  if (typeof value === "number") {
    target[globalName] = value + 1;
  }
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
  openDoorTiles: () => readBinding(() => KDOpenDoorTiles, "KDOpenDoorTiles"),
  pathCache: browserPathCache,
  tileShort: browserTileShort,
  recordCacheHit: browserRecordCacheHit,
  recordCacheFill: browserRecordCacheFill
});
