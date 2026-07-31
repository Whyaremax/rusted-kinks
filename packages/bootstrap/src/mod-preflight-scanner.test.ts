import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createModPreflightScanner,
  MOD_PREFLIGHT_SUBSYSTEMS,
  type ModPreflightLimits,
  type ModPreflightReport,
  type ModPreflightSubsystem,
} from "./mod-preflight-scanner.js";
import type {
  LegacyModArchiveEntry,
  LegacyModArchiveReader,
} from "./mod-api-translator.js";

const DIGEST = "a".repeat(64);

describe("mod preflight scanner", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "__kdHybridPreflightExecuted");
  });

  it("keeps pure declarative archives safe and inventories them ordinally", async () => {
    const report = await scan([
      entry("textures/icon.png", undefined, 12),
      entry("README.txt", "globalThis.__kdHybridPreflightExecuted = true;"),
      entry("Scripts/ignored.JS", "eval('unsafe')"),
      directory("assets/"),
      entry("mod.json", '{"modname":"Fixture"}'),
    ]);

    expect(report.digestSha256).toBe(DIGEST);
    expect(report.level).toBe("safe");
    expect(report.requiresCompatibilityDecision).toBe(false);
    expect(report.inventory.map((value) => value.filename)).toEqual([
      "README.txt",
      "Scripts/ignored.JS",
      "assets/",
      "mod.json",
      "textures/icon.png",
    ]);
    expect(report.inventory.map((value) => value.kind)).toEqual([
      "declarative",
      "declarative",
      "directory",
      "declarative",
      "declarative",
    ]);
    expect(report.risks.map((value) => value.level)).toEqual([
      "safe",
      "safe",
      "safe",
      "safe",
    ]);
    expect(
      (globalThis as Record<string, unknown>).__kdHybridPreflightExecuted,
    ).toBeUndefined();
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.inventory)).toBe(true);
  });

  it("inspects every script entry and reports independent subsystem risks", async () => {
    const report = await scan([
      entry(
        "z-buffs.js",
        "enemy.buffs.Stun = { events: [{ trigger: 'tick' }] };",
      ),
      entry("a-path.ks", "KDPathCache.clear();"),
      entry("m-enemy.js", "KDEnemyCache.set('1,1', enemy);"),
      entry("n-source.js", "const source = KinkyDungeonFindPath.toString();"),
    ]);

    expect(report.requiresCompatibilityDecision).toBe(true);
    expect(risk(report, "buff-event-index").level).toBe(
      "compatibility-required",
    );
    expect(risk(report, "enemy-position-cache").level).toBe(
      "compatibility-required",
    );
    expect(risk(report, "pathfinding").level).toBe("compatibility-required");
    expect(risk(report, "source-optimizations").level).toBe(
      "compatibility-required",
    );
    expect(requiredEntries(report, "buff-event-index")).toContain("z-buffs.js");
    expect(requiredEntries(report, "enemy-position-cache")).toContain(
      "m-enemy.js",
    );
    expect(requiredEntries(report, "pathfinding")).toContain("a-path.ks");
    expect(requiredEntries(report, "source-optimizations")).toContain(
      "n-source.js",
    );
    expect(report.inventory.map((value) => value.filename)).toEqual([
      "a-path.ks",
      "m-enemy.js",
      "n-source.js",
      "z-buffs.js",
    ]);
    expect(
      report.inventory.every(
        (value) => value.analysis === "compatibility-required",
      ),
    ).toBe(true);
  });

  it("continues after malformed syntax and retains findings from later scripts", async () => {
    const report = await scan([
      entry("a-malformed.js", "function broken( {"),
      entry("z-path.js", "KDPathCacheIgnoreLocks.delete('1,1');"),
    ]);

    for (const subsystem of MOD_PREFLIGHT_SUBSYSTEMS) {
      expect(risk(report, subsystem).level).toBe("compatibility-required");
      expect(
        risk(report, subsystem).evidence.some(
          (value) =>
            value.entry === "a-malformed.js" &&
            value.reason === "script-parse-error",
        ),
      ).toBe(true);
    }
    expect(
      risk(report, "pathfinding").evidence.some(
        (value) =>
          value.entry === "z-path.js" &&
          value.path === "KDPathCacheIgnoreLocks",
      ),
    ).toBe(true);
    expect(report.inventory).toMatchObject([
      {
        filename: "a-malformed.js",
        analysis: "compatibility-required",
        reason: "script-parse-error",
      },
      {
        filename: "z-path.js",
        analysis: "compatibility-required",
      },
    ]);
  });

  it("keeps harmless buff reads and unrelated toString calls nonblocking", async () => {
    const report = await scan([
      entry(
        "read-only.js",
        [
          "const stun = enemy.buffs.Stun;",
          "logger.toString();",
          "KDApplyBuff(enemy, { id: 'Safe' });",
          "KinkyDungeonFindPath(1, 1, 2, 2);",
        ].join("\n"),
      ),
    ]);

    expect(report.requiresCompatibilityDecision).toBe(false);
    expect(report.level).toBe("informational");
    expect(risk(report, "buff-event-index").level).toBe("informational");
    expect(risk(report, "pathfinding").level).toBe("informational");
    expect(risk(report, "source-optimizations").level).toBe("safe");
    expect(
      risk(report, "buff-event-index").evidence.map((value) => value.kind),
    ).toEqual(expect.arrayContaining(["read-reference", "supported-api"]));
  });

  it("detects direct, delete, assignment, and property-definition buff writes", async () => {
    const report = await scan([
      entry(
        "buff-writes.js",
        [
          "enemy.buffs.Sleep = {};",
          "delete enemy.buffs.Sleep;",
          "Object.assign(enemy.buffs, incoming);",
          "Object.defineProperty(enemy.buffs, 'Stun', descriptor);",
          "KDHybridInvalidateBuffEventIndex();",
        ].join("\n"),
      ),
    ]);
    const buffRisk = risk(report, "buff-event-index");

    expect(buffRisk.level).toBe("compatibility-required");
    expect(
      buffRisk.evidence.filter(
        (value) => value.level === "compatibility-required",
      ).length,
    ).toBeGreaterThanOrEqual(4);
    expect(
      buffRisk.evidence.some((value) => value.kind === "explicit-invalidator"),
    ).toBe(true);
  });

  it("distinguishes cache reads from cache and entity-position mutations", async () => {
    const readOnly = await scan([
      entry(
        "cache-reads.js",
        [
          "KDPathCache.get('1,1');",
          "const cache = KDEnemyCache;",
          "cache.has('2,2');",
        ].join("\n"),
      ),
    ]);
    expect(risk(readOnly, "pathfinding").level).toBe("informational");
    expect(risk(readOnly, "enemy-position-cache").level).toBe("informational");
    expect(readOnly.requiresCompatibilityDecision).toBe(false);

    const writes = await scan([
      entry(
        "cache-writes.js",
        [
          "const paths = KDPathCache;",
          "paths.clear();",
          "KDEnemyCache.delete('2,2');",
          "enemy.x += 1;",
          "KDMapData.Traffic['1,1'] = 4;",
        ].join("\n"),
      ),
    ]);
    expect(risk(writes, "pathfinding").level).toBe("compatibility-required");
    expect(risk(writes, "enemy-position-cache").level).toBe(
      "compatibility-required",
    );
  });

  it("flags only source inspection tied to transformed functions", async () => {
    const report = await scan([
      entry(
        "source.js",
        [
          "unrelated.toString();",
          "Function.prototype.toString.call(KDHelpless);",
          "String(KinkyDungeonGetAccessible);",
          "KinkyDungeonFindPath.toString().includes('lowest');",
        ].join("\n"),
      ),
    ]);
    const sourceRisk = risk(report, "source-optimizations");

    expect(sourceRisk.level).toBe("compatibility-required");
    expect(
      sourceRisk.evidence
        .filter((value) => value.kind === "function-source-inspection")
        .map((value) => value.path),
    ).toEqual(
      expect.arrayContaining([
        "KDHelpless",
        "KinkyDungeonFindPath",
        "KinkyDungeonGetAccessible",
      ]),
    );
    expect(
      sourceRisk.evidence.some((value) => value.path === "unrelated"),
    ).toBe(false);
  });

  it("detects reflective, template, and concatenated function-source coercion", async () => {
    const report = await scan([
      entry(
        "coercion.js",
        [
          "Reflect.apply(Function.prototype.toString, KDHelpless, []);",
          "const pathSource = `${KinkyDungeonFindPath}`;",
          "const accessSource = '' + KinkyDungeonGetAccessible;",
        ].join("\n"),
      ),
    ]);
    const sourceRisk = risk(report, "source-optimizations");

    expect(sourceRisk.level).toBe("compatibility-required");
    expect(
      sourceRisk.evidence
        .filter((value) => value.kind === "function-source-inspection")
        .map((value) => value.path),
    ).toEqual(
      expect.arrayContaining([
        "KDHelpless",
        "KinkyDungeonFindPath",
        "KinkyDungeonGetAccessible",
      ]),
    );
  });

  it("treats indirect assignments to migrated globals as replacements", async () => {
    const report = await scan([
      entry(
        "replacement.js",
        [
          "KinkyDungeonFindPath = wrappedFindPath;",
          "globalThis.KDHelpless = replacement;",
        ].join("\n"),
      ),
    ]);

    expect(risk(report, "pathfinding").level).toBe("compatibility-required");
    expect(risk(report, "source-optimizations").level).toBe(
      "compatibility-required",
    );
    expect(
      risk(report, "pathfinding").evidence.some(
        (value) =>
          value.kind === "function-replacement" &&
          value.path === "KinkyDungeonFindPath",
      ),
    ).toBe(true);
    expect(
      risk(report, "source-optimizations").evidence.some(
        (value) =>
          value.kind === "function-replacement" && value.path === "KDHelpless",
      ),
    ).toBe(true);
  });

  it("tracks proven e and ent entity aliases without flagging arbitrary vectors", async () => {
    const report = await scan([
      entry(
        "positions.js",
        [
          "for (const e of KDMapData.Entities) e.x += 1;",
          "const ent = KinkyDungeonEnemyAt(1, 1);",
          "ent.y = 2;",
          "KDMapData.Entities.forEach((e) => { e.y--; });",
          "const vector = { x: 0, y: 0 };",
          "vector.x = 4;",
        ].join("\n"),
      ),
    ]);
    const enemyRisk = risk(report, "enemy-position-cache");

    expect(enemyRisk.level).toBe("compatibility-required");
    expect(
      enemyRisk.evidence
        .filter((value) => value.level === "compatibility-required")
        .map((value) => value.path),
    ).toEqual(expect.arrayContaining(["e.x", "e.y", "ent.y"]));
    expect(enemyRisk.evidence.some((value) => value.path === "vector.x")).toBe(
      false,
    );
  });

  it("fails every subsystem closed for dynamic code without executing it", async () => {
    const target = globalThis as Record<string, unknown>;
    const report = await scan([
      entry(
        "dynamic.js",
        [
          "globalThis.__kdHybridPreflightExecuted = true;",
          "eval('KDPathCache.clear()');",
        ].join("\n"),
      ),
    ]);

    expect(target.__kdHybridPreflightExecuted).toBeUndefined();
    for (const subsystem of MOD_PREFLIGHT_SUBSYSTEMS) {
      expect(risk(report, subsystem).level).toBe("compatibility-required");
      expect(
        risk(report, subsystem).evidence.some((value) =>
          value.reason.startsWith("dynamic-code:"),
        ),
      ).toBe(true);
    }
  });

  it("fails closed on unsafe paths but still analyzes other bounded scripts", async () => {
    const report = await scan([
      entry("../escape.js", "KDEnemyCache.clear();"),
      entry("safe-name.js", "KDPathCache.clear();"),
    ]);

    for (const subsystem of MOD_PREFLIGHT_SUBSYSTEMS) {
      expect(risk(report, subsystem).level).toBe("compatibility-required");
    }
    expect(requiredEntries(report, "enemy-position-cache")).toContain(
      "../escape.js",
    );
    expect(requiredEntries(report, "pathfinding")).toContain("safe-name.js");
  });

  it("detects duplicate KD lookup names across slash direction and case", async () => {
    const report = await scan([
      entry("scripts/main.js", "const first = true;"),
      entry("Scripts\\Main.js", "const second = true;"),
    ]);

    expect(report.requiresCompatibilityDecision).toBe(true);
    expect(
      report.inventory.find((value) => value.filename === "Scripts\\Main.js"),
    ).toMatchObject({
      analysis: "compatibility-required",
      reason: "duplicate-archive-entry",
    });
    for (const subsystem of MOD_PREFLIGHT_SUBSYSTEMS) {
      expect(
        risk(report, subsystem).evidence.some(
          (value) => value.reason === "duplicate-archive-entry",
        ),
      ).toBe(true);
    }
  });

  it("enforces entry, script-count, and script-byte limits", async () => {
    const tooManyEntries = await scan(
      [
        entry("a.js", "KDRandom();"),
        entry("b.js", "KDRandom();"),
        entry("c.js", "KDRandom();"),
      ],
      { maxEntries: 2 },
    );
    expect(tooManyEntries.inventory).toEqual([]);
    expect(tooManyEntries.requiresCompatibilityDecision).toBe(true);
    expect(risk(tooManyEntries, "pathfinding").evidence[0]?.reason).toBe(
      "archive-entry-count-limit",
    );

    const tooManyScripts = await scan(
      [entry("a.js", "KDRandom();"), entry("b.ks", "KDRandom();")],
      { maxScriptFiles: 1 },
    );
    expect(tooManyScripts.inventory.map((value) => value.analysis)).toEqual([
      "compatibility-required",
      "compatibility-required",
    ]);

    const oversized = await scan(
      [entry("large.js", "const value = '1234567890';")],
      { maxScriptBytes: 8, maxTotalScriptBytes: 8 },
    );
    expect(oversized.inventory[0]).toMatchObject({
      analysis: "compatibility-required",
      reason: "script-size-limit",
    });
  });

  it("bounds AST traversal and fails every subsystem closed when truncated", async () => {
    const report = await scan(
      [
        entry(
          "dense.js",
          Array.from(
            { length: 20 },
            (_, index) => `const value${index} = ${index};`,
          ).join("\n"),
        ),
      ],
      {
        maxAstNodesPerScript: 16,
        maxTotalAstNodes: 32,
      },
    );

    expect(report.inventory[0]).toMatchObject({
      analysis: "compatibility-required",
      reason: "script-ast-node-limit",
    });
    for (const subsystem of MOD_PREFLIGHT_SUBSYSTEMS) {
      expect(
        risk(report, subsystem).evidence.some(
          (value) => value.reason === "script-ast-node-limit",
        ),
      ).toBe(true);
    }
  });

  it("caps subsystem and archive evidence with deterministic fail-closed markers", async () => {
    const subsystemLimited = await scan(
      [
        entry(
          "path-reads.js",
          Array.from(
            { length: 12 },
            (_, index) => `KDPathCache.get('${index}');`,
          ).join("\n"),
        ),
      ],
      {
        maxEvidencePerSubsystem: 3,
        maxEvidenceTotal: 16,
      },
    );
    const pathRisk = risk(subsystemLimited, "pathfinding");
    expect(pathRisk.evidence.length).toBeLessThanOrEqual(3);
    expect(pathRisk.level).toBe("compatibility-required");
    expect(
      pathRisk.evidence.some(
        (value) => value.reason === "subsystem-evidence-limit",
      ),
    ).toBe(true);

    const archiveLimited = await scan(
      [
        entry(
          "many-reads.js",
          Array.from(
            { length: 12 },
            (_, index) => `KDPathCache.get('${index}');`,
          ).join("\n"),
        ),
      ],
      {
        maxEvidencePerSubsystem: 32,
        maxEvidenceTotal: 4,
      },
    );
    expect(
      archiveLimited.risks.flatMap((value) => value.evidence),
    ).toHaveLength(4);
    for (const subsystem of MOD_PREFLIGHT_SUBSYSTEMS) {
      expect(risk(archiveLimited, subsystem)).toMatchObject({
        level: "compatibility-required",
        evidence: [
          expect.objectContaining({ reason: "archive-evidence-limit" }),
        ],
      });
    }
  });

  it("passes strict read limits, normalizes the digest, and is deterministic", async () => {
    const entries = [
      entry("z.js", "KDPathCache.clear();"),
      entry("a.js", "enemy.buffs.Stun = {};"),
    ];
    const readArchive = vi.fn<LegacyModArchiveReader>(async () => entries);
    const scanner = createModPreflightScanner({
      readArchive,
      digest: async () => "B".repeat(64),
      limits: {
        maxEntries: 7,
        maxScriptFiles: 3,
        maxScriptBytes: 128,
        maxTotalScriptBytes: 256,
      },
    });
    const archive = { name: " Deterministic.zip ", blob: new Blob(["x"]) };

    const first = await scanner.scan(archive);
    const second = await scanner.scan(archive);

    expect(first).toEqual(second);
    expect(first.name).toBe("Deterministic.zip");
    expect(first.digestSha256).toBe("b".repeat(64));
    expect(readArchive).toHaveBeenCalledWith(archive, {
      maxEntries: 7,
      maxExecutableFiles: 3,
      maxExecutableBytes: 128,
      maxTotalExecutableBytes: 256,
    });
    expect(
      risk(first, "pathfinding").evidence.map((value) => value.entry),
    ).toEqual(
      [...risk(first, "pathfinding").evidence]
        .map((value) => value.entry)
        .sort(),
    );
  });

  it("fails closed on reader and digest errors", async () => {
    const readerFailure = createModPreflightScanner({
      readArchive: async () => {
        throw new Error("bad zip");
      },
      digest: async () => DIGEST,
    });
    const digestFailure = createModPreflightScanner({
      readArchive: async () => [],
      digest: async () => "not-a-digest",
    });

    expect(
      (await readerFailure.scan(fixtureArchive()))
        .requiresCompatibilityDecision,
    ).toBe(true);
    const invalidDigest = await digestFailure.scan(fixtureArchive());
    expect(invalidDigest.digestSha256).toBeNull();
    expect(
      risk(invalidDigest, "source-optimizations").evidence[0]?.reason,
    ).toBe("invalid-archive-digest");
  });
});

