// SPDX-License-Identifier: MIT

import type {
  ModCompatibilityCandidate,
  ModCompatibilityDecisionStore,
  ModCompatibilitySessionStatus,
} from "./mod-compatibility-decisions.js";
import type {
  ModCompatibilityManagedMod,
  ModCompatibilityRuntimeStatus,
  ModCompatibilityUiController,
} from "./mod-compatibility-ui.js";
import {
  type KDModLoaderEntry,
  readArchiveWithKDZipModel,
  type LegacyModArchive,
  type LegacyModArchiveReader,
} from "./mod-api-translator.js";
import {
  createModPreflightExecutionGate,
  type ModPreflightDiagnostic,
  type ModPreflightBlockedReason,
  type ModPreflightExecutionGate,
  type ModPreflightLoadOrderInstallation,
} from "./mod-preflight-loader.js";
import {
  createModPreflightScanner,
  type ModPreflightReport,
  type ModPreflightScanner,
} from "./mod-preflight-scanner.js";

export type KinkyDungeonModPreflightState =
  | "waiting"
  | "ready"
  | "scanning"
  | "executed"
  | "blocked"
  | "failed"
  | "disposed";

export interface KinkyDungeonModPreflightStatus {
  readonly state: KinkyDungeonModPreflightState;
  readonly blockedReason: ModPreflightBlockedReason | null;
  readonly candidates: readonly ModCompatibilityCandidate[];
  readonly session: ModCompatibilitySessionStatus;
  readonly lastError: string | null;
  readonly diagnostic: ModPreflightDiagnostic | null;
}

export interface KinkyDungeonModPreflightHandle {
  readonly loaderReady: Promise<boolean>;
  status(): KinkyDungeonModPreflightStatus;
  /**
   * Returns the current activation's settlement promise, or undefined when no
   * activation is in flight. Callers can retain compatibility controls until
   * this settles during shutdown.
   */
  drain(): Promise<void> | undefined;
  showManager(): void;
  forget(digest: string): boolean;
  forgetAll(): number;
  dispose(): void;
}

export interface KDModPreflightLoaderEntry extends KDModLoaderEntry {
  readonly fileorder?: readonly string[];
}

export interface KDModPreflightHostEnvironment {
  readExecuteMods(): ((...args: unknown[]) => unknown) | undefined;
  replaceExecuteMods(
    expected: (...args: unknown[]) => unknown,
    replacement: (...args: unknown[]) => unknown,
  ): boolean;
  readModExecutionComplete(): boolean | undefined;
  writeModExecutionComplete(value: boolean): boolean;
  readAwaitingModLoad(): boolean | undefined;
  writeAwaitingModLoad(value: boolean): boolean;
  readOfflineMode(): boolean | undefined;
  readPersistedModList(): string | null | undefined;
  writePersistedModList(value: string | null): boolean;
  readModLoadOrder(): readonly KDModPreflightLoaderEntry[] | undefined;
  writeModLoadOrder(entries: readonly KDModPreflightLoaderEntry[]): boolean;
  readModRegistry(): Readonly<Record<string, Blob>> | undefined;
  writeModRegistry(registry: Readonly<Record<string, Blob>>): boolean;
  schedule(callback: () => void, delayMs: number): unknown;
  cancelScheduled(handle: unknown): void;
}

export interface KinkyDungeonModPreflightOptions {
  readonly environment?: KDModPreflightHostEnvironment;
  readonly scanner?: ModPreflightScanner;
  readonly readArchive?: LegacyModArchiveReader;
  readonly digest?: (blob: Blob) => Promise<string>;
  readonly decisionStore?: ModCompatibilityDecisionStore;
  readonly ui?: ModCompatibilityUiController;
  readonly applyCompatibilityControls: (
    status: ModCompatibilitySessionStatus,
    candidates: readonly ModCompatibilityCandidate[],
  ) => void | PromiseLike<void>;
  readonly sourceOptimizationsActive?: boolean;
  readonly waitFor?: PromiseLike<boolean>;
  /**
   * Optional startup barrier (normally native adapter registration). The hook
   * is installed before this settles, but no official mod evaluation can run
   * until it has settled successfully.
   */
  readonly activationBarrier?: PromiseLike<unknown>;
  readonly installDeadlineMs?: number;
  readonly target?: {
    KDHybridModPreflight?: KinkyDungeonModPreflightHandle;
  };
}

interface PreparedArchive {
  readonly entry: KDModPreflightLoaderEntry;
  readonly archive: LegacyModArchive;
  readonly index: number;
  readonly key: string;
  readonly digest: string;
}

const EMPTY_STATUS: ModCompatibilitySessionStatus = Object.freeze({
  disabledMods: Object.freeze([]),
  forcedUnstableMods: Object.freeze([]),
  compatibilityMods: Object.freeze([]),
  disabledSubsystems: Object.freeze([]),
  restartRequired: false,
});
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

