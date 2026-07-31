import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const patchFixture = vi.hoisted(() => ({
  original: "fixture bundle\n",
  optimized: "fixture bundle\n// optimized\n",
  originalSha256:
    "6800e9d30bcbb0f6b09e02fdd24bcc053505045a2117b2e201ee472b7e86e652",
  optimizedSha256:
    "9764101d24c8a4bc921c0effb7f791a29d9118a95b3e3ce5b226d59a86a2c4b6",
  patch: {
    id: "kd-5.4.92-source-optimizations-v6",
    upstreamVersion: "5.4.92",
    inputSha256:
      "6800e9d30bcbb0f6b09e02fdd24bcc053505045a2117b2e201ee472b7e86e652",
    outputSha256:
      "9764101d24c8a4bc921c0effb7f791a29d9118a95b3e3ce5b226d59a86a2c4b6",
    sourceUrl: "https://example.invalid/kd-5.4.92"
  }
}));

const injectedFailure = vi.hoisted(() => ({
  manifestRenameFailures: 0
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
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
        throw new Error("injected installation manifest rename failure");
      }
      await actual.rename(oldPath, newPath);
    }
  };
});

vi.mock("./kd-source-patches.js", async () => {
  const actual = await vi.importActual<
    typeof import("./kd-source-patches.js")
  >("./kd-source-patches.js");
  return {
    ...actual,
    findKDSourcePatch: (inputSha256: string) =>
      inputSha256 === patchFixture.originalSha256
        ? patchFixture.patch
        : actual.findKDSourcePatch(inputSha256),
    applyKDSourcePatch: (text: string, inputSha256: string) =>
      inputSha256 === patchFixture.originalSha256 &&
      text === patchFixture.original
        ? {
            text: patchFixture.optimized,
            patch: patchFixture.patch
          }
        : actual.applyKDSourcePatch(text, inputSha256)
  };
});

import {
  install,
  status,
  uninstall,
  updateConfiguration
} from "./patcher.js";

const fixtures: string[] = [];

afterEach(async () => {
  injectedFailure.manifestRenameFailures = 0;
  await Promise.all(
    fixtures.splice(0).map((fixture) =>
      rm(fixture, { recursive: true, force: true })
    )
  );
});

