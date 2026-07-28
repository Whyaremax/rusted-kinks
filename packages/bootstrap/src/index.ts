import {
  KDHybridRuntime,
  type NativeAdapterRegistration,
  type QualityTier,
  type WasmBindings
} from "@kd-hybrid/runtime";

import {
  hasKDNearestPlayerSourcePatch,
  waitForKDCommanderHelpShortcutAdapter,
  waitForKDEnemySelectorAdapter,
  waitForKDEnemyUpdateCacheAdapter,
  waitForKDFindMasterAdapter,
  waitForKDJailKeyEarlyReturnAdapter,
  waitForKDNearestPlayerAdapter,
  waitForKDNearbyEnemiesAdapter,
  waitForKinkyDungeonMapGenerationAdapter,
  waitForKinkyDungeonPathfindingAdapter
} from "./kd-adapters.js";
import {
  installKinkyDungeonRendering,
  type KinkyDungeonRenderingHandle
} from "./rendering.js";
import {
  installKinkyDungeonStartup,
  type KinkyDungeonStartupHandle
} from "./startup.js";

declare global {
  // Internal integration surface intentionally separate from the public SDK.
  // eslint-disable-next-line no-var
  var KDHybridRuntimeInternal:
    | {
        readonly runtime: KDHybridRuntime;
        registerAdapter(registration: NativeAdapterRegistration): void;
      }
    | undefined;
}

export interface BootstrapHandle {
  readonly runtime: KDHybridRuntime;
  readonly rendering: KinkyDungeonRenderingHandle;
  readonly startup: KinkyDungeonStartupHandle;
  readonly nativeReady: Promise<boolean>;
  dispose(): void;
}

let active: BootstrapHandle | null = null;

export function installBootstrap(): BootstrapHandle {
  if (active !== null) {
    return active;
  }
  const startup = installKinkyDungeonStartup();
  const config = globalThis.KDHybridBootstrapConfig;
  const runtime = new KDHybridRuntime({
    qualityMode: config?.quality ?? "auto",
    pathfindingMode: config?.pathfindingMode ?? "fast",
    ...(config?.upstreamVersion === undefined
      ? {}
      : { upstreamVersion: config.upstreamVersion }),
    ...(config?.upstreamPackageVersion === undefined
      ? {}
      : { upstreamPackageVersion: config.upstreamPackageVersion }),
    ...(config?.upstreamBundleSha256 === undefined
      ? {}
      : { upstreamBundleSha256: config.upstreamBundleSha256 })
  });
  runtime.installGlobal();
  globalThis.KDHybridRuntimeInternal = Object.freeze({
    runtime,
    registerAdapter: (registration: NativeAdapterRegistration) => {
      runtime.registerAdapter(registration);
    }
  });

  const rendering = installKinkyDungeonRendering({
    tier: runtime.quality.status().tier,
    textureMode:
      config?.rendering?.textureMode ??
      (config?.quality === "high" ? "full" : "mobile"),
    ...(config?.upstreamVersion === undefined
      ? {}
      : { upstreamVersion: config.upstreamVersion }),
    ...(config?.upstreamBundleSha256 === undefined
      ? {}
      : { upstreamBundleSha256: config.upstreamBundleSha256 })
  });
  const stopFrames = monitorFrames(runtime, rendering);
  const stopQuality = applyQualityHints(runtime, rendering);
  const nativeReady = loadNative(runtime)
    .then(async (ready) => {
      if (ready) {
        await Promise.all([
          waitForKinkyDungeonMapGenerationAdapter(runtime),
          waitForKDEnemySelectorAdapter(runtime),
          waitForKinkyDungeonPathfindingAdapter(runtime),
          waitForKDNearbyEnemiesAdapter(runtime),
          waitForKDCommanderHelpShortcutAdapter(runtime),
          waitForKDFindMasterAdapter(runtime),
          waitForKDJailKeyEarlyReturnAdapter(runtime),
          waitForKDEnemyUpdateCacheAdapter(runtime)
        ]);
        if (!hasKDNearestPlayerSourcePatch()) {
          await waitForKDNearestPlayerAdapter(runtime);
        }
      }
      return ready;
    })
    .catch((error: unknown) => {
      runtime.bridge.disable(
        error instanceof Error ? `initialization:${error.message}` : "initialization-failed"
      );
      return false;
    });

  active = Object.freeze({
    runtime,
    rendering,
    startup,
    nativeReady,
    dispose: () => {
      stopFrames();
      stopQuality();
      rendering.dispose();
      startup.dispose();
      runtime.dispose();
      globalThis.KDHybridRuntimeInternal = undefined;
      active = null;
    }
  });
  return active;
}

