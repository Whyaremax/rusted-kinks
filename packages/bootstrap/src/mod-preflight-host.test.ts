// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from "vitest";

import type {
  ModCompatibilityCandidate,
  ModCompatibilityChoice,
  ModCompatibilityDecisionStore,
} from "./mod-compatibility-decisions.js";
import type { ModCompatibilityUiController } from "./mod-compatibility-ui.js";
import {
  candidateFromModPreflightReport,
  installKinkyDungeonModPreflight,
  type KDModPreflightHostEnvironment,
  type KDModPreflightLoaderEntry,
} from "./mod-preflight-host.js";
import type {
  ModPreflightReport,
  ModPreflightScanner,
} from "./mod-preflight-scanner.js";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const DIGEST_C = "c".repeat(64);

describe("KD mod preflight host", () => {
  it("delays official evaluation, preserves this/args/result, and restores exact state", async () => {
    const archive = new Blob(["safe"]);
    const entry = Object.freeze({
      name: "safe.zip",
      mod: archive,
      fileorder: Object.freeze(["safe.js"]),
    });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "safe.zip": archive });
    const thisArg = { call: "owner" };
    const args = Object.freeze(["first", 2] as const);
    let environment!: MutableEnvironment;
    let observedOrder: readonly KDModPreflightLoaderEntry[] | undefined;
    let observedRegistry: Readonly<Record<string, Blob>> | undefined;
    let observedThis: unknown;
    let observedArgs: readonly unknown[] = [];
    let calls = 0;
    const official = async function (
      this: unknown,
      ...received: unknown[]
    ): Promise<object> {
      calls += 1;
      observedThis = this;
      observedArgs = received;
      observedOrder = environment.readModLoadOrder();
      observedRegistry = environment.readModRegistry();
      return result;
    };
    const result = Object.freeze({ exact: true });
    environment = createEnvironment(official, order, registry);
    const digest = vi.fn(async () => DIGEST_A);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([[archive, safeReport("safe.zip", DIGEST_A)]]),
      ),
      digest,
      applyCompatibilityControls: vi.fn(),
      target: {},
    });

    await expect(handle.loaderReady).resolves.toBe(true);
    const installed = environment.readExecuteMods();
    expect(installed).not.toBe(official);
    const pending = Reflect.apply(installed!, thisArg, args);
    expect(calls).toBe(0);
    expect(environment.readAwaitingModLoad()).toBe(true);
    await expect(pending).resolves.toBe(result);

    expect(calls).toBe(1);
    expect(observedThis).toBe(thisArg);
    expect(observedArgs).toEqual(args);
    expect(observedOrder).toEqual(order);
    expect(observedRegistry).toEqual(registry);
    expect(environment.readModLoadOrder()).toBe(order);
    expect(environment.readModRegistry()).toBe(registry);
    expect(environment.readAwaitingModLoad()).toBe(false);
    expect(environment.modStateWriteCounts()).toMatchObject({
      order: 0,
      registry: 0,
      awaiting: 2,
    });
    expect(digest).toHaveBeenCalledTimes(1);
    expect(handle.status()).toMatchObject({
      state: "executed",
      blockedReason: null,
      lastError: null,
    });
  });

  it("hooks early but cannot evaluate before native adapter startup settles", async () => {
    const archive = new Blob(["safe"]);
    const entry = Object.freeze({ name: "safe.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "safe.zip": archive });
    const official = vi.fn(async () => "loaded-after-native");
    const environment = createEnvironment(official, order, registry);
    let releaseBarrier!: () => void;
    const activationBarrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([[archive, safeReport("safe.zip", DIGEST_A)]]),
      ),
      digest: async () => DIGEST_A,
      applyCompatibilityControls: vi.fn(),
      activationBarrier,
      target: {},
    });

    await expect(handle.loaderReady).resolves.toBe(true);
    const pending = environment.readExecuteMods()!();
    expect(environment.readAwaitingModLoad()).toBe(true);
    await Promise.resolve();
    expect(official).not.toHaveBeenCalled();

    releaseBarrier();
    await expect(pending).resolves.toBe("loaded-after-native");
    expect(official).toHaveBeenCalledOnce();
    expect(environment.readAwaitingModLoad()).toBe(false);
  });

  it("preserves KDExecuted's no-op without scanning or latching input", async () => {
    const archive = new Blob(["safe"]);
    const entry = Object.freeze({ name: "safe.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "safe.zip": archive });
    const official = vi.fn(async () => undefined);
    const environment = createEnvironment(official, order, registry, {
      executed: true,
    });
    const digest = vi.fn(async () => DIGEST_A);
    const controls = vi.fn();
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([[archive, safeReport("safe.zip", DIGEST_A)]]),
      ),
      digest,
      applyCompatibilityControls: controls,
      target: {},
    });

    await expect(handle.loaderReady).resolves.toBe(true);
    await expect(environment.readExecuteMods()!()).resolves.toBe(undefined);

    expect(official).toHaveBeenCalledOnce();
    expect(digest).not.toHaveBeenCalled();
    expect(controls).not.toHaveBeenCalled();
    expect(environment.modStateWriteCounts()).toMatchObject({
      awaiting: 0,
      order: 0,
      registry: 0,
    });
  });

  it("keeps a blocking guard installed when the prerequisite loader reports false", async () => {
    const archive = new Blob(["safe"]);
    const entry = Object.freeze({ name: "safe.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "safe.zip": archive });
    const official = vi.fn(async () => "unguarded");
    const environment = createEnvironment(official, order, registry);
    const digest = vi.fn(async () => DIGEST_A);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([[archive, safeReport("safe.zip", DIGEST_A)]]),
      ),
      digest,
      waitFor: Promise.resolve(false),
      applyCompatibilityControls: vi.fn(),
      target: {},
    });

    expect(environment.readExecuteMods()).not.toBe(official);
    await expect(handle.loaderReady).resolves.toBe(false);
    await expect(environment.readExecuteMods()!()).resolves.toBe(undefined);

    expect(official).not.toHaveBeenCalled();
    expect(digest).not.toHaveBeenCalled();
    expect(handle.status()).toMatchObject({
      state: "blocked",
      lastError: "prerequisite-loader-hook-unavailable",
    });
  });

  it("retries a compare-and-swap drift synchronously and guards the new executor", async () => {
    const archive = new Blob(["safe"]);
    const entry = Object.freeze({ name: "safe.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "safe.zip": archive });
    const original = vi.fn(async () => "stale");
    const drifted = vi.fn(async () => "guarded-current");
    const environment = createEnvironment(original, order, registry);
    const replace = environment.replaceExecuteMods.bind(environment);
    let driftOnce = true;
    environment.replaceExecuteMods = (expected, replacement) => {
      if (driftOnce) {
        driftOnce = false;
        environment.setExecuteMods(drifted);
        return false;
      }
      return replace(expected, replacement);
    };
    const digest = vi.fn(async () => DIGEST_A);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([[archive, safeReport("safe.zip", DIGEST_A)]]),
      ),
      digest,
      applyCompatibilityControls: vi.fn(),
      target: {},
    });

    await expect(handle.loaderReady).resolves.toBe(true);
    expect(environment.readExecuteMods()).not.toBe(drifted);
    await expect(environment.readExecuteMods()!()).resolves.toBe(
      "guarded-current",
    );

    expect(original).not.toHaveBeenCalled();
    expect(drifted).toHaveBeenCalledOnce();
    expect(digest).toHaveBeenCalledOnce();
  });

  it("returns undefined to a reentrant official call without sharing the active promise", async () => {
    const archive = new Blob(["safe"]);
    const entry = Object.freeze({ name: "safe.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "safe.zip": archive });
    let environment!: MutableEnvironment;
    let innerResult: unknown = "not-called";
    const official = vi.fn(async () => {
      environment.setModExecutionComplete(true);
      environment.writeAwaitingModLoad(true);
      innerResult = await environment.readExecuteMods()!();
      environment.writeAwaitingModLoad(false);
      return "outer-result";
    });
    environment = createEnvironment(official, order, registry);
    const digest = vi.fn(async () => DIGEST_A);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([[archive, safeReport("safe.zip", DIGEST_A)]]),
      ),
      digest,
      applyCompatibilityControls: vi.fn(),
      target: {},
    });

    await handle.loaderReady;
    await expect(environment.readExecuteMods()!()).resolves.toBe(
      "outer-result",
    );

    expect(innerResult).toBe(undefined);
    expect(official).toHaveBeenCalledOnce();
    expect(digest).toHaveBeenCalledOnce();
  });

  it("does not propagate the first activation's rejection to a concurrent no-op call", async () => {
    const archive = new Blob(["safe"]);
    const entry = Object.freeze({ name: "safe.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "safe.zip": archive });
    const failure = new Error("outer activation failed");
    let environment!: MutableEnvironment;
    let releaseBarrier!: () => void;
    const activationBarrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const official = vi.fn(async () => {
      environment.setModExecutionComplete(true);
      environment.writeAwaitingModLoad(true);
      throw failure;
    });
    environment = createEnvironment(official, order, registry);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([[archive, safeReport("safe.zip", DIGEST_A)]]),
      ),
      digest: async () => DIGEST_A,
      applyCompatibilityControls: vi.fn(),
      activationBarrier,
      target: {},
    });

    await handle.loaderReady;
    const first = environment.readExecuteMods()!();
    const second = environment.readExecuteMods()!();
    await expect(second).resolves.toBe(undefined);

    releaseBarrier();
    await expect(first).rejects.toBe(failure);
    expect(official).toHaveBeenCalledOnce();
  });

  it("temporarily filters both KDMods and load order so KD's rebuild cannot revive a disabled mod", async () => {
    const riskyBlob = new Blob(["risky"]);
    const safeBlob = new Blob(["safe"]);
    const risky = Object.freeze({
      name: "risky.zip",
      mod: riskyBlob,
      fileorder: Object.freeze([]),
    });
    const safe = Object.freeze({
      name: "safe.zip",
      mod: safeBlob,
      fileorder: Object.freeze([]),
    });
    const order = Object.freeze([risky, safe]);
    const registry = Object.freeze({
      "risky.zip": riskyBlob,
      "safe.zip": safeBlob,
    });
    const updatedSafeBlob = new Blob(["safe-updated"]);
    const addedBlob = new Blob(["added"]);
    const added = Object.freeze({
      name: "added.zip",
      mod: addedBlob,
      fileorder: Object.freeze(["added.js"]),
    });
    const updatedSafe = Object.freeze({
      name: "safe.zip",
      mod: updatedSafeBlob,
      fileorder: Object.freeze(["safe-updated.js"]),
    });
    const persistedBefore = JSON.stringify(["risky.zip", "safe.zip"]);
    let environment!: MutableEnvironment;
    let evaluated: readonly string[] = [];
    const official = async (): Promise<string> => {
      const activeRegistry = environment.readModRegistry()!;
      const rebuilt = Object.freeze(
        Object.entries(activeRegistry).map(([name, mod]) =>
          Object.freeze({ name, mod, fileorder: Object.freeze([]) }),
        ),
      );
      environment.writeModLoadOrder(rebuilt);
      evaluated = rebuilt.map((entry) => entry.name);
      environment.writeModRegistry(
        Object.freeze({
          "safe.zip": updatedSafeBlob,
          "added.zip": addedBlob,
        }),
      );
      environment.writeModLoadOrder(Object.freeze([added, updatedSafe]));
      environment.setPersistedModList(JSON.stringify(["safe.zip"]));
      return "loaded";
    };
    environment = createEnvironment(official, order, registry, {
      offline: true,
      persistedModList: persistedBefore,
    });
    const controls = vi.fn();
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([
          [riskyBlob, riskReport("risky.zip", DIGEST_A, "buff-event-index")],
          [safeBlob, safeReport("safe.zip", DIGEST_B)],
        ]),
      ),
      digest: digestFor(
        new Map([
          [riskyBlob, DIGEST_A],
          [safeBlob, DIGEST_B],
        ]),
      ),
      ui: createUi("disable-mod"),
      applyCompatibilityControls: controls,
      target: {},
    });

    await expect(handle.loaderReady).resolves.toBe(true);
    await expect(environment.readExecuteMods()!()).resolves.toBe("loaded");

    expect(evaluated).toEqual(["safe.zip"]);
    expect(environment.readModLoadOrder()?.map((entry) => entry.name)).toEqual([
      "added.zip",
      "risky.zip",
      "safe.zip",
    ]);
    expect(environment.readModLoadOrder()?.[0]).toBe(added);
    expect(environment.readModLoadOrder()?.[1]).toBe(risky);
    expect(environment.readModLoadOrder()?.[2]).toBe(updatedSafe);
    expect(environment.readModRegistry()).toEqual({
      "added.zip": addedBlob,
      "risky.zip": riskyBlob,
      "safe.zip": updatedSafeBlob,
    });
    expect(Object.keys(environment.readModRegistry() ?? {})).toEqual([
      "added.zip",
      "risky.zip",
      "safe.zip",
    ]);
    expect(environment.readPersistedModList()).toBe(persistedBefore);
    expect(controls).toHaveBeenCalledOnce();
    expect(handle.status().session.disabledMods).toEqual([DIGEST_A]);
    expect(handle.status().state).toBe("executed");
  });

  it("restores all-disabled state without evaluating or persisting an empty mod list", async () => {
    const archive = new Blob(["risk"]);
    const entry = Object.freeze({ name: "risk.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "risk.zip": archive });
    const persistedBefore = JSON.stringify(["risk.zip"]);
    let environment!: MutableEnvironment;
    let evaluated = false;
    const official = vi.fn(async () => {
      if (
        environment.readModExecutionComplete() ||
        (environment.readModLoadOrder()?.length ?? 0) === 0
      ) {
        return undefined;
      }
      evaluated = true;
      environment.setPersistedModList("[]");
      return undefined;
    });
    environment = createEnvironment(official, order, registry, {
      offline: true,
      persistedModList: persistedBefore,
    });
    const digest = vi.fn(async () => DIGEST_A);
    const ui = createUi("disable-mod");
    const controls = vi.fn();
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([
          [archive, riskReport("risk.zip", DIGEST_A, "buff-event-index")],
        ]),
      ),
      digest,
      ui,
      applyCompatibilityControls: controls,
      target: {},
    });

    await handle.loaderReady;
    await expect(environment.readExecuteMods()!()).resolves.toBe(undefined);

    expect(official).toHaveBeenCalledOnce();
    expect(evaluated).toBe(false);
    expect(environment.readModLoadOrder()).toBe(order);
    expect(environment.readModRegistry()).toBe(registry);
    expect(environment.readPersistedModList()).toBe(persistedBefore);
    expect(environment.readModExecutionComplete()).toBe(true);
    expect(handle.status().state).toBe("executed");
    expect(digest).toHaveBeenCalledOnce();
    expect(ui.prompt).toHaveBeenCalledOnce();
    expect(controls).toHaveBeenCalledOnce();

    await expect(environment.readExecuteMods()!()).resolves.toBe(undefined);
    expect(official).toHaveBeenCalledTimes(2);
    expect(digest).toHaveBeenCalledOnce();
    expect(ui.prompt).toHaveBeenCalledOnce();
    expect(controls).toHaveBeenCalledOnce();
    expect(environment.modStateWriteCounts().executed).toBe(1);
  });

  it("does not set KDExecuted when an all-disabled filtered state fails verification", async () => {
    const archive = new Blob(["risk"]);
    const entry = Object.freeze({ name: "risk.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "risk.zip": archive });
    const official = vi.fn(async () => undefined);
    const environment = createEnvironment(official, order, registry);
    const writeOrder = environment.writeModLoadOrder.bind(environment);
    environment.writeModLoadOrder = (entries) => {
      if (entries.length === 0) {
        return true;
      }
      return writeOrder(entries);
    };
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([
          [archive, riskReport("risk.zip", DIGEST_A, "buff-event-index")],
        ]),
      ),
      digest: async () => DIGEST_A,
      ui: createUi("disable-mod"),
      applyCompatibilityControls: vi.fn(),
      target: {},
    });

    await handle.loaderReady;
    await expect(environment.readExecuteMods()!()).resolves.toBe(undefined);

    expect(official).not.toHaveBeenCalled();
    expect(environment.readModExecutionComplete()).toBe(false);
    expect(environment.modStateWriteCounts().executed).toBe(0);
    expect(handle.status().state).toBe("blocked");
  });

  it("rolls KDExecuted back when the guarded all-disabled executor rejects", async () => {
    const archive = new Blob(["risk"]);
    const entry = Object.freeze({ name: "risk.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "risk.zip": archive });
    const failure = new Error("guarded executor failed");
    let environment!: MutableEnvironment;
    const official = vi.fn(async () => {
      expect(environment.readModExecutionComplete()).toBe(true);
      throw failure;
    });
    environment = createEnvironment(official, order, registry);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([
          [archive, riskReport("risk.zip", DIGEST_A, "buff-event-index")],
        ]),
      ),
      digest: async () => DIGEST_A,
      ui: createUi("disable-mod"),
      applyCompatibilityControls: vi.fn(),
      target: {},
    });

    await handle.loaderReady;
    await expect(environment.readExecuteMods()!()).rejects.toBe(failure);

    expect(environment.readModExecutionComplete()).toBe(false);
    expect(environment.modStateWriteCounts().executed).toBe(2);
    expect(handle.status()).toMatchObject({
      state: "failed",
      lastError: "guarded executor failed",
    });
  });

  it("re-inserts a disabled equal-priority middle archive without changing registry order", async () => {
    const firstBlob = new Blob(["first"]);
    const disabledBlob = new Blob(["disabled"]);
    const lastBlob = new Blob(["last"]);
    const first = Object.freeze({
      name: "first.zip",
      mod: firstBlob,
      fileorder: Object.freeze([]),
    });
    const disabled = Object.freeze({
      name: "disabled.zip",
      mod: disabledBlob,
      fileorder: Object.freeze([]),
    });
    const last = Object.freeze({
      name: "last.zip",
      mod: lastBlob,
      fileorder: Object.freeze([]),
    });
    const order = Object.freeze([first, disabled, last]);
    const registry = Object.freeze({
      "first.zip": firstBlob,
      "disabled.zip": disabledBlob,
      "last.zip": lastBlob,
    });
    let environment!: MutableEnvironment;
    const official = vi.fn(async () => {
      const rebuilt = Object.freeze(
        Object.entries(environment.readModRegistry()!).map(([name, mod]) =>
          Object.freeze({
            name,
            mod,
            fileorder: Object.freeze([]),
          }),
        ),
      );
      environment.writeModLoadOrder(rebuilt);
    });
    environment = createEnvironment(official, order, registry);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([
          [firstBlob, safeReport("first.zip", DIGEST_A)],
          [disabledBlob, riskReport("disabled.zip", DIGEST_B, "pathfinding")],
          [lastBlob, safeReport("last.zip", DIGEST_C)],
        ]),
      ),
      digest: digestFor(
        new Map([
          [firstBlob, DIGEST_A],
          [disabledBlob, DIGEST_B],
          [lastBlob, DIGEST_C],
        ]),
      ),
      ui: createUi("disable-mod"),
      applyCompatibilityControls: vi.fn(),
      target: {},
    });

    await handle.loaderReady;
    await environment.readExecuteMods()!();

    expect(environment.readModLoadOrder()?.map((entry) => entry.name)).toEqual([
      "first.zip",
      "disabled.zip",
      "last.zip",
    ]);
    expect(Object.keys(environment.readModRegistry() ?? {})).toEqual([
      "first.zip",
      "disabled.zip",
      "last.zip",
    ]);
    expect(environment.readModRegistry()).toBe(registry);
  });

  it("blocks source-sensitive compatibility before eval while source patches are active", async () => {
    const archive = new Blob(["source-risk"]);
    const entry = Object.freeze({
      name: "source.zip",
      mod: archive,
    });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "source.zip": archive });
    const official = vi.fn(async () => undefined);
    const controls = vi.fn();
    const ui = createUi("keep-optimizations");
    const decisionStore = createRememberedDecisionStore(
      DIGEST_A,
      "compatibility",
    );
    const environment = createEnvironment(official, order, registry);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([
          [archive, riskReport("source.zip", DIGEST_A, "source-optimizations")],
        ]),
      ),
      digest: async () => DIGEST_A,
      applyCompatibilityControls: controls,
      decisionStore,
      ui,
      sourceOptimizationsActive: true,
      target: {},
    });

    await handle.loaderReady;
    await expect(environment.readExecuteMods()!()).resolves.toBe(undefined);

    expect(official).not.toHaveBeenCalled();
    expect(controls).not.toHaveBeenCalled();
    expect(handle.status()).toMatchObject({
      state: "blocked",
      blockedReason: "restart-required",
      lastError: "restart-required",
    });
    expect(handle.status().session.restartRequired).toBe(true);
    expect(ui.prompt).not.toHaveBeenCalled();
    expect(ui.showManager).toHaveBeenCalledWith([
      expect.objectContaining({
        candidate: expect.objectContaining({ digest: DIGEST_A }),
        restartRequired: true,
      }),
    ]);
    expect(
      (ui.showManager as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.[0],
    ).not.toHaveProperty("status");
  });

  it("loads source-sensitive compatibility after the patcher selects original source", async () => {
    const archive = new Blob(["source-risk"]);
    const entry = Object.freeze({
      name: "source.zip",
      mod: archive,
    });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "source.zip": archive });
    const official = vi.fn(async () => "original-source-loaded");
    const controls = vi.fn();
    const ui = createUi("compatibility");
    const environment = createEnvironment(official, order, registry);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([
          [archive, riskReport("source.zip", DIGEST_A, "source-optimizations")],
        ]),
      ),
      digest: async () => DIGEST_A,
      applyCompatibilityControls: controls,
      ui,
      sourceOptimizationsActive: false,
      target: {},
    });

    await handle.loaderReady;
    await expect(environment.readExecuteMods()!()).resolves.toBe(
      "original-source-loaded",
    );

    expect(official).toHaveBeenCalledOnce();
    expect(controls).toHaveBeenCalledWith(
      expect.objectContaining({
        disabledSubsystems: [],
        restartRequired: false,
      }),
      [
        expect.objectContaining({
          findings: [],
        }),
      ],
    );
    expect(handle.status().session.disabledSubsystems).toEqual([]);
    expect(ui.prompt).not.toHaveBeenCalled();
    expect(handle.status().state).toBe("executed");
  });

  it("detects order drift after scanning and never evaluates", async () => {
    const archive = new Blob(["risk"]);
    const entry = Object.freeze({ name: "one.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "one.zip": archive });
    const official = vi.fn(async () => undefined);
    const environment = createEnvironment(official, order, registry);
    const drifted = Object.freeze([
      Object.freeze({ name: "renamed.zip", mod: archive }),
    ]);
    const scanner = createScanner(
      new Map([[archive, safeReport("one.zip", DIGEST_A)]]),
      () => {
        environment.writeModLoadOrder(drifted);
      },
    );
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner,
      digest: async () => DIGEST_A,
      applyCompatibilityControls: vi.fn(),
      target: {},
    });

    await handle.loaderReady;
    await expect(environment.readExecuteMods()!()).resolves.toBe(undefined);

    expect(official).not.toHaveBeenCalled();
    expect(handle.status()).toMatchObject({
      state: "blocked",
      blockedReason: "identity-drift",
    });
  });

  it("restores exact official state and rejection identity when official execution fails", async () => {
    const archive = new Blob(["safe"]);
    const entry = Object.freeze({ name: "safe.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "safe.zip": archive });
    const failure = new Error("official failure");
    const official = vi.fn(async () => {
      throw failure;
    });
    const environment = createEnvironment(official, order, registry);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([[archive, safeReport("safe.zip", DIGEST_A)]]),
      ),
      digest: async () => DIGEST_A,
      applyCompatibilityControls: vi.fn(),
      target: {},
    });

    await handle.loaderReady;
    await expect(environment.readExecuteMods()!()).rejects.toBe(failure);

    expect(environment.readModLoadOrder()).toBe(order);
    expect(environment.readModRegistry()).toBe(registry);
    expect(handle.status()).toMatchObject({
      state: "failed",
      lastError: "official failure",
    });
  });

  it("fails closed when KDMods contains an unscanned enumerable archive", async () => {
    const archive = new Blob(["safe"]);
    const unscanned = new Blob(["unscanned"]);
    const entry = Object.freeze({ name: "safe.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({
      "safe.zip": archive,
      "unscanned.zip": unscanned,
    });
    const official = vi.fn(async () => undefined);
    const environment = createEnvironment(official, order, registry);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([[archive, safeReport("safe.zip", DIGEST_A)]]),
      ),
      digest: async () => DIGEST_A,
      applyCompatibilityControls: vi.fn(),
      target: {},
    });

    await handle.loaderReady;
    await expect(environment.readExecuteMods()!()).resolves.toBe(undefined);

    expect(official).not.toHaveBeenCalled();
    expect(handle.status()).toMatchObject({
      state: "blocked",
      blockedReason: "load-order-failed",
    });
    expect(environment.readModLoadOrder()).toBe(order);
    expect(environment.readModRegistry()).toBe(registry);
  });

  it("keeps disposed state and exposes a drain until in-progress official evaluation settles", async () => {
    const archive = new Blob(["safe"]);
    const entry = Object.freeze({ name: "safe.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "safe.zip": archive });
    let environment!: MutableEnvironment;
    let markStarted!: () => void;
    let releaseOfficial!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const held = new Promise<void>((resolve) => {
      releaseOfficial = resolve;
    });
    const exactResult = Object.freeze({ finished: true });
    const official = vi.fn(async () => {
      environment.setModExecutionComplete(true);
      environment.writeAwaitingModLoad(true);
      markStarted();
      await held;
      environment.writeAwaitingModLoad(false);
      return exactResult;
    });
    environment = createEnvironment(official, order, registry);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([[archive, safeReport("safe.zip", DIGEST_A)]]),
      ),
      digest: async () => DIGEST_A,
      applyCompatibilityControls: vi.fn(),
      target: {},
    });

    await handle.loaderReady;
    const activation = environment.readExecuteMods()!();
    await started;
    const drain = handle.drain();
    expect(drain).toBeDefined();
    let drained = false;
    void drain!.then(() => {
      drained = true;
    });

    handle.dispose();
    await Promise.resolve();
    expect(drained).toBe(false);
    expect(handle.status().state).toBe("disposed");

    releaseOfficial();
    await expect(activation).resolves.toBe(exactResult);
    await drain;
    expect(drained).toBe(true);
    expect(handle.status().state).toBe("disposed");
    expect(handle.drain()).toBeUndefined();
  });

  it("keeps the official rejection primary while exposing a simultaneous restore diagnostic", async () => {
    const riskyBlob = new Blob(["risky"]);
    const safeBlob = new Blob(["safe"]);
    const risky = Object.freeze({
      name: "risky.zip",
      mod: riskyBlob,
    });
    const safe = Object.freeze({
      name: "safe.zip",
      mod: safeBlob,
    });
    const order = Object.freeze([risky, safe]);
    const registry = Object.freeze({
      "risky.zip": riskyBlob,
      "safe.zip": safeBlob,
    });
    const failure = new Error("official-primary");
    let environment!: MutableEnvironment;
    const official = vi.fn(async () => {
      environment.writeModRegistry = () => false;
      throw failure;
    });
    environment = createEnvironment(official, order, registry);
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([
          [riskyBlob, riskReport("risky.zip", DIGEST_A, "buff-event-index")],
          [safeBlob, safeReport("safe.zip", DIGEST_B)],
        ]),
      ),
      digest: digestFor(
        new Map([
          [riskyBlob, DIGEST_A],
          [safeBlob, DIGEST_B],
        ]),
      ),
      ui: createUi("disable-mod"),
      applyCompatibilityControls: vi.fn(),
      target: {},
    });

    await handle.loaderReady;
    await expect(environment.readExecuteMods()!()).rejects.toBe(failure);

    expect(handle.status().lastError).toBe("official-primary");
    expect(handle.status().diagnostic).toMatchObject({
      code: "official-and-restore-failed",
      officialError: failure,
      restoreError: expect.any(Error),
    });
  });

  it("restores the previous global handle and official executor on disposal", async () => {
    const archive = new Blob(["safe"]);
    const entry = Object.freeze({ name: "safe.zip", mod: archive });
    const order = Object.freeze([entry]);
    const registry = Object.freeze({ "safe.zip": archive });
    const official = vi.fn(async () => undefined);
    const environment = createEnvironment(official, order, registry);
    const previous = {
      loaderReady: Promise.resolve(true),
      status: vi.fn(),
      showManager: vi.fn(),
      forget: vi.fn(),
      forgetAll: vi.fn(),
      dispose: vi.fn(),
    };
    const target = { KDHybridModPreflight: previous };
    const ui = createUi("compatibility");
    const handle = installKinkyDungeonModPreflight({
      environment,
      scanner: createScanner(
        new Map([[archive, safeReport("safe.zip", DIGEST_A)]]),
      ),
      digest: async () => DIGEST_A,
      applyCompatibilityControls: vi.fn(),
      ui,
      target,
    });

    await handle.loaderReady;
    expect(target.KDHybridModPreflight).toBe(handle);
    expect(environment.readExecuteMods()).not.toBe(official);
    handle.dispose();

    expect(target.KDHybridModPreflight).toBe(previous);
    expect(environment.readExecuteMods()).toBe(official);
    expect(ui.dispose).toHaveBeenCalledOnce();
    expect(handle.status().state).toBe("disposed");
  });
});