async function scan(
  entries: readonly LegacyModArchiveEntry[],
  limits: Partial<ModPreflightLimits> = {},
): Promise<ModPreflightReport> {
  return createModPreflightScanner({
    readArchive: async () => entries,
    digest: async () => DIGEST,
    limits,
  }).scan(fixtureArchive());
}

function fixtureArchive(): {
  readonly name: string;
  readonly blob: Blob;
} {
  return { name: "Fixture.zip", blob: new Blob(["fixture"]) };
}

function entry(
  filename: string,
  source?: string,
  uncompressedBytes = source === undefined
    ? 0
    : new TextEncoder().encode(source).byteLength,
): LegacyModArchiveEntry {
  return Object.freeze({
    filename,
    directory: false,
    uncompressedBytes,
    ...(source === undefined ? {} : { source }),
  });
}

function directory(filename: string): LegacyModArchiveEntry {
  return Object.freeze({
    filename,
    directory: true,
    uncompressedBytes: 0,
  });
}

function risk(report: ModPreflightReport, subsystem: ModPreflightSubsystem) {
  return report.risks.find((value) => value.subsystem === subsystem)!;
}

function requiredEntries(
  report: ModPreflightReport,
  subsystem: ModPreflightSubsystem,
): readonly (string | null)[] {
  return risk(report, subsystem)
    .evidence.filter((value) => value.level === "compatibility-required")
    .map((value) => value.entry);
}
