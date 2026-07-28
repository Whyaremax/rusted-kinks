// SPDX-License-Identifier: MPL-2.0

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compareMapgenReports } from "./verify-mapgen-seed-contract.mjs";

describe("map-generation seed contract", () => {
  it("accepts exact maps from distinct renderer sessions", () => {
    const result = compareMapgenReports([
      fixture("a.json", 1000, "a".repeat(64)),
      fixture("b.json", 2000, "a".repeat(64)),
    ]);

    assert.equal(result.passed, true);
    assert.equal(result.distinctSessions, 2);
    assert.equal(result.maps, 1);
    assert.equal(result.comparisons, 12);
    assert.equal(result.mismatchCount, 0);
    assert.deepEqual(result.reasons, []);
  });

  it("rejects reports from the same renderer session", () => {
    const result = compareMapgenReports([
      fixture("a.json", 1000, "a".repeat(64)),
      fixture("a-copy.json", 1000, "a".repeat(64)),
    ]);

    assert.equal(result.passed, false);
    assert.equal(result.distinctSessions, 1);
    assert.ok(
      result.reasons.includes(
        "reports must come from distinct renderer sessions; relaunch the isolated KD instance between runs",
      ),
    );
  });

  it("reports a changed canonical map digest", () => {
    const result = compareMapgenReports([
      fixture("a.json", 1000, "a".repeat(64)),
      fixture("b.json", 2000, "b".repeat(64)),
    ]);

    assert.equal(result.passed, false);
    assert.equal(result.mismatchCount, 1);
    assert.deepEqual(result.mismatches[0], {
      report: "b.json",
      kind: "map-field",
      mapIndex: 0,
      field: "contentSha256",
      expected: "a".repeat(64),
      actual: "b".repeat(64),
    });
  });
});

function fixture(reportPath, timeOrigin, contentSha256) {
  return {
    path: reportPath,
    report: {
      environment: {
        gameVersion: "5.4.92",
        requestedMaps: 1,
        startIndex: 0,
        pathfinding: { requested: "native" },
        enemySelector: { requested: "product" },
        sourcePatches: {},
        rendererSession: { processId: null, timeOrigin },
      },
      run: {
        results: [
          {
            index: 0,
            checkpoint: "grv",
            floor: 1,
            seed: "kd-hybrid-mapgen-5.4.92-grv-1-0",
            accessible: true,
            width: 31,
            height: 19,
            entities: 42,
            groundItems: 8,
            contentBytes: 4096,
            contentSha256,
            signature: "1234abcd",
          },
        ],
      },
      restore: { exact: true, signature: "24a5fc88" },
      acceptance: { passed: true, reasons: [] },
    },
  };
}
