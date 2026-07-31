import type {
  KDHybridModBridgeApi,
  KDHybridModSettings,
} from "./mod-bridge-host.js";
import type { KinkyDungeonModPreflightHandle } from "./mod-preflight-host.js";

const MOD_ID = "KDHybrid";

type UnknownRecord = Record<string, unknown>;
type ModEvent = (...args: unknown[]) => unknown;

declare let KDModConfigs: Record<string, KDModConfig[]>;
declare let KDModSettings: UnknownRecord | null;
declare let KDEventMapGeneric: {
  afterModSettingsLoad?: Record<string, ModEvent>;
  afterModConfig?: Record<string, ModEvent>;
};
declare function addTextKey(key: string, value: string): void;

interface KDModConfig {
  readonly name: string;
  readonly type: "boolean" | "button" | "list" | "text";
  readonly refvar: string;
  readonly default?: boolean | string;
  readonly options?: readonly string[];
  readonly click?: (...args: unknown[]) => boolean;
  readonly block?: () => boolean;
}

interface ControlModTarget {
  KDHybridModBridge?: KDHybridModBridgeApi;
  KDHybridControlMod?: KDHybridControlModHandle;
  KDHybridModPreflight?: Pick<KinkyDungeonModPreflightHandle, "showManager">;
}

interface ControlModBindings {
  readonly configs: Record<string, KDModConfig[]>;
  getSettings(): UnknownRecord | null;
  setSettings(settings: UnknownRecord): void;
  readonly events: {
    afterModSettingsLoad?: Record<string, ModEvent>;
    afterModConfig?: Record<string, ModEvent>;
  };
  addText(key: string, value: string): void;
}

export interface KDHybridControlModStatus {
  readonly installed: boolean;
  readonly nativeAvailable: boolean;
  readonly settings: KDHybridModSettings;
  readonly lastError: string | null;
}

export interface KDHybridControlModHandle {
  status(): KDHybridControlModStatus;
  dispose(): void;
}

export interface KDHybridControlModOptions {
  readonly target?: ControlModTarget;
  readonly bindings?: ControlModBindings;
}

