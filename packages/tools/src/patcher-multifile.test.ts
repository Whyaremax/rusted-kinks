import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const fixturePatch = vi.hoisted(() => {
  const hashes = {
    mainOfficial:
      "2926c6be8e612dd34c0d7031440291b43441beeabe276e5a9dfb4995f6f0b209",
    mainLegacy:
      "21a92471d0bb7ed77a20a7a277ebd4e05db7b766af0b0607ffaefadea3637c0a",
    mainActive:
      "d9a20394454401d719374241cbeaef57b96fe2ebf3ba88946c5b1b0a841d33c0",
    filterOfficial:
      "6f2c15b1f9479c41e25e884c499e75338d25030c755731683c56313cf93f611a",
    filterActive:
      "2ddf0184b064bdd7e82d5e9f1d9a975f91e9ac13659715fa4d835eb315df6f1d"
  };
  const legacy = {
    id: "fixture-source-optimizations-v6",
    upstreamVersion: "fixture",
    inputSha256: hashes.mainOfficial,
    outputSha256: hashes.mainLegacy,
    sourceUrl: "https://example.invalid/fixture-v6"
  };
  const active = {
    id: "fixture-source-optimizations-v7",
    upstreamVersion: "fixture",
    inputSha256: hashes.mainOfficial,
    outputSha256: hashes.mainActive,
    sourceUrl: "https://example.invalid/fixture-v7",
    files: [
      {
        path: "out/main.js",
        inputSha256: hashes.mainOfficial,
        outputSha256: hashes.mainActive
      },
      {
        path: "Scripts/lib/pixi-filters.js",
        inputSha256: hashes.filterOfficial,
        outputSha256: hashes.filterActive
      }
    ]
  };
  return {
    hashes,
    legacy,
    active,
    mode: "active" as "legacy" | "active"
  };
});

const injectedFailure = vi.hoisted(() => ({
  manifestRenameFailures: 0,
  target: "",
  targetFailures: 0
}));

vi.mock("node:fs/promises", async () => {
  const actual =
    await vi.importActual<typeof import("node:fs/promises")>(
      "node:fs/promises"
    );
  return {
    ...actual,
    rename: async (
      oldPath: Parameters<typeof actual.rename>[0],
      newPath: Parameters<typeof actual.rename>[1]
    ): Promise<void> => {
      if (
        injectedFailure.manifestRenameFailures > 0 &&
        basename(String(newPath)) === "installation.json"
      ) {
        injectedFailure.manifestRenameFailures -= 1;
        throw new Error("injected multi-file manifest failure");
      }
      if (
        injectedFailure.targetFailures > 0 &&
        basename(String(newPath)) === injectedFailure.target
      ) {
        injectedFailure.targetFailures -= 1;
        throw new Error(`injected ${injectedFailure.target} write failure`);
      }
      await actual.rename(oldPath, newPath);
    }
  };
});

vi.mock("./kd-source-patches.js", async () => {
  const actual = await vi.importActual<typeof import("./kd-source-patches.js")>(
    "./kd-source-patches.js"
  );
  return {
    ...actual,
    findKDSourcePatch: (inputSha256: string) =>
      inputSha256 === fixturePatch.hashes.mainOfficial
        ? fixturePatch.mode === "legacy"
          ? fixturePatch.legacy
          : fixturePatch.active
        : actual.findKDSourcePatch(inputSha256),
    findKDSourcePatchById: (id: string) =>
      id === fixturePatch.legacy.id
        ? fixturePatch.legacy
        : id === fixturePatch.active.id
          ? fixturePatch.active
          : actual.findKDSourcePatchById(id),
    applyKDSourcePatch: (text: string, inputSha256: string) =>
      fixturePatch.mode === "legacy" &&
      inputSha256 === fixturePatch.hashes.mainOfficial &&
      text === "main official\n"
        ? {
            text: "main legacy v6\n",
            patch: fixturePatch.legacy
          }
        : actual.applyKDSourcePatch(text, inputSha256),
    applyKDSourcePatchFiles: (
      inputs: readonly { path: string; text: string; sha256: string }[]
    ) => {
      if (fixturePatch.mode !== "active") {
        return actual.applyKDSourcePatchFiles(inputs);
      }
      const byPath = new Map(inputs.map((input) => [input.path, input]));
      if (
        byPath.get("out/main.js")?.text !== "main official\n" ||
        byPath.get("Scripts/lib/pixi-filters.js")?.text !== "filter official\n"
      ) {
        throw new Error("fixture multi-file input mismatch");
      }
      return {
        patch: fixturePatch.active,
        files: [
          {
            ...fixturePatch.active.files[0],
            text: "main active v7\n"
          },
          {
            ...fixturePatch.active.files[1],
            text: "filter active v7\n"
          }
        ]
      };
    }
  };
});

