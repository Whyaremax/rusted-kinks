// SPDX-License-Identifier: MPL-2.0

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyUnifiedPatch,
  generateCanonicalUnifiedPatch,
  rebaseUnifiedPatchByUniqueContext,
} from "./lib/unified-patch.mjs";

const scriptPath = fileURLToPath(
  new URL("./generate-kd-source-patch.mjs", import.meta.url),
);
const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("KD source patch generator", () => {
  it("includes requested repository-relative paths and applies both ways exactly", async () => {
    const root = await temporaryRoot();
    const sourceRepository = path.join(root, "upstream");
    const cleanBundle = path.join(root, "clean.js");
    const acceptedBundle = path.join(root, "accepted.js");
    const bundlePatch = path.join(root, "bundle.patch");
    const sourcePatch = path.join(root, "source.patch");
    const modulePath = path.join(root, "source-patch.ts");
    await mkdir(path.join(sourceRepository, "Game", "src"), {
      recursive: true,
    });
    await mkdir(path.join(sourceRepository, "Data"), { recursive: true });

    const base = {
      game: "export const game = 1;\n",
      preload: "export const preload = 1;\n",
      outside: "export const outside = 1;\n",
      bundle: "const build = 'clean';\n",
    };
    const candidate = {
      game: "export const game = 2;\n",
      preload: "export const preload = 2;\n",
      outside: "export const outside = 2;\n",
      bundle: "const build = 'accepted';\n",
    };
    const gamePath = path.join(sourceRepository, "Game", "src", "Game.ts");
    const preloadPath = path.join(sourceRepository, "Data", "Preload.ts");
    const outsidePath = path.join(sourceRepository, "Outside.ts");
    await Promise.all([
      writeFile(gamePath, base.game),
      writeFile(preloadPath, base.preload),
      writeFile(outsidePath, base.outside),
      writeFile(cleanBundle, base.bundle),
      writeFile(acceptedBundle, candidate.bundle),
    ]);
    git(sourceRepository, "init");
    git(sourceRepository, "config", "core.autocrlf", "false");
    git(sourceRepository, "config", "user.email", "patch-test@example.invalid");
    git(sourceRepository, "config", "user.name", "Patch Test");
    git(sourceRepository, "add", ".");
    git(sourceRepository, "commit", "-m", "base");
    await Promise.all([
      writeFile(gamePath, candidate.game),
      writeFile(preloadPath, candidate.preload),
      writeFile(outsidePath, candidate.outside),
    ]);

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--clean",
        cleanBundle,
        "--accepted",
        acceptedBundle,
        "--patch",
        bundlePatch,
        "--module",
        modulePath,
        "--module-export",
        "KD_5_5_ATLAS_CANDIDATE_BASE64",
        "--source-repository",
        sourceRepository,
        "--source-patch",
        sourcePatch,
        "--source-path",
        "Game/src",
        "--source-path",
        "Data/Preload.ts",
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.sourcePatch.paths, ["Game/src", "Data/Preload.ts"]);
    assert.equal(report.moduleExport, "KD_5_5_ATLAS_CANDIDATE_BASE64");
    assert.match(
      await readFile(modulePath, "utf8"),
      /export const KD_5_5_ATLAS_CANDIDATE_BASE64 = \[/u,
    );

    const sourcePatchText = await readFile(sourcePatch, "utf8");
    assert.match(sourcePatchText, /a\/Game\/src\/Game\.ts/u);
    assert.match(sourcePatchText, /a\/Data\/Preload\.ts/u);
    assert.doesNotMatch(sourcePatchText, /Outside\.ts/u);

    git(sourceRepository, "apply", "--check", "--reverse", sourcePatch);
    git(sourceRepository, "apply", "--reverse", sourcePatch);
    assert.equal(await readFile(gamePath, "utf8"), base.game);
    assert.equal(await readFile(preloadPath, "utf8"), base.preload);
    assert.equal(await readFile(outsidePath, "utf8"), candidate.outside);
    git(sourceRepository, "apply", "--check", sourcePatch);
    git(sourceRepository, "apply", sourcePatch);
    assert.equal(await readFile(gamePath, "utf8"), candidate.game);
    assert.equal(await readFile(preloadPath, "utf8"), candidate.preload);

    const bundleRoot = path.join(root, "bundle-root");
    const installedBundle = path.join(bundleRoot, "out", "main.js");
    await mkdir(path.dirname(installedBundle), { recursive: true });
    git(bundleRoot, "init");
    git(bundleRoot, "config", "core.autocrlf", "false");
    await writeFile(installedBundle, base.bundle);
    git(bundleRoot, "apply", "--check", bundlePatch);
    git(bundleRoot, "apply", bundlePatch);
    assert.equal(await readFile(installedBundle, "utf8"), candidate.bundle);
    git(bundleRoot, "apply", "--check", "--reverse", bundlePatch);
    git(bundleRoot, "apply", "--reverse", bundlePatch);
    assert.equal(await readFile(installedBundle, "utf8"), base.bundle);
  });

  it("rejects a source path that escapes the repository", async () => {
    const root = await temporaryRoot();
    const cleanBundle = path.join(root, "clean.js");
    const acceptedBundle = path.join(root, "accepted.js");
    await Promise.all([
      writeFile(cleanBundle, "const build = 'clean';\n"),
      writeFile(acceptedBundle, "const build = 'accepted';\n"),
    ]);

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--clean",
        cleanBundle,
        "--accepted",
        acceptedBundle,
        "--source-path",
        "../Outside.ts",
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Source path escapes the repository/u);
  });

  it("rejects an invalid generated module export", async () => {
    const root = await temporaryRoot();
    const cleanBundle = path.join(root, "clean.js");
    const acceptedBundle = path.join(root, "accepted.js");
    await Promise.all([
      writeFile(cleanBundle, "const build = 'clean';\n"),
      writeFile(acceptedBundle, "const build = 'accepted';\n"),
    ]);

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--clean",
        cleanBundle,
        "--accepted",
        acceptedBundle,
        "--module-export",
        "bad-export;process.exit()",
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid TypeScript module export/u);
  });

  it("emits an exact patch for a safe repository-relative target", async () => {
    const root = await temporaryRoot();
    const cleanFile = path.join(root, "clean.js");
    const acceptedFile = path.join(root, "accepted.js");
    const patchFile = path.join(root, "vendor.patch");
    const moduleFile = path.join(root, "vendor-patch.ts");
    await Promise.all([
      writeFile(cleanFile, "const vendor = 1;\n"),
      writeFile(acceptedFile, "const vendor = 2;\n"),
    ]);

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--clean",
        cleanFile,
        "--accepted",
        acceptedFile,
        "--patch",
        patchFile,
        "--module",
        moduleFile,
        "--module-export",
        "KD_VENDOR_PATCH_BASE64",
        "--module-license",
        "MIT",
        "--patch-target",
        "Scripts/lib/pixi-filters.js",
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const patch = await readFile(patchFile, "utf8");
    const moduleText = await readFile(moduleFile, "utf8");
    assert.match(
      patch,
      /^diff --git a\/Scripts\/lib\/pixi-filters\.js b\/Scripts\/lib\/pixi-filters\.js/mu,
    );
    assert.match(patch, /^--- a\/Scripts\/lib\/pixi-filters\.js$/mu);
    assert.match(patch, /^\+\+\+ b\/Scripts\/lib\/pixi-filters\.js$/mu);
    assert.match(moduleText, /^\/\/ SPDX-License-Identifier: MIT$/mu);
    assert.equal(
      applyUnifiedPatch("const vendor = 1;\n", patch, "vendor"),
      "const vendor = 2;\n",
    );
    const report = JSON.parse(result.stdout);
    assert.equal(report.patchTarget, "Scripts/lib/pixi-filters.js");
    assert.equal(report.moduleLicense, "MIT");
  });

  it("rejects a patch whose line-ending policy cannot reproduce accepted bytes", async () => {
    const root = await temporaryRoot();
    const cleanFile = path.join(root, "clean.js");
    const acceptedFile = path.join(root, "accepted.js");
    const patchFile = path.join(root, "mixed.patch");
    const moduleFile = path.join(root, "mixed-patch.ts");
    await Promise.all([
      writeFile(cleanFile, "const first = 1;\r\nconst second = 1;\r\n"),
      writeFile(acceptedFile, "const first = 2;\nconst second = 1;\r\n"),
    ]);

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--clean",
        cleanFile,
        "--accepted",
        acceptedFile,
        "--patch",
        patchFile,
        "--module",
        moduleFile,
      ],
      { encoding: "utf8" },
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Generated patch does not reproduce accepted bytes/u,
    );
  });

  it("rejects an unsupported generated-module license", async () => {
    const root = await temporaryRoot();
    const cleanFile = path.join(root, "clean.js");
    const acceptedFile = path.join(root, "accepted.js");
    await Promise.all([
      writeFile(cleanFile, "clean\n"),
      writeFile(acceptedFile, "accepted\n"),
    ]);
    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--clean",
        cleanFile,
        "--accepted",
        acceptedFile,
        "--module-license",
        "GPL-3.0-only",
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /module-license/u);
  });

  it("rejects a patch target that escapes the repository", async () => {
    const root = await temporaryRoot();
    const cleanFile = path.join(root, "clean.js");
    const acceptedFile = path.join(root, "accepted.js");
    await Promise.all([
      writeFile(cleanFile, "clean\n"),
      writeFile(acceptedFile, "accepted\n"),
    ]);
    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--clean",
        cleanFile,
        "--accepted",
        acceptedFile,
        "--patch-target",
        "../outside.js",
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Patch target escapes the repository/u);
  });

  it("composes a shifted overlay onto an authoritative base patch", async () => {
    const root = await temporaryRoot();
    const cleanBundle = path.join(root, "clean.js");
    const overlayAccepted = path.join(root, "overlay-accepted.js");
    const basePatch = path.join(root, "base.patch");
    const bundlePatch = path.join(root, "bundle.patch");
    const rebasedOverlay = path.join(root, "rebased-overlay.patch");
    const combinedBundle = path.join(root, "combined.js");
    const modulePath = path.join(root, "source-patch.ts");
    const clean = "alpha\nbeta\ntarget\nomega\n";
    const baseOutput = "base-one\nbase-two\nalpha\nbeta\ntarget\nomega\n";
    const overlay = "alpha\nbeta\naccepted\nomega\n";
    await Promise.all([
      writeFile(cleanBundle, clean),
      writeFile(overlayAccepted, overlay),
      writeFile(
        basePatch,
        await generateCanonicalUnifiedPatch(clean, baseOutput),
      ),
    ]);

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--clean",
        cleanBundle,
        "--accepted",
        overlayAccepted,
        "--base-patch",
        basePatch,
        "--overlay-clean",
        cleanBundle,
        "--combined",
        combinedBundle,
        "--rebased-overlay-patch",
        rebasedOverlay,
        "--patch",
        bundlePatch,
        "--module",
        modulePath,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const expected = "base-one\nbase-two\nalpha\nbeta\naccepted\nomega\n";
    assert.equal(await readFile(combinedBundle, "utf8"), expected);
    const generatedPatch = await readFile(bundlePatch, "utf8");
    assert.equal(
      applyUnifiedPatch(clean, generatedPatch, "generated"),
      expected,
    );
    const reverse = await generateCanonicalUnifiedPatch(expected, clean);
    assert.equal(applyUnifiedPatch(expected, reverse, "reverse"), clean);
    const rebased = await readFile(rebasedOverlay, "utf8");
    assert.match(rebased, /@@ -3,4 \+3,4 @@/u);
    const report = JSON.parse(result.stdout);
    assert.equal(report.composition.rebasedHunks.length, 1);
    assert.equal(report.composition.rebasedHunks[0].shift, 2);
    assert.equal(report.composition.combinedSha256, report.finalAcceptedSha256);
  });

  it("requires both composition inputs", async () => {
    const root = await temporaryRoot();
    const cleanBundle = path.join(root, "clean.js");
    const acceptedBundle = path.join(root, "accepted.js");
    await Promise.all([
      writeFile(cleanBundle, "clean\n"),
      writeFile(acceptedBundle, "accepted\n"),
    ]);

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--clean",
        cleanBundle,
        "--accepted",
        acceptedBundle,
        "--base-patch",
        path.join(root, "base.patch"),
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Composition requires --base-patch and --overlay-clean/u,
    );
  });
});

