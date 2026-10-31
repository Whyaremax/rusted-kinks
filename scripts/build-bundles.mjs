import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { build } from "esbuild";
import { strToU8, zipSync } from "fflate";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const bootstrapOutput = resolve(output, "bootstrap");
const modOutput = resolve(output, "mod");
const modEntryOutput = resolve(modOutput, "KDHybrid.entry.js");
const controlModEntryOutput = resolve(output, "KDHybridBridge.entry.js");
const metadata = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const upstreams = [
  {"version":"5.5.6","gameVersion":"5.5.6","packageVersion":"5.1.12","bundleSha256":"e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25"},
  {
    version: "5.4.92",
    gameVersion: "5.4.92",
    packageVersion: "5.1.12",
    bundleSha256:
      "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4"
  },
  {
    version: "5.5.1",
    gameVersion: "5.5.1",
    packageVersion: "5.1.12",
    bundleSha256:
      "60a85515783853653fd051936429494b8ef85024ff66b08134e68f9fe89248e0"
  }
];
const pixiFiltersPatch = {
  path: "Scripts/lib/pixi-filters.js",
  inputSha256:
    "23aa3d8d53e0755bf39bf6d7d2b409788b502a46f35cde53564ed7230af7a507",
  outputSha256:
    "4cfc4145e5950a17df19642fcc6cc378b2b3abef4276e7f56e39628739ae6b95",
  source:
    "source/MIT/upstream-patches/pixi-filters-5.2.0/compatibility-v1.patch",
  embeddedPatch:
    "source/MIT/packages/tools/src/pixi-filters-patch-v1.ts"
};
const sourcePatches = [
  {...{"id":"kd-5.5.6-source-optimizations-v2","upstreamVersion":"5.5.6","outputBundleSha256":"4303a9a102d7596e8c4a62793d6e76c3003c8e2abbea185c642c260a0e07c00b","source":"source/MPL-2.0/upstream-patches/kd-5.5.6/README.md","bundlePatch":"source/MPL-2.0/upstream-patches/kd-5.5.6/bundle-optimizations-v2.patch","embeddedPatch":"source/MPL-2.0/packages/tools/src/kd-source-patch-5-5-6-v2.ts"}, files: [{path:"out/main.js",inputSha256:"e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25",outputSha256:"4303a9a102d7596e8c4a62793d6e76c3003c8e2abbea185c642c260a0e07c00b"},pixiFiltersPatch]},
  {...{"id":"kd-5.5.6-source-optimizations-v1","upstreamVersion":"5.5.6","outputBundleSha256":"8751afa2b64d82a446d279d512d30eb0b8d7a0cb642c7dfc779f6bf4edaa779c","source":"source/MPL-2.0/upstream-patches/kd-5.5.6/README.md","bundlePatch":"source/MPL-2.0/upstream-patches/kd-5.5.6/bundle-optimizations-v1.patch","embeddedPatch":"source/MPL-2.0/packages/tools/src/kd-source-patch-5-5-6-v1.ts"}, files: [{path:"out/main.js",inputSha256:"e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25",outputSha256:"8751afa2b64d82a446d279d512d30eb0b8d7a0cb642c7dfc779f6bf4edaa779c"},pixiFiltersPatch]},
  {
    id: "kd-5.4.92-source-optimizations-v7",
    upstreamVersion: "5.4.92",
    outputBundleSha256:
      "aa92bb52a07a553086525704f3b1ee8f3a7f2fe6e008cd507f74c9cde9c57b3d",
    source:
      "source/MPL-2.0/upstream-patches/kd-5.4.92/source-optimizations-v7.patch",
    bundlePatch:
      "source/MPL-2.0/upstream-patches/kd-5.4.92/bundle-optimizations-v7.patch",
    embeddedPatch:
      "source/MPL-2.0/packages/tools/src/kd-source-patch-v7.ts",
    files: [
      {
        path: "out/main.js",
        inputSha256: upstreams[1].bundleSha256,
        outputSha256:
          "aa92bb52a07a553086525704f3b1ee8f3a7f2fe6e008cd507f74c9cde9c57b3d"
      },
      pixiFiltersPatch
    ]
  },
  {
    id: "kd-5.5.1-source-optimizations-v1",
    upstreamVersion: "5.5.1",
    outputBundleSha256:
      "2a42cf93ea4d084988afdd37d5bd96c0f9fe4f7ef6b662b2ed1f8776a7443234",
    source:
      "source/MPL-2.0/upstream-patches/kd-5.5.1/source-optimizations-v1.patch",
    bundlePatch:
      "source/MPL-2.0/upstream-patches/kd-5.5.1/bundle-optimizations-v1.patch",
    embeddedPatch:
      "source/MPL-2.0/packages/tools/src/kd-source-patch-5-5-v1.ts",
    files: [
      {
        path: "out/main.js",
        inputSha256: upstreams[2].bundleSha256,
        outputSha256:
          "2a42cf93ea4d084988afdd37d5bd96c0f9fe4f7ef6b662b2ed1f8776a7443234"
      },
      pixiFiltersPatch
    ]
  }
];
const legacy556 = sourcePatches.splice(sourcePatches.findIndex(p => p.id === "kd-5.5.6-source-optimizations-v1"), 1)[0];
const zipMtime = new Date(1980, 0, 1, 0, 0, 0);
const legalBanner =
  "/*! KD Hybrid contains MIT and MPL-2.0 files; see NOTICE.txt and LICENSES/. */";

