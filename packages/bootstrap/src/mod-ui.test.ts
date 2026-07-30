import { describe, expect, it, vi } from "vitest";

import {
  installKinkyDungeonModUi,
  readPersistedKDHybridModSettings,
  type KinkyDungeonModUiBindings
} from "./mod-ui.js";

function fixture(options: { readonly portable?: boolean } = {}) {
  const configs: KinkyDungeonModUiBindings["configs"] = {};
  let settings: Record<string, unknown> = {};
  const events: KinkyDungeonModUiBindings["events"] = {};
  const text = new Map<string, string>();
  const rows: string[] = [];
  const originalDraw = vi.fn(() => "drawn");
  let drawMods = originalDraw;
  const bindings: KinkyDungeonModUiBindings = {
    configs,
    getSettings: () => settings,
    setSettings: (next) => {
      settings = next;
    },
    events,
    getDrawMods: () => drawMods,
    setDrawMods: (draw) => {
      drawMods = draw;
    },
    isPortableModListed: () => options.portable ?? false,
    addText: (key, value) => {
      text.set(key, value);
    },
    drawPatchRow: (value) => {
      rows.push(value);
    }
  };
  const runtime = {
    status: vi.fn(() => ({ version: "0.1.1" })),
    setPathfindingMode: vi.fn((mode: "fast" | "quality" | "human") => mode)
  };
  const rendering = {
    status: vi.fn(() => ({
      requestedTextureMode: "mobile" as const,
      framePacing: { mode: "adaptive" as const }
    })),
    setFramePacingMode: vi.fn()
  };
  return {
    bindings,
    configs,
    events,
    runtime,
    rendering,
    text,
    rows,
    originalDraw,
    get settings() {
      return settings;
    },
    draw: (...args: unknown[]) => drawMods(...args)
  };
}

describe("KD in-game mod integration", () => {
  it("registers a visible configuration tab and a patch row", () => {
    const state = fixture();
    const target: { KDHybridModUi?: unknown } = {};
    const handle = installKinkyDungeonModUi({
      runtime: state.runtime,
      rendering: state.rendering,
      initialSettings: {
        pathfindingMode: "fast",
        textureMode: "mobile",
        adaptiveFramePacing: true
      },
      storage: null,
      target,
      resolveBindings: () => state.bindings
    });

    expect(target.KDHybridModUi).toBe(handle);
    expect(handle.status().installed).toBe(true);
    expect(state.configs.KDHybrid).toEqual([
      expect.objectContaining({ type: "list", refvar: "pathfindingMode" }),
      expect.objectContaining({ type: "list", refvar: "textureMode" }),
      expect.objectContaining({
        type: "boolean",
        refvar: "adaptiveFramePacing"
      }),
      expect.objectContaining({ type: "text", refvar: "textureRestart" })
    ]);
    expect(state.text.get("KDModButtonKDHybrid")).toBe("KD Hybrid");
    expect(state.draw()).toBe("drawn");
    expect(state.originalDraw).toHaveBeenCalledOnce();
    expect(state.rows).toEqual([
      "KD Hybrid v0.1.1 - installed integration patch"
    ]);
    expect(handle.status().patchRowsDrawn).toBe(1);

    handle.dispose();
    expect(target.KDHybridModUi).toBeUndefined();
    expect(state.configs.KDHybrid).toBeUndefined();
    expect(state.draw()).toBe("drawn");
    expect(state.rows).toHaveLength(1);
  });

  it("does not duplicate the row when the portable mod is already listed", () => {
    const state = fixture({ portable: true });
    const handle = installKinkyDungeonModUi({
      runtime: state.runtime,
      rendering: state.rendering,
      initialSettings: {
        pathfindingMode: "fast",
        textureMode: "mobile",
        adaptiveFramePacing: true
      },
      storage: null,
      resolveBindings: () => state.bindings
    });

    state.draw();
    expect(state.rows).toEqual([]);
    expect(handle.status().portableModListed).toBe(true);
  });

  it("applies KD settings when the player leaves Mod Configuration", () => {
    const state = fixture();
    installKinkyDungeonModUi({
      runtime: state.runtime,
      rendering: state.rendering,
      initialSettings: {
        pathfindingMode: "fast",
        textureMode: "mobile",
        adaptiveFramePacing: true
      },
      storage: null,
      resolveBindings: () => state.bindings
    });
    const root = state.settings;
    root.KDHybrid = {
      pathfindingMode: "human",
      textureMode: "full",
      adaptiveFramePacing: false
    };

    state.events.afterModConfig?.KDHybrid?.("KDHybrid", {});

    expect(state.runtime.setPathfindingMode).toHaveBeenLastCalledWith("human");
    expect(state.rendering.setFramePacingMode).toHaveBeenLastCalledWith("off");
  });

  it("reads only valid persisted settings", () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          KDHybrid: {
            pathfindingMode: "quality",
            textureMode: "full",
            adaptiveFramePacing: false,
            ignored: "value"
          }
        })
      ),
      setItem: vi.fn()
    };

    expect(readPersistedKDHybridModSettings(storage)).toEqual({
      pathfindingMode: "quality",
      textureMode: "full",
      adaptiveFramePacing: false
    });
  });
});
