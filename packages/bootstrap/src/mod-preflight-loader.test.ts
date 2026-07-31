import { describe, expect, it, vi } from "vitest";

import type {
  ModCompatibilityCandidate,
  ModCompatibilityChoice,
  ModCompatibilityDecisionStore,
  ModCompatibilitySessionStatus,
} from "./mod-compatibility-decisions.js";
import {
  createModPreflightExecutionGate,
  type ModPreflightDependencies,
} from "./mod-preflight-loader.js";

interface Archive {
  readonly key: string;
  digest: string;
  readonly name: string;
  readonly findings: ModCompatibilityCandidate["findings"];
  touched?: boolean;
}

type Official = (
  this: { readonly owner: string },
  marker: object,
) => object | PromiseLike<object>;

const digestA = "a".repeat(64);
const digestB = "b".repeat(64);
const digestC = "c".repeat(64);

describe("mod preflight execution gate", () => {
  it("scans every archive in snapshot order before choosing or evaluating", async () => {
    const events: string[] = [];
    const archiveA = archive("a", digestA, [
      finding("path-write", "pathfinding"),
    ]);
    const archiveB = archive("b", digestB, [
      finding("buff-write", "buff-event-index"),
    ]);
    const originalOrder = [archiveA, archiveB];
    let liveOrder = originalOrder;
    const officialResult = {};
    const thisArg = { owner: "KD" };
    const marker = {};
    const official = vi.fn(function (this: typeof thisArg, received: object) {
      events.push("official");
      expect(this).toBe(thisArg);
      expect(received).toBe(marker);
      expect(liveOrder).toEqual([archiveA]);
      return officialResult;
    });
    const dependencies = baseDependencies(originalOrder, official, {
      inspectArchive: async (entry) => {
        events.push(`scan:${entry.key}`);
        return candidate(entry);
      },
      prompt: async (entry) => {
        events.push(`prompt:${entry.digest[0]}`);
        return entry.digest === digestB ? "disable-mod" : "compatibility";
      },
      applyCompatibilityControls: async () => {
        events.push("apply");
      },
      installTemporaryLoadOrder: async (enabled) => {
        events.push("install");
        const previous = liveOrder;
        liveOrder = [...enabled];
        return {
          verify: () => {
            events.push("verify");
            return (
              liveOrder.length === enabled.length &&
              liveOrder.every((entry, index) => entry === enabled[index])
            );
          },
          restore: () => {
            events.push("restore");
            liveOrder = previous;
          },
        };
      },
    });
    const gate = createModPreflightExecutionGate(dependencies);

    const outcome = await gate.run(thisArg, [marker]);

    expect(events).toEqual([
      "scan:a",
      "scan:b",
      "prompt:a",
      "prompt:b",
      "apply",
      "install",
      "verify",
      "official",
      "restore",
    ]);
    expect(outcome.kind).toBe("executed");
    if (outcome.kind === "executed") {
      expect(outcome.result).toBe(officialResult);
      expect(outcome.status).toEqual({
        disabledMods: [digestB],
        forcedUnstableMods: [],
        compatibilityMods: [digestA],
        disabledSubsystems: ["pathfinding"],
        restartRequired: false,
      });
    }
    expect(official).toHaveBeenCalledTimes(1);
    expect(liveOrder).toBe(originalOrder);
    expect(archiveB.touched).toBeUndefined();
  });

  it("uses an exact no-write verifier when every archive remains enabled", async () => {
    const events: string[] = [];
    const archiveA = archive("a", digestA, []);
    const officialResult = {};
    const official = vi.fn(() => {
      events.push("official");
      return officialResult;
    });
    const verifyCurrentLoadOrder = vi.fn((enabled: readonly Archive[]) => {
      events.push("verify-current");
      return enabled.length === 1 && enabled[0] === archiveA;
    });
    const installTemporaryLoadOrder = vi.fn(() => {
      throw new Error("must not install temporary state");
    });
    const gate = createModPreflightExecutionGate(
      baseDependencies([archiveA], official, {
        verifyCurrentLoadOrder,
        installTemporaryLoadOrder,
      }),
    );

    const outcome = await gate.run({ owner: "KD" }, [{}]);

    expect(outcome).toMatchObject({
      kind: "executed",
      result: officialResult,
    });
    expect(events).toEqual(["verify-current", "official"]);
    expect(verifyCurrentLoadOrder).toHaveBeenCalledTimes(1);
    expect(installTemporaryLoadOrder).not.toHaveBeenCalled();
  });

  it("fails closed when exact no-write verification reports drift", async () => {
    const official = vi.fn(() => ({}));
    const installTemporaryLoadOrder = vi.fn();
    const outcome = await createModPreflightExecutionGate(
      baseDependencies([archive("a", digestA, [])], official, {
        verifyCurrentLoadOrder: () => false,
        installTemporaryLoadOrder,
      }),
    ).run({ owner: "KD" }, [{}]);

    expect(outcome).toMatchObject({
      kind: "blocked",
      reason: "identity-drift",
    });
    expect(installTemporaryLoadOrder).not.toHaveBeenCalled();
    expect(official).not.toHaveBeenCalled();
  });

  it("maps exact no-write verifier failures to load-order-failed", async () => {
    const verificationError = new Error("verification failed");
    const official = vi.fn(() => ({}));
    const outcome = await createModPreflightExecutionGate(
      baseDependencies([archive("a", digestA, [])], official, {
        verifyCurrentLoadOrder: () => {
          throw verificationError;
        },
      }),
    ).run({ owner: "KD" }, [{}]);

    expect(outcome).toMatchObject({
      kind: "blocked",
      reason: "load-order-failed",
      error: verificationError,
    });
    expect(official).not.toHaveBeenCalled();
  });

  it("shares one in-flight activation and preserves the first invocation", async () => {
    const releaseScan = deferred<void>();
    const firstThis = { owner: "first" };
    const firstArg = {};
    const secondThis = { owner: "second" };
    const secondArg = {};
    const result = {};
    const official = vi.fn(function (this: typeof firstThis, marker: object) {
      expect(this).toBe(firstThis);
      expect(marker).toBe(firstArg);
      return result;
    });
    const dependencies = baseDependencies(
      [archive("a", digestA, [])],
      official,
      {
        inspectArchive: async (entry) => {
          await releaseScan.promise;
          return candidate(entry);
        },
      },
    );
    const gate = createModPreflightExecutionGate(dependencies);

    const first = gate.run(firstThis, [firstArg]);
    const second = gate.run(secondThis, [secondArg]);
    expect(second).toBe(first);
    releaseScan.resolve();

    const [firstOutcome, secondOutcome] = await Promise.all([first, second]);
    expect(secondOutcome).toBe(firstOutcome);
    expect(official).toHaveBeenCalledTimes(1);
    expect(firstOutcome.kind).toBe("executed");
    if (firstOutcome.kind === "executed") {
      expect(firstOutcome.result).toBe(result);
    }
  });

  it("uses remembered choices and lets compatibility win per subsystem", async () => {
    const archives = [
      archive("a", digestA, [finding("path-replace", "pathfinding")]),
      archive("b", digestB, [
        finding("grid-write", "pathfinding"),
        finding("cache-write", "enemy-position-cache"),
      ]),
    ];
    const prompt = vi.fn(async () => "disable-mod" as const);
    const decisionStore = {
      lookup: (digest: string) =>
        digest === digestA
          ? remembered(digestA, "keep-optimizations")
          : remembered(digestB, "compatibility"),
    } as Pick<ModCompatibilityDecisionStore, "lookup">;
    const dependencies = baseDependencies(
      archives,
      vi.fn(() => ({})),
      { decisionStore, prompt },
    );

    const outcome = await createModPreflightExecutionGate(dependencies).run(
      { owner: "KD" },
      [{}],
    );

    expect(prompt).not.toHaveBeenCalled();
    expect(outcome.kind).toBe("executed");
    expect(outcome.status).toEqual({
      disabledMods: [],
      forcedUnstableMods: [digestA],
      compatibilityMods: [digestB],
      disabledSubsystems: ["enemy-position-cache", "pathfinding"],
      restartRequired: false,
    });
  });

  it.each([
    ["headless", true, undefined],
    ["missing prompt", false, undefined],
    ["dismissed prompt", false, async () => undefined],
  ] as const)(
    "defaults %s high-confidence decisions to compatibility",
    async (_name, headless, prompt) => {
      const applied: ModCompatibilitySessionStatus[] = [];
      const dependencies = baseDependencies(
        [archive("a", digestA, [finding("buff-write", "buff-event-index")])],
        vi.fn(() => ({})),
        {
          headless,
          ...(prompt === undefined ? {} : { prompt }),
          applyCompatibilityControls: (status) => {
            applied.push(status);
          },
        },
      );

      const outcome = await createModPreflightExecutionGate(dependencies).run(
        { owner: "KD" },
        [{}],
      );

      expect(outcome.kind).toBe("executed");
      expect(applied).toHaveLength(1);
      expect(applied[0]?.compatibilityMods).toEqual([digestA]);
      expect(applied[0]?.disabledSubsystems).toEqual(["buff-event-index"]);
    },
  );

  it("blocks source-sensitive compatibility until restart without eval", async () => {
    const official = vi.fn(() => ({}));
    const apply = vi.fn();
    const install = vi.fn(() => ({
      verify: () => true,
      restore: () => undefined,
    }));
    const dependencies = baseDependencies(
      [
        archive("source", digestA, [
          finding("source-inspection", "source-optimizations", true),
        ]),
      ],
      official,
      {
        applyCompatibilityControls: apply,
        installTemporaryLoadOrder: install,
      },
    );

    const outcome = await createModPreflightExecutionGate(dependencies).run(
      { owner: "KD" },
      [{}],
    );

    expect(outcome).toMatchObject({
      kind: "blocked",
      reason: "restart-required",
      status: {
        compatibilityMods: [digestA],
        disabledSubsystems: ["source-optimizations"],
        restartRequired: true,
      },
    });
    expect(apply).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
    expect(official).not.toHaveBeenCalled();
  });

  it("blocks scanner, prompt, and apply failures without evaluating", async () => {
    for (const phase of ["scan", "prompt", "apply"] as const) {
      const error = new Error(phase);
      const official = vi.fn(() => ({}));
      const risky = archive("a", digestA, [
        finding("path-write", "pathfinding"),
      ]);
      const overrides =
        phase === "scan"
          ? {
              inspectArchive: async () => {
                throw error;
              },
            }
          : phase === "prompt"
            ? {
                prompt: async () => {
                  throw error;
                },
              }
            : {
                applyCompatibilityControls: async () => {
                  throw error;
                },
              };
      const outcome = await createModPreflightExecutionGate(
        baseDependencies([risky], official, overrides),
      ).run({ owner: "KD" }, [{}]);

      expect(outcome).toMatchObject({
        kind: "blocked",
        reason:
          phase === "scan"
            ? "scan-failed"
            : phase === "prompt"
              ? "decision-failed"
              : "apply-failed",
        error,
      });
      expect(official).not.toHaveBeenCalled();
    }
  });

  it("rejects invalid prompt choices instead of silently forcing a mod", async () => {
    const official = vi.fn(() => ({}));
    const dependencies = baseDependencies(
      [archive("a", digestA, [finding("path-write", "pathfinding")])],
      official,
      {
        prompt: async () => "surprise" as ModCompatibilityChoice,
      },
    );

    const outcome = await createModPreflightExecutionGate(dependencies).run(
      { owner: "KD" },
      [{}],
    );

    expect(outcome).toMatchObject({
      kind: "blocked",
      reason: "decision-failed",
    });
    expect(official).not.toHaveBeenCalled();
  });

  it("preserves official rejection identity and restores load order", async () => {
    const rejection = new Error("official rejection");
    const events: string[] = [];
    const official = vi.fn(async () => {
      events.push("official");
      throw rejection;
    });
    const dependencies = baseDependencies(
      [archive("a", digestA, [finding("path-write", "pathfinding")])],
      official,
      {
        prompt: () => "disable-mod",
        installTemporaryLoadOrder: () => {
          events.push("install");
          return {
            verify: () => {
              events.push("verify");
              return true;
            },
            restore: async () => {
              events.push("restore");
            },
          };
        },
      },
    );
    const gate = createModPreflightExecutionGate(dependencies);

    let received: unknown;
    try {
      await gate.run({ owner: "KD" }, [{}]);
    } catch (error) {
      received = error;
    }

    expect(received).toBe(rejection);
    expect(events).toEqual(["install", "verify", "official", "restore"]);
  });

  it("restores temporary state when identity drifts after installation", async () => {
    const archiveA = archive("a", digestA, [
      finding("path-write", "pathfinding"),
    ]);
    const official = vi.fn(() => ({}));
    let currentOfficial: Official = official;
    let restored = false;
    const dependencies = baseDependencies([archiveA], official, {
      getOfficialExecutor: () => currentOfficial,
      prompt: () => "disable-mod",
      installTemporaryLoadOrder: () => {
        currentOfficial = vi.fn(() => ({}));
        return {
          verify: () => true,
          restore: () => {
            restored = true;
          },
        };
      },
    });

    const outcome = await createModPreflightExecutionGate(dependencies).run(
      { owner: "KD" },
      [{}],
    );

    expect(outcome).toMatchObject({
      kind: "blocked",
      reason: "identity-drift",
    });
    expect(restored).toBe(true);
    expect(official).not.toHaveBeenCalled();
  });

  it("blocks post-install microtask drift before official evaluation and restores", async () => {
    const archiveA = archive("a", digestA, [
      finding("path-write", "pathfinding"),
    ]);
    const originalOrder = [archiveA];
    let liveOrder: readonly Archive[] = originalOrder;
    let restored = false;
    const official = vi.fn(() => ({}));
    const dependencies = baseDependencies([archiveA], official, {
      prompt: () => "disable-mod",
      installTemporaryLoadOrder: (enabled) => {
        const previous = liveOrder;
        liveOrder = [...enabled];
        queueMicrotask(() => {
          liveOrder = [archiveA];
        });
        return {
          verify: () =>
            liveOrder.length === enabled.length &&
            liveOrder.every((entry, index) => entry === enabled[index]),
          restore: () => {
            liveOrder = previous;
            restored = true;
          },
        };
      },
    });

    const outcome = await createModPreflightExecutionGate(dependencies).run(
      { owner: "KD" },
      [{}],
    );

    expect(outcome).toMatchObject({
      kind: "blocked",
      reason: "identity-drift",
    });
    expect(restored).toBe(true);
    expect(liveOrder).toBe(originalOrder);
    expect(official).not.toHaveBeenCalled();
  });

  it("maps installed-state verifier failures to load-order-failed and restores", async () => {
    const verificationError = new Error("lease verification failed");
    const archiveA = archive("a", digestA, [
      finding("path-write", "pathfinding"),
    ]);
    let restored = false;
    const official = vi.fn(() => ({}));
    const outcome = await createModPreflightExecutionGate(
      baseDependencies([archiveA], official, {
        prompt: () => "disable-mod",
        installTemporaryLoadOrder: () => ({
          verify: () => {
            throw verificationError;
          },
          restore: () => {
            restored = true;
          },
        }),
      }),
    ).run({ owner: "KD" }, [{}]);

    expect(outcome).toMatchObject({
      kind: "blocked",
      reason: "load-order-failed",
      error: verificationError,
    });
    expect(restored).toBe(true);
    expect(official).not.toHaveBeenCalled();
  });

  it("records restore failure without replacing the exact official rejection", async () => {
    const officialError = new Error("official failed");
    const restoreError = new Error("restore failed");
    const archiveA = archive("a", digestA, [
      finding("path-write", "pathfinding"),
    ]);
    const official = vi.fn(async () => {
      throw officialError;
    });
    const gate = createModPreflightExecutionGate(
      baseDependencies([archiveA], official, {
        prompt: () => "disable-mod",
        installTemporaryLoadOrder: () => ({
          verify: () => true,
          restore: () => {
            throw restoreError;
          },
        }),
      }),
    );

    expect(gate.lastDiagnostic()).toBeNull();
    let received: unknown;
    try {
      await gate.run({ owner: "KD" }, [{}]);
    } catch (error) {
      received = error;
    }

    expect(received).toBe(officialError);
    const diagnostic = gate.lastDiagnostic();
    expect(diagnostic).toEqual({
      code: "official-and-restore-failed",
      officialError,
      restoreError,
    });
    expect(Object.isFrozen(diagnostic)).toBe(true);
  });

  it("fails closed on archive and official identity drift", async () => {
    for (const drift of ["archive", "official"] as const) {
      const archiveA = archive("a", digestA, []);
      const official = vi.fn(() => ({}));
      let currentOfficial: Official = official;
      const dependencies = baseDependencies([archiveA], official, {
        getOfficialExecutor: () => currentOfficial,
        applyCompatibilityControls: () => {
          if (drift === "archive") {
            archiveA.digest = digestC;
          } else {
            currentOfficial = vi.fn(() => ({}));
          }
        },
      });

      const outcome = await createModPreflightExecutionGate(dependencies).run(
        { owner: "KD" },
        [{}],
      );

      expect(outcome).toMatchObject({
        kind: "blocked",
        reason: "identity-drift",
      });
      expect(official).not.toHaveBeenCalled();
    }
  });

  it("detects inventory order drift after scanning", async () => {
    const archiveA = archive("a", digestA, []);
    const archiveB = archive("b", digestB, []);
    let inventoryCalls = 0;
    const official = vi.fn(() => ({}));
    const dependencies = baseDependencies([archiveA, archiveB], official, {
      inventory: () => {
        inventoryCalls += 1;
        return inventoryCalls === 1
          ? [archiveA, archiveB]
          : [archiveB, archiveA];
      },
    });

    const outcome = await createModPreflightExecutionGate(dependencies).run(
      { owner: "KD" },
      [{}],
    );

    expect(outcome).toMatchObject({
      kind: "blocked",
      reason: "identity-drift",
    });
    expect(official).not.toHaveBeenCalled();
  });

  it("dispose during inspection blocks the pending activation", async () => {
    const releaseScan = deferred<void>();
    const official = vi.fn(() => ({}));
    const dependencies = baseDependencies(
      [archive("a", digestA, [])],
      official,
      {
        inspectArchive: async (entry) => {
          await releaseScan.promise;
          return candidate(entry);
        },
      },
    );
    const gate = createModPreflightExecutionGate(dependencies);
    const pending = gate.run({ owner: "KD" }, [{}]);

    gate.dispose();
    expect(gate.isDisposed()).toBe(true);
    releaseScan.resolve();
    const outcome = await pending;

    expect(outcome).toMatchObject({
      kind: "blocked",
      reason: "disposed",
    });
    expect(official).not.toHaveBeenCalled();
    await expect(gate.run({ owner: "KD" }, [{}])).resolves.toMatchObject({
      kind: "blocked",
      reason: "disposed",
    });
  });

  it("does not prompt for informational-only archives", async () => {
    const prompt = vi.fn(async () => "keep-optimizations" as const);
    const dependencies = baseDependencies(
      [
        archive("info", digestA, [
          {
            ...finding("cache-read", "pathfinding"),
            confidence: "informational",
          },
        ]),
      ],
      vi.fn(() => ({})),
      { prompt },
    );

    const outcome = await createModPreflightExecutionGate(dependencies).run(
      { owner: "KD" },
      [{}],
    );

    expect(outcome.kind).toBe("executed");
    expect(prompt).not.toHaveBeenCalled();
    expect(outcome.status).toEqual({
      disabledMods: [],
      forcedUnstableMods: [],
      compatibilityMods: [],
      disabledSubsystems: [],
      restartRequired: false,
    });
  });
});