import { install, status, uninstall, updateConfiguration } from "./patcher.js";

const fixtures: string[] = [];

afterEach(async () => {
  fixturePatch.mode = "active";
  injectedFailure.manifestRenameFailures = 0;
  injectedFailure.target = "";
  injectedFailure.targetFailures = 0;
  await Promise.all(
    fixtures
      .splice(0)
      .map((fixture) => rm(fixture, { recursive: true, force: true }))
  );
});

describe("multi-file source transformations", () => {
  it("applies, toggles, verifies, and uninstalls every file byte-exactly", async () => {
    const fixture = await createFixture();
    const installed = await installFixture(fixture, "v7");

    expect(installed.state).toBe("installed");
    expect(installed.manifest?.sourcePatch?.id).toBe(fixturePatch.active.id);
    expect(installed.manifest?.sourcePatch?.files).toHaveLength(2);
    const serializedManifest = await readFile(
      installationManifestPath(fixture.appRoot),
      "utf8"
    );
    expect(serializedManifest).not.toContain('"original":');
    expect(serializedManifest).not.toContain('"patched":');
    expect(serializedManifest.length).toBeLessThan(100_000);
    expect(
      Object.keys(installed.manifest!.sourcePatch!.files![0]!).sort()
    ).toEqual(
      [
        "backupPath",
        "originalSha256",
        "patchedSha256",
        "path"
      ].sort()
    );
    expect(await sourceTexts(fixture.appRoot)).toEqual({
      main: "main active v7\n",
      filter: "filter active v7\n"
    });
    for (const file of installed.manifest!.sourcePatch!.files!) {
      expect(
        await readFile(join(fixture.appRoot, file.backupPath), "utf8")
      ).toBe(
        file.path === "out/main.js" ? "main official\n" : "filter official\n"
      );
    }

    const disabled = await updateConfiguration(fixture.appRoot, {
      sourceOptimizations: false
    });
    expect(disabled.state).toBe("installed");
    expect(await sourceTexts(fixture.appRoot)).toEqual({
      main: "main official\n",
      filter: "filter official\n"
    });

    await updateConfiguration(fixture.appRoot, { sourceOptimizations: true });
    expect(await sourceTexts(fixture.appRoot)).toEqual({
      main: "main active v7\n",
      filter: "filter active v7\n"
    });
    expect((await uninstall(fixture.appRoot)).state).toBe("not-installed");
    expect(await sourceTexts(fixture.appRoot)).toEqual({
      main: "main official\n",
      filter: "filter official\n"
    });
    expect(await readFile(fixture.saveSentinel, "utf8")).toBe("do-not-touch");
  });

  it("rolls every source file and the manifest back after a commit failure", async () => {
    const fixture = await createFixture();
    await installFixture(fixture, "v7");
    const manifestPath = installationManifestPath(fixture.appRoot);
    const before = {
      sources: await sourceTexts(fixture.appRoot),
      manifest: await readFile(manifestPath),
      index: await readFile(join(fixture.appRoot, "index.html"))
    };
    injectedFailure.manifestRenameFailures = 1;

    await expect(
      updateConfiguration(fixture.appRoot, { sourceOptimizations: false })
    ).rejects.toThrow(/injected multi-file manifest failure/u);

    expect(await sourceTexts(fixture.appRoot)).toEqual(before.sources);
    expect(await readFile(manifestPath)).toEqual(before.manifest);
    expect(await readFile(join(fixture.appRoot, "index.html"))).toEqual(
      before.index
    );
    expect((await status(fixture.appRoot)).state).toBe("installed");
  });

  it("rolls a fresh install back after failure following main or auxiliary writes", async () => {
    for (const target of ["pixi-filters.js", "index.html"]) {
      const fixture = await createFixture();
      const originalIndex = await readFile(join(fixture.appRoot, "index.html"));
      injectedFailure.target = target;
      injectedFailure.targetFailures = 1;

      await expect(installFixture(fixture, "v7")).rejects.toThrow(
        new RegExp(`injected ${target.replace(".", "\\.")} write failure`, "u")
      );

      expect(await sourceTexts(fixture.appRoot)).toEqual({
        main: "main official\n",
        filter: "filter official\n"
      });
      expect(await readFile(join(fixture.appRoot, "index.html"))).toEqual(
        originalIndex
      );
      await expect(
        stat(join(fixture.appRoot, ".kd-hybrid", "installation.json"))
      ).rejects.toThrow();
      await expect(
        stat(join(fixture.appRoot, ".kd-hybrid", "pending-installation.json"))
      ).rejects.toThrow();
      await expect(stat(join(fixture.appRoot, "kd-hybrid"))).rejects.toThrow();
      await expect(
        stat(
          join(dirname(dirname(fixture.appRoot)), "Mods", "KDHybridBridge.zip")
        )
      ).rejects.toThrow();
      expect(await readFile(fixture.saveSentinel, "utf8")).toBe("do-not-touch");
    }
  });

  it("refuses a tampered auxiliary file before install or migration mutation", async () => {
    const fresh = await createFixture();
    await writeFile(
      join(fresh.appRoot, "Scripts", "lib", "pixi-filters.js"),
      "tampered\n"
    );
    await expect(installFixture(fresh, "v7")).rejects.toThrow(/exact input/u);
    expect(await readFile(join(fresh.appRoot, "out", "main.js"), "utf8")).toBe(
      "main official\n"
    );

    const legacy = await createFixture();
    fixturePatch.mode = "legacy";
    const oldInstall = await installFixture(legacy, "v6");
    const oldManifest = await readFile(
      installationManifestPath(legacy.appRoot)
    );
    await writeFile(
      join(legacy.appRoot, "Scripts", "lib", "pixi-filters.js"),
      "tampered\n"
    );
    fixturePatch.mode = "active";

    await expect(installFixture(legacy, "v7")).rejects.toThrow(
      /modified auxiliary/u
    );
    expect(await readFile(join(legacy.appRoot, "out", "main.js"), "utf8")).toBe(
      "main legacy v6\n"
    );
    expect(await readFile(installationManifestPath(legacy.appRoot))).toEqual(
      oldManifest
    );
    expect(oldInstall.manifest?.sourcePatch?.files).toBeUndefined();
  });

  it("refuses uninstall when an auxiliary original backup was tampered", async () => {
    const fixture = await createFixture();
    const installed = await installFixture(fixture, "v7");
    const auxiliary = installed.manifest!.sourcePatch!.files!.find(
      (file) => file.path === "Scripts/lib/pixi-filters.js"
    )!;
    const backup = join(fixture.appRoot, auxiliary.backupPath);
    await writeFile(backup, "tampered backup\n");

    const modified = await status(fixture.appRoot);
    expect(modified.state).toBe("modified");
    expect(modified.problems).toContain(
      "Original Scripts/lib/pixi-filters.js backup hash does not match the manifest"
    );
    await expect(uninstall(fixture.appRoot)).rejects.toThrow(/changed/u);

    await writeFile(backup, "filter official\n");
    expect((await uninstall(fixture.appRoot)).state).toBe("not-installed");
  });

  it("migrates an installed v6 bundle from its verified backup into active v7", async () => {
    const fixture = await createFixture();
    fixturePatch.mode = "legacy";
    const legacy = await installFixture(fixture, "v6");
    const legacyBackup = legacy.manifest!.sourcePatch!.backupPath;
    expect(await sourceTexts(fixture.appRoot)).toEqual({
      main: "main legacy v6\n",
      filter: "filter official\n"
    });

    fixturePatch.mode = "active";
    const migrated = await installFixture(fixture, "v7");

    expect(migrated.state).toBe("installed");
    expect(migrated.manifest?.sourcePatch?.id).toBe(fixturePatch.active.id);
    expect(migrated.manifest?.sourcePatch?.backupPath).toBe(legacyBackup);
    expect(migrated.manifest?.sourcePatch?.files).toHaveLength(2);
    expect(await readFile(join(fixture.appRoot, legacyBackup), "utf8")).toBe(
      "main official\n"
    );
    expect(await sourceTexts(fixture.appRoot)).toEqual({
      main: "main active v7\n",
      filter: "filter active v7\n"
    });
  });

  it("removes newly-created auxiliary backups when migration rolls back", async () => {
    const fixture = await createFixture();
    fixturePatch.mode = "legacy";
    const legacy = await installFixture(fixture, "v6");
    const installationId = legacy.manifest!.id;
    fixturePatch.mode = "active";
    injectedFailure.manifestRenameFailures = 1;

    await expect(installFixture(fixture, "v7")).rejects.toThrow(
      /injected multi-file manifest failure/u
    );

    expect((await status(fixture.appRoot)).manifest?.sourcePatch?.id).toBe(
      fixturePatch.legacy.id
    );
    expect(await sourceTexts(fixture.appRoot)).toEqual({
      main: "main legacy v6\n",
      filter: "filter official\n"
    });
    await expect(
      stat(
        join(
          fixture.appRoot,
          ".kd-hybrid",
          "backups",
          installationId,
          "source",
          "Scripts",
          "lib",
          "pixi-filters.js"
        )
      )
    ).rejects.toThrow();
  });

  it("accepts the genuine v0.1.2 single-file source manifest shape", async () => {
    const fixture = await createFixture();
    fixturePatch.mode = "legacy";
    await installFixture(fixture, "v0.1.2");
    const manifestPath = installationManifestPath(fixture.appRoot);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      sourcePatch: { enabled?: boolean; files?: unknown[] };
      settings: {
        sourceOptimizations?: boolean;
        textureMode?: string;
      };
    };
    delete manifest.sourcePatch.enabled;
    delete manifest.sourcePatch.files;
    delete manifest.settings.sourceOptimizations;
    delete manifest.settings.textureMode;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    expect((await status(fixture.appRoot)).state).toBe("installed");
    expect(
      (
        await updateConfiguration(fixture.appRoot, {
          sourceOptimizations: false
        })
      ).state
    ).toBe("installed");
    expect(
      (
        await updateConfiguration(fixture.appRoot, {
          sourceOptimizations: true
        })
      ).state
    ).toBe("installed");
    expect((await uninstall(fixture.appRoot)).state).toBe("not-installed");
  });

  it("writes no backup before the pending journal exists", async () => {
    const fixture = await createFixture();
    injectedFailure.target = "pending-installation.json";
    injectedFailure.targetFailures = 1;

    await expect(installFixture(fixture, "v7")).rejects.toThrow(
      /injected pending-installation\.json write failure/u
    );

    expect((await status(fixture.appRoot)).state).toBe("not-installed");
    await expect(
      stat(join(fixture.appRoot, ".kd-hybrid", "backups"))
    ).rejects.toThrow();
    expect(await sourceTexts(fixture.appRoot)).toEqual({
      main: "main official\n",
      filter: "filter official\n"
    });
  });

  it("adds the modern mobile meta during existing-install migration and restores exact index", async () => {
    const fixture = await createFixture();
    const originalIndex = await readFile(join(fixture.appRoot, "index.html"));
    fixturePatch.mode = "legacy";
    const legacy = await installFixture(fixture, "v6");
    const manifestPath = installationManifestPath(fixture.appRoot);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      upstream: { known: boolean };
    };
    manifest.upstream.known = true;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    expect(
      await readFile(join(fixture.appRoot, "index.html"), "utf8")
    ).not.toContain('name="mobile-web-app-capable"');
    expect(legacy.manifest?.sourcePatch?.id).toBe(fixturePatch.legacy.id);

    fixturePatch.mode = "active";
    const migrated = await installFixture(fixture, "v7");
    const migratedIndex = await readFile(
      join(fixture.appRoot, "index.html"),
      "utf8"
    );
    expect(migrated.state).toBe("installed");
    expect(migratedIndex).toContain(
      '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">'
    );
    await uninstall(fixture.appRoot);
    expect(await readFile(join(fixture.appRoot, "index.html"))).toEqual(
      originalIndex
    );
  });

  it("rejects traversal and a symlinked auxiliary target", async () => {
    const fixture = await createFixture();
    const installed = await installFixture(fixture, "v7");
    const manifestPath = installationManifestPath(fixture.appRoot);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      sourcePatch: { files: Array<{ path: string }> };
    };
    manifest.sourcePatch.files[1]!.path = "../outside.js";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await expect(status(fixture.appRoot)).rejects.toThrow(
      /Unsafe source manifest/u
    );
    expect(installed.manifest?.sourcePatch?.files).toHaveLength(2);

    const linked = await createFixture({ omitAuxiliaryDirectory: true });
    const outside = join(dirname(linked.appRoot), "outside-lib");
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, "pixi-filters.js"), "filter official\n");
    await symlink(outside, join(linked.appRoot, "Scripts", "lib"), "junction");
    await expect(installFixture(linked, "v7")).rejects.toThrow(
      /Symbolic links are forbidden/u
    );
  });

  it("rejects incomplete or forged retained source metadata", async () => {
    const fixture = await createFixture();
    const installed = await installFixture(fixture, "v7");
    const manifestPath = installationManifestPath(fixture.appRoot);
    const baseline = JSON.parse(await readFile(manifestPath, "utf8")) as {
      sourcePatch: {
        id: string;
        files: unknown[];
        sourceUrl: string;
      };
    };

    for (const mutate of [
      (manifest: typeof baseline) => {
        manifest.sourcePatch.files = [];
      },
      (manifest: typeof baseline) => {
        manifest.sourcePatch.sourceUrl = "https://example.invalid/forged";
      },
      (manifest: typeof baseline) => {
        manifest.sourcePatch.id = "not-retained";
      }
    ]) {
      const forged = structuredClone(baseline);
      mutate(forged);
      await writeFile(manifestPath, `${JSON.stringify(forged, null, 2)}\n`);
      await expect(status(fixture.appRoot)).rejects.toThrow();
    }
    expect(installed.manifest?.sourcePatch?.files).toHaveLength(2);
  });
});

