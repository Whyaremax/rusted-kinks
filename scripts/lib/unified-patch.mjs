// SPDX-License-Identifier: MIT

import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function applyUnifiedPatch(
  sourceText,
  patchText,
  patchId = "unified-patch",
) {
  const crlfCount = sourceText.match(/\r\n/gu)?.length ?? 0;
  const lfCount = sourceText.match(/\n/gu)?.length ?? 0;
  const addedLineEnding = crlfCount > lfCount - crlfCount ? "\r\n" : "\n";
  const sourceLines = splitTextLines(sourceText);
  const patchLines = normalizePatchLines(patchText);
  const output = [];
  let sourceIndex = 0;
  let patchIndex = patchLines.findIndex((line) => line.startsWith("@@ "));
  if (patchIndex < 0) {
    throw new Error(`Source patch ${patchId} contains no unified diff hunks`);
  }

  while (patchIndex < patchLines.length) {
    const header = patchLines[patchIndex];
    if (!header.startsWith("@@ ")) {
      patchIndex += 1;
      continue;
    }
    const hunk = parseHunkHeader(header, patchId);
    const targetIndex = Math.max(0, hunk.oldStart - 1);
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
      const line = patchLines[patchIndex];
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
    if (consumedOld !== hunk.oldCount || producedNew !== hunk.newCount) {
      throw new Error(
        `Source patch ${patchId} hunk line counts did not match its header`,
      );
    }
  }

  appendTextLines(output, sourceLines, sourceIndex, sourceLines.length);
  return output.map((line) => `${line.content}${line.ending}`).join("");
}

export function rebaseUnifiedPatchByUniqueContext(
  targetText,
  patchText,
  patchId = "overlay-patch",
) {
  const targetLines = splitTextLines(targetText).map(({ content }) => content);
  const patchLines = normalizePatchLines(patchText);
  const matches = [];
  let previousEnd = 0;
  let cumulativeDelta = 0;

  for (let patchIndex = 0; patchIndex < patchLines.length; patchIndex += 1) {
    const header = patchLines[patchIndex];
    if (!header.startsWith("@@ ")) continue;
    const hunk = parseHunkHeader(header, patchId);
    const oldSide = [];
    let operationIndex = patchIndex + 1;
    let consumedOld = 0;
    let producedNew = 0;
    while (operationIndex < patchLines.length) {
      const line = patchLines[operationIndex];
      if (line.startsWith("@@ ") || line.startsWith("diff --git ")) break;
      if (line.startsWith("\\")) {
        operationIndex += 1;
        continue;
      }
      const operation = line[0];
      if (operation === " " || operation === "-") {
        oldSide.push(line.slice(1));
        consumedOld += 1;
        if (operation === " ") producedNew += 1;
      } else if (operation === "+") {
        producedNew += 1;
      } else if (line.length > 0) {
        throw new Error(
          `Source patch ${patchId} contains an invalid hunk line`,
        );
      }
      operationIndex += 1;
    }
    if (consumedOld !== hunk.oldCount || producedNew !== hunk.newCount) {
      throw new Error(
        `Source patch ${patchId} hunk line counts did not match its header`,
      );
    }
    if (oldSide.length === 0) {
      throw new Error(
        `Source patch ${patchId} cannot uniquely relocate a context-free insertion`,
      );
    }

    const candidateIndexes = [];
    const lastStart = targetLines.length - oldSide.length;
    for (let index = 0; index <= lastStart; index += 1) {
      if (matchesAt(targetLines, oldSide, index)) {
        candidateIndexes.push(index);
      }
    }
    if (candidateIndexes.length !== 1) {
      throw new Error(
        `Source patch ${patchId} hunk at old line ${hunk.oldStart} had ` +
          `${candidateIndexes.length} exact old-side context matches`,
      );
    }
    const targetIndex = candidateIndexes[0];
    if (targetIndex < previousEnd) {
      throw new Error(
        `Source patch ${patchId} relocated hunks overlap or are non-monotonic`,
      );
    }

    const rebasedOldStart = targetIndex + 1;
    const rebasedNewStart = rebasedOldStart + cumulativeDelta;
    patchLines[patchIndex] =
      `@@ -${formatRange(rebasedOldStart, hunk.oldCount)} ` +
      `+${formatRange(rebasedNewStart, hunk.newCount)} @@${hunk.suffix}`;
    matches.push({
      originalOldStart: hunk.oldStart,
      rebasedOldStart,
      rebasedNewStart,
      oldCount: hunk.oldCount,
      newCount: hunk.newCount,
      shift: rebasedOldStart - hunk.oldStart,
      firstOldLine: oldSide[0],
    });
    previousEnd = targetIndex + oldSide.length;
    cumulativeDelta += hunk.newCount - hunk.oldCount;
    patchIndex = operationIndex - 1;
  }

  if (matches.length === 0) {
    throw new Error(`Source patch ${patchId} contains no unified diff hunks`);
  }
  return Object.freeze({
    patchText: `${patchLines.join("\n").replace(/\n+$/u, "")}\n`,
    matches: Object.freeze(matches.map((match) => Object.freeze(match))),
  });
}

