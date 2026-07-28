// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from "vitest";

import {
  applyKDSourcePatch,
  applyUnifiedPatch,
  findKDSourcePatch,
} from "./kd-source-patches.js";

const KD_5_4_92_SHA256 =
  "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4";

describe("KD source patch", () => {
  it("exposes only immutable attribution metadata", () => {
    expect(findKDSourcePatch(KD_5_4_92_SHA256)).toEqual({
      id: "kd-5.4.92-source-optimizations-v6",
      upstreamVersion: "5.4.92",
      inputSha256: KD_5_4_92_SHA256,
      outputSha256:
        "aa4c09e73de34b1ab6eea5328880049578963c7c3dcbaae07728ca408da59f92",
      sourceUrl:
        "https://github.com/Ada18980/KinkiestDungeon/tree/5c96c4c1e67faf136ba2c167ed889a9e29005a18",
    });
  });

  it("applies exact unified hunks while preserving CRLF", () => {
    const source = "alpha\r\nbeta\r\ngamma\r\n";
    const patch = `diff --git a/out/main.js b/out/main.js
--- a/out/main.js
+++ b/out/main.js
@@ -1,3 +1,4 @@
 alpha
-beta
+bravo
+beta
 gamma
`;

    expect(applyUnifiedPatch(source, patch, "fixture")).toBe(
      "alpha\r\nbravo\r\nbeta\r\ngamma\r\n",
    );
  });

  it("preserves mixed endings and uses the dominant ending for additions", () => {
    const source = "alpha\r\nbeta\ngamma\r\n";
    const patch = `diff --git a/out/main.js b/out/main.js
--- a/out/main.js
+++ b/out/main.js
@@ -1,3 +1,3 @@
 alpha
-beta
+bravo
 gamma
`;

    expect(applyUnifiedPatch(source, patch, "mixed")).toBe(
      "alpha\r\nbravo\r\ngamma\r\n",
    );
  });

  it("rejects unknown bundles and mismatched hunks", () => {
    expect(applyKDSourcePatch("fixture", "0".repeat(64))).toBeNull();
    expect(() =>
      applyUnifiedPatch(
        "alpha\nbeta\n",
        `diff --git a/out/main.js b/out/main.js
--- a/out/main.js
+++ b/out/main.js
@@ -1,2 +1,2 @@
 alpha
-gamma
+delta
`,
        "fixture",
      ),
    ).toThrow(/did not match source line/u);
  });
});