describe("mod preflight report conversion", () => {
  it("maps bounded evidence to deterministic subsystem findings", () => {
    const report = riskReport("source.zip", DIGEST_A, "source-optimizations");

    const active = candidateFromModPreflightReport(report, true);
    const original = candidateFromModPreflightReport(report, false);

    expect(active).toEqual({
      name: "source.zip",
      digest: DIGEST_A,
      findings: [
        {
          ruleId: "preflight-v1:0:0:function-replacement",
          confidence: "high",
          subsystem: "source-optimizations",
          reason: "test-risk",
          restartRequired: true,
        },
      ],
    });
    expect(original.findings).toEqual([]);
    expect(Object.isFrozen(active)).toBe(true);
    expect(Object.isFrozen(active.findings)).toBe(true);
  });
});

interface MutableEnvironment extends KDModPreflightHostEnvironment {
  readExecuteMods(): ((...args: unknown[]) => unknown) | undefined;
  setExecuteMods(value: (...args: unknown[]) => unknown): void;
  setModExecutionComplete(value: boolean): void;
  setOfflineMode(value: boolean): void;
  setPersistedModList(value: string | null): void;
  modStateWriteCounts(): {
    readonly executed: number;
    readonly order: number;
    readonly registry: number;
    readonly awaiting: number;
    readonly persisted: number;
  };
}