await Promise.all([
  rm(bootstrapOutput, { recursive: true, force: true }),
  rm(modOutput, { recursive: true, force: true })
]);
await mkdir(bootstrapOutput, { recursive: true });
await mkdir(modOutput, { recursive: true });

await Promise.all([
  build({
    entryPoints: [resolve(root, "packages/bootstrap/src/index.ts")],
    outfile: resolve(bootstrapOutput, "kd-hybrid-bootstrap.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome120"],
    sourcemap: true,
    sourcesContent: false,
    legalComments: "linked",
    banner: { js: legalBanner },
    define: {
      "process.env.NODE_ENV": '"production"'
    }
  }),
  build({
    entryPoints: [resolve(root, "packages/bootstrap/src/mod.ts")],
    outfile: modEntryOutput,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome120"],
    sourcemap: false,
    sourcesContent: false,
    legalComments: "linked",
    banner: { js: legalBanner },
    define: {
      "process.env.NODE_ENV": '"production"'
    }
  }),
  build({
    entryPoints: [
      resolve(root, "packages/bootstrap/src/control-mod-entry.ts")
    ],
    outfile: controlModEntryOutput,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome120"],
    sourcemap: false,
    sourcesContent: false,
    legalComments: "none",
    banner: { js: legalBanner },
    define: {
      "process.env.NODE_ENV": '"production"'
    }
  })
]);

const noModuleGlue = await readFile(
  resolve(output, "wasm-nomod", "kd_hybrid_core.js"),
  "utf8"
);
const modEntry = await readFile(modEntryOutput, "utf8");
await writeFile(
  resolve(modOutput, "KDHybrid.js"),
  `${legalBanner}\n${noModuleGlue}\n${modEntry}`
);
await rm(modEntryOutput);

const controlModEntry = await readFile(controlModEntryOutput, "utf8");
const controlModManifest = {
  modname: "KD Hybrid",
  moddesc:
    "Native-feeling settings bridge for the installed KD Hybrid performance patch",
  author: "KD Hybrid contributors",
  modbuild: metadata.version,
  gamemajor: -1,
  gameminor: -1,
  gamepatch_min: -1,
  gamepatch_max: -1,
  priority: -100,
  fileorder: ["KDHybridBridge.js"]
};
await writeFile(
  resolve(bootstrapOutput, "KDHybridBridge.zip"),
  zipSync(
    {
      "mod.json": strToU8(`${JSON.stringify(controlModManifest, null, 2)}\n`),
      "KDHybridBridge.js": strToU8(controlModEntry),
      "README.txt": strToU8(
        [
          `KD Hybrid ${metadata.version} integration bridge`,
          "",
          "This small mod is installed by the KD Hybrid patcher.",
          "Kinky Dungeon owns its mod-list entry, settings UI, and persistence.",
          "The script forwards only validated options to the native Hybrid host.",
          ""
        ].join("\n")
      )
    },
    { level: 9, mtime: zipMtime }
  )
);
await rm(controlModEntryOutput);

