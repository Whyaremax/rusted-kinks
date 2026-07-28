import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "..");
const pluginRoot = path.join(
  repoRoot,
  "examples",
  "mod-sdk",
  "rust-echo",
);
const manifestPath = path.join(pluginRoot, "Cargo.toml");
const pureTargetRoot = path.join(pluginRoot, "target", "pure");
const diagnosticTargetRoot = path.join(pluginRoot, "target", "diagnostic");
const pluginPath = path.join(
  pureTargetRoot,
  "wasm32-unknown-unknown",
  "release",
  "kd_hybrid_echo_plugin.wasm",
);
const diagnosticPluginPath = path.join(
  diagnosticTargetRoot,
  "wasm32-unknown-unknown",
  "release",
  "kd_hybrid_echo_plugin.wasm",
);
const vitestPath = path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");

async function findCargo() {
  const executableName = process.platform === "win32" ? "cargo.exe" : "cargo";
  const candidates = [
    process.env.CARGO,
    process.env.USERPROFILE &&
      path.join(process.env.USERPROFILE, ".cargo", "bin", executableName),
    process.env.HOME &&
      path.join(process.env.HOME, ".cargo", "bin", executableName),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next explicit cargo location.
    }
  }
  return "cargo";
}

async function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) {
    throw new Error(`${path.basename(command)} exited with code ${exitCode}`);
  }
}

const cargo = await findCargo();
await run(cargo, [
  "build",
  "--release",
  "--target",
  "wasm32-unknown-unknown",
  "--target-dir",
  pureTargetRoot,
  "--manifest-path",
  manifestPath,
], { cwd: pluginRoot });
await run(cargo, [
  "build",
  "--release",
  "--target",
  "wasm32-unknown-unknown",
  "--target-dir",
  diagnosticTargetRoot,
  "--features",
  "diagnostic-import",
  "--manifest-path",
  manifestPath,
], { cwd: pluginRoot });
await access(pluginPath);
await access(diagnosticPluginPath);
await run(
  process.execPath,
  [
    vitestPath,
    "run",
    "packages/runtime/src/mod-sdk-compat.test.ts",
    "--no-file-parallelism",
  ],
  {
    env: {
      ...process.env,
      KD_HYBRID_SDK_PLUGIN: pluginPath,
      KD_HYBRID_SDK_DIAGNOSTIC_PLUGIN: diagnosticPluginPath,
    },
  },
);
