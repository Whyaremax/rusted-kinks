import type { PathfindingMode } from "@kd-hybrid/runtime";

import type {
  KinkyDungeonFramePacingMode,
  KinkyDungeonRenderingHandle,
  KinkyDungeonTextureMode
} from "./rendering.js";

const MOD_ID = "KDHybrid";
const DEFAULT_POLL_INTERVAL_MS = 50;
const PATCH_ROW_X = 1500;
const PATCH_ROW_Y = 205;

type UnknownRecord = Record<string, unknown>;
type ModEvent = (...args: unknown[]) => unknown;
type DrawMods = (...args: unknown[]) => unknown;

declare let KDModConfigs: Record<string, KDModConfig[]>;
declare let KDModSettings: UnknownRecord | null;
declare let KDEventMapGeneric: {
  afterModSettingsLoad?: Record<string, ModEvent>;
  afterModConfig?: Record<string, ModEvent>;
};
declare let KDModLoadOrder: Array<{ readonly name: string }>;
declare let KDModInfo: Record<string, { readonly modname?: unknown }>;
declare let KDDrawMods: DrawMods;
declare const KDBaseElectricBlue: string;
declare const KDTextGray2: string;
declare function DrawTextKD(
  text: string,
  x: number,
  y: number,
  color: string,
  shadow: string
): unknown;
declare function addTextKey(key: string, value: string): void;

interface KDModConfig {
  readonly name: string;
  readonly type: "boolean" | "list" | "text";
  readonly refvar: string;
  readonly default?: boolean | string;
  readonly options?: readonly string[];
}

export interface KDHybridModSettings {
  readonly pathfindingMode: PathfindingMode;
  readonly textureMode: KinkyDungeonTextureMode;
  readonly adaptiveFramePacing: boolean;
}

export interface KinkyDungeonModUiStatus {
  readonly installed: boolean;
  readonly registrationAttempts: number;
  readonly patchRowsDrawn: number;
  readonly portableModListed: boolean;
  readonly settings: KDHybridModSettings;
  readonly lastError: string | null;
}

export interface KinkyDungeonModUiHandle {
  status(): KinkyDungeonModUiStatus;
  dispose(): void;
}

interface ModUiRuntime {
  status(): { readonly version: string };
  setPathfindingMode(mode: PathfindingMode): PathfindingMode;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface KinkyDungeonModUiOptions {
  readonly runtime: ModUiRuntime;
  readonly rendering: Pick<KinkyDungeonRenderingHandle, "setFramePacingMode">;
  readonly initialSettings: KDHybridModSettings;
  readonly target?: KinkyDungeonModUiTarget;
  readonly storage?: StorageLike | null;
  readonly pollIntervalMs?: number;
  readonly resolveBindings?: () => KinkyDungeonModUiBindings | null;
  readonly schedule?: (callback: () => void, intervalMs: number) => unknown;
  readonly cancel?: (handle: unknown) => void;
}

export interface KinkyDungeonModUiTarget {
  KDHybridModUi?: KinkyDungeonModUiHandle;
}

export interface KinkyDungeonModUiBindings {
  readonly configs: Record<string, KDModConfig[]>;
  getSettings(): UnknownRecord | null;
  setSettings(settings: UnknownRecord): void;
  readonly events: {
    afterModSettingsLoad?: Record<string, ModEvent>;
    afterModConfig?: Record<string, ModEvent>;
  };
  getDrawMods(): DrawMods;
  setDrawMods(draw: DrawMods): void;
  isPortableModListed(): boolean;
  addText(key: string, value: string): void;
  drawPatchRow(text: string): void;
}

interface MutableStatus {
  installed: boolean;
  registrationAttempts: number;
  patchRowsDrawn: number;
  portableModListed: boolean;
  settings: KDHybridModSettings;
  lastError: string | null;
}

export function readPersistedKDHybridModSettings(
  storage: StorageLike | null = defaultStorage()
): Partial<KDHybridModSettings> {
  if (storage === null) {
    return {};
  }
  try {
    const stored = JSON.parse(storage.getItem("KDModSettings") ?? "{}") as unknown;
    const allSettings = record(stored);
    return normalizePartialSettings(record(allSettings?.[MOD_ID]));
  } catch {
    return {};
  }
}

export function installKinkyDungeonModUi(
  options: KinkyDungeonModUiOptions
): KinkyDungeonModUiHandle {
  const target = options.target ?? (globalThis as KinkyDungeonModUiTarget);
  const resolveBindings = options.resolveBindings ?? resolveGlobalBindings;
  const schedule =
    options.schedule ??
    ((callback: () => void, intervalMs: number) =>
      setInterval(callback, intervalMs));
  const cancel =
    options.cancel ??
    ((handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>));
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const state: MutableStatus = {
    installed: false,
    registrationAttempts: 0,
    patchRowsDrawn: 0,
    portableModListed: false,
    settings: options.initialSettings,
    lastError: null
  };
  let disposed = false;
  let timer: unknown = null;
  let cleanup: (() => void) | null = null;
  const previousApi = target.KDHybridModUi;

  const poll = (): void => {
    if (disposed || state.installed) {
      return;
    }
    state.registrationAttempts += 1;
    try {
      const bindings = resolveBindings();
      if (bindings === null) {
        return;
      }
      cleanup = registerModUi(options, bindings, storage, state);
      state.installed = true;
      state.lastError = null;
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
    } catch (error) {
      state.lastError = errorMessage(error);
    }
  };

  const handle: KinkyDungeonModUiHandle = Object.freeze({
    status: () =>
      Object.freeze({
        ...state,
        settings: Object.freeze({ ...state.settings })
      }),
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
      cleanup?.();
      cleanup = null;
      state.installed = false;
      if (target.KDHybridModUi === handle) {
        if (previousApi === undefined) {
          delete target.KDHybridModUi;
        } else {
          target.KDHybridModUi = previousApi;
        }
      }
    }
  });