async function loadNative(runtime: KDHybridRuntime): Promise<boolean> {
  if (typeof document === "undefined") {
    return false;
  }
  const base = new URL("./", currentScriptUrl());
  const bindingsUrl = new URL("wasm/kd_hybrid_core.js", base);
  const wasmUrl =
    globalThis.KDHybridBootstrapConfig?.wasmUrl ??
    new URL("wasm/kd_hybrid_core_bg.wasm", base).toString();
  const wasmModule = (await import(bindingsUrl.toString())) as {
    default(
      input?: {
        readonly module_or_path:
          | RequestInfo
          | URL
          | Response
          | BufferSource
          | WebAssembly.Module;
      }
    ): Promise<unknown>;
    HybridEngine: WasmBindings["HybridEngine"];
  };
  await runtime.initializeNative(
    {
      default: (source) =>
        source === undefined
          ? wasmModule.default()
          : wasmModule.default({ module_or_path: source }),
      HybridEngine: wasmModule.HybridEngine
    },
    wasmUrl
  );
  return true;
}

function currentScriptUrl(): string {
  const current = document.currentScript;
  if (current instanceof HTMLScriptElement && current.src !== "") {
    return current.src;
  }
  const script = [...document.scripts].find((candidate) =>
    candidate.src.includes("kd-hybrid-bootstrap")
  );
  if (script?.src !== undefined && script.src !== "") {
    return script.src;
  }
  return new URL("kd-hybrid/kd-hybrid-bootstrap.js", document.baseURI).toString();
}

function monitorFrames(
  runtime: KDHybridRuntime,
  rendering: KinkyDungeonRenderingHandle
): () => void {
  if (typeof requestAnimationFrame === "undefined") {
    return () => undefined;
  }
  let activeMonitor = true;
  let previous: number | null = null;
  let request = 0;
  const frame = (now: number): void => {
    if (!activeMonitor) {
      return;
    }
    if (previous !== null) {
      runtime.quality.recordFrame(
        now - previous,
        now,
        rendering.sampleTextureMemory()
      );
    }
    previous = now;
    request = requestAnimationFrame(frame);
  };
  request = requestAnimationFrame(frame);
  return () => {
    activeMonitor = false;
    cancelAnimationFrame(request);
  };
}

function applyQualityHints(
  runtime: KDHybridRuntime,
  rendering: KinkyDungeonRenderingHandle
): () => void {
  const apply = (tier: QualityTier): void => {
    rendering.setTier(tier);
    const scale = tier === "high" ? 1 : tier === "balanced" ? 0.75 : 0.5;
    document.documentElement.dataset.kdHybridQuality = tier;
    document.documentElement.style.setProperty("--kd-hybrid-texture-scale", String(scale));
    globalThis.dispatchEvent(
      new CustomEvent("kd-hybrid-quality-change", {
        detail: Object.freeze({ tier, scale })
      })
    );
  };
  apply(runtime.quality.status().tier);
  return runtime.quality.onChange((status) => apply(status.tier));
}

if (typeof document !== "undefined") {
  installBootstrap();
}
