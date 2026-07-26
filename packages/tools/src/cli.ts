#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { packagePortableMod } from "./packager.js";
import { install, status, uninstall } from "./patcher.js";

const VERSION = "0.1.0";

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...rest] = argv;
  const options = parseOptions(rest);
  switch (command) {
    case "install": {
      const appRoot = required(options, "app-root");
      const payloadRoot = options.get("payload") ?? resolve("dist/bootstrap");
      const result = await install({
        appRoot,
        payloadRoot,
        toolVersion: VERSION,
        ...(options.has("upstream-version")
          ? { upstreamVersion: required(options, "upstream-version") }
          : {}),
        allowUnknownBundle: options.has("allow-unknown")
      });
      print(result);
      return result.state === "installed" ? 0 : 2;
    }
    case "status": {
      const result = await status(required(options, "app-root"));
      print(result);
      return result.state === "installed" || result.state === "not-installed" ? 0 : 2;
    }
    case "uninstall": {
      const result = await uninstall(required(options, "app-root"));
      print(result);
      return result.state === "not-installed" ? 0 : 2;
    }
    case "package": {
      const output = await packagePortableMod({
        payloadRoot: options.get("payload") ?? resolve("dist/mod"),
        output: options.get("output") ?? resolve("artifacts/kd-hybrid.zip"),
        version: options.get("version") ?? VERSION
      });
      print({ state: "packaged", output });
      return 0;
    }
    case "help":
    case "--help":
    case "-h":
    case undefined:
      process.stdout.write(help());
      return 0;
    default:
      throw new Error(`Unknown command ${command}. Run kd-hybrid help.`);
  }
}

function parseOptions(args: readonly string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;
    if (!token.startsWith("--")) {
      throw new TypeError(`Unexpected positional argument ${token}`);
    }
    const name = token.slice(2);
    if (name === "allow-unknown") {
      options.set(name, "true");
      continue;
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new TypeError(`Option --${name} requires a value`);
    }
    options.set(name, value);
    index += 1;
  }
  return options;
}

function required(options: ReadonlyMap<string, string>, name: string): string {
  const value = options.get(name);
  if (value === undefined || value === "") {
    throw new TypeError(`Missing required option --${name}`);
  }
  return value;
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function help(): string {
  return `KD Hybrid ${VERSION}

Usage:
  kd-hybrid status --app-root <resources/app>
  kd-hybrid install --app-root <resources/app> [--payload <dir>]
  kd-hybrid uninstall --app-root <resources/app>
  kd-hybrid package [--payload <dir>] [--output <zip>]

The patcher never accesses Electron userData or save directories. Unknown game
bundles are refused unless --allow-unknown is explicit; native systems still
remain disabled until a unique structural signature matches.
`;
}

const entryUrl = process.argv[1] === undefined ? "" : pathToFileURL(resolve(process.argv[1])).href;
if (import.meta.url === entryUrl) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(
        `KD Hybrid error: ${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
    }
  );
}
