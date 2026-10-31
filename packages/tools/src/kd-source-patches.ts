// SPDX-License-Identifier: MPL-2.0
//
// Exact, version-gated transformations adapted from supported Kinky Dungeon releases.
// Kinky Dungeon is Copyright Strait Laced Games LLC.

import { KD_5_5_6_SOURCE_OPTIMIZATIONS_V2_BASE64 } from "./kd-source-patch-5-5-6-v2.js";
import { KD_5_5_6_SOURCE_OPTIMIZATIONS_V1_BASE64 } from "./kd-source-patch-5-5-6-v1.js";
import { KD_5_5_1_SOURCE_OPTIMIZATIONS_V1_BASE64 } from "./kd-source-patch-5-5-v1.js";
import { KD_5_4_92_SOURCE_OPTIMIZATIONS_V6_BASE64 } from "./kd-source-patch-v6.js";
import { KD_5_4_92_SOURCE_OPTIMIZATIONS_V7_BASE64 } from "./kd-source-patch-v7.js";
import { PIXI_FILTERS_5_2_0_COMPATIBILITY_V1_BASE64 } from "./pixi-filters-patch-v1.js";

export interface KDSourcePatch {
  readonly id: string;
  readonly upstreamVersion: string;
  readonly inputSha256: string;
  readonly outputSha256: string;
  readonly sourceUrl: string;
  /** Present only when a transformation owns more than out/main.js. */
  readonly files?: readonly KDSourcePatchFile[];
}

export interface KDSourcePatchFile {
  readonly path: string;
  readonly inputSha256: string;
  readonly outputSha256: string;
}

export interface KDSourcePatchFileDefinition extends KDSourcePatchFile {
  readonly unifiedPatch: string;
}

export interface KDSourcePatchDefinition extends KDSourcePatch {
  readonly unifiedPatch: string;
  /** Legacy entries are recognized for migration but are never selected. */
  readonly legacy?: boolean;
  readonly additionalFiles?: readonly KDSourcePatchFileDefinition[];
}

export interface KDSourcePatchCatalog {
  find(inputSha256: string): KDSourcePatch | undefined;
  findById(id: string): KDSourcePatch | undefined;
  findByOutput(path: string, outputSha256: string): KDSourcePatch | undefined;
  apply(
    bundleText: string,
    inputSha256: string,
  ): { readonly text: string; readonly patch: KDSourcePatch } | null;
  applyFiles(inputs: readonly KDSourcePatchInput[]): {
    readonly files: readonly KDSourcePatchOutput[];
    readonly patch: KDSourcePatch;
  } | null;
}

export interface KDSourcePatchInput {
  readonly path: string;
  readonly text: string;
  readonly sha256: string;
}

export interface KDSourcePatchOutput extends KDSourcePatchFile {
  readonly text: string;
}

interface TextLine {
  readonly content: string;
  readonly ending: "" | "\n" | "\r\n";
}

const PIXI_FILTERS_5_2_0_COMPATIBILITY = Object.freeze({
  path: "Scripts/lib/pixi-filters.js",
  inputSha256:
    "23aa3d8d53e0755bf39bf6d7d2b409788b502a46f35cde53564ed7230af7a507",
  outputSha256:
    "4cfc4145e5950a17df19642fcc6cc378b2b3abef4276e7f56e39628739ae6b95",
  unifiedPatch: Buffer.from(
    PIXI_FILTERS_5_2_0_COMPATIBILITY_V1_BASE64,
    "base64",
  ).toString("utf8"),
}) satisfies KDSourcePatchFileDefinition;

const KD_5_4_92_SOURCE_OPTIMIZATIONS_V6 = Object.freeze({
  id: "kd-5.4.92-source-optimizations-v6",
  upstreamVersion: "5.4.92",
  inputSha256:
    "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4",
  outputSha256:
    "aa4c09e73de34b1ab6eea5328880049578963c7c3dcbaae07728ca408da59f92",
  sourceUrl:
    "https://github.com/Ada18980/KinkiestDungeon/tree/5c96c4c1e67faf136ba2c167ed889a9e29005a18",
  unifiedPatch: Buffer.from(
    KD_5_4_92_SOURCE_OPTIMIZATIONS_V6_BASE64,
    "base64",
  ).toString("utf8"),
  legacy: true,
}) satisfies KDSourcePatchDefinition;