declare let KDExecuteMods: ((...args: unknown[]) => unknown) | undefined;
declare let KDExecuted: boolean | undefined;
declare let KDAwaitingModLoad: boolean | undefined;
declare let KDOffline: boolean | undefined;
declare let KDModLoadOrder: readonly KDModPreflightLoaderEntry[] | undefined;
declare let KDMods: Readonly<Record<string, Blob>> | undefined;

const browserHostEnvironment: KDModPreflightHostEnvironment = {
  readExecuteMods: () => {
    try {
      return typeof KDExecuteMods === "function" ? KDExecuteMods : undefined;
    } catch {
      return undefined;
    }
  },
  replaceExecuteMods: (expected, replacement) => {
    try {
      if (KDExecuteMods !== expected) {
        return false;
      }
      KDExecuteMods = replacement;
      return KDExecuteMods === replacement;
    } catch {
      return false;
    }
  },
  readModExecutionComplete: () => {
    try {
      return typeof KDExecuted === "boolean" ? KDExecuted : undefined;
    } catch {
      return undefined;
    }
  },
  writeModExecutionComplete: (value) => {
    try {
      if (typeof KDExecuted !== "boolean") {
        return false;
      }
      KDExecuted = value;
      return KDExecuted === value;
    } catch {
      return false;
    }
  },
  readAwaitingModLoad: () => {
    try {
      return typeof KDAwaitingModLoad === "boolean"
        ? KDAwaitingModLoad
        : undefined;
    } catch {
      return undefined;
    }
  },
  writeAwaitingModLoad: (value) => {
    try {
      if (typeof KDAwaitingModLoad !== "boolean") {
        return false;
      }
      KDAwaitingModLoad = value;
      return KDAwaitingModLoad === value;
    } catch {
      return false;
    }
  },
  readOfflineMode: () => {
    try {
      return typeof KDOffline === "boolean" ? KDOffline : undefined;
    } catch {
      return undefined;
    }
  },
  readPersistedModList: () => {
    try {
      return typeof localStorage === "object" && localStorage !== null
        ? localStorage.getItem("KDMods")
        : undefined;
    } catch {
      return undefined;
    }
  },
  writePersistedModList: (value) => {
    try {
      if (typeof localStorage !== "object" || localStorage === null) {
        return false;
      }
      if (value === null) {
        localStorage.removeItem("KDMods");
        return localStorage.getItem("KDMods") === null;
      }
      localStorage.setItem("KDMods", value);
      return localStorage.getItem("KDMods") === value;
    } catch {
      return false;
    }
  },
  readModLoadOrder: () => {
    try {
      return Array.isArray(KDModLoadOrder) ? KDModLoadOrder : undefined;
    } catch {
      return undefined;
    }
  },
  writeModLoadOrder: (entries) => {
    try {
      KDModLoadOrder = entries;
      return KDModLoadOrder === entries;
    } catch {
      return false;
    }
  },
  readModRegistry: () => {
    try {
      return typeof KDMods === "object" && KDMods !== null ? KDMods : undefined;
    } catch {
      return undefined;
    }
  },
  writeModRegistry: (registry) => {
    try {
      KDMods = registry;
      return KDMods === registry;
    } catch {
      return false;
    }
  },
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancelScheduled: (handle) =>
    clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Installs a fail-closed, pre-evaluation gate around KD 5.4.92's official
 * asynchronous mod executor. No archive source is evaluated by this module.
 */
export function installKinkyDungeonModPreflight(
  options: KinkyDungeonModPreflightOptions,
): KinkyDungeonModPreflightHandle {
  if (typeof options?.applyCompatibilityControls !== "function") {
    throw new TypeError("A compatibility-control applicator is required");
  }
  const environment = options.environment ?? browserHostEnvironment;
  const digest = memoizeBlobDigest(options.digest ?? sha256Blob);
  const scanner =
    options.scanner ??
    createModPreflightScanner({
      readArchive: options.readArchive ?? readArchiveWithKDZipModel,
      digest,
    });
  const sourceOptimizationsActive = options.sourceOptimizationsActive !== false;
  const target =
    options.target ??
    (globalThis as {
      KDHybridModPreflight?: KinkyDungeonModPreflightHandle;
    });
  const previousTarget = target.KDHybridModPreflight;
  const candidates = new Map<string, ModCompatibilityCandidate>();
  let state: KinkyDungeonModPreflightState = "waiting";
  let blockedReason: ModPreflightBlockedReason | null = null;
  let session = EMPTY_STATUS;
  let lastError: string | null = null;
  let disposed = false;
  let scheduled: unknown;
  let official: ((...args: unknown[]) => unknown) | undefined;
  let gateOfficial: ((...args: unknown[]) => unknown) | undefined;
  let replacement: ((...args: unknown[]) => Promise<unknown>) | undefined;
  let gate:
    ModPreflightExecutionGate<unknown, readonly unknown[], unknown> | undefined;
  let activeRun: Promise<unknown> | undefined;
  let officialInvocationStarted = false;
  let restoreAwaitingAfterPreflight: (() => void) | undefined;
  let allDisabledStateVerified = false;
  let syntheticExecutionPrevious: boolean | undefined;
  let syntheticExecutionInstalled = false;
  let resolveReady: ((ready: boolean) => void) | undefined;
  let hookInstalled = false;
  let prerequisiteState: "pending" | "ready" | "blocked" =
    options.waitFor === undefined ? "ready" : "pending";
  const loaderReady = new Promise<boolean>((resolve) => {
    resolveReady = resolve;
  });
  const settleLoaderReady = (): void => {
    if (resolveReady === undefined || !hookInstalled) {
      return;
    }
    if (disposed) {
      resolveReady(false);
      resolveReady = undefined;
    } else if (prerequisiteState === "ready") {
      state = "ready";
      resolveReady(true);
      resolveReady = undefined;
    } else if (prerequisiteState === "blocked") {
      state = "blocked";
      resolveReady(false);
      resolveReady = undefined;
    }
  };
  const prerequisiteReady =
    options.waitFor === undefined
      ? Promise.resolve(true)
      : Promise.resolve(options.waitFor).then(
          (ready) => {
            prerequisiteState = ready ? "ready" : "blocked";
            if (!ready && !disposed) {
              state = "blocked";
              lastError = "prerequisite-loader-hook-unavailable";
            }
            settleLoaderReady();
            return ready;
          },
          () => {
            prerequisiteState = "blocked";
            if (!disposed) {
              state = "blocked";
              lastError = "prerequisite-loader-hook-failed";
            }
            settleLoaderReady();
            return false;
          },
        );
  const rollbackSyntheticExecution = (): void => {
    if (!syntheticExecutionInstalled) {
      return;
    }
    if (
      syntheticExecutionPrevious === undefined ||
      !environment.writeModExecutionComplete(syntheticExecutionPrevious)
    ) {
      throw new Error("mod-execution-latch-restore-failed");
    }
    syntheticExecutionInstalled = false;
    syntheticExecutionPrevious = undefined;
  };
  const commitSyntheticExecution = (): void => {
    syntheticExecutionInstalled = false;
    syntheticExecutionPrevious = undefined;
  };

  const currentStatus = (): KinkyDungeonModPreflightStatus =>
    Object.freeze({
      state,
      blockedReason,
      candidates: Object.freeze([...candidates.values()]),
      session,
      lastError,
      diagnostic: gate?.lastDiagnostic() ?? null,
    });

  const managedMods = (): readonly ModCompatibilityManagedMod[] =>
    Object.freeze(
      [...candidates.values()].map((candidate) =>
        Object.freeze({
          candidate,
          ...(session.restartRequired &&
          session.compatibilityMods.includes(candidate.digest) &&
          candidate.findings.some((finding) => finding.restartRequired === true)
            ? { restartRequired: true }
            : {}),
          ...(state !== "executed" ||
          runtimeStatus(candidate.digest, session) === null
            ? {}
            : {
                status: runtimeStatus(
                  candidate.digest,
                  session,
                ) as ModCompatibilityRuntimeStatus,
              }),
        }),
      ),
    );

  const handle: KinkyDungeonModPreflightHandle = Object.freeze({
    loaderReady,
    status: currentStatus,
    drain: () => {
      const pending = activeRun;
      return pending === undefined
        ? undefined
        : pending.then(
            () => undefined,
            () => undefined,
          );
    },
    showManager: () => {
      try {
        options.ui?.showManager(managedMods());
      } catch {
        // A presentation failure cannot alter execution policy.
      }
    },
    forget: (digestInput: string) => {
      try {
        return (
          options.ui?.forget(digestInput) ??
          options.decisionStore?.forget(digestInput) ??
          false
        );
      } catch {
        return false;
      }
    },
    forgetAll: () => {
      try {
        return (
          options.ui?.forgetAll() ?? options.decisionStore?.forgetAll() ?? 0
        );
      } catch {
        return 0;
      }
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      state = "disposed";
      gate?.dispose();
      options.ui?.dispose();
      if (
        activeRun !== undefined &&
        !officialInvocationStarted &&
        restoreAwaitingAfterPreflight !== undefined
      ) {
        try {
          restoreAwaitingAfterPreflight();
        } catch (error) {
          lastError = safeErrorMessage(error);
        }
      }
      if (scheduled !== undefined) {
        environment.cancelScheduled(scheduled);
      }
      if (official !== undefined && replacement !== undefined) {
        environment.replaceExecuteMods(replacement, official);
      }
      if (target.KDHybridModPreflight === handle) {
        if (previousTarget === undefined) {
          Reflect.deleteProperty(target, "KDHybridModPreflight");
        } else {
          target.KDHybridModPreflight = previousTarget;
        }
      }
      resolveReady?.(false);
      resolveReady = undefined;
    },
  });
  target.KDHybridModPreflight = handle;

  const install = (): void => {
    if (disposed) {
      resolveReady?.(false);
      resolveReady = undefined;
      return;
    }
    const candidate = environment.readExecuteMods();
    if (candidate === undefined) {
      if (Date.now() >= deadline) {
        state = "blocked";
        lastError = "official-mod-executor-unavailable";
        resolveReady?.(false);
        resolveReady = undefined;
        return;
      }
      attempts += 1;
      scheduled = environment.schedule(install, attempts < 4 ? 0 : 25);
      return;
    }
    official = candidate;
    gateOfficial = function KDExecuteMods(
      this: unknown,
      ...args: unknown[]
    ): unknown {
      restoreAwaitingAfterPreflight?.();
      if (allDisabledStateVerified) {
        const previousExecution = environment.readModExecutionComplete();
        if (
          previousExecution === undefined ||
          !environment.writeModExecutionComplete(true)
        ) {
          throw new Error("mod-execution-latch-unavailable");
        }
        syntheticExecutionPrevious = previousExecution;
        syntheticExecutionInstalled = true;
      }
      officialInvocationStarted = true;
      return Reflect.apply(candidate, this, args);
    };
    copyFunctionName(gateOfficial, candidate);
    replacement = function KDExecuteMods(
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      if (activeRun !== undefined) {
        return Promise.resolve(undefined);
      }
      if (gate === undefined || disposed) {
        return Promise.resolve(undefined);
      }
      if (officialWouldNoOp(environment)) {
        return invokeAsPromise(candidate, this, args);
      }
      const previousAwaiting = environment.readAwaitingModLoad();
      if (
        previousAwaiting === undefined ||
        (previousAwaiting !== true && !environment.writeAwaitingModLoad(true))
      ) {
        state = "blocked";
        blockedReason = null;
        lastError = "mod-load-input-latch-unavailable";
        return Promise.resolve(undefined);
      }
      let awaitingRestored = false;
      restoreAwaitingAfterPreflight = () => {
        if (awaitingRestored) {
          return;
        }
        if (!environment.writeAwaitingModLoad(previousAwaiting)) {
          throw new Error("mod-load-input-latch-restore-failed");
        }
        awaitingRestored = true;
      };
      officialInvocationStarted = false;
      allDisabledStateVerified = false;
      syntheticExecutionPrevious = undefined;
      syntheticExecutionInstalled = false;
      state = "scanning";
      blockedReason = null;
      lastError = null;
      session = EMPTY_STATUS;
      candidates.clear();
      const run = (async (): Promise<unknown> => {
        if (prerequisiteState !== "ready") {
          const ready = await prerequisiteReady;
          if (!ready) {
            if (!disposed) {
              state = "blocked";
              blockedReason = null;
              lastError = lastError ?? "prerequisite-loader-hook-unavailable";
            }
            return undefined;
          }
        }
        if (options.activationBarrier !== undefined) {
          try {
            await options.activationBarrier;
          } catch {
            if (!disposed) {
              state = "blocked";
              blockedReason = null;
              lastError = "activation-prerequisite-failed";
            }
            return undefined;
          }
        }
        if (disposed || gate === undefined) {
          state = disposed ? "disposed" : "blocked";
          blockedReason = disposed ? "disposed" : null;
          lastError = disposed ? "disposed" : "activation-gate-unavailable";
          return undefined;
        }
        const outcome = await gate.run(this, args);
        {
          session = outcome.status;
          if (outcome.kind === "blocked") {
            rollbackSyntheticExecution();
          } else {
            commitSyntheticExecution();
          }
          if (disposed) {
            return outcome.kind === "executed" ? outcome.result : undefined;
          }
          if (outcome.kind === "blocked") {
            state = "blocked";
            blockedReason = outcome.reason;
            lastError = outcome.reason;
            if (
              outcome.reason === "restart-required" &&
              options.ui !== undefined
            ) {
              try {
                options.ui.showManager(managedMods());
              } catch {
                // An actionable presentation attempt cannot relax the block.
              }
            }
            return undefined;
          }
          state = "executed";
          blockedReason = null;
          return outcome.result;
        }
      })().catch((error: unknown) => {
        try {
          rollbackSyntheticExecution();
        } catch (rollbackError) {
          if (!disposed) {
            lastError = safeErrorMessage(rollbackError);
          }
        }
        if (!disposed) {
          state = "failed";
          blockedReason = null;
          lastError = safeErrorMessage(error);
        }
        throw error;
      });
      let finalized: Promise<unknown>;
      finalized = run.finally(() => {
        if (!officialInvocationStarted) {
          restoreAwaitingAfterPreflight?.();
        }
        restoreAwaitingAfterPreflight = undefined;
        if (activeRun === finalized) {
          activeRun = undefined;
        }
      });
      activeRun = finalized;
      return finalized;
    };
    copyFunctionName(replacement, candidate);
    if (!environment.replaceExecuteMods(candidate, replacement)) {
      official = undefined;
      gateOfficial = undefined;
      replacement = undefined;
      if (Date.now() >= deadline) {
        state = "blocked";
        lastError = "official-mod-executor-replacement-failed";
        resolveReady?.(false);
        resolveReady = undefined;
        return;
      }
      attempts += 1;
      if (synchronousReplacementRetries < 16) {
        synchronousReplacementRetries += 1;
        install();
      } else {
        synchronousReplacementRetries = 0;
        scheduled = environment.schedule(install, attempts < 20 ? 0 : 25);
      }
      return;
    }
    synchronousReplacementRetries = 0;
    hookInstalled = true;
    try {
      gate = createModPreflightExecutionGate<
        PreparedArchive,
        unknown,
        readonly unknown[],
        unknown
      >({
        inventory: async () => {
          const order = environment.readModLoadOrder();
          if (order === undefined) {
            throw new Error("mod-load-order-unavailable");
          }
          return prepareInventory(order, digest, scanner);
        },
        identifyArchive: (archive) => identifyPreparedArchive(archive),
        inspectArchive: async (archive, identity) => {
          const report = await scanner.scan(archive.archive);
          const candidateResult = candidateFromModPreflightReport(
            report,
            sourceOptimizationsActive,
          );
          if (
            candidateResult.digest !== identity.digest ||
            candidateResult.digest !== archive.digest
          ) {
            throw new Error("scanner-archive-identity-drift");
          }
          candidates.set(candidateResult.digest, candidateResult);
          return candidateResult;
        },
        ...(options.decisionStore === undefined
          ? {}
          : { decisionStore: options.decisionStore }),
        ...(options.ui === undefined
          ? {}
          : {
              prompt: (candidateInput: ModCompatibilityCandidate) =>
                options.ui!.prompt(candidateInput),
            }),
        headless: options.ui === undefined,
        applyCompatibilityControls: (status, candidateInputs) => {
          const inputs = compatibilityControlInputs(
            status,
            candidateInputs,
            sourceOptimizationsActive,
          );
          return options.applyCompatibilityControls(
            inputs.status,
            inputs.candidates,
          );
        },
        verifyCurrentLoadOrder: (enabled) =>
          verifyPreparedModState(environment, enabled),
        installTemporaryLoadOrder: (enabled) =>
          installFilteredModState(environment, enabled, () => {
            allDisabledStateVerified = true;
          }),
        getOfficialExecutor: () => {
          const current = environment.readExecuteMods();
          return current === replacement
            ? gateOfficial!
            : (current as (...args: readonly unknown[]) => unknown);
        },
      });
    } catch (error) {
      state = "blocked";
      lastError = safeErrorMessage(error);
      resolveReady?.(false);
      resolveReady = undefined;
      gate = undefined;
      return;
    }
    settleLoaderReady();
  };

  const deadline = Date.now() + normalizeDeadline(options.installDeadlineMs);
  let attempts = 0;
  let synchronousReplacementRetries = 0;
  install();
  return handle;
}

export function candidateFromModPreflightReport(
  report: ModPreflightReport,
  sourceOptimizationsActive = true,
): ModCompatibilityCandidate {
  const digest = report.digestSha256?.toLowerCase();
  if (digest === undefined || !SHA256_PATTERN.test(digest)) {
    throw new RangeError(
      "A valid archive digest is required for a compatibility decision",
    );
  }
  const findings = report.risks.flatMap((risk, riskIndex) => {
    if (
      risk.level === "safe" ||
      (risk.subsystem === "source-optimizations" && !sourceOptimizationsActive)
    ) {
      return [];
    }
    const matchingEvidence = risk.evidence.filter(
      (entry) => entry.subsystem === risk.subsystem,
    );
    const values =
      matchingEvidence.length === 0
        ? [
            {
              confidence:
                risk.level === "compatibility-required"
                  ? ("high" as const)
                  : ("informational" as const),
              reason: `${risk.subsystem} requires conservative compatibility handling`,
              kind: "analysis-uncertainty",
            },
          ]
        : matchingEvidence.map((evidence) => ({
            confidence:
              evidence.level === "compatibility-required"
                ? ("high" as const)
                : ("informational" as const),
            reason: evidence.reason,
            kind: evidence.kind,
          }));
    if (
      risk.level === "compatibility-required" &&
      !values.some((value) => value.confidence === "high")
    ) {
      values.push({
        confidence: "high",
        reason: `${risk.subsystem} requires conservative compatibility handling`,
        kind: "analysis-uncertainty",
      });
    }
    return values.map((value, evidenceIndex) =>
      Object.freeze({
        ruleId: `preflight-v${report.version}:${riskIndex}:${evidenceIndex}:${value.kind}`,
        confidence: value.confidence,
        subsystem: risk.subsystem,
        reason: value.reason,
        ...(risk.subsystem === "source-optimizations" &&
        value.confidence === "high" &&
        sourceOptimizationsActive
          ? { restartRequired: true }
          : {}),
      }),
    );
  });
  return Object.freeze({
    name: report.name,
    digest,
    findings: Object.freeze(findings),
  });
}

async function prepareInventory(
  order: readonly KDModPreflightLoaderEntry[],
  digest: (blob: Blob) => Promise<string>,
  scanner: ModPreflightScanner,
): Promise<readonly PreparedArchive[]> {
  if (!Array.isArray(order)) {
    throw new TypeError("mod-load-order-invalid");
  }
  const prepared = await Promise.all(
    order.map(async (entry, index) => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof entry.name !== "string" ||
        entry.name.trim().length === 0 ||
        !isBlobLike(entry.mod)
      ) {
        throw new TypeError("mod-load-order-entry-invalid");
      }
      if (entry.mod.size > scanner.limits.maxArchiveBytes) {
        throw new RangeError("mod-archive-size-limit");
      }
      const archiveDigest = normalizeDigest(await digest(entry.mod));
      return Object.freeze({
        entry,
        archive: Object.freeze({
          name: entry.name,
          blob: entry.mod,
        }),
        index,
        key: `${index}:${entry.name}`,
        digest: archiveDigest,
      });
    }),
  );
  return Object.freeze(prepared);
}

