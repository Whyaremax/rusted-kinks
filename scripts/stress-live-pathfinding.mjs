import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "9223" },
    enemies: { type: "string", default: "120" },
    output: {
      type: "string",
      default: "artifacts/pathfinding-stress-latest.json",
    },
  },
});

const port = parseInteger("port", values.port, 1, 65_535);
const enemyCount = parseInteger("enemies", values.enemies, 1, 1_000);
const outputPath = path.resolve(values.output);
const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
const gameTarget = targets.find(
  (target) =>
    target.type === "page" &&
    typeof target.url === "string" &&
    target.url.includes("/resources/app/index.html?test=kd-hybrid"),
);

if (gameTarget?.webSocketDebuggerUrl === undefined) {
  throw new Error(
    `No isolated KD developer page found on localhost:${port}. ` +
      "Launch the test executable with --remote-debugging-port first.",
  );
}

const expression = `(${runRendererStress.toString()})(${enemyCount})`;
const report = await evaluate(
  gameTarget.webSocketDebuggerUrl,
  expression,
  10 * 60_000,
);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`Report: ${outputPath}\n`);

if (!report.passed) {
  process.exitCode = 1;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

function parseInteger(name, value, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new RangeError(
      `${name} must be an integer within ${minimum}..${maximum}`,
    );
  }
  return parsed;
}

async function evaluate(webSocketUrl, expression, timeoutMs) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out connecting to the KD renderer")),
      15_000,
    );
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("Failed to connect to the KD renderer"));
      },
      { once: true },
    );
  });

  try {
    const response = await new Promise((resolve, reject) => {
      const requestId = 1;
      const timer = setTimeout(
        () => reject(new Error("KD renderer stress test timed out")),
        timeoutMs,
      );
      socket.addEventListener("message", async (event) => {
        const text =
          typeof event.data === "string" ? event.data : await event.data.text();
        const message = JSON.parse(text);
        if (message.id !== requestId) {
          return;
        }
        clearTimeout(timer);
        resolve(message);
      });
      socket.send(
        JSON.stringify({
          id: requestId,
          method: "Runtime.evaluate",
          params: {
            expression,
            awaitPromise: true,
            returnByValue: true,
            userGesture: true,
            timeout: timeoutMs,
          },
        }),
      );
    });

    if (response.error !== undefined) {
      throw new Error(
        `CDP evaluation failed: ${JSON.stringify(response.error)}`,
      );
    }
    if (response.result?.exceptionDetails !== undefined) {
      const details = response.result.exceptionDetails;
      const description =
        details.exception?.description ??
        details.text ??
        "unknown renderer error";
      throw new Error(description);
    }
    return response.result?.result?.value;
  } finally {
    socket.close();
  }
}

