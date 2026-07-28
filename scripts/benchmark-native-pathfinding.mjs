import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import vm from "node:vm";

import { createKinkyDungeonPathfindingHandler } from "../packages/bootstrap/dist/kd-adapters.js";
import { WasmBatchBridge } from "../packages/runtime/dist/bridge.js";
import initWasm, {
  HybridEngine
} from "../dist/wasm-web/kd_hybrid_core.js";

const bundlePath = process.argv[2];
const iterations = Number.parseInt(process.argv[3] ?? "1000", 10);
const pathfindingMode = process.argv[4] ?? "fast";
if (
  bundlePath === undefined ||
  !Number.isSafeInteger(iterations) ||
  iterations < 1 ||
  !["quality", "fast", "human"].includes(pathfindingMode)
) {
  throw new Error(
    "Usage: node scripts/benchmark-native-pathfinding.mjs <main.js> [iterations] [quality|fast|human]"
  );
}

const width = 61;
const height = 39;
const map = createFixtureMap(width, height);
const upstream = await loadUpstreamPathfinding(bundlePath, map);
const bridge = new WasmBatchBridge();
await bridge.initialize(
  { default: (source) => initWasm({ module_or_path: source }), HybridEngine },
  new Uint8Array(
    await readFile(new URL("../dist/wasm-web/kd_hybrid_core_bg.wasm", import.meta.url))
  )
);
const native = createKinkyDungeonPathfindingHandler(bridge, {
  mapData: () => map,
  visionAt: () => 1,
  effectTagsAt: () => undefined,
  playerPosition: () => ({ x: -1, y: -1 }),
  openDoorTiles: () => []
}, () => pathfindingMode);

const args = [
  1,
  1,
  width - 2,
  height - 2,
  false,
  false,
  true,
  ".",
  false,
  true,
  false,
  undefined,
  false,
  undefined,
  false,
  true,
  false,
  true,
  undefined
];

const parityFixtures = verifyParity(upstream, native, args, map, 100);

for (let index = 0; index < 100; index += 1) {
  upstream(...args);
  native(...args);
}

const jsSamples = sample(() => upstream(...args), iterations);
const nativeSamples = sample(() => native(...args), iterations);
const jsMilliseconds = median(jsSamples);
const nativeMilliseconds = median(nativeSamples);
const jsPath = upstream(...args);
const nativePath = native(...args);
if (!Array.isArray(jsPath) || !Array.isArray(nativePath)) {
  throw new Error("Benchmark fixture did not produce both paths");
}

console.log(
  JSON.stringify(
    {
      upstream: "KinkyDungeonFindPath extracted from supplied main.js",
      pathfindingMode,
      dimensions: { width, height },
      iterations,
      javascriptMilliseconds: round(jsMilliseconds),
      nativeMilliseconds: round(nativeMilliseconds),
      javascriptMicrosecondsPerCall: round((jsMilliseconds * 1000) / iterations),
      nativeMicrosecondsPerCall: round((nativeMilliseconds * 1000) / iterations),
      speedup: round(jsMilliseconds / nativeMilliseconds),
      javascriptPathLength: jsPath.length,
      nativePathLength: nativePath.length,
      exactRouteMatch: JSON.stringify(jsPath) === JSON.stringify(nativePath),
      parityFixtures,
      nativeBridge: bridge.stats()
    },
    null,
    2
  )
);

bridge.dispose();