await copyWasm("wasm-web", resolve(bootstrapOutput, "wasm"), [
  "kd_hybrid_core.js",
  "kd_hybrid_core_bg.wasm"
]);
await copyWasm("wasm-nomod", resolve(modOutput, "wasm"), ["kd_hybrid_core_bg.wasm"]);

const legalFiles = [
  ["packages/tools/src/kd-source-patch-5-5-6-v2.ts","source/MPL-2.0/packages/tools/src/kd-source-patch-5-5-6-v2.ts"],
  ["upstream-patches/kd-5.5.6/bundle-optimizations-v2.patch","source/MPL-2.0/upstream-patches/kd-5.5.6/bundle-optimizations-v2.patch"],
  ["packages/tools/src/kd-source-patch-5-5-6-v1.ts", "source/MPL-2.0/packages/tools/src/kd-source-patch-5-5-6-v1.ts"],
  ["upstream-patches/kd-5.5.6/README.md", "source/MPL-2.0/upstream-patches/kd-5.5.6/README.md"],
  ["upstream-patches/kd-5.5.6/bundle-optimizations-v1.patch", "source/MPL-2.0/upstream-patches/kd-5.5.6/bundle-optimizations-v1.patch"],
  ["LICENSE", "LICENSES/MIT.txt"],
  ["LICENSES/ACORN-MIT.txt", "LICENSES/ACORN-MIT.txt"],
  ["LICENSES/PIXI-FILTERS-MIT.txt", "LICENSES/PIXI-FILTERS-MIT.txt"],
  ["LICENSES/MPL-2.0.txt", "LICENSES/MPL-2.0.txt"],
  ["NOTICE.md", "NOTICE.txt"],
  [
    "packages/bootstrap/src/kd-adapters.ts",
    "source/MPL-2.0/packages/bootstrap/src/kd-adapters.ts"
  ],
  [
    "crates/kd-core/src/pathfinding.rs",
    "source/MPL-2.0/crates/kd-core/src/pathfinding.rs"
  ],
  [
    "packages/tools/src/kd-source-patches.ts",
    "source/MPL-2.0/packages/tools/src/kd-source-patches.ts"
  ],
  [
    "packages/tools/src/kd-source-patch-v6.ts",
    "source/MPL-2.0/packages/tools/src/kd-source-patch-v6.ts"
  ],
  [
    "packages/tools/src/kd-source-patch-v7.ts",
    "source/MPL-2.0/packages/tools/src/kd-source-patch-v7.ts"
  ],
  [
    "packages/tools/src/kd-source-patch-5-5-v1.ts",
    "source/MPL-2.0/packages/tools/src/kd-source-patch-5-5-v1.ts"
  ],
  [
    "packages/tools/src/pixi-filters-patch-v1.ts",
    "source/MIT/packages/tools/src/pixi-filters-patch-v1.ts"
  ],
  [
    "native/manager/src/SourcePatches.h",
    "source/MPL-2.0/native/manager/src/SourcePatches.h"
  ],
  [
    "native/manager/src/SourcePatches.cpp",
    "source/MPL-2.0/native/manager/src/SourcePatches.cpp"
  ],
  [
    "upstream-patches/kd-5.4.92/README.md",
    "source/MPL-2.0/upstream-patches/kd-5.4.92/README.md"
  ],
  [
    "upstream-patches/kd-5.4.92/source-optimizations-v6.patch",
    "source/MPL-2.0/upstream-patches/kd-5.4.92/source-optimizations-v6.patch"
  ],
  [
    "upstream-patches/kd-5.4.92/bundle-optimizations-v6.patch",
    "source/MPL-2.0/upstream-patches/kd-5.4.92/bundle-optimizations-v6.patch"
  ],
  [
    "upstream-patches/kd-5.4.92/source-optimizations-v7.patch",
    "source/MPL-2.0/upstream-patches/kd-5.4.92/source-optimizations-v7.patch"
  ],
  [
    "upstream-patches/kd-5.4.92/bundle-optimizations-v7.patch",
    "source/MPL-2.0/upstream-patches/kd-5.4.92/bundle-optimizations-v7.patch"
  ],
  [
    "upstream-patches/kd-5.5.1/README.md",
    "source/MPL-2.0/upstream-patches/kd-5.5.1/README.md"
  ],
  [
    "upstream-patches/kd-5.5.1/source-optimizations-v1.patch",
    "source/MPL-2.0/upstream-patches/kd-5.5.1/source-optimizations-v1.patch"
  ],
  [
    "upstream-patches/kd-5.5.1/bundle-optimizations-v1.patch",
    "source/MPL-2.0/upstream-patches/kd-5.5.1/bundle-optimizations-v1.patch"
  ],
  [
    "upstream-patches/pixi-filters-5.2.0/README.md",
    "source/MIT/upstream-patches/pixi-filters-5.2.0/README.md"
  ],
  [
    "upstream-patches/pixi-filters-5.2.0/compatibility-v1.patch",
    "source/MIT/upstream-patches/pixi-filters-5.2.0/compatibility-v1.patch"
  ]
];