function identifyPreparedArchive(archive: PreparedArchive): {
  readonly key: string;
  readonly digest: string;
} {
  if (
    archive.entry.name !== archive.archive.name ||
    archive.entry.mod !== archive.archive.blob
  ) {
    throw new Error("mod-archive-entry-drift");
  }
  return Object.freeze({
    key: archive.key,
    digest: archive.digest,
  });
}

function installFilteredModState(
  environment: KDModPreflightHostEnvironment,
  enabled: readonly PreparedArchive[],
  onVerifiedAllDisabled: () => void,
): ModPreflightLoadOrderInstallation {
  const originalOrder = environment.readModLoadOrder();
  const originalRegistry = environment.readModRegistry();
  if (originalOrder === undefined || originalRegistry === undefined) {
    throw new Error("official-mod-state-unavailable");
  }
  const enabledByName = new Map(
    enabled.map((archive) => [archive.entry.name, archive]),
  );
  const allByName = validateOfficialModState(originalOrder, originalRegistry);
  for (const archive of enabled) {
    const officialEntry = allByName.get(archive.entry.name);
    if (
      officialEntry !== archive.entry ||
      officialEntry.mod !== archive.archive.blob
    ) {
      throw new Error("official-mod-state-identity-drift");
    }
  }
  if (enabled.length === originalOrder.length) {
    return Object.freeze({
      verify: () => verifyPreparedModState(environment, enabled),
      restore: () => {},
    });
  }
  const disabledNames = new Set(
    originalOrder
      .filter((entry) => !enabledByName.has(entry.name))
      .map((entry) => entry.name),
  );
  const offlineMode = environment.readOfflineMode();
  if (offlineMode === undefined) {
    throw new Error("official-offline-mode-unavailable");
  }
  const persistedModList =
    offlineMode === true ? environment.readPersistedModList() : undefined;
  if (offlineMode === true && persistedModList === undefined) {
    throw new Error("persisted-mod-list-unavailable");
  }
  const filteredOrder = Object.freeze(
    originalOrder.filter((entry) => enabledByName.has(entry.name)),
  );
  const filteredRegistry = filterModRegistry(originalRegistry, enabledByName);

  if (!environment.writeModLoadOrder(filteredOrder)) {
    throw new Error("temporary-mod-load-order-install-failed");
  }
  if (!environment.writeModRegistry(filteredRegistry)) {
    environment.writeModLoadOrder(originalOrder);
    throw new Error("temporary-mod-registry-install-failed");
  }

  let restored = false;
  const restore = (): void => {
    if (restored) {
      return;
    }
    restored = true;
    const currentRegistry = environment.readModRegistry();
    const currentOrder = environment.readModLoadOrder();
    if (currentRegistry === undefined || currentOrder === undefined) {
      environment.writeModRegistry(originalRegistry);
      environment.writeModLoadOrder(originalOrder);
      if (offlineMode === true) {
        environment.writePersistedModList(persistedModList!);
      }
      throw new Error("official-mod-state-restore-source-unavailable");
    }
    validateOfficialModState(currentOrder, currentRegistry);
    const restoredOrder = mergeFilteredLoadOrder(
      currentOrder,
      originalOrder,
      disabledNames,
    );
    const restoredRegistry = mergeFilteredRegistry(
      currentRegistry,
      originalRegistry,
      disabledNames,
      restoredOrder,
    );
    const registryRestored = environment.writeModRegistry(restoredRegistry);
    const orderRestored = environment.writeModLoadOrder(restoredOrder);
    const persistedRestored =
      offlineMode !== true ||
      environment.writePersistedModList(persistedModList!);
    if (!registryRestored || !orderRestored || !persistedRestored) {
      if (!registryRestored) {
        environment.writeModRegistry(originalRegistry);
      }
      if (!orderRestored) {
        environment.writeModLoadOrder(originalOrder);
      }
      throw new Error("official-mod-state-restore-failed");
    }
  };
  return Object.freeze({
    verify: () => {
      const verified = verifyPreparedModState(environment, enabled);
      if (verified && enabled.length === 0) {
        onVerifiedAllDisabled();
      }
      return verified;
    },
    restore,
  });
}

