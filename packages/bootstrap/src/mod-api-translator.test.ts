import { describe, expect, it, vi } from "vitest";

import {
  AUDITED_LEGACY_MOD_PROFILES,
  MAP_GENERATION_SOURCE_OPTIMIZATIONS,
  createLegacyModTranslator,
  installKinkyDungeonModTranslator,
  runWithKDTranslatedModSourceOptimizations,
  translateOfficialKDApi,
  type LegacyModArchiveEntry,
  type LegacyModArchiveReader,
  type KDModLoaderEnvironment,
  type KDModRegistryEnvironment,
} from "./mod-api-translator.js";

const profileById = new Map(
  AUDITED_LEGACY_MOD_PROFILES.map((profile) => [profile.id, profile]),
);

describe("legacy KD mod API translation", () => {
  it("maps common official calls to bounded native effects", () => {
    expect(translateOfficialKDApi("KinkyDungeonMapSet")).toEqual({
      api: "KinkyDungeonMapSet",
      effect: "grid-write",
      nativeHandling: "grid-identity-observed",
    });
    expect(translateOfficialKDApi("KDRandom")).toEqual({
      api: "KDRandom",
      effect: "deterministic-random",
      nativeHandling: "javascript-authoritative",
    });
    expect(translateOfficialKDApi("KinkyDungeonSendDialogue")).toEqual({
      api: "KinkyDungeonSendDialogue",
      effect: "ui-only",
      nativeHandling: "no-native-state",
    });
    expect(translateOfficialKDApi("KinkyDungeonFlags.get")).toEqual({
      api: "KinkyDungeonFlags.get",
      effect: "read-only",
      nativeHandling: "no-native-state",
    });
    expect(translateOfficialKDApi("KinkyDungeonDamageEnemy")).toEqual({
      api: "KinkyDungeonDamageEnemy",
      effect: "entity-write",
      nativeHandling: "javascript-state-recaptured",
    });
    expect(translateOfficialKDApi("UnknownModFunction")).toBeUndefined();
  });

  it("accepts byte-exact audited archives and validates loader entries", async () => {
    const useful = profileById.get("useful-tooltips-1.33")!;
    const breach = profileById.get("breach-explosives-1.04")!;
    const hashes = [useful.archiveSha256, breach.archiveSha256];
    let digestIndex = 0;
    const translator = createLegacyModTranslator({
      digest: async () => hashes[digestIndex++]!,
    });

    const status = await translator.inspect([
      { name: "UsefulTooltips.zip", blob: new Blob(["useful"]) },
      { name: "BreachExplosives.zip", blob: new Blob(["breach"]) },
    ]);

    expect(status.state).toBe("compatible");
    expect(status.profiles.map(({ id }) => id)).toEqual([
      useful.id,
      breach.id,
    ]);
    expect(status.allowedSourceOptimizations).toEqual(
      MAP_GENERATION_SOURCE_OPTIMIZATIONS,
    );
    const loadedFiles = [...useful.archiveEntries, ...breach.archiveEntries].map(
      (filename) => ({ filename }),
    );
    for (const optimization of MAP_GENERATION_SOURCE_OPTIMIZATIONS) {
      expect(
        translator.allowsSourceOptimization(optimization, loadedFiles),
      ).toBe(true);
    }
    expect(
      translator.allowsSourceOptimization(
        MAP_GENERATION_SOURCE_OPTIMIZATIONS[0],
        loadedFiles.slice(1),
      ),
    ).toBe(false);
    expect(
      translator.allowsSourceOptimization(
        MAP_GENERATION_SOURCE_OPTIMIZATIONS[0],
        [...loadedFiles, { filename: "Unknown.ks" }],
      ),
    ).toBe(false);
  });

  it("content-proves a repacked official-API mod without a hash profile", async () => {
    const hash = "a".repeat(64);
    const entries = [
      archiveEntry("mod.json", '{"modname":"API registration"}'),
      archiveEntry(
        "OfficialRegistration.ks",
        `
KDEventMapGeneric.afterModSettingsLoad.Registration = (_event, _item, data) => {
  KinkyDungeonAddRestraintText(data.restraint, "Ear plugs");
  KinkyDungeonRestraints.push(data.restraint);
  KinkyDungeonRefreshRestraintsCache();
};
KDEventMapGeneric.afterModSettingsLoad.Registration(
  "afterModSettingsLoad",
  {},
  { restraint: {} },
);
`,
      ),
      archiveEntry("Assets/Icon.png"),
    ];
    const translator = createLegacyModTranslator({
      digest: async () => hash,
      readArchive: archiveReader(entries),
    });

    const status = await translator.inspect([
      { name: "RepackedOfficialApi.zip", blob: new Blob(["changed zip"]) },
    ]);

    expect(status.state).toBe("compatible");
    expect(status.reason).toBeNull();
    expect(status.profiles).toEqual([
      expect.objectContaining({
        id: `official-api-${hash.slice(0, 16)}`,
        name: "RepackedOfficialApi",
        version: "content-inspected",
      }),
    ]);
    expect(status.allowedSourceOptimizations).toEqual(
      MAP_GENERATION_SOURCE_OPTIMIZATIONS,
    );
    const loadedFiles = entries.map(({ filename }) => ({ filename }));
    for (const optimization of MAP_GENERATION_SOURCE_OPTIMIZATIONS) {
      expect(
        translator.allowsSourceOptimization(optimization, loadedFiles),
      ).toBe(true);
    }
  });

  it("content-proves asset-only archives and exact/content mixtures", async () => {
    const exact = profileById.get("useful-tooltips-1.33")!;
    const contentHash = "b".repeat(64);
    const contentEntries = [
      archiveEntry("mod.json", '{"modname":"Assets"}'),
      archiveEntry("Models/Accessory.png"),
    ];
    const hashes = [exact.archiveSha256, contentHash];
    let digestIndex = 0;
    let archiveReads = 0;
    const translator = createLegacyModTranslator({
      digest: async () => hashes[digestIndex++]!,
      readArchive: async () => {
        archiveReads += 1;
        return contentEntries;
      },
    });

    const status = await translator.inspect([
      { name: "UsefulTooltips.zip", blob: new Blob(["exact"]) },
      { name: "Assets.zip", blob: new Blob(["assets"]) },
    ]);

    expect(status.state).toBe("compatible");
    expect(archiveReads).toBe(1);
    expect(status.profiles).toHaveLength(2);
    const loadedFiles = [
      ...exact.archiveEntries,
      ...contentEntries.map(({ filename }) => filename),
    ].map((filename) => ({ filename }));
    expect(
      translator.allowsSourceOptimization(
        MAP_GENERATION_SOURCE_OPTIMIZATIONS[0],
        loadedFiles,
      ),
    ).toBe(true);
  });

  it("recognizes the clean exact-build API snapshot without weakening write guards", async () => {
    const officialCall = "KinkyDungeonBuildSpecificOfficialApi";
    const compatible = createLegacyModTranslator({
      digest: async () => "9".repeat(64),
      officialApis: [officialCall],
      readArchive: archiveReader([
        archiveEntry("BuildApi.js", `${officialCall}();`),
      ]),
    });
    expect(
      (
        await compatible.inspect([
          { name: "build-api.zip", blob: new Blob(["api"]) },
        ])
      ).state,
    ).toBe("compatible");

    const replacement = createLegacyModTranslator({
      digest: async () => "8".repeat(64),
      officialApis: ["KinkyDungeonCreateMap"],
      readArchive: archiveReader([
        archiveEntry(
          "Replacement.js",
          "KinkyDungeonCreateMap = function replacement() {};",
        ),
      ]),
    });
    expect(
      (
        await replacement.inspect([
          { name: "replacement.zip", blob: new Blob(["replacement"]) },
        ])
      ).reason,
    ).toBe("content-source-sensitive-write:KinkyDungeonCreateMap");
  });

  it("captures runtime APIs before archive reading can add mod globals", async () => {
    const earlyName = "KinkyDungeonEarlySnapshotTestApi";
    const lateName = "KinkyDungeonLateSnapshotTestApi";
    const target = globalThis as typeof globalThis &
      Record<string, unknown>;
    Object.defineProperty(target, earlyName, {
      configurable: true,
      value: () => undefined,
    });
    try {
      const early = createLegacyModTranslator({
        digest: async () => "7".repeat(64),
        readArchive: archiveReader([
          archiveEntry("Early.js", `${earlyName}();`),
        ]),
      });
      expect(
        (
          await early.inspect([
            { name: "early.zip", blob: new Blob(["early"]) },
          ])
        ).state,
      ).toBe("compatible");

      const late = createLegacyModTranslator({
        digest: async () => "6".repeat(64),
        readArchive: async () => {
          Object.defineProperty(target, lateName, {
            configurable: true,
            value: () => undefined,
          });
          return [archiveEntry("Late.js", `${lateName}();`)];
        },
      });
      expect(
        (
          await late.inspect([
            { name: "late.zip", blob: new Blob(["late"]) },
          ])
        ).reason,
      ).toBe(`content-unknown-official-api:${lateName}`);
    } finally {
      Reflect.deleteProperty(target, earlyName);
      Reflect.deleteProperty(target, lateName);
    }
  });

  it("rejects source replacements, built-in mutation, dynamic code, and unknown KD calls", async () => {
    const cases = [
      {
        source:
          "KinkyDungeonCreateMap = function replacement() { return false; };",
        reason:
          "content-source-sensitive-write:KinkyDungeonCreateMap",
      },
      {
        source: "Array.prototype.push = function replacement() {};",
        reason: "content-builtin-mutation:Array.prototype.push",
      },
      {
        source: "const generated = Function('return KDRandom()');",
        reason: "content-dynamic-code:Function",
      },
      {
        source: "KinkyDungeonUnknownOfficialCall();",
        reason:
          "content-unknown-official-api:KinkyDungeonUnknownOfficialCall",
      },
      {
        source: "globalThis[targetName] = replacement;",
        reason: "content-dynamic-global-write",
      },
      {
        source:
          "const root = globalThis; root.KinkyDungeonCreateMap = replacement;",
        reason:
          "content-source-sensitive-write:KinkyDungeonCreateMap",
      },
      {
        source:
          "const prototype = Array.prototype; prototype.push = replacement;",
        reason: "content-builtin-mutation:Array.prototype.push",
      },
      {
        source:
          "const { Function: DynamicFunction } = globalThis; DynamicFunction('return 1');",
        reason: "content-dynamic-code:Function",
      },
      {
        source: "Function.call(null, 'return KDRandom()');",
        reason: "content-dynamic-code:Function",
      },
    ];

    for (const [index, candidate] of cases.entries()) {
      const translator = createLegacyModTranslator({
        digest: async () => index.toString(16).padStart(64, "c"),
        readArchive: archiveReader([
          archiveEntry(`Unsafe-${index}.js`, candidate.source),
        ]),
      });
      const status = await translator.inspect([
        { name: `Unsafe-${index}.zip`, blob: new Blob([candidate.source]) },
      ]);
      expect(status.state, candidate.source).toBe("fallback");
      expect(status.reason, candidate.source).toBe(candidate.reason);
      expect(status.allowedSourceOptimizations).toEqual([]);
    }
  });

  it("fails closed on ambiguous archive structure and executable limits", async () => {
    const duplicate = createLegacyModTranslator({
      digest: async () => "d".repeat(64),
      readArchive: archiveReader([
        archiveEntry("Duplicate.js", "KDRandom();"),
        archiveEntry("Duplicate.js", "KDRandom();"),
      ]),
    });
    expect(
      (
        await duplicate.inspect([
          { name: "duplicate-entry.zip", blob: new Blob(["duplicate"]) },
        ])
      ).reason,
    ).toBe("duplicate-archive-entry");

    const traversal = createLegacyModTranslator({
      digest: async () => "e".repeat(64),
      readArchive: archiveReader([
        archiveEntry("../Outside.js", "KDRandom();"),
      ]),
    });
    expect(
      (
        await traversal.inspect([
          { name: "traversal.zip", blob: new Blob(["traversal"]) },
        ])
      ).reason,
    ).toBe("unsafe-archive-filename");

    const oversizedSource = createLegacyModTranslator({
      digest: async () => "f".repeat(64),
      maxExecutableBytes: 8,
      readArchive: archiveReader([
        archiveEntry("Large.js", "KDRandom();"),
      ]),
    });
    expect(
      (
        await oversizedSource.inspect([
          { name: "large-source.zip", blob: new Blob(["large"]) },
        ])
      ).reason,
    ).toBe("executable-source-too-large");
  });

  it("fails closed for changed, duplicate, oversized, and malformed archives", async () => {
    const known = profileById.get("useful-tooltips-1.33")!;
    const changed = createLegacyModTranslator({
      digest: async () => "f".repeat(64),
    });
    expect(
      (
        await changed.inspect([
          { name: "changed.zip", blob: new Blob(["changed"]) },
        ])
      ).state,
    ).toBe("fallback");

    let digestCalls = 0;
    const duplicate = createLegacyModTranslator({
      digest: async () => {
        digestCalls += 1;
        return known.archiveSha256;
      },
    });
    expect(
      (
        await duplicate.inspect([
          { name: "one.zip", blob: new Blob(["one"]) },
          { name: "two.zip", blob: new Blob(["two"]) },
        ])
      ).reason,
    ).toBe("duplicate-archive");
    expect(digestCalls).toBe(2);

    const oversized = createLegacyModTranslator({
      digest: async () => known.archiveSha256,
      maxArchiveBytes: 2,
    });
    expect(
      (
        await oversized.inspect([
          { name: "large.zip", blob: new Blob(["large"]) },
        ])
      ).reason,
    ).toBe("archive-too-large");

    const malformed = createLegacyModTranslator({
      digest: async () => "not-a-digest",
    });
    expect(
      (
        await malformed.inspect([
          { name: "bad.zip", blob: new Blob(["bad"]) },
        ])
      ).state,
    ).toBe("failed");
  });

  it("lets a newer inspection supersede a pending one", async () => {
    const useful = profileById.get("useful-tooltips-1.33")!;
    let resolveFirst: ((hash: string) => void) | undefined;
    let calls = 0;
    const translator = createLegacyModTranslator({
      digest: () => {
        calls += 1;
        if (calls === 1) {
          return new Promise<string>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve(useful.archiveSha256);
      },
    });
    const first = translator.inspect([
      { name: "old.zip", blob: new Blob(["old"]) },
    ]);
    const second = translator.inspect([
      { name: "new.zip", blob: new Blob(["new"]) },
    ]);
    expect((await second).state).toBe("compatible");
    resolveFirst?.(useful.archiveSha256);
    expect((await first).state).toBe("compatible");
    expect(translator.status().archiveCount).toBe(1);
  });

  it("temporarily hides only an exact compatible registry transaction", async () => {
    const useful = profileById.get("useful-tooltips-1.33")!;
    const translator = createLegacyModTranslator({
      digest: async () => useful.archiveSha256,
    });
    await translator.inspect([
      { name: "UsefulTooltips.zip", blob: new Blob(["useful"]) },
    ]);
    const originalFiles = useful.archiveEntries.map((filename) => ({
      filename,
    }));
    let modsLoaded: unknown = true;
    let files: unknown = originalFiles;
    const activations: boolean[] = [];
    const environment: KDModRegistryEnvironment = {
      modsLoaded: () => modsLoaded,
      allModFiles: () => files,
      setModsLoaded: (value) => {
        modsLoaded = value;
      },
      setAllModFiles: (value) => {
        files = value;
      },
      compatibility: () => translator,
    };

    const result = runWithKDTranslatedModSourceOptimizations(
      () => {
        expect(modsLoaded).toBe(false);
        expect(files).toEqual([]);
        expect(files).not.toBe(originalFiles);
        return "generated";
      },
      environment,
      (active) => activations.push(active),
    );

    expect(result).toBe("generated");
    expect(modsLoaded).toBe(true);
    expect(files).toBe(originalFiles);
    expect(activations).toEqual([true]);
  });

  it("restores exact registry bindings after an exception", async () => {
    const useful = profileById.get("useful-tooltips-1.33")!;
    const translator = createLegacyModTranslator({
      digest: async () => useful.archiveSha256,
    });
    await translator.inspect([
      { name: "UsefulTooltips.zip", blob: new Blob(["useful"]) },
    ]);
    const originalFiles = useful.archiveEntries.map((filename) => ({
      filename,
    }));
    let modsLoaded: unknown = true;
    let files: unknown = originalFiles;
    const environment: KDModRegistryEnvironment = {
      modsLoaded: () => modsLoaded,
      allModFiles: () => files,
      setModsLoaded: (value) => {
        modsLoaded = value;
      },
      setAllModFiles: (value) => {
        files = value;
      },
      compatibility: () => translator,
    };

    expect(() =>
      runWithKDTranslatedModSourceOptimizations(
        () => {
          throw new Error("map failed");
        },
        environment,
      ),
    ).toThrow("map failed");
    expect(modsLoaded).toBe(true);
    expect(files).toBe(originalFiles);
  });

  it("keeps unknown mods on the unmodified JavaScript fallback path", async () => {
    const translator = createLegacyModTranslator({
      digest: async () => "e".repeat(64),
    });
    await translator.inspect([
      { name: "Unknown.zip", blob: new Blob(["unknown"]) },
    ]);
    const originalFiles = [{ filename: "Unknown.ks" }];
    let writes = 0;
    const activations: boolean[] = [];
    const environment: KDModRegistryEnvironment = {
      modsLoaded: () => true,
      allModFiles: () => originalFiles,
      setModsLoaded: () => {
        writes += 1;
      },
      setAllModFiles: () => {
        writes += 1;
      },
      compatibility: () => translator,
    };

    expect(
      runWithKDTranslatedModSourceOptimizations(
        () => "official",
        environment,
        (active) => activations.push(active),
      ),
    ).toBe("official");
    expect(writes).toBe(0);
    expect(activations).toEqual([false]);
  });

  it("rejects a spoofed compatibility object even when it approves every scope", () => {
    const originalFiles = [{ filename: "Spoof.ks" }];
    let writes = 0;
    const environment: KDModRegistryEnvironment = {
      modsLoaded: () => true,
      allModFiles: () => originalFiles,
      setModsLoaded: () => {
        writes += 1;
      },
      setAllModFiles: () => {
        writes += 1;
      },
      compatibility: () => ({
        version: 1,
        inspect: vi.fn(),
        allowsSourceOptimization: () => true,
        status: () => ({
          version: 1,
          state: "compatible",
          reason: null,
          archiveCount: 1,
          profiles: [],
          allowedSourceOptimizations:
            MAP_GENERATION_SOURCE_OPTIMIZATIONS,
        }),
      }),
    };

    expect(
      runWithKDTranslatedModSourceOptimizations(
        () => "official",
        environment,
      ),
    ).toBe("official");
    expect(writes).toBe(0);
  });

  it("freezes its proof surface and honors the developer disable control", async () => {
    const useful = profileById.get("useful-tooltips-1.33")!;
    const translator = createLegacyModTranslator({
      digest: async () => useful.archiveSha256,
    });
    await translator.inspect([
      { name: "UsefulTooltips.zip", blob: new Blob(["useful"]) },
    ]);
    expect(Object.isFrozen(translator)).toBe(true);
    expect(
      Reflect.set(translator, "allowsSourceOptimization", () => true),
    ).toBe(false);

    const originalFiles = useful.archiveEntries.map((filename) => ({
      filename,
    }));
    let writes = 0;
    const environment: KDModRegistryEnvironment = {
      modsLoaded: () => true,
      allModFiles: () => originalFiles,
      setModsLoaded: () => {
        writes += 1;
      },
      setAllModFiles: () => {
        writes += 1;
      },
      compatibility: () => translator,
    };
    const previousControl = globalThis.KDHybridRuntimeControl;
    globalThis.KDHybridRuntimeControl = {
      ...previousControl,
      disableTranslatedModSourceOptimizations: true,
    };
    try {
      expect(
        runWithKDTranslatedModSourceOptimizations(
          () => "official",
          environment,
        ),
      ).toBe("official");
    } finally {
      globalThis.KDHybridRuntimeControl = previousControl;
    }
    expect(writes).toBe(0);
  });

  it("restores the loaded flag even if restoring the file binding throws", async () => {
    const useful = profileById.get("useful-tooltips-1.33")!;
    const translator = createLegacyModTranslator({
      digest: async () => useful.archiveSha256,
    });
    await translator.inspect([
      { name: "UsefulTooltips.zip", blob: new Blob(["useful"]) },
    ]);
    const originalFiles = useful.archiveEntries.map((filename) => ({
      filename,
    }));
    let modsLoaded = true;
    let fileWrites = 0;
    const environment: KDModRegistryEnvironment = {
      modsLoaded: () => modsLoaded,
      allModFiles: () => originalFiles,
      setModsLoaded: (value) => {
        modsLoaded = value;
      },
      setAllModFiles: () => {
        fileWrites += 1;
        if (fileWrites === 2) {
          throw new Error("restore failed");
        }
      },
      compatibility: () => translator,
    };

    expect(() =>
      runWithKDTranslatedModSourceOptimizations(
        () => "generated",
        environment,
      ),
    ).toThrow("restore failed");
    expect(modsLoaded).toBe(true);
  });

  it("does not let diagnostics alter official execution", async () => {
    const useful = profileById.get("useful-tooltips-1.33")!;
    const translator = createLegacyModTranslator({
      digest: async () => useful.archiveSha256,
    });
    await translator.inspect([
      { name: "UsefulTooltips.zip", blob: new Blob(["useful"]) },
    ]);
    const originalFiles = useful.archiveEntries.map((filename) => ({
      filename,
    }));
    let modsLoaded: unknown = true;
    let files: unknown = originalFiles;
    const environment: KDModRegistryEnvironment = {
      modsLoaded: () => modsLoaded,
      allModFiles: () => files,
      setModsLoaded: (value) => {
        modsLoaded = value;
      },
      setAllModFiles: (value) => {
        files = value;
      },
      compatibility: () => translator,
    };

    expect(
      runWithKDTranslatedModSourceOptimizations(
        () => "generated",
        environment,
        () => {
          throw new Error("observer failed");
        },
      ),
    ).toBe("generated");
    expect(modsLoaded).toBe(true);
    expect(files).toBe(originalFiles);
  });

  it("preflights the selected archives before calling KD's loader", async () => {
    const useful = profileById.get("useful-tooltips-1.33")!;
    const calls: string[] = [];
    let resolveDigest: ((hash: string) => void) | undefined;
    let executeMods: ((...args: unknown[]) => unknown) | undefined =
      async () => {
        calls.push("official");
        return "loaded";
      };
    const original = executeMods;
    const environment: KDModLoaderEnvironment = {
      readExecuteMods: () => executeMods,
      replaceExecuteMods: (expected, replacement) => {
        if (executeMods !== expected) {
          return false;
        }
        executeMods = replacement;
        return true;
      },
      readModLoadOrder: () => [
        {
          name: "UsefulTooltips.zip",
          mod: new Blob(["useful"]),
        },
      ],
      schedule: (callback) => {
        callback();
        return 1;
      },
      cancelScheduled: vi.fn(),
    };
    const handle = installKinkyDungeonModTranslator(environment, {
      digest: () => {
        calls.push("digest");
        return new Promise<string>((resolve) => {
          resolveDigest = resolve;
        });
      },
    });

    expect(await handle.loaderReady).toBe(true);
    const returned = executeMods?.();
    expect(calls).toEqual(["digest", "official"]);
    expect(returned).toBeInstanceOf(Promise);
    let settled = false;
    void Promise.resolve(returned).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    resolveDigest?.(useful.archiveSha256);
    expect(await returned).toBe("loaded");
    expect(settled).toBe(true);
    expect(calls).toEqual(["digest", "official"]);
    expect(executeMods?.name).toBe(original?.name);
    expect(handle.status().state).toBe("compatible");
    handle.dispose();
    expect(executeMods).toBe(original);
    expect(handle.status().state).toBe("disposed");
  });
});

function archiveEntry(
  filename: string,
  source?: string,
): LegacyModArchiveEntry {
  const executable = filename.endsWith(".js") || filename.endsWith(".ks");
  const value = source ?? "";
  return Object.freeze({
    filename,
    directory: filename.endsWith("/"),
    uncompressedBytes: new TextEncoder().encode(value).byteLength,
    ...(executable ? { source: value } : {}),
  });
}

function archiveReader(
  entries: readonly LegacyModArchiveEntry[],
): LegacyModArchiveReader {
  return async () => entries;
}
