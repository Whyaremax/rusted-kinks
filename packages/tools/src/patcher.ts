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
import {
  applyKDSourcePatch,
  findKDSourcePatch,
  type KDSourcePatch
} from "./kd-source-patches.js";
import { assertExactChild, portablePath, resolveInside } from "./paths.js";

export const KNOWN_BUNDLES = Object.freeze({
  "5.4.92": Object.freeze({
    packageVersion: "5.1.12",
    bundleSha256: "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4"
  })
});

export const BOOTSTRAP_SCRIPT_PATH = "kd-hybrid/kd-hybrid-bootstrap.js";
export const BRIDGE_MOD_FILE_NAME = "KDHybridBridge.zip";
export const BRIDGE_MOD_RELATIVE_PATH = `Mods/${BRIDGE_MOD_FILE_NAME}` as const;
export type PatcherPathfindingMode = "quality" | "fast" | "human";
export type PatcherTextureMode = "auto" | "original" | "full" | "mobile";

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
  readonly sourcePatch?: {
    readonly id: string;
    readonly path: "out/main.js";
    readonly backupPath: string;
    readonly originalSha256: string;
    readonly patchedSha256: string;
    readonly upstreamVersion: string;
    readonly sourceUrl: string;
    /**
     * Older manifests omit this field and represent an enabled source patch.
     * A retained sourcePatch with enabled=false keeps the verified original
     * backup available while the official bundle is selected.
     */
    readonly enabled?: boolean;
  };
  readonly files: readonly InstalledFile[];
  readonly modBridge?: InstalledFile & {
    readonly path: typeof BRIDGE_MOD_RELATIVE_PATH;
  };
  readonly settings?: {
    readonly pathfindingMode: PatcherPathfindingMode;
    readonly textureMode?: PatcherTextureMode;
    readonly sourceOptimizations?: boolean;
  };
}

