import {
  KDHybridRuntime,
  type NativeAdapterRegistration,
  type WasmBindings
} from "@kd-hybrid/runtime";

import { installKinkyDungeonPathfindingAdapter } from "./kd-adapters.js";

declare const KDModFiles: Record<string, string>;
declare const KinkyDungeonRootDirectory: string;
declare const wasm_bindgen: {
  (source: { readonly module_or_path: string }): Promise<unknown>;
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
  ...(detectedVersion === undefined ? {} : { upstreamVersion: detectedVersion })
});
runtime.installGlobal();

void initialize().catch((error: unknown) => {
  runtime.bridge.disable(
    error instanceof Error ? `mod-initialization:${error.message}` : "mod-initialization-failed"
  );
});

async function initialize(): Promise<void> {
  const wasmUrl = findModFile("wasm/kd_hybrid_core_bg.wasm");
  if (wasmUrl === null) {
    throw new Error("KD mod loader did not expose kd_hybrid_core_bg.wasm");
  }
  const bindings: WasmBindings = {
    default: (source) => wasm_bindgen({ module_or_path: String(source) }),
    HybridEngine: wasm_bindgen.HybridEngine
  };
  await runtime.initializeNative(bindings, wasmUrl);
  const externalAdapters = globalThis.KDHybridAdapterPack ?? [];
  if (
    !externalAdapters.some((adapter) => adapter.globalName === "KinkyDungeonFindPath")
  ) {
    installKinkyDungeonPathfindingAdapter(runtime);
  }
  for (const adapter of externalAdapters) {
    runtime.registerAdapter(adapter);
  }
  // Other mods may load after this one. Reconciliation never overwrites their
  // functions; it disables only the conflicting native facade.
  setTimeout(() => runtime.dispatcher.reconcile(), 0);
  setTimeout(() => runtime.dispatcher.reconcile(), 2_000);
}

function findModFile(suffix: string): string | null {
  const normalizedSuffix = suffix.replaceAll("\\", "/");
  for (const [name, url] of Object.entries(KDModFiles)) {
    if (name.replaceAll("\\", "/").endsWith(normalizedSuffix)) {
      return url;
    }
  }
  const rooted = `${KinkyDungeonRootDirectory}${normalizedSuffix}`.replaceAll("\\", "/");
  return KDModFiles[rooted] ?? null;
}

function detectVersion(): string | undefined {
  const target = globalThis as Record<string, unknown>;
  for (const name of [
    "KinkyDungeonVersion",
    "KDVersionStr",
    "KDVersion",
    "KinkyDungeonGameVersion"
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
      if (
        typeof value === "string" &&
        /^\d+\.\d+(?:\.\d+)?$/u.test(value)
      ) {
        return value;
      }
    } catch {
      // Localization may not be initialized yet; function signatures still
      // gate native registration independently.
    }
  }
  return undefined;
}
