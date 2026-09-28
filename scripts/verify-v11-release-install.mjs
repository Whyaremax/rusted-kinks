// SPDX-License-Identifier: MIT
// Runs only against a disposable copy; never launches the game.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const [cleanBundlePath, cleanIndexPath, kitPath] = process.argv.slice(2);
if (!cleanBundlePath || !cleanIndexPath || !kitPath) {
  throw new Error("Usage: node scripts/verify-v11-release-install.mjs <clean-main.js> <clean-index.html> <kit-root>");
}
const [cleanBundle, cleanIndex] = await Promise.all([
  readFile(path.resolve(cleanBundlePath)),
  readFile(path.resolve(cleanIndexPath)),
]);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(hash(cleanBundle), "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4");
const expectedPatchHash = "6bcc1b1de30441efbc1e08b9caccb692c6a4fd1aad998c2affbb9b35e94f17d0";
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "rk-v11-release-check-"));
const appRoot = path.join(temporaryRoot, "resources", "app");
const bundlePath = path.join(appRoot, "out", "main.js");
const indexPath = path.join(appRoot, "index.html");
const savePath = path.join(temporaryRoot, "save-sentinel.txt");
const kitRoot = path.resolve(kitPath);
const tool = path.join(kitRoot, "tools", "kd-hybrid-tool.mjs");
const payload = path.join(kitRoot, "bootstrap");
const run = (command, extra = []) => {
  const result = spawnSync(process.execPath, [tool, command, "--app-root", appRoot, ...extra], {
    encoding: "utf8", windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
  return JSON.parse(result.stdout);
};
try {
  await mkdir(path.dirname(bundlePath), { recursive: true });
  await writeFile(bundlePath, cleanBundle);
  await writeFile(indexPath, cleanIndex);
  await writeFile(savePath, "unchanged\n");
  const installed = run("install", ["--payload", payload]);
  assert.equal(installed.state, "installed");
  assert.equal(installed.manifest?.sourcePatch?.id, "kd-5.4.92-source-optimizations-v11");
  assert.equal(hash(await readFile(bundlePath)), expectedPatchHash);
  assert.equal(installed.manifest?.settings?.sourceOptimizations, true);
  assert.equal(hash(await readFile(path.join(temporaryRoot, "Mods", "KDHybridBridge.zip"))), installed.manifest.modBridge.sha256);
  assert.equal(run("status").state, "installed");
  run("configure", ["--source-optimizations", "false"]);
  assert.deepEqual(await readFile(bundlePath), cleanBundle);
  run("configure", ["--source-optimizations", "true"]);
  assert.equal(hash(await readFile(bundlePath)), expectedPatchHash);
  assert.equal(run("uninstall").state, "not-installed");
  assert.deepEqual(await readFile(bundlePath), cleanBundle);
  assert.deepEqual(await readFile(indexPath), cleanIndex);
  assert.equal(await readFile(savePath, "utf8"), "unchanged\n");
  process.stdout.write("v11 packaged install, bridge, configure, and byte-exact uninstall passed\n");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
