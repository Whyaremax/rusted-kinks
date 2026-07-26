import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import vm from "node:vm";

import { matchFunctionSignature } from "../packages/runtime/dist/signatures.js";
import {
  KNOWN_UPSTREAM,
  UPSTREAM_5_4_92_FACADES
} from "../packages/runtime/dist/upstream.js";

const bundlePath = process.argv[2];
if (bundlePath === undefined) {
  throw new Error("Usage: node scripts/verify-upstream-signature.mjs <main.js>");
}

const bundle = await readFile(bundlePath, "utf8");
const appRoot = resolve(dirname(resolve(bundlePath)), "..");
const packageMetadata = JSON.parse(
  await readFile(join(appRoot, "package.json"), "utf8")
);
const menuText = await readFile(
  join(appRoot, "Screens", "MiniGame", "KinkyDungeon", "Text_KinkyDungeon.csv"),
  "utf8"
);
const menuVersion = /^KDVersionStr,"([^"]+)"\r?$/mu.exec(menuText)?.[1];
if (menuVersion === undefined) {
  throw new Error("Could not read KDVersionStr from the installed menu text");
}
const bundleSha256 = createHash("sha256").update(bundle).digest("hex");
const releaseMatched =
  menuVersion === KNOWN_UPSTREAM.gameVersion &&
  packageMetadata.version === KNOWN_UPSTREAM.packageVersion &&
  bundleSha256 === KNOWN_UPSTREAM.bundleSha256;
const start = bundle.indexOf("function KinkyDungeonFindPath(");
const end = bundle.indexOf("\nfunction KinkyDungeonGetPath(", start);
if (start < 0 || end < 0) {
  throw new Error("Could not isolate KinkyDungeonFindPath in the upstream bundle");
}

const functionSource = bundle.slice(start, end);
const upstreamFunction = vm.runInNewContext(`(${functionSource})`, Object.create(null));
if (typeof upstreamFunction !== "function") {
  throw new TypeError("Isolated upstream source did not evaluate to a function");
}

const facade = UPSTREAM_5_4_92_FACADES.find(
  (candidate) => candidate.globalName === "KinkyDungeonFindPath"
);
if (facade === undefined) {
  throw new Error("KD Hybrid pathfinding facade metadata is missing");
}
const match = matchFunctionSignature(upstreamFunction, facade.candidates);
console.log(
  JSON.stringify(
    {
      bundlePath,
      gameVersion: menuVersion,
      packageVersion: packageMetadata.version,
      bundleSha256,
      expected: {
        gameVersion: KNOWN_UPSTREAM.gameVersion,
        packageVersion: KNOWN_UPSTREAM.packageVersion,
        bundleSha256: KNOWN_UPSTREAM.bundleSha256
      },
      releaseMatched,
      name: match.signature.name,
      arity: match.signature.arity,
      normalizedHash: match.signature.normalizedHash,
      matched: match.matched,
      reason: match.reason
    },
    null,
    2
  )
);
if (!releaseMatched || !match.matched) {
  process.exitCode = 1;
}
