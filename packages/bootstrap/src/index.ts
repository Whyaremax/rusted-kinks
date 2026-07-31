import {
  KDHybridRuntime,
  VERSION,
  type NativeAdapterRegistration,
  type QualityTier,
  type WasmBindings,
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
  waitForKinkyDungeonPathfindingAdapter,
} from "./kd-adapters.js";
import {
  installKinkyDungeonRendering,
  type KinkyDungeonRenderingHandle,
} from "./rendering.js";
import {
  installKinkyDungeonModTranslator,
  type KinkyDungeonModTranslatorHandle,
} from "./mod-api-translator.js";
import { createModCompatibilityControlApplier } from "./mod-compatibility-controls.js";
import {
  createModCompatibilityDecisionStore,
  type ModCompatibilityDecisionStore,
} from "./mod-compatibility-decisions.js";
import { createRuntimePathfindingCompatibilityPort } from "./mod-compatibility-runtime.js";
import {
  createBrowserModCompatibilityPorts,
  createModCompatibilityUiController,
  type ModCompatibilityUiController,
} from "./mod-compatibility-ui.js";
import {
  installKinkyDungeonModBridgeHost,
  readPersistedKDHybridModSettings,
  type KinkyDungeonModBridgeHostHandle,
} from "./mod-bridge-host.js";
import {
  installKinkyDungeonModPreflight,
  type KinkyDungeonModPreflightHandle,
} from "./mod-preflight-host.js";
import {
  installKinkyDungeonControlModDiscovery,
  type KinkyDungeonControlModDiscoveryHandle,
} from "./control-mod-discovery.js";
import {
  installKinkyDungeonStartup,
  type KinkyDungeonStartupHandle,
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
  readonly modTranslator: KinkyDungeonModTranslatorHandle;
  readonly modPreflight: KinkyDungeonModPreflightHandle;
  readonly modBridge: KinkyDungeonModBridgeHostHandle;
  readonly controlModDiscovery: KinkyDungeonControlModDiscoveryHandle;
  readonly nativeReady: Promise<boolean>;
  dispose(): void;
}

let active: BootstrapHandle | null = null;

