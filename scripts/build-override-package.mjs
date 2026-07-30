import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { zipSync } from "fflate";

import { install, KNOWN_BUNDLES } from "../packages/tools/dist/patcher.js";

const root = path.resolve(import.meta.dirname, "..");
const metadata = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const appRootInput = normalizeCliPath(optionValue("--app-root"));
if (!appRootInput) {
  throw new Error(
    "Usage: npm run package:override -- --app-root <KD game root or resources/app>",
  );
}

const appRoot = await normalizeAppRoot(appRootInput);
const sourceBundle = path.join(appRoot, "out", "main.js");
const sourceIndex = path.join(appRoot, "index.html");
const before = {
  bundle: await sha256File(sourceBundle),
  index: await sha256File(sourceIndex),
};
const known = KNOWN_BUNDLES["5.4.92"];
if (before.bundle !== known.bundleSha256) {
  throw new Error(
    `Override package requires the clean KD 5.4.92 bundle ${known.bundleSha256}; found ${before.bundle}`,
  );
}

const releaseName =
  `KD-Hybrid-${metadata.version}-Manual-Resources-KD-5.4.92`;
const output =
  optionValue("--output") ??
  path.join("redistribution", "releases", `${releaseName}.zip`);
const outputPath = path.resolve(root, output);
const temporaryRoot = await mkdtemp(
  path.join(tmpdir(), "kd-hybrid-override-"),
);
const stagedApp = path.join(temporaryRoot, "staged", "resources", "app");
const releaseRoot = path.join(temporaryRoot, "release");
const releaseApp = path.join(releaseRoot, "resources", "app");

try {
  await Promise.all([
    mkdir(path.join(stagedApp, "out"), { recursive: true }),
    mkdir(path.join(releaseApp, "out"), { recursive: true }),
  ]);
  await Promise.all([
    cp(sourceIndex, path.join(stagedApp, "index.html")),
    cp(sourceBundle, path.join(stagedApp, "out", "main.js")),
  ]);

  const installed = await install({
    appRoot: stagedApp,
    payloadRoot: path.join(root, "dist", "bootstrap"),
    toolVersion: metadata.version,
    pathfindingMode: "fast",
    textureMode: "auto",
  });
  if (installed.state !== "installed" || !installed.manifest?.sourcePatch) {
    throw new Error(
      `Staged override did not verify as source-patched: ${installed.state}`,
    );
  }

  await Promise.all([
    cp(path.join(stagedApp, "index.html"), path.join(releaseApp, "index.html")),
    cp(
      path.join(stagedApp, "out", "main.js"),
      path.join(releaseApp, "out", "main.js"),
    ),
    cp(path.join(stagedApp, "kd-hybrid"), path.join(releaseApp, "kd-hybrid"), {
      recursive: true,
    }),
  ]);

  const files = await collectFiles(releaseRoot);
  await auditOverride(files, releaseRoot, before);
  const patchedBundleSha256 = await sha256File(
    path.join(releaseApp, "out", "main.js"),
  );
  if (
    patchedBundleSha256 !==
    installed.manifest.sourcePatch.patchedSha256
  ) {
    throw new Error(
      `Override bundle hash mismatch: ${patchedBundleSha256}`,
    );
  }
  const archive = {};
  for (const file of files) {
    archive[portable(path.relative(releaseRoot, file))] =
      await readFile(file);
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, zipSync(archive, { level: 9 }));
  await writeFile(
    `${outputPath}.sha256.txt`,
    `${await sha256File(outputPath)}  ${path.basename(outputPath)}\n`,
  );

  const after = {
    bundle: await sha256File(sourceBundle),
    index: await sha256File(sourceIndex),
  };
  if (after.bundle !== before.bundle || after.index !== before.index) {
    throw new Error("Source game files changed while building the override");
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        state: "ready",
        output: outputPath,
        bytes: (await stat(outputPath)).size,
        sha256: await sha256File(outputPath),
        files: files.length,
        cleanBackups: 0,
        inputUnchanged: true,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeCliPath(value) {
  if (value === undefined || process.platform !== "win32") {
    return value;
  }
  // npm routes scripts through cmd.exe, which escapes a literal ! as ^!.
  return value.replaceAll("^!", "!");
}

async function normalizeAppRoot(input) {
  const selected = path.resolve(input);
  try {
    if ((await stat(path.join(selected, "index.html"))).isFile()) {
      return selected;
    }
  } catch {
    // Try the normal Electron resources/app location below.
  }
  const nested = path.join(selected, "resources", "app");
  if (
    (await stat(path.join(nested, "index.html"))).isFile() &&
    (await stat(path.join(nested, "out", "main.js"))).isFile()
  ) {
    return nested;
  }
  throw new Error(`Not a Kinky Dungeon game root or resources/app: ${input}`);
}

async function collectFiles(directory) {
  const files = [];
  const walk = async (current) => {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Override symlinks are forbidden: ${target}`);
      }
      if (entry.isDirectory()) {
        await walk(target);
      } else if (entry.isFile()) {
        files.push(target);
      } else {
        throw new Error(`Unsupported override entry: ${target}`);
      }
    }
  };
  await walk(directory);
  return files;
}

async function auditOverride(files, releaseRootPath, original) {
  const forbiddenExtension =
    /\.(exe|dll|com|msi|ps1|bat|cmd|vbs|sh)$/iu;
  const forbiddenPath =
    /(^|\/)(restore|backups?|\.kd-hybrid|saves?|profiles?|userdata|local storage|indexeddb)(\/|$)/iu;
  const relations = files.map((file) =>
    portable(path.relative(releaseRootPath, file)),
  );
  if (
    relations.length === 0 ||
    relations.some((relative) => !relative.startsWith("resources/"))
  ) {
    throw new Error("Manual package must contain only the resources tree");
  }
  const required = [
    "resources/app/index.html",
    "resources/app/out/main.js",
    "resources/app/kd-hybrid/NOTICE.txt",
    "resources/app/kd-hybrid/LICENSES/ACORN-MIT.txt",
    "resources/app/kd-hybrid/LICENSES/MIT.txt",
    "resources/app/kd-hybrid/LICENSES/MPL-2.0.txt",
    "resources/app/kd-hybrid/SOURCE.txt",
  ];
  for (const relative of required) {
    if (!relations.includes(relative)) {
      throw new Error(`Required manual package file is missing: ${relative}`);
    }
  }
  for (const file of files) {
    const relative = portable(path.relative(releaseRootPath, file));
    if (forbiddenExtension.test(relative)) {
      throw new Error(`Executable forbidden in override: ${relative}`);
    }
    if (forbiddenPath.test(relative)) {
      throw new Error(`Backup or private data forbidden in override: ${relative}`);
    }
    const hash = await sha256File(file);
    if (hash === original.bundle || hash === original.index) {
      throw new Error(`Clean upstream file forbidden in override: ${relative}`);
    }
  }
}

function portable(value) {
  return value.replaceAll(path.sep, "/");
}

async function sha256File(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}