const KD_5_4_92_SOURCE_OPTIMIZATIONS_V7 = Object.freeze({
  id: "kd-5.4.92-source-optimizations-v7",
  upstreamVersion: "5.4.92",
  inputSha256:
    "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4",
  outputSha256:
    "aa92bb52a07a553086525704f3b1ee8f3a7f2fe6e008cd507f74c9cde9c57b3d",
  sourceUrl:
    "https://github.com/Ada18980/KinkiestDungeon/tree/5c96c4c1e67faf136ba2c167ed889a9e29005a18",
  unifiedPatch: Buffer.from(
    KD_5_4_92_SOURCE_OPTIMIZATIONS_V7_BASE64,
    "base64",
  ).toString("utf8"),
  additionalFiles: Object.freeze([PIXI_FILTERS_5_2_0_COMPATIBILITY]),
}) satisfies KDSourcePatchDefinition;

const KD_5_5_1_SOURCE_OPTIMIZATIONS_V1 = Object.freeze({
  id: "kd-5.5.1-source-optimizations-v1",
  upstreamVersion: "5.5.1",
  inputSha256:
    "60a85515783853653fd051936429494b8ef85024ff66b08134e68f9fe89248e0",
  outputSha256:
    "2a42cf93ea4d084988afdd37d5bd96c0f9fe4f7ef6b662b2ed1f8776a7443234",
  sourceUrl:
    "https://github.com/Ada18980/KinkiestDungeon/tree/b37a3e91c5481310537dbfe6baa0302a2dcebbc6",
  unifiedPatch: Buffer.from(
    KD_5_5_1_SOURCE_OPTIMIZATIONS_V1_BASE64,
    "base64",
  ).toString("utf8"),
  additionalFiles: Object.freeze([PIXI_FILTERS_5_2_0_COMPATIBILITY]),
}) satisfies KDSourcePatchDefinition;

const KD_5_5_6_SOURCE_OPTIMIZATIONS_V1 = Object.freeze({
  id: "kd-5.5.6-source-optimizations-v1", upstreamVersion: "5.5.6", inputSha256: "e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25", outputSha256: "8751afa2b64d82a446d279d512d30eb0b8d7a0cb642c7dfc779f6bf4edaa779c", sourceUrl: "https://ada18980.itch.io/kinky-dungeon/devlog/1740880/556-official", unifiedPatch: Buffer.from(KD_5_5_6_SOURCE_OPTIMIZATIONS_V1_BASE64, "base64").toString("utf8"), additionalFiles: Object.freeze([PIXI_FILTERS_5_2_0_COMPATIBILITY]),
}) satisfies KDSourcePatchDefinition;

const KD_5_5_6_SOURCE_OPTIMIZATIONS_V2 = Object.freeze({
  id: "kd-5.5.6-source-optimizations-v2", upstreamVersion: "5.5.6",
  inputSha256: "e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25", outputSha256: "4303a9a102d7596e8c4a62793d6e76c3003c8e2abbea185c642c260a0e07c00b",
  sourceUrl: "https://ada18980.itch.io/kinky-dungeon/devlog/1740880/556-official",
  unifiedPatch: Buffer.from(KD_5_5_6_SOURCE_OPTIMIZATIONS_V2_BASE64, "base64").toString("utf8"),
  additionalFiles: Object.freeze([PIXI_FILTERS_5_2_0_COMPATIBILITY]),
}) satisfies KDSourcePatchDefinition;

