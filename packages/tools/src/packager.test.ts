import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { packagePortableMod } from "./packager.js";

describe("portable mod packager", () => {
  it("emits the real KD mod manifest and deterministic payload paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "kd-hybrid-package-"));
    try {
      const payload = join(root, "payload");
      await mkdir(join(payload, "wasm"), { recursive: true });
      await mkdir(join(payload, "LICENSES"), { recursive: true });
      await mkdir(join(payload, "source", "MPL-2.0", "packages", "bootstrap", "src"), { recursive: true });
      await mkdir(join(payload, "source", "MPL-2.0", "packages", "tools", "src"), { recursive: true });
      await mkdir(join(payload, "source", "MPL-2.0", "crates", "kd-core", "src"), { recursive: true });
      await mkdir(join(payload, "source", "MPL-2.0", "native", "manager", "src"), { recursive: true });
      await mkdir(join(payload, "source", "MPL-2.0", "upstream-patches", "kd-5.4.92"), { recursive: true });
      await writeFile(join(payload, "KDHybrid.js"), "void 0;\n");
      await writeFile(join(payload, "wasm", "kd_hybrid_core.js"), "void 0;\n");
      await writeFile(
        join(payload, "wasm", "kd_hybrid_core_bg.wasm"),
        Uint8Array.of(0, 97, 115, 109)
      );
      for (const file of [
        "LICENSES/ACORN-MIT.txt",
        "LICENSES/MIT.txt",
        "LICENSES/MPL-2.0.txt",
        "NOTICE.txt",
        "SOURCE.txt",
        "source/MPL-2.0/packages/bootstrap/src/kd-adapters.ts",
        "source/MPL-2.0/crates/kd-core/src/pathfinding.rs",
        "source/MPL-2.0/packages/tools/src/kd-source-patches.ts",
        "source/MPL-2.0/packages/tools/src/kd-source-patch-v6.ts",
        "source/MPL-2.0/native/manager/src/SourcePatches.h",
        "source/MPL-2.0/native/manager/src/SourcePatches.cpp",
        "source/MPL-2.0/upstream-patches/kd-5.4.92/README.md",
        "source/MPL-2.0/upstream-patches/kd-5.4.92/source-optimizations-v6.patch",
        "source/MPL-2.0/upstream-patches/kd-5.4.92/bundle-optimizations-v6.patch"
      ]) {
        await writeFile(join(payload, ...file.split("/")), "fixture\n");
      }
      const output = join(root, "KDHybrid.zip");
      await packagePortableMod({ payloadRoot: payload, output, version: "0.1.0" });
      const archive = unzipSync(await readFile(output));
      const manifest = JSON.parse(
        new TextDecoder().decode(archive["mod.json"])
      ) as { modname: string; fileorder: string[] };
      expect(manifest.modname).toBe("KDHybrid");
      expect(manifest.fileorder.at(-1)).toBe("KDHybrid.js");
      expect(Object.keys(archive)).toContain("wasm/kd_hybrid_core_bg.wasm");
      expect(Object.keys(archive)).toContain("LICENSES/ACORN-MIT.txt");
      expect(Object.keys(archive)).toContain("LICENSES/MPL-2.0.txt");
      expect(Object.keys(archive)).toContain(
        "source/MPL-2.0/upstream-patches/kd-5.4.92/source-optimizations-v6.patch"
      );
      expect(Object.keys(archive)).toContain(
        "source/MPL-2.0/upstream-patches/kd-5.4.92/bundle-optimizations-v6.patch"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
