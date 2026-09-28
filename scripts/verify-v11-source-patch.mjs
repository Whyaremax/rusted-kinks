// SPDX-License-Identifier: MPL-2.0
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { applyKDSourcePatch } from "../packages/tools/dist/kd-source-patches.js";

const [cleanPath, expectedPath] = process.argv.slice(2);
if (!cleanPath || !expectedPath) {
  throw new TypeError("Usage: node scripts/verify-v11-source-patch.mjs <clean-bundle> <expected-bundle>");
}
const [clean, expected] = await Promise.all([
  readFile(resolve(cleanPath)),
  readFile(resolve(expectedPath)),
]);
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const result = applyKDSourcePatch(clean.toString("utf8"), sha256(clean));
if (result?.patch.id !== "kd-5.4.92-source-optimizations-v11") {
  throw new Error("The clean bundle did not select the v11 patch");
}
const actual = Buffer.from(result.text, "utf8");
if (!actual.equals(expected) || sha256(actual) !== result.patch.outputSha256) {
  throw new Error("The v11 patch did not produce the exact candidate bundle");
}
process.stdout.write(`${result.patch.id}: exact ${sha256(actual)} (${actual.length} bytes)\n`);
