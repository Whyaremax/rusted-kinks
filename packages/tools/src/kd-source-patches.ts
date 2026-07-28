// SPDX-License-Identifier: MPL-2.0
//
// Exact, version-gated transformations adapted from Kinky Dungeon 5.4.92.
// Kinky Dungeon is Copyright Strait Laced Games LLC.

import { KD_5_4_92_SOURCE_OPTIMIZATIONS_V6_BASE64 } from "./kd-source-patch-v6.js";

export interface KDSourcePatch {
  readonly id: string;
  readonly upstreamVersion: string;
  readonly inputSha256: string;
  readonly outputSha256: string;
  readonly sourceUrl: string;
}

interface KDSourcePatchDefinition extends KDSourcePatch {
  readonly unifiedPatch: string;
}

interface TextLine {
  readonly content: string;
  readonly ending: "" | "\n" | "\r\n";
}

const KD_5_4_92_SOURCE_OPTIMIZATIONS = Object.freeze({
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
}) satisfies KDSourcePatchDefinition;

const PATCHES_BY_INPUT = new Map<string, KDSourcePatchDefinition>([
  [
    KD_5_4_92_SOURCE_OPTIMIZATIONS.inputSha256,
    KD_5_4_92_SOURCE_OPTIMIZATIONS,
  ],
]);
const PATCH_INFO_BY_INPUT = new Map<string, KDSourcePatch>(
  [...PATCHES_BY_INPUT].map(([hash, patch]) => [
    hash,
    Object.freeze({
      id: patch.id,
      upstreamVersion: patch.upstreamVersion,
      inputSha256: patch.inputSha256,
      outputSha256: patch.outputSha256,
      sourceUrl: patch.sourceUrl,
    }),
  ]),
);

export function findKDSourcePatch(
  inputSha256: string,
): KDSourcePatch | undefined {
  return PATCH_INFO_BY_INPUT.get(inputSha256.toLowerCase());
}

export function applyKDSourcePatch(
  bundleText: string,
  inputSha256: string,
): { readonly text: string; readonly patch: KDSourcePatch } | null {
  const patch = PATCHES_BY_INPUT.get(inputSha256.toLowerCase());
  if (patch === undefined) return null;
  return Object.freeze({
    text: applyUnifiedPatch(bundleText, patch.unifiedPatch, patch.id),
    patch: PATCH_INFO_BY_INPUT.get(patch.inputSha256)!,
  });
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
    output.push(...sourceLines.slice(sourceIndex, targetIndex));
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

  output.push(...sourceLines.slice(sourceIndex));
  return output.map((line) => `${line.content}${line.ending}`).join("");
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