async function installFixture(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  toolVersion: string
) {
  return install({
    appRoot: fixture.appRoot,
    payloadRoot: fixture.payloadRoot,
    toolVersion,
    allowUnknownBundle: true,
    sourceOptimizations: true
  });
}

async function createFixture(
  options: { omitAuxiliaryDirectory?: boolean } = {}
): Promise<{
  appRoot: string;
  payloadRoot: string;
  saveSentinel: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "kd-hybrid-multifile-test-"));
  fixtures.push(root);
  const appRoot = join(root, "game", "resources", "app");
  const payloadRoot = join(root, "payload");
  const saveRoot = join(root, "userData", "Kinky Dungeon");
  await Promise.all([
    mkdir(join(appRoot, "out"), { recursive: true }),
    mkdir(join(appRoot, "Scripts"), { recursive: true }),
    mkdir(payloadRoot, { recursive: true }),
    mkdir(saveRoot, { recursive: true })
  ]);
  if (options.omitAuxiliaryDirectory !== true) {
    await mkdir(join(appRoot, "Scripts", "lib"), { recursive: true });
  }
  await Promise.all([
    writeFile(
      join(appRoot, "index.html"),
      '<!doctype html><meta name="apple-mobile-web-app-capable" content="yes">\n<script src="./out/main.js"></script>\n'
    ),
    writeFile(join(appRoot, "out", "main.js"), "main official\n"),
    ...(options.omitAuxiliaryDirectory === true
      ? []
      : [
          writeFile(
            join(appRoot, "Scripts", "lib", "pixi-filters.js"),
            "filter official\n"
          )
        ]),
    writeFile(
      join(payloadRoot, "kd-hybrid-bootstrap.js"),
      "globalThis.fixture = true;\n"
    ),
    writeFile(join(payloadRoot, "KDHybridBridge.zip"), "bridge")
  ]);
  const saveSentinel = join(saveRoot, "profile.sav");
  await writeFile(saveSentinel, "do-not-touch");
  return { appRoot, payloadRoot, saveSentinel };
}

async function sourceTexts(appRoot: string): Promise<{
  main: string;
  filter: string;
}> {
  const [main, filter] = await Promise.all([
    readFile(join(appRoot, "out", "main.js"), "utf8"),
    readFile(join(appRoot, "Scripts", "lib", "pixi-filters.js"), "utf8")
  ]);
  return { main, filter };
}

function installationManifestPath(appRoot: string): string {
  return join(appRoot, ".kd-hybrid", "installation.json");
}