for (const destination of [bootstrapOutput, modOutput]) {
  for (const [sourceName, targetName] of legalFiles) {
    const target = resolve(destination, targetName);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(root, sourceName), target);
  }
  await writeFile(
    resolve(destination, "SOURCE.txt"),
    [
      "KD Hybrid source notice",
      "",
      "MPL-covered source files are included under source/MPL-2.0/.",
      "The KD 5.4.92, 5.5.1 and 5.5.6 source deltas and exact upstream revisions are",
      "under source/MPL-2.0/upstream-patches/.",
      "KD 5.4.92 version 6 artifacts remain there for legacy migration review.",
      "The pixi-filters 5.2.0 compatibility delta is included under source/MIT/",
      "with its upstream MIT license in LICENSES/PIXI-FILTERS-MIT.txt.",
      "Full project source: https://github.com/Whyaremax/rusted-kinks",
      "Upstream KD source: https://github.com/Ada18980/KinkiestDungeon",
      ""
    ].join("\n")
  );
}

await writeFile(
  resolve(bootstrapOutput, "version.json"),
  `${JSON.stringify(
    {
      schema: 1,
      version: metadata.version,
      abi: 1,
      upstream: upstreams[0],
      upstreams,
      sourcePatch: sourcePatches[0],
      sourcePatches,
      legacySourcePatches: [
        legacy556,
        {
          id: "kd-5.4.92-source-optimizations-v6",
          upstreamVersion: "5.4.92",
          outputBundleSha256:
            "aa4c09e73de34b1ab6eea5328880049578963c7c3dcbaae07728ca408da59f92",
          source:
            "source/MPL-2.0/upstream-patches/kd-5.4.92/source-optimizations-v6.patch",
          bundlePatch:
            "source/MPL-2.0/upstream-patches/kd-5.4.92/bundle-optimizations-v6.patch",
          embeddedPatch:
            "source/MPL-2.0/packages/tools/src/kd-source-patch-v6.ts"
        }
      ]
    },
    null,
    2
  )}\n`
);

async function copyWasm(sourceName, destination, names) {
  const source = resolve(output, sourceName);
  if ((await stat(source).catch(() => null))?.isDirectory() !== true) {
    throw new Error(`Missing ${source}; run npm run build:wasm first`);
  }
  await mkdir(destination, { recursive: true });
  for (const name of names) {
    const file = resolve(source, name);
    if ((await stat(file).catch(() => null))?.isFile() !== true) {
      throw new Error(`Missing generated WASM artifact ${file}`);
    }
    await cp(file, resolve(destination, name));
  }
}