function baseDependencies(
  archives: readonly Archive[],
  official: Official,
  overrides: Partial<
    ModPreflightDependencies<
      Archive,
      { readonly owner: string },
      readonly [object],
      object
    >
  > = {},
): ModPreflightDependencies<
  Archive,
  { readonly owner: string },
  readonly [object],
  object
> {
  return {
    inventory: () => archives,
    identifyArchive: (entry) => ({
      key: entry.key,
      digest: entry.digest,
    }),
    inspectArchive: (entry) => candidate(entry),
    applyCompatibilityControls: () => undefined,
    verifyCurrentLoadOrder: () => true,
    installTemporaryLoadOrder: () => ({
      verify: () => true,
      restore: () => undefined,
    }),
    getOfficialExecutor: () => official,
    ...overrides,
  };
}

function archive(
  key: string,
  digest: string,
  findings: ModCompatibilityCandidate["findings"],
): Archive {
  return {
    key,
    digest,
    name: `Mod ${key}`,
    findings,
  };
}

function candidate(entry: Archive): ModCompatibilityCandidate {
  return {
    name: entry.name,
    digest: entry.digest,
    findings: entry.findings,
  };
}

function finding(
  ruleId: string,
  subsystem:
    | "buff-event-index"
    | "enemy-position-cache"
    | "pathfinding"
    | "source-optimizations",
  restartRequired = false,
) {
  return {
    ruleId,
    confidence: "high" as const,
    subsystem,
    reason: ruleId,
    restartRequired,
  };
}

function remembered(digest: string, choice: ModCompatibilityChoice) {
  return {
    digest,
    choice,
    context: {
      kdVersion: "5.4.92",
      bundleSha256: digestC,
      hybridVersion: "0.1.2",
      ruleVersion: 1,
    },
    rememberedAt: "2026-07-31T00:00:00.000Z",
  } as const;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
