import { describe, expect, it } from "vitest";

import {
  createModCompatibilityDecisionStore,
  resolveModCompatibilitySession,
  type ModCompatibilityCandidate,
  type ModCompatibilityStorage,
} from "./mod-compatibility-decisions.js";

const digestA = "a".repeat(64);
const digestB = "b".repeat(64);
const bundleA = "c".repeat(64);

describe("remembered mod compatibility decisions", () => {
  it("keys decisions to every compatibility identity and invalidates drift", () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    const remembered = store.remember(
      digestA,
      "compatibility",
      "2026-07-31T00:00:00.000Z",
    );

    expect(store.lookup(digestA)).toEqual(remembered);
    expect(store.lookup(digestB)).toBeUndefined();
    expect(
      createStore(storage, { hybridVersion: "0.1.3" }).lookup(digestA),
    ).toBeUndefined();
    expect(
      createStore(storage, { kdVersion: "5.4.93" }).lookup(digestA),
    ).toBeUndefined();
    expect(
      createStore(storage, { bundleSha256: "d".repeat(64) }).lookup(digestA),
    ).toBeUndefined();
    expect(
      createStore(storage, { ruleVersion: 2 }).lookup(digestA),
    ).toBeUndefined();
  });

  it("supports per-mod and global regret without touching unrelated data", () => {
    const storage = memoryStorage();
    storage.setItem("KD-save", "untouched");
    const store = createStore(storage);
    store.remember(digestA, "keep-optimizations");
    store.remember(digestB, "disable-mod");

    expect(store.forget(digestA)).toBe(true);
    expect(store.forget(digestA)).toBe(false);
    expect(store.lookup(digestA)).toBeUndefined();
    expect(store.lookup(digestB)?.choice).toBe("disable-mod");
    expect(store.forgetAll()).toBe(1);
    expect(store.decisions()).toEqual([]);
    expect(storage.getItem("KD-save")).toBe("untouched");
  });

  it("fails closed on malformed storage and ignores invalid records", () => {
    const storage = memoryStorage();
    storage.setItem("KDHybridModCompatibilityDecisions", "{broken");
    expect(createStore(storage).decisions()).toEqual([]);

    storage.setItem(
      "KDHybridModCompatibilityDecisions",
      JSON.stringify({
        schema: 1,
        decisions: [
          {
            digest: "invalid",
            choice: "keep-optimizations",
            rememberedAt: "not-a-date",
            context: {},
          },
        ],
      }),
    );
    expect(createStore(storage).decisions()).toEqual([]);
  });

  it("deduplicates persisted identities and bounds untrusted storage", () => {
    const storage = memoryStorage();
    const context = {
      kdVersion: "5.4.92",
      bundleSha256: bundleA,
      hybridVersion: "0.1.2",
      ruleVersion: 1,
    };
    storage.setItem(
      "KDHybridModCompatibilityDecisions",
      JSON.stringify({
        schema: 1,
        decisions: [
          ...Array.from({ length: 512 }, (_, index) => ({
            digest: index.toString(16).padStart(64, "0"),
            choice: "compatibility",
            context,
            rememberedAt: "2026-07-31T00:00:00.000Z",
          })),
          {
            digest: digestA,
            choice: "compatibility",
            context,
            rememberedAt: "2026-07-31T00:00:00.000Z",
          },
          {
            digest: digestA,
            choice: "keep-optimizations",
            context,
            rememberedAt: "2026-07-31T00:00:01.000Z",
          },
        ],
      }),
    );

    const store = createStore(storage);
    expect(store.decisions()).toHaveLength(511);
    expect(store.lookup(digestA)?.choice).toBe("keep-optimizations");
  });

  it("rejects invalid identities and choices before persistence", () => {
    const storage = memoryStorage();
    const store = createStore(storage);

    expect(() => store.remember("bad", "compatibility")).toThrow(/SHA-256/u);
    expect(() => store.remember(digestA, "unknown" as "compatibility")).toThrow(
      /Unknown/u,
    );
    expect(storage.entries()).toEqual([]);
  });
});

