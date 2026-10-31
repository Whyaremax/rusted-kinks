import {
  KDHybridRuntime,
  type NativeAdapterRegistration,
  type WasmBindings,
} from "@kd-hybrid/runtime";

import {
  hasKDNearestPlayerSourcePatch,
  installKDCommanderHelpShortcutAdapter,
  installKDEnemySelectorAdapter,
  installKDEnemyUpdateCacheAdapter,
  installKDFindMasterAdapter,
  installKDJailKeyEarlyReturnAdapter,
  installKDNearestPlayerAdapter,
  installKDNearbyEnemiesAdapter,
  installKinkyDungeonMapGenerationAdapter,
  installKinkyDungeonPathfindingAdapter,
} from "./kd-adapters.js";

declare const KDModFiles: Record<string, string>;
declare const KinkyDungeonRootDirectory: string;
declare const wasm_bindgen: {
  (source: {
    readonly module_or_path:
      | RequestInfo
      | URL
      | Response
      | BufferSource
      | WebAssembly.Module;
  }): Promise<unknown>;
  readonly HybridEngine: WasmBindings["HybridEngine"];
};

declare global {
  // Optional adapter packs can register after the generic runtime is ready.
  // eslint-disable-next-line no-var
  var KDHybridAdapterPack: readonly NativeAdapterRegistration[] | undefined;
}

const detectedVersion = detectVersion();
const runtime = new KDHybridRuntime({
  qualityMode: globalThis.KDHybridBootstrapConfig?.quality ?? "auto",
  pathfindingMode:
    globalThis.KDHybridBootstrapConfig?.pathfindingMode ?? "fast",
  ...(detectedVersion === undefined
    ? {}
    : { upstreamVersion: detectedVersion }),
});
runtime.installGlobal();

void initialize().catch((error: unknown) => {
  runtime.bridge.disable(
    error instanceof Error
      ? `mod-initialization:${error.message}`
      : "mod-initialization-failed",
  );
});

async function initialize(): Promise<void> {
  const wasmUrl = findModFile("wasm/kd_hybrid_core_bg.wasm");
  if (wasmUrl === null) {
    throw new Error("KD mod loader did not expose kd_hybrid_core_bg.wasm");
  }
  const wasmResponse = await fetch(wasmUrl);
  if (!wasmResponse.ok) {
    throw new Error(
      `KD mod loader WASM request failed with HTTP ${wasmResponse.status}`,
    );
  }
  // KD's ZIP loader gives Blob URLs a non-WASM MIME type. Read the bytes first
  // so wasm-bindgen never attempts noisy instantiateStreaming fallback.
  const wasmBytes = await wasmResponse.arrayBuffer();
  const bindings: WasmBindings = {
    default: (source) => {
      if (source === undefined) {
        throw new TypeError("KD Hybrid WASM bytes are unavailable");
      }
      return wasm_bindgen({ module_or_path: source });
    },
    HybridEngine: wasm_bindgen.HybridEngine,
  };
  await runtime.initializeNative(bindings, wasmBytes);
  const externalAdapters = Array.isArray(globalThis.KDHybridAdapterPack)
    ? globalThis.KDHybridAdapterPack
    : [];
  if (
    !hasExternalAdapter(externalAdapters, "KinkyDungeonCreateMap")
  ) {
    installKinkyDungeonMapGenerationAdapter(runtime);
  }
  if (
    !hasExternalAdapter(externalAdapters, "KinkyDungeonGetEnemy")
  ) {
    installKDEnemySelectorAdapter(runtime);
  }
  if (
    !hasExternalAdapter(externalAdapters, "KinkyDungeonFindPath")
  ) {
    installKinkyDungeonPathfindingAdapter(runtime);
  }
  if (
    !hasExternalAdapter(externalAdapters, "KDNearbyEnemies")
  ) {
    installKDNearbyEnemiesAdapter(runtime);
  }
  if (
    !hasKDNearestPlayerSourcePatch() &&
    !hasExternalAdapter(externalAdapters, "KDCommanderUpdateRoles")
  ) {
    installKDCommanderHelpShortcutAdapter(runtime);
  }
  if (
    !hasExternalAdapter(externalAdapters, "KinkyDungeonFindMaster")
  ) {
    installKDFindMasterAdapter(runtime);
  }
  if (
    !hasExternalAdapter(externalAdapters, "KinkyDungeonUpdateEnemies")
  ) {
    installKDEnemyUpdateCacheAdapter(runtime);
  }
  if (
    !hasExternalAdapter(externalAdapters, "KinkyDungeonPlaceJailKeys")
  ) {
    installKDJailKeyEarlyReturnAdapter(runtime);
  }
  for (let index = 0; index < externalAdapters.length; index += 1) {
    const adapter = externalAdapters[index];
    if (adapter !== undefined) runtime.registerAdapter(adapter);
  }
  if (
    !hasExternalAdapter(externalAdapters, "KinkyDungeonNearestPlayer")
  ) {
    // Install after external adapters so the handler captures the actual
    // nearby-enemy facade that KD will call.
    installKDNearestPlayerAdapter(runtime);
  }
  // Other mods may load after this one. Reconciliation never overwrites their
  // functions; it disables only the conflicting native facade.
  setTimeout(() => runtime.dispatcher.reconcile(), 0);
  setTimeout(() => runtime.dispatcher.reconcile(), 2_000);
}

function hasExternalAdapter(
  adapters: readonly NativeAdapterRegistration[],
  globalName: string,
): boolean {
  for (let index = 0; index < adapters.length; index += 1) {
    if (adapters[index]?.globalName === globalName) return true;
  }
  return false;
}

function findModFile(suffix: string): string | null {
  const normalizedSuffix = suffix.replaceAll("\\", "/");
  for (const [name, url] of Object.entries(KDModFiles)) {
    if (name.replaceAll("\\", "/").endsWith(normalizedSuffix)) {
      return url;
    }
  }
  const rooted = `${KinkyDungeonRootDirectory}${normalizedSuffix}`.replaceAll(
    "\\",
    "/",
  );
  return KDModFiles[rooted] ?? null;
}

function detectVersion(): string | undefined {
  const target = globalThis as Record<string, unknown>;
  for (const name of [
    "KinkyDungeonVersion",
    "KDVersionStr",
    "KDVersion",
    "KinkyDungeonGameVersion",
  ]) {
    const value = target[name];
    if (typeof value === "string" && /^\d+\.\d+(?:\.\d+)?$/u.test(value)) {
      return value;
    }
  }
  const textGet = target.TextGet;
  if (typeof textGet === "function") {
    try {
      const value = Reflect.apply(textGet, target, ["KDVersionStr"]);
      if (typeof value === "string" && /^\d+\.\d+(?:\.\d+)?$/u.test(value)) {
        return value;
      }
    } catch {
      // Localization may not be initialized yet; function signatures still
      // gate native registration independently.
    }
  }
  return undefined;
}
