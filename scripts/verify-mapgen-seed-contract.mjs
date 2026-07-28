// SPDX-License-Identifier: MPL-2.0
//
// Compares map-generation reports produced by separate KD renderer sessions.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const CONTRACT_FIELDS = [
  "index",
  "checkpoint",
  "floor",
  "seed",
  "accessible",
  "width",
  "height",
  "entities",
  "groundItems",
  "contentBytes",
  "contentSha256",
  "signature",
];

async function main() {
  const { values } = parseArgs({
    options: {
      report: { type: "string", multiple: true },
      output: {
        type: "string",
        default: "artifacts/mapgen-seed-contract-latest.json",
      },
      "allow-same-session": { type: "boolean", default: false },
    },
  });
  const reportPaths = values.report ?? [];
  if (reportPaths.length < 2) {
    throw new RangeError("Provide at least two --report paths");
  }

  const loaded = await Promise.all(
    reportPaths.map(async (reportPath) => {
      const resolvedPath = path.resolve(reportPath);
      return {
        path: resolvedPath,
        report: JSON.parse(await readFile(resolvedPath, "utf8")),
      };
    }),
  );
  const result = compareMapgenReports(
    loaded,
    Boolean(values["allow-same-session"]),
  );
  const outputPath = path.resolve(values.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify(
      {
        output: outputPath,
        passed: result.passed,
        reports: result.reports.length,
        distinctSessions: result.distinctSessions,
        maps: result.maps,
        comparisons: result.comparisons,
        mismatches: result.mismatches.length,
      },
      null,
      2,
    )}\n`,
  );
  if (!result.passed) {
    process.exitCode = 1;
  }
}

export function compareMapgenReports(loaded, allowSameSession = false) {
  const reasons = [];
  const reports = [];
  const sessions = [];
  const sessionKeys = new Set();

  for (const [reportIndex, entry] of loaded.entries()) {
    const report = entry?.report;
    const label = entry?.path ?? `report-${reportIndex + 1}`;
    if (!report || typeof report !== "object") {
      reasons.push(`${label}: report is not an object`);
      continue;
    }
    if (report.acceptance?.passed !== true) {
      reasons.push(`${label}: map-generation acceptance did not pass`);
    }
    if (report.restore?.exact !== true) {
      reasons.push(`${label}: fixture restore was not exact`);
    }
    if (!Array.isArray(report.run?.results) || report.run.results.length < 1) {
      reasons.push(`${label}: run.results is missing or empty`);
    }
    const session = normalizeSession(report.environment?.rendererSession);
    if (session === null) {
      reasons.push(`${label}: renderer session identity is missing`);
    } else {
      const key = JSON.stringify(session);
      sessionKeys.add(key);
      sessions.push({ report: label, ...session });
    }
    reports.push({
      path: label,
      gameVersion: report.environment?.gameVersion ?? null,
      requestedMaps: report.environment?.requestedMaps ?? null,
      startIndex: report.environment?.startIndex ?? null,
      sourcePatches: report.environment?.sourcePatches ?? null,
      session,
      restoreSignature: report.restore?.signature ?? null,
    });
  }

  if (!allowSameSession && sessionKeys.size !== loaded.length) {
    reasons.push(
      "reports must come from distinct renderer sessions; relaunch the isolated KD instance between runs",
    );
  }

  const reference = loaded[0]?.report;
  const referenceResults = reference?.run?.results;
  const mismatches = [];
  let comparisons = 0;
  if (Array.isArray(referenceResults)) {
    for (let reportIndex = 1; reportIndex < loaded.length; reportIndex += 1) {
      const current = loaded[reportIndex]?.report;
      compareConfiguration(
        reference,
        current,
        loaded[0].path,
        loaded[reportIndex].path,
        mismatches,
      );
      const currentResults = current?.run?.results;
      if (!Array.isArray(currentResults)) continue;
      if (currentResults.length !== referenceResults.length) {
        mismatches.push({
          report: loaded[reportIndex].path,
          kind: "map-count",
          expected: referenceResults.length,
          actual: currentResults.length,
        });
      }
      const count = Math.min(referenceResults.length, currentResults.length);
      for (let mapIndex = 0; mapIndex < count; mapIndex += 1) {
        for (const field of CONTRACT_FIELDS) {
          comparisons += 1;
          const expected = referenceResults[mapIndex]?.[field];
          const actual = currentResults[mapIndex]?.[field];
          if (expected !== actual) {
            mismatches.push({
              report: loaded[reportIndex].path,
              kind: "map-field",
              mapIndex,
              field,
              expected,
              actual,
            });
          }
        }
      }
    }
  }
  if (mismatches.length > 0) {
    reasons.push(
      `${mismatches.length} configuration or map-contract mismatches were found`,
    );
  }

  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    contract: {
      fields: CONTRACT_FIELDS,
      referenceReport: loaded[0]?.path ?? null,
      distinctRendererSessionsRequired: !allowSameSession,
    },
    reports,
    sessions,
    distinctSessions: sessionKeys.size,
    maps: Array.isArray(referenceResults) ? referenceResults.length : 0,
    comparisons,
    mismatches: mismatches.slice(0, 100),
    mismatchCount: mismatches.length,
    passed: reasons.length === 0,
    reasons,
  };
}

function compareConfiguration(
  expectedReport,
  actualReport,
  expectedPath,
  actualPath,
  mismatches,
) {
  const fields = [
    [
      "gameVersion",
      expectedReport?.environment?.gameVersion,
      actualReport?.environment?.gameVersion,
    ],
    [
      "requestedMaps",
      expectedReport?.environment?.requestedMaps,
      actualReport?.environment?.requestedMaps,
    ],
    [
      "startIndex",
      expectedReport?.environment?.startIndex,
      actualReport?.environment?.startIndex,
    ],
    [
      "pathfinding",
      expectedReport?.environment?.pathfinding?.requested,
      actualReport?.environment?.pathfinding?.requested,
    ],
    [
      "enemySelector",
      expectedReport?.environment?.enemySelector?.requested,
      actualReport?.environment?.enemySelector?.requested,
    ],
    [
      "sourcePatches",
      expectedReport?.environment?.sourcePatches,
      actualReport?.environment?.sourcePatches,
    ],
  ];
  for (const [field, expected, actual] of fields) {
    if (stableJson(expected) !== stableJson(actual)) {
      mismatches.push({
        report: actualPath,
        kind: "configuration",
        field,
        expectedReport: expectedPath,
        expected,
        actual,
      });
    }
  }
}

function normalizeSession(session) {
  if (!session || typeof session !== "object") return null;
  const processId = Number.isInteger(session.processId)
    ? session.processId
    : null;
  const timeOrigin = Number.isFinite(session.timeOrigin)
    ? session.timeOrigin
    : null;
  if (processId === null && timeOrigin === null) return null;
  return { processId, timeOrigin };
}

function stableJson(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