function createEnvironment(
  initialExecute: (...args: unknown[]) => unknown,
  initialOrder: readonly KDModPreflightLoaderEntry[],
  initialRegistry: Readonly<Record<string, Blob>>,
  initialState: {
    readonly executed?: boolean;
    readonly awaiting?: boolean;
    readonly offline?: boolean;
    readonly persistedModList?: string | null;
  } = {},
): MutableEnvironment {
  let execute: ((...args: unknown[]) => unknown) | undefined = initialExecute;
  let order = initialOrder;
  let registry = initialRegistry;
  let executed = initialState.executed ?? false;
  let awaiting = initialState.awaiting ?? false;
  let offline = initialState.offline ?? false;
  let persistedModList = initialState.persistedModList ?? null;
  let executedWrites = 0;
  let orderWrites = 0;
  let registryWrites = 0;
  let awaitingWrites = 0;
  let persistedWrites = 0;
  return {
    readExecuteMods: () => execute,
    setExecuteMods(value) {
      execute = value;
    },
    replaceExecuteMods(expected, replacement) {
      if (execute !== expected) {
        return false;
      }
      execute = replacement;
      return true;
    },
    readModExecutionComplete: () => executed,
    writeModExecutionComplete(value) {
      executedWrites += 1;
      executed = value;
      return true;
    },
    setModExecutionComplete(value) {
      executed = value;
    },
    readAwaitingModLoad: () => awaiting,
    writeAwaitingModLoad(value) {
      awaitingWrites += 1;
      awaiting = value;
      return true;
    },
    readOfflineMode: () => offline,
    setOfflineMode(value) {
      offline = value;
    },
    readPersistedModList: () => persistedModList,
    writePersistedModList(value) {
      persistedWrites += 1;
      persistedModList = value;
      return true;
    },
    setPersistedModList(value) {
      persistedModList = value;
    },
    readModLoadOrder: () => order,
    writeModLoadOrder(entries) {
      orderWrites += 1;
      order = entries;
      return true;
    },
    readModRegistry: () => registry,
    writeModRegistry(value) {
      registryWrites += 1;
      registry = value;
      return true;
    },
    modStateWriteCounts: () => ({
      executed: executedWrites,
      order: orderWrites,
      registry: registryWrites,
      awaiting: awaitingWrites,
      persisted: persistedWrites,
    }),
    schedule: (callback, delayMs) => setTimeout(callback, delayMs),
    cancelScheduled: (handle) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
}

function createScanner(
  reports: ReadonlyMap<Blob, ModPreflightReport>,
  beforeReturn?: () => void,
): ModPreflightScanner {
  return Object.freeze({
    limits: Object.freeze({
      maxArchiveBytes: 1024 * 1024,
      maxEntries: 32,
      maxScriptFiles: 8,
      maxScriptBytes: 1024,
      maxTotalScriptBytes: 4096,
      maxAstNodesPerScript: 1000,
      maxTotalAstNodes: 4000,
      maxEvidencePerSubsystem: 16,
      maxEvidenceTotal: 32,
    }),
    async scan(archive) {
      beforeReturn?.();
      const report = reports.get(archive.blob);
      if (report === undefined) {
        throw new Error("missing test report");
      }
      return report;
    },
  });
}

function safeReport(name: string, digest: string): ModPreflightReport {
  return Object.freeze({
    version: 1,
    name,
    digestSha256: digest,
    archiveBytes: 1,
    level: "safe",
    requiresCompatibilityDecision: false,
    inventory: Object.freeze([]),
    risks: Object.freeze(
      [
        "buff-event-index",
        "enemy-position-cache",
        "pathfinding",
        "source-optimizations",
      ].map((subsystem) =>
        Object.freeze({
          subsystem,
          level: "safe",
          evidence: Object.freeze([]),
        }),
      ),
    ) as ModPreflightReport["risks"],
  });
}

function riskReport(
  name: string,
  digest: string,
  subsystem:
    | "buff-event-index"
    | "enemy-position-cache"
    | "pathfinding"
    | "source-optimizations",
): ModPreflightReport {
  return Object.freeze({
    version: 1,
    name,
    digestSha256: digest,
    archiveBytes: 1,
    level: "compatibility-required",
    requiresCompatibilityDecision: true,
    inventory: Object.freeze([]),
    risks: Object.freeze([
      Object.freeze({
        subsystem,
        level: "compatibility-required",
        evidence: Object.freeze([
          Object.freeze({
            subsystem,
            level: "compatibility-required",
            kind: "function-replacement",
            entry: "test.js",
            offset: 0,
            path: "test",
            reason: "test-risk",
          }),
        ]),
      }),
    ]),
  });
}

function digestFor(
  values: ReadonlyMap<Blob, string>,
): (blob: Blob) => Promise<string> {
  return async (blob) => {
    const value = values.get(blob);
    if (value === undefined) {
      throw new Error("missing test digest");
    }
    return value;
  };
}

function createUi(
  choice: ModCompatibilityChoice,
): ModCompatibilityUiController {
  const prompt = vi.fn(async (_candidate: ModCompatibilityCandidate) => choice);
  return {
    prompt,
    request: vi.fn(async (candidate) => ({
      choice,
      source: "prompt" as const,
      remembered: false,
      restartRequired: candidate.findings.some(
        (finding) => finding.restartRequired === true,
      ),
    })),
    change: vi.fn(async (candidate) => ({
      choice,
      source: "prompt" as const,
      remembered: false,
      restartRequired: candidate.findings.some(
        (finding) => finding.restartRequired === true,
      ),
    })),
    managerModel: vi.fn(),
    showManager: vi.fn(),
    forget: vi.fn(() => false),
    forgetAll: vi.fn(() => 0),
    dispose: vi.fn(),
    isDisposed: vi.fn(() => false),
  };
}

function createRememberedDecisionStore(
  digest: string,
  choice: ModCompatibilityChoice,
): ModCompatibilityDecisionStore {
  const decision = Object.freeze({
    digest,
    choice,
    context: Object.freeze({
      kdVersion: "5.4.92",
      bundleSha256: "c".repeat(64),
      hybridVersion: "test",
      ruleVersion: 1,
    }),
    rememberedAt: "2026-07-30T00:00:00.000Z",
  });
  return {
    lookup: vi.fn((value: string) => (value === digest ? decision : undefined)),
    remember: vi.fn(() => decision),
    forget: vi.fn(() => false),
    forgetAll: vi.fn(() => 0),
    decisions: vi.fn(() => Object.freeze([decision])),
  };
}
