// SPDX-License-Identifier: MPL-2.0
//
// Generates the exact release patch and its TypeScript-embedded copy from two
// human-readable KD bundles. It never modifies either input.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import {
  applyUnifiedPatch,
  generateCanonicalUnifiedPatch,
  rebaseUnifiedPatchByUniqueContext,
} from "./lib/unified-patch.mjs";

const { values } = parseArgs({
  options: {
    clean: { type: "string" },
    accepted: { type: "string" },
    "base-patch": { type: "string" },
    "overlay-clean": { type: "string" },
    combined: { type: "string" },
    "rebased-overlay-patch": { type: "string" },
    "patch-target": {
      type: "string",
      default: "out/main.js",
    },
    patch: {
      type: "string",
      default: "upstream-patches/kd-5.4.92/bundle-optimizations-v6.patch",
    },
    module: {
      type: "string",
      default: "packages/tools/src/kd-source-patch-v6.ts",
    },
    "module-export": {
      type: "string",
      default: "KD_5_4_92_SOURCE_OPTIMIZATIONS_V6_BASE64",
    },
    "module-license": {
      type: "string",
      default: "MPL-2.0",
    },
    "source-repository": { type: "string" },
    "source-patch": {
      type: "string",
      default: "upstream-patches/kd-5.4.92/source-optimizations-v6.patch",
    },
    "source-path": {
      type: "string",
      multiple: true,
    },
  },
});

if (!values.clean || !values.accepted) {
  throw new RangeError("--clean and --accepted are required");
}
const compositionRequested =
  values["base-patch"] !== undefined ||
  values["overlay-clean"] !== undefined ||
  values.combined !== undefined ||
  values["rebased-overlay-patch"] !== undefined;
if (
  compositionRequested &&
  (values["base-patch"] === undefined || values["overlay-clean"] === undefined)
) {
  throw new RangeError("Composition requires --base-patch and --overlay-clean");
}

const sourcePaths = normalizeSourcePaths(values["source-path"]);
const patchTarget = normalizeRepositoryRelativePath(
  values["patch-target"],
  "patch target",
);
const moduleExport = validateModuleExport(values["module-export"]);
const moduleLicense = validateModuleLicense(values["module-license"]);
const cleanPath = path.resolve(values.clean);
const acceptedPath = path.resolve(values.accepted);
const basePatchPath =
  values["base-patch"] === undefined
    ? null
    : path.resolve(values["base-patch"]);
const overlayCleanPath =
  values["overlay-clean"] === undefined
    ? null
    : path.resolve(values["overlay-clean"]);
const combinedPath =
  values.combined === undefined ? null : path.resolve(values.combined);
const rebasedOverlayPatchPath =
  values["rebased-overlay-patch"] === undefined
    ? null
    : path.resolve(values["rebased-overlay-patch"]);
const patchPath = path.resolve(values.patch);
const modulePath = path.resolve(values.module);
const sourcePatchPath = path.resolve(values["source-patch"]);
const [clean, accepted] = await Promise.all([
  readFile(cleanPath),
  readFile(acceptedPath),
]);
let finalAccepted = accepted;
let composition = null;
let rebasedOverlayPatchText = null;
if (compositionRequested) {
  const [basePatch, overlayClean] = await Promise.all([
    readFile(basePatchPath, "utf8"),
    readFile(overlayCleanPath),
  ]);
  const cleanText = decodeUtf8Exact(clean, "clean bundle");
  const baseOutputText = applyUnifiedPatch(cleanText, basePatch, "base-patch");
  const overlayPatch = await generateCanonicalUnifiedPatch(
    overlayClean,
    accepted,
    { patchPath: patchTarget },
  );
  const rebased = rebaseUnifiedPatchByUniqueContext(
    baseOutputText,
    overlayPatch,
    "overlay-patch",
  );
  rebasedOverlayPatchText = rebased.patchText;
  const combinedText = applyUnifiedPatch(
    baseOutputText,
    rebased.patchText,
    "rebased-overlay-patch",
  );
  finalAccepted = Buffer.from(combinedText, "utf8");
  composition = {
    basePatch: basePatchPath,
    basePatchBytes: Buffer.byteLength(basePatch),
    basePatchSha256: sha256(Buffer.from(basePatch, "utf8")),
    baseOutputSha256: sha256(Buffer.from(baseOutputText, "utf8")),
    overlayClean: overlayCleanPath,
    overlayCleanSha256: sha256(overlayClean),
    overlayAcceptedSha256: sha256(accepted),
    overlayPatchBytes: Buffer.byteLength(overlayPatch),
    overlayPatchSha256: sha256(Buffer.from(overlayPatch, "utf8")),
    rebasedOverlayPatch: rebasedOverlayPatchPath,
    rebasedOverlayPatchBytes: Buffer.byteLength(rebased.patchText),
    rebasedOverlayPatchSha256: sha256(
      Buffer.from(rebased.patchText, "utf8"),
    ),
    rebasedHunks: rebased.matches,
    combined: combinedPath,
    combinedSha256: sha256(finalAccepted),
    combinedBytes: finalAccepted.length,
  };
}

const patchText = await generateCanonicalUnifiedPatch(clean, finalAccepted, {
  patchPath: patchTarget,
});
const reproducedAccepted = Buffer.from(
  applyUnifiedPatch(
    decodeUtf8Exact(clean, "clean bundle"),
    patchText,
    "generated-patch",
  ),
  "utf8",
);
if (!reproducedAccepted.equals(finalAccepted)) {
  throw new Error(
    `Generated patch does not reproduce accepted bytes: expected ${sha256(
      finalAccepted,
    )}, got ${sha256(reproducedAccepted)}`,
  );
}
const lines = patchText.split("\n");

