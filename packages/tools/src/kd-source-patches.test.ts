// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from "vitest";

import {
  applyKDSourcePatch,
  applyUnifiedPatch,
  createKDSourcePatchCatalog,
  findKDSourcePatch,
  findKDSourcePatchById,
  type KDSourcePatchDefinition,
} from "./kd-source-patches.js";

const KD_5_4_92_SHA256 =
  "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4";
const KD_5_5_1_SHA256 =
  "60a85515783853653fd051936429494b8ef85024ff66b08134e68f9fe89248e0";
const PIXI_FILTERS_SHA256 =
  "23aa3d8d53e0755bf39bf6d7d2b409788b502a46f35cde53564ed7230af7a507";

it("selects 5.5.6 v2 while retaining v1 for migration and restoration", () => {
  const active = findKDSourcePatch("e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25");
  expect(active?.id).toBe("kd-5.5.6-source-optimizations-v2");
  expect(active?.outputSha256).toBe("4303a9a102d7596e8c4a62793d6e76c3003c8e2abbea185c642c260a0e07c00b");
  expect(findKDSourcePatchById("kd-5.5.6-source-optimizations-v1")?.outputSha256).toBe("8751afa2b64d82a446d279d512d30eb0b8d7a0cb642c7dfc779f6bf4edaa779c");
  expect(active?.files).toHaveLength(2);
});

