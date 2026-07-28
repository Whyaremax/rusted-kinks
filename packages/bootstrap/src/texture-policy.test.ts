import { afterEach, describe, expect, it, vi } from "vitest";

import { KNOWN_UPSTREAM } from "@kd-hybrid/runtime";

import { installKinkyDungeonTexturePolicy } from "./texture-policy.js";

const EXACT_OPTIONS = Object.freeze({
  upstreamVersion: KNOWN_UPSTREAM.gameVersion,
  upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256
});

describe("Kinky Dungeon texture policy", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("selects mobile atlases for KD's two startup reads without writing storage", () => {
    vi.useFakeTimers();
    const original = JSON.stringify({
      MobileTextures: false,
      Bloom: true
    });
    const entries = new Map([
      ["KDToggles", original],
      ["unrelated", "unchanged"]
    ]);
    const { storage, prototype } = createStorage(entries);
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      prototype,
      "getItem"
    );
    const target = exactTarget(storage);
    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS,
        textureMode: "mobile"
      },
      target
    );

    expect(storage.getItem("unrelated")).toBe("unchanged");
    expect(JSON.parse(storage.getItem("KDToggles") ?? "{}")).toMatchObject({
      MobileTextures: true,
      Bloom: true
    });
    expect(JSON.parse(storage.getItem("KDToggles") ?? "{}")).toMatchObject({
      MobileTextures: true,
      Bloom: true
    });
    expect(storage.getItem("KDToggles")).toBe(original);
    expect(entries.get("KDToggles")).toBe(original);
    expect(Object.getOwnPropertyDescriptor(prototype, "getItem")).toEqual(
      originalDescriptor
    );
    expect(textures.status()).toMatchObject({
      compatible: true,
      compatibilityReason: "exact-kd-bundle-pixi-match",
      requestedTextureMode: "mobile",
      textureMode: "mobile",
      textureOverrideApplied: true,
      textureOverrideRestored: true,
      lastError: null
    });
  });

  it("keeps both KD startup reads synthetic when toggles are absent", () => {
    vi.useFakeTimers();
    const entries = new Map<string, string>();
    const { storage } = createStorage(entries);
    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS,
        textureMode: "full"
      },
      exactTarget(storage)
    );

    expect(JSON.parse(storage.getItem("KDToggles") ?? "{}")).toEqual({
      MobileTextures: false
    });
    expect(JSON.parse(storage.getItem("KDToggles") ?? "{}")).toEqual({
      MobileTextures: false
    });
    expect(storage.getItem("KDToggles")).toBeNull();
    expect(entries.has("KDToggles")).toBe(false);
    expect(textures.status()).toMatchObject({
      requestedTextureMode: "full",
      textureMode: "full",
      textureOverrideRestored: true
    });
  });

  it.each([
    {
      name: "game version",
      options: {
        upstreamVersion: "5.4.93",
        upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256
      },
      pixiVersion: "7.2.1",
      reason: "unsupported-kd-version:5.4.93"
    },
    {
      name: "bundle hash",
      options: {
        upstreamVersion: KNOWN_UPSTREAM.gameVersion,
        upstreamBundleSha256: "different"
      },
      pixiVersion: "7.2.1",
      reason: "unsupported-kd-bundle:different"
    },
    {
      name: "Pixi version",
      options: EXACT_OPTIONS,
      pixiVersion: "8.0.0",
      reason: "unsupported-pixi-version:8.0.0"
    }
  ])("fails closed on an unknown $name", ({ options, pixiVersion, reason }) => {
    const original = JSON.stringify({ MobileTextures: false });
    const entries = new Map([["KDToggles", original]]);
    const { storage, prototype } = createStorage(entries);
    const originalGetItem = prototype.getItem;
    const target = {
      PIXI: {
        VERSION: pixiVersion,
        Assets: { load: async () => ({ linkedSheets: [] }) },
        utils: {}
      },
      localStorage: storage
    };
    const textures = installKinkyDungeonTexturePolicy(
      {
        ...options,
        textureMode: "mobile"
      },
      target
    );

    expect(prototype.getItem).toBe(originalGetItem);
    expect(storage.getItem("KDToggles")).toBe(original);
    expect(textures.status()).toMatchObject({
      compatible: false,
      compatibilityReason: reason,
      requestedTextureMode: "mobile",
      textureMode: "original",
      textureOverrideApplied: false
    });
  });

  it("fails closed for malformed toggles", () => {
    const entries = new Map([["KDToggles", "{not-json"]]);
    const { storage, prototype } = createStorage(entries);
    const originalGetItem = prototype.getItem;
    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS,
        textureMode: "mobile"
      },
      exactTarget(storage)
    );

    expect(prototype.getItem).toBe(originalGetItem);
    expect(storage.getItem("KDToggles")).toBe("{not-json");
    expect(textures.status()).toMatchObject({
      textureMode: "original",
      textureOverrideApplied: false
    });
    expect(textures.status().lastError).toMatch(/^texture-mode:/u);
  });

  it("fails closed when the storage method descriptor cannot be restored", () => {
    const original = JSON.stringify({ MobileTextures: false });
    const entries = new Map([["KDToggles", original]]);
    const { storage, prototype } = createStorage(entries);
    const originalGetItem = prototype.getItem;
    Object.defineProperty(prototype, "getItem", {
      configurable: false,
      writable: true,
      value: originalGetItem
    });

    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS,
        textureMode: "mobile"
      },
      exactTarget(storage)
    );

    expect(prototype.getItem).toBe(originalGetItem);
    expect(storage.getItem("KDToggles")).toBe(original);
    expect(textures.status()).toMatchObject({
      textureMode: "original",
      textureOverrideApplied: false,
      textureOverrideRestored: false,
      lastError: "texture-mode:get-item-descriptor-unavailable"
    });
  });

  it("fails closed when local storage access throws", () => {
    const target = exactTarget(createStorage(new Map()).storage);
    Object.defineProperty(target, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("storage denied");
      }
    });

    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS,
        textureMode: "mobile"
      },
      target
    );

    expect(textures.status()).toMatchObject({
      textureMode: "original",
      textureOverrideApplied: false,
      textureOverrideRestored: false,
      lastError: "texture-mode:local-storage-access:storage denied"
    });
  });

  it("restores the exact descriptor when timeout scheduling throws", () => {
    const original = JSON.stringify({ MobileTextures: false });
    const entries = new Map([["KDToggles", original]]);
    const { storage, prototype } = createStorage(entries);
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      prototype,
      "getItem"
    );
    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS,
        textureMode: "mobile",
        scheduleTimeout: () => {
          throw new Error("timer unavailable");
        }
      },
      exactTarget(storage)
    );

    expect(storage.getItem("KDToggles")).toBe(original);
    expect(Object.getOwnPropertyDescriptor(prototype, "getItem")).toEqual(
      originalDescriptor
    );
    expect(textures.status()).toMatchObject({
      textureMode: "original",
      textureOverrideApplied: true,
      textureOverrideRestored: true,
      lastError: "texture-mode-schedule:timer unavailable"
    });
  });

  it("restores the storage descriptor even when timer cancellation throws", () => {
    const original = JSON.stringify({ MobileTextures: false });
    const entries = new Map([["KDToggles", original]]);
    const { storage, prototype } = createStorage(entries);
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      prototype,
      "getItem"
    );
    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS,
        textureMode: "mobile",
        scheduleTimeout: () => Symbol("timer"),
        cancelTimeout: () => {
          throw new Error("cancel unavailable");
        }
      },
      exactTarget(storage)
    );

    expect(JSON.parse(storage.getItem("KDToggles") ?? "{}")).toMatchObject({
      MobileTextures: true
    });
    expect(JSON.parse(storage.getItem("KDToggles") ?? "{}")).toMatchObject({
      MobileTextures: true
    });
    expect(storage.getItem("KDToggles")).toBe(original);
    expect(Object.getOwnPropertyDescriptor(prototype, "getItem")).toEqual(
      originalDescriptor
    );
    expect(textures.status()).toMatchObject({
      textureMode: "mobile",
      textureOverrideRestored: true,
      lastError: "texture-mode-cancel:cancel unavailable"
    });
  });

  it("restores the hook on timeout without changing stored toggles", () => {
    vi.useFakeTimers();
    const original = JSON.stringify({ MobileTextures: false });
    const entries = new Map([["KDToggles", original]]);
    const { storage, prototype } = createStorage(entries);
    const originalGetItem = prototype.getItem;
    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS,
        textureMode: "mobile",
        textureOverrideTimeoutMs: 1_000
      },
      exactTarget(storage)
    );

    expect(prototype.getItem).not.toBe(originalGetItem);
    vi.advanceTimersByTime(1_000);

    expect(prototype.getItem).toBe(originalGetItem);
    expect(entries.get("KDToggles")).toBe(original);
    expect(textures.status()).toMatchObject({
      textureMode: "original",
      textureOverrideRestored: true,
      lastError: "texture-mode:toggle-read-timeout"
    });
  });

  it("does not overwrite a later storage wrapper during disposal", () => {
    vi.useFakeTimers();
    const entries = new Map([
      ["KDToggles", JSON.stringify({ MobileTextures: false })]
    ]);
    const { storage, prototype } = createStorage(entries);
    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS,
        textureMode: "mobile"
      },
      exactTarget(storage)
    );
    const laterWrapper = () => "later";
    prototype.getItem = laterWrapper;

    textures.dispose();

    expect(prototype.getItem).toBe(laterWrapper);
    expect(textures.status()).toMatchObject({
      textureMode: "original",
      textureOverrideRestored: false,
      lastError: "texture-mode:get-item-replaced-before-restore"
    });
  });

  it("restores an unconsumed startup hook during ordinary disposal", () => {
    vi.useFakeTimers();
    const original = JSON.stringify({ MobileTextures: false });
    const entries = new Map([["KDToggles", original]]);
    const { storage, prototype } = createStorage(entries);
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      prototype,
      "getItem"
    );
    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS,
        textureMode: "mobile"
      },
      exactTarget(storage)
    );

    textures.dispose();
    vi.runAllTimers();

    expect(storage.getItem("KDToggles")).toBe(original);
    expect(Object.getOwnPropertyDescriptor(prototype, "getItem")).toEqual(
      originalDescriptor
    );
    expect(textures.status()).toMatchObject({
      textureMode: "original",
      textureOverrideApplied: true,
      textureOverrideRestored: true,
      lastError: null
    });
  });

  it("deduplicates base textures and rate-limits memory samples", () => {
    const sharedBase = {
      realWidth: 10,
      realHeight: 20,
      mipmap: 0,
      resource: {}
    };
    const renderBase = {
      realWidth: 5,
      realHeight: 5,
      mipmap: 2,
      resource: {}
    };
    const target = exactTarget(undefined);
    target.PIXI.utils.TextureCache = {
      first: { baseTexture: sharedBase },
      second: { baseTexture: sharedBase }
    };
    target.kdRTcache = new Map([
      ["render", { baseTexture: renderBase }]
    ]);
    let now = 1_000;
    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS,
        textureSampleIntervalMs: 5_000,
        now: () => now
      },
      target
    );

    expect(textures.sampleTextureMemory()).toBe(900);
    expect(textures.status()).toMatchObject({
      uniqueBaseTextures: 2,
      decodedTextureBytes: 900,
      estimatedGpuTextureBytes: 934
    });
    target.PIXI.utils.TextureCache.third = {
      baseTexture: {
        realWidth: 100,
        realHeight: 100,
        mipmap: 0,
        resource: {}
      }
    };
    now += 1_000;
    expect(textures.sampleTextureMemory()).toBe(900);
    now += 5_000;
    expect(textures.sampleTextureMemory()).toBe(40_900);
  });

  it("leaves every Pixi asset API untouched", () => {
    const load = async () => ({ linkedSheets: [] });
    const backgroundLoad = async () => undefined;
    const target = exactTarget(undefined);
    target.PIXI.Assets = { load, backgroundLoad };
    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS,
        textureMode: "original"
      },
      target
    );

    expect(target.PIXI.Assets.load).toBe(load);
    expect(target.PIXI.Assets.backgroundLoad).toBe(backgroundLoad);
    textures.dispose();
    expect(target.PIXI.Assets.load).toBe(load);
    expect(target.PIXI.Assets.backgroundLoad).toBe(backgroundLoad);
  });

  it("restores a previous global handle and disposes idempotently", () => {
    const previous = {
      status: () => {
        throw new Error("unused");
      },
      sampleTextureMemory: () => undefined,
      dispose: () => undefined
    };
    const target = {
      ...exactTarget(undefined),
      KDHybridTextures: previous
    };
    const textures = installKinkyDungeonTexturePolicy(
      {
        ...EXACT_OPTIONS
      },
      target
    );

    textures.dispose();
    textures.dispose();

    expect(target.KDHybridTextures).toBe(previous);
  });
});

function exactTarget(storage: ReturnType<typeof createStorage>["storage"] | undefined): {
  PIXI: {
    VERSION: string;
    Assets: Record<string, unknown>;
    utils: Record<string, Record<string, unknown>>;
  };
  localStorage?: ReturnType<typeof createStorage>["storage"];
  kdRTcache?: Map<string, unknown>;
  KDHybridTextures?: {
    status(): never;
    sampleTextureMemory(): undefined;
    dispose(): void;
  };
} {
  return {
    PIXI: {
      VERSION: "7.2.1",
      Assets: {},
      utils: {}
    },
    ...(storage === undefined ? {} : { localStorage: storage })
  };
}

function createStorage(entries: Map<string, string>): {
  storage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
  prototype: {
    getItem(key: string): string | null;
  };
} {
  const prototype = {
    getItem: (key: string) => entries.get(key) ?? null
  };
  const storage = Object.assign(Object.create(prototype), {
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    }
  }) as {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
  return { storage, prototype };
}
