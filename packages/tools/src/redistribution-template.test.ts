import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const templatePath = join(
  repositoryRoot,
  "redistribution",
  "templates",
  "KDHybrid-Patcher.ps1",
);

describe("PowerShell redistribution template", () => {
  it("exposes every supported texture and source mode", async () => {
    const source = await readFile(templatePath, "utf8");

    expect(source).toContain(
      '[ValidateSet("auto", "original", "full", "mobile")]',
    );
    expect(source).toContain('[ValidateSet("optimized", "original")]');
    expect(source).toContain('"--texture-mode"');
    expect(source).toContain('"--source-optimizations"');
    expect(source).toContain('$PSBoundParameters.ContainsKey("TextureMode")');
    expect(source).toContain('$PSBoundParameters.ContainsKey("SourceMode")');
  });

  it.skipIf(process.platform !== "win32")(
    "uses kit-relative paths and forwards only explicitly configured settings",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "kd-hybrid-kit-test-"));
      try {
        const kitRoot = join(root, "unpacked", "KD-Hybrid-test");
        const unrelatedCwd = join(root, "somewhere-else");
        const gameRoot = join(root, "Kinky Dungeon");
        const appRoot = join(gameRoot, "resources", "app");
        const capturePath = join(root, "captured-arguments.json");
        const scriptPath = join(kitRoot, "KDHybrid-Patcher.ps1");

        await Promise.all([
          mkdir(join(kitRoot, "tools"), { recursive: true }),
          mkdir(join(kitRoot, "bootstrap"), { recursive: true }),
          mkdir(join(appRoot, "out"), { recursive: true }),
          mkdir(unrelatedCwd, { recursive: true }),
        ]);
        await Promise.all([
          copyFile(templatePath, scriptPath),
          writeFile(
            join(kitRoot, "tools", "kd-hybrid-tool.mjs"),
            [
              'import { writeFileSync } from "node:fs";',
              "writeFileSync(",
              "  process.env.KD_HYBRID_CAPTURE_PATH,",
              "  JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() })",
              ");",
              "",
            ].join("\n"),
          ),
          writeFile(
            join(kitRoot, "bootstrap", "version.json"),
            '{"version":"test"}\n',
          ),
          writeFile(join(appRoot, "index.html"), "<!doctype html>\n"),
          writeFile(join(appRoot, "out", "main.js"), "void 0;\n"),
        ]);

        runPatcher(scriptPath, unrelatedCwd, capturePath, [
          "-Action",
          "Install",
          "-GameRoot",
          gameRoot,
          "-PathfindingMode",
          "human",
          "-TextureMode",
          "mobile",
          "-SourceMode",
          "original",
        ]);
        const install = await readCapture(capturePath);
        expect(install.cwd).toBe(unrelatedCwd);
        expect(install.argv).toEqual([
          "install",
          "--app-root",
          appRoot,
          "--payload",
          join(kitRoot, "bootstrap"),
          "--upstream-version",
          "5.4.92",
          "--pathfinding-mode",
          "human",
          "--texture-mode",
          "mobile",
          "--source-optimizations",
          "false",
        ]);

        runPatcher(scriptPath, unrelatedCwd, capturePath, [
          "-Action",
          "Configure",
          "-GameRoot",
          appRoot,
          "-TextureMode",
          "original",
        ]);
        expect((await readCapture(capturePath)).argv).toEqual([
          "configure",
          "--app-root",
          appRoot,
          "--texture-mode",
          "original",
        ]);

        runPatcher(scriptPath, unrelatedCwd, capturePath, [
          "-Action",
          "Configure",
          "-GameRoot",
          appRoot,
          "-SourceMode",
          "optimized",
        ]);
        expect((await readCapture(capturePath)).argv).toEqual([
          "configure",
          "--app-root",
          appRoot,
          "--source-optimizations",
          "true",
        ]);

        runPatcher(scriptPath, unrelatedCwd, capturePath, [
          "-Action",
          "Configure",
          "-GameRoot",
          appRoot,
          "-NoSourceOptimizations",
        ]);
        expect((await readCapture(capturePath)).argv).toEqual([
          "configure",
          "--app-root",
          appRoot,
          "--source-optimizations",
          "false",
        ]);

        const bareConfigure = runPatcher(
          scriptPath,
          unrelatedCwd,
          capturePath,
          ["-Action", "Configure", "-GameRoot", appRoot],
          false,
        );
        expect(bareConfigure.status).not.toBe(0);
        expect(bareConfigure.stderr).toContain(
          "Configure requires PathfindingMode, TextureMode, or SourceMode",
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    15_000,
  );
});

interface CapturedInvocation {
  readonly argv: string[];
  readonly cwd: string;
}

async function readCapture(path: string): Promise<CapturedInvocation> {
  return JSON.parse(await readFile(path, "utf8")) as CapturedInvocation;
}

function runPatcher(
  scriptPath: string,
  cwd: string,
  capturePath: string,
  arguments_: readonly string[],
  expectSuccess = true,
): ReturnType<typeof spawnSync> {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      ...arguments_,
    ],
    {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        KD_HYBRID_CAPTURE_PATH: capturePath,
      },
      windowsHide: true,
    },
  );

  expect(result.error).toBeUndefined();
  if (expectSuccess) {
    expect(result.status, result.stderr || result.stdout).toBe(0);
  }
  return result;
}