describe("KD source patch", () => {
  it("exposes only immutable attribution metadata", () => {
    expect(findKDSourcePatch(KD_5_4_92_SHA256)).toEqual({
      id: "kd-5.4.92-source-optimizations-v7",
      upstreamVersion: "5.4.92",
      inputSha256: KD_5_4_92_SHA256,
      outputSha256:
        "aa92bb52a07a553086525704f3b1ee8f3a7f2fe6e008cd507f74c9cde9c57b3d",
      sourceUrl:
        "https://github.com/Ada18980/KinkiestDungeon/tree/5c96c4c1e67faf136ba2c167ed889a9e29005a18",
      files: [
        {
          path: "out/main.js",
          inputSha256: KD_5_4_92_SHA256,
          outputSha256:
            "aa92bb52a07a553086525704f3b1ee8f3a7f2fe6e008cd507f74c9cde9c57b3d",
        },
        {
          path: "Scripts/lib/pixi-filters.js",
          inputSha256: PIXI_FILTERS_SHA256,
          outputSha256:
            "4cfc4145e5950a17df19642fcc6cc378b2b3abef4276e7f56e39628739ae6b95",
        },
      ],
    });
    expect(findKDSourcePatch(KD_5_5_1_SHA256)).toEqual({
      id: "kd-5.5.1-source-optimizations-v1",
      upstreamVersion: "5.5.1",
      inputSha256: KD_5_5_1_SHA256,
      outputSha256:
        "2a42cf93ea4d084988afdd37d5bd96c0f9fe4f7ef6b662b2ed1f8776a7443234",
      sourceUrl:
        "https://github.com/Ada18980/KinkiestDungeon/tree/b37a3e91c5481310537dbfe6baa0302a2dcebbc6",
      files: [
        {
          path: "out/main.js",
          inputSha256: KD_5_5_1_SHA256,
          outputSha256:
            "2a42cf93ea4d084988afdd37d5bd96c0f9fe4f7ef6b662b2ed1f8776a7443234",
        },
        {
          path: "Scripts/lib/pixi-filters.js",
          inputSha256: PIXI_FILTERS_SHA256,
          outputSha256:
            "4cfc4145e5950a17df19642fcc6cc378b2b3abef4276e7f56e39628739ae6b95",
        },
      ],
    });
    expect(
      findKDSourcePatchById("kd-5.4.92-source-optimizations-v6"),
    ).toMatchObject({
      inputSha256: KD_5_4_92_SHA256,
      outputSha256:
        "aa4c09e73de34b1ab6eea5328880049578963c7c3dcbaae07728ca408da59f92",
    });
  });

  it("selects multiple catalog entries only by exact input hash", () => {
    const first = fixturePatch(
      "first",
      "a".repeat(64),
      "b".repeat(64),
      "alpha",
      "bravo",
    );
    const second = fixturePatch(
      "second",
      "c".repeat(64),
      "d".repeat(64),
      "charlie",
      "delta",
    );
    const catalog = createKDSourcePatchCatalog([first, second]);

    expect(catalog.find(first.inputSha256.toUpperCase())?.id).toBe("first");
    expect(catalog.find(second.inputSha256)?.id).toBe("second");
    expect(catalog.find(first.outputSha256)).toBeUndefined();
    expect(catalog.apply("alpha\n", first.inputSha256)?.text).toBe("bravo\n");
    expect(catalog.apply("charlie\n", second.inputSha256)?.text).toBe(
      "delta\n",
    );
    expect(catalog.apply("alpha\n", "e".repeat(64))).toBeNull();
  });

  it("rejects ambiguous catalog ids and bundle hashes", () => {
    const first = fixturePatch(
      "first",
      "a".repeat(64),
      "b".repeat(64),
      "alpha",
      "bravo",
    );

    expect(() =>
      createKDSourcePatchCatalog([
        first,
        fixturePatch(
          "first",
          "c".repeat(64),
          "d".repeat(64),
          "charlie",
          "delta",
        ),
      ]),
    ).toThrow(/duplicate id/u);
    expect(() =>
      createKDSourcePatchCatalog([
        first,
        fixturePatch(
          "second",
          first.outputSha256,
          "d".repeat(64),
          "charlie",
          "delta",
        ),
      ]),
    ).toThrow(/reuses a catalog bundle hash/u);
  });

  it("rejects incomplete catalog metadata before selection", () => {
    const patch = fixturePatch(
      "fixture",
      "a".repeat(64),
      "b".repeat(64),
      "alpha",
      "bravo",
    );

    expect(() =>
      createKDSourcePatchCatalog([{ ...patch, sourceUrl: "" }]),
    ).toThrow(/invalid metadata/u);
    expect(() =>
      createKDSourcePatchCatalog([{ ...patch, unifiedPatch: "not a patch" }]),
    ).toThrow(/invalid metadata/u);
    expect(() =>
      createKDSourcePatchCatalog([{ ...patch, upstreamVersion: " " }]),
    ).toThrow(/invalid metadata/u);
  });

  it("selects one active transformation while retaining a same-input legacy entry", () => {
    const legacy = {
      ...fixturePatch(
        "legacy-v6",
        "a".repeat(64),
        "b".repeat(64),
        "alpha",
        "legacy",
      ),
      legacy: true,
    };
    const active = fixturePatch(
      "active-v7",
      "a".repeat(64),
      "c".repeat(64),
      "alpha",
      "active",
    );
    const catalog = createKDSourcePatchCatalog([legacy, active]);

    expect(catalog.find("a".repeat(64))?.id).toBe("active-v7");
    expect(catalog.findById("legacy-v6")?.outputSha256).toBe("b".repeat(64));
    expect(catalog.findByOutput("out/main.js", "b".repeat(64))?.id).toBe(
      "legacy-v6",
    );
    expect(catalog.apply("alpha\n", "a".repeat(64))?.text).toBe("active\n");
  });

  it("applies an exact multi-file transformation as one catalog selection", () => {
    const patch = {
      ...fixturePatch(
        "multi-v7",
        "a".repeat(64),
        "b".repeat(64),
        "main-before",
        "main-after",
      ),
      additionalFiles: [
        {
          path: "Scripts/lib/pixi-filters.js",
          inputSha256: "c".repeat(64),
          outputSha256: "d".repeat(64),
          unifiedPatch: `diff --git a/Scripts/lib/pixi-filters.js b/Scripts/lib/pixi-filters.js
--- a/Scripts/lib/pixi-filters.js
+++ b/Scripts/lib/pixi-filters.js
@@ -1,1 +1,1 @@
-filter-before
+filter-after
`,
        },
      ],
    } satisfies KDSourcePatchDefinition;
    const catalog = createKDSourcePatchCatalog([patch]);
    const result = catalog.applyFiles([
      {
        path: "out/main.js",
        text: "main-before\n",
        sha256: "a".repeat(64),
      },
      {
        path: "Scripts/lib/pixi-filters.js",
        text: "filter-before\n",
        sha256: "c".repeat(64),
      },
    ]);

    expect(result?.patch.files).toEqual([
      {
        path: "out/main.js",
        inputSha256: "a".repeat(64),
        outputSha256: "b".repeat(64),
      },
      {
        path: "Scripts/lib/pixi-filters.js",
        inputSha256: "c".repeat(64),
        outputSha256: "d".repeat(64),
      },
    ]);
    expect(result?.files.map(({ path, text }) => ({ path, text }))).toEqual([
      { path: "out/main.js", text: "main-after\n" },
      { path: "Scripts/lib/pixi-filters.js", text: "filter-after\n" },
    ]);
    expect(() =>
      catalog.applyFiles([
        {
          path: "out/main.js",
          text: "main-before\n",
          sha256: "a".repeat(64),
        },
      ]),
    ).toThrow(/file set is incomplete/u);
  });

  it("rejects duplicate, unsafe, colliding, and output-input ambiguous file metadata", () => {
    const base = fixturePatch(
      "multi",
      "a".repeat(64),
      "b".repeat(64),
      "alpha",
      "bravo",
    );
    const auxiliary = {
      path: "Scripts/lib/pixi-filters.js",
      inputSha256: "c".repeat(64),
      outputSha256: "d".repeat(64),
      unifiedPatch: `diff --git a/Scripts/lib/pixi-filters.js b/Scripts/lib/pixi-filters.js
--- a/Scripts/lib/pixi-filters.js
+++ b/Scripts/lib/pixi-filters.js
@@ -1,1 +1,1 @@
-alpha
+bravo
`,
    };

    expect(() =>
      createKDSourcePatchCatalog([
        { ...base, additionalFiles: [auxiliary, auxiliary] },
      ]),
    ).toThrow(/duplicate path/u);
    expect(() =>
      createKDSourcePatchCatalog([
        {
          ...base,
          additionalFiles: [
            {
              ...auxiliary,
              path: "../pixi-filters.js",
              unifiedPatch: auxiliary.unifiedPatch.replaceAll(
                "Scripts/lib/pixi-filters.js",
                "../pixi-filters.js",
              ),
            },
          ],
        },
      ]),
    ).toThrow(/unsafe path/u);
    expect(() =>
      createKDSourcePatchCatalog([
        base,
        fixturePatch(
          "ambiguous",
          base.outputSha256,
          "e".repeat(64),
          "bravo",
          "echo",
        ),
      ]),
    ).toThrow(/output\/input ambiguity/u);
    expect(() =>
      createKDSourcePatchCatalog([
        base,
        fixturePatch(
          "active-collision",
          base.inputSha256,
          "e".repeat(64),
          "alpha",
          "echo",
        ),
      ]),
    ).toThrow(/active input/u);
  });

  it("allows byte-identical auxiliary transforms shared by distinct active builds", () => {
    const auxiliary = {
      path: "Scripts/lib/pixi-filters.js",
      inputSha256: "e".repeat(64),
      outputSha256: "f".repeat(64),
      unifiedPatch: `diff --git a/Scripts/lib/pixi-filters.js b/Scripts/lib/pixi-filters.js
--- a/Scripts/lib/pixi-filters.js
+++ b/Scripts/lib/pixi-filters.js
@@ -1,1 +1,1 @@
-shared-before
+shared-after
`,
    };
    const first = {
      ...fixturePatch(
        "release-one",
        "1".repeat(64),
        "2".repeat(64),
        "one-before",
        "one-after",
      ),
      additionalFiles: [auxiliary],
    };
    const second = {
      ...fixturePatch(
        "release-two",
        "3".repeat(64),
        "4".repeat(64),
        "two-before",
        "two-after",
      ),
      additionalFiles: [auxiliary],
    };

    expect(() => createKDSourcePatchCatalog([first, second])).not.toThrow();
    expect(() =>
      createKDSourcePatchCatalog([
        first,
        {
          ...second,
          additionalFiles: [
            {
              ...auxiliary,
              outputSha256: "0".repeat(64),
            },
          ],
        },
      ]),
    ).toThrow(/conflicts with an auxiliary transform/u);
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

  it("applies a first hunk late in a large bundle without spreading the prefix", () => {
    const hunkLine = 166_376;
    const lines = Array.from(
      { length: 170_000 },
      (_, index) => `line-${index + 1}`,
    );
    const source = `${lines.join("\n")}\n`;
    const patch = `diff --git a/out/main.js b/out/main.js
--- a/out/main.js
+++ b/out/main.js
@@ -${hunkLine},1 +${hunkLine},1 @@
-line-${hunkLine}
+late-replacement
`;

    const result = applyUnifiedPatch(source, patch, "late-hunk").split("\n");
    expect(result[0]).toBe("line-1");
    expect(result[hunkLine - 1]).toBe("late-replacement");
    expect(result[169_999]).toBe("line-170000");
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

function fixturePatch(
  id: string,
  inputSha256: string,
  outputSha256: string,
  before: string,
  after: string,
): KDSourcePatchDefinition {
  return {
    id,
    upstreamVersion: "fixture",
    inputSha256,
    outputSha256,
    sourceUrl: "https://example.invalid/source",
    unifiedPatch: `diff --git a/out/main.js b/out/main.js
--- a/out/main.js
+++ b/out/main.js
@@ -1,1 +1,1 @@
-${before}
+${after}
`,
  };
}
