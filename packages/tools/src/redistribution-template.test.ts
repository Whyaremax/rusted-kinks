import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const templatePath = join(
  repositoryRoot,
  "redistribution",
  "templates",
  "KDHybrid-Patcher.ps1"
);

describe("PowerShell redistribution template", () => {
  it("exposes every supported texture mode", async () => {
    const source = await readFile(templatePath, "utf8");

    expect(source).toContain(
      '[ValidateSet("auto", "original", "full", "mobile")]'
    );
    expect(source).toContain('"--texture-mode"');
    expect(source).toContain("$PSBoundParameters.ContainsKey(\"TextureMode\")");
  });

  it.skipIf(process.platform !== "win32")(
    "uses unpacked-kit-relative paths from an arbitrary working directory",
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
          mkdir(unrelatedCwd, { recursive: true })
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
              ""
            ].join("\n")
          ),
          writeFile(
            join(kitRoot, "bootstrap", "version.json"),
            '{"version":"test"}\n'
          ),
          writeFile(join(appRoot, "index.html"), "<!doctype html>\n"),
          writeFile(join(appRoot, "out", "main.js"), "void 0;\n")
        ]);

        runPatcher(
          scriptPath,
          unrelatedCwd,
          capturePath,
          [
            "-Action",
            "Install",
            "-GameRoot",
            gameRoot,
            "-PathfindingMode",
            "human",
            "-TextureMode",
            "mobile"
          ]
        );
        const install = JSON.parse(
          await readFile(capturePath, "utf8")
        ) as CapturedInvocation;
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
          "true"
        ]);

        runPatcher(
          scriptPath,
          unrelatedCwd,
          capturePath,
          [
            "-Action",
            "Configure",
            "-GameRoot",
            appRoot,
            "-TextureMode",
            "original"
          ]
        );
        const configure = JSON.parse(
          await readFile(capturePath, "utf8")
        ) as CapturedInvocation;
        expect(configure.argv).toEqual([
          "configure",
          "--app-root",
          appRoot,
          "--texture-mode",
          "original"
        ]);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  );
});

interface CapturedInvocation {
  readonly argv: string[];
  readonly cwd: string;
}

function runPatcher(
  scriptPath: string,
  cwd: string,
  capturePath: string,
  arguments_: readonly string[]
): void {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      ...arguments_
    ],
    {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        KD_HYBRID_CAPTURE_PATH: capturePath
      },
      windowsHide: true
    }
  );

  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr || result.stdout).toBe(0);
}
