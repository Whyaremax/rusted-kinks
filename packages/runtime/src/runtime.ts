import { WasmBatchBridge, type WasmBindings } from "./bridge.js";
import { ABI_VERSION } from "./codec.js";
import { exportDiagnosticJson } from "./diagnostics.js";
import { LegacySystemDispatcher } from "./dispatcher.js";
import { CapabilityPluginHost } from "./plugins.js";
import {
  AdaptiveQualityController,
  type QualityEnvironment,
  type QualityMode
} from "./quality.js";
import type { SignatureCandidate } from "./signatures.js";
import type {
  HookCallback,
  HookPhase,
  KDHybridPublicApi,
  RuntimeCapabilities,
  RuntimeStatus,
  SystemName,
  SystemStatus,
  WasmPluginHandle,
  WasmPluginManifest
} from "./types.js";
import { KNOWN_UPSTREAM, UPSTREAM_5_4_92_FACADES } from "./upstream.js";

export const VERSION = "0.1.0";

export interface RuntimeOptions {
  readonly target?: Record<string, unknown>;
  readonly upstreamVersion?: string;
  readonly upstreamPackageVersion?: string;
  readonly upstreamBundleSha256?: string;
  readonly qualityMode?: QualityMode;
  readonly qualityEnvironment?: QualityEnvironment;
  readonly mods?: readonly {
    readonly name?: string;
    readonly version?: string;
    readonly capabilities?: readonly string[];
  }[];
}

export interface NativeAdapterRegistration {
  readonly system: SystemName;
  readonly globalName: string;
  readonly candidates: readonly SignatureCandidate[];
  readonly handler: (...args: unknown[]) => unknown;
}

const CAPABILITIES: RuntimeCapabilities = Object.freeze({
  binaryProtocol: true,
  perSystemFallback: true,
  adaptiveAssets: true,
  wasmPlugins: true,
  localDiagnostics: true,
  saveDirectoryAccess: false
});

export class KDHybridRuntime {
  readonly bridge = new WasmBatchBridge();
  readonly dispatcher: LegacySystemDispatcher;
  readonly quality: AdaptiveQualityController;
  readonly plugins = new CapabilityPluginHost();
  readonly #options: RuntimeOptions;
  readonly #registeredGlobals = new Set<string>();
  #initialized = false;
  #api: KDHybridPublicApi | null = null;

  constructor(options: RuntimeOptions = {}) {
    this.#options = options;
    this.dispatcher = new LegacySystemDispatcher(
      options.target ?? (globalThis as Record<string, unknown>)
    );
    this.quality = new AdaptiveQualityController(
      options.qualityEnvironment ?? defaultEnvironment(),
      options.qualityMode ?? "auto"
    );
  }

  async initializeNative(
    bindings: WasmBindings,
    wasmSource: RequestInfo | URL | Response | BufferSource | WebAssembly.Module
  ): Promise<void> {
    await this.bridge.initialize(bindings, wasmSource);
    this.#initialized = true;
  }

  registerAdapter(registration: NativeAdapterRegistration): SystemStatus {
    if (this.#registeredGlobals.has(registration.globalName)) {
      throw new Error(`Adapter ${registration.globalName} is already registered`);
    }
    this.#registeredGlobals.add(registration.globalName);
    return this.dispatcher.registerSystem({
      system: registration.system,
      globalName: registration.globalName,
      candidates: registration.candidates,
      native: registration.handler
    });
  }

  registerKnownAdapter(
    globalName: string,
    handler: (...args: unknown[]) => unknown
  ): SystemStatus {
    const facade = UPSTREAM_5_4_92_FACADES.find(
      (candidate) => candidate.globalName === globalName
    );
    if (facade === undefined) {
      throw new Error(`No known KD facade metadata for ${globalName}`);
    }
    const exactBundle =
      this.#options.upstreamBundleSha256 === undefined ||
      this.#options.upstreamBundleSha256.toLowerCase() ===
        KNOWN_UPSTREAM.bundleSha256;
    return this.registerAdapter({
      system: facade.system,
      globalName,
      candidates: exactBundle ? facade.candidates : [],
      handler
    });
  }