function verifyPreparedModState(
  environment: KDModPreflightHostEnvironment,
  expected: readonly PreparedArchive[],
): boolean {
  const order = environment.readModLoadOrder();
  const registry = environment.readModRegistry();
  if (
    order === undefined ||
    registry === undefined ||
    order.length !== expected.length
  ) {
    return false;
  }
  const byName = validateOfficialModState(order, registry);
  return expected.every((archive, index) => {
    const entry = order[index];
    return (
      entry === archive.entry &&
      byName.get(archive.entry.name) === archive.entry &&
      archive.entry.mod === archive.archive.blob
    );
  });
}

function validateOfficialModState(
  order: readonly KDModPreflightLoaderEntry[],
  registry: Readonly<Record<string, Blob>>,
): ReadonlyMap<string, KDModPreflightLoaderEntry> {
  const byName = new Map<string, KDModPreflightLoaderEntry>();
  for (const entry of order) {
    if (byName.has(entry.name)) {
      throw new Error("duplicate-mod-load-order-name");
    }
    byName.set(entry.name, entry);
  }
  const enumerableNames: string[] = [];
  for (const key of Reflect.ownKeys(registry)) {
    if (typeof key !== "string") {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(registry, key);
    if (descriptor?.enumerable !== true) {
      continue;
    }
    if (!("value" in descriptor) || !isBlobLike(descriptor.value)) {
      throw new Error("mod-registry-entry-invalid");
    }
    enumerableNames.push(key);
    const orderEntry = byName.get(key);
    if (orderEntry === undefined || orderEntry.mod !== descriptor.value) {
      throw new Error("mod-registry-load-order-drift");
    }
  }
  if (enumerableNames.length !== order.length) {
    throw new Error("mod-registry-load-order-count-drift");
  }
  return byName;
}

function filterModRegistry(
  registry: Readonly<Record<string, Blob>>,
  enabledByName: ReadonlyMap<string, PreparedArchive>,
): Readonly<Record<string, Blob>> {
  const descriptors = Object.getOwnPropertyDescriptors(registry);
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (descriptor.enumerable && !enabledByName.has(name)) {
      Reflect.deleteProperty(descriptors, name);
    }
  }
  return Object.create(
    Object.getPrototypeOf(registry),
    descriptors,
  ) as Readonly<Record<string, Blob>>;
}