describe("source optimization selection", () => {
  it("restores and reapplies the verified source bundle idempotently", async () => {
    const fixture = await createFixture();
    const installed = await installFixture(fixture);
    const backupPath = join(
      fixture.appRoot,
      installed.manifest!.sourcePatch!.backupPath
    );
    const manifestPath = installationManifestPath(fixture.appRoot);
    const indexBefore = await readFile(join(fixture.appRoot, "index.html"));

    expect(installed.manifest?.sourcePatch?.enabled).toBe(true);
    expect(installed.manifest?.settings?.sourceOptimizations).toBe(true);
    expect(await bundleText(fixture.appRoot)).toBe(patchFixture.optimized);
    expect(await readFile(backupPath, "utf8")).toBe(patchFixture.original);
    expect(indexBefore.toString("utf8")).toContain(
      '"sourceOptimizations":true'
    );

    const restored = await updateConfiguration(fixture.appRoot, {
      sourceOptimizations: false
    });
    expect(restored.state).toBe("installed");
    expect(restored.manifest?.sourcePatch?.enabled).toBe(false);
    expect(restored.manifest?.settings?.sourceOptimizations).toBe(false);
    expect(await bundleText(fixture.appRoot)).toBe(patchFixture.original);
    const restoredIndex = await readFile(join(fixture.appRoot, "index.html"));
    expect(restoredIndex.toString("utf8")).toContain(
      '"sourceOptimizations":false'
    );
    expect(restoredIndex.toString("utf8")).toContain(
      '"pathfindingMode":"quality"'
    );
    expect(restoredIndex.toString("utf8")).toContain(
      '"rendering":{"textureMode":"full"}'
    );
    const restoredManifest = await readFile(manifestPath);

    await updateConfiguration(fixture.appRoot, {
      sourceOptimizations: false
    });
    expect(await readFile(manifestPath)).toEqual(restoredManifest);
    expect(await bundleText(fixture.appRoot)).toBe(patchFixture.original);

    const reapplied = await updateConfiguration(fixture.appRoot, {
      sourceOptimizations: true
    });
    expect(reapplied.state).toBe("installed");
    expect(reapplied.manifest?.sourcePatch?.backupPath).toBe(
      installed.manifest?.sourcePatch?.backupPath
    );
    expect(reapplied.manifest?.sourcePatch?.enabled).toBe(true);
    expect(await bundleText(fixture.appRoot)).toBe(patchFixture.optimized);
    expect(await readFile(backupPath, "utf8")).toBe(patchFixture.original);
    expect(await readFile(join(fixture.appRoot, "index.html"))).toEqual(indexBefore);
    const reappliedManifest = await readFile(manifestPath);

    await updateConfiguration(fixture.appRoot, {
      sourceOptimizations: true
    });
    expect(await readFile(manifestPath)).toEqual(reappliedManifest);
    expect(await bundleText(fixture.appRoot)).toBe(patchFixture.optimized);
  });

  it("honors an explicit source choice when Install is rerun without resetting other settings", async () => {
    const fixture = await createFixture();
    await installFixture(fixture);
    await updateConfiguration(fixture.appRoot, {
      pathfindingMode: "human",
      textureMode: "mobile"
    });

    const restored = await install({
      appRoot: fixture.appRoot,
      payloadRoot: fixture.payloadRoot,
      toolVersion: "test",
      allowUnknownBundle: true,
      sourceOptimizations: false,
      pathfindingMode: "quality",
      textureMode: "full"
    });
    expect(restored.manifest?.settings).toEqual({
      pathfindingMode: "human",
      textureMode: "mobile",
      sourceOptimizations: false
    });
    expect(await bundleText(fixture.appRoot)).toBe(patchFixture.original);

    const reapplied = await install({
      appRoot: fixture.appRoot,
      payloadRoot: fixture.payloadRoot,
      toolVersion: "test",
      allowUnknownBundle: true,
      sourceOptimizations: true
    });
    expect(reapplied.manifest?.settings).toEqual({
      pathfindingMode: "human",
      textureMode: "mobile",
      sourceOptimizations: true
    });
    expect(await bundleText(fixture.appRoot)).toBe(patchFixture.optimized);
  });

  it("uninstalls to byte-exact official source from either selected state", async () => {
    for (const enabled of [true, false]) {
      const fixture = await createFixture();
      await installFixture(fixture);
      if (!enabled) {
        await updateConfiguration(fixture.appRoot, {
          sourceOptimizations: false
        });
      }

      const removed = await uninstall(fixture.appRoot);
      expect(removed.state).toBe("not-installed");
      expect(await bundleText(fixture.appRoot)).toBe(patchFixture.original);
      expect(await readFile(fixture.saveSentinel, "utf8")).toBe("do-not-touch");
    }
  });

  it("reads an older enabled manifest and can restore its official backup", async () => {
    const fixture = await createFixture();
    await installFixture(fixture);
    const manifestPath = installationManifestPath(fixture.appRoot);
    const legacy = JSON.parse(await readFile(manifestPath, "utf8")) as {
      index: { patchedSha256: string };
      sourcePatch: { enabled?: boolean };
      settings: { sourceOptimizations?: boolean };
    };
    delete legacy.sourcePatch.enabled;
    delete legacy.settings.sourceOptimizations;
    const indexPath = join(fixture.appRoot, "index.html");
    const legacyIndex = (await readFile(indexPath, "utf8")).replace(
      '"sourceOptimizations":true,',
      ""
    );
    expect(legacyIndex).not.toContain('"sourceOptimizations"');
    legacy.index.patchedSha256 = sha256Text(legacyIndex);
    await writeFile(indexPath, legacyIndex);
    await writeFile(manifestPath, `${JSON.stringify(legacy, null, 2)}\n`);

    expect((await status(fixture.appRoot)).state).toBe("installed");
    const migrated = await updateConfiguration(fixture.appRoot, {
      pathfindingMode: "human"
    });
    expect(await readFile(indexPath, "utf8")).toContain(
      '"sourceOptimizations":true'
    );
    expect(migrated.manifest?.settings?.sourceOptimizations).toBe(true);
    await updateConfiguration(fixture.appRoot, {
      sourceOptimizations: false
    });
    expect(await bundleText(fixture.appRoot)).toBe(patchFixture.original);
  });

  it("upgrades an older source-compatible manifest without overwriting backup data", async () => {
    const fixture = await createFixture();
    const installed = await installFixture(fixture, false);
    const manifestPath = installationManifestPath(fixture.appRoot);
    const backupPath = join(
      fixture.appRoot,
      installed.manifest!.sourcePatch!.backupPath
    );
    const legacy = JSON.parse(await readFile(manifestPath, "utf8")) as {
      sourcePatch?: unknown;
      settings: { sourceOptimizations?: boolean };
    };
    delete legacy.sourcePatch;
    delete legacy.settings.sourceOptimizations;
    await writeFile(manifestPath, `${JSON.stringify(legacy, null, 2)}\n`);
    await rm(backupPath);

    expect((await status(fixture.appRoot)).state).toBe("installed");
    const enabled = await updateConfiguration(fixture.appRoot, {
      sourceOptimizations: true
    });
    expect(enabled.manifest?.sourcePatch?.enabled).toBe(true);
    expect(await readFile(backupPath, "utf8")).toBe(patchFixture.original);
    expect(await bundleText(fixture.appRoot)).toBe(patchFixture.optimized);
  });

  it("refuses a mismatched orphan backup without changing the official bundle", async () => {
    const fixture = await createFixture();
    const installed = await installFixture(fixture, false);
    const manifestPath = installationManifestPath(fixture.appRoot);
    const backupPath = join(
      fixture.appRoot,
      installed.manifest!.sourcePatch!.backupPath
    );
    const legacy = JSON.parse(await readFile(manifestPath, "utf8")) as {
      sourcePatch?: unknown;
      settings: { sourceOptimizations?: boolean };
    };
    delete legacy.sourcePatch;
    delete legacy.settings.sourceOptimizations;
    await writeFile(manifestPath, `${JSON.stringify(legacy, null, 2)}\n`);
    const legacyManifest = await readFile(manifestPath);
    await writeFile(backupPath, "not the official bundle\n");

    await expect(
      updateConfiguration(fixture.appRoot, {
        sourceOptimizations: true
      })
    ).rejects.toThrow(/Refusing to overwrite a mismatched/u);
    expect(await bundleText(fixture.appRoot)).toBe(patchFixture.original);
    expect(await readFile(manifestPath)).toEqual(legacyManifest);
    expect(await readFile(backupPath, "utf8")).toBe(
      "not the official bundle\n"
    );
    await expect(
      stat(join(fixture.appRoot, ".kd-hybrid", "pending-installation.json"))
    ).rejects.toThrow();
  });

  it("detects modified selected bundles and source backups before mutation", async () => {
    const fixture = await createFixture();
    const installed = await installFixture(fixture);
    const backupPath = join(
      fixture.appRoot,
      installed.manifest!.sourcePatch!.backupPath
    );

    await writeFile(join(fixture.appRoot, "out", "main.js"), "modified\n");
    expect(await status(fixture.appRoot)).toMatchObject({
      state: "modified",
      problems: ["out/main.js changed after KD Hybrid installation"]
    });
    await expect(
      updateConfiguration(fixture.appRoot, {
        sourceOptimizations: false
      })
    ).rejects.toThrow(/Refusing settings update over modified/u);

    await writeFile(
      join(fixture.appRoot, "out", "main.js"),
      patchFixture.optimized
    );
    await writeFile(backupPath, "modified backup\n");
    expect((await status(fixture.appRoot)).problems).toContain(
      "Original out/main.js backup hash does not match the manifest"
    );
    await expect(uninstall(fixture.appRoot)).rejects.toThrow(/changed/u);
  });

  it("rejects invalid source values without touching installation state", async () => {
    const fixture = await createFixture();
    await installFixture(fixture);
    const manifestPath = installationManifestPath(fixture.appRoot);
    const manifestBefore = await readFile(manifestPath);
    const bundleBefore = await readFile(join(fixture.appRoot, "out", "main.js"));

    await expect(
      updateConfiguration(fixture.appRoot, {
        sourceOptimizations: "sometimes" as unknown as boolean
      })
    ).rejects.toThrow(/must be true or false/u);
    expect(await readFile(manifestPath)).toEqual(manifestBefore);
    expect(await readFile(join(fixture.appRoot, "out", "main.js"))).toEqual(
      bundleBefore
    );
  });

  it("rolls back bundle, index, and manifest after an injected commit failure", async () => {
    const fixture = await createFixture();
    await installFixture(fixture);
    const manifestPath = installationManifestPath(fixture.appRoot);
    const pendingPath = join(
      fixture.appRoot,
      ".kd-hybrid",
      "pending-installation.json"
    );
    const before = {
      bundle: await readFile(join(fixture.appRoot, "out", "main.js")),
      index: await readFile(join(fixture.appRoot, "index.html")),
      manifest: await readFile(manifestPath)
    };
    injectedFailure.manifestRenameFailures = 1;

    await expect(
      updateConfiguration(fixture.appRoot, {
        sourceOptimizations: false,
        pathfindingMode: "human"
      })
    ).rejects.toThrow(/injected installation manifest rename failure/u);

    expect(await readFile(join(fixture.appRoot, "out", "main.js"))).toEqual(
      before.bundle
    );
    expect(await readFile(join(fixture.appRoot, "index.html"))).toEqual(
      before.index
    );
    expect(await readFile(manifestPath)).toEqual(before.manifest);
    await expect(stat(pendingPath)).rejects.toThrow();
    expect((await status(fixture.appRoot)).state).toBe("installed");
  });

  it("rolls back an uninstall after an injected manifest-history failure", async () => {
    const fixture = await createFixture();
    const installed = await installFixture(fixture);
    const manifestPath = installationManifestPath(fixture.appRoot);
    const pendingPath = join(
      fixture.appRoot,
      ".kd-hybrid",
      "pending-installation.json"
    );
    const bridgePath = join(
      dirname(dirname(fixture.appRoot)),
      "Mods",
      "KDHybridBridge.zip"
    );
    const before = {
      bundle: await readFile(join(fixture.appRoot, "out", "main.js")),
      index: await readFile(join(fixture.appRoot, "index.html")),
      manifest: await readFile(manifestPath),
      bootstrap: await readFile(
        join(fixture.appRoot, "kd-hybrid", "kd-hybrid-bootstrap.js")
      ),
      bridge: await readFile(bridgePath)
    };
    injectedFailure.manifestRenameFailures = 1;

    await expect(uninstall(fixture.appRoot)).rejects.toThrow(
      /injected installation manifest rename failure/u
    );

    expect(await readFile(join(fixture.appRoot, "out", "main.js"))).toEqual(
      before.bundle
    );
    expect(await readFile(join(fixture.appRoot, "index.html"))).toEqual(
      before.index
    );
    expect(await readFile(manifestPath)).toEqual(before.manifest);
    expect(
      await readFile(
        join(fixture.appRoot, "kd-hybrid", "kd-hybrid-bootstrap.js")
      )
    ).toEqual(before.bootstrap);
    expect(await readFile(bridgePath)).toEqual(before.bridge);
    await expect(stat(pendingPath)).rejects.toThrow();
    expect((await status(fixture.appRoot)).state).toBe("installed");

    const removed = await uninstall(fixture.appRoot);
    expect(removed.state).toBe("not-installed");
    expect(await bundleText(fixture.appRoot)).toBe(patchFixture.original);
    expect(installed.manifest?.sourcePatch?.enabled).toBe(true);
  });
});

