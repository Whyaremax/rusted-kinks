import { randomUUID } from "node:crypto";
import {
  copyFile,
  lstat,
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
  applyKDSourcePatchFiles,
  findKDSourcePatch,
  findKDSourcePatchById,
  type KDSourcePatch,
  type KDSourcePatchFile
} from "./kd-source-patches.js";
import { assertExactChild, portablePath, resolveInside } from "./paths.js";

export const KNOWN_BUNDLES = Object.freeze({
  "5.5.6": Object.freeze({packageVersion: "5.1.12", bundleSha256: "e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25"}),
  "5.4.92": Object.freeze({
    packageVersion: "5.1.12",
    bundleSha256:
      "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4"
  }),
  "5.5.1": Object.freeze({
    packageVersion: "5.1.12",
    bundleSha256:
      "60a85515783853653fd051936429494b8ef85024ff66b08134e68f9fe89248e0"
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
     * Multi-file transforms retain the legacy top-level out/main.js fields and
     * record every owned file here. Older schema-1 manifests omit this array.
     */
    readonly files?: readonly SourcePatchManifestFile[];
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

export interface SourcePatchManifestFile {
  readonly path: string;
  readonly backupPath: string;
  readonly originalSha256: string;
  readonly patchedSha256: string;
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
const META_TAG_PATTERN = /<meta\b[^>]*>/giu;
const LEGACY_MOBILE_META_NAME = "apple-mobile-web-app-capable";
const MODERN_MOBILE_META_NAME = "mobile-web-app-capable";

export async function install(options: InstallOptions): Promise<PatcherStatus> {
  const pathfindingMode = validatePathfindingMode(
    options.pathfindingMode ?? "fast"
  );
  const textureMode = validateTextureMode(options.textureMode ?? "auto");
  const appRoot = resolve(options.appRoot);
  await validateLayout(appRoot);
  const payloadRoot = resolve(options.payloadRoot);
  const payloadFiles = await listPayloadFiles(payloadRoot);
  if (
    !payloadFiles.some(
      (entry) => entry.relativePath === "kd-hybrid-bootstrap.js"
    )
  ) {
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
    if (needsActiveSourceMigration(existing.manifest)) {
      installed = await updateConfiguration(appRoot, {
        sourceOptimizations: true
      });
    }
    if (
      !installationMatchesPayload(
        installed.manifest!,
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
        installed.manifest!
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

  const bundlePath = await resolveSafeManagedPath(
    appRoot,
    "out/main.js",
    "file"
  );
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
  const sourceOptimizations =
    options.sourceOptimizations !== false && availableSourcePatch !== undefined;

  const indexPath = await resolveSafeManagedPath(appRoot, "index.html", "file");
  const originalIndex = await readFile(indexPath);
  const originalText = originalIndex.toString("utf8");
  if (originalText.includes(BOOTSTRAP_SCRIPT_PATH)) {
    throw new Error(
      "index.html already contains a KD Hybrid bootstrap without a manifest"
    );
  }
  const installText = ensureModernMobileMeta(originalText, known);
  const config = escapeInlineJson({
    upstreamVersion: detectedVersion ?? options.upstreamVersion ?? null,
    upstreamPackageVersion:
      detectedPackageVersion ?? requestedKnownBundle?.packageVersion ?? null,
    upstreamBundleSha256: bundleSha256,
    quality: "auto",
    pathfindingMode,
    sourceOptimizations,
    ...(textureMode === "auto" ? {} : { rendering: { textureMode } })
  });
  const injection =
    `<script>globalThis.KDHybridBootstrapConfig=Object.freeze(${config});</script>` +
    `<script src="./${BOOTSTRAP_SCRIPT_PATH}"></script>`;
  if (!SCRIPT_PATTERN.test(installText)) {
    throw new Error("Could not uniquely locate ./out/main.js in index.html");
  }
  const patchedText = installText.replace(SCRIPT_PATTERN, `${injection}$&`);
  const patchedIndex = Buffer.from(patchedText, "utf8");

  const id = `${new Date().toISOString().replaceAll(/[:.]/gu, "-")}-${randomUUID()}`;
  const stateRoot = await resolveSafeManagedPath(
    appRoot,
    STATE_DIR,
    "optional-directory"
  );
  const backupRelative = `${STATE_DIR}/backups/${id}/index.html`;
  const backupPath = await resolveSafeManagedPath(
    appRoot,
    backupRelative,
    "optional-file"
  );
  const initialSource =
    availableSourcePatch === undefined
      ? null
      : await prepareInitialSourcePatch(
          appRoot,
          availableSourcePatch,
          id,
          sourceOptimizations
        );
  const destinationRoot = await resolveSafeManagedPath(
    appRoot,
    DESTINATION_DIR,
    "optional-directory"
  );
  const bridgeModPath = await resolveSafeBridgeModPath(appRoot, false);
  assertExactChild(appRoot, destinationRoot, DESTINATION_DIR);
  await ensureAbsent(destinationRoot);
  await ensureAbsent(bridgeModPath);

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
        detectedPackageVersion ?? requestedKnownBundle?.packageVersion ?? null,
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
    ...(initialSource === null
      ? {}
      : {
          sourcePatch: sourcePatchManifest(
            initialSource.patch,
            initialSource.files,
            sourceOptimizations
          )
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
  const pendingPath = await resolveSafeManagedPath(
    appRoot,
    PENDING_PATH,
    "optional-file"
  );
  const manifestPath = await resolveSafeManagedPath(
    appRoot,
    MANIFEST_PATH,
    "optional-file"
  );
  await atomicWriteJson(pendingPath, manifest);
  try {
    await mkdir(dirname(backupPath), { recursive: true });
    await writeFileExclusive(backupPath, originalIndex);
    if (initialSource !== null) {
      for (const file of initialSource.files) {
        await preserveVerifiedSourceBackup(
          appRoot,
          file.backupPath,
          file.original,
          file.originalSha256,
          file.path
        );
      }
    }
    await copyPayload(payloadRoot, destinationRoot, payloadFiles);
    await mkdir(dirname(bridgeModPath), { recursive: true });
    await copyVerifiedFile(
      await assertNoSymlinkComponents(
        payloadRoot,
        bridgePayload.relativePath,
        "file"
      ),
      bridgeModPath,
      bridgePayload.sha256
    );
    if (initialSource !== null && sourceOptimizations) {
      for (const file of initialSource.files) {
        await atomicWrite(
          await resolveSafePatchFile(appRoot, file.path),
          file.patched
        );
      }
    }
    await atomicWrite(indexPath, patchedIndex);
    await atomicWriteJson(manifestPath, manifest);
    await rm(pendingPath, { force: true });
  } catch (error) {
    try {
      if (initialSource !== null && sourceOptimizations) {
        for (const file of initialSource.files) {
          await atomicWrite(
            await resolveSafePatchFile(appRoot, file.path),
            file.original
          );
        }
      }
      await atomicWrite(indexPath, originalIndex);
      await rm(manifestPath, { force: true });
      await rm(destinationRoot, { recursive: true, force: true });
      await rm(bridgeModPath, { force: true });
      await rm(pendingPath, { force: true });
      await rm(
        await resolveSafeManagedPath(
          appRoot,
          `${STATE_DIR}/backups/${id}`,
          "optional-directory"
        ),
        {
          recursive: true,
          force: true
        }
      );
    } catch {
      // Preserve the pending journal if rollback itself cannot finish.
    }
    throw error;
  }
  return status(appRoot);
}

export function ensureModernMobileMeta(
  indexText: string,
  knownBuild: boolean
): string {
  if (!knownBuild) return indexText;
  const tags = [...indexText.matchAll(META_TAG_PATTERN)];
  const modern = tags.filter(
    (match) => metaTagName(match[0]) === MODERN_MOBILE_META_NAME
  );
  if (modern.length > 0) return indexText;
  const legacy = tags.filter(
    (match) => metaTagName(match[0]) === LEGACY_MOBILE_META_NAME
  );
  if (legacy.length !== 1 || legacy[0]?.index === undefined) {
    throw new Error(
      "Known KD index has an ambiguous mobile web app capability structure"
    );
  }
  const match = legacy[0];
  const lineStart = indexText.lastIndexOf("\n", match.index - 1) + 1;
  const prefix = indexText.slice(lineStart, match.index);
  const indentation = /^[\t ]*$/u.test(prefix) ? prefix : "";
  const lineEnding = indexText.includes("\r\n") ? "\r\n" : "\n";
  const insertion =
    `${match[0]}${lineEnding}${indentation}` +
    '<meta name="mobile-web-app-capable" content="yes">';
  return (
    indexText.slice(0, match.index) +
    insertion +
    indexText.slice(match.index + match[0].length)
  );
}

function metaTagName(tag: string): string | null {
  const match = /\bname\s*=\s*(["'])(?<name>[^"']+)\1/iu.exec(tag);
  return match?.groups?.name?.toLowerCase() ?? null;
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
  const indexPath = await resolveSafeManagedPath(
    appRoot,
    current.manifest.index.path,
    "file"
  );
  const previousIndex = await readFile(indexPath);
  const indexText = ensureModernMobileMeta(
    previousIndex.toString("utf8"),
    current.manifest.upstream.known
  );
  const match = CONFIG_PATTERN.exec(indexText);
  if (match?.[1] === undefined) {
    throw new Error(
      "Could not uniquely locate KD Hybrid bootstrap configuration"
    );
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
  const currentSourceOptimizations = manifestSourceOptimizationsEnabled(
    current.manifest
  );
  const sourceOptimizations =
    changes.sourceOptimizations ?? currentSourceOptimizations;
  const sourceSelection = await prepareSourceSelection(
    appRoot,
    current.manifest,
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
  const updatedIndex = Buffer.from(
    indexText.replace(CONFIG_PATTERN, replacement),
    "utf8"
  );
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
  const manifestPath = await resolveSafeManagedPath(
    appRoot,
    MANIFEST_PATH,
    "file"
  );
  const pendingPath = await resolveSafeManagedPath(
    appRoot,
    PENDING_PATH,
    "optional-file"
  );
  const previousManifest = await readFile(manifestPath);
  await atomicWriteJson(pendingPath, manifest);
  const createdBackups: string[] = [];
  try {
    for (const backup of sourceSelection.backups) {
      if (!backup.create) continue;
      await mkdir(dirname(backup.path), { recursive: true });
      await writeFileExclusive(backup.path, backup.original);
      createdBackups.push(backup.path);
      if ((await sha256File(backup.path)) !== backup.expectedSha256) {
        throw new Error(
          `Original ${backup.sourcePath} backup write did not preserve its hash`
        );
      }
    }
    for (const file of sourceSelection.files) {
      if (!file.after.equals(file.before)) {
        await atomicWrite(
          await resolveSafePatchFile(appRoot, file.path),
          file.after
        );
      }
    }
    await atomicWrite(indexPath, updatedIndex);
    await atomicWriteJson(manifestPath, manifest);
    await rm(pendingPath, { force: true });
  } catch (error) {
    try {
      for (const file of sourceSelection.files) {
        await atomicWrite(
          await resolveSafePatchFile(appRoot, file.path),
          file.before
        );
      }
      await atomicWrite(indexPath, previousIndex);
      await atomicWrite(manifestPath, previousManifest);
      for (const backup of createdBackups) {
        await rm(backup, { force: true });
      }
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
  await resolveSafeManagedPath(appRoot, STATE_DIR, "optional-directory");
  await resolveSafeManagedPath(appRoot, DESTINATION_DIR, "optional-directory");
  const manifestPath = await resolveSafeManagedPath(
    appRoot,
    MANIFEST_PATH,
    "optional-file"
  );
  const pendingPath = await resolveSafeManagedPath(
    appRoot,
    PENDING_PATH,
    "optional-file"
  );
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
  const indexPath = await resolveSafeManagedPath(
    appRoot,
    manifest.index.path,
    "file"
  );
  if ((await sha256File(indexPath)) !== manifest.index.patchedSha256) {
    problems.push("index.html changed after KD Hybrid installation");
  }
  const indexBackupPath = await resolveSafeManagedPath(
    appRoot,
    manifest.index.backupPath,
    "optional-file"
  );
  if (!(await exists(indexBackupPath))) {
    problems.push("Original index.html backup is missing");
  } else if (
    (await sha256File(indexBackupPath)) !== manifest.index.originalSha256
  ) {
    problems.push(
      "Original index.html backup hash does not match the manifest"
    );
  }
  problems.push(...(await auditManagedPayload(appRoot, manifest.files)));
  if (manifest.modBridge !== undefined) {
    const bridgeModPath = await resolveSafeBridgeModPath(
      appRoot,
      false,
      manifest.modBridge.path
    );
    if (!(await exists(bridgeModPath))) {
      problems.push(`${manifest.modBridge.path} is missing`);
    } else if (
      (await sha256File(bridgeModPath)) !== manifest.modBridge.sha256
    ) {
      problems.push(`${manifest.modBridge.path} was modified`);
    }
  }
  if (manifest.sourcePatch !== undefined) {
    for (const file of manifestSourceFiles(manifest.sourcePatch)) {
      let sourceBackupPath: string;
      try {
        sourceBackupPath = await resolveSafePatchBackup(
          appRoot,
          file.backupPath,
          true
        );
      } catch {
        problems.push(`Original ${file.path} backup has an unsafe path`);
        continue;
      }
      if (!(await exists(sourceBackupPath))) {
        problems.push(`Original ${file.path} backup is missing`);
      } else if ((await sha256File(sourceBackupPath)) !== file.originalSha256) {
        problems.push(
          `Original ${file.path} backup hash does not match the manifest`
        );
      }
      let selectedPath: string;
      try {
        selectedPath = await resolveSafePatchFile(appRoot, file.path);
      } catch {
        problems.push(`${file.path} is unsafe or missing`);
        continue;
      }
      const expected = manifestSourceOptimizationsEnabled(manifest)
        ? file.patchedSha256
        : file.originalSha256;
      if ((await sha256File(selectedPath)) !== expected) {
        problems.push(`${file.path} changed after KD Hybrid installation`);
      }
    }
  } else if (
    (await sha256File(
      await resolveSafeManagedPath(
        appRoot,
        manifest.upstream.bundlePath,
        "file"
      )
    )) !== manifest.upstream.bundleSha256
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
  const backupPath = await resolveSafeManagedPath(
    appRoot,
    manifest.index.backupPath,
    "file"
  );
  const backup = await readFile(backupPath);
  if (sha256Bytes(backup) !== manifest.index.originalSha256) {
    throw new Error(
      "Original index.html backup hash does not match the manifest"
    );
  }
  const originalSourceFiles: Array<{
    path: string;
    original: Buffer;
    previous: Buffer;
  }> = [];
  if (manifest.sourcePatch !== undefined) {
    for (const file of manifestSourceFiles(manifest.sourcePatch)) {
      const backupPath = await resolveSafePatchBackup(
        appRoot,
        file.backupPath,
        true
      );
      const original = await readFile(backupPath);
      if (sha256Bytes(original) !== file.originalSha256) {
        throw new Error(
          `Original ${file.path} backup hash does not match the manifest`
        );
      }
      const target = await resolveSafePatchFile(appRoot, file.path);
      originalSourceFiles.push({
        path: file.path,
        original,
        previous: await readFile(target)
      });
    }
  }

  const originalBundle = originalSourceFiles.find(
    (file) => file.path === manifest.upstream.bundlePath
  )?.original;
  if (originalBundle !== undefined) {
    if (sha256Bytes(originalBundle) !== manifest.upstream.bundleSha256) {
      throw new Error(
        "Original out/main.js backup does not match the recorded upstream bundle"
      );
    }
  }

  const indexPath = await resolveSafeManagedPath(
    appRoot,
    manifest.index.path,
    "file"
  );
  const previousIndex = await readFile(indexPath);
  const manifestPath = await resolveSafeManagedPath(
    appRoot,
    MANIFEST_PATH,
    "file"
  );
  const previousManifest = await readFile(manifestPath);
  const destinationRoot = await resolveSafeManagedPath(
    appRoot,
    DESTINATION_DIR,
    "directory"
  );
  assertExactChild(appRoot, destinationRoot, DESTINATION_DIR);
  const historyPath = await resolveSafeManagedPath(
    appRoot,
    `${STATE_DIR}/uninstalled/${manifest.id}/installation.json`,
    "optional-file"
  );
  const stagingRoot = await resolveSafeManagedPath(
    appRoot,
    `${STATE_DIR}/uninstall-staging/${manifest.id}`,
    "optional-directory"
  );
  const stagedPayload = await resolveSafeManagedPath(
    appRoot,
    `${STATE_DIR}/uninstall-staging/${manifest.id}/payload`,
    "optional-directory"
  );
  const stagedBridge = await resolveSafeManagedPath(
    appRoot,
    `${STATE_DIR}/uninstall-staging/${manifest.id}/${BRIDGE_MOD_FILE_NAME}`,
    "optional-file"
  );
  const bridgeModPath =
    manifest.modBridge === undefined
      ? null
      : await resolveSafeBridgeModPath(appRoot, true, manifest.modBridge.path);
  await ensureAbsent(historyPath);
  await ensureAbsent(stagingRoot);
  const pendingPath = await resolveSafeManagedPath(
    appRoot,
    PENDING_PATH,
    "optional-file"
  );
  await atomicWriteJson(pendingPath, manifest);
  try {
    await mkdir(stagingRoot, { recursive: true });
    await rename(destinationRoot, stagedPayload);
    if (bridgeModPath !== null) {
      await rename(bridgeModPath, stagedBridge);
    }
    for (const file of originalSourceFiles) {
      await atomicWrite(
        await resolveSafePatchFile(appRoot, file.path),
        file.original
      );
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
      for (const file of originalSourceFiles) {
        await atomicWrite(
          await resolveSafePatchFile(appRoot, file.path),
          file.previous
        );
      }
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
  readonly files: readonly PreparedSourceFile[];
  readonly backups: readonly PreparedSourceBackup[];
  readonly sourcePatch: InstallationManifest["sourcePatch"];
}

interface PreparedSourceFile {
  readonly path: string;
  readonly before: Buffer;
  readonly after: Buffer;
}

interface PreparedSourceBackup {
  readonly path: string;
  readonly relativePath: string;
  readonly original: Buffer;
  readonly expectedSha256: string;
  readonly sourcePath: string;
  readonly create: boolean;
}

interface InitialSourceFile extends SourcePatchManifestFile {
  readonly original: Buffer;
  readonly patched: Buffer;
}

interface InitialSourcePatch {
  readonly patch: KDSourcePatch;
  readonly files: readonly InitialSourceFile[];
}

async function prepareInitialSourcePatch(
  appRoot: string,
  patch: KDSourcePatch,
  installationId: string,
  enabled: boolean
): Promise<InitialSourcePatch> {
  const originals = await readOfficialPatchInputs(appRoot, patch);
  const outputs = enabled
    ? applyPatchToInputs(patch, originals)
    : new Map<string, Buffer>();
  return {
    patch,
    files: patchFiles(patch).map((file) => ({
      path: file.path,
      backupPath: sourceBackupRelative(installationId, file.path),
      originalSha256: file.inputSha256,
      patchedSha256: file.outputSha256,
      original: originals.get(file.path)!,
      patched: outputs.get(file.path) ?? originals.get(file.path)!
    }))
  };
}

async function prepareSourceSelection(
  appRoot: string,
  manifest: InstallationManifest,
  requestedEnabled: boolean
): Promise<PreparedSourceSelection> {
  const currentEnabled = manifestSourceOptimizationsEnabled(manifest);
  if (!requestedEnabled && manifest.sourcePatch === undefined) {
    return {
      enabled: false,
      files: [],
      backups: [],
      sourcePatch: undefined
    };
  }

  if (!requestedEnabled) {
    const files: PreparedSourceFile[] = [];
    for (const record of manifestSourceFiles(manifest.sourcePatch!)) {
      const target = await resolveSafePatchFile(appRoot, record.path);
      const before = await readFile(target);
      const expected = currentEnabled
        ? record.patchedSha256
        : record.originalSha256;
      if (sha256Bytes(before) !== expected) {
        throw new Error(
          `${record.path} changed during KD Hybrid settings update`
        );
      }
      files.push({
        path: record.path,
        before,
        after: await readVerifiedSourceBackup(appRoot, record)
      });
    }
    return {
      enabled: false,
      files,
      backups: [],
      sourcePatch: {
        ...manifest.sourcePatch!,
        enabled: false
      }
    };
  }

  const oldRecords =
    manifest.sourcePatch === undefined
      ? []
      : manifestSourceFiles(manifest.sourcePatch);
  const oldByPath = new Map(oldRecords.map((file) => [file.path, file]));
  const primaryOriginal = oldByPath.has("out/main.js")
    ? await readVerifiedSourceBackup(appRoot, oldByPath.get("out/main.js")!)
    : await readFile(await resolveSafePatchFile(appRoot, "out/main.js"));
  const originalSha256 = sha256Bytes(primaryOriginal);
  const patch = findKDSourcePatch(originalSha256);
  if (patch === undefined) {
    throw new Error(
      `Source optimizations require an exact verified KD bundle; found ${originalSha256}`
    );
  }
  if (manifest.sourcePatch !== undefined) {
    const legacy = findKDSourcePatchById(manifest.sourcePatch.id);
    if (legacy === undefined) {
      throw new Error(
        `Installed source patch ${manifest.sourcePatch.id} is not a recognized migration source`
      );
    }
    assertSourcePatchMetadata(manifest.sourcePatch, legacy);
  }

  const originals = new Map<string, Buffer>();
  const beforeByPath = new Map<string, Buffer>();
  const activePaths = new Set(patchFiles(patch).map((file) => file.path));
  for (const file of patchFiles(patch)) {
    const target = await resolveSafePatchFile(appRoot, file.path);
    const before = await readFile(target);
    const old = oldByPath.get(file.path);
    const original =
      old === undefined ? before : await readVerifiedSourceBackup(appRoot, old);
    if (old === undefined && sha256Bytes(before) !== file.inputSha256) {
      throw new Error(
        `Refusing to patch modified auxiliary source file ${file.path}`
      );
    }
    if (sha256Bytes(original) !== file.inputSha256) {
      throw new Error(
        `Source patch ${patch.id} input hash mismatch for ${file.path}`
      );
    }
    if (old !== undefined) {
      const expected = currentEnabled ? old.patchedSha256 : old.originalSha256;
      if (sha256Bytes(before) !== expected) {
        throw new Error(
          `${file.path} changed during KD Hybrid settings update`
        );
      }
    }
    originals.set(file.path, original);
    beforeByPath.set(file.path, before);
  }
  const outputs = applyPatchToInputs(patch, originals);
  const manifestFiles: SourcePatchManifestFile[] = [];
  const backups: PreparedSourceBackup[] = [];
  for (const file of patchFiles(patch)) {
    const old = oldByPath.get(file.path);
    const backupPath =
      old?.backupPath ?? sourceBackupRelative(manifest.id, file.path);
    backups.push(
      await planVerifiedSourceBackup(
        appRoot,
        backupPath,
        originals.get(file.path)!,
        file.inputSha256,
        file.path
      )
    );
    manifestFiles.push({
      path: file.path,
      backupPath,
      originalSha256: file.inputSha256,
      patchedSha256: file.outputSha256
    });
  }

  const files: PreparedSourceFile[] = patchFiles(patch).map((file) => ({
    path: file.path,
    before: beforeByPath.get(file.path)!,
    after: outputs.get(file.path)!
  }));
  for (const old of oldRecords) {
    if (!activePaths.has(old.path)) {
      const target = await resolveSafePatchFile(appRoot, old.path);
      const before = await readFile(target);
      const expected = currentEnabled ? old.patchedSha256 : old.originalSha256;
      if (sha256Bytes(before) !== expected) {
        throw new Error(`${old.path} changed during KD Hybrid settings update`);
      }
      files.push({
        path: old.path,
        before,
        after: await readVerifiedSourceBackup(appRoot, old)
      });
    }
  }
  return {
    enabled: true,
    files,
    backups,
    sourcePatch: sourcePatchManifest(patch, manifestFiles, true)
  };
}

function sourcePatchManifest(
  patch: KDSourcePatch,
  files: readonly SourcePatchManifestFile[],
  enabled: boolean
): NonNullable<InstallationManifest["sourcePatch"]> {
  const primary = files.find((file) => file.path === "out/main.js");
  if (primary === undefined) {
    throw new Error(`Source patch ${patch.id} is missing out/main.js metadata`);
  }
  return {
    id: patch.id,
    path: "out/main.js",
    backupPath: portablePath(primary.backupPath),
    originalSha256: primary.originalSha256,
    patchedSha256: primary.patchedSha256,
    upstreamVersion: patch.upstreamVersion,
    sourceUrl: patch.sourceUrl,
    ...(files.length === 1
      ? {}
      : {
          files: Object.freeze(
            files.map(
              ({
                path,
                backupPath,
                originalSha256,
                patchedSha256
              }) =>
                Object.freeze({
                  path,
                  backupPath: portablePath(backupPath),
                  originalSha256,
                  patchedSha256
                })
            )
          )
        }),
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
    manifestPatch.upstreamVersion !== patch.upstreamVersion ||
    manifestPatch.sourceUrl !== patch.sourceUrl
  ) {
    throw new Error(
      "Installed source patch metadata does not match its verified catalog entry"
    );
  }
  const manifestFiles = manifestSourceFiles(manifestPatch);
  const catalogFiles = patchFiles(patch);
  if (
    manifestFiles.length !== catalogFiles.length ||
    catalogFiles.some((file) => {
      const installed = manifestFiles.find((entry) => entry.path === file.path);
      return (
        installed?.originalSha256 !== file.inputSha256 ||
        installed?.patchedSha256 !== file.outputSha256
      );
    })
  ) {
    throw new Error(
      "Installed source patch files do not match their verified catalog entry"
    );
  }
}

async function preserveVerifiedSourceBackup(
  appRoot: string,
  backupRelative: string,
  originalBytes: Buffer,
  expectedSha256: string,
  sourcePath: string
): Promise<void> {
  const backupPath = await resolveSafePatchBackup(
    appRoot,
    backupRelative,
    false
  );
  if (await exists(backupPath)) {
    const existing = await readFile(backupPath);
    if (sha256Bytes(existing) !== expectedSha256) {
      throw new Error(
        `Refusing to overwrite a mismatched original ${sourcePath} backup`
      );
    }
    return;
  }
  await mkdir(dirname(backupPath), { recursive: true });
  await writeFileExclusive(backupPath, originalBytes);
  if ((await sha256File(backupPath)) !== expectedSha256) {
    throw new Error(
      `Original ${sourcePath} backup write did not preserve its hash`
    );
  }
}

async function planVerifiedSourceBackup(
  appRoot: string,
  backupRelative: string,
  originalBytes: Buffer,
  expectedSha256: string,
  sourcePath: string
): Promise<PreparedSourceBackup> {
  const backupPath = await resolveSafePatchBackup(
    appRoot,
    backupRelative,
    false
  );
  if (await exists(backupPath)) {
    const info = await lstat(backupPath);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error(`Unsafe original ${sourcePath} backup`);
    }
    if ((await sha256File(backupPath)) !== expectedSha256) {
      throw new Error(
        `Refusing to overwrite a mismatched original ${sourcePath} backup`
      );
    }
    return {
      path: backupPath,
      relativePath: backupRelative,
      original: originalBytes,
      expectedSha256,
      sourcePath,
      create: false
    };
  }
  return {
    path: backupPath,
    relativePath: backupRelative,
    original: originalBytes,
    expectedSha256,
    sourcePath,
    create: true
  };
}

async function readVerifiedSourceBackup(
  appRoot: string,
  sourcePatch: SourcePatchManifestFile
): Promise<Buffer> {
  const backupPath = await resolveSafePatchBackup(
    appRoot,
    sourcePatch.backupPath,
    true
  );
  const original = await readFile(backupPath);
  if (sha256Bytes(original) !== sourcePatch.originalSha256) {
    throw new Error(
      `Original ${sourcePatch.path} backup hash does not match the manifest`
    );
  }
  return original;
}

function manifestSourceOptimizationsEnabled(
  manifest: InstallationManifest
): boolean {
  return (
    manifest.sourcePatch !== undefined && manifest.sourcePatch.enabled !== false
  );
}

function needsActiveSourceMigration(manifest: InstallationManifest): boolean {
  if (!manifestSourceOptimizationsEnabled(manifest)) return false;
  const active = findKDSourcePatch(manifest.sourcePatch!.originalSha256);
  if (active === undefined) return false;
  const activeFiles = patchFiles(active);
  const installedFiles = manifestSourceFiles(manifest.sourcePatch!);
  return (
    active.id !== manifest.sourcePatch!.id ||
    activeFiles.length !== installedFiles.length ||
    activeFiles.some(
      (file) =>
        installedFiles.find((installed) => installed.path === file.path)
          ?.patchedSha256 !== file.outputSha256
    )
  );
}

function patchFiles(patch: KDSourcePatch): readonly KDSourcePatchFile[] {
  return (
    patch.files ?? [
      {
        path: "out/main.js",
        inputSha256: patch.inputSha256,
        outputSha256: patch.outputSha256
      }
    ]
  );
}

async function readOfficialPatchInputs(
  appRoot: string,
  patch: KDSourcePatch
): Promise<Map<string, Buffer>> {
  const originals = new Map<string, Buffer>();
  for (const file of patchFiles(patch)) {
    const bytes = await readFile(
      await resolveSafePatchFile(appRoot, file.path)
    );
    if (sha256Bytes(bytes) !== file.inputSha256) {
      throw new Error(
        `Source patch ${patch.id} requires exact input ${file.path} ${file.inputSha256}`
      );
    }
    originals.set(file.path, bytes);
  }
  return originals;
}

function applyPatchToInputs(
  patch: KDSourcePatch,
  originals: ReadonlyMap<string, Buffer>
): Map<string, Buffer> {
  const files = patchFiles(patch);
  const outputs = new Map<string, Buffer>();
  if (files.length === 1) {
    const file = files[0]!;
    const original = originals.get(file.path);
    if (original === undefined) {
      throw new Error(`Source patch ${patch.id} input is missing ${file.path}`);
    }
    const result = applyKDSourcePatch(
      original.toString("utf8"),
      file.inputSha256
    );
    if (result === null || result.patch.id !== patch.id) {
      throw new Error(
        `Source patch ${patch.id} is not the active transformation`
      );
    }
    outputs.set(file.path, Buffer.from(result.text, "utf8"));
  } else {
    const result = applyKDSourcePatchFiles(
      files.map((file) => {
        const original = originals.get(file.path);
        if (original === undefined) {
          throw new Error(
            `Source patch ${patch.id} input is missing ${file.path}`
          );
        }
        return {
          path: file.path,
          text: original.toString("utf8"),
          sha256: file.inputSha256
        };
      })
    );
    if (result === null || result.patch.id !== patch.id) {
      throw new Error(
        `Source patch ${patch.id} is not the active transformation`
      );
    }
    for (const output of result.files) {
      outputs.set(output.path, Buffer.from(output.text, "utf8"));
    }
  }
  for (const file of files) {
    const output = outputs.get(file.path);
    if (output === undefined || sha256Bytes(output) !== file.outputSha256) {
      throw new Error(
        `Source patch ${patch.id} produced an unexpected hash for ${file.path}`
      );
    }
  }
  return outputs;
}

function manifestSourceFiles(
  sourcePatch: NonNullable<InstallationManifest["sourcePatch"]>
): readonly SourcePatchManifestFile[] {
  if (sourcePatch.files !== undefined && sourcePatch.files.length === 0) {
    throw new Error("Source patch manifest explicitly contains no files");
  }
  const files = sourcePatch.files ?? [
    {
      path: sourcePatch.path,
      backupPath: sourcePatch.backupPath,
      originalSha256: sourcePatch.originalSha256,
      patchedSha256: sourcePatch.patchedSha256
    }
  ];
  const paths = new Set<string>();
  for (const file of files) {
    validatePatchRelativePath(file.path, "source manifest path");
    validatePatchRelativePath(file.backupPath, "source backup path");
    if (paths.has(file.path)) {
      throw new Error(`Duplicate source manifest path: ${file.path}`);
    }
    paths.add(file.path);
    if (
      !/^[0-9a-f]{64}$/u.test(file.originalSha256) ||
      !/^[0-9a-f]{64}$/u.test(file.patchedSha256) ||
      file.originalSha256 === file.patchedSha256
    ) {
      throw new Error(`Invalid source manifest hashes for ${file.path}`);
    }
  }
  const primary = files.find((file) => file.path === "out/main.js");
  if (
    primary === undefined ||
    primary.backupPath !== sourcePatch.backupPath ||
    primary.originalSha256 !== sourcePatch.originalSha256 ||
    primary.patchedSha256 !== sourcePatch.patchedSha256
  ) {
    throw new Error("Source manifest primary metadata is inconsistent");
  }
  return files;
}

function sourceBackupRelative(installationId: string, path: string): string {
  validatePatchRelativePath(path, "source patch path");
  return portablePath(
    path === "out/main.js"
      ? `${STATE_DIR}/backups/${installationId}/out-main.js`
      : `${STATE_DIR}/backups/${installationId}/source/${path}`
  );
}

function validatePatchRelativePath(path: string, label: string): void {
  if (
    path.length === 0 ||
    path.includes("\\") ||
    path.includes(":") ||
    path.startsWith("/") ||
    path.endsWith("/") ||
    path
      .split("/")
      .some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe ${label}: ${path}`);
  }
}

async function resolveSafePatchFile(
  appRoot: string,
  relativePath: string
): Promise<string> {
  validatePatchRelativePath(relativePath, "source patch path");
  if (relativePath === STATE_DIR || relativePath.startsWith(`${STATE_DIR}/`)) {
    throw new Error(`Unsafe source patch path: ${relativePath}`);
  }
  return assertNoSymlinkComponents(appRoot, relativePath, "file");
}

async function resolveSafePatchBackup(
  appRoot: string,
  relativePath: string,
  requireFile: boolean
): Promise<string> {
  validatePatchRelativePath(relativePath, "source backup path");
  if (!relativePath.startsWith(`${STATE_DIR}/backups/`)) {
    throw new Error(`Unsafe source backup path: ${relativePath}`);
  }
  return assertNoSymlinkComponents(
    appRoot,
    relativePath,
    requireFile ? "file" : "optional-file"
  );
}

type ManagedPathRequirement =
  "file" | "directory" | "optional-file" | "optional-directory";

async function assertNoSymlinkComponents(
  root: string,
  relativePath: string,
  requirement: ManagedPathRequirement
): Promise<string> {
  const target = resolveInside(root, relativePath);
  const parts = relativePath.split("/");
  let current = resolve(root);
  let missing = false;
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]!);
    if (missing) continue;
    const info = await lstat(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (info === null) {
      missing = true;
      continue;
    }
    if (info.isSymbolicLink()) {
      throw new Error(
        `Symbolic links are forbidden in patch paths: ${relativePath}`
      );
    }
    const isLast = index === parts.length - 1;
    if (!isLast && !info.isDirectory()) {
      throw new Error(`Patch path parent is not a directory: ${relativePath}`);
    }
    if (isLast) {
      const requiresFile =
        requirement === "file" || requirement === "optional-file";
      const requiresDirectory =
        requirement === "directory" || requirement === "optional-directory";
      if (requiresFile && !info.isFile()) {
        throw new Error(`Managed target is not a file: ${relativePath}`);
      }
      if (requiresDirectory && !info.isDirectory()) {
        throw new Error(`Managed target is not a directory: ${relativePath}`);
      }
    }
  }
  if (missing && (requirement === "file" || requirement === "directory")) {
    throw new Error(`Managed target is missing: ${relativePath}`);
  }
  return target;
}

async function resolveSafeManagedPath(
  appRoot: string,
  relativePath: string,
  requirement: ManagedPathRequirement
): Promise<string> {
  validatePatchRelativePath(relativePath, "managed path");
  return assertNoSymlinkComponents(appRoot, relativePath, requirement);
}

async function validateLayout(appRoot: string): Promise<void> {
  const info = await lstat(appRoot).catch(() => null);
  if (info?.isDirectory() !== true || info.isSymbolicLink()) {
    throw new Error(`App root does not exist: ${appRoot}`);
  }
  for (const required of ["index.html", "out/main.js"]) {
    try {
      await resolveSafeManagedPath(appRoot, required, "file");
    } catch {
      throw new Error(
        `Target is not a KD resources/app directory: missing ${required}`
      );
    }
  }
}

function validatePathfindingMode(mode: string): PatcherPathfindingMode {
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

async function auditManagedPayload(
  appRoot: string,
  records: readonly InstalledFile[]
): Promise<readonly string[]> {
  const problems: string[] = [];
  const expected = new Map(records.map((record) => [record.path, record]));
  const expectedDirectories = new Set<string>([DESTINATION_DIR]);
  for (const record of records) {
    const parts = record.path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      expectedDirectories.add(parts.slice(0, index).join("/"));
    }
  }
  const root = await resolveSafeManagedPath(
    appRoot,
    DESTINATION_DIR,
    "optional-directory"
  );
  if (!(await exists(root))) {
    return records.map((record) => `${record.path} is missing`);
  }

  const actualFiles = new Map<string, { path: string; bytes: number }>();
  const walk = async (directory: string, relativeDirectory: string) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const target = join(directory, entry.name);
      const relativePath = portablePath(`${relativeDirectory}/${entry.name}`);
      const info = await lstat(target);
      if (entry.isSymbolicLink() || info.isSymbolicLink()) {
        throw new Error(
          `Managed payload symlinks are forbidden: ${relativePath}`
        );
      }
      if (entry.isDirectory() && info.isDirectory()) {
        if (!expectedDirectories.has(relativePath)) {
          problems.push(`${relativePath} is an unexpected payload directory`);
        }
        await walk(target, relativePath);
      } else if (entry.isFile() && info.isFile()) {
        actualFiles.set(relativePath, { path: target, bytes: info.size });
      } else {
        throw new Error(`Unsupported managed payload entry: ${relativePath}`);
      }
    }
  };
  await walk(root, DESTINATION_DIR);

  for (const [relativePath, actual] of actualFiles) {
    const record = expected.get(relativePath);
    if (record === undefined) {
      problems.push(
        `${relativePath} is not recorded in the installation manifest`
      );
    } else if (
      actual.bytes !== record.bytes ||
      (await sha256File(actual.path)) !== record.sha256
    ) {
      problems.push(`${relativePath} was modified`);
    }
  }
  for (const record of records) {
    if (!actualFiles.has(record.path)) {
      problems.push(`${record.path} is missing`);
    }
  }
  return problems;
}

async function listPayloadFiles(root: string): Promise<readonly PayloadFile[]> {
  const rootInfo = await lstat(root).catch(() => null);
  if (rootInfo?.isDirectory() !== true || rootInfo.isSymbolicLink()) {
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
    const source = await assertNoSymlinkComponents(
      payloadRoot,
      file.relativePath,
      "file"
    );
    if (resolve(source) !== resolve(file.sourcePath)) {
      throw new Error(`Payload changed during install: ${file.relativePath}`);
    }
    const destination = await assertNoSymlinkComponents(
      destinationRoot,
      file.relativePath,
      "optional-file"
    );
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
  const destinationRoot = await resolveSafeManagedPath(
    appRoot,
    DESTINATION_DIR,
    "directory"
  );
  assertExactChild(appRoot, destinationRoot, DESTINATION_DIR);
  const bridgeModPath = await resolveSafeBridgeModPath(appRoot, false);
  if (
    currentManifest.modBridge === undefined &&
    (await exists(bridgeModPath))
  ) {
    throw new Error(`Destination already exists: ${bridgeModPath}`);
  }

  const previousManifestPath = await resolveSafeManagedPath(
    appRoot,
    MANIFEST_PATH,
    "file"
  );
  const previousManifestBytes = await readFile(previousManifestPath);
  const previousFiles = new Map<string, Buffer>();
  for (const file of currentManifest.files) {
    previousFiles.set(
      file.path,
      await readFile(await resolveSafeManagedPath(appRoot, file.path, "file"))
    );
  }
  const previousBridge =
    currentManifest.modBridge === undefined
      ? null
      : await readFile(
          await resolveSafeBridgeModPath(
            appRoot,
            true,
            currentManifest.modBridge.path
          )
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
  const pendingPath = await resolveSafeManagedPath(
    appRoot,
    PENDING_PATH,
    "optional-file"
  );
  await atomicWriteJson(pendingPath, updatedManifest);
  try {
    for (const file of payloadFiles) {
      const source = await assertNoSymlinkComponents(
        payloadRoot,
        file.relativePath,
        "file"
      );
      if (resolve(source) !== resolve(file.sourcePath)) {
        throw new Error(`Payload changed during upgrade: ${file.relativePath}`);
      }
      const bytes = await readFile(source);
      if (sha256Bytes(bytes) !== file.sha256) {
        throw new Error(`Payload changed during upgrade: ${file.relativePath}`);
      }
      await atomicWrite(
        await assertNoSymlinkComponents(
          destinationRoot,
          portablePath(file.relativePath),
          "optional-file"
        ),
        bytes
      );
    }
    for (const file of currentManifest.files) {
      if (!desiredPaths.has(file.path)) {
        await rm(await resolveSafeManagedPath(appRoot, file.path, "file"), {
          force: true
        });
      }
    }
    const bridgeBytes = await readFile(
      await assertNoSymlinkComponents(
        payloadRoot,
        bridgePayload.relativePath,
        "file"
      )
    );
    if (sha256Bytes(bridgeBytes) !== bridgePayload.sha256) {
      throw new Error(
        `Payload changed during upgrade: ${BRIDGE_MOD_FILE_NAME}`
      );
    }
    await atomicWrite(bridgeModPath, bridgeBytes);
    await atomicWriteJson(previousManifestPath, updatedManifest);
    await rm(pendingPath, { force: true });
  } catch (error) {
    try {
      for (const file of payloadFiles) {
        const path = portablePath(`${DESTINATION_DIR}/${file.relativePath}`);
        const previous = previousFiles.get(path);
        const destination = await resolveSafeManagedPath(
          appRoot,
          path,
          "optional-file"
        );
        if (previous === undefined) {
          await rm(destination, { force: true });
        } else {
          await atomicWrite(destination, previous);
        }
      }
      for (const [path, bytes] of previousFiles) {
        if (!desiredPaths.has(path)) {
          await atomicWrite(
            await resolveSafeManagedPath(appRoot, path, "optional-file"),
            bytes
          );
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
  await atomicWrite(
    path,
    Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
  );
}

async function writeFileExclusive(
  path: string,
  bytes: Uint8Array
): Promise<void> {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readManifest(path: string): Promise<InstallationManifest> {
  const value = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!isRecord(value)) {
    throw new Error("Invalid KD Hybrid installation manifest");
  }
  const parsed = value as Record<string, unknown>;
  const id = parsed.id;
  if (
    parsed.schema !== 1 ||
    typeof id !== "string" ||
    !isSafeInstallationId(id) ||
    parsed.appRoot !== "." ||
    typeof parsed.toolVersion !== "string" ||
    typeof parsed.installedAt !== "string" ||
    !isRecord(parsed.index) ||
    !isRecord(parsed.upstream) ||
    !Array.isArray(parsed.files)
  ) {
    throw new Error("Invalid KD Hybrid installation manifest");
  }

  const upstream = parsed.upstream;
  if (
    !isNullableString(upstream.version) ||
    !isNullableString(upstream.packageVersion) ||
    upstream.bundlePath !== "out/main.js" ||
    !isSha256(upstream.bundleSha256) ||
    typeof upstream.known !== "boolean"
  ) {
    throw new Error(
      "Invalid KD Hybrid upstream metadata in installation manifest"
    );
  }

  const index = parsed.index;
  const expectedIndexBackup = portablePath(
    `${STATE_DIR}/backups/${id}/index.html`
  );
  if (
    index.path !== "index.html" ||
    index.backupPath !== expectedIndexBackup ||
    !isSha256(index.originalSha256) ||
    !isSha256(index.patchedSha256)
  ) {
    throw new Error(
      "Invalid KD Hybrid index metadata in installation manifest"
    );
  }

  const payloadPaths = new Set<string>();
  if (parsed.files.length === 0) {
    throw new Error("KD Hybrid installation manifest has no payload files");
  }
  for (const value of parsed.files) {
    if (!isRecord(value)) {
      throw new Error("Invalid file entry in installation manifest");
    }
    const relativePath = value.path;
    const normalizedKey =
      typeof relativePath === "string" ? relativePath.toLowerCase() : "";
    if (
      typeof relativePath !== "string" ||
      !isManagedPayloadPath(relativePath) ||
      payloadPaths.has(normalizedKey) ||
      !isSha256(value.sha256) ||
      !isSafeByteCount(value.bytes)
    ) {
      throw new Error("Invalid file entry in installation manifest");
    }
    payloadPaths.add(normalizedKey);
  }

  const sourcePatchValue = parsed.sourcePatch;
  if (sourcePatchValue !== undefined) {
    if (!isRecord(sourcePatchValue)) {
      throw new Error("Invalid source patch in installation manifest");
    }
    if (
      typeof sourcePatchValue.id !== "string" ||
      sourcePatchValue.path !== "out/main.js" ||
      typeof sourcePatchValue.backupPath !== "string" ||
      !isSha256(sourcePatchValue.originalSha256) ||
      !isSha256(sourcePatchValue.patchedSha256) ||
      typeof sourcePatchValue.upstreamVersion !== "string" ||
      typeof sourcePatchValue.sourceUrl !== "string" ||
      (sourcePatchValue.enabled !== undefined &&
        typeof sourcePatchValue.enabled !== "boolean") ||
      (sourcePatchValue.files !== undefined &&
        (!Array.isArray(sourcePatchValue.files) ||
          sourcePatchValue.files.length === 0))
    ) {
      throw new Error("Invalid source patch in installation manifest");
    }
    const sourcePatch = sourcePatchValue as unknown as NonNullable<
      InstallationManifest["sourcePatch"]
    >;
    const catalogPatch = findKDSourcePatchById(sourcePatch.id);
    if (catalogPatch === undefined) {
      throw new Error(
        `Installed source patch ${sourcePatch.id} is not in the retained catalog`
      );
    }
    assertSourcePatchMetadata(sourcePatch, catalogPatch);
    const sourceFiles = manifestSourceFiles(sourcePatch);
    for (const file of sourceFiles) {
      if (
        file.backupPath !== sourceBackupRelative(id, file.path) ||
        !isSha256(file.originalSha256) ||
        !isSha256(file.patchedSha256)
      ) {
        throw new Error(
          `Installed source patch backup metadata is invalid for ${file.path}`
        );
      }
    }
    const primary = sourceFiles.find((file) => file.path === "out/main.js")!;
    if (primary.originalSha256 !== upstream.bundleSha256) {
      throw new Error(
        "Installed source patch original does not match the upstream bundle"
      );
    }
  }

  const settings = parsed.settings;
  if (settings !== undefined) {
    if (
      !isRecord(settings) ||
      (settings.pathfindingMode !== undefined &&
        (typeof settings.pathfindingMode !== "string" ||
          !["quality", "fast", "human"].includes(settings.pathfindingMode))) ||
      (settings.textureMode !== undefined &&
        (typeof settings.textureMode !== "string" ||
          !["auto", "original", "full", "mobile"].includes(
            settings.textureMode
          ))) ||
      (settings.sourceOptimizations !== undefined &&
        typeof settings.sourceOptimizations !== "boolean")
    ) {
      throw new Error("Invalid KD Hybrid settings in installation manifest");
    }
    if (
      typeof settings.sourceOptimizations === "boolean" &&
      settings.sourceOptimizations !==
        (sourcePatchValue !== undefined && sourcePatchValue.enabled !== false)
    ) {
      throw new Error(
        "KD Hybrid source setting does not match the installed source selection"
      );
    }
  }

  const modBridge = parsed.modBridge;
  if (modBridge !== undefined) {
    if (
      !isRecord(modBridge) ||
      modBridge.path !== BRIDGE_MOD_RELATIVE_PATH ||
      !isSha256(modBridge.sha256) ||
      !isSafeByteCount(modBridge.bytes)
    ) {
      throw new Error("Invalid KD Hybrid bridge mod in installation manifest");
    }
    resolveBridgeModPath(dirname(dirname(path)), modBridge.path);
  }
  return parsed as unknown as InstallationManifest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

function isSafeByteCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSafeInstallationId(id: string): boolean {
  return (
    id !== "." &&
    id !== ".." &&
    id.length <= 128 &&
    /^[0-9A-Za-z][0-9A-Za-z._-]*$/u.test(id)
  );
}

function isManagedPayloadPath(path: string): boolean {
  try {
    validatePatchRelativePath(path, "payload path");
  } catch {
    return false;
  }
  return (
    portablePath(path) === path &&
    path.startsWith(`${DESTINATION_DIR}/`) &&
    path.length > DESTINATION_DIR.length + 1
  );
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
  if (
    dirname(target) !== modsRoot ||
    basename(target) !== BRIDGE_MOD_FILE_NAME
  ) {
    throw new Error(`Unsafe KD Hybrid bridge mod target: ${target}`);
  }
  return target;
}

async function resolveSafeBridgeModPath(
  appRoot: string,
  requireFile: boolean,
  relativePath: string = BRIDGE_MOD_RELATIVE_PATH
): Promise<string> {
  const target = resolveBridgeModPath(appRoot, relativePath);
  const gameRoot = dirname(dirname(resolve(appRoot)));
  const checked = await assertNoSymlinkComponents(
    gameRoot,
    relativePath,
    requireFile ? "file" : "optional-file"
  );
  if (resolve(checked) !== resolve(target)) {
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
  return lstat(path)
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
