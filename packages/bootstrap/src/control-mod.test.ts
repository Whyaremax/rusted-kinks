import { describe, expect, it, vi } from "vitest";

import {
  installKDHybridControlMod,
  type KDHybridControlModStatus,
} from "./control-mod.js";
import type { KDHybridModBridgeApi } from "./mod-bridge-host.js";

function fixture(
  options: {
    readonly native?: boolean;
    readonly preflight?: boolean;
  } = {},
) {
  const configs: Record<string, unknown[]> = {};
  let settings: Record<string, unknown> = {};
  const events: {
    afterModSettingsLoad?: Record<string, (...args: unknown[]) => unknown>;
    afterModConfig?: Record<string, (...args: unknown[]) => unknown>;
  } = {};
  const text = new Map<string, string>();
  const applySettings = vi.fn((next) => ({
    available: true as const,
    version: "0.1.1",
    settings: next,
    activeTextureMode: "mobile" as const,
    restartRequired: next.textureMode !== "mobile",
    applyCount: 1,
  }));
  const bridge: KDHybridModBridgeApi | undefined =
    options.native === false
      ? undefined
      : {
          version: "0.1.1",
          status: () => ({
            available: true,
            version: "0.1.1",
            settings: {
              pathfindingMode: "fast",
              textureMode: "mobile",
              adaptiveFramePacing: true,
            },
            activeTextureMode: "mobile",
            restartRequired: false,
            applyCount: 0,
          }),
          applySettings,
        };
  const target: {
    KDHybridModBridge?: KDHybridModBridgeApi;
    KDHybridModPreflight?: {
      showManager(): void;
    };
    KDHybridControlMod?: {
      status(): KDHybridControlModStatus;
      dispose(): void;
    };
  } = {
    ...(bridge === undefined ? {} : { KDHybridModBridge: bridge }),
    ...(options.preflight === false
      ? {}
      : {
          KDHybridModPreflight: {
            showManager: vi.fn(),
          },
        }),
  };
  return {
    configs,
    events,
    text,
    target,
    applySettings,
    get settings() {
      return settings;
    },
    bindings: {
      configs,
      getSettings: () => settings,
      setSettings: (next: Record<string, unknown>) => {
        settings = next;
      },
      events,
      addText: (key: string, value: string) => {
        text.set(key, value);
      },
    },
  };
}

describe("genuine KD Hybrid control mod", () => {
  it("registers through KD's normal mod configuration API", () => {
    const state = fixture();
    const handle = installKDHybridControlMod({
      target: state.target,
      bindings: state.bindings,
    });

    expect(state.target.KDHybridControlMod).toBe(handle);
    expect(state.configs.KDHybrid).toEqual([
      expect.objectContaining({ type: "list", refvar: "pathfindingMode" }),
      expect.objectContaining({ type: "list", refvar: "textureMode" }),
      expect.objectContaining({
        type: "boolean",
        refvar: "adaptiveFramePacing",
      }),
      expect.objectContaining({
        type: "button",
        refvar: "modCompatibility",
      }),
      expect.objectContaining({ type: "text", refvar: "nativeStatus" }),
      expect.objectContaining({ type: "text", refvar: "textureRestart" }),
    ]);
    expect(state.text.get("KDModButtonKDHybrid")).toBe("KD Hybrid");
    expect(state.text.get("KDModButtonnativeStatus")).toContain(
      "Native bridge v0.1.1 ready",
    );
    const manager = state.configs.KDHybrid?.find(
      (entry) =>
        (entry as { readonly refvar?: unknown }).refvar === "modCompatibility",
    ) as
      | {
          readonly click: () => boolean;
          readonly block: () => boolean;
        }
      | undefined;
    expect(manager?.block()).toBe(false);
    expect(manager?.click()).toBe(true);
    expect(
      state.target.KDHybridModPreflight?.showManager,
    ).toHaveBeenCalledOnce();

    handle.dispose();
    expect(state.configs.KDHybrid).toBeUndefined();
    expect(state.target.KDHybridControlMod).toBeUndefined();
  });

  it("forwards KD's persisted options to the native bridge", () => {
    const state = fixture();
    installKDHybridControlMod({
      target: state.target,
      bindings: state.bindings,
    });
    state.settings.KDHybrid = {
      pathfindingMode: "human",
      textureMode: "full",
      adaptiveFramePacing: false,
    };

    state.events.afterModSettingsLoad?.KDHybrid?.({});

    expect(state.applySettings).toHaveBeenCalledWith({
      pathfindingMode: "human",
      textureMode: "full",
      adaptiveFramePacing: false,
    });
  });

  it("stays functional and explains when the native patch is absent", () => {
    const state = fixture({ native: false });
    const handle = installKDHybridControlMod({
      target: state.target,
      bindings: state.bindings,
    });

    state.events.afterModSettingsLoad?.KDHybrid?.({});

    expect(handle.status()).toMatchObject({
      installed: true,
      nativeAvailable: false,
      lastError: "native-bridge-unavailable",
    });
    expect(state.text.get("KDModButtonnativeStatus")).toContain(
      "Reinstall the KD Hybrid patch",
    );
  });

  it("blocks only the compatibility manager action when preflight is absent", () => {
    const state = fixture({ preflight: false });
    installKDHybridControlMod({
      target: state.target,
      bindings: state.bindings,
    });

    const manager = state.configs.KDHybrid?.find(
      (entry) =>
        (entry as { readonly refvar?: unknown }).refvar === "modCompatibility",
    ) as
      | {
          readonly click: () => boolean;
          readonly block: () => boolean;
        }
      | undefined;
    expect(manager?.block()).toBe(true);
    expect(manager?.click()).toBe(true);
  });
});
