import { KNOWN_UPSTREAM } from "@kd-hybrid/runtime";

const SUPPORTED_PIXI_VERSION = "7.2.1";
const DEFAULT_SAMPLE_INTERVAL_MS = 5_000;
const DEFAULT_OVERRIDE_TIMEOUT_MS = 30_000;

type UnknownRecord = Record<string, unknown>;

export type KinkyDungeonTextureMode = "original" | "full" | "mobile";

interface MutableTexturePolicyStatus {
  compatible: boolean;
  compatibilityReason: string;
  requestedTextureMode: KinkyDungeonTextureMode;
  textureMode: KinkyDungeonTextureMode;
  textureOverrideApplied: boolean;
  textureOverrideRestored: boolean;
  uniqueBaseTextures: number;
  decodedTextureBytes: number | null;
  estimatedGpuTextureBytes: number | null;
  lastTextureSampleAt: number | null;
  lastError: string | null;
}

export interface KinkyDungeonTexturePolicyStatus {
  readonly compatible: boolean;
  readonly compatibilityReason: string;
  readonly requestedTextureMode: KinkyDungeonTextureMode;
  readonly textureMode: KinkyDungeonTextureMode;
  readonly textureOverrideApplied: boolean;
  readonly textureOverrideRestored: boolean;
  readonly uniqueBaseTextures: number;
  readonly decodedTextureBytes: number | null;
  readonly estimatedGpuTextureBytes: number | null;
  readonly lastTextureSampleAt: number | null;
  readonly lastError: string | null;
}

export interface KinkyDungeonTexturePolicyOptions {
  readonly upstreamVersion?: string;
  readonly upstreamBundleSha256?: string;
  readonly textureMode?: KinkyDungeonTextureMode;
  readonly textureSampleIntervalMs?: number;
  readonly textureOverrideTimeoutMs?: number;
  readonly now?: () => number;
  readonly scheduleTimeout?: (callback: () => void, delayMs: number) => unknown;
  readonly cancelTimeout?: (handle: unknown) => void;
}

export interface KinkyDungeonTexturePolicyHandle {
  status(): KinkyDungeonTexturePolicyStatus;
  sampleTextureMemory(): number | undefined;
  dispose(): void;
}

interface TexturePolicyTarget extends UnknownRecord {
  PIXI?: unknown;
  localStorage?: unknown;
  KDHybridTextures?: KinkyDungeonTexturePolicyHandle;
}

export function installKinkyDungeonTexturePolicy(
  options: KinkyDungeonTexturePolicyOptions,
  target: TexturePolicyTarget = globalThis as TexturePolicyTarget
): KinkyDungeonTexturePolicyHandle {
  const requestedTextureMode = options.textureMode ?? "original";
  const compatibility = compatibilityStatus(options, target);
  const now = options.now ?? (() => performance.now());
  const sampleInterval = Math.max(
    250,
    options.textureSampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS
  );
  const state: MutableTexturePolicyStatus = {
    compatible: compatibility.compatible,
    compatibilityReason: compatibility.reason,
    requestedTextureMode,
    textureMode: "original",
    textureOverrideApplied: false,
    textureOverrideRestored: false,
    uniqueBaseTextures: 0,
    decodedTextureBytes: null,
    estimatedGpuTextureBytes: null,
    lastTextureSampleAt: null,
    lastError: null
  };
  const restoreTextureOverride =
    compatibility.compatible && requestedTextureMode !== "original"
      ? installTextureModeOverride(options, target, state)
      : () => undefined;
  const previousApi = target.KDHybridTextures;
  let lastSampleAt = Number.NEGATIVE_INFINITY;
  let disposed = false;

  const handle: KinkyDungeonTexturePolicyHandle = Object.freeze({
    status: () => snapshot(state),
    sampleTextureMemory: () => {
      const sampledAt = now();
      if (sampledAt - lastSampleAt < sampleInterval) {
        return state.decodedTextureBytes ?? undefined;
      }
      lastSampleAt = sampledAt;
      try {
        const memory = measureTextureMemory(target);
        state.uniqueBaseTextures = memory.uniqueBaseTextures;
        state.decodedTextureBytes =
          memory.uniqueBaseTextures === 0 ? null : memory.decodedTextureBytes;
        state.estimatedGpuTextureBytes =
          memory.uniqueBaseTextures === 0
            ? null
            : memory.estimatedGpuTextureBytes;
        state.lastTextureSampleAt = sampledAt;
        if (state.lastError?.startsWith("texture-memory:") === true) {
          state.lastError = null;
        }
      } catch (error) {
        state.lastError = `texture-memory:${errorMessage(error)}`;
      }
      return state.decodedTextureBytes ?? undefined;
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      restoreTextureOverride();
      if (target.KDHybridTextures === handle) {
        if (previousApi === undefined) {
          delete target.KDHybridTextures;
        } else {
          target.KDHybridTextures = previousApi;
        }
      }
    }
  });
  target.KDHybridTextures = handle;
  return handle;
}

