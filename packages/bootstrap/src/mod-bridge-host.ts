import type { PathfindingMode } from "@kd-hybrid/runtime";

import type {
  KinkyDungeonFramePacingMode,
  KinkyDungeonRenderingHandle,
  KinkyDungeonTextureMode
} from "./rendering.js";

const MOD_ID = "KDHybrid";

type UnknownRecord = Record<string, unknown>;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ModBridgeRuntime {
  status(): { readonly version: string };
  setPathfindingMode(mode: PathfindingMode): PathfindingMode;
}

export interface KDHybridModSettings {
  readonly pathfindingMode: PathfindingMode;
  readonly textureMode: KinkyDungeonTextureMode;
  readonly adaptiveFramePacing: boolean;
}

export interface KDHybridModBridgeStatus {
  readonly available: true;
  readonly version: string;
  readonly settings: KDHybridModSettings;
  readonly activeTextureMode: KinkyDungeonTextureMode;
  readonly restartRequired: boolean;
  readonly applyCount: number;
}

export interface KDHybridModBridgeApi {
  readonly version: string;
  status(): KDHybridModBridgeStatus;
  applySettings(
    settings: Partial<KDHybridModSettings>
  ): KDHybridModBridgeStatus;
}

export interface KinkyDungeonModBridgeHostHandle {
  readonly api: KDHybridModBridgeApi;
  status(): KDHybridModBridgeStatus;
  dispose(): void;
}

export interface KinkyDungeonModBridgeHostTarget {
  KDHybridModBridge?: KDHybridModBridgeApi;
}

export interface KinkyDungeonModBridgeHostOptions {
  readonly runtime: ModBridgeRuntime;
  readonly rendering: Pick<KinkyDungeonRenderingHandle, "setFramePacingMode">;
  readonly initialSettings: KDHybridModSettings;
  readonly target?: KinkyDungeonModBridgeHostTarget;
  readonly storage?: StorageLike | null;
}

export function readPersistedKDHybridModSettings(
  storage: StorageLike | null = defaultStorage()
): Partial<KDHybridModSettings> {
  if (storage === null) {
    return {};
  }
  try {
    const root = record(JSON.parse(storage.getItem("KDModSettings") ?? "{}"));
    return normalizePartialSettings(record(root?.[MOD_ID]));
  } catch {
    return {};
  }
}

export function installKinkyDungeonModBridgeHost(
  options: KinkyDungeonModBridgeHostOptions
): KinkyDungeonModBridgeHostHandle {
  const target =
    options.target ?? (globalThis as KinkyDungeonModBridgeHostTarget);
  const storage =
    options.storage === undefined ? defaultStorage() : options.storage;
  const previousApi = target.KDHybridModBridge;
  const version = options.runtime.status().version;
  const activeTextureMode = options.initialSettings.textureMode;
  let settings = { ...options.initialSettings };
  let applyCount = 0;
  let disposed = false;

  const currentStatus = (): KDHybridModBridgeStatus =>
    Object.freeze({
      available: true,
      version,
      settings: Object.freeze({ ...settings }),
      activeTextureMode,
      restartRequired: settings.textureMode !== activeTextureMode,
      applyCount
    });

  const api: KDHybridModBridgeApi = Object.freeze({
    version,
    status: currentStatus,
    applySettings: (changes: Partial<KDHybridModSettings>) => {
      if (disposed) {
        throw new Error("KD Hybrid mod bridge is disposed");
      }
      settings = normalizeSettings(changes, settings);
      options.runtime.setPathfindingMode(settings.pathfindingMode);
      const framePacingMode: KinkyDungeonFramePacingMode =
        settings.adaptiveFramePacing ? "adaptive" : "off";
      options.rendering.setFramePacingMode(framePacingMode);
      persistSettings(storage, settings);
      applyCount += 1;
      return currentStatus();
    }
  });

  const handle: KinkyDungeonModBridgeHostHandle = Object.freeze({
    api,
    status: currentStatus,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      if (target.KDHybridModBridge === api) {
        if (previousApi === undefined) {
          delete target.KDHybridModBridge;
        } else {
          target.KDHybridModBridge = previousApi;
        }
      }
    }
  });

  target.KDHybridModBridge = api;
  return handle;
}

function normalizeSettings(
  changes: Partial<KDHybridModSettings>,
  current: KDHybridModSettings
): KDHybridModSettings {
  const value = record(changes);
  if (value === null) {
    throw new TypeError("KD Hybrid mod settings must be an object");
  }
  const pathfindingMode =
    value.pathfindingMode === undefined
      ? current.pathfindingMode
      : requirePathfindingMode(value.pathfindingMode);
  const textureMode =
    value.textureMode === undefined
      ? current.textureMode
      : requireTextureMode(value.textureMode);
  const adaptiveFramePacing =
    value.adaptiveFramePacing === undefined
      ? current.adaptiveFramePacing
      : requireBoolean(value.adaptiveFramePacing, "adaptiveFramePacing");
  return {
    pathfindingMode,
    textureMode,
    adaptiveFramePacing
  };
}

function normalizePartialSettings(
  value: UnknownRecord | null
): Partial<KDHybridModSettings> {
  if (value === null) {
    return {};
  }
  return {
    ...(isPathfindingMode(value.pathfindingMode)
      ? { pathfindingMode: value.pathfindingMode }
      : {}),
    ...(isTextureMode(value.textureMode)
      ? { textureMode: value.textureMode }
      : {}),
    ...(typeof value.adaptiveFramePacing === "boolean"
      ? { adaptiveFramePacing: value.adaptiveFramePacing }
      : {})
  };
}

function persistSettings(
  storage: StorageLike | null,
  settings: KDHybridModSettings
): void {
  if (storage === null) {
    return;
  }
  try {
    const root =
      record(JSON.parse(storage.getItem("KDModSettings") ?? "{}")) ?? {};
    root[MOD_ID] = { ...settings };
    storage.setItem("KDModSettings", JSON.stringify(root));
  } catch {
    // KD keeps the live object for this session when storage is unavailable.
  }
}

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function requirePathfindingMode(value: unknown): PathfindingMode {
  if (!isPathfindingMode(value)) {
    throw new RangeError(`Unknown pathfinding mode ${String(value)}`);
  }
  return value;
}

function requireTextureMode(value: unknown): KinkyDungeonTextureMode {
  if (!isTextureMode(value)) {
    throw new RangeError(`Unknown texture mode ${String(value)}`);
  }
  return value;
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`${name} must be a boolean`);
  }
  return value;
}

function isPathfindingMode(value: unknown): value is PathfindingMode {
  return value === "fast" || value === "quality" || value === "human";
}

function isTextureMode(value: unknown): value is KinkyDungeonTextureMode {
  return value === "mobile" || value === "full" || value === "original";
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
