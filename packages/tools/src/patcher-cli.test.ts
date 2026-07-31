import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  configuration: [] as unknown[],
  install: [] as unknown[]
}));

vi.mock("./patcher.js", () => ({
  install: vi.fn(async (options: unknown) => {
    calls.install.push(options);
    return { state: "installed" };
  }),
  status: vi.fn(async () => ({ state: "not-installed" })),
  uninstall: vi.fn(async () => ({ state: "not-installed" })),
  updateConfiguration: vi.fn(async (_appRoot: string, changes: unknown) => {
    calls.configuration.push(changes);
    return { state: "installed" };
  })
}));

import { main } from "./patcher-cli.js";

describe("redistribution patcher CLI source mode", () => {
  beforeEach(() => {
    calls.configuration.length = 0;
    calls.install.length = 0;
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("configures an explicit source-only selection without other settings", async () => {
    await expect(
      main([
        "configure",
        "--app-root",
        "fixture",
        "--source-optimizations",
        "false"
      ])
    ).resolves.toBe(0);

    expect(calls.configuration).toEqual([
      {
        sourceOptimizations: false
      }
    ]);
  });

  it("forwards an explicit optimized install selection", async () => {
    await expect(
      main([
        "install",
        "--app-root",
        "fixture",
        "--payload",
        "payload",
        "--source-optimizations",
        "true"
      ])
    ).resolves.toBe(0);

    expect(calls.install).toEqual([
      expect.objectContaining({
        appRoot: "fixture",
        payloadRoot: "payload",
        sourceOptimizations: true
      })
    ]);
  });

  it("rejects invalid booleans and empty configure requests", async () => {
    await expect(
      main([
        "configure",
        "--app-root",
        "fixture",
        "--source-optimizations",
        "sometimes"
      ])
    ).rejects.toThrow(/must be true or false/u);
    await expect(
      main([
        "configure",
        "--app-root",
        "fixture"
      ])
    ).rejects.toThrow(/Configure requires/u);
    expect(calls.configuration).toEqual([]);
  });
});