async function installFixture(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  sourceOptimizations = true
) {
  return install({
    appRoot: fixture.appRoot,
    payloadRoot: fixture.payloadRoot,
    toolVersion: "test",
    allowUnknownBundle: true,
    sourceOptimizations,
    pathfindingMode: "quality",
    textureMode: "full"
  });
}

async function createFixture(): Promise<{
  appRoot: string;
  payloadRoot: string;
  saveSentinel: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "kd-hybrid-source-mode-test-"));
  fixtures.push(root);
  const appRoot = join(root, "game", "resources", "app");
  const payloadRoot = join(root, "payload");
  const saveRoot = join(root, "userData", "Kinky Dungeon");
  await Promise.all([
    mkdir(join(appRoot, "out"), { recursive: true }),
    mkdir(join(payloadRoot, "wasm"), { recursive: true }),
    mkdir(saveRoot, { recursive: true })
  ]);
  await Promise.all([
    writeFile(
      join(appRoot, "index.html"),
      '<!doctype html><script src="./out/main.js"></script>\n'
    ),
    writeFile(join(appRoot, "out", "main.js"), patchFixture.original),
    writeFile(
      join(payloadRoot, "kd-hybrid-bootstrap.js"),
      "globalThis.fixture = true;\n"
    ),
    writeFile(join(payloadRoot, "KDHybridBridge.zip"), "test"),
    writeFile(
      join(payloadRoot, "wasm", "core.wasm"),
      Uint8Array.of(0, 97, 115, 109)
    )
  ]);
  const saveSentinel = join(saveRoot, "profile.sav");
  await writeFile(saveSentinel, "do-not-touch");
  return { appRoot, payloadRoot, saveSentinel };
}

function installationManifestPath(appRoot: string): string {
  return join(appRoot, ".kd-hybrid", "installation.json");
}

function bundleText(appRoot: string): Promise<string> {
  return readFile(join(appRoot, "out", "main.js"), "utf8");
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