function mergeFilteredRegistry(
  current: Readonly<Record<string, Blob>>,
  original: Readonly<Record<string, Blob>>,
  disabledNames: ReadonlySet<string>,
  restoredOrder: readonly KDModPreflightLoaderEntry[],
): Readonly<Record<string, Blob>> {
  const currentDescriptors = Object.getOwnPropertyDescriptors(current);
  const originalDescriptors = Object.getOwnPropertyDescriptors(original);
  const descriptors: PropertyDescriptorMap = {};
  for (const entry of restoredOrder) {
    const descriptor = disabledNames.has(entry.name)
      ? originalDescriptors[entry.name]
      : currentDescriptors[entry.name];
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      descriptor.value !== entry.mod
    ) {
      throw new Error("restored-mod-registry-entry-invalid");
    }
    Object.defineProperty(descriptors, entry.name, {
      configurable: true,
      enumerable: true,
      value: descriptor,
      writable: true,
    });
  }
  for (const key of Reflect.ownKeys(current)) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (
      descriptor !== undefined &&
      descriptor.enumerable !== true &&
      !Object.prototype.hasOwnProperty.call(descriptors, key)
    ) {
      Object.defineProperty(descriptors, key, {
        configurable: true,
        enumerable: true,
        value: descriptor,
        writable: true,
      });
    }
  }
  const merged = Object.create(
    Object.getPrototypeOf(current),
    descriptors,
  ) as Readonly<Record<string, Blob>>;
  return propertyDescriptorsEqual(merged, original) ? original : merged;
}

