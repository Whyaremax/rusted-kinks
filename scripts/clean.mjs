import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const targets = [
  "dist",
  "artifacts",
  "coverage",
  "packages/runtime/dist",
  "packages/bootstrap/dist",
  "packages/tools/dist"
];

for (const target of targets) {
  const path = resolve(root, target);
  if (!path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`)) {
    throw new Error(`Refusing to clean outside repository: ${path}`);
  }
  await rm(path, { recursive: true, force: true });
}