export async function generateCanonicalUnifiedPatch(
  before,
  after,
  { patchPath = "out/main.js", temporaryPrefix = "kd-unified-patch-" } = {},
) {
  const beforeBytes = Buffer.isBuffer(before) ? before : Buffer.from(before);
  const afterBytes = Buffer.isBuffer(after) ? after : Buffer.from(after);
  if (beforeBytes.equals(afterBytes)) {
    throw new Error("The clean and accepted inputs are identical");
  }
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), temporaryPrefix));
  const beforePath = path.join(temporaryRoot, "before");
  const afterPath = path.join(temporaryRoot, "after");
  try {
    await Promise.all([
      writeFile(beforePath, beforeBytes),
      writeFile(afterPath, afterBytes),
    ]);
    const generated = spawnSync(
      "git",
      [
        "diff",
        "--no-index",
        "--no-ext-diff",
        "--text",
        "--unified=3",
        "--",
        beforePath,
        afterPath,
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    if (generated.status !== 1 || !generated.stdout.startsWith("diff --git ")) {
      throw new Error(
        `git diff failed with status ${generated.status}: ${generated.stderr}`,
      );
    }
    const lines = generated.stdout.replaceAll("\r\n", "\n").split("\n");
    const oldHeader = lines.findIndex((line) => line.startsWith("--- "));
    const newHeader = lines.findIndex((line) => line.startsWith("+++ "));
    if (oldHeader < 0 || newHeader !== oldHeader + 1) {
      throw new Error(
        "The generated diff did not contain canonical file headers",
      );
    }
    lines[0] = `diff --git a/${patchPath} b/${patchPath}`;
    lines[oldHeader] = `--- a/${patchPath}`;
    lines[newHeader] = `+++ b/${patchPath}`;
    return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

function parseHunkHeader(header, patchId) {
  const match =
    /^@@ -(?<oldStart>\d+)(?:,(?<oldCount>\d+))? \+(?<newStart>\d+)(?:,(?<newCount>\d+))? @@(?<suffix>.*)$/u.exec(
      header,
    );
  if (!match?.groups) {
    throw new Error(
      `Source patch ${patchId} has an invalid hunk header: ${header}`,
    );
  }
  return {
    oldStart: Number(match.groups.oldStart),
    oldCount: Number(match.groups.oldCount ?? "1"),
    newStart: Number(match.groups.newStart),
    newCount: Number(match.groups.newCount ?? "1"),
    suffix: match.groups.suffix,
  };
}

function normalizePatchLines(patchText) {
  return patchText.replaceAll("\r\n", "\n").split("\n");
}

function formatRange(start, count) {
  return count === 1 ? String(start) : `${start},${count}`;
}

function matchesAt(source, expected, start) {
  for (let index = 0; index < expected.length; index += 1) {
    if (source[start + index] !== expected[index]) return false;
  }
  return true;
}

function appendTextLines(target, source, start, end) {
  for (let index = start; index < end; index += 1) {
    target.push(source[index]);
  }
}

function splitTextLines(sourceText) {
  const lines = [];
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