function mergeFilteredLoadOrder(
  current: readonly KDModPreflightLoaderEntry[],
  original: readonly KDModPreflightLoaderEntry[],
  disabledNames: ReadonlySet<string>,
): readonly KDModPreflightLoaderEntry[] {
  const seen = new Set<string>();
  const merged = current.filter((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof entry.name !== "string" ||
      !isBlobLike(entry.mod) ||
      seen.has(entry.name)
    ) {
      throw new Error("restored-mod-load-order-entry-invalid");
    }
    seen.add(entry.name);
    return !disabledNames.has(entry.name);
  });
  for (const disabled of original.filter((entry) =>
    disabledNames.has(entry.name),
  )) {
    const originalIndex = original.indexOf(disabled);
    const nextEnabled = original
      .slice(originalIndex + 1)
      .find(
        (entry) =>
          !disabledNames.has(entry.name) &&
          merged.some((currentEntry) => currentEntry.name === entry.name),
      );
    const insertionIndex =
      nextEnabled === undefined
        ? merged.length
        : merged.findIndex((entry) => entry.name === nextEnabled.name);
    merged.splice(insertionIndex, 0, disabled);
  }
  return merged.length === original.length &&
    merged.every((entry, index) => entry === original[index])
    ? original
    : Object.freeze(merged);
}

