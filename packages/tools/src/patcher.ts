import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import { sha256Bytes, sha256File } from "./hash.js";
import { assertExactChild, portablePath, resolveInside } from "./paths.js";

export const KNOWN_BUNDLES = Object.freeze({
  "5.4.92": Object.freeze({
    packageVersion: "5.1.12",
    bundleSha256: "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4"
  })
});

export const BOOTSTRAP_SCRIPT_PATH = "kd-hybrid/kd-hybrid-bootstrap.js";

export interface InstalledFile {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface InstallationManifest {
  readonly schema: 1;
  readonly id: string;
  readonly toolVersion: string;
  readonly installedAt: string;
  readonly appRoot: ".";
  readonly upstream: {
    readonly version: string | null;
    readonly packageVersion: string | null;
    readonly bundlePath: "out/main.js";
    readonly bundleSha256: string;
    readonly known: boolean;
  };
  readonly index: {
    readonly path: "index.html";
    readonly backupPath: string;
    readonly originalSha256: string;
    readonly patchedSha256: string;
  };
  readonly files: readonly InstalledFile[];
}

export interface InstallOptions {
  readonly appRoot: string;
  readonly payloadRoot: string;
  readonly toolVersion: string;
  readonly upstreamVersion?: string;
  readonly allowUnknownBundle?: boolean;
}

export interface PatcherStatus {
  readonly state: "not-installed" | "installed" | "modified" | "incomplete";
  readonly appRoot: string;
  readonly manifest: InstallationManifest | null;
  readonly problems: readonly string[];
}

const STATE_DIR = ".kd-hybrid";
const MANIFEST_PATH = `${STATE_DIR}/installation.json`;
const PENDING_PATH = `${STATE_DIR}/pending-installation.json`;
const DESTINATION_DIR = "kd-hybrid";
const SCRIPT_PATTERN =
  /<script\b[^>]*\bsrc=(["'])\.?\/?out\/main\.js\1[^>]*><\/script>/iu;

export async function install(options: InstallOptions): Promise<PatcherStatus> {
  const appRoot = resolve(options.appRoot);
  await validateLayout(appRoot);
  const existing = await status(appRoot);
  if (existing.state === "installed") {
    return existing;
  }
  if (existing.state !== "not-installed") {
    throw new Error(
      `Refusing install over ${existing.state} patcher state: ${existing.problems.join("; ")}`
    );
  }

  const payloadRoot = resolve(options.payloadRoot);
  const payloadFiles = await listPayloadFiles(payloadRoot);
  if (!payloadFiles.some((entry) => entry.relativePath === "kd-hybrid-bootstrap.js")) {
    throw new Error("Payload is missing kd-hybrid-bootstrap.js");
  }

  const bundlePath = resolveInside(appRoot, "out/main.js");
  const bundleSha256 = await sha256File(bundlePath);
  const requestedKnownBundle =
    options.upstreamVersion === undefined
      ? undefined
      : KNOWN_BUNDLES[options.upstreamVersion as keyof typeof KNOWN_BUNDLES];
  const detectedBundle = Object.entries(KNOWN_BUNDLES).find(
    ([, metadata]) => metadata.bundleSha256 === bundleSha256
  );
  const detectedVersion = detectedBundle?.[0];
  const detectedPackageVersion = detectedBundle?.[1].packageVersion;
  const known =
    detectedVersion !== undefined ||
    (requestedKnownBundle !== undefined &&
      requestedKnownBundle.bundleSha256 === bundleSha256);
  if (!known && options.allowUnknownBundle !== true) {
    throw new Error(
      `Unknown out/main.js SHA-256 ${bundleSha256}; this patcher only accepts verified game builds`
    );
  }

  const indexPath = resolveInside(appRoot, "index.html");
  const originalIndex = await readFile(indexPath);
  const originalText = originalIndex.toString("utf8");
  if (originalText.includes(BOOTSTRAP_SCRIPT_PATH)) {
    throw new Error("index.html already contains a KD Hybrid bootstrap without a manifest");
  }
  const config = escapeInlineJson({
    upstreamVersion: detectedVersion ?? options.upstreamVersion ?? null,
    upstreamPackageVersion:
      detectedPackageVersion ??
      requestedKnownBundle?.packageVersion ??
      null,
    upstreamBundleSha256: bundleSha256,
    quality: "auto"
  });
  const injection =
    `<script>globalThis.KDHybridBootstrapConfig=Object.freeze(${config});</script>` +
    `<script src="./${BOOTSTRAP_SCRIPT_PATH}"></script>`;
  if (!SCRIPT_PATTERN.test(originalText)) {
    throw new Error("Could not uniquely locate ./out/main.js in index.html");
  }
  const patchedText = originalText.replace(SCRIPT_PATTERN, `${injection}$&`);
  const patchedIndex = Buffer.from(patchedText, "utf8");

  const id = `${new Date().toISOString().replaceAll(/[:.]/gu, "-")}-${randomUUID()}`;
  const stateRoot = resolveInside(appRoot, STATE_DIR);
  const backupRelative = `${STATE_DIR}/backups/${id}/index.html`;
  const backupPath = resolveInside(appRoot, backupRelative);
  const destinationRoot = resolveInside(appRoot, DESTINATION_DIR);
  assertExactChild(appRoot, destinationRoot, DESTINATION_DIR);
  await ensureAbsent(destinationRoot);
  await mkdir(dirname(backupPath), { recursive: true });
  await writeFileExclusive(backupPath, originalIndex);

  const installedFiles: InstalledFile[] = payloadFiles.map((entry) => ({
    path: portablePath(`${DESTINATION_DIR}/${entry.relativePath}`),
    sha256: entry.sha256,
    bytes: entry.bytes
  }));
  const manifest: InstallationManifest = {
    schema: 1,
    id,
    toolVersion: options.toolVersion,
    installedAt: new Date().toISOString(),
    appRoot: ".",
    upstream: {
      version: detectedVersion ?? options.upstreamVersion ?? null,
      packageVersion:
        detectedPackageVersion ??
        requestedKnownBundle?.packageVersion ??
        null,
      bundlePath: "out/main.js",
      bundleSha256,
      known
    },
    index: {
      path: "index.html",
      backupPath: portablePath(backupRelative),
      originalSha256: sha256Bytes(originalIndex),
      patchedSha256: sha256Bytes(patchedIndex)
    },
    files: installedFiles
  };

  await mkdir(stateRoot, { recursive: true });
  await atomicWriteJson(resolveInside(appRoot, PENDING_PATH), manifest);
  try {
    await copyPayload(payloadRoot, destinationRoot, payloadFiles);
    await atomicWrite(indexPath, patchedIndex);
    await atomicWriteJson(resolveInside(appRoot, MANIFEST_PATH), manifest);
    await rm(resolveInside(appRoot, PENDING_PATH), { force: true });
  } catch (error) {
    // Pending state plus the original backup intentionally remain for repair.
    throw error;
  }
  return status(appRoot);
}

export async function status(appRootInput: string): Promise<PatcherStatus> {
  const appRoot = resolve(appRootInput);
  await validateLayout(appRoot);
  const manifestPath = resolveInside(appRoot, MANIFEST_PATH);
  const pendingPath = resolveInside(appRoot, PENDING_PATH);
  const pending = await exists(pendingPath);
  if (!(await exists(manifestPath))) {
    return Object.freeze({
      state: pending ? "incomplete" : "not-installed",
      appRoot,
      manifest: null,
      problems: pending ? ["pending installation manifest exists"] : []
    });
  }

  const manifest = await readManifest(manifestPath);
  const problems: string[] = [];
  const indexPath = resolveInside(appRoot, manifest.index.path);
  if ((await sha256File(indexPath)) !== manifest.index.patchedSha256) {
    problems.push("index.html changed after KD Hybrid installation");
  }
  for (const file of manifest.files) {
    const path = resolveInside(appRoot, file.path);
    if (!(await exists(path))) {
      problems.push(`${file.path} is missing`);
    } else if ((await sha256File(path)) !== file.sha256) {
      problems.push(`${file.path} was modified`);
    }
  }
  if ((await sha256File(resolveInside(appRoot, manifest.upstream.bundlePath))) !==
      manifest.upstream.bundleSha256) {
    problems.push("out/main.js changed after KD Hybrid installation");
  }
  return Object.freeze({
    state: problems.length === 0 ? "installed" : "modified",
    appRoot,
    manifest,
    problems
  });
}

export async function uninstall(appRootInput: string): Promise<PatcherStatus> {
  const appRoot = resolve(appRootInput);
  const current = await status(appRoot);
  if (current.state === "not-installed") {
    return current;
  }
  if (current.state !== "installed" || current.manifest === null) {
    throw new Error(
      `Refusing uninstall because installed files changed: ${current.problems.join("; ")}`
    );
  }
  const manifest = current.manifest;
  const backupPath = resolveInside(appRoot, manifest.index.backupPath);
  const backup = await readFile(backupPath);
  if (sha256Bytes(backup) !== manifest.index.originalSha256) {
    throw new Error("Original index.html backup hash does not match the manifest");
  }

  await atomicWrite(resolveInside(appRoot, manifest.index.path), backup);
  const destinationRoot = resolveInside(appRoot, DESTINATION_DIR);
  assertExactChild(appRoot, destinationRoot, DESTINATION_DIR);
  await rm(destinationRoot, { recursive: true, force: true });

  const historyPath = resolveInside(
    appRoot,
    `${STATE_DIR}/uninstalled/${manifest.id}/installation.json`
  );
  await mkdir(dirname(historyPath), { recursive: true });
  await rename(resolveInside(appRoot, MANIFEST_PATH), historyPath);
  return status(appRoot);
}

async function validateLayout(appRoot: string): Promise<void> {
  const info = await stat(appRoot).catch(() => null);
  if (info?.isDirectory() !== true) {
    throw new Error(`App root does not exist: ${appRoot}`);
  }
  for (const required of ["index.html", "out/main.js"]) {
    const file = await stat(resolveInside(appRoot, required)).catch(() => null);
    if (file?.isFile() !== true) {
      throw new Error(`Target is not a KD resources/app directory: missing ${required}`);
    }
  }
}

interface PayloadFile {
  readonly relativePath: string;
  readonly sourcePath: string;
  readonly sha256: string;
  readonly bytes: number;
}

async function listPayloadFiles(root: string): Promise<readonly PayloadFile[]> {
  const rootInfo = await stat(root).catch(() => null);
  if (rootInfo?.isDirectory() !== true) {
    throw new Error(`Payload directory does not exist: ${root}`);
  }
  const results: PayloadFile[] = [];
  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        throw new Error(`Payload symlinks are forbidden: ${entry.name}`);
      }
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile()) {
        const relation = relative(root, path);
        if (
          relation === "" ||
          relation === ".." ||
          relation.startsWith(`..${sep}`)
        ) {
          throw new Error(`Payload path escaped its root: ${path}`);
        }
        const info = await stat(path);
        results.push({
          relativePath: portablePath(relation),
          sourcePath: path,
          sha256: await sha256File(path),
          bytes: info.size
        });
      } else {
        throw new Error(`Unsupported payload entry: ${path}`);
      }
    }
  };
  await walk(root);
  return results;
}