const base64 = Buffer.from(patchText, "utf8").toString("base64");
const chunks = base64.match(/.{1,100}/gu) ?? [];
const moduleText = `// SPDX-License-Identifier: ${moduleLicense}
//
// Generated by scripts/generate-kd-source-patch.mjs. Do not edit by hand.

export const ${moduleExport} = [
${chunks.map((chunk) => `  "${chunk}"`).join(",\n")}
].join("");
`;

const outputDirectories = [
  mkdir(path.dirname(patchPath), { recursive: true }),
  mkdir(path.dirname(modulePath), { recursive: true }),
];
if (combinedPath !== null) {
  outputDirectories.push(
    mkdir(path.dirname(combinedPath), { recursive: true }),
  );
}
if (rebasedOverlayPatchPath !== null) {
  outputDirectories.push(
    mkdir(path.dirname(rebasedOverlayPatchPath), { recursive: true }),
  );
}
await Promise.all(outputDirectories);
const outputWrites = [
  writeFile(patchPath, patchText, "utf8"),
  writeFile(modulePath, moduleText, "utf8"),
];
if (combinedPath !== null) {
  outputWrites.push(writeFile(combinedPath, finalAccepted));
}
if (rebasedOverlayPatchPath !== null) {
  outputWrites.push(
    writeFile(rebasedOverlayPatchPath, rebasedOverlayPatchText, "utf8"),
  );
}
await Promise.all(outputWrites);

let sourcePatch = null;
if (values["source-repository"]) {
  const sourceRepository = path.resolve(values["source-repository"]);
  const sourceDiff = spawnSync(
    "git",
    [
      "-C",
      sourceRepository,
      "diff",
      "--no-ext-diff",
      "--binary",
      "HEAD",
      "--",
      ...sourcePaths.map((sourcePath) => `:(literal)${sourcePath}`),
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (sourceDiff.status !== 0 || !sourceDiff.stdout.startsWith("diff --git ")) {
    throw new Error(
      `upstream source diff failed with status ${sourceDiff.status}: ${sourceDiff.stderr}`,
    );
  }
  const sourcePatchText = `${sourceDiff.stdout
    .replaceAll("\r\n", "\n")
    .replace(/\n+$/u, "")}\n`;
  await mkdir(path.dirname(sourcePatchPath), { recursive: true });
  await writeFile(sourcePatchPath, sourcePatchText, "utf8");
  sourcePatch = {
    repository: sourceRepository,
    patch: sourcePatchPath,
    patchBytes: Buffer.byteLength(sourcePatchText),
    paths: sourcePaths,
  };
}

process.stdout.write(
  `${JSON.stringify(
    {
      clean: cleanPath,
      accepted: acceptedPath,
      patchTarget,
      cleanSha256: sha256(clean),
      acceptedSha256: sha256(accepted),
      finalAcceptedSha256: sha256(finalAccepted),
      patch: patchPath,
      module: modulePath,
      moduleExport,
      moduleLicense,
      patchBytes: Buffer.byteLength(patchText),
      patchSha256: sha256(Buffer.from(patchText, "utf8")),
      changedLines: lines.filter((line) => /^[+-][^+-]/u.test(line)).length,
      composition,
      sourcePatch,
    },
    null,
    2,
  )}\n`,
);

function normalizeSourcePaths(requestedPaths) {
  const paths = requestedPaths === undefined ? ["Game/src"] : requestedPaths;
  if (paths.length === 0) {
    throw new RangeError("At least one --source-path is required");
  }

  const normalized = [];
  const seen = new Set();
  for (const requestedPath of paths) {
    const canonical = normalizeRepositoryRelativePath(
      requestedPath,
      "source path",
    );
    if (!seen.has(canonical)) {
      seen.add(canonical);
      normalized.push(canonical);
    }
  }
  return normalized;
}

function normalizeRepositoryRelativePath(requestedPath, label) {
  if (
    requestedPath.length === 0 ||
    requestedPath.includes("\0") ||
    requestedPath.startsWith(":")
  ) {
    throw new TypeError(`Unsafe ${label}: ${JSON.stringify(requestedPath)}`);
  }
  const portable = requestedPath.replaceAll("\\", "/");
  if (path.posix.isAbsolute(portable) || /^[A-Za-z]:\//u.test(portable)) {
    throw new TypeError(`Unsafe ${label}: ${JSON.stringify(requestedPath)}`);
  }
  const canonical = path.posix.normalize(portable);
  if (canonical === "." || canonical === ".." || canonical.startsWith("../")) {
    throw new TypeError(
      `${capitalize(label)} escapes the repository: ${JSON.stringify(requestedPath)}`,
    );
  }
  return canonical;
}

function capitalize(value) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function validateModuleExport(requestedExport) {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(requestedExport)) {
    throw new TypeError(
      `Invalid TypeScript module export: ${JSON.stringify(requestedExport)}`,
    );
  }
  return requestedExport;
}

function validateModuleLicense(requestedLicense) {
  if (requestedLicense !== "MPL-2.0" && requestedLicense !== "MIT") {
    throw new RangeError("--module-license must be either MPL-2.0 or MIT");
  }
  return requestedLicense;
}

function decodeUtf8Exact(bytes, label) {
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new TypeError(`${label} is not exact UTF-8 text`);
  }
  return text;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