describe("exact unified-patch composition", () => {
  it("relocates shifted hunks only when old-side context is unique", async () => {
    const baseline = "alpha\nbeta\ntarget\nomega\n";
    const accepted = "alpha\nbeta\naccepted\nomega\n";
    const shifted = "prefix-one\nprefix-two\nalpha\nbeta\ntarget\nomega\n";
    const overlay = await generateCanonicalUnifiedPatch(baseline, accepted);
    const rebased = rebaseUnifiedPatchByUniqueContext(
      shifted,
      overlay,
      "shifted",
    );

    assert.equal(rebased.matches.length, 1);
    assert.equal(rebased.matches[0].shift, 2);
    assert.equal(
      applyUnifiedPatch(shifted, rebased.patchText, "shifted"),
      "prefix-one\nprefix-two\nalpha\nbeta\naccepted\nomega\n",
    );
    assert.throws(
      () =>
        rebaseUnifiedPatchByUniqueContext(
          `${baseline}${baseline}`,
          overlay,
          "duplicate",
        ),
      /had 2 exact old-side context matches/u,
    );
    assert.throws(
      () =>
        rebaseUnifiedPatchByUniqueContext("unrelated\n", overlay, "missing"),
      /had 0 exact old-side context matches/u,
    );
  });

  it("rejects overlapping or non-monotonic relocated hunks", () => {
    const target = "one\ntwo\nthree\nfour\nfive\nsix\n";
    const nonMonotonic = `diff --git a/out/main.js b/out/main.js
--- a/out/main.js
+++ b/out/main.js
@@ -5,1 +5,1 @@
-five
+FIVE
@@ -2,1 +2,1 @@
-two
+TWO
`;
    assert.throws(
      () =>
        rebaseUnifiedPatchByUniqueContext(
          target,
          nonMonotonic,
          "non-monotonic",
        ),
      /overlap or are non-monotonic/u,
    );

    const overlapping = `diff --git a/out/main.js b/out/main.js
--- a/out/main.js
+++ b/out/main.js
@@ -2,3 +2,3 @@
 two
-three
+THREE
 four
@@ -4,3 +4,3 @@
 four
-five
+FIVE
 six
`;
    assert.throws(
      () =>
        rebaseUnifiedPatchByUniqueContext(target, overlapping, "overlapping"),
      /overlap or are non-monotonic/u,
    );
  });

  it("preserves CRLF context and a missing final newline", () => {
    const source = "alpha\r\nbeta";
    const patch = `diff --git a/out/main.js b/out/main.js
--- a/out/main.js
+++ b/out/main.js
@@ -1,2 +1,2 @@
-alpha
+bravo
 beta
\\ No newline at end of file
`;
    assert.equal(
      applyUnifiedPatch(source, patch, "mixed-endings"),
      "bravo\r\nbeta",
    );
  });
});

async function temporaryRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "kd-source-patch-"));
  temporaryRoots.push(root);
  return root;
}

function git(directory, ...arguments_) {
  return execFileSync("git", ["-C", directory, ...arguments_], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