const KD_SOURCE_PATCH_CATALOG = createKDSourcePatchCatalog(
  Object.freeze([
    KD_5_4_92_SOURCE_OPTIMIZATIONS_V6,
    KD_5_4_92_SOURCE_OPTIMIZATIONS_V7,
    KD_5_5_1_SOURCE_OPTIMIZATIONS_V1,
    {...KD_5_5_6_SOURCE_OPTIMIZATIONS_V1, legacy: true},
    KD_5_5_6_SOURCE_OPTIMIZATIONS_V2,
  ]),
);

export function createKDSourcePatchCatalog(
  definitions: readonly KDSourcePatchDefinition[],
): KDSourcePatchCatalog {
  const patchesByInput = new Map<string, NormalizedSourcePatchDefinition>();
  const patchesById = new Map<string, NormalizedSourcePatchDefinition>();
  const patchesByOutput = new Map<string, NormalizedSourcePatchDefinition>();
  const patchInfoByInput = new Map<string, KDSourcePatch>();
  const claimedIds = new Set<string>();
  const activePrimaryInputs = new Set<string>();
  const allPrimaryInputs = new Set<string>();
  const allPrimaryOutputs = new Set<string>();
  const auxiliaryTransforms = new Map<string, string>();

  for (const definition of definitions) {
    if (
      definition.id.length === 0 ||
      definition.id.trim() !== definition.id ||
      definition.upstreamVersion.trim().length === 0 ||
      definition.sourceUrl.trim().length === 0 ||
      !definition.unifiedPatch.startsWith("diff --git ")
    ) {
      throw new Error(
        `Source patch catalog contains invalid metadata for id: ${definition.id}`,
      );
    }
    if (claimedIds.has(definition.id)) {
      throw new Error(
        `Source patch catalog contains a duplicate id: ${definition.id}`,
      );
    }
    claimedIds.add(definition.id);
    const files = [
      normalizeFileDefinition(
        {
          path: "out/main.js",
          inputSha256: definition.inputSha256,
          outputSha256: definition.outputSha256,
          unifiedPatch: definition.unifiedPatch,
        },
        definition.id,
      ),
      ...(definition.additionalFiles ?? []).map((file) =>
        normalizeFileDefinition(file, definition.id),
      ),
    ];
    const paths = new Set<string>();
    for (const [fileIndex, file] of files.entries()) {
      if (paths.has(file.path)) {
        throw new Error(
          `Source patch ${definition.id} contains a duplicate path: ${file.path}`,
        );
      }
      paths.add(file.path);
      if (file.inputSha256 === file.outputSha256) {
        throw new Error(
          `Source patch ${definition.id} reuses a catalog file hash`,
        );
      }
      if (fileIndex === 0) {
        if (!definition.legacy && activePrimaryInputs.has(file.inputSha256)) {
          throw new Error(
            `Source patch ${definition.id} collides with an active input`,
          );
        }
        if (allPrimaryOutputs.has(file.outputSha256)) {
          throw new Error(
            `Source patch ${definition.id} reuses a catalog output hash`,
          );
        }
        if (
          allPrimaryInputs.has(file.outputSha256) ||
          allPrimaryOutputs.has(file.inputSha256)
        ) {
          throw new Error(
            `Source patch ${definition.id} reuses a catalog bundle hash (output/input ambiguity)`,
          );
        }
        allPrimaryInputs.add(file.inputSha256);
        allPrimaryOutputs.add(file.outputSha256);
        if (!definition.legacy) activePrimaryInputs.add(file.inputSha256);
      } else {
        const inputKey = hashKey(file.path, file.inputSha256);
        const signature = `${file.outputSha256}\u0000${file.unifiedPatch}`;
        const claimed = auxiliaryTransforms.get(inputKey);
        if (claimed !== undefined && claimed !== signature) {
          throw new Error(
            `Source patch ${definition.id} conflicts with an auxiliary transform for ${file.path}`,
          );
        }
        auxiliaryTransforms.set(inputKey, signature);
      }
    }

    const primary = files[0]!;
    const patch: NormalizedSourcePatchDefinition = Object.freeze({
      id: definition.id,
      upstreamVersion: definition.upstreamVersion,
      inputSha256: primary.inputSha256,
      outputSha256: primary.outputSha256,
      sourceUrl: definition.sourceUrl,
      legacy: definition.legacy === true,
      files: Object.freeze(files),
    });
    const patchInfo = Object.freeze({
      id: patch.id,
      upstreamVersion: patch.upstreamVersion,
      inputSha256: patch.inputSha256,
      outputSha256: patch.outputSha256,
      sourceUrl: patch.sourceUrl,
      ...(patch.files.length === 1
        ? {}
        : {
            files: Object.freeze(
              patch.files.map(({ path, inputSha256, outputSha256 }) =>
                Object.freeze({ path, inputSha256, outputSha256 }),
              ),
            ),
          }),
    });
    patchesById.set(patch.id, patch);
    patchesByOutput.set(hashKey(primary.path, primary.outputSha256), patch);
    if (!patch.legacy) {
      patchesByInput.set(primary.inputSha256, patch);
      patchInfoByInput.set(primary.inputSha256, patchInfo);
    }
  }

  return Object.freeze({
    find(inputSha256: string): KDSourcePatch | undefined {
      return patchInfoByInput.get(inputSha256.toLowerCase());
    },
    findById(id: string): KDSourcePatch | undefined {
      const patch = patchesById.get(id);
      return patch === undefined ? undefined : publicPatchInfo(patch);
    },
    findByOutput(
      path: string,
      outputSha256: string,
    ): KDSourcePatch | undefined {
      const normalizedPath = normalizePatchPath(path, "catalog lookup");
      const normalizedHash = normalizedDefinitionHash(
        outputSha256,
        "catalog lookup",
        "output",
      );
      const patch = patchesByOutput.get(
        hashKey(normalizedPath, normalizedHash),
      );
      return patch === undefined ? undefined : publicPatchInfo(patch);
    },
    apply(
      bundleText: string,
      inputSha256: string,
    ): { readonly text: string; readonly patch: KDSourcePatch } | null {
      const patch = patchesByInput.get(inputSha256.toLowerCase());
      if (patch === undefined) return null;
      return Object.freeze({
        text: applyUnifiedPatch(
          bundleText,
          patch.files[0]!.unifiedPatch,
          `${patch.id}:out/main.js`,
        ),
        patch: patchInfoByInput.get(patch.inputSha256)!,
      });
    },
    applyFiles(inputs: readonly KDSourcePatchInput[]): {
      readonly files: readonly KDSourcePatchOutput[];
      readonly patch: KDSourcePatch;
    } | null {
      const byPath = new Map<string, KDSourcePatchInput>();
      for (const input of inputs) {
        const path = normalizePatchPath(input.path, "source patch input");
        if (byPath.has(path)) {
          throw new Error(
            `Source patch input contains a duplicate path: ${path}`,
          );
        }
        byPath.set(path, {
          path,
          text: input.text,
          sha256: normalizedDefinitionHash(input.sha256, path, "input"),
        });
      }
      const primary = byPath.get("out/main.js");
      if (primary === undefined) {
        throw new Error("Source patch input is missing out/main.js");
      }
      const patch = patchesByInput.get(primary.sha256);
      if (patch === undefined) return null;
      if (byPath.size !== patch.files.length) {
        throw new Error(
          `Source patch ${patch.id} input file set is incomplete`,
        );
      }
      const outputs = patch.files.map((file) => {
        const input = byPath.get(file.path);
        if (input === undefined || input.sha256 !== file.inputSha256) {
          throw new Error(
            `Source patch ${patch.id} input hash mismatch for ${file.path}`,
          );
        }
        return Object.freeze({
          path: file.path,
          inputSha256: file.inputSha256,
          outputSha256: file.outputSha256,
          text: applyUnifiedPatch(
            input.text,
            file.unifiedPatch,
            `${patch.id}:${file.path}`,
          ),
        });
      });
      return Object.freeze({
        files: Object.freeze(outputs),
        patch: publicPatchInfo(patch),
      });
    },
  });
}

