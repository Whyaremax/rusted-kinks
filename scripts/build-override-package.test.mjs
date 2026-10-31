// SPDX-License-Identifier: MPL-2.0

import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  publishOverrideOutputs,
  validateOverrideOutputPaths,
} from "./lib/override-output-safety.mjs";

const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("override package output safety", () => {
  it("rejects an output anywhere inside the selected app tree", async () => {
    const root = await temporaryRoot();
    const appRoot = path.join(root, "game", "resources", "app");
    const sourceIndex = path.join(appRoot, "index.html");
    const sourceBundle = path.join(appRoot, "out", "main.js");
    await mkdir(path.dirname(sourceBundle), { recursive: true });
    await Promise.all([
      writeFile(sourceIndex, "upstream index"),
      writeFile(sourceBundle, "upstream source"),
    ]);

    await assert.rejects(
      validateOverrideOutputPaths({
        appRoot,
        outputPath: path.join(appRoot, "releases", "override.zip"),
        protectedInputs: [sourceIndex, sourceBundle],
      }),
      /must be outside the selected app tree/u,
    );
  });

  it("rejects the checksum sidecar when it overlaps a protected input", async () => {
    const root = await temporaryRoot();
    const appRoot = path.join(root, "game", "resources", "app");
    const outputPath = path.join(root, "release", "override.zip");
    const protectedInput = `${outputPath}.sha256.txt`;
    await mkdir(appRoot, { recursive: true });

    await assert.rejects(
      validateOverrideOutputPaths({
        appRoot,
        outputPath,
        protectedInputs: [protectedInput],
      }),
      /checksum sidecar overlaps protected build input/u,
    );
  });

  it("leaves existing finals unchanged when final source validation fails", async () => {
    const root = await temporaryRoot();
    const outputPath = path.join(root, "release", "override.zip");
    const sidecarPath = `${outputPath}.sha256.txt`;
    await mkdir(path.dirname(outputPath), { recursive: true });
    await Promise.all([
      writeFile(outputPath, "previous archive"),
      writeFile(sidecarPath, "previous checksum"),
    ]);

    let sawPendingFiles = false;
    await assert.rejects(
      publishOverrideOutputs({
        outputPath,
        archiveBytes: Buffer.from("replacement archive"),
        sidecarText: "replacement checksum",
        revalidate: async () => {
          const entries = await readdir(path.dirname(outputPath));
          sawPendingFiles = entries.filter((entry) =>
            entry.endsWith(".pending"),
          ).length === 2;
          assert.equal(await readFile(outputPath, "utf8"), "previous archive");
          assert.equal(
            await readFile(sidecarPath, "utf8"),
            "previous checksum",
          );
          throw new Error("Source game files changed while building the override");
        },
      }),
      /Source game files changed/u,
    );

    assert.equal(sawPendingFiles, true);
    assert.equal(await readFile(outputPath, "utf8"), "previous archive");
    assert.equal(await readFile(sidecarPath, "utf8"), "previous checksum");
    assert.deepEqual(
      (await readdir(path.dirname(outputPath))).sort(),
      ["override.zip", "override.zip.sha256.txt"],
    );
  });

  it("rolls both finals back if the second atomic publish rename fails", async () => {
    const root = await temporaryRoot();
    const outputPath = path.join(root, "release", "override.zip");
    const sidecarPath = `${outputPath}.sha256.txt`;
    await mkdir(path.dirname(outputPath), { recursive: true });
    await Promise.all([
      writeFile(outputPath, "previous archive"),
      writeFile(sidecarPath, "previous checksum"),
    ]);

    let injected = false;
    await assert.rejects(
      publishOverrideOutputs({
        outputPath,
        archiveBytes: Buffer.from("replacement archive"),
        sidecarText: "replacement checksum",
        revalidate: async () => {},
        operations: {
          rename: async (source, destination) => {
            if (
              !injected &&
              source.endsWith(".pending") &&
              destination === sidecarPath
            ) {
              injected = true;
              const error = new Error("injected second rename failure");
              error.code = "EIO";
              throw error;
            }
            await rename(source, destination);
          },
        },
      }),
      /injected second rename failure/u,
    );

    assert.equal(injected, true);
    assert.equal(await readFile(outputPath, "utf8"), "previous archive");
    assert.equal(await readFile(sidecarPath, "utf8"), "previous checksum");
    assert.deepEqual(
      (await readdir(path.dirname(outputPath))).sort(),
      ["override.zip", "override.zip.sha256.txt"],
    );
  });
});

async function temporaryRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "kd-override-output-"));
  temporaryRoots.push(root);
  return root;
}
