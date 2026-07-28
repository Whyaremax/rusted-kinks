import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const bootstrapOutput = resolve(output, "bootstrap");
const modOutput = resolve(output, "mod");
const modEntryOutput = resolve(modOutput, "KDHybrid.entry.js");
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

await copyWasm("wasm-web", resolve(bootstrapOutput, "wasm"), [
  "kd_hybrid_core.js",
  "kd_hybrid_core_bg.wasm"
]);
await copyWasm("wasm-nomod", resolve(modOutput, "wasm"), ["kd_hybrid_core_bg.wasm"]);

const legalFiles = [
  ["LICENSE", "LICENSES/MIT.txt"],
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
      "The small KD 5.4.92 source delta and exact upstream revision are under",
      "source/MPL-2.0/upstream-patches/kd-5.4.92/.",
      "Full project source: https://github.com/Whyaremax/rusted-kinks",
      "Upstream KD source: https://github.com/Ada18980/KinkiestDungeon",
      ""
    ].join("\n")
  );
}

const metadata = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
await writeFile(
  resolve(bootstrapOutput, "version.json"),
  `${JSON.stringify(
    {
      schema: 1,
      version: metadata.version,
      abi: 1,
      upstream: {
        version: "5.4.92",
        gameVersion: "5.4.92",
        packageVersion: "5.1.12",
        bundleSha256:
          "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4"
      },
      sourcePatch: {
        id: "kd-5.4.92-source-optimizations-v6",
        outputBundleSha256:
          "aa4c09e73de34b1ab6eea5328880049578963c7c3dcbaae07728ca408da59f92",
        source:
          "source/MPL-2.0/upstream-patches/kd-5.4.92/source-optimizations-v6.patch",
        bundlePatch:
          "source/MPL-2.0/upstream-patches/kd-5.4.92/bundle-optimizations-v6.patch"
      }
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
