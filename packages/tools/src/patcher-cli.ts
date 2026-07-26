#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { install, status, uninstall } from "./patcher.js";

const VERSION = "0.1.0";

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...rest] = argv;
  const options = parseOptions(rest);
  const appRoot = required(options, "app-root");

  switch (command) {
    case "install": {
      const result = await install({
        appRoot,
        payloadRoot: required(options, "payload"),
        toolVersion: VERSION,
        ...(options.has("upstream-version")
          ? { upstreamVersion: required(options, "upstream-version") }
          : {})
      });
      print(result);
      return result.state === "installed" ? 0 : 2;
    }
    case "status": {
      const result = await status(appRoot);
      print(result);
      return result.state === "installed" || result.state === "not-installed"
        ? 0
        : 2;
    }
    case "uninstall": {
      const result = await uninstall(appRoot);
      print(result);
      return result.state === "not-installed" ? 0 : 2;
    }
    default:
      throw new Error(
        "Expected patcher command install, status, or uninstall."
      );
  }
}

function parseOptions(args: readonly string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (name === undefined || !name.startsWith("--") || value === undefined) {
      throw new TypeError("Patcher options must use --name <value> pairs.");
    }
    options.set(name.slice(2), value);
  }
  return options;
}

function required(options: ReadonlyMap<string, string>, name: string): string {
  const value = options.get(name);
  if (!value) {
    throw new TypeError(`Missing required option --${name}`);
  }
  return value;
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const entryUrl =
  process.argv[1] === undefined
    ? ""
    : pathToFileURL(resolve(process.argv[1])).href;
if (import.meta.url === entryUrl) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(
        `KD Hybrid patcher error: ${
          error instanceof Error ? error.message : String(error)
        }\n`
      );
      process.exitCode = 1;
    }
  );
}