  target.KDHybridModUi = handle;
  poll();
  if (!state.installed) {
    timer = schedule(
      poll,
      Math.max(10, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
    );
  }
  return handle;
}

function registerModUi(
  options: KinkyDungeonModUiOptions,
  bindings: KinkyDungeonModUiBindings,
  storage: StorageLike | null,
  state: MutableStatus
): () => void {
  const previousConfig = bindings.configs[MOD_ID];
  const settingsLoadedEvents = (bindings.events.afterModSettingsLoad ??= {});
  const configEvents = (bindings.events.afterModConfig ??= {});
  const previousSettingsLoaded = settingsLoadedEvents[MOD_ID];
  const previousConfigEvent = configEvents[MOD_ID];
  const previousDrawMods = bindings.getDrawMods();

  const registerText = (): void => {
    bindings.addText(`KDModButton${MOD_ID}`, "KD Hybrid");
    bindings.addText("KDModButtonpathfindingMode", "Pathfinding mode");
    bindings.addText("KDModButtontextureMode", "Texture resolution");
    bindings.addText(
      "KDModButtonadaptiveFramePacing",
      "Adaptive frame pacing"
    );
    bindings.addText(
      "KDModButtontextureRestart",
      "Texture resolution changes apply after restarting KD."
    );
  };

  const ensureSettings = (): KDHybridModSettings => {
    const currentRoot = bindings.getSettings();
    const persistedRoot = readAllSettings(storage);
    const root: UnknownRecord = {
      ...persistedRoot,
      ...(currentRoot ?? {})
    };
    const current = normalizePartialSettings(record(root[MOD_ID]));
    const settings: KDHybridModSettings = {
      pathfindingMode:
        current.pathfindingMode ?? options.initialSettings.pathfindingMode,
      textureMode: current.textureMode ?? options.initialSettings.textureMode,
      adaptiveFramePacing:
        current.adaptiveFramePacing ??
        options.initialSettings.adaptiveFramePacing
    };
    root[MOD_ID] = { ...settings };
    bindings.setSettings(root);
    state.settings = settings;
    return settings;
  };

  const applySettings = (): void => {
    const settings = ensureSettings();
    options.runtime.setPathfindingMode(settings.pathfindingMode);
    const framePacingMode: KinkyDungeonFramePacingMode =
      settings.adaptiveFramePacing ? "adaptive" : "off";
    options.rendering.setFramePacingMode(framePacingMode);
    persistAllSettings(storage, bindings.getSettings());
  };

  registerText();
  const installedConfig: KDModConfig[] = [
    {
      name: "Pathfinding mode",
      type: "list",
      refvar: "pathfindingMode",
      options: ["fast", "quality", "human"],
      default: options.initialSettings.pathfindingMode
    },
    {
      name: "Texture resolution",
      type: "list",
      refvar: "textureMode",
      options: ["mobile", "full", "original"],
      default: options.initialSettings.textureMode
    },
    {
      name: "Adaptive frame pacing",
      type: "boolean",
      refvar: "adaptiveFramePacing",
      default: options.initialSettings.adaptiveFramePacing
    },
    {
      name: "Texture resolution changes apply after restarting KD.",
      type: "text",
      refvar: "textureRestart"
    }
  ];
  bindings.configs[MOD_ID] = installedConfig;
  ensureSettings();

  const settingsLoaded: ModEvent = (...args: unknown[]) => {
    previousSettingsLoaded?.(...args);
    registerText();
    ensureSettings();
  };
  const configApplied: ModEvent = (...args: unknown[]) => {
    previousConfigEvent?.(...args);
    applySettings();
  };
  settingsLoadedEvents[MOD_ID] = settingsLoaded;
  configEvents[MOD_ID] = configApplied;

  const drawMods: DrawMods = function (
    this: unknown,
    ...args: unknown[]
  ): unknown {
    const result = previousDrawMods.apply(this, args);
    const portableModListed = bindings.isPortableModListed();
    state.portableModListed = portableModListed;
    if (!portableModListed) {
      bindings.drawPatchRow(
        `KD Hybrid v${options.runtime.status().version} - installed integration patch`
      );
      state.patchRowsDrawn += 1;
    }
    return result;
  };
  bindings.setDrawMods(drawMods);

  return () => {
    if (bindings.getDrawMods() === drawMods) {
      bindings.setDrawMods(previousDrawMods);
    }
    if (settingsLoadedEvents[MOD_ID] === settingsLoaded) {
      if (previousSettingsLoaded === undefined) {
        delete settingsLoadedEvents[MOD_ID];
      } else {
        settingsLoadedEvents[MOD_ID] = previousSettingsLoaded;
      }
    }
    if (configEvents[MOD_ID] === configApplied) {
      if (previousConfigEvent === undefined) {
        delete configEvents[MOD_ID];
      } else {
        configEvents[MOD_ID] = previousConfigEvent;
      }
    }
    if (bindings.configs[MOD_ID] !== installedConfig) {
      return;
    }
    if (previousConfig === undefined) {
      delete bindings.configs[MOD_ID];
    } else {
      bindings.configs[MOD_ID] = previousConfig;
    }
  };
}

function resolveGlobalBindings(): KinkyDungeonModUiBindings | null {
  try {
    if (
      typeof KDModConfigs === "undefined" ||
      typeof KDModSettings === "undefined" ||
      typeof KDEventMapGeneric === "undefined" ||
      typeof KDDrawMods !== "function" ||
      typeof KDModLoadOrder === "undefined" ||
      typeof KDModInfo === "undefined" ||
      typeof addTextKey !== "function" ||
      typeof DrawTextKD !== "function"
    ) {
      return null;
    }
    return {
      configs: KDModConfigs,
      getSettings: () => KDModSettings,
      setSettings: (settings: UnknownRecord) => {
        KDModSettings = settings;
      },
      events: KDEventMapGeneric,
      getDrawMods: () => KDDrawMods,
      setDrawMods: (draw: DrawMods) => {
        KDDrawMods = draw;
      },
      isPortableModListed: () =>
        KDModLoadOrder.some(({ name }) => {
          const modname = KDModInfo[name]?.modname;
          return (
            typeof modname === "string" &&
            modname.replaceAll(/\s+/gu, "").toLowerCase() ===
              MOD_ID.toLowerCase()
          );
        }),
      addText: addTextKey,
      drawPatchRow: (text: string) => {
        DrawTextKD(
          text,
          PATCH_ROW_X,
          PATCH_ROW_Y,
          typeof KDBaseElectricBlue === "string"
            ? KDBaseElectricBlue
            : "#66e6ff",
          typeof KDTextGray2 === "string" ? KDTextGray2 : "#333333"
        );
      }
    };
  } catch {
    return null;
  }
}

function normalizePartialSettings(
  value: UnknownRecord | null
): Partial<KDHybridModSettings> {
  if (value === null) {
    return {};
  }
  const pathfindingMode = value.pathfindingMode;
  const textureMode = value.textureMode;
  const adaptiveFramePacing = value.adaptiveFramePacing;
  return {
    ...(isPathfindingMode(pathfindingMode) ? { pathfindingMode } : {}),
    ...(isTextureMode(textureMode) ? { textureMode } : {}),
    ...(typeof adaptiveFramePacing === "boolean"
      ? { adaptiveFramePacing }
      : {})
  };
}

function readAllSettings(storage: StorageLike | null): UnknownRecord {
  if (storage === null) {
    return {};
  }
  try {
    return record(JSON.parse(storage.getItem("KDModSettings") ?? "{}")) ?? {};
  } catch {
    return {};
  }
}

function persistAllSettings(
  storage: StorageLike | null,
  settings: UnknownRecord | null
): void {
  if (storage === null || settings === null) {
    return;
  }
  try {
    storage.setItem("KDModSettings", JSON.stringify(settings));
  } catch {
    // Storage can be unavailable on clean Electron profiles. The live settings
    // remain active for the current session.
  }
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function isPathfindingMode(value: unknown): value is PathfindingMode {
  return value === "fast" || value === "quality" || value === "human";
}

function isTextureMode(value: unknown): value is KinkyDungeonTextureMode {
  return value === "mobile" || value === "full" || value === "original";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
