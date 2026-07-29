import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  KNOWN_BUNDLES,
  install,
  status,
  uninstall,
  updateConfiguration,
  updatePathfindingMode,
  updateTextureMode
} from "./patcher.js";

const fixtures: string[] = [];

it("distinguishes the in-game and Electron package versions", () => {
  expect(KNOWN_BUNDLES["5.4.92"]).toEqual({
    packageVersion: "5.1.12",
    bundleSha256: "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4"
  });
});

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    fixtures.splice(0).map((fixture) => rm(fixture, { recursive: true, force: true }))
  );
});

describe("reversible patcher", () => {
  it("installs idempotently, restores exact index, and never touches a save sibling", async () => {
    const fixture = await createFixture();
    const original = await readFile(join(fixture.appRoot, "index.html"));
    const first = await install({
      appRoot: fixture.appRoot,
      payloadRoot: fixture.payloadRoot,
      toolVersion: "test",
      allowUnknownBundle: true
    });
    expect(first.state).toBe("installed");
    expect(await install({
      appRoot: fixture.appRoot,
      payloadRoot: fixture.payloadRoot,
      toolVersion: "test",
      allowUnknownBundle: true
    })).toEqual(first);
    expect(await readFile(join(fixture.appRoot, "index.html"), "utf8")).toContain(
      "kd-hybrid/kd-hybrid-bootstrap.js"
    );
    expect(await readFile(fixture.saveSentinel, "utf8")).toBe("do-not-touch");

    const removed = await uninstall(fixture.appRoot);
    expect(removed.state).toBe("not-installed");
    expect(await readFile(join(fixture.appRoot, "index.html"))).toEqual(original);
    expect(await readFile(fixture.saveSentinel, "utf8")).toBe("do-not-touch");
    expect(
      (await stat(join(fixture.appRoot, ".kd-hybrid", "uninstalled"))).isDirectory()
    ).toBe(true);
  });

  it("refuses an unknown bundle unless explicitly allowed", async () => {
    const fixture = await createFixture();
    await expect(
      install({
        appRoot: fixture.appRoot,
        payloadRoot: fixture.payloadRoot,
        toolVersion: "test"
      })
    ).rejects.toThrow(/Unknown out\/main\.js SHA-256/u);
    expect((await status(fixture.appRoot)).state).toBe("not-installed");
  });

  it("refuses to overwrite user changes during uninstall", async () => {
    const fixture = await createFixture();
    await install({
      appRoot: fixture.appRoot,
      payloadRoot: fixture.payloadRoot,
      toolVersion: "test",
      allowUnknownBundle: true
    });
    await writeFile(
      join(fixture.appRoot, "kd-hybrid", "kd-hybrid-bootstrap.js"),
      "user modification"
    );
    expect((await status(fixture.appRoot)).state).toBe("modified");
    await expect(uninstall(fixture.appRoot)).rejects.toThrow(/changed/u);
  });

  it("updates the persisted planner mode without replacing the backup", async () => {
    const fixture = await createFixture();
    const original = await readFile(join(fixture.appRoot, "index.html"));
    const installed = await install({
      appRoot: fixture.appRoot,
      payloadRoot: fixture.payloadRoot,
      toolVersion: "test",
      allowUnknownBundle: true,
      pathfindingMode: "quality"
    });
    const backupPath = installed.manifest?.index.backupPath;

    const updated = await updatePathfindingMode(fixture.appRoot, "human");
    expect(updated.state).toBe("installed");
    expect(updated.manifest?.settings?.pathfindingMode).toBe("human");
    expect(updated.manifest?.settings?.textureMode).toBe("auto");
    expect(updated.manifest?.index.backupPath).toBe(backupPath);
    expect(await readFile(join(fixture.appRoot, "index.html"), "utf8")).toContain(
      '"pathfindingMode":"human"'
    );

    await uninstall(fixture.appRoot);
    expect(await readFile(join(fixture.appRoot, "index.html"))).toEqual(original);
    expect(await readFile(fixture.saveSentinel, "utf8")).toBe("do-not-touch");
  });

  it("atomically configures mobile, full, original, and automatic texture selection", async () => {
    const fixture = await createFixture();
    const original = await readFile(join(fixture.appRoot, "index.html"));
    const installed = await install({
      appRoot: fixture.appRoot,
      payloadRoot: fixture.payloadRoot,
      toolVersion: "test",
      allowUnknownBundle: true,
      pathfindingMode: "quality",
      textureMode: "full"
    });
    const backupPath = installed.manifest?.index.backupPath;
    expect(await readFile(join(fixture.appRoot, "index.html"), "utf8")).toContain(
      '"rendering":{"textureMode":"full"}'
    );

    for (const mode of ["mobile", "original"] as const) {
      const updated = await updateTextureMode(fixture.appRoot, mode);
      expect(updated.state).toBe("installed");
      expect(updated.manifest?.settings).toEqual({
        pathfindingMode: "quality",
        textureMode: mode
      });
      expect(updated.manifest?.index.backupPath).toBe(backupPath);
      expect(
        await readFile(join(fixture.appRoot, "index.html"), "utf8")
      ).toContain(`"rendering":{"textureMode":"${mode}"}`);
    }

    const automatic = await updateConfiguration(fixture.appRoot, {
      pathfindingMode: "fast",
      textureMode: "auto"
    });
    expect(automatic.manifest?.settings).toEqual({
      pathfindingMode: "fast",
      textureMode: "auto"
    });
    const automaticIndex = await readFile(
      join(fixture.appRoot, "index.html"),
      "utf8"
    );
    expect(automaticIndex).not.toContain('"rendering"');
    expect(automaticIndex).toContain('"pathfindingMode":"fast"');
    await expect(
      stat(join(fixture.appRoot, ".kd-hybrid", "pending-installation.json"))
    ).rejects.toThrow();
    const pendingPath = join(
      fixture.appRoot,
      ".kd-hybrid",
      "pending-installation.json"
    );
    await writeFile(pendingPath, "{}");
    expect(await status(fixture.appRoot)).toMatchObject({
      state: "incomplete",
      problems: ["pending installation manifest exists"]
    });
    await rm(pendingPath);

    await uninstall(fixture.appRoot);
    expect(await readFile(join(fixture.appRoot, "index.html"))).toEqual(original);
    expect(await readFile(fixture.saveSentinel, "utf8")).toBe("do-not-touch");
  });
});

async function createFixture(): Promise<{
  appRoot: string;
  payloadRoot: string;
  saveSentinel: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "kd-hybrid-test-"));
  fixtures.push(root);
  const appRoot = join(root, "game", "resources", "app");
  const payloadRoot = join(root, "payload");
  const saveRoot = join(root, "userData", "Kinky Dungeon");
  await mkdir(join(appRoot, "out"), { recursive: true });
  await mkdir(join(payloadRoot, "wasm"), { recursive: true });
  await mkdir(saveRoot, { recursive: true });
  await writeFile(
    join(appRoot, "index.html"),
    '<!doctype html><script src="./out/main.js"></script>\n'
  );
  await writeFile(join(appRoot, "out", "main.js"), "fixture bundle\n");
  await writeFile(
    join(payloadRoot, "kd-hybrid-bootstrap.js"),
    "globalThis.fixture = true;\n"
  );
  await writeFile(join(payloadRoot, "wasm", "core.wasm"), Uint8Array.of(0, 97, 115, 109));
  const saveSentinel = join(saveRoot, "profile.sav");
  await writeFile(saveSentinel, "do-not-touch");
  return { appRoot, payloadRoot, saveSentinel };
}
