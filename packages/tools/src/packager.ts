import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import { strToU8, zipSync } from "fflate";

import { portablePath, resolveInside } from "./paths.js";

export interface PackageOptions {
  readonly payloadRoot: string;
  readonly output: string;
  readonly version: string;
}

const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_ARCHIVE_INPUT_BYTES = 128 * 1024 * 1024;
const ZIP_MTIME = new Date(1980, 0, 1, 0, 0, 0);
const REQUIRED_PAYLOAD_FILES = [
  "KDHybrid.js",
  "wasm/kd_hybrid_core_bg.wasm",
  "LICENSES/ACORN-MIT.txt",
  "LICENSES/MIT.txt",
  "LICENSES/MPL-2.0.txt",
  "NOTICE.txt",
  "SOURCE.txt",
  "source/MPL-2.0/packages/bootstrap/src/kd-adapters.ts",
  "source/MPL-2.0/crates/kd-core/src/pathfinding.rs",
  "source/MPL-2.0/packages/tools/src/kd-source-patches.ts",
  "source/MPL-2.0/packages/tools/src/kd-source-patch-v6.ts",
  "source/MPL-2.0/native/manager/src/SourcePatches.h",
  "source/MPL-2.0/native/manager/src/SourcePatches.cpp",
  "source/MPL-2.0/upstream-patches/kd-5.4.92/README.md",
  "source/MPL-2.0/upstream-patches/kd-5.4.92/source-optimizations-v6.patch",
  "source/MPL-2.0/upstream-patches/kd-5.4.92/bundle-optimizations-v6.patch"
] as const;


export async function packagePortableMod(options: PackageOptions): Promise<string> {
  const payloadRoot = resolve(options.payloadRoot);
  const files = await collectFiles(payloadRoot);
  const names = new Set(files.map((file) => file.path));
  for (const required of REQUIRED_PAYLOAD_FILES) {
    if (!names.has(required)) {
      throw new Error(`Portable mod payload is missing ${required}`);
    }
  }

  const manifest = {
    modname: "KDHybrid",
    moddesc:
      "Hybrid Rust/WASM simulation and adaptive performance layer with safe JavaScript fallback",
    author: "KD Hybrid contributors",
    modbuild: options.version,
    gamemajor: -1,
    gameminor: -1,
    gamepatch_min: -1,
    gamepatch_max: -1,
    priority: -100,
    fileorder: ["wasm/kd_hybrid_core_bg.wasm", "KDHybrid.js"]
  };
  const readme = [
    `KD Hybrid ${options.version}`,
    "",
    "Install this ZIP with Kinky Dungeon's normal mod manager.",
    "This normal-mod build does not modify game files or save data.",
    "Unknown upstream signatures stay on the official JavaScript path.",
    "KD Hybrid is MIT with specifically marked MPL-2.0 adapted files.",
    "Both licenses, attribution, and MPL-covered source are inside this ZIP.",
    "See the open-source repository for source, safety details, and the",
    "optional reversible early bootstrap patcher.",
    ""
  ].join("\n");

  const archive: Record<string, Uint8Array> = {
    "mod.json": strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
    "README.txt": strToU8(readme)
  };
  for (const file of files) {
    archive[file.path] = await readFile(file.source);
  }
  const zipped = zipSync(archive, { level: 9, mtime: ZIP_MTIME });
  const output = resolve(options.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, zipped, { flag: "w" });
  return output;
}

interface CollectedFile {
  readonly path: string;
  readonly source: string;
}

async function collectFiles(root: string): Promise<readonly CollectedFile[]> {
  if ((await stat(root).catch(() => null))?.isDirectory() !== true) {
    throw new Error(`Payload directory does not exist: ${root}`);
  }
  const files: CollectedFile[] = [];
  let total = 0;
  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const source = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Package payload symlink is forbidden: ${source}`);
      }
      if (entry.isDirectory()) {
        await walk(source);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Unsupported package entry: ${source}`);
      }
      const info = await stat(source);
      if (info.size > MAX_FILE_BYTES) {
        throw new RangeError(`Package file exceeds 64 MiB: ${source}`);
      }
      total += info.size;
      if (total > MAX_ARCHIVE_INPUT_BYTES) {
        throw new RangeError("Package inputs exceed 128 MiB");
      }
      const relation = relative(root, source);
      if (
        relation === "" ||
        relation === ".." ||
        relation.startsWith(`..${sep}`)
      ) {
        throw new Error(`Package path escaped payload root: ${source}`);
      }
      const path = portablePath(relation);
      resolveInside(root, path);
      files.push({ path, source });
    }
  };
  await walk(root);
  return files;
}