interface NormalizedSourcePatchDefinition {
  readonly id: string;
  readonly upstreamVersion: string;
  readonly inputSha256: string;
  readonly outputSha256: string;
  readonly sourceUrl: string;
  readonly legacy: boolean;
  readonly files: readonly NormalizedSourcePatchFileDefinition[];
}

interface NormalizedSourcePatchFileDefinition extends KDSourcePatchFileDefinition {}

function publicPatchInfo(
  patch: NormalizedSourcePatchDefinition,
): KDSourcePatch {
  return Object.freeze({
    id: patch.id,
    upstreamVersion: patch.upstreamVersion,
    inputSha256: patch.inputSha256,
    outputSha256: patch.outputSha256,
    sourceUrl: patch.sourceUrl,
    ...(patch.files.length === 1
      ? {}
      : {
          files: Object.freeze(
            patch.files.map(({ path, inputSha256, outputSha256 }) =>
              Object.freeze({ path, inputSha256, outputSha256 }),
            ),
          ),
        }),
  });
}

function normalizeFileDefinition(
  file: KDSourcePatchFileDefinition,
  patchId: string,
): NormalizedSourcePatchFileDefinition {
  const path = normalizePatchPath(file.path, patchId);
  const unifiedPatch = file.unifiedPatch.replaceAll("\r\n", "\n");
  if (!unifiedPatch.startsWith(`diff --git a/${path} b/${path}\n`)) {
    throw new Error(
      `Source patch ${patchId} has invalid patch metadata for ${path}`,
    );
  }
  if ((unifiedPatch.match(/^diff --git /gmu)?.length ?? 0) !== 1) {
    throw new Error(
      `Source patch ${patchId} must contain one diff for ${path}`,
    );
  }
  return Object.freeze({
    path,
    inputSha256: normalizedDefinitionHash(file.inputSha256, patchId, "input"),
    outputSha256: normalizedDefinitionHash(
      file.outputSha256,
      patchId,
      "output",
    ),
    unifiedPatch,
  });
}