export function installBootstrap(): BootstrapHandle {
  if (active !== null) {
    return active;
  }
  let disposing = false;
  // This runs before KD's main bundle. The proof object therefore exists when
  // source fast paths capture their compatibility boundary, while the loader
  // hook waits until KD has defined its mod globals.
  const modTranslator = installKinkyDungeonModTranslator();
  const startup = installKinkyDungeonStartup();
  const config = globalThis.KDHybridBootstrapConfig;
  const persistedModSettings = readPersistedKDHybridModSettings();
  const pathfindingMode =
    persistedModSettings.pathfindingMode ?? config?.pathfindingMode ?? "fast";
  const textureMode =
    persistedModSettings.textureMode ??
    config?.rendering?.textureMode ??
    (config?.quality === "high" ? "full" : "mobile");
  const framePacingMode =
    persistedModSettings.adaptiveFramePacing === undefined
      ? (config?.rendering?.framePacingMode ?? "adaptive")
      : persistedModSettings.adaptiveFramePacing
        ? "adaptive"
        : "off";
  const runtime = new KDHybridRuntime({
    qualityMode: config?.quality ?? "auto",
    pathfindingMode,
    ...(config?.upstreamVersion === undefined
      ? {}
      : { upstreamVersion: config.upstreamVersion }),
    ...(config?.upstreamPackageVersion === undefined
      ? {}
      : { upstreamPackageVersion: config.upstreamPackageVersion }),
    ...(config?.upstreamBundleSha256 === undefined
      ? {}
      : { upstreamBundleSha256: config.upstreamBundleSha256 }),
  });
  runtime.installGlobal();
  globalThis.KDHybridRuntimeInternal = Object.freeze({
    runtime,
    registerAdapter: (registration: NativeAdapterRegistration) => {
      runtime.registerAdapter(registration);
    },
  });

  const rendering = installKinkyDungeonRendering({
    tier: runtime.quality.status().tier,
    textureMode,
    framePacingMode,
    ...(config?.upstreamVersion === undefined
      ? {}
      : { upstreamVersion: config.upstreamVersion }),
    ...(config?.upstreamBundleSha256 === undefined
      ? {}
      : { upstreamBundleSha256: config.upstreamBundleSha256 }),
  });
  const modBridge = installKinkyDungeonModBridgeHost({
    runtime,
    rendering,
    initialSettings: {
      pathfindingMode,
      textureMode,
      adaptiveFramePacing: framePacingMode === "adaptive",
    },
  });
  const controlModDiscovery = installKinkyDungeonControlModDiscovery();
  const stopFrames = monitorFrames(runtime, rendering);
  const stopQuality = applyQualityHints(runtime, rendering);
  const compatibilityControls = createModCompatibilityControlApplier({
    pathfindingRuntime: createRuntimePathfindingCompatibilityPort(runtime),
  });
  const compatibilityDecisionStore =
    createBrowserCompatibilityDecisionStore(config);
  const compatibilityUi = createBrowserCompatibilityUi(
    compatibilityDecisionStore,
  );
  const nativeReady = loadNative(runtime)
    .then(async (ready) => {
      if (ready) {
        await settleNativeAdapterRegistrations([
          () => waitForKinkyDungeonMapGenerationAdapter(runtime),
          () => waitForKDEnemySelectorAdapter(runtime),
          () => waitForKinkyDungeonPathfindingAdapter(runtime),
          () => waitForKDNearbyEnemiesAdapter(runtime),
          () => waitForKDCommanderHelpShortcutAdapter(runtime),
          () => waitForKDFindMasterAdapter(runtime),
          () => waitForKDJailKeyEarlyReturnAdapter(runtime),
          () => waitForKDEnemyUpdateCacheAdapter(runtime),
          ...(shouldInstallKDNearestPlayerAdapter(
            config?.sourceOptimizations,
            hasKDNearestPlayerSourcePatch(),
          )
            ? [() => waitForKDNearestPlayerAdapter(runtime)]
            : []),
        ]);
      }
      return ready;
    })
    .catch((error: unknown) => {
      runtime.bridge.disable(
        error instanceof Error
          ? `initialization:${error.message}`
          : "initialization-failed",
      );
      return false;
    });
  const modPreflight = installKinkyDungeonModPreflight({
    waitFor: modTranslator.loaderReady,
    activationBarrier: nativeReady,
    sourceOptimizationsActive: config?.sourceOptimizations !== false,
    ...(compatibilityDecisionStore === undefined
      ? {}
      : { decisionStore: compatibilityDecisionStore }),
    ...(compatibilityUi === undefined ? {} : { ui: compatibilityUi }),
    applyCompatibilityControls: (status) => {
      compatibilityControls.apply(status);
    },
  });

  active = Object.freeze({
    runtime,
    rendering,
    startup,
    modTranslator,
    modPreflight,
    modBridge,
    controlModDiscovery,
    nativeReady,
    dispose: () => {
      if (disposing) {
        return;
      }
      disposing = true;
      drainModPreflightBeforeTeardown(modPreflight, () => {
        stopFrames();
        stopQuality();
        compatibilityControls.dispose();
        controlModDiscovery.dispose();
        modBridge.dispose();
        rendering.dispose();
        startup.dispose();
        modTranslator.dispose();
        runtime.dispose();
        globalThis.KDHybridRuntimeInternal = undefined;
        active = null;
      });
    },
  });
  return active;
}

/**
 * Stops new mod activations immediately, but keeps runtime compatibility
 * controls alive until an official activation already in progress settles.
 *
 * @internal
 */
export function drainModPreflightBeforeTeardown(
  preflight: Pick<KinkyDungeonModPreflightHandle, "dispose" | "drain">,
  teardown: () => void,
): void {
  preflight.dispose();
  const pending = preflight.drain();
  if (pending === undefined) {
    teardown();
    return;
  }
  void pending.then(teardown, teardown).catch(() => {
    // Asynchronous teardown must not create an unhandled rejection.
  });
}

