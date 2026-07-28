import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CapabilityPluginHost } from "./plugins.js";
import { KDHybridRuntime } from "./runtime.js";
import type {
  HookCallback,
  KDHybridPublicApi,
  WasmPluginManifest,
} from "./types.js";

describe("Mod SDK examples", () => {
  it("installs, observes, and cleanly removes the JavaScript hook example", async () => {
    const source = await readFile(
      path.resolve("examples/mod-sdk/javascript-hooks.js"),
      "utf8",
    );
    let hook:
      | {
          readonly id: string;
          readonly callback: HookCallback;
        }
      | undefined;
    const api = {
      registerHook: (
        system: string,
        phase: string,
        callback: HookCallback,
        options?: { id?: string },
      ) => {
        expect(system).toBe("pathfinding");
        expect(phase).toBe("after");
        hook = {
          id: options?.id ?? "generated-hook",
          callback,
        };
        return hook.id;
      },
      unregisterHook: (id: string) => {
        if (hook?.id !== id) {
          return false;
        }
        hook = undefined;
        return true;
      },
    } as KDHybridPublicApi;
    const target = globalThis as typeof globalThis & {
      KDHybridHookExample?: {
        install(): string;
        dispose(): boolean;
        status(): {
          readonly installed: boolean;
          readonly observedCalls: number;
          readonly lastGlobalName: string | null;
        };
      };
    };
    const previousApi = target.KDHybrid;
    const previousExample = target.KDHybridHookExample;
    try {
      target.KDHybrid = api;
      Function(source)();
      const example = target.KDHybridHookExample;
      expect(example?.install()).toBe(
        "rusted-kinks.example.pathfinding-observer",
      );
      hook?.callback({
        system: "pathfinding",
        globalName: "KinkyDungeonFindPath",
        args: [],
        result: [],
        cancelled: false,
      });
      expect(example?.status()).toMatchObject({
        installed: true,
        observedCalls: 1,
        lastGlobalName: "KinkyDungeonFindPath",
      });
      expect(example?.dispose()).toBe(true);
      expect(example?.status().installed).toBe(false);
      expect(hook).toBeUndefined();
    } finally {
      target.KDHybrid = previousApi;
      if (previousExample === undefined) {
        Reflect.deleteProperty(target, "KDHybridHookExample");
      } else {
        target.KDHybridHookExample = previousExample;
      }
    }
  });

  const pluginPath = process.env.KD_HYBRID_SDK_PLUGIN;
  const diagnosticPluginPath =
    process.env.KD_HYBRID_SDK_DIAGNOSTIC_PLUGIN;
  const pluginTest = pluginPath && diagnosticPluginPath ? it : it.skip;
  pluginTest(
    "loads and invokes the compiled Rust ABI example through the real host",
    async () => {
      const manifest = JSON.parse(
        await readFile(
          path.resolve(
            "examples/mod-sdk/rust-echo/plugin-manifest.json",
          ),
          "utf8",
        ),
      ) as WasmPluginManifest;
      const bytes = await readFile(pluginPath!);
      const runtime = new KDHybridRuntime({ target: {} });
      try {
        const plugin = await runtime.registerWasmPlugin(manifest, bytes);
        expect(plugin.id).toBe("rusted-kinks.echo");
        expect(plugin.invoke(Uint8Array.of(1, 2, 3, 4))).toEqual(
          Uint8Array.of(4, 3, 2, 1),
        );
        const diagnosticJson = runtime.exportDiagnostics();
        expect(diagnosticJson).not.toContain(manifest.id);
        expect(JSON.parse(diagnosticJson).mods).toEqual([
          {
            id: expect.any(String),
            kind: "wasm",
            version: manifest.version,
            capabilities: manifest.capabilities,
            systems: manifest.systems,
          },
        ]);
        plugin.dispose();
        expect(plugin.active).toBe(false);
        expect(() => plugin.invoke(Uint8Array.of(1))).toThrow(/disposed/u);
        expect(runtime.plugins.manifests()).toEqual([]);
        expect(JSON.parse(runtime.exportDiagnostics()).mods).toEqual([]);
      } finally {
        runtime.dispose();
      }

      const diagnosticBytes = await readFile(diagnosticPluginPath!);
      const diagnosticManifest = {
        ...manifest,
        id: "rusted-kinks.echo-diagnostic",
        capabilities: ["diagnostics"],
      } as const;
      const host = new CapabilityPluginHost();
      await expect(
        host.register(diagnosticManifest, diagnosticBytes),
      ).rejects.toThrow(/Host capability diagnostics is not available/u);

      let diagnosticCalls = 0;
      const capableHost = new CapabilityPluginHost({
        emitDiagnostic: () => {
          diagnosticCalls += 1;
        },
      });
      const diagnosticPlugin = await capableHost.register(
        diagnosticManifest,
        diagnosticBytes,
      );
      expect(diagnosticPlugin.invoke(Uint8Array.of(5, 6, 7))).toEqual(
        Uint8Array.of(7, 6, 5),
      );
      expect(diagnosticCalls).toBe(1);
      diagnosticPlugin.dispose();
    },
  );
});
