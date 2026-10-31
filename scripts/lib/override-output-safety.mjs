// SPDX-License-Identifier: MPL-2.0

import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";

export async function validateOverrideOutputPaths({
  appRoot,
  outputPath,
  protectedInputs = [],
}) {
  const resolvedAppRoot = path.resolve(appRoot);
  const resolvedOutputPath = path.resolve(outputPath);
  const sidecarPath = `${resolvedOutputPath}.sha256.txt`;
  const appAliases = await pathAliases(resolvedAppRoot);
  const targets = [
    { label: "--output", path: resolvedOutputPath },
    { label: "--output checksum sidecar", path: sidecarPath },
  ];

  for (const target of targets) {
    await assertFileDestination(target);
    const targetAliases = await pathAliases(target.path);
    if (aliasesOverlap(targetAliases, appAliases)) {
      throw new Error(
        `${target.label} must be outside the selected app tree: ${target.path}`,
      );
    }

    for (const protectedInput of protectedInputs) {
      const resolvedInput = path.resolve(protectedInput);
      const inputAliases = await pathAliases(resolvedInput);
      if (aliasesOverlap(targetAliases, inputAliases)) {
        throw new Error(
          `${target.label} overlaps protected build input ${resolvedInput}: ${target.path}`,
        );
      }
    }
  }

  return { outputPath: resolvedOutputPath, sidecarPath };
}

export async function publishOverrideOutputs({
  outputPath,
  archiveBytes,
  sidecarText,
  revalidate,
  operations = {},
}) {
  if (typeof revalidate !== "function") {
    throw new TypeError("Override publication requires final revalidation");
  }

  const resolvedOutputPath = path.resolve(outputPath);
  const sidecarPath = `${resolvedOutputPath}.sha256.txt`;
  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });

  const token = `${process.pid}-${randomUUID()}`;
  const entries = [
    publicationEntry(resolvedOutputPath, archiveBytes, token),
    publicationEntry(sidecarPath, sidecarText, token),
  ];

  let failure;
  try {
    for (const entry of entries) {
      await writeExclusive(entry.temporaryPath, entry.data);
    }
    await revalidate();
    await replaceFinals(entries, operations.rename ?? rename);
  } catch (error) {
    failure = error;
  }

  const cleanupResults = await Promise.allSettled(
    entries.map((entry) =>
      rm(entry.temporaryPath, { force: true, recursive: false }),
    ),
  );
  const cleanupErrors = cleanupResults
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);
  if (failure !== undefined) {
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [failure, ...cleanupErrors],
        "Override publication failed and temporary-file cleanup was incomplete",
        { cause: failure },
      );
    }
    throw failure;
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "Override temporary-file cleanup was incomplete",
    );
  }

  return { outputPath: resolvedOutputPath, sidecarPath };
}

function publicationEntry(finalPath, data, token) {
  const basename = path.basename(finalPath);
  const directory = path.dirname(finalPath);
  return {
    backupPath: path.join(directory, `.${basename}.${token}.backup`),
    backedUp: false,
    data,
    finalPath,
    published: false,
    temporaryPath: path.join(directory, `.${basename}.${token}.pending`),
  };
}

async function writeExclusive(target, data) {
  const handle = await open(target, "wx", 0o600);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function replaceFinals(entries, renamePath) {
  try {
    for (const entry of entries) {
      try {
        await renamePath(entry.finalPath, entry.backupPath);
        entry.backedUp = true;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }

    for (const entry of entries) {
      await renamePath(entry.temporaryPath, entry.finalPath);
      entry.published = true;
    }
  } catch (error) {
    const rollbackErrors = await rollbackFinals(entries, renamePath);
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Override publication failed and rollback was incomplete",
        { cause: error },
      );
    }
    throw error;
  }

  const cleanupResults = await Promise.allSettled(
    entries
      .filter((entry) => entry.backedUp)
      .map((entry) =>
        rm(entry.backupPath, { force: true, recursive: false }),
      ),
  );
  const cleanupErrors = cleanupResults
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "Override backup-file cleanup was incomplete",
    );
  }
}

async function rollbackFinals(entries, renamePath) {
  const errors = [];
  for (const entry of [...entries].reverse()) {
    if (!entry.published) continue;
    try {
      await rm(entry.finalPath, { force: true, recursive: false });
      entry.published = false;
    } catch (error) {
      errors.push(error);
    }
  }
  for (const entry of entries) {
    if (!entry.backedUp) continue;
    try {
      await renamePath(entry.backupPath, entry.finalPath);
      entry.backedUp = false;
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

async function assertFileDestination(target) {
  try {
    const information = await lstat(target.path);
    if (!information.isFile() && !information.isSymbolicLink()) {
      throw new Error(`${target.label} is not a file path: ${target.path}`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
  }
}

async function pathAliases(target) {
  const resolved = path.resolve(target);
  const canonical = await canonicalPotentialPath(resolved);
  const aliases = new Map();
  for (const candidate of [resolved, canonical]) {
    aliases.set(comparisonKey(candidate), candidate);
  }
  return [...aliases.values()];
}

async function canonicalPotentialPath(target) {
  let current = path.resolve(target);
  const missingSegments = [];
  while (true) {
    try {
      const existing = await realpath(current);
      return path.join(existing, ...missingSegments.reverse());
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missingSegments.push(path.basename(current));
      current = parent;
    }
  }
}

function aliasesOverlap(leftAliases, rightAliases) {
  return leftAliases.some((left) =>
    rightAliases.some((right) => pathsOverlap(left, right)),
  );
}

function pathsOverlap(left, right) {
  return isWithin(left, right) || isWithin(right, left);
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function comparisonKey(value) {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