export function installKDHybridControlMod(
  options: KDHybridControlModOptions = {},
): KDHybridControlModHandle {
  const target = options.target ?? (globalThis as ControlModTarget);
  const existing = target.KDHybridControlMod;
  if (existing !== undefined) {
    return existing;
  }
  const bindings = options.bindings ?? resolveGlobalBindings();
  if (bindings === null) {
    throw new Error("KD mod configuration API is unavailable");
  }
  const previousConfig = bindings.configs[MOD_ID];
  const settingsLoadedEvents = (bindings.events.afterModSettingsLoad ??= {});
  const configEvents = (bindings.events.afterModConfig ??= {});
  const previousSettingsLoaded = settingsLoadedEvents[MOD_ID];
  const previousConfigEvent = configEvents[MOD_ID];
  let disposed = false;
  let lastError: string | null = null;

  const defaults = (): KDHybridModSettings => {
    try {
      return (
        target.KDHybridModBridge?.status().settings ?? {
          pathfindingMode: "fast",
          textureMode: "mobile",
          adaptiveFramePacing: true,
        }
      );
    } catch {
      return {
        pathfindingMode: "fast",
        textureMode: "mobile",
        adaptiveFramePacing: true,
      };
    }
  };

  const ensureSettings = (): KDHybridModSettings => {
    const root = bindings.getSettings() ?? {};
    const current = record(root[MOD_ID]);
    const fallback = defaults();
    const settings: KDHybridModSettings = {
      pathfindingMode: isPathfindingMode(current?.pathfindingMode)
        ? current.pathfindingMode
        : fallback.pathfindingMode,
      textureMode: isTextureMode(current?.textureMode)
        ? current.textureMode
        : fallback.textureMode,
      adaptiveFramePacing:
        typeof current?.adaptiveFramePacing === "boolean"
          ? current.adaptiveFramePacing
          : fallback.adaptiveFramePacing,
    };
    root[MOD_ID] = { ...settings };
    bindings.setSettings(root);
    return settings;
  };

  const registerText = (): void => {
    const host = target.KDHybridModBridge;
    let statusText =
      "Native bridge unavailable. Reinstall the KD Hybrid patch.";
    if (host !== undefined) {
      try {
        const status = host.status();
        statusText = status.restartRequired
          ? `Native bridge v${status.version} ready. Restart KD to apply textures.`
          : `Native bridge v${status.version} ready.`;
      } catch (error) {
        statusText = `Native bridge error: ${errorMessage(error)}`;
      }
    }
    bindings.addText(`KDModButton${MOD_ID}`, "KD Hybrid");
    bindings.addText("KDModButtonpathfindingMode", "Pathfinding mode");
    bindings.addText("KDModButtontextureMode", "Texture resolution");
    bindings.addText("KDModButtonadaptiveFramePacing", "Adaptive frame pacing");
    bindings.addText(
      "KDModButtonmodCompatibility",
      "Manage mod compatibility choices",
    );
    bindings.addText("KDModButtonnativeStatus", statusText);
    bindings.addText(
      "KDModButtontextureRestart",
      "Texture resolution changes apply after restarting KD.",
    );
  };

  const applySettings = (): void => {
    const settings = ensureSettings();
    const host = target.KDHybridModBridge;
    if (host === undefined) {
      lastError = "native-bridge-unavailable";
      registerText();
      return;
    }
    try {
      host.applySettings(settings);
      lastError = null;
    } catch (error) {
      lastError = errorMessage(error);
    }
    registerText();
  };

  const installedConfig: KDModConfig[] = [
    {
      name: "Pathfinding mode",
      type: "list",
      refvar: "pathfindingMode",
      options: ["fast", "quality", "human"],
      default: defaults().pathfindingMode,
    },
    {
      name: "Texture resolution",
      type: "list",
      refvar: "textureMode",
      options: ["mobile", "full", "original"],
      default: defaults().textureMode,
    },
    {
      name: "Adaptive frame pacing",
      type: "boolean",
      refvar: "adaptiveFramePacing",
      default: defaults().adaptiveFramePacing,
    },
    {
      name: "Manage mod compatibility choices",
      type: "button",
      refvar: "modCompatibility",
      click: () => {
        target.KDHybridModPreflight?.showManager();
        return true;
      },
      block: () => target.KDHybridModPreflight === undefined,
    },
    {
      name: "Native bridge status",
      type: "text",
      refvar: "nativeStatus",
    },
    {
      name: "Texture restart reminder",
      type: "text",
      refvar: "textureRestart",
    },
  ];

  registerText();
  bindings.configs[MOD_ID] = installedConfig;
  ensureSettings();

  const settingsLoaded: ModEvent = (...args: unknown[]) => {
    previousSettingsLoaded?.(...args);
    applySettings();
  };
  const configApplied: ModEvent = (...args: unknown[]) => {
    previousConfigEvent?.(...args);
    applySettings();
  };
  settingsLoadedEvents[MOD_ID] = settingsLoaded;
  configEvents[MOD_ID] = configApplied;

  const handle: KDHybridControlModHandle = Object.freeze({
    status: () =>
      Object.freeze({
        installed: !disposed,
        nativeAvailable: target.KDHybridModBridge !== undefined,
        settings: Object.freeze({ ...ensureSettings() }),
        lastError,
      }),
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
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
      if (bindings.configs[MOD_ID] === installedConfig) {
        if (previousConfig === undefined) {
          delete bindings.configs[MOD_ID];
        } else {
          bindings.configs[MOD_ID] = previousConfig;
        }
      }
      if (target.KDHybridControlMod === handle) {
        delete target.KDHybridControlMod;
      }
    },
  });

  target.KDHybridControlMod = handle;
  return handle;
}

function resolveGlobalBindings(): ControlModBindings | null {
  try {
    if (
      typeof KDModConfigs === "undefined" ||
      typeof KDModSettings === "undefined" ||
      typeof KDEventMapGeneric === "undefined" ||
      typeof addTextKey !== "function"
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
      addText: addTextKey,
    };
  } catch {
    return null;
  }
}

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function isPathfindingMode(
  value: unknown,
): value is KDHybridModSettings["pathfindingMode"] {
  return value === "fast" || value === "quality" || value === "human";
}

function isTextureMode(
  value: unknown,
): value is KDHybridModSettings["textureMode"] {
  return value === "mobile" || value === "full" || value === "original";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
