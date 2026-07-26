import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";
import { zipSync } from "fflate";

const root = path.resolve(import.meta.dirname, "..");
const metadata = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const version = metadata.version;
const redistributionRoot = path.join(root, "redistribution");
const releasesRoot = path.join(redistributionRoot, "releases");
const kitName = `KD-Hybrid-${version}`;
const kitRoot = path.join(releasesRoot, kitName);
const setupArchive = path.join(releasesRoot, `${kitName}-setup.zip`);
const relation = path.relative(releasesRoot, kitRoot);
if (
  relation === "" ||
  relation === ".." ||
  relation.startsWith(`..${path.sep}`)
) {
  throw new Error(`Refusing unsafe redistribution output path: ${kitRoot}`);
}

await mkdir(releasesRoot, { recursive: true });
await rm(kitRoot, { recursive: true, force: true });
await rm(setupArchive, { force: true });
await mkdir(path.join(kitRoot, "tools"), { recursive: true });
await mkdir(path.join(kitRoot, "LICENSES"), { recursive: true });

await build({
  entryPoints: [
    path.join(root, "packages", "tools", "src", "patcher-cli.ts"),
  ],
  outfile: path.join(kitRoot, "tools", "kd-hybrid-tool.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["node22"],
  legalComments: "inline",
  minify: false,
});

await Promise.all([
  cp(path.join(root, "dist", "bootstrap"), path.join(kitRoot, "bootstrap"), {
    recursive: true,
  }),
  cp(
    path.join(redistributionRoot, "templates", "QUICKSTART.txt"),
    path.join(kitRoot, "QUICKSTART.txt"),
  ),
  cp(
    path.join(redistributionRoot, "templates", "KDHybrid-Patcher.ps1"),
    path.join(kitRoot, "KDHybrid-Patcher.ps1"),
  ),
  cp(path.join(root, "LICENSE"), path.join(kitRoot, "LICENSES", "MIT.txt")),
  cp(
    path.join(root, "LICENSES", "MPL-2.0.txt"),
    path.join(kitRoot, "LICENSES", "MPL-2.0.txt"),
  ),
  cp(path.join(root, "NOTICE.md"), path.join(kitRoot, "NOTICE.txt")),
]);

const distributableFiles = await collectFiles(kitRoot);
auditFiles(distributableFiles);
const manifest = {
  schema: 1,
  project: "KD Hybrid",
  version,
  source: "https://github.com/Whyaremax/rusted-kinks",
  gameCompatibility: {
    version: "5.4.92",
    packageVersion: "5.1.12",
    bundleSha256:
      "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4",
  },
  purpose: "optional early bootstrap patcher",
  containsGameAssets: false,
  containsSaveData: false,
  files: await Promise.all(
    distributableFiles.map(async (file) => ({
      path: portablePath(path.relative(kitRoot, file)),
      bytes: (await stat(file)).size,
      sha256: await sha256File(file),
    })),
  ),
};
await writeFile(
  path.join(kitRoot, "release-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const archiveFiles = await collectFiles(kitRoot);
const archive = {};
for (const file of archiveFiles) {
  const archivePath = `${kitName}/${portablePath(path.relative(kitRoot, file))}`;
  archive[archivePath] = await readFile(file);
}
await writeFile(setupArchive, zipSync(archive, { level: 9 }));

const sums = [
  {
    path: path.basename(setupArchive),
    sha256: await sha256File(setupArchive),
  },
];
await writeFile(
  path.join(releasesRoot, "SHA256SUMS.txt"),
  `${sums.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n")}\n`,
);

process.stdout.write(
  `${JSON.stringify(
    {
      state: "ready",
      kitRoot,
      setupArchive,
      files: archiveFiles.length,
      setupBytes: (await stat(setupArchive)).size,
    },
    null,
    2,
  )}\n`,
);

async function collectFiles(directory) {
  const files = [];
  const walk = async (current) => {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Redistribution symlinks are forbidden: ${target}`);
      }
      if (entry.isDirectory()) {
        await walk(target);
      } else if (entry.isFile()) {
        files.push(target);
      } else {
        throw new Error(`Unsupported redistribution entry: ${target}`);
      }
    }
  };
  await walk(directory);
  return files;
}

function auditFiles(files) {
  const forbiddenPath =
    /(^|\/)(resources|saves?|profiles?|userdata|Game|Screens|TextureAtlas|Backgrounds|Music)(\/|$)/i;
  const forbiddenFile =
    /(^|\/)(KinkyDungeon\.exe|main\.js|electron\.js|preload\.js)$/i;
  for (const file of files) {
    const relation = portablePath(path.relative(kitRoot, file));
    if (forbiddenPath.test(relation) || forbiddenFile.test(relation)) {
      throw new Error(`Forbidden game or save content in redistribution: ${relation}`);
    }
  }
}

async function sha256File(file) {
  const hash = createHash("sha256");
  hash.update(await readFile(file));
  return hash.digest("hex");
}

function portablePath(value) {
  return value.split(path.sep).join("/");
}