function propertyDescriptorsEqual(left: object, right: object): boolean {
  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) {
    return false;
  }
  const leftKeys = Reflect.ownKeys(left);
  const rightKeys = Reflect.ownKeys(right);
  if (
    leftKeys.length !== rightKeys.length ||
    leftKeys.some((key, index) => key !== rightKeys[index])
  ) {
    return false;
  }
  return leftKeys.every((key) => {
    const leftDescriptor = Object.getOwnPropertyDescriptor(left, key);
    const rightDescriptor = Object.getOwnPropertyDescriptor(right, key);
    if (leftDescriptor === undefined || rightDescriptor === undefined) {
      return false;
    }
    return (
      leftDescriptor.configurable === rightDescriptor.configurable &&
      leftDescriptor.enumerable === rightDescriptor.enumerable &&
      "value" in leftDescriptor === "value" in rightDescriptor &&
      ("value" in leftDescriptor
        ? Object.is(leftDescriptor.value, rightDescriptor.value) &&
          leftDescriptor.writable === rightDescriptor.writable
        : leftDescriptor.get === rightDescriptor.get &&
          leftDescriptor.set === rightDescriptor.set)
    );
  });
}

function officialWouldNoOp(
  environment: KDModPreflightHostEnvironment,
): boolean {
  if (environment.readModExecutionComplete() === true) {
    return true;
  }
  const order = environment.readModLoadOrder();
  return order !== undefined && Object.keys(order).length === 0;
}

