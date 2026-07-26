import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { delimiter, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const marker = args.indexOf("--save-dir");
if (marker === -1 || args[marker + 1] === undefined) {
  throw new TypeError("Usage: node scripts/verify-save-safety.mjs --save-dir <directory>");
}
const saveRoot = resolve(args[marker + 1]);
if ((await stat(saveRoot).catch(() => null))?.isDirectory() !== true) {
  throw new Error(`Save directory does not exist: ${saveRoot}`);
}

const before = await snapshot(saveRoot);
const beforeDigest = digestSnapshot(before);
process.stdout.write(
  `Captured ${before.size} save files (aggregate ${beforeDigest.slice(0, 12)}…).\n`
);

const npmExecutable = process.env.npm_node_execpath ?? process.execPath;
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error(
    "Could not locate npm's CLI. Run this verifier through npm run verify:safety."
  );
}
const childEnvironment = { ...process.env };
if (process.platform === "win32" && process.env.USERPROFILE) {
  const cargoBin = join(process.env.USERPROFILE, ".cargo", "bin");
  const pathEntries = (childEnvironment.PATH ?? "").split(delimiter);
  if (
    existsSync(join(cargoBin, "cargo.exe")) &&
    !pathEntries.some(
      (entry) => entry.toLowerCase() === cargoBin.toLowerCase()
    )
  ) {
    childEnvironment.PATH = `${cargoBin}${delimiter}${childEnvironment.PATH ?? ""}`;
  }
}
const code = await new Promise((resolveCode, reject) => {
  const child = spawn(npmExecutable, [npmCli, "run", "check"], {
    cwd: resolve(import.meta.dirname, ".."),
    env: childEnvironment,
    stdio: "inherit",
    windowsHide: true
  });
  child.on("error", reject);
  child.on("exit", (exitCode) => resolveCode(exitCode ?? 1));
});
if (code !== 0) {
  throw new Error(`Project checks failed with exit code ${code}`);
}

const after = await snapshot(saveRoot);
const afterDigest = digestSnapshot(after);
if (beforeDigest !== afterDigest) {
  const changed = new Set([...before.keys(), ...after.keys()]);
  const differences = [...changed]
    .filter((name) => before.get(name) !== after.get(name))
    .sort()
    .slice(0, 20);
  throw new Error(
    `Save directory changed during checks (${differences.length} shown): ${differences.join(", ")}`
  );
}
process.stdout.write(
  `Verified unchanged: ${after.size} save files (aggregate ${afterDigest.slice(0, 12)}…).\n`
);

async function snapshot(root) {
  const records = new Map();
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Refusing to follow a save-directory symlink: ${entry.name}`);
      }
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile()) {
        const info = await stat(path);
        records.set(
          relative(root, path),
          `${info.size}:${info.mtimeMs}:${await hashFile(path)}`
        );
      }
    }
  };
  await walk(root);
  return records;
}

async function hashFile(path) {
  const hash = createHash("sha256");
  await new Promise((resolveHash, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolveHash);
  });
  return hash.digest("hex");
}

function digestSnapshot(records) {
  const hash = createHash("sha256");
  for (const [name, value] of [...records.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    hash.update(name);
    hash.update("\0");
    hash.update(value);
    hash.update("\0");
  }
  return hash.digest("hex");
}