describe("per-subsystem compatibility routing", () => {
  it("defaults undecided high-confidence findings to compatibility mode", () => {
    const status = resolveModCompatibilitySession([
      {
        candidate: mod(digestA, [
          finding("path-cache-write", "pathfinding"),
          finding("direct-buff-write", "buff-event-index"),
        ]),
      },
    ]);

    expect(status).toEqual({
      disabledMods: [],
      forcedUnstableMods: [],
      compatibilityMods: [digestA],
      disabledSubsystems: ["buff-event-index", "pathfinding"],
      restartRequired: false,
    });
  });

  it("lets informational findings load without disabling anything", () => {
    const status = resolveModCompatibilitySession([
      {
        candidate: mod(digestA, [
          {
            ...finding("read-only-cache", "pathfinding"),
            confidence: "informational",
          },
        ]),
      },
    ]);

    expect(status.disabledSubsystems).toEqual([]);
    expect(status.compatibilityMods).toEqual([]);
  });

  it("keeps disabled mods installed but excludes them from session routing", () => {
    const status = resolveModCompatibilitySession([
      {
        candidate: mod(digestA, [
          finding("source-inspection", "source-optimizations", true),
        ]),
        choice: "disable-mod",
      },
    ]);

    expect(status.disabledMods).toEqual([digestA]);
    expect(status.disabledSubsystems).toEqual([]);
    expect(status.restartRequired).toBe(false);
  });

  it("marks force-loaded risks unstable without overriding safer mods", () => {
    const status = resolveModCompatibilitySession([
      {
        candidate: mod(digestA, [finding("path-replacement", "pathfinding")]),
        choice: "keep-optimizations",
      },
      {
        candidate: mod(digestB, [
          finding("grid-write", "pathfinding"),
          finding("enemy-cache-write", "enemy-position-cache"),
          finding("source-inspection", "source-optimizations", true),
        ]),
        choice: "compatibility",
      },
    ]);

    expect(status.forcedUnstableMods).toEqual([digestA]);
    expect(status.compatibilityMods).toEqual([digestB]);
    expect(status.disabledSubsystems).toEqual([
      "enemy-position-cache",
      "pathfinding",
      "source-optimizations",
    ]);
    expect(status.restartRequired).toBe(true);
  });

  it("rejects malformed candidates instead of guessing", () => {
    expect(() =>
      resolveModCompatibilitySession([
        {
          candidate: {
            name: "Bad",
            digest: digestA,
            findings: [
              {
                ruleId: "",
                confidence: "high",
                subsystem: "pathfinding",
                reason: "missing rule",
              },
            ],
          },
        },
      ]),
    ).toThrow(/ruleId/u);
  });
});

function createStore(
  storage: ModCompatibilityStorage,
  overrides: Partial<{
    kdVersion: string;
    bundleSha256: string;
    hybridVersion: string;
    ruleVersion: number;
  }> = {},
) {
  return createModCompatibilityDecisionStore(storage, {
    kdVersion: overrides.kdVersion ?? "5.4.92",
    bundleSha256: overrides.bundleSha256 ?? bundleA,
    hybridVersion: overrides.hybridVersion ?? "0.1.2",
    ruleVersion: overrides.ruleVersion ?? 1,
  });
}

function mod(
  digest: string,
  findings: ModCompatibilityCandidate["findings"],
): ModCompatibilityCandidate {
  return {
    name: `Mod ${digest[0]}`,
    digest,
    findings,
  };
}

function finding(
  ruleId: string,
  subsystem:
    | "buff-event-index"
    | "enemy-position-cache"
    | "pathfinding"
    | "source-optimizations",
  restartRequired = false,
) {
  return {
    ruleId,
    confidence: "high" as const,
    subsystem,
    reason: ruleId,
    restartRequired,
  };
}

function memoryStorage(): ModCompatibilityStorage & {
  entries(): readonly [string, string][];
} {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    entries: () => [...values.entries()],
  };
}