function sample(callback, count) {
  const samples = [];
  for (let sampleIndex = 0; sampleIndex < 7; sampleIndex += 1) {
    const start = performance.now();
    for (let index = 0; index < count; index += 1) {
      callback();
    }
    samples.push(performance.now() - start);
  }
  return samples;
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function createFixtureMap(mapWidth, mapHeight) {
  let state = 0x5eed1234;
  const rows = [];
  for (let y = 0; y < mapHeight; y += 1) {
    let row = "";
    for (let x = 0; x < mapWidth; x += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const boundary =
        x === 0 || y === 0 || x === mapWidth - 1 || y === mapHeight - 1;
      const guaranteedRoute = x === 1 || y === mapHeight - 2;
      row += boundary || (!guaranteedRoute && state % 100 < 24) ? "#" : ".";
    }
    rows.push(row);
  }
  return {
    Grid: `${rows.join("\n")}\n`,
    GridWidth: mapWidth,
    GridHeight: mapHeight,
    Tiles: {},
    TilesMemory: {},
    Traffic: []
  };
}

async function loadUpstreamPathfinding(path, mapData) {
  const bundle = await readFile(path, "utf8");
  const findStart = bundle.indexOf("function KinkyDungeonFindPath(");
  const getStart = bundle.indexOf("\nfunction KinkyDungeonGetPath(", findStart);
  const getEnd = bundle.indexOf("\nfunction KDSetPathfindCache(", getStart);
  if (findStart < 0 || getStart < 0 || getEnd < 0) {
    throw new Error("Could not isolate upstream pathfinding functions");
  }
  const context = vm.createContext({
    console,
    KDMapData: mapData,
    KDPathCache: new Map(),
    KDPathCacheIgnoreLocks: new Map(),
    KDPathfindingCacheHits: 0,
    KDPathfindingCacheFails: 0,
    KDPFTrim: 40,
    KinkyDungeonMovableTilesSmartEnemy: ".",
    KinkyDungeonMovableTilesEnemy: ".",
    KinkyDungeonGroundTiles: ".",
    KinkyDungeonMapGet: (x, y) =>
      mapData.Grid[x + y * (mapData.GridWidth + 1)],
    KinkyDungeonTilesGet: (location) => mapData.Tiles[location],
    KDistChebyshev: (x, y) => Math.max(Math.abs(x), Math.abs(y)),
    KDistEuclideanApprox: (xSquared, ySquared) => {
      const dx = Math.abs(xSquared);
      const dy = Math.abs(ySquared);
      return dx + dy - Math.min(dx, dy) / 2;
    }
  });
  vm.runInContext(
    `${bundle.slice(findStart, getStart)}\n${bundle.slice(getStart + 1, getEnd)}`,
    context
  );
  const pathfinding = vm.runInContext("KinkyDungeonFindPath", context);
  if (typeof pathfinding !== "function") {
    throw new TypeError("Upstream pathfinding extraction failed");
  }
  return (...args) => Reflect.apply(pathfinding, context, args);
}

function verifyParity(upstreamPath, nativePath, baseArgs, mapData, count) {
  const walkable = [];
  for (let y = 0; y < mapData.GridHeight; y += 1) {
    for (let x = 0; x < mapData.GridWidth; x += 1) {
      if (mapData.Grid[x + y * (mapData.GridWidth + 1)] === ".") {
        walkable.push({ x, y });
      }
    }
  }
  let checked = 0;
  let exactMatches = 0;
  let lengthMatches = 0;
  let reachabilityMismatches = 0;
  let invalidJavaScriptPaths = 0;
  let invalidNativePaths = 0;
  for (let index = 0; index < count; index += 1) {
    const start = walkable[(index * 37 + 3) % walkable.length];
    const goal = walkable[(index * 83 + 19) % walkable.length];
    if (start === undefined || goal === undefined || start === goal) {
      continue;
    }
    const fixtureArgs = [...baseArgs];
    fixtureArgs[0] = start.x;
    fixtureArgs[1] = start.y;
    fixtureArgs[2] = goal.x;
    fixtureArgs[3] = goal.y;
    const expected = upstreamPath(...fixtureArgs);
    const actual = nativePath(...fixtureArgs);
    const expectedReachable = Array.isArray(expected);
    const actualReachable = Array.isArray(actual);
    if (expectedReachable !== actualReachable) {
      reachabilityMismatches += 1;
    }
    if (
      expectedReachable &&
      !isValidPath(expected, start, goal, mapData, !Boolean(fixtureArgs[14]))
    ) {
      invalidJavaScriptPaths += 1;
    }
    if (
      actualReachable &&
      !isValidPath(actual, start, goal, mapData, !Boolean(fixtureArgs[14]))
    ) {
      invalidNativePaths += 1;
    }
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
      exactMatches += 1;
    }
    if (
      expectedReachable &&
      actualReachable &&
      expected.length === actual.length
    ) {
      lengthMatches += 1;
    }
    checked += 1;
  }
  const result = {
    requested: count,
    checked,
    exactMatches,
    lengthMatches,
    reachabilityMismatches,
    invalidJavaScriptPaths,
    invalidNativePaths
  };
  if (
    reachabilityMismatches !== 0 ||
    invalidJavaScriptPaths !== 0 ||
    invalidNativePaths !== 0
  ) {
    throw new Error(`Path compatibility failed: ${JSON.stringify(result)}`);
  }
  return result;
}

function isValidPath(path, start, goal, mapData, diagonal) {
  if (!Array.isArray(path)) {
    return false;
  }
  if (path.length === 0) {
    return start.x === goal.x && start.y === goal.y;
  }
  let previous = start;
  for (const position of path) {
    if (
      position === null ||
      !Number.isInteger(position.x) ||
      !Number.isInteger(position.y)
    ) {
      return false;
    }
    const dx = Math.abs(position.x - previous.x);
    const dy = Math.abs(position.y - previous.y);
    if (
      (dx === 0 && dy === 0) ||
      dx > 1 ||
      dy > 1 ||
      (!diagonal && dx !== 0 && dy !== 0)
    ) {
      return false;
    }
    const tile =
      mapData.Grid[position.x + position.y * (mapData.GridWidth + 1)];
    if (tile !== "." && (position.x !== goal.x || position.y !== goal.y)) {
      return false;
    }
    previous = position;
  }
  return previous.x === goal.x && previous.y === goal.y;
}