function compatibilityStatus(
  options: KinkyDungeonTexturePolicyOptions,
  target: TexturePolicyTarget
): { readonly compatible: boolean; readonly reason: string } {
  if (options.upstreamVersion !== KNOWN_UPSTREAM.gameVersion) {
    return {
      compatible: false,
      reason: `unsupported-kd-version:${options.upstreamVersion ?? "unknown"}`
    };
  }
  const bundleSha256 = options.upstreamBundleSha256?.toLowerCase();
  if (bundleSha256 !== KNOWN_UPSTREAM.bundleSha256) {
    return {
      compatible: false,
      reason: `unsupported-kd-bundle:${bundleSha256 ?? "unknown"}`
    };
  }
  const pixi = record(target.PIXI);
  const pixiVersion =
    typeof pixi?.VERSION === "string" ? pixi.VERSION : "unknown";
  if (pixiVersion !== SUPPORTED_PIXI_VERSION) {
    return {
      compatible: false,
      reason: `unsupported-pixi-version:${pixiVersion}`
    };
  }
  return {
    compatible: true,
    reason: "exact-kd-bundle-pixi-match"
  };
}

function installTextureModeOverride(
  options: KinkyDungeonTexturePolicyOptions,
  target: TexturePolicyTarget,
  state: MutableTexturePolicyStatus
): () => void {
  let storage: UnknownRecord | null;
  try {
    storage = record(target.localStorage);
  } catch (error) {
    state.lastError = `texture-mode:local-storage-access:${errorMessage(error)}`;
    return () => undefined;
  }
  const getItem = storage?.getItem;
  if (storage === null || typeof getItem !== "function") {
    state.lastError = "texture-mode:local-storage-unavailable";
    return () => undefined;
  }

  let startupToggles: string;
  let readsRemaining = 2;
  try {
    const original = Reflect.apply(getItem, storage, [
      "KDToggles"
    ]) as string | null;
    const parsed =
      original === null ? {} : (JSON.parse(original) as unknown);
    const toggles = plainRecord(parsed);
    if (toggles === null) {
      state.lastError = "texture-mode:invalid-kd-toggles";
      return () => undefined;
    }
    toggles.MobileTextures = state.requestedTextureMode === "mobile";
    startupToggles = JSON.stringify(toggles);
  } catch (error) {
    state.lastError = `texture-mode:${errorMessage(error)}`;
    return () => undefined;
  }

  let methodOwner: object | null = storage;
  while (
    methodOwner !== null &&
    !Object.prototype.hasOwnProperty.call(methodOwner, "getItem")
  ) {
    methodOwner = Object.getPrototypeOf(methodOwner) as object | null;
  }
  if (methodOwner === null) {
    state.lastError = "texture-mode:get-item-owner-unavailable";
    return () => undefined;
  }
  const previousDescriptor = Object.getOwnPropertyDescriptor(
    methodOwner,
    "getItem"
  );
  if (
    previousDescriptor === undefined ||
    previousDescriptor.configurable !== true ||
    typeof previousDescriptor.value !== "function"
  ) {
    state.lastError = "texture-mode:get-item-descriptor-unavailable";
    return () => undefined;
  }

  const schedule =
    options.scheduleTimeout ??
    ((callback: () => void, delayMs: number) =>
      setTimeout(callback, delayMs));
  const cancel =
    options.cancelTimeout ??
    ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let restored = false;
  let timer: unknown = null;
  let wrappedGetItem: (this: unknown, key: unknown) => unknown;
  const restore = (timedOut = false): void => {
    if (restored) {
      return;
    }
    restored = true;
    if (readsRemaining > 0) {
      state.textureMode = "original";
    }
    if (timer !== null) {
      try {
        cancel(timer);
      } catch (error) {
        state.lastError = `texture-mode-cancel:${errorMessage(error)}`;
      }
      timer = null;
    }
    const currentDescriptor = Object.getOwnPropertyDescriptor(
      methodOwner,
      "getItem"
    );
    if (currentDescriptor?.value !== wrappedGetItem) {
      state.lastError = "texture-mode:get-item-replaced-before-restore";
      return;
    }
    try {
      Object.defineProperty(methodOwner, "getItem", previousDescriptor);
      state.textureOverrideRestored = true;
      if (timedOut && readsRemaining > 0) {
        state.lastError = "texture-mode:toggle-read-timeout";
      }
    } catch (error) {
      state.lastError = `texture-mode-restore:${errorMessage(error)}`;
    }
  };
  wrappedGetItem = function (
    this: unknown,
    key: unknown
  ): unknown {
    if (this === storage && key === "KDToggles" && readsRemaining > 0) {
      readsRemaining -= 1;
      const value = startupToggles;
      if (readsRemaining === 0) {
        restore();
      }
      return value;
    }
    return Reflect.apply(getItem, this, [key]);
  };

  try {
    Object.defineProperty(methodOwner, "getItem", {
      ...previousDescriptor,
      value: wrappedGetItem
    });
    state.textureOverrideApplied = true;
    state.textureMode = state.requestedTextureMode;
  } catch (error) {
    state.lastError = `texture-mode-hook:${errorMessage(error)}`;
    return () => undefined;
  }
  try {
    timer = schedule(
      () => restore(true),
      Math.max(
        1_000,
        options.textureOverrideTimeoutMs ?? DEFAULT_OVERRIDE_TIMEOUT_MS
      )
    );
  } catch (error) {
    state.lastError = `texture-mode-schedule:${errorMessage(error)}`;
    state.textureMode = "original";
    restore();
  }
  return () => restore();
}

