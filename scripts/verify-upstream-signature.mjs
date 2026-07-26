import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { matchFunctionSignature } from "../packages/runtime/dist/signatures.js";
import { UPSTREAM_5_1_12_FACADES } from "../packages/runtime/dist/upstream.js";

const bundlePath = process.argv[2];
if (bundlePath === undefined) {
  throw new Error("Usage: node scripts/verify-upstream-signature.mjs <main.js>");
}

const bundle = await readFile(bundlePath, "utf8");
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

const facade = UPSTREAM_5_1_12_FACADES.find(
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
if (!match.matched) {
  process.exitCode = 1;
}