function normalizePatchPath(path: string, patchId: string): string {
  if (
    path.length === 0 ||
    path.includes("\\") ||
    path.includes(":") ||
    path.startsWith("/") ||
    path.endsWith("/") ||
    path
      .split("/")
      .some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    throw new Error(`Source patch ${patchId} contains an unsafe path: ${path}`);
  }
  return path;
}

function hashKey(path: string, hash: string): string {
  return `${path}\u0000${hash}`;
}

export function findKDSourcePatch(
  inputSha256: string,
): KDSourcePatch | undefined {
  return KD_SOURCE_PATCH_CATALOG.find(inputSha256);
}

export function findKDSourcePatchById(id: string): KDSourcePatch | undefined {
  return KD_SOURCE_PATCH_CATALOG.findById(id);
}

export function findKDSourcePatchByOutput(
  path: string,
  outputSha256: string,
): KDSourcePatch | undefined {
  return KD_SOURCE_PATCH_CATALOG.findByOutput(path, outputSha256);
}

export function applyKDSourcePatch(
  bundleText: string,
  inputSha256: string,
): { readonly text: string; readonly patch: KDSourcePatch } | null {
  return KD_SOURCE_PATCH_CATALOG.apply(bundleText, inputSha256);
}

export function applyKDSourcePatchFiles(
  inputs: readonly KDSourcePatchInput[],
): {
  readonly files: readonly KDSourcePatchOutput[];
  readonly patch: KDSourcePatch;
} | null {
  return KD_SOURCE_PATCH_CATALOG.applyFiles(inputs);
}