async function copyPayload(
  payloadRoot: string,
  destinationRoot: string,
  files: readonly PayloadFile[]
): Promise<void> {
  await mkdir(destinationRoot, { recursive: false });
  for (const file of files) {
    const source = resolveInside(payloadRoot, file.relativePath);
    if (resolve(source) !== resolve(file.sourcePath)) {
      throw new Error(`Payload changed during install: ${file.relativePath}`);
    }
    const destination = resolveInside(destinationRoot, file.relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    if ((await sha256File(destination)) !== file.sha256) {
      throw new Error(`Copied payload hash mismatch: ${file.relativePath}`);
    }
  }
}

async function atomicWrite(path: string, bytes: Uint8Array): Promise<void> {
  const temp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  await writeFile(temp, bytes, { flag: "wx" });
  try {
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await atomicWrite(path, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
}

async function writeFileExclusive(path: string, bytes: Uint8Array): Promise<void> {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readManifest(path: string): Promise<InstallationManifest> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<InstallationManifest>;
  if (
    parsed.schema !== 1 ||
    typeof parsed.id !== "string" ||
    parsed.index === undefined ||
    parsed.upstream === undefined ||
    !Array.isArray(parsed.files)
  ) {
    throw new Error("Invalid KD Hybrid installation manifest");
  }
  for (const file of parsed.files) {
    resolveInside(dirname(dirname(path)), file.path);
  }
  return parsed as InstallationManifest;
}

async function ensureAbsent(path: string): Promise<void> {
  if (await exists(path)) {
    throw new Error(`Destination already exists: ${path}`);
  }
}

async function exists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return false;
      }
      throw error;
    });
}

function escapeInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
