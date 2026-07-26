import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const script = await readFile(resolve(root, "dist/mod/KDHybrid.js"), "utf8");
const wasm = await readFile(resolve(root, "dist/mod/wasm/kd_hybrid_core_bg.wasm"));
const wasmUrl = `data:application/wasm;base64,${wasm.toString("base64")}`;
const context = vm.createContext({
  KDModFiles: {
    "./wasm/kd_hybrid_core_bg.wasm": wasmUrl
  },
  KinkyDungeonRootDirectory: "./",
  WebAssembly,
  fetch,
  URL,
  Request,
  Response,
  TextDecoder,
  TextEncoder,
  FinalizationRegistry,
  setTimeout,
  clearTimeout,
  console
});

vm.runInContext(script, context, {
  filename: "KDHybrid.js",
  timeout: 5_000
});

const deadline = Date.now() + 5_000;
while (Date.now() < deadline) {
  const status = context.KDHybrid?.status?.();
  if (status?.initialized === true && status.nativeAvailable === true) {
    process.stdout.write(
      `Normal-mod smoke passed: runtime ${status.version}, ABI ${status.abiVersion}.\n`
    );
    process.exitCode = 0;
    break;
  }
  await new Promise((resolveWait) => setTimeout(resolveWait, 25));
}
if (process.exitCode !== 0) {
  throw new Error(
    `Normal-mod bundle did not initialize: ${JSON.stringify(
      context.KDHybrid?.status?.() ?? null
    )}`
  );
}
