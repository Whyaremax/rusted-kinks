export const SYSTEM_NAMES = [
  "movement",
  "pathfinding",
  "ai",
  "combat",
  "buffs",
  "events",
  "mapGeneration",
  "saves"
] as const;

export type SystemName = (typeof SYSTEM_NAMES)[number];
export type SystemMode = "native" | "js-fallback" | "disabled";
export type PathfindingMode = "quality" | "fast" | "human";

export interface SystemStatus {
  readonly system: SystemName;
  readonly globalName: string;
  readonly mode: SystemMode;
  readonly signature: string | null;
  readonly calls: number;
  readonly nativeCalls: number;
  readonly fallbackCalls: number;
  readonly failures: number;
  readonly reason: string | null;
}

export type HookPhase = "before" | "after" | "error";

export interface HookContext {
  readonly system: SystemName;
  readonly globalName: string;
  args: unknown[];
  result?: unknown;
  error?: unknown;
  cancelled: boolean;
}

export type HookCallback = (context: HookContext) => void;

export interface HookRegistration {
  readonly id: string;
  readonly system: SystemName;
  readonly phase: HookPhase;
  readonly priority: number;
  readonly callback: HookCallback;
}

export interface RuntimeStatus {
  readonly version: string;
  readonly abiVersion: number;
  readonly initialized: boolean;
  readonly upstreamVersion: string | null;
  readonly upstreamPackageVersion: string | null;
  readonly upstreamBundleSha256: string | null;
  readonly nativeAvailable: boolean;
  readonly pathfindingMode: PathfindingMode;
  readonly systems: readonly SystemStatus[];
}

export interface RuntimeCapabilities {
  readonly binaryProtocol: true;
  readonly perSystemFallback: true;
  readonly adaptiveAssets: true;
  readonly wasmPlugins: true;
  readonly localDiagnostics: true;
  readonly saveDirectoryAccess: false;
}

export interface KDHybridPublicApi {
  readonly version: string;
  readonly abiVersion: number;
  readonly capabilities: RuntimeCapabilities;
  status(): RuntimeStatus;
  systemStatus(system?: SystemName): SystemStatus | readonly SystemStatus[];
  registerHook(
    system: SystemName,
    phase: HookPhase,
    callback: HookCallback,
    options?: { id?: string; priority?: number }
  ): string;
  unregisterHook(id: string): boolean;
  dispatch(system: SystemName, ...args: unknown[]): unknown;
  query(payload: Uint8Array): Uint8Array;
  getPathfindingMode(): PathfindingMode;
  setPathfindingMode(mode: PathfindingMode): PathfindingMode;
  enableSystem(system: SystemName): boolean;
  disableSystem(system: SystemName, reason?: string): boolean;
  registerWasmPlugin(
    manifest: WasmPluginManifest,
    bytes: BufferSource
  ): Promise<WasmPluginHandle>;
  exportDiagnostics(extra?: Record<string, unknown>): string;
}

export type WasmPluginCapability =
  | "read-state"
  | "propose-actions"
  | "receive-events"
  | "path-query"
  | "diagnostics"
  | "deterministic-random";

export interface WasmPluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly abi: number;
  readonly capabilities: readonly WasmPluginCapability[];
  readonly systems: readonly SystemName[];
  readonly maxMemoryPages: number;
}

export interface WasmPluginHandle {
  readonly id: string;
  readonly manifest: WasmPluginManifest;
  readonly active: boolean;
  invoke(payload: Uint8Array): Uint8Array;
  dispose(): void;
}

export interface MapGenerationPathfindingDirectFallbackStats {
  optimizedMaps: number;
  fallbackMaps: number;
}

export interface MapGenerationPathCacheEdgeIdentityStats {
  optimizedMaps: number;
  fallbackMaps: number;
}

export interface TranslatedModSourceOptimizationStats {
  optimizedMaps: number;
  fallbackMaps: number;
}

declare global {
  // eslint-disable-next-line no-var
  var KDHybrid: KDHybridPublicApi | undefined;
  // eslint-disable-next-line no-var
  var KDHybridBootstrapConfig:
    | {
        upstreamVersion?: string;
        upstreamPackageVersion?: string;
        upstreamBundleSha256?: string;
        wasmUrl?: string;
        quality?: "high" | "balanced" | "performance" | "auto";
        pathfindingMode?: PathfindingMode;
        rendering?: {
          textureMode?: "original" | "full" | "mobile";
          framePacingMode?: "off" | "adaptive";
        };
      }
    | undefined;
  // Developer-only A/B controls. Production defaults use the optimized path.
  // eslint-disable-next-line no-var
  var KDHybridRuntimeControl:
    | {
        disableMapGenerationPathfindingDirectFallback?: boolean;
        mapGenerationPathfindingDirectFallbackStats?:
          MapGenerationPathfindingDirectFallbackStats;
        disableMapGenerationPathCacheEdgeIdentitySkip?: boolean;
        mapGenerationPathCacheEdgeIdentityStats?:
          MapGenerationPathCacheEdgeIdentityStats;
        disableTranslatedModSourceOptimizations?: boolean;
        translatedModSourceOptimizationStats?:
          TranslatedModSourceOptimizationStats;
        disableGpuFramePacing?: boolean;
      }
    | undefined;
}
