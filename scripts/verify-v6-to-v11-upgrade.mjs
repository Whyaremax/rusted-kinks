// SPDX-License-Identifier: MIT
// Copies an existing installation into a disposable game root; never edits the original.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const [sourceAppInput, kitInput, mode] = process.argv.slice(2);
if (!sourceAppInput || !kitInput) {
  throw new Error("Usage: node scripts/verify-v6-to-v11-upgrade.mjs <installed-resources-app> <kit-root> [wrapper]");
}
const sourceApp = path.resolve(sourceAppInput);
const kitRoot = path.resolve(kitInput);
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "rk-v6-upgrade-check-"));
const appRoot = path.join(temporaryRoot, "resources", "app");
const tool = path.join(kitRoot, "tools", "kd-hybrid-tool.mjs");
const payload = path.join(kitRoot, "bootstrap");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const run = (command, extra = []) => {
  const result = spawnSync(process.execPath, [tool, command, "--app-root", appRoot, ...extra], {
    encoding: "utf8", windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
  return JSON.parse(result.stdout);
};

try {
  await mkdir(path.join(appRoot, "out"), { recursive: true });
  await mkdir(path.join(temporaryRoot, "Mods"), { recursive: true });
  await cp(path.join(sourceApp, ".kd-hybrid"), path.join(appRoot, ".kd-hybrid"), { recursive: true });
  await cp(path.join(sourceApp, "kd-hybrid"), path.join(appRoot, "kd-hybrid"), { recursive: true });
  await cp(path.join(sourceApp, "index.html"), path.join(appRoot, "index.html"));
  await cp(path.join(sourceApp, "out", "main.js"), path.join(appRoot, "out", "main.js"));
  const sentinel = path.join(temporaryRoot, "save-sentinel.txt");
  await writeFile(sentinel, "unchanged\n");

  const before = run("status");
  assert.equal(before.state, "installed");
  assert.equal(before.manifest?.sourcePatch?.id, "kd-5.4.92-source-optimizations-v6");
  const originalMain = await readFile(path.join(appRoot, before.manifest.sourcePatch.backupPath));
  const originalIndex = await readFile(path.join(appRoot, before.manifest.index.backupPath));
  assert.equal(hash(originalMain), "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4");

  let installed;
  if (mode === "wrapper") {
    const script = path.join(kitRoot, "KDHybrid-Patcher.ps1");
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script,
    ], {
      input: `${temporaryRoot}\n\n`, encoding: "utf8", windowsHide: true,
      timeout: 20_000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
    installed = run("status");
  } else {
    installed = run("install", [
      "--payload", payload,
      "--upstream-version", "5.4.92",
      "--source-optimizations", "true",
    ]);
  }
  assert.equal(installed.state, "installed");
  assert.equal(installed.manifest?.sourcePatch?.id, "kd-5.4.92-source-optimizations-v11");
  assert.equal(hash(await readFile(path.join(appRoot, "out", "main.js"))), "6bcc1b1de30441efbc1e08b9caccb692c6a4fd1aad998c2affbb9b35e94f17d0");
  assert.equal(installed.manifest?.toolVersion, "0.1.4-rc.2");
  assert.equal(hash(await readFile(path.join(temporaryRoot, "Mods", "KDHybridBridge.zip"))), installed.manifest.modBridge.sha256);
  assert.equal((await readFile(path.join(appRoot, "kd-hybrid", "version.json"), "utf8")).includes('"version": "0.1.4-rc.2"'), true);

  assert.equal(run("uninstall").state, "not-installed");
  assert.deepEqual(await readFile(path.join(appRoot, "out", "main.js")), originalMain);
  assert.deepEqual(await readFile(path.join(appRoot, "index.html")), originalIndex);
  assert.equal(await readFile(sentinel, "utf8"), "unchanged\n");
  process.stdout.write(`v6 to v11 ${mode === "wrapper" ? "PowerShell" : "CLI"} upgrade, mod bridge, and byte-exact uninstall passed\n`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
