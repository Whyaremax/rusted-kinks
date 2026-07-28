import { describe, expect, it } from "vitest";

import { KNOWN_UPSTREAM } from "@kd-hybrid/runtime";

import { installKinkyDungeonRendering } from "./rendering.js";

describe("Kinky Dungeon rendering integration", () => {
  it("delegates texture policy without changing the Pixi loader", () => {
    const load = async () => ({ linkedSheets: [] });
    const target = {
      PIXI: {
        VERSION: "7.2.1",
        Assets: { load },
        utils: {}
      },
      localStorage: storage(new Map([
        ["KDToggles", JSON.stringify({ MobileTextures: false })]
      ]))
    };
    const rendering = installKinkyDungeonRendering(
      {
        tier: "balanced",
        upstreamVersion: KNOWN_UPSTREAM.gameVersion,
        upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256,
        textureMode: "mobile"
      },
      target
    );

    expect(target.PIXI.Assets.load).toBe(load);
    expect(rendering.status()).toMatchObject({
      tier: "balanced",
      compatible: true,
      requestedTextureMode: "mobile",
      textureMode: "mobile"
    });

    rendering.setTier("high");
    expect(rendering.status().tier).toBe("high");
  });

  it("restores prior global APIs and is idempotent on dispose", () => {
    const previousRendering = {
      status: () => {
        throw new Error("unused");
      },
      sampleTextureMemory: () => undefined,
      setTier: () => undefined,
      dispose: () => undefined
    };
    const target = {
      PIXI: { VERSION: "7.2.1", utils: {} },
      KDHybridRendering: previousRendering
    };
    const rendering = installKinkyDungeonRendering(
      {
        tier: "high",
        upstreamVersion: "unknown",
        upstreamBundleSha256: "unknown"
      },
      target
    );

    rendering.dispose();
    rendering.dispose();

    expect(target.KDHybridRendering).toBe(previousRendering);
  });
});

function storage(entries: Map<string, string>): {
  getItem(key: string): string | null;
} {
  const prototype = {
    getItem: (key: string) => entries.get(key) ?? null
  };
  return Object.create(prototype) as {
    getItem(key: string): string | null;
  };
}