async function runRendererStress(requestedEnemies) {
  "use strict";

  const waitFor = async (predicate, timeoutMs, label) => {
    const deadline = performance.now() + timeoutMs;
    while (!predicate()) {
      if (performance.now() >= deadline) {
        throw new Error(`Timed out waiting for ${label}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };
  const statusCopy = () => ({ ...KDHybrid.systemStatus("pathfinding") });
  const statusDelta = (before, after) => ({
    calls: after.calls - before.calls,
    nativeCalls: after.nativeCalls - before.nativeCalls,
    fallbackCalls: after.fallbackCalls - before.fallbackCalls,
    failures: after.failures - before.failures,
  });
  const bridgeStatsCopy = () => {
    const bridge = JSON.parse(KDHybrid.exportDiagnostics()).bridge;
    return {
      calls: bridge.calls,
      failures: bridge.failures,
      inputBytes: bridge.inputBytes,
      outputBytes: bridge.outputBytes,
    };
  };
  const bridgeStatsDelta = (before, after) => ({
    calls: after.calls - before.calls,
    failures: after.failures - before.failures,
    inputBytes: after.inputBytes - before.inputBytes,
    outputBytes: after.outputBytes - before.outputBytes,
  });
  const clearPathCaches = () => {
    KDPathCache.clear();
    KDPathCacheIgnoreLocks.clear();
  };
  const copyPath = (value) =>
    value === undefined ? null : value.map(({ x, y }) => ({ x, y }));
  const samePath = (left, right) =>
    JSON.stringify(left) === JSON.stringify(right);
  const sameReachability = (left, right) =>
    (left === null) === (right === null);
  const pathIsValid = (result, args) => {
    if (result === null) {
      return true;
    }
    if (!Array.isArray(result) || result.length === 0) {
      return false;
    }
    let previous = { x: args[0], y: args[1] };
    for (const position of result) {
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
        dx > 1 ||
        dy > 1 ||
        dx + dy === 0 ||
        (args[14] && dx !== 0 && dy !== 0)
      ) {
        return false;
      }
      previous = position;
    }
    const final = result.at(-1);
    return final.x === args[2] && final.y === args[3];
  };
  const invoke = (args) => copyPath(KinkyDungeonFindPath(...args));
  const timingBatches = 10;
  const timeBatch = (
    queries,
    cachePolicy,
    captureResults,
    batches = timingBatches,
  ) => {
    if (cachePolicy === "start") {
      clearPathCaches();
    }
    const before = statusCopy();
    const bridgeBefore = bridgeStatsCopy();
    const heapBefore = performance.memory?.usedJSHeapSize ?? null;
    const started = performance.now();
    const results = captureResults ? [] : null;
    for (let batch = 0; batch < batches; batch += 1) {
      if (cachePolicy === "each-batch") {
        clearPathCaches();
      }
      for (const query of queries) {
        if (cachePolicy === "each-call") {
          clearPathCaches();
        }
        const value = KinkyDungeonFindPath(...query.args);
        if (results !== null && batch === 0) {
          results.push(copyPath(value));
        }
      }
    }
    const elapsedMs = performance.now() - started;
    const heapAfter = performance.memory?.usedJSHeapSize ?? null;
    const after = statusCopy();
    const bridgeAfter = bridgeStatsCopy();
    return {
      elapsedMs,
      elapsedMsPerBatch: elapsedMs / batches,
      millisecondsPerQuery: elapsedMs / (queries.length * batches),
      batches,
      enemiesPerBatch: queries.length,
      queries: queries.length * batches,
      queriesPerSecond:
        elapsedMs > 0 ? (queries.length * batches * 1_000) / elapsedMs : null,
      heapDeltaBytes:
        heapBefore === null || heapAfter === null
          ? null
          : heapAfter - heapBefore,
      before,
      after,
      delta: statusDelta(before, after),
      bridgeBefore,
      bridgeAfter,
      bridgeDelta: bridgeStatsDelta(bridgeBefore, bridgeAfter),
      results,
    };
  };
  const ratio = (before, after) =>
    after.millisecondsPerQuery > 0
      ? Math.round(
          (before.millisecondsPerQuery / after.millisecondsPerQuery) * 1_000,
        ) / 1_000
      : null;

  await waitFor(
    () =>
      globalThis.KDHybrid !== undefined &&
      KDHybrid.status().initialized &&
      typeof globalThis.KinkyDungeonFindPath === "function",
    20_000,
    "KD Hybrid and KinkyDungeonFindPath",
  );

  KDSetWorldSlot(0, 1, 0, 0);
  MiniGameKinkyDungeonCheckpoint = "grv";
  KinkyDungeonInitialize(1);
  KDInitPerks();
  MiniGameKinkyDungeonCheckpoint = "grv";
  KinkyDungeonCreateMap(
    KinkyDungeonMapParams[
      KinkyDungeonMapIndex[MiniGameKinkyDungeonCheckpoint] ||
        MiniGameKinkyDungeonCheckpoint
    ],
    "",
    "",
    1,
    true,
  );
  KinkyDungeonState = "Game";
  await waitFor(
    () =>
      KDMapData?.GridWidth > 0 &&
      KDMapData?.GridHeight > 0 &&
      KinkyDungeonPlayerEntity !== undefined,
    10_000,
    "a generated KD map",
  );

  if (!KDHybrid.enableSystem("pathfinding")) {
    throw new Error("The pathfinding system could not enter native mode");
  }
  const initialRuntime = KDHybrid.status();
  const initialPathfinding = statusCopy();
  if (initialPathfinding.mode !== "native") {
    throw new Error(
      `Expected native pathfinding, found ${initialPathfinding.mode}: ` +
        `${initialPathfinding.reason ?? "no reason"}`,
    );
  }

  const player = {
    x: KinkyDungeonPlayerEntity.x,
    y: KinkyDungeonPlayerEntity.y,
  };
  const pointCandidates = [];
  for (let y = 1; y < KDMapData.GridHeight - 1; y += 1) {
    for (let x = 1; x < KDMapData.GridWidth - 1; x += 1) {
      if (
        Math.max(Math.abs(x - player.x), Math.abs(y - player.y)) > 2 &&
        KinkyDungeonMovableTilesEnemy.includes(KinkyDungeonMapGet(x, y)) &&
        !KinkyDungeonEntityAt(x, y)
      ) {
        pointCandidates.push({ x, y });
      }
    }
  }
  pointCandidates.sort((left, right) => {
    const leftHash = ((left.x * 73_856_093) ^ (left.y * 19_349_663)) >>> 0;
    const rightHash = ((right.x * 73_856_093) ^ (right.y * 19_349_663)) >>> 0;
    return leftHash - rightHash || left.y - right.y || left.x - right.x;
  });
  if (pointCandidates.length < requestedEnemies) {
    const tileCounts = {};
    for (let y = 0; y < KDMapData.GridHeight; y += 1) {
      for (let x = 0; x < KDMapData.GridWidth; x += 1) {
        const tile = KinkyDungeonMapGet(x, y);
        tileCounts[tile] = (tileCounts[tile] ?? 0) + 1;
      }
    }
    throw new Error(
      `Generated map has only ${pointCandidates.length} free enemy tiles; ` +
        `${requestedEnemies} were requested. ` +
        JSON.stringify({
          width: KDMapData.GridWidth,
          height: KDMapData.GridHeight,
          player,
          movableTilesType: typeof KinkyDungeonMovableTilesEnemy,
          movableTiles: String(KinkyDungeonMovableTilesEnemy),
          entities: KDMapData.Entities.length,
          tileCounts,
        }),
    );
  }

  const spawned = [];
  for (const point of pointCandidates.slice(0, requestedEnemies)) {
    const enemy = DialogueCreateEnemy(point.x, point.y, "Maidforce");
    if (!enemy) {
      throw new Error(`Failed to create stress enemy at ${point.x},${point.y}`);
    }
    enemy.kdHybridStress = true;
    enemy.aware = true;
    enemy.hostile = 9_999;
    KDRunCreationScript(enemy, KDGetCurrentLocation());
    spawned.push(enemy);
  }
  const actualStressEnemies = KDMapData.Entities.filter(
    (entity) => entity.kdHybridStress,
  ).length;
  if (actualStressEnemies !== requestedEnemies) {
    throw new Error(
      `Expected ${requestedEnemies} stress enemies, found ${actualStressEnemies}`,
    );
  }

  const queries = spawned.map((enemy) => ({
    enemyId: enemy.id,
    args: [
      enemy.x,
      enemy.y,
      player.x,
      player.y,
      false,
      false,
      false,
      KinkyDungeonMovableTilesEnemy,
      false,
      false,
      false,
      undefined,
      false,
      undefined,
      false,
      false,
      false,
      false,
      undefined,
    ],
  }));

  KDHybrid.disableSystem("pathfinding", "stress-js-baseline");
  const jsUncached = timeBatch(queries, "each-call", true);
  const jsCacheCold = timeBatch(queries, "each-batch", true);
  const jsCacheWarm = timeBatch(queries, "none", false, timingBatches * 10);

  if (!KDHybrid.enableSystem("pathfinding")) {
    throw new Error("Could not restore native mode after JavaScript baseline");
  }
  KDHybrid.setPathfindingMode("fast");
  const nativeUncached = timeBatch(queries, "each-call", true);
  const nativeCacheCold = timeBatch(queries, "each-batch", true);
  const nativeCacheWarm = timeBatch(queries, "none", false, timingBatches * 10);

  const parity = {
    compared: queries.length,
    exactMatches: 0,
    lengthMatches: 0,
    reachabilityMismatches: 0,
    invalidJavaScriptPaths: 0,
    invalidNativePaths: 0,
  };
  for (let index = 0; index < queries.length; index += 1) {
    const query = queries[index];
    const jsPath = jsUncached.results[index];
    const nativePath = nativeUncached.results[index];
    if (samePath(jsPath, nativePath)) {
      parity.exactMatches += 1;
    }
    if (
      jsPath !== null &&
      nativePath !== null &&
      jsPath.length === nativePath.length
    ) {
      parity.lengthMatches += 1;
    }
    if (!sameReachability(jsPath, nativePath)) {
      parity.reachabilityMismatches += 1;
    }
    if (!pathIsValid(jsPath, query.args)) {
      parity.invalidJavaScriptPaths += 1;
    }
    if (!pathIsValid(nativePath, query.args)) {
      parity.invalidNativePaths += 1;
    }
  }
  const cachedParity = {
    compared: queries.length,
    exactMatches: 0,
    lengthMatches: 0,
    reachabilityMismatches: 0,
    invalidJavaScriptPaths: 0,
    invalidNativePaths: 0,
  };
  for (let index = 0; index < queries.length; index += 1) {
    const query = queries[index];
    const jsPath = jsCacheCold.results[index];
    const nativePath = nativeCacheCold.results[index];
    if (samePath(jsPath, nativePath)) {
      cachedParity.exactMatches += 1;
    }
    if (
      jsPath !== null &&
      nativePath !== null &&
      jsPath.length === nativePath.length
    ) {
      cachedParity.lengthMatches += 1;
    }
    if (!sameReachability(jsPath, nativePath)) {
      cachedParity.reachabilityMismatches += 1;
    }
    if (!pathIsValid(jsPath, query.args)) {
      cachedParity.invalidJavaScriptPaths += 1;
    }
    if (!pathIsValid(nativePath, query.args)) {
      cachedParity.invalidNativePaths += 1;
    }
  }

  const plannerModes = {
    fast: {
      uncached: nativeUncached,
      cacheCold: nativeCacheCold,
      cacheWarm: nativeCacheWarm,
      parity,
      cachedParity,
    },
  };
  for (const mode of ["quality", "human"]) {
    KDHybrid.setPathfindingMode(mode);
    const uncached = timeBatch(queries, "each-call", true);
    const cacheCold = timeBatch(queries, "each-batch", true);
    const cacheWarm = timeBatch(queries, "none", false, timingBatches * 10);
    plannerModes[mode] = {
      uncached,
      cacheCold,
      cacheWarm,
      parity: comparePaths(jsUncached.results, uncached.results),
      cachedParity: comparePaths(jsCacheCold.results, cacheCold.results),
    };
  }
  KDHybrid.setPathfindingMode("fast");

  const firstReachableIndex = jsUncached.results.findIndex(
    (result) => result !== null && result.length > 1,
  );
  if (firstReachableIndex < 0) {
    throw new Error(
      "No reachable stress query was available for compatibility tests",
    );
  }
  const baseArgs = [...queries[firstReachableIndex].args];
  const sampleEnemy = spawned[firstReachableIndex];
  const hoistedCacheIndexSourceAvailable =
    globalThis.KDHybridSourcePatches?.pathfindingHoistedCacheIndex !==
    undefined;
  const pathCacheHoistedKeySuffixSourceAvailable =
    globalThis.KDHybridSourcePatches?.pathCacheHoistedKeySuffix !== undefined;
  const argumentCases = [
    { name: "baseline", expected: "native", change: () => undefined },
    {
      name: "boxedEndX",
      expected: "fallback",
      sourceGuard: hoistedCacheIndexSourceAvailable
        ? "pathfindingHoistedCacheIndex"
        : null,
      change: (args) => {
        args[2] = new Number(args[2]);
      },
    },
    {
      name: "blockEnemy",
      expected: "fallback",
      change: (args) => {
        args[4] = true;
      },
    },
    {
      name: "blockPlayer",
      expected: "native",
      change: (args) => {
        args[5] = true;
      },
    },
    {
      name: "ignoreLocks",
      expected: "native",
      change: (args) => {
        args[6] = true;
      },
    },
    {
      name: "alternateTiles",
      expected: "native",
      change: (args) => {
        args[7] = KinkyDungeonGroundTiles;
      },
    },
    {
      name: "requireLight",
      // A freshly generated map may not have a populated vision grid yet.
      // In that state the adapter must preserve KD behavior through one-call
      // fallback; after a rendered turn it may be able to use native mode.
      expected: "native-or-fallback",
      change: (args) => {
        args[8] = true;
      },
    },
    {
      name: "noDoors",
      expected: "native",
      change: (args) => {
        args[9] = true;
      },
    },
    {
      name: "needDoorMemory",
      expected: "native",
      change: (args) => {
        args[10] = true;
      },
    },
    {
      name: "enemyObject",
      expected: "fallback",
      change: (args) => {
        args[11] = sampleEnemy;
      },
    },
    {
      name: "trimLongDistance",
      expected: "fallback",
      change: (args) => {
        args[12] = true;
      },
    },
    {
      name: "heuristicOverride",
      expected: "fallback",
      change: (args) => {
        args[13] = (x, y, endX, endY) =>
          Math.abs(x - endX) + Math.abs(y - endY);
      },
    },
    {
      name: "taxicab",
      expected: "native",
      change: (args) => {
        args[14] = true;
      },
    },
    {
      name: "ignoreTrafficLaws",
      expected: "native",
      change: (args) => {
        args[15] = true;
      },
    },
    {
      name: "allowPassable",
      expected: "fallback",
      change: (args) => {
        args[16] = true;
      },
    },
    {
      name: "ignoreAllWeighting",
      expected: "native",
      change: (args) => {
        args[15] = true;
        args[17] = true;
      },
    },
    {
      name: "leashTarget",
      expected: "fallback",
      change: (args) => {
        args[18] = sampleEnemy.id;
      },
    },
  ];
  const argumentCompatibility = [];
  for (const testCase of argumentCases) {
    const args = [...baseArgs];
    testCase.change(args);
    const validationArgs = [...args];
    if (testCase.sourceGuard === "pathfindingHoistedCacheIndex") {
      validationArgs[2] = Number(validationArgs[2]);
    }
    KDHybrid.disableSystem("pathfinding", "argument-parity-baseline");
    clearPathCaches();
    const jsResult = invoke(args);
    if (!KDHybrid.enableSystem("pathfinding")) {
      throw new Error(`Could not enable native mode for ${testCase.name}`);
    }
    clearPathCaches();
    const before = statusCopy();
    let adaptedResult;
    let sourceGuardStats = null;
    let sourceGuardRestore = null;
    if (testCase.sourceGuard === "pathfindingHoistedCacheIndex") {
      const sourceControl = (globalThis.KDHybridSourcePatchControl =
        globalThis.KDHybridSourcePatchControl || {});
      const hadDisable = Object.prototype.hasOwnProperty.call(
        sourceControl,
        "disablePathfindingHoistedCacheIndex",
      );
      const previousDisable = sourceControl.disablePathfindingHoistedCacheIndex;
      const hadStats = Object.prototype.hasOwnProperty.call(
        sourceControl,
        "pathfindingHoistedCacheIndexStats",
      );
      const previousStats = sourceControl.pathfindingHoistedCacheIndexStats;
      sourceControl.disablePathfindingHoistedCacheIndex = false;
      sourceControl.pathfindingHoistedCacheIndexStats = {
        calls: 0,
        optimizedCalls: 0,
        fallbackCalls: 0,
      };
      sourceGuardRestore = () => {
        if (hadDisable) {
          sourceControl.disablePathfindingHoistedCacheIndex = previousDisable;
        } else {
          delete sourceControl.disablePathfindingHoistedCacheIndex;
        }
        if (hadStats) {
          sourceControl.pathfindingHoistedCacheIndexStats = previousStats;
        } else {
          delete sourceControl.pathfindingHoistedCacheIndexStats;
        }
      };
    }
    try {
      adaptedResult = invoke(args);
      if (testCase.sourceGuard === "pathfindingHoistedCacheIndex") {
        sourceGuardStats = {
          ...globalThis.KDHybridSourcePatchControl
            .pathfindingHoistedCacheIndexStats,
        };
      }
    } finally {
      sourceGuardRestore?.();
    }
    const after = statusCopy();
    const delta = statusDelta(before, after);
    const route =
      delta.nativeCalls === 1
        ? "native"
        : delta.fallbackCalls === 1
          ? "fallback"
          : "unknown";
    const jsValidationResult =
      testCase.sourceGuard === "pathfindingHoistedCacheIndex" &&
      Array.isArray(jsResult)
        ? jsResult.map((point) => ({ x: Number(point.x), y: Number(point.y) }))
        : jsResult;
    const adaptedValidationResult =
      testCase.sourceGuard === "pathfindingHoistedCacheIndex" &&
      Array.isArray(adaptedResult)
        ? adaptedResult.map((point) => ({
            x: Number(point.x),
            y: Number(point.y),
          }))
        : adaptedResult;
    argumentCompatibility.push({
      name: testCase.name,
      expectedRoute: testCase.expected,
      actualRoute: route,
      exact: samePath(jsResult, adaptedResult),
      reachabilityEqual: sameReachability(jsResult, adaptedResult),
      jsValid: pathIsValid(jsValidationResult, validationArgs),
      adaptedValid: pathIsValid(adaptedValidationResult, validationArgs),
      sourceGuard: testCase.sourceGuard ?? null,
      sourceGuardStats,
      delta,
    });
  }

  const pathCacheHoistedKeySuffixCompatibility = {
    available:
      pathCacheHoistedKeySuffixSourceAvailable &&
      typeof globalThis.KDSetPathfindCache === "function",
    primitive: null,
    boxedEndX: null,
  };
  if (pathCacheHoistedKeySuffixCompatibility.available) {
    const sourceControl = (globalThis.KDHybridSourcePatchControl =
      globalThis.KDHybridSourcePatchControl || {});
    const hadDisable = Object.prototype.hasOwnProperty.call(
      sourceControl,
      "disablePathCacheHoistedKeySuffix",
    );
    const previousDisable = sourceControl.disablePathCacheHoistedKeySuffix;
    const hadStats = Object.prototype.hasOwnProperty.call(
      sourceControl,
      "pathCacheHoistedKeySuffixStats",
    );
    const previousStats = sourceControl.pathCacheHoistedKeySuffixStats;
    const samplePath = jsUncached.results[firstReachableIndex];
    const finalIndex = "__kd_hybrid_path_cache_stress_final__";

    const runPathCacheCase = (disable, boxedEndX) => {
      const map = new Map();
      const conversions = { count: 0 };
      const endX = boxedEndX
        ? {
            [Symbol.toPrimitive]() {
              conversions.count += 1;
              return baseArgs[2];
            },
          }
        : baseArgs[2];
      sourceControl.disablePathCacheHoistedKeySuffix = disable;
      sourceControl.pathCacheHoistedKeySuffixStats = {
        calls: 0,
        optimizedCalls: 0,
        fallbackCalls: 0,
      };
      globalThis.KDSetPathfindCache(
        map,
        samplePath,
        endX,
        baseArgs[3],
        baseArgs[7],
        finalIndex,
      );
      return {
        map,
        conversions: conversions.count,
        stats: { ...sourceControl.pathCacheHoistedKeySuffixStats },
      };
    };

    try {
      const primitiveProduct = runPathCacheCase(false, false);
      const primitiveControl = runPathCacheCase(true, false);
      pathCacheHoistedKeySuffixCompatibility.primitive = {
        exact: samePathMaps(primitiveProduct.map, primitiveControl.map),
        productStats: primitiveProduct.stats,
        controlStats: primitiveControl.stats,
      };

      const boxedProduct = runPathCacheCase(false, true);
      const boxedControl = runPathCacheCase(true, true);
      pathCacheHoistedKeySuffixCompatibility.boxedEndX = {
        exact: samePathMaps(boxedProduct.map, boxedControl.map),
        productConversions: boxedProduct.conversions,
        controlConversions: boxedControl.conversions,
        productStats: boxedProduct.stats,
        controlStats: boxedControl.stats,
      };
    } finally {
      if (hadDisable) {
        sourceControl.disablePathCacheHoistedKeySuffix = previousDisable;
      } else {
        delete sourceControl.disablePathCacheHoistedKeySuffix;
      }
      if (hadStats) {
        sourceControl.pathCacheHoistedKeySuffixStats = previousStats;
      } else {
        delete sourceControl.pathCacheHoistedKeySuffixStats;
      }
    }
  }

  let beforeHooks = 0;
  let afterHooks = 0;
  const beforeHookId = KDHybrid.registerHook(
    "pathfinding",
    "before",
    () => {
      beforeHooks += 1;
    },
    { id: "kd-hybrid-stress-before", priority: 100 },
  );
  const afterHookId = KDHybrid.registerHook(
    "pathfinding",
    "after",
    () => {
      afterHooks += 1;
    },
    { id: "kd-hybrid-stress-after", priority: 100 },
  );
  clearPathCaches();
  const dispatchResult = copyPath(
    KDHybrid.dispatch("pathfinding", ...baseArgs),
  );
  const removedBeforeHook = KDHybrid.unregisterHook(beforeHookId);
  const removedAfterHook = KDHybrid.unregisterHook(afterHookId);
  const removedTwice = KDHybrid.unregisterHook(afterHookId);

  const directQuery = new Uint8Array(20);
  const queryView = new DataView(directQuery.buffer);
  directQuery.set([0x4b, 0x44, 0x51, 0x31], 0);
  queryView.setUint16(4, KDHybrid.abiVersion, true);
  queryView.setUint8(6, 3);
  queryView.setUint8(7, 1);
  queryView.setInt16(8, baseArgs[0], true);
  queryView.setInt16(10, baseArgs[1], true);
  queryView.setInt16(12, baseArgs[2], true);
  queryView.setInt16(14, baseArgs[3], true);
  queryView.setUint32(
    16,
    Math.min(KDMapData.GridWidth * KDMapData.GridHeight * 4, 1_000_000),
    true,
  );
  const directQueryResult = KDHybrid.query(directQuery);
  const directQueryMagic = String.fromCharCode(
    ...directQueryResult.slice(0, 4),
  );

  const diagnostics = JSON.parse(
    KDHybrid.exportDiagnostics({
      stressEnemies: requestedEnemies,
      save: "must-not-leak",
      source: "must-not-leak",
    }),
  );
  let invalidPluginRejected = false;
  let invalidPluginMessage = null;
  try {
    await KDHybrid.registerWasmPlugin(
      {
        id: "stress-invalid",
        name: "Stress invalid ABI",
        version: "1",
        abi: KDHybrid.abiVersion + 1,
        capabilities: [],
        systems: [],
        maxMemoryPages: 1,
      },
      new Uint8Array([0]),
    );
  } catch (error) {
    invalidPluginRejected = true;
    invalidPluginMessage =
      error instanceof Error ? error.message : String(error);
  }
  const publicMethods = [
    "status",
    "systemStatus",
    "registerHook",
    "unregisterHook",
    "dispatch",
    "query",
    "getPathfindingMode",
    "setPathfindingMode",
    "enableSystem",
    "disableSystem",
    "registerWasmPlugin",
    "exportDiagnostics",
  ];
  const apiSurface = {
    methods: Object.fromEntries(
      publicMethods.map((name) => [name, typeof KDHybrid[name]]),
    ),
    statusInitialized: KDHybrid.status().initialized,
    systemStatusArray: Array.isArray(KDHybrid.systemStatus()),
    pathfindingMode: {
      defaultMode: initialRuntime.pathfindingMode,
      activeMode: KDHybrid.getPathfindingMode(),
      setHuman: KDHybrid.setPathfindingMode("human"),
      restoredFast: KDHybrid.setPathfindingMode("fast"),
    },
    dispatchValid: pathIsValid(dispatchResult, baseArgs),
    hooks: {
      beforeCalls: beforeHooks,
      afterCalls: afterHooks,
      removedBeforeHook,
      removedAfterHook,
      removedTwice,
    },
    query: {
      returnedUint8Array: directQueryResult instanceof Uint8Array,
      magic: directQueryMagic,
      bytes: directQueryResult.byteLength,
    },
    diagnostics: {
      schema: diagnostics.schema,
      saveRedacted: diagnostics.extra?.save === "<redacted>",
      sourceRedacted: diagnostics.extra?.source === "<redacted>",
    },
    invalidPluginRejected,
    invalidPluginMessage,
  };

  for (const enemy of spawned) {
    if (KDMapData.Entities.includes(enemy)) {
      KDRemoveEntity(enemy);
    }
  }
  const developerFunctions = {
    types: Object.fromEntries(
      [
        "KDRunTests",
        "KDTestMapGen",
        "KDTestFullRunthrough",
        "KDTestjailer",
      ].map((name) => [name, typeof globalThis[name]]),
    ),
    mapGeneration: null,
    fullRunthrough: null,
    jailerSampler: null,
    stateRestored: false,
    deferredMapCallbackRestored: false,
  };
  const developerStateBefore = KinkyDungeonState;
  const developerMapCallbackBefore = KDGenMapCallback;
  try {
    developerFunctions.mapGeneration = KDTestMapGen(1, [0], ["grv"]);
    developerFunctions.fullRunthrough = KDTestFullRunthrough(1, true, false);
    KDTestjailer(3);
    developerFunctions.jailerSampler = "completed-without-throwing";
  } finally {
    // KDTestFullRunthrough schedules the final generated-map callback for the
    // renderer. Letting that synthetic callback escape this evaluation can
    // trigger an autosave after the fixture has returned, before the test
    // player has a KDCurrentModels entry.
    KDGenMapCallback = developerMapCallbackBefore;
    KinkyDungeonState = developerStateBefore;
  }
  developerFunctions.stateRestored = KinkyDungeonState === developerStateBefore;
  developerFunctions.deferredMapCallbackRestored =
    KDGenMapCallback === developerMapCallbackBefore;

  KDHybrid.enableSystem("pathfinding");
  const finalPathfinding = statusCopy();
  const expectedFallbackCasesPass = argumentCompatibility
    .filter((entry) => entry.expectedRoute === "fallback")
    .every(
      (entry) =>
        entry.actualRoute === "fallback" &&
        entry.exact &&
        entry.reachabilityEqual &&
        entry.jsValid &&
        entry.adaptedValid &&
        (entry.sourceGuard !== "pathfindingHoistedCacheIndex" ||
          (entry.sourceGuardStats?.calls === 1 &&
            entry.sourceGuardStats?.optimizedCalls === 0 &&
            entry.sourceGuardStats?.fallbackCalls === 1)),
    );
  const nativeArgumentCasesPass = argumentCompatibility
    .filter((entry) => entry.expectedRoute === "native")
    .every(
      (entry) =>
        entry.actualRoute === "native" &&
        entry.reachabilityEqual &&
        entry.jsValid &&
        entry.adaptedValid &&
        entry.delta.failures === 0,
    );
  const dynamicArgumentCasesPass = argumentCompatibility
    .filter((entry) => entry.expectedRoute === "native-or-fallback")
    .every(
      (entry) =>
        (entry.actualRoute === "native" || entry.actualRoute === "fallback") &&
        entry.reachabilityEqual &&
        entry.jsValid &&
        entry.adaptedValid &&
        entry.delta.failures === 0 &&
        (entry.actualRoute !== "fallback" || entry.exact),
    );
  const apiPassed =
    publicMethods.every((name) => apiSurface.methods[name] === "function") &&
    apiSurface.statusInitialized &&
    apiSurface.systemStatusArray &&
    apiSurface.pathfindingMode.defaultMode === "fast" &&
    apiSurface.pathfindingMode.activeMode === "fast" &&
    apiSurface.pathfindingMode.setHuman === "human" &&
    apiSurface.pathfindingMode.restoredFast === "fast" &&
    apiSurface.dispatchValid &&
    beforeHooks === 1 &&
    afterHooks === 1 &&
    removedBeforeHook &&
    removedAfterHook &&
    !removedTwice &&
    apiSurface.query.returnedUint8Array &&
    apiSurface.query.magic === "KDZ1" &&
    apiSurface.diagnostics.schema === 1 &&
    apiSurface.diagnostics.saveRedacted &&
    apiSurface.diagnostics.sourceRedacted &&
    invalidPluginRejected;
  const developerFunctionsPassed =
    Object.values(developerFunctions.types).every(
      (type) => type === "function",
    ) &&
    developerFunctions.mapGeneration === true &&
    developerFunctions.fullRunthrough === true &&
    developerFunctions.jailerSampler === "completed-without-throwing" &&
    developerFunctions.stateRestored &&
    developerFunctions.deferredMapCallbackRestored;
  const stressPassed =
    actualStressEnemies === requestedEnemies &&
    nativeUncached.delta.nativeCalls === requestedEnemies * timingBatches &&
    nativeUncached.delta.fallbackCalls === 0 &&
    nativeUncached.delta.failures === 0 &&
    nativeCacheCold.delta.calls === requestedEnemies * timingBatches &&
    nativeCacheCold.delta.nativeCalls + nativeCacheCold.delta.fallbackCalls ===
      requestedEnemies * timingBatches &&
    nativeCacheCold.delta.failures === 0 &&
    nativeCacheWarm.delta.calls === requestedEnemies * timingBatches * 10 &&
    nativeCacheWarm.delta.nativeCalls + nativeCacheWarm.delta.fallbackCalls ===
      requestedEnemies * timingBatches * 10 &&
    nativeCacheWarm.delta.failures === 0 &&
    nativeCacheCold.bridgeDelta.calls < nativeUncached.bridgeDelta.calls &&
    parity.reachabilityMismatches === 0 &&
    parity.invalidJavaScriptPaths === 0 &&
    parity.invalidNativePaths === 0 &&
    cachedParity.reachabilityMismatches === 0 &&
    cachedParity.invalidJavaScriptPaths === 0 &&
    cachedParity.invalidNativePaths === 0;
  const plannerModesPassed = Object.values(plannerModes).every(
    (mode) =>
      mode.uncached.delta.nativeCalls === requestedEnemies * timingBatches &&
      mode.uncached.delta.fallbackCalls === 0 &&
      mode.uncached.delta.failures === 0 &&
      mode.cacheCold.delta.failures === 0 &&
      mode.cacheWarm.delta.failures === 0 &&
      mode.parity.reachabilityMismatches === 0 &&
      mode.parity.invalidNativePaths === 0 &&
      mode.cachedParity.reachabilityMismatches === 0 &&
      mode.cachedParity.invalidNativePaths === 0,
  );
  const pathCacheHoistedKeySuffixCompatibilityPassed =
    !pathCacheHoistedKeySuffixCompatibility.available ||
    (pathCacheHoistedKeySuffixCompatibility.primitive?.exact === true &&
      pathCacheHoistedKeySuffixCompatibility.primitive?.productStats?.calls ===
        1 &&
      pathCacheHoistedKeySuffixCompatibility.primitive?.productStats
        ?.optimizedCalls === 1 &&
      pathCacheHoistedKeySuffixCompatibility.primitive?.productStats
        ?.fallbackCalls === 0 &&
      pathCacheHoistedKeySuffixCompatibility.primitive?.controlStats?.calls ===
        1 &&
      pathCacheHoistedKeySuffixCompatibility.primitive?.controlStats
        ?.optimizedCalls === 0 &&
      pathCacheHoistedKeySuffixCompatibility.primitive?.controlStats
        ?.fallbackCalls === 1 &&
      pathCacheHoistedKeySuffixCompatibility.boxedEndX?.exact === true &&
      pathCacheHoistedKeySuffixCompatibility.boxedEndX?.productConversions >
        0 &&
      pathCacheHoistedKeySuffixCompatibility.boxedEndX?.productConversions ===
        pathCacheHoistedKeySuffixCompatibility.boxedEndX?.controlConversions &&
      pathCacheHoistedKeySuffixCompatibility.boxedEndX?.productStats?.calls ===
        1 &&
      pathCacheHoistedKeySuffixCompatibility.boxedEndX?.productStats
        ?.optimizedCalls === 0 &&
      pathCacheHoistedKeySuffixCompatibility.boxedEndX?.productStats
        ?.fallbackCalls === 1);
  const passed =
    stressPassed &&
    plannerModesPassed &&
    pathCacheHoistedKeySuffixCompatibilityPassed &&
    expectedFallbackCasesPass &&
    nativeArgumentCasesPass &&
    dynamicArgumentCasesPass &&
    apiPassed &&
    developerFunctionsPassed &&
    finalPathfinding.mode === "native" &&
    finalPathfinding.failures === initialPathfinding.failures;

  return {
    schema: 2,
    generatedAt: new Date().toISOString(),
    passed,
    environment: {
      gameVersion: initialRuntime.upstreamVersion,
      packageVersion: initialRuntime.upstreamPackageVersion,
      bundleSha256: initialRuntime.upstreamBundleSha256,
      runtimeVersion: KDHybrid.version,
      abiVersion: KDHybrid.abiVersion,
      map: {
        width: KDMapData.GridWidth,
        height: KDMapData.GridHeight,
      },
      requestedEnemies,
      actualStressEnemies,
    },
    status: {
      initial: initialPathfinding,
      final: finalPathfinding,
    },
    timing: {
      javascriptUncached: withoutResults(jsUncached),
      javascriptCacheCold: withoutResults(jsCacheCold),
      javascriptCacheWarm: withoutResults(jsCacheWarm),
      nativeUncached: withoutResults(nativeUncached),
      nativeCacheCold: withoutResults(nativeCacheCold),
      nativeCacheWarm: withoutResults(nativeCacheWarm),
      speedup: {
        versusJavaScriptUncached: ratio(jsUncached, nativeUncached),
        versusJavaScriptCacheCold: ratio(jsCacheCold, nativeCacheCold),
        versusJavaScriptCacheWarm: ratio(jsCacheWarm, nativeCacheWarm),
      },
    },
    plannerModes: Object.fromEntries(
      Object.entries(plannerModes).map(([mode, result]) => [
        mode,
        {
          uncached: withoutResults(result.uncached),
          cacheCold: withoutResults(result.cacheCold),
          cacheWarm: withoutResults(result.cacheWarm),
          speedup: {
            versusJavaScriptUncached: ratio(jsUncached, result.uncached),
            versusJavaScriptCacheCold: ratio(jsCacheCold, result.cacheCold),
            versusJavaScriptCacheWarm: ratio(jsCacheWarm, result.cacheWarm),
          },
          parity: result.parity,
          cachedParity: result.cachedParity,
        },
      ]),
    ),
    parity,
    cachedParity,
    argumentCompatibility,
    pathCacheHoistedKeySuffixCompatibility,
    apiSurface,
    developerFunctions,
    checks: {
      stressPassed,
      plannerModesPassed,
      pathCacheHoistedKeySuffixCompatibilityPassed,
      expectedFallbackCasesPass,
      nativeArgumentCasesPass,
      dynamicArgumentCasesPass,
      apiPassed,
      developerFunctionsPassed,
    },
  };

  function samePathMaps(left, right) {
    if (!(left instanceof Map) || !(right instanceof Map)) {
      return false;
    }
    if (left.size !== right.size) {
      return false;
    }
    const leftEntries = [...left.entries()];
    const rightEntries = [...right.entries()];
    for (let index = 0; index < leftEntries.length; index += 1) {
      const [leftKey, leftPath] = leftEntries[index];
      const [rightKey, rightPath] = rightEntries[index];
      if (leftKey !== rightKey || leftPath.length !== rightPath.length) {
        return false;
      }
      for (let point = 0; point < leftPath.length; point += 1) {
        if (!Object.is(leftPath[point], rightPath[point])) {
          return false;
        }
      }
    }
    return true;
  }

  function withoutResults(value) {
    const { results: _results, ...summary } = value;
    return summary;
  }

  function comparePaths(javascriptResults, nativeResults) {
    const comparison = {
      compared: queries.length,
      exactMatches: 0,
      lengthMatches: 0,
      reachabilityMismatches: 0,
      invalidJavaScriptPaths: 0,
      invalidNativePaths: 0,
    };
    for (let index = 0; index < queries.length; index += 1) {
      const query = queries[index];
      const jsPath = javascriptResults[index];
      const nativePath = nativeResults[index];
      if (samePath(jsPath, nativePath)) {
        comparison.exactMatches += 1;
      }
      if (
        jsPath !== null &&
        nativePath !== null &&
        jsPath.length === nativePath.length
      ) {
        comparison.lengthMatches += 1;
      }
      if (!sameReachability(jsPath, nativePath)) {
        comparison.reachabilityMismatches += 1;
      }
      if (!pathIsValid(jsPath, query.args)) {
        comparison.invalidJavaScriptPaths += 1;
      }
      if (!pathIsValid(nativePath, query.args)) {
        comparison.invalidNativePaths += 1;
      }
    }
    return comparison;
  }
}