/**
 * Starts every sibling registration and preserves the activation barrier until
 * all of them settle. The first rejection is rethrown only after no delayed
 * registration can still install a native facade.
 *
 * @internal
 */
export async function settleNativeAdapterRegistrations(
  registrations: readonly (() => PromiseLike<unknown> | unknown)[],
): Promise<void> {
  const results = await Promise.allSettled(
    registrations.map((register) => Promise.resolve().then(register)),
  );
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure !== undefined) {
    throw failure.reason;
  }
}

/**
 * The bootstrap runs before KD's main bundle, so the source-patch marker can
 * appear on either side of native initialization. An explicit optimized-source
 * selection must win that race and suppress the redundant runtime adapter.
 *
 * @internal
 */
export function shouldInstallKDNearestPlayerAdapter(
  sourceOptimizations: boolean | undefined,
  sourcePatchPresent: boolean,
): boolean {
  return sourceOptimizations !== true && !sourcePatchPresent;
}

function createBrowserCompatibilityDecisionStore(
  config: typeof globalThis.KDHybridBootstrapConfig,
): ModCompatibilityDecisionStore | undefined {
  if (
    typeof localStorage === "undefined" ||
    typeof config?.upstreamVersion !== "string" ||
    typeof config.upstreamBundleSha256 !== "string" ||
    !/^[a-f0-9]{64}$/iu.test(config.upstreamBundleSha256)
  ) {
    return undefined;
  }
  try {
    return createModCompatibilityDecisionStore(localStorage, {
      kdVersion: config.upstreamVersion,
      bundleSha256: config.upstreamBundleSha256,
      hybridVersion: VERSION,
    });
  } catch {
    return undefined;
  }
}

function createBrowserCompatibilityUi(
  decisionStore: ModCompatibilityDecisionStore | undefined,
): ModCompatibilityUiController | undefined {
  if (typeof document === "undefined" || document.body === null) {
    return undefined;
  }
  try {
    const ports = createBrowserModCompatibilityPorts(document);
    return createModCompatibilityUiController({
      ...(decisionStore === undefined ? {} : { decisionStore }),
      dialog: ports.dialog,
      manager: ports.manager,
    });
  } catch {
    return undefined;
  }
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
    default(input?: {
      readonly module_or_path:
        RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
    }): Promise<unknown>;
    HybridEngine: WasmBindings["HybridEngine"];
  };
  await runtime.initializeNative(
    {
      default: (source) =>
        source === undefined
          ? wasmModule.default()
          : wasmModule.default({ module_or_path: source }),
      HybridEngine: wasmModule.HybridEngine,
    },
    wasmUrl,
  );
  return true;
}

function currentScriptUrl(): string {
  const current = document.currentScript;
  if (current instanceof HTMLScriptElement && current.src !== "") {
    return current.src;
  }
  const script = [...document.scripts].find((candidate) =>
    candidate.src.includes("kd-hybrid-bootstrap"),
  );
  if (script?.src !== undefined && script.src !== "") {
    return script.src;
  }
  return new URL(
    "kd-hybrid/kd-hybrid-bootstrap.js",
    document.baseURI,
  ).toString();
}

function monitorFrames(
  runtime: KDHybridRuntime,
  rendering: KinkyDungeonRenderingHandle,
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
        rendering.sampleTextureMemory(),
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
  rendering: KinkyDungeonRenderingHandle,
): () => void {
  const apply = (tier: QualityTier): void => {
    rendering.setTier(tier);
    const scale = tier === "high" ? 1 : tier === "balanced" ? 0.75 : 0.5;
    document.documentElement.dataset.kdHybridQuality = tier;
    document.documentElement.style.setProperty(
      "--kd-hybrid-texture-scale",
      String(scale),
    );
    globalThis.dispatchEvent(
      new CustomEvent("kd-hybrid-quality-change", {
        detail: Object.freeze({ tier, scale }),
      }),
    );
  };
  apply(runtime.quality.status().tier);
  return runtime.quality.onChange((status) => apply(status.tier));
}

if (typeof document !== "undefined") {
  installBootstrap();
}
