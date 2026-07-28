import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import { strToU8, zipSync } from "fflate";

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "9223" },
    mod: {
      type: "string",
      default: "artifacts/kd-hybrid-normal-mod-v49-candidate.zip",
    },
    output: {
      type: "string",
      default: "artifacts/normal-mod-loader-live-latest.json",
    },
    "probe-late-replacement": { type: "boolean", default: false },
    "load-only": { type: "boolean", default: false },
  },
});

const port = parseInteger("port", values.port, 1, 65_535);
const modPath = path.resolve(values.mod);
const outputPath = path.resolve(values.output);
const modBytes = await readFile(modPath);
const replacementModBytes = values["probe-late-replacement"]
  ? createLateReplacementMod()
  : null;
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

const expression =
  `(${runActualModLoaderTest.toString()})` +
  `(${JSON.stringify(modBytes.toString("base64"))},` +
  `${JSON.stringify(path.basename(modPath))},` +
  `${
    replacementModBytes === null
      ? "null"
      : JSON.stringify(replacementModBytes.toString("base64"))
  },${JSON.stringify(values["load-only"])})`;
const report = await evaluate(
  gameTarget.webSocketDebuggerUrl,
  expression,
  5 * 60_000,
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

function createLateReplacementMod() {
  const manifest = {
    modname: "KD Hybrid compatibility probe",
    moddesc: "Replaces the enemy selector after KD Hybrid for a loader test",
    author: "KD Hybrid test harness",
    modbuild: "1",
    gamemajor: 5,
    gameminor: 4,
    gamepatch_min: 92,
    gamepatch_max: 92,
    priority: -200,
    fileorder: ["LateCompatibility.js"],
  };
  const source = `
globalThis.KDHybridCompatibilityProbe = {
  calls: 0,
  official: KinkyDungeonGetEnemy,
  replacement: null,
};
KinkyDungeonGetEnemy = function KDHybridCompatibilityProbeGetEnemy(...args) {
  globalThis.KDHybridCompatibilityProbe.calls += 1;
  return Reflect.apply(
    globalThis.KDHybridCompatibilityProbe.official,
    this,
    args
  );
};
globalThis.KDHybridCompatibilityProbe.replacement = KinkyDungeonGetEnemy;
`;
  return Buffer.from(
    zipSync(
      {
        "mod.json": strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
        "LateCompatibility.js": strToU8(source),
      },
      { level: 9 },
    ),
  );
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
        () => reject(new Error("KD normal-mod loader test timed out")),
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

async function runActualModLoaderTest(
  base64,
  fileName,
  replacementModBase64,
  loadOnly,
) {
  "use strict";

  const waitFor = async (predicate, timeoutMs, label) => {
    const deadline = performance.now() + timeoutMs;
    while (!predicate()) {
      if (performance.now() >= deadline) {
        throw new Error(`Timed out waiting for ${label}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  const statusCopy = (system) => ({
    ...KDHybrid.systemStatus(system),
  });
  const statusDelta = (before, after) => ({
    calls: after.calls - before.calls,
    nativeCalls: after.nativeCalls - before.nativeCalls,
    fallbackCalls: after.fallbackCalls - before.fallbackCalls,
    failures: after.failures - before.failures,
  });

  await waitFor(
    () =>
      typeof KDLoadMod === "function" &&
      typeof KDExecuteMods === "function" &&
      typeof KinkyDungeonCreateMap === "function" &&
      typeof KinkyDungeonGetEnemy === "function" &&
      typeof KinkyDungeonFindPath === "function",
    20_000,
    "KD's offline mod loader and target functions",
  );

  const before = {
    runtimePresent: globalThis.KDHybrid !== undefined,
    bootstrapInternalPresent: globalThis.KDHybridRuntimeInternal !== undefined,
    modsLoaded: KDModsLoaded,
    allModFiles: KDAllModFiles.length,
    sourcePatchesPresent: globalThis.KDHybridSourcePatches !== undefined,
    state: KinkyDungeonState,
    deferredMapCallbackPresent: typeof KDGenMapCallback === "function",
  };
  if (
    before.runtimePresent ||
    before.bootstrapInternalPresent ||
    before.modsLoaded ||
    before.allModFiles !== 0 ||
    before.sourcePatchesPresent
  ) {
    throw new Error(
      `Normal-mod test requires a clean official runtime: ${JSON.stringify(before)}`,
    );
  }

  const officialCreateMap = KinkyDungeonCreateMap;
  const officialGetEnemy = KinkyDungeonGetEnemy;
  const officialFindPath = KinkyDungeonFindPath;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const file = new File([bytes], fileName, { type: "application/zip" });
  const files = [file];
  if (replacementModBase64 !== null) {
    const replacementBinary = atob(replacementModBase64);
    const replacementBytes = new Uint8Array(replacementBinary.length);
    for (let index = 0; index < replacementBinary.length; index += 1) {
      replacementBytes[index] = replacementBinary.charCodeAt(index);
    }
    files.push(
      new File([replacementBytes], "kd-hybrid-compatibility-probe.zip", {
        type: "application/zip",
      }),
    );
  }

  await KDLoadMod(files);
  await KDExecuteMods();
  await waitFor(
    () =>
      globalThis.KDHybrid?.status?.().initialized === true &&
      globalThis.KDHybrid?.status?.().nativeAvailable === true,
    30_000,
    "KD Hybrid native initialization through the mod loader",
  );
  // Exercise the scheduled compatibility reconciliation after all mod scripts
  // and KD's own post-load bookkeeping have completed.
  await new Promise((resolve) => setTimeout(resolve, 2_100));

  const runtime = KDHybrid.status();
  const mapGenerationBefore = statusCopy("mapGeneration");
  const pathfindingBefore = statusCopy("pathfinding");

  if (!loadOnly) {
    KDSetWorldSlot(0, 1, 0, 0);
    MiniGameKinkyDungeonCheckpoint = "grv";
    KinkyDungeonInitialize(1);
    KDInitPerks();
    MiniGameKinkyDungeonCheckpoint = "grv";
    KDsetSeed("kd-hybrid-normal-mod-loader-smoke-5.4.92");
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
  }

  const mapGenerationAfter = statusCopy("mapGeneration");
  const pathfindingAfter = statusCopy("pathfinding");
  const mapGenerationDelta = statusDelta(
    mapGenerationBefore,
    mapGenerationAfter,
  );
  const pathfindingDelta = statusDelta(pathfindingBefore, pathfindingAfter);
  const functionsWrapped = {
    createMap: KinkyDungeonCreateMap !== officialCreateMap,
    getEnemy: KinkyDungeonGetEnemy !== officialGetEnemy,
    findPath: KinkyDungeonFindPath !== officialFindPath,
  };
  const compatibilityProbe = globalThis.KDHybridCompatibilityProbe;
  const lateReplacement = {
    requested: replacementModBase64 !== null,
    present: compatibilityProbe !== undefined,
    wins:
      compatibilityProbe !== undefined &&
      KinkyDungeonGetEnemy === compatibilityProbe.replacement,
    calls: compatibilityProbe?.calls ?? 0,
  };
  const loader = {
    modsLoaded: KDModsLoaded,
    allModFiles: KDAllModFiles.length,
    modFileCount: KDModFileCount,
    wasmExposed: Object.keys(KDModFiles).some((name) =>
      name.replaceAll("\\", "/").endsWith("wasm/kd_hybrid_core_bg.wasm"),
    ),
  };
  const map = loadOnly
    ? null
    : {
        width: KDMapData.GridWidth,
        height: KDMapData.GridHeight,
        entities: KDMapData.Entities.length,
        start: {
          x: KDMapData.StartPosition.x,
          y: KDMapData.StartPosition.y,
        },
      };
  const lifecycle = {
    loadOnly,
    state: KinkyDungeonState,
    deferredMapCallbackPresent: typeof KDGenMapCallback === "function",
    deferredMapCallbackUnchanged:
      (typeof KDGenMapCallback === "function") ===
        before.deferredMapCallbackPresent,
  };
  const statuses = KDHybrid.systemStatus().map((status) => ({ ...status }));
  const mapGenerationFacades = statuses.filter(
    (status) => status.system === "mapGeneration",
  );
  const createMapStatus = mapGenerationFacades.find(
    (status) => status.globalName === "KinkyDungeonCreateMap",
  );
  const enemySelectorStatus = mapGenerationFacades.find(
    (status) => status.globalName === "KinkyDungeonGetEnemy",
  );
  const pathfindingStatus = statuses.find(
    (status) => status.globalName === "KinkyDungeonFindPath",
  );
  const mapGenerationPrimary = {
    ...KDHybrid.systemStatus("mapGeneration"),
  };
  const compatibilityPassed =
    replacementModBase64 === null
      ? enemySelectorStatus?.mode === "native"
      : lateReplacement.present &&
        lateReplacement.wins &&
        lateReplacement.calls > 0 &&
        (enemySelectorStatus === undefined ||
          enemySelectorStatus.mode === "js-fallback");
  const passed =
    runtime.initialized === true &&
    runtime.nativeAvailable === true &&
    globalThis.KDHybridRuntimeInternal === undefined &&
    globalThis.KDHybridSourcePatches === undefined &&
    loader.modsLoaded === true &&
    loader.allModFiles > 0 &&
    loader.modFileCount === (replacementModBase64 === null ? 1 : 2) &&
    loader.wasmExposed &&
    functionsWrapped.createMap &&
    functionsWrapped.getEnemy &&
    functionsWrapped.findPath &&
    createMapStatus?.mode === "native" &&
    pathfindingStatus?.mode === "native" &&
    mapGenerationPrimary.globalName === "KinkyDungeonCreateMap" &&
    compatibilityPassed &&
    (loadOnly ||
      (mapGenerationDelta.calls > 0 && mapGenerationDelta.nativeCalls > 0)) &&
    mapGenerationDelta.failures === 0 &&
    (loadOnly || pathfindingDelta.calls > 0) &&
    pathfindingDelta.failures === 0 &&
    lifecycle.deferredMapCallbackUnchanged &&
    (loadOnly || (map.width > 0 && map.height > 0));

  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    passed,
    before,
    loader,
    runtime: {
      version: runtime.version,
      abiVersion: runtime.abiVersion,
      upstreamVersion: runtime.upstreamVersion,
      upstreamPackageVersion: runtime.upstreamPackageVersion,
      initialized: runtime.initialized,
      nativeAvailable: runtime.nativeAvailable,
    },
    functionsWrapped,
    lateReplacement,
    mapGeneration: {
      before: mapGenerationBefore,
      after: mapGenerationAfter,
      delta: mapGenerationDelta,
    },
    pathfinding: {
      before: pathfindingBefore,
      after: pathfindingAfter,
      delta: pathfindingDelta,
    },
    lifecycle,
    map,
    mapGenerationPrimary,
    mapGenerationFacades,
    statuses,
  };
}