function invokeAsPromise(
  callback: (...args: unknown[]) => unknown,
  thisArg: unknown,
  args: readonly unknown[],
): Promise<unknown> {
  try {
    return Promise.resolve(Reflect.apply(callback, thisArg, args));
  } catch (error) {
    return Promise.reject(error);
  }
}

function compatibilityControlInputs(
  status: ModCompatibilitySessionStatus,
  candidates: readonly ModCompatibilityCandidate[],
  sourceOptimizationsActive: boolean,
): {
  readonly status: ModCompatibilitySessionStatus;
  readonly candidates: readonly ModCompatibilityCandidate[];
} {
  if (sourceOptimizationsActive) {
    return { status, candidates };
  }
  const disabledSubsystems = status.disabledSubsystems.filter(
    (subsystem) => subsystem !== "source-optimizations",
  );
  const filteredCandidates = candidates.map((candidate) => {
    const findings = candidate.findings.filter(
      (finding) => finding.subsystem !== "source-optimizations",
    );
    return findings.length === candidate.findings.length
      ? candidate
      : Object.freeze({
          ...candidate,
          findings: Object.freeze(findings),
        });
  });
  return {
    status:
      disabledSubsystems.length === status.disabledSubsystems.length
        ? status
        : Object.freeze({
            ...status,
            disabledSubsystems: Object.freeze(disabledSubsystems),
          }),
    candidates: Object.freeze(filteredCandidates),
  };
}

function runtimeStatus(
  digest: string,
  current: ModCompatibilitySessionStatus,
): ModCompatibilityRuntimeStatus | null {
  if (current.disabledMods.includes(digest)) {
    return "disabled";
  }
  if (current.forcedUnstableMods.includes(digest)) {
    return "forced-unstable";
  }
  if (current.compatibilityMods.includes(digest)) {
    return "forced-compatibility";
  }
  return null;
}

function memoizeBlobDigest(
  digest: (blob: Blob) => Promise<string>,
): (blob: Blob) => Promise<string> {
  const cache = new WeakMap<Blob, Promise<string>>();
  return (blob) => {
    const existing = cache.get(blob);
    if (existing !== undefined) {
      return existing;
    }
    const pending = Promise.resolve(digest(blob)).then(normalizeDigest);
    cache.set(blob, pending);
    return pending;
  };
}

async function sha256Blob(blob: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new Error("web-crypto-unavailable");
  }
  const bytes = await blob.arrayBuffer();
  const digest = await subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeDigest(value: string): string {
  const digest = value.toLowerCase();
  if (!SHA256_PATTERN.test(digest)) {
    throw new RangeError("invalid-mod-archive-digest");
  }
  return digest;
}

function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { readonly size?: unknown }).size === "number" &&
    typeof (value as { readonly arrayBuffer?: unknown }).arrayBuffer ===
      "function"
  );
}

function copyFunctionName(
  replacement: (...args: unknown[]) => unknown,
  official: (...args: unknown[]) => unknown,
): void {
  try {
    Object.defineProperty(replacement, "name", {
      configurable: true,
      value: official.name,
    });
  } catch {
    // Function names are diagnostic only.
  }
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "unknown-error";
}

function normalizeDeadline(value: number | undefined): number {
  if (value === undefined) {
    return 15_000;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("installDeadlineMs must be non-negative");
  }
  return value;
}