function measureTextureMemory(target: TexturePolicyTarget): {
  readonly uniqueBaseTextures: number;
  readonly decodedTextureBytes: number;
  readonly estimatedGpuTextureBytes: number;
} {
  const bases = new Set<object>();
  const visited = new Set<object>();
  const pixi = record(target.PIXI);

  for (const source of [
    target.kdpixitex,
    target.kdTexcache,
    target.kdRTcache,
    record(pixi?.utils)?.TextureCache,
    record(pixi?.utils)?.BaseTextureCache,
    pixi?.TextureCache,
    pixi?.BaseTextureCache
  ]) {
    visitCollection(source, bases, visited);
  }

  const assetCache = record(record(pixi?.Assets)?.cache);
  for (const key of ["_cache", "_cacheMap", "cache"]) {
    visitCollection(assetCache?.[key], bases, visited);
  }

  let decodedTextureBytes = 0;
  let estimatedGpuTextureBytes = 0;
  for (const base of bases) {
    const value = base as UnknownRecord;
    const resource = record(value.resource);
    const source = record(resource?.source);
    const width =
      positiveNumber(value.realWidth) ??
      positiveNumber(source?.naturalWidth) ??
      positiveNumber(source?.videoWidth) ??
      positiveNumber(value.width);
    const height =
      positiveNumber(value.realHeight) ??
      positiveNumber(source?.naturalHeight) ??
      positiveNumber(source?.videoHeight) ??
      positiveNumber(value.height);
    if (width === null || height === null) {
      continue;
    }
    const bytes = width * height * 4;
    if (!Number.isSafeInteger(bytes) || bytes <= 0) {
      continue;
    }
    decodedTextureBytes += bytes;
    estimatedGpuTextureBytes +=
      value.mipmap === 0 || value.mipmap === undefined
        ? bytes
        : Math.ceil((bytes * 4) / 3);
  }

  return {
    uniqueBaseTextures: bases.size,
    decodedTextureBytes,
    estimatedGpuTextureBytes
  };
}

function visitCollection(
  value: unknown,
  bases: Set<object>,
  visited: Set<object>
): void {
  if (value instanceof Map) {
    for (const entry of value.values()) {
      visitResource(entry, bases, visited);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      visitResource(entry, bases, visited);
    }
    return;
  }
  const object = record(value);
  if (object === null) {
    return;
  }
  for (const entry of Object.values(object)) {
    visitResource(entry, bases, visited);
  }
}

function visitResource(
  value: unknown,
  bases: Set<object>,
  visited: Set<object>
): void {
  const object = record(value);
  if (object === null || visited.has(object)) {
    return;
  }
  visited.add(object);

  const baseTexture = record(object.baseTexture);
  if (baseTexture !== null) {
    bases.add(baseTexture);
  } else if (
    object.resource !== undefined &&
    (object.realWidth !== undefined || object.width !== undefined)
  ) {
    bases.add(object);
  }

  visitCollection(object.textures, bases, visited);
  visitCollection(object.linkedSheets, bases, visited);
}

function snapshot(
  state: MutableTexturePolicyStatus
): KinkyDungeonTexturePolicyStatus {
  return Object.freeze({ ...state });
}

function plainRecord(value: unknown): UnknownRecord | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null
    ? (value as UnknownRecord)
    : null;
}

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : null;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