export function applyUnifiedPatch(
  sourceText: string,
  patchText: string,
  patchId = "unified-patch",
): string {
  const crlfCount = sourceText.match(/\r\n/gu)?.length ?? 0;
  const lfCount = sourceText.match(/\n/gu)?.length ?? 0;
  const addedLineEnding = crlfCount > lfCount - crlfCount ? "\r\n" : "\n";
  const sourceLines = splitTextLines(sourceText);
  const patchLines = patchText.replaceAll("\r\n", "\n").split("\n");
  const output: TextLine[] = [];
  let sourceIndex = 0;
  let patchIndex = patchLines.findIndex((line) => line.startsWith("@@ "));
  if (patchIndex < 0) {
    throw new Error(`Source patch ${patchId} contains no unified diff hunks`);
  }

  while (patchIndex < patchLines.length) {
    const header = patchLines[patchIndex]!;
    if (!header.startsWith("@@ ")) {
      patchIndex += 1;
      continue;
    }
    const match =
      /^@@ -(?<oldStart>\d+)(?:,(?<oldCount>\d+))? \+(?<newStart>\d+)(?:,(?<newCount>\d+))? @@/u.exec(
        header,
      );
    if (!match?.groups) {
      throw new Error(
        `Source patch ${patchId} has an invalid hunk header: ${header}`,
      );
    }
    const oldStart = Number(match.groups.oldStart);
    const oldCount = Number(match.groups.oldCount ?? "1");
    const newCount = Number(match.groups.newCount ?? "1");
    const targetIndex = Math.max(0, oldStart - 1);
    if (targetIndex < sourceIndex || targetIndex > sourceLines.length) {
      throw new Error(
        `Source patch ${patchId} hunk starts outside the source bundle`,
      );
    }
    appendTextLines(output, sourceLines, sourceIndex, targetIndex);
    sourceIndex = targetIndex;
    patchIndex += 1;
    let consumedOld = 0;
    let producedNew = 0;

    while (patchIndex < patchLines.length) {
      const line = patchLines[patchIndex]!;
      if (line.startsWith("@@ ") || line.startsWith("diff --git ")) break;
      if (line.startsWith("\\")) {
        patchIndex += 1;
        continue;
      }
      const operation = line[0];
      const content = line.slice(1);
      if (operation === " " || operation === "-") {
        const sourceLine = sourceLines[sourceIndex];
        if (sourceLine?.content !== content) {
          throw new Error(
            `Source patch ${patchId} hunk did not match source line ${sourceIndex + 1}`,
          );
        }
        sourceIndex += 1;
        consumedOld += 1;
        if (operation === " ") {
          output.push(sourceLine);
          producedNew += 1;
        }
      } else if (operation === "+") {
        output.push({ content, ending: addedLineEnding });
        producedNew += 1;
      } else if (line.length > 0) {
        throw new Error(
          `Source patch ${patchId} contains an invalid hunk line`,
        );
      }
      patchIndex += 1;
    }
    if (consumedOld !== oldCount || producedNew !== newCount) {
      throw new Error(
        `Source patch ${patchId} hunk line counts did not match its header`,
      );
    }
  }

  appendTextLines(output, sourceLines, sourceIndex, sourceLines.length);
  return output.map((line) => `${line.content}${line.ending}`).join("");
}

function normalizedDefinitionHash(
  value: string,
  patchId: string,
  kind: "input" | "output",
): string {
  const normalized = value.toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(normalized)) {
    throw new Error(`Source patch ${patchId} has an invalid ${kind} SHA-256`);
  }
  return normalized;
}

function appendTextLines(
  target: TextLine[],
  source: readonly TextLine[],
  start: number,
  end: number,
): void {
  for (let index = start; index < end; index += 1) {
    target.push(source[index]!);
  }
}

function splitTextLines(sourceText: string): TextLine[] {
  const lines: TextLine[] = [];
  let start = 0;
  while (start < sourceText.length) {
    const newline = sourceText.indexOf("\n", start);
    if (newline < 0) {
      lines.push({ content: sourceText.slice(start), ending: "" });
      break;
    }
    const crlf = newline > start && sourceText[newline - 1] === "\r";
    lines.push({
      content: sourceText.slice(start, crlf ? newline - 1 : newline),
      ending: crlf ? "\r\n" : "\n",
    });
    start = newline + 1;
  }
  return lines;
}