export interface InstallOptions {
  readonly appRoot: string;
  readonly payloadRoot: string;
  readonly toolVersion: string;
  readonly upstreamVersion?: string;
  readonly allowUnknownBundle?: boolean;
  readonly sourceOptimizations?: boolean;
  readonly pathfindingMode?: PatcherPathfindingMode;
  readonly textureMode?: PatcherTextureMode;
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
const CONFIG_PATTERN =
  /<script>globalThis\.KDHybridBootstrapConfig=Object\.freeze\((\{[^<]*\})\);<\/script>/u;

export async function install(options: InstallOptions): Promise<PatcherStatus> {
  const pathfindingMode = validatePathfindingMode(
    options.pathfindingMode ?? "fast"
  );
  const textureMode = validateTextureMode(options.textureMode ?? "auto");
  const appRoot = resolve(options.appRoot);
  await validateLayout(appRoot);
  const payloadRoot = resolve(options.payloadRoot);
  const payloadFiles = await listPayloadFiles(payloadRoot);
  if (!payloadFiles.some((entry) => entry.relativePath === "kd-hybrid-bootstrap.js")) {
    throw new Error("Payload is missing kd-hybrid-bootstrap.js");
  }
  const bridgePayload = payloadFiles.find(
    (entry) => entry.relativePath === BRIDGE_MOD_FILE_NAME
  );
  if (bridgePayload === undefined) {
    throw new Error(`Payload is missing ${BRIDGE_MOD_FILE_NAME}`);
  }
  const existing = await status(appRoot);
  if (existing.state === "installed" && existing.manifest !== null) {
    let installed = existing;
    if (
      !installationMatchesPayload(
        existing.manifest,
        payloadFiles,
        bridgePayload,
        options.toolVersion
      )
    ) {
      installed = await upgradeInstalledPayload(
        appRoot,
        payloadRoot,
        payloadFiles,
        bridgePayload,
        options.toolVersion,
        existing.manifest
      );
    }
    if (
      options.sourceOptimizations !== undefined &&
      installed.manifest !== null &&
      manifestSourceOptimizationsEnabled(installed.manifest) !==
        options.sourceOptimizations
    ) {
      return updateConfiguration(appRoot, {
        sourceOptimizations: options.sourceOptimizations
      });
    }
    return installed;
  }
  if (existing.state !== "not-installed") {
    throw new Error(
      `Refusing install over ${existing.state} patcher state: ${existing.problems.join("; ")}`
    );
  }

  const bundlePath = resolveInside(appRoot, "out/main.js");
  const originalBundle = await readFile(bundlePath);
  const bundleSha256 = sha256Bytes(originalBundle);
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
  const availableSourcePatch = findKDSourcePatch(bundleSha256);
  const sourcePatchResult =
    options.sourceOptimizations === false || availableSourcePatch === undefined
      ? null
      : applyKDSourcePatch(originalBundle.toString("utf8"), bundleSha256);
  const sourceOptimizations = sourcePatchResult !== null;
  const patchedBundle =
    sourcePatchResult === null
      ? null
      : Buffer.from(sourcePatchResult.text, "utf8");
  if (
    sourcePatchResult !== null &&
    sha256Bytes(patchedBundle!) !== sourcePatchResult.patch.outputSha256
  ) {
    throw new Error(
      `Source patch ${sourcePatchResult.patch.id} produced an unexpected bundle hash`
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
    quality: "auto",
    pathfindingMode,
    sourceOptimizations,
    ...(textureMode === "auto"
      ? {}
      : { rendering: { textureMode } })
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
  const bundleBackupRelative = `${STATE_DIR}/backups/${id}/out-main.js`;
  const bundleBackupPath = resolveInside(appRoot, bundleBackupRelative);
  const destinationRoot = resolveInside(appRoot, DESTINATION_DIR);
  const bridgeModPath = resolveBridgeModPath(appRoot);
  assertExactChild(appRoot, destinationRoot, DESTINATION_DIR);
  await ensureAbsent(destinationRoot);
  await ensureAbsent(bridgeModPath);
  await mkdir(dirname(backupPath), { recursive: true });
  await writeFileExclusive(backupPath, originalIndex);
  if (availableSourcePatch !== undefined) {
    await writeFileExclusive(bundleBackupPath, originalBundle);
  }

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
    ...(availableSourcePatch === undefined
      ? {}
      : {
          sourcePatch: {
            id: availableSourcePatch.id,
            path: "out/main.js" as const,
            backupPath: portablePath(bundleBackupRelative),
            originalSha256: availableSourcePatch.inputSha256,
            patchedSha256: availableSourcePatch.outputSha256,
            upstreamVersion: availableSourcePatch.upstreamVersion,
            sourceUrl: availableSourcePatch.sourceUrl,
            enabled: sourceOptimizations
          }
        }),
    files: installedFiles,
    modBridge: {
      path: BRIDGE_MOD_RELATIVE_PATH,
      sha256: bridgePayload.sha256,
      bytes: bridgePayload.bytes
    },
    settings: {
      pathfindingMode,
      textureMode,
      sourceOptimizations
    }
  };

  await mkdir(stateRoot, { recursive: true });
  await atomicWriteJson(resolveInside(appRoot, PENDING_PATH), manifest);
  try {
    await copyPayload(payloadRoot, destinationRoot, payloadFiles);
    await mkdir(dirname(bridgeModPath), { recursive: true });
    await copyVerifiedFile(bridgePayload.sourcePath, bridgeModPath, bridgePayload.sha256);
    if (patchedBundle !== null) {
      await atomicWrite(bundlePath, patchedBundle);
    }
    await atomicWrite(indexPath, patchedIndex);
    await atomicWriteJson(resolveInside(appRoot, MANIFEST_PATH), manifest);
    await rm(resolveInside(appRoot, PENDING_PATH), { force: true });
  } catch (error) {
    // Pending state plus the original backup intentionally remain for repair.
    throw error;
  }
  return status(appRoot);
}

export async function updatePathfindingMode(
  appRootInput: string,
  modeInput: PatcherPathfindingMode
): Promise<PatcherStatus> {
  return updateConfiguration(appRootInput, {
    pathfindingMode: modeInput
  });
}

export async function updateTextureMode(
  appRootInput: string,
  modeInput: PatcherTextureMode
): Promise<PatcherStatus> {
  return updateConfiguration(appRootInput, {
    textureMode: modeInput
  });
}

export async function updateConfiguration(
  appRootInput: string,
  changes: {
    readonly pathfindingMode?: PatcherPathfindingMode;
    readonly textureMode?: PatcherTextureMode;
    readonly sourceOptimizations?: boolean;
  }
): Promise<PatcherStatus> {
  if (
    changes.pathfindingMode === undefined &&
    changes.textureMode === undefined &&
    changes.sourceOptimizations === undefined
  ) {
    throw new TypeError("At least one KD Hybrid setting is required");
  }
  if (
    changes.sourceOptimizations !== undefined &&
    typeof changes.sourceOptimizations !== "boolean"
  ) {
    throw new TypeError("Source optimizations must be true or false");
  }
  const appRoot = resolve(appRootInput);
  const current = await status(appRoot);
  if (current.state !== "installed" || current.manifest === null) {
    throw new Error(
      `Refusing settings update over ${current.state} patcher state: ${current.problems.join("; ")}`
    );
  }
  const indexPath = resolveInside(appRoot, current.manifest.index.path);
  const indexText = (await readFile(indexPath)).toString("utf8");
  const match = CONFIG_PATTERN.exec(indexText);
  if (match?.[1] === undefined) {
    throw new Error("Could not uniquely locate KD Hybrid bootstrap configuration");
  }
  const parsed = JSON.parse(match[1]) as Record<string, unknown>;
  const pathfindingMode = validatePathfindingMode(
    changes.pathfindingMode ??
      current.manifest.settings?.pathfindingMode ??
      readPathfindingMode(parsed)
  );
  const textureMode = validateTextureMode(
    changes.textureMode ??
      current.manifest.settings?.textureMode ??
      readTextureMode(parsed)
  );
  const currentSourceOptimizations =
    manifestSourceOptimizationsEnabled(current.manifest);
  const sourceOptimizations =
    changes.sourceOptimizations ?? currentSourceOptimizations;
  const bundlePath = resolveInside(
    appRoot,
    current.manifest.upstream.bundlePath
  );
  const previousBundle = await readFile(bundlePath);
  const expectedCurrentBundleSha256 = selectedBundleSha256(current.manifest);
  if (sha256Bytes(previousBundle) !== expectedCurrentBundleSha256) {
    throw new Error("out/main.js changed during KD Hybrid settings update");
  }
  const sourceSelection = await prepareSourceSelection(
    appRoot,
    current.manifest,
    previousBundle,
    sourceOptimizations
  );
  parsed.pathfindingMode = pathfindingMode;
  parsed.sourceOptimizations = sourceSelection.enabled;
  const rendering =
    typeof parsed.rendering === "object" &&
    parsed.rendering !== null &&
    !Array.isArray(parsed.rendering)
      ? { ...(parsed.rendering as Record<string, unknown>) }
      : {};
  if (textureMode === "auto") {
    delete rendering.textureMode;
  } else {
    rendering.textureMode = textureMode;
  }
  if (Object.keys(rendering).length === 0) {
    delete parsed.rendering;
  } else {
    parsed.rendering = rendering;
  }
  const replacement =
    `<script>globalThis.KDHybridBootstrapConfig=Object.freeze(` +
    `${escapeInlineJson(parsed)});</script>`;
  const updatedIndex = Buffer.from(indexText.replace(CONFIG_PATTERN, replacement), "utf8");
  const updatedManifestBase: InstallationManifest = {
    ...current.manifest,
    index: {
      ...current.manifest.index,
      patchedSha256: sha256Bytes(updatedIndex)
    },
    settings: {
      pathfindingMode,
      textureMode,
      sourceOptimizations: sourceSelection.enabled
    }
  };
  const manifest: InstallationManifest =
    sourceSelection.sourcePatch === undefined
      ? updatedManifestBase
      : {
          ...updatedManifestBase,
          sourcePatch: sourceSelection.sourcePatch
        };
  const manifestPath = resolveInside(appRoot, MANIFEST_PATH);
  const pendingPath = resolveInside(appRoot, PENDING_PATH);
  const previousIndex = Buffer.from(indexText, "utf8");
  const previousManifest = await readFile(manifestPath);
  await atomicWriteJson(pendingPath, manifest);
  try {
    if (!sourceSelection.bundle.equals(previousBundle)) {
      await atomicWrite(bundlePath, sourceSelection.bundle);
    }
    await atomicWrite(indexPath, updatedIndex);
    await atomicWriteJson(manifestPath, manifest);
    await rm(pendingPath, { force: true });
  } catch (error) {
    try {
      await atomicWrite(bundlePath, previousBundle);
      await atomicWrite(indexPath, previousIndex);
      await atomicWrite(manifestPath, previousManifest);
      await rm(pendingPath, { force: true });
    } catch {
      // Preserve the pending journal when rollback itself cannot finish.
    }
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
  if (pending) {
    problems.push("pending installation manifest exists");
  }
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
  if (manifest.modBridge !== undefined) {
    const bridgeModPath = resolveBridgeModPath(appRoot, manifest.modBridge.path);
    if (!(await exists(bridgeModPath))) {
      problems.push(`${manifest.modBridge.path} is missing`);
    } else if ((await sha256File(bridgeModPath)) !== manifest.modBridge.sha256) {
      problems.push(`${manifest.modBridge.path} was modified`);
    }
  }
  if (manifest.sourcePatch !== undefined) {
    const sourceBackupPath = resolveInside(
      appRoot,
      manifest.sourcePatch.backupPath
    );
    if (!(await exists(sourceBackupPath))) {
      problems.push("Original out/main.js backup is missing");
    } else if (
      (await sha256File(sourceBackupPath)) !==
      manifest.sourcePatch.originalSha256
    ) {
      problems.push(
        "Original out/main.js backup hash does not match the manifest"
      );
    }
  }
  const expectedBundleSha256 = selectedBundleSha256(manifest);
  if (
    (await sha256File(resolveInside(appRoot, manifest.upstream.bundlePath))) !==
    expectedBundleSha256
  ) {
    problems.push("out/main.js changed after KD Hybrid installation");
  }
  return Object.freeze({
    state: pending
      ? "incomplete"
      : problems.length === 0
        ? "installed"
        : "modified",
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
  let originalBundle: Buffer | null = null;
  if (manifest.sourcePatch !== undefined) {
    const bundleBackupPath = resolveInside(
      appRoot,
      manifest.sourcePatch.backupPath
    );
    originalBundle = await readFile(bundleBackupPath);
    if (sha256Bytes(originalBundle) !== manifest.sourcePatch.originalSha256) {
      throw new Error("Original out/main.js backup hash does not match the manifest");
    }
  }

  if (originalBundle !== null) {
    if (sha256Bytes(originalBundle) !== manifest.upstream.bundleSha256) {
      throw new Error(
        "Original out/main.js backup does not match the recorded upstream bundle"
      );
    }
  }

  const bundlePath = resolveInside(appRoot, manifest.upstream.bundlePath);
  const indexPath = resolveInside(appRoot, manifest.index.path);
  const previousBundle = await readFile(bundlePath);
  const previousIndex = await readFile(indexPath);
  const manifestPath = resolveInside(appRoot, MANIFEST_PATH);
  const previousManifest = await readFile(manifestPath);
  const destinationRoot = resolveInside(appRoot, DESTINATION_DIR);
  assertExactChild(appRoot, destinationRoot, DESTINATION_DIR);
  const historyPath = resolveInside(
    appRoot,
    `${STATE_DIR}/uninstalled/${manifest.id}/installation.json`
  );
  const stagingRoot = resolveInside(
    appRoot,
    `${STATE_DIR}/uninstall-staging/${manifest.id}`
  );
  const stagedPayload = resolveInside(
    appRoot,
    `${STATE_DIR}/uninstall-staging/${manifest.id}/payload`
  );
  const stagedBridge = resolveInside(
    appRoot,
    `${STATE_DIR}/uninstall-staging/${manifest.id}/${BRIDGE_MOD_FILE_NAME}`
  );
  const bridgeModPath =
    manifest.modBridge === undefined
      ? null
      : resolveBridgeModPath(appRoot, manifest.modBridge.path);
  await ensureAbsent(historyPath);
  await ensureAbsent(stagingRoot);
  const pendingPath = resolveInside(appRoot, PENDING_PATH);
  await atomicWriteJson(pendingPath, manifest);
  try {
    await mkdir(stagingRoot, { recursive: true });
    await rename(destinationRoot, stagedPayload);
    if (bridgeModPath !== null) {
      await rename(bridgeModPath, stagedBridge);
    }
    if (originalBundle !== null) {
      await atomicWrite(bundlePath, originalBundle);
    }
    await atomicWrite(indexPath, backup);
    await mkdir(dirname(historyPath), { recursive: true });
    await rename(manifestPath, historyPath);
    await rm(pendingPath, { force: true });
    try {
      await rm(stagingRoot, { recursive: true, force: true });
    } catch {
      // The committed uninstall remains safe if owned staging cleanup is
      // delayed by antivirus or another transient file handle.
    }
  } catch (error) {
    try {
      if (await exists(historyPath)) {
        await ensureAbsent(manifestPath);
        await rename(historyPath, manifestPath);
      } else if (!(await exists(manifestPath))) {
        await atomicWrite(manifestPath, previousManifest);
      }
      await atomicWrite(bundlePath, previousBundle);
      await atomicWrite(indexPath, previousIndex);
      if (await exists(stagedPayload)) {
        await ensureAbsent(destinationRoot);
        await rename(stagedPayload, destinationRoot);
      }
      if (bridgeModPath !== null && (await exists(stagedBridge))) {
        await ensureAbsent(bridgeModPath);
        await rename(stagedBridge, bridgeModPath);
      }
      await rm(stagingRoot, { recursive: true, force: true });
      await rm(pendingPath, { force: true });
    } catch {
      // Preserve the pending journal when rollback itself cannot finish.
    }
    throw error;
  }
  return status(appRoot);
}

interface PreparedSourceSelection {
  readonly enabled: boolean;
  readonly bundle: Buffer;
  readonly sourcePatch: InstallationManifest["sourcePatch"];
}

async function prepareSourceSelection(
  appRoot: string,
  manifest: InstallationManifest,
  currentBundle: Buffer,
  requestedEnabled: boolean
): Promise<PreparedSourceSelection> {
  const currentEnabled = manifestSourceOptimizationsEnabled(manifest);
  if (requestedEnabled === currentEnabled) {
    return {
      enabled: currentEnabled,
      bundle: currentBundle,
      sourcePatch:
        manifest.sourcePatch === undefined
          ? undefined
          : {
              ...manifest.sourcePatch,
              enabled: currentEnabled
            }
    };
  }

  if (!requestedEnabled) {
    if (manifest.sourcePatch === undefined) {
      throw new Error(
        "Cannot restore the official bundle because no source patch backup is recorded"
      );
    }
    const originalBundle = await readVerifiedSourceBackup(
      appRoot,
      manifest.sourcePatch
    );
    return {
      enabled: false,
      bundle: originalBundle,
      sourcePatch: {
        ...manifest.sourcePatch,
        enabled: false
      }
    };
  }

  const originalSha256 = sha256Bytes(currentBundle);
  const result = applyKDSourcePatch(
    currentBundle.toString("utf8"),
    originalSha256
  );
  if (result === null) {
    throw new Error(
      `Source optimizations require the exact verified KD 5.4.92 bundle; found ${originalSha256}`
    );
  }
  const patchedBundle = Buffer.from(result.text, "utf8");
  if (sha256Bytes(patchedBundle) !== result.patch.outputSha256) {
    throw new Error(
      `Source patch ${result.patch.id} produced an unexpected bundle hash`
    );
  }

  const backupRelative =
    manifest.sourcePatch?.backupPath ??
    portablePath(`${STATE_DIR}/backups/${manifest.id}/out-main.js`);
  if (manifest.sourcePatch !== undefined) {
    assertSourcePatchMetadata(manifest.sourcePatch, result.patch);
  }
  await preserveVerifiedSourceBackup(
    appRoot,
    backupRelative,
    currentBundle,
    result.patch.inputSha256
  );
  return {
    enabled: true,
    bundle: patchedBundle,
    sourcePatch: sourcePatchManifest(
      result.patch,
      backupRelative,
      true
    )
  };
}

function sourcePatchManifest(
  patch: KDSourcePatch,
  backupPath: string,
  enabled: boolean
): NonNullable<InstallationManifest["sourcePatch"]> {
  return {
    id: patch.id,
    path: "out/main.js",
    backupPath: portablePath(backupPath),
    originalSha256: patch.inputSha256,
    patchedSha256: patch.outputSha256,
    upstreamVersion: patch.upstreamVersion,
    sourceUrl: patch.sourceUrl,
    enabled
  };
}

function assertSourcePatchMetadata(
  manifestPatch: NonNullable<InstallationManifest["sourcePatch"]>,
  patch: KDSourcePatch
): void {
  if (
    manifestPatch.id !== patch.id ||
    manifestPatch.path !== "out/main.js" ||
    manifestPatch.originalSha256 !== patch.inputSha256 ||
    manifestPatch.patchedSha256 !== patch.outputSha256 ||
    manifestPatch.upstreamVersion !== patch.upstreamVersion
  ) {
    throw new Error(
      "Installed source patch metadata does not match the verified KD 5.4.92 patch"
    );
  }
}

async function preserveVerifiedSourceBackup(
  appRoot: string,
  backupRelative: string,
  originalBundle: Buffer,
  expectedSha256: string
): Promise<void> {
  const backupPath = resolveInside(appRoot, backupRelative);
  if (await exists(backupPath)) {
    const existing = await readFile(backupPath);
    if (sha256Bytes(existing) !== expectedSha256) {
      throw new Error(
        "Refusing to overwrite a mismatched original out/main.js backup"
      );
    }
    return;
  }
  await mkdir(dirname(backupPath), { recursive: true });
  await writeFileExclusive(backupPath, originalBundle);
  if ((await sha256File(backupPath)) !== expectedSha256) {
    throw new Error("Original out/main.js backup write did not preserve its hash");
  }
}

async function readVerifiedSourceBackup(
  appRoot: string,
  sourcePatch: NonNullable<InstallationManifest["sourcePatch"]>
): Promise<Buffer> {
  const bundleBackupPath = resolveInside(appRoot, sourcePatch.backupPath);
  const originalBundle = await readFile(bundleBackupPath);
  if (sha256Bytes(originalBundle) !== sourcePatch.originalSha256) {
    throw new Error("Original out/main.js backup hash does not match the manifest");
  }
  return originalBundle;
}

function manifestSourceOptimizationsEnabled(
  manifest: InstallationManifest
): boolean {
  return manifest.sourcePatch !== undefined &&
    manifest.sourcePatch.enabled !== false;
}

function selectedBundleSha256(manifest: InstallationManifest): string {
  return manifestSourceOptimizationsEnabled(manifest)
    ? manifest.sourcePatch!.patchedSha256
    : manifest.upstream.bundleSha256;
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

function validatePathfindingMode(
  mode: string
): PatcherPathfindingMode {
  if (mode !== "quality" && mode !== "fast" && mode !== "human") {
    throw new RangeError(`Unknown pathfinding mode ${mode}`);
  }
  return mode;
}

function validateTextureMode(mode: string): PatcherTextureMode {
  if (
    mode !== "auto" &&
    mode !== "original" &&
    mode !== "full" &&
    mode !== "mobile"
  ) {
    throw new RangeError(`Unknown texture mode ${mode}`);
  }
  return mode;
}

function readPathfindingMode(
  config: Readonly<Record<string, unknown>>
): PatcherPathfindingMode {
  return typeof config.pathfindingMode === "string"
    ? validatePathfindingMode(config.pathfindingMode)
    : "fast";
}

function readTextureMode(
  config: Readonly<Record<string, unknown>>
): PatcherTextureMode {
  const rendering =
    typeof config.rendering === "object" && config.rendering !== null
      ? (config.rendering as Record<string, unknown>)
      : null;
  return typeof rendering?.textureMode === "string"
    ? validateTextureMode(rendering.textureMode)
    : "auto";
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

function installationMatchesPayload(
  manifest: InstallationManifest,
  payloadFiles: readonly PayloadFile[],
  bridgePayload: PayloadFile,
  toolVersion: string
): boolean {
  if (
    manifest.toolVersion !== toolVersion ||
    manifest.modBridge?.path !== BRIDGE_MOD_RELATIVE_PATH ||
    manifest.modBridge.sha256 !== bridgePayload.sha256 ||
    manifest.modBridge.bytes !== bridgePayload.bytes ||
    manifest.files.length !== payloadFiles.length
  ) {
    return false;
  }
  const installed = new Map(manifest.files.map((file) => [file.path, file]));
  return payloadFiles.every((payload) => {
    const record = installed.get(
      portablePath(`${DESTINATION_DIR}/${payload.relativePath}`)
    );
    return record?.sha256 === payload.sha256 && record.bytes === payload.bytes;
  });
}

async function upgradeInstalledPayload(
  appRoot: string,
  payloadRoot: string,
  payloadFiles: readonly PayloadFile[],
  bridgePayload: PayloadFile,
  toolVersion: string,
  currentManifest: InstallationManifest
): Promise<PatcherStatus> {
  const destinationRoot = resolveInside(appRoot, DESTINATION_DIR);
  assertExactChild(appRoot, destinationRoot, DESTINATION_DIR);
  const bridgeModPath = resolveBridgeModPath(appRoot);
  if (
    currentManifest.modBridge === undefined &&
    (await exists(bridgeModPath))
  ) {
    throw new Error(`Destination already exists: ${bridgeModPath}`);
  }

  const previousManifestPath = resolveInside(appRoot, MANIFEST_PATH);
  const previousManifestBytes = await readFile(previousManifestPath);
  const previousFiles = new Map<string, Buffer>();
  for (const file of currentManifest.files) {
    previousFiles.set(file.path, await readFile(resolveInside(appRoot, file.path)));
  }
  const previousBridge =
    currentManifest.modBridge === undefined
      ? null
      : await readFile(
          resolveBridgeModPath(appRoot, currentManifest.modBridge.path)
        );
  const desiredPaths = new Set(
    payloadFiles.map((file) =>
      portablePath(`${DESTINATION_DIR}/${file.relativePath}`)
    )
  );
  const updatedManifest: InstallationManifest = {
    ...currentManifest,
    toolVersion,
    files: payloadFiles.map((file) => ({
      path: portablePath(`${DESTINATION_DIR}/${file.relativePath}`),
      sha256: file.sha256,
      bytes: file.bytes
    })),
    modBridge: {
      path: BRIDGE_MOD_RELATIVE_PATH,
      sha256: bridgePayload.sha256,
      bytes: bridgePayload.bytes
    }
  };
  const pendingPath = resolveInside(appRoot, PENDING_PATH);
  await atomicWriteJson(pendingPath, updatedManifest);
  try {
    for (const file of payloadFiles) {
      const source = resolveInside(payloadRoot, file.relativePath);
      if (resolve(source) !== resolve(file.sourcePath)) {
        throw new Error(`Payload changed during upgrade: ${file.relativePath}`);
      }
      const bytes = await readFile(source);
      if (sha256Bytes(bytes) !== file.sha256) {
        throw new Error(`Payload changed during upgrade: ${file.relativePath}`);
      }
      await atomicWrite(
        resolveInside(
          destinationRoot,
          portablePath(file.relativePath)
        ),
        bytes
      );
    }
    for (const file of currentManifest.files) {
      if (!desiredPaths.has(file.path)) {
        await rm(resolveInside(appRoot, file.path), { force: true });
      }
    }
    const bridgeBytes = await readFile(bridgePayload.sourcePath);
    if (sha256Bytes(bridgeBytes) !== bridgePayload.sha256) {
      throw new Error(`Payload changed during upgrade: ${BRIDGE_MOD_FILE_NAME}`);
    }
    await atomicWrite(bridgeModPath, bridgeBytes);
    await atomicWriteJson(previousManifestPath, updatedManifest);
    await rm(pendingPath, { force: true });
  } catch (error) {
    try {
      for (const file of payloadFiles) {
        const path = portablePath(
          `${DESTINATION_DIR}/${file.relativePath}`
        );
        const previous = previousFiles.get(path);
        const destination = resolveInside(appRoot, path);
        if (previous === undefined) {
          await rm(destination, { force: true });
        } else {
          await atomicWrite(destination, previous);
        }
      }
      for (const [path, bytes] of previousFiles) {
        if (!desiredPaths.has(path)) {
          await atomicWrite(resolveInside(appRoot, path), bytes);
        }
      }
      if (previousBridge === null) {
        await rm(bridgeModPath, { force: true });
      } else {
        await atomicWrite(bridgeModPath, previousBridge);
      }
      await atomicWrite(previousManifestPath, previousManifestBytes);
      await rm(pendingPath, { force: true });
    } catch {
      // Preserve the pending journal when rollback itself cannot finish.
    }
    throw error;
  }
  return status(appRoot);
}

async function copyVerifiedFile(
  source: string,
  destination: string,
  expectedSha256: string
): Promise<void> {
  await copyFile(source, destination);
  if ((await sha256File(destination)) !== expectedSha256) {
    throw new Error(`Copied file hash mismatch: ${destination}`);
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
  if (parsed.sourcePatch !== undefined) {
    if (
      parsed.sourcePatch.enabled !== undefined &&
      typeof parsed.sourcePatch.enabled !== "boolean"
    ) {
      throw new Error("Invalid KD Hybrid source selection in installation manifest");
    }
    resolveInside(dirname(dirname(path)), parsed.sourcePatch.path);
    resolveInside(dirname(dirname(path)), parsed.sourcePatch.backupPath);
  }
  if (
    parsed.settings?.sourceOptimizations !== undefined &&
    typeof parsed.settings.sourceOptimizations !== "boolean"
  ) {
    throw new Error("Invalid KD Hybrid source setting in installation manifest");
  }
  if (parsed.modBridge !== undefined) {
    if (
      parsed.modBridge.path !== BRIDGE_MOD_RELATIVE_PATH ||
      typeof parsed.modBridge.sha256 !== "string" ||
      typeof parsed.modBridge.bytes !== "number"
    ) {
      throw new Error("Invalid KD Hybrid bridge mod in installation manifest");
    }
    resolveBridgeModPath(dirname(dirname(path)), parsed.modBridge.path);
  }
  return parsed as InstallationManifest;
}

function resolveBridgeModPath(
  appRoot: string,
  relativePath: string = BRIDGE_MOD_RELATIVE_PATH
): string {
  if (relativePath !== BRIDGE_MOD_RELATIVE_PATH) {
    throw new Error(`Unexpected KD Hybrid bridge mod path: ${relativePath}`);
  }
  const normalizedAppRoot = resolve(appRoot);
  const resourcesRoot = dirname(normalizedAppRoot);
  if (
    basename(normalizedAppRoot).toLowerCase() !== "app" ||
    basename(resourcesRoot).toLowerCase() !== "resources"
  ) {
    throw new Error(
      `KD Hybrid bridge mod requires a resources/app layout: ${appRoot}`
    );
  }
  const gameRoot = dirname(resourcesRoot);
  const modsRoot = join(gameRoot, "Mods");
  const target = join(modsRoot, BRIDGE_MOD_FILE_NAME);
  if (dirname(target) !== modsRoot || basename(target) !== BRIDGE_MOD_FILE_NAME) {
    throw new Error(`Unsafe KD Hybrid bridge mod target: ${target}`);
  }
  return target;
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