  installGlobal(): KDHybridPublicApi {
    if (this.#api !== null) {
      return this.#api;
    }
    const api: KDHybridPublicApi = Object.freeze({
      version: VERSION,
      abiVersion: ABI_VERSION,
      capabilities: CAPABILITIES,
      status: () => this.status(),
      systemStatus: (system?: SystemName) => {
        const statuses = this.dispatcher.status(system);
        return system === undefined ? statuses : (statuses[0] ?? missingStatus(system));
      },
      registerHook: (
        system: SystemName,
        phase: HookPhase,
        callback: HookCallback,
        options?: { id?: string; priority?: number }
      ) => this.dispatcher.registerHook(system, phase, callback, options),
      unregisterHook: (id: string) => this.dispatcher.unregisterHook(id),
      dispatch: (system: SystemName, ...args: unknown[]) =>
        this.dispatcher.dispatch(system, ...args),
      query: (payload: Uint8Array) => this.bridge.query(payload),
      enableSystem: (system: SystemName) => this.dispatcher.enable(system),
      disableSystem: (system: SystemName, reason?: string) =>
        this.dispatcher.disable(system, reason),
      registerWasmPlugin: (manifest: WasmPluginManifest, bytes: BufferSource) =>
        this.registerWasmPlugin(manifest, bytes),
      exportDiagnostics: (extra?: Record<string, unknown>) =>
        this.exportDiagnostics(extra)
    });
    globalThis.KDHybrid = api;
    this.#api = api;
    return api;
  }

  status(): RuntimeStatus {
    const bridge = this.bridge.stats();
    return Object.freeze({
      version: VERSION,
      abiVersion: ABI_VERSION,
      initialized: this.#initialized,
      upstreamVersion: this.#options.upstreamVersion ?? null,
      upstreamPackageVersion: this.#options.upstreamPackageVersion ?? null,
      upstreamBundleSha256: this.#options.upstreamBundleSha256 ?? null,
      nativeAvailable: !bridge.disabled,
      systems: this.dispatcher.status()
    });
  }

  async registerWasmPlugin(
    manifest: WasmPluginManifest,
    bytes: BufferSource
  ): Promise<WasmPluginHandle> {
    return this.plugins.register(manifest, bytes);
  }

  exportDiagnostics(extra?: Record<string, unknown>): string {
    return exportDiagnosticJson({
      runtime: this.status() as unknown as Record<string, unknown>,
      quality: this.quality.status() as unknown as Record<string, unknown>,
      bridge: this.bridge.stats() as unknown as Record<string, unknown>,
      ...(this.#options.mods === undefined ? {} : { mods: this.#options.mods }),
      ...(extra === undefined ? {} : { extra })
    });
  }

  dispose(): void {
    this.dispatcher.restore();
    this.plugins.dispose();
    this.bridge.dispose();
    if (globalThis.KDHybrid === this.#api) {
      globalThis.KDHybrid = undefined;
    }
    this.#api = null;
    this.#initialized = false;
  }
}

function defaultEnvironment(): QualityEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      width: 1920,
      height: 1080,
      devicePixelRatio: 1,
      deviceMemoryGiB: 8
    };
  }
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  const base: QualityEnvironment = {
    width: window.screen?.width ?? window.innerWidth,
    height: window.screen?.height ?? window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1
  };
  return navigatorWithMemory.deviceMemory === undefined
    ? base
    : { ...base, deviceMemoryGiB: navigatorWithMemory.deviceMemory };
}

function missingStatus(system: SystemName): SystemStatus {
  return Object.freeze({
    system,
    globalName: "",
    mode: "disabled",
    signature: null,
    calls: 0,
    nativeCalls: 0,
    fallbackCalls: 0,
    failures: 0,
    reason: "not-registered"
  });
}
