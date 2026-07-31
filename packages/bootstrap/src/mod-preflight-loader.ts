// SPDX-License-Identifier: MIT

import {
  resolveModCompatibilitySession,
  type ModCompatibilityCandidate,
  type ModCompatibilityChoice,
  type ModCompatibilityDecisionStore,
  type ModCompatibilitySessionStatus,
  type RememberedModCompatibilityDecision,
} from "./mod-compatibility-decisions.js";

export interface ModPreflightArchiveIdentity {
  /**
   * A stable, activation-local archive identity, such as its canonical loader
   * key. It must not contain source text or save data.
   */
  readonly key: string;
  readonly digest: string;
}

export type ModPreflightOfficialExecutor<
  TThis,
  TArgs extends readonly unknown[],
  TResult,
> = (this: TThis, ...args: TArgs) => TResult | PromiseLike<TResult>;

export type ModPreflightRestore = () => void | PromiseLike<void>;

export interface ModPreflightLoadOrderInstallation {
  /**
   * Verifies the exact live filtered state installed for this activation.
   * Returning anything other than true fails closed.
   */
  readonly verify: () => boolean | PromiseLike<boolean>;
  readonly restore: ModPreflightRestore;
}

export interface ModPreflightDiagnostic {
  readonly code: "official-and-restore-failed";
  /**
   * The exact error thrown or rejected by the official executor.
   */
  readonly officialError: unknown;
  /**
   * The simultaneous temporary-state restoration failure.
   */
  readonly restoreError: unknown;
}

export interface ModPreflightDependencies<
  TArchive,
  TThis,
  TArgs extends readonly unknown[],
  TResult,
> {
  /**
   * Returns KD's current ordered archive inventory. The gate snapshots this
   * before inspection and verifies the same identities and order before eval.
   */
  readonly inventory: () =>
    readonly TArchive[] | PromiseLike<readonly TArchive[]>;
  /**
   * Computes the stable key and content digest used to detect archive drift.
   */
  readonly identifyArchive: (archive: TArchive) => ModPreflightArchiveIdentity;
  /**
   * Inspects an archive as data. Implementations must not execute mod code.
   */
  readonly inspectArchive: (
    archive: TArchive,
    identity: ModPreflightArchiveIdentity,
  ) => ModCompatibilityCandidate | PromiseLike<ModCompatibilityCandidate>;
  /**
   * Optional remembered-decision source. A decision store already validates
   * the current KD, bundle, Hybrid, and rule-version context.
   */
  readonly decisionStore?: Pick<ModCompatibilityDecisionStore, "lookup">;
  /**
   * Optional UI decision hook. Returning undefined is the same safe default as
   * headless operation: compatibility mode.
   */
  readonly prompt?: (
    candidate: ModCompatibilityCandidate,
  ) =>
    | ModCompatibilityChoice
    | RememberedModCompatibilityDecision
    | undefined
    | PromiseLike<
        ModCompatibilityChoice | RememberedModCompatibilityDecision | undefined
      >;
  readonly headless?: boolean;
  /**
   * Applies per-subsystem compatibility controls for this activation. It runs
   * before the official executor and is not a load-order mutation.
   */
  readonly applyCompatibilityControls: (
    status: ModCompatibilitySessionStatus,
    candidates: readonly ModCompatibilityCandidate[],
  ) => void | PromiseLike<void>;
  /**
   * Verifies that KD's live load order exactly matches the supplied archives
   * without installing or restoring temporary state. The gate uses this path
   * when no archive is disabled.
   */
  readonly verifyCurrentLoadOrder: (
    archives: readonly TArchive[],
  ) => boolean | PromiseLike<boolean>;
  /**
   * Installs the activation-local filtered load order and returns a verifier
   * and restorer. The gate calls verify immediately before official
   * evaluation and always calls restore after a successful install, including
   * when verification blocks or the official executor throws or rejects.
   */
  readonly installTemporaryLoadOrder: (
    archives: readonly TArchive[],
  ) =>
    | ModPreflightLoadOrderInstallation
    | PromiseLike<ModPreflightLoadOrderInstallation>;
  /**
   * Returns the official executor identity captured when this gate is created.
   * Any later replacement blocks evaluation.
   */
  readonly getOfficialExecutor: () => ModPreflightOfficialExecutor<
    TThis,
    TArgs,
    TResult
  >;
}

export type ModPreflightBlockedReason =
  | "disposed"
  | "inventory-failed"
  | "scan-failed"
  | "decision-failed"
  | "restart-required"
  | "apply-failed"
  | "identity-drift"
  | "load-order-failed";

export interface ModPreflightExecuted<TResult> {
  readonly kind: "executed";
  readonly status: ModCompatibilitySessionStatus;
  /**
   * The exact value produced by the official executor.
   */
  readonly result: TResult;
}

export interface ModPreflightBlocked {
  readonly kind: "blocked";
  readonly reason: ModPreflightBlockedReason;
  readonly status: ModCompatibilitySessionStatus;
  /**
   * The original dependency error, when one caused the block.
   */
  readonly error?: unknown;
}

export type ModPreflightExecutionOutcome<TResult> =
  ModPreflightExecuted<TResult> | ModPreflightBlocked;

export interface ModPreflightExecutionGate<
  TThis,
  TArgs extends readonly unknown[],
  TResult,
> {
  /**
   * Starts one activation. Concurrent calls share the first call's in-flight
   * activation, including its official this value and arguments.
   */
  run(
    thisArg: TThis,
    args: TArgs,
  ): Promise<ModPreflightExecutionOutcome<TResult>>;
  /**
   * Prevents an activation that has not reached official evaluation from
   * evaluating. Disposal never invokes or mutates KD state by itself.
   */
  dispose(): void;
  isDisposed(): boolean;
  /**
   * Returns the immutable diagnostic from the latest activation, if one
   * encountered both an official rejection and a restoration failure.
   */
  lastDiagnostic(): ModPreflightDiagnostic | null;
}

interface ArchiveSnapshot<TArchive> {
  readonly archive: TArchive;
  readonly identity: ModPreflightArchiveIdentity;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CHOICES = new Set<ModCompatibilityChoice>([
  "compatibility",
  "keep-optimizations",
  "disable-mod",
]);

const EMPTY_STATUS: ModCompatibilitySessionStatus = Object.freeze({
  disabledMods: Object.freeze([]),
  forcedUnstableMods: Object.freeze([]),
  compatibilityMods: Object.freeze([]),
  disabledSubsystems: Object.freeze([]),
  restartRequired: false,
});

/**
 * Creates a framework-independent pre-evaluation gate around KD's official mod
 * executor. This module never reads or writes a KD save and never alters an
 * archive.
 */
export function createModPreflightExecutionGate<
  TArchive,
  TThis,
  TArgs extends readonly unknown[],
  TResult,
>(
  dependencies: ModPreflightDependencies<TArchive, TThis, TArgs, TResult>,
): ModPreflightExecutionGate<TThis, TArgs, TResult> {
  const officialExecutor = dependencies.getOfficialExecutor();
  if (typeof officialExecutor !== "function") {
    throw new TypeError("The official mod executor must be a function");
  }

  let disposed = false;
  let latestDiagnostic: ModPreflightDiagnostic | null = null;
  let inFlight: Promise<ModPreflightExecutionOutcome<TResult>> | undefined;

  const clearInFlight = (
    activation: Promise<ModPreflightExecutionOutcome<TResult>>,
  ): void => {
    if (inFlight === activation) {
      inFlight = undefined;
    }
  };

  const gate: ModPreflightExecutionGate<TThis, TArgs, TResult> = {
    run(thisArg, args) {
      if (inFlight !== undefined) {
        return inFlight;
      }
      if (disposed) {
        return Promise.resolve(blocked("disposed", EMPTY_STATUS));
      }
      latestDiagnostic = null;
      const activation = activate(
        dependencies,
        officialExecutor,
        () => disposed,
        (diagnostic) => {
          latestDiagnostic = diagnostic;
        },
        thisArg,
        args,
      );
      inFlight = activation;
      void activation.then(
        () => clearInFlight(activation),
        () => clearInFlight(activation),
      );
      return activation;
    },
    dispose() {
      disposed = true;
    },
    isDisposed: () => disposed,
    lastDiagnostic: () => latestDiagnostic,
  };
  return Object.freeze(gate);
}

async function activate<
  TArchive,
  TThis,
  TArgs extends readonly unknown[],
  TResult,
>(
  dependencies: ModPreflightDependencies<TArchive, TThis, TArgs, TResult>,
  officialExecutor: ModPreflightOfficialExecutor<TThis, TArgs, TResult>,
  isDisposed: () => boolean,
  reportDiagnostic: (diagnostic: ModPreflightDiagnostic) => void,
  thisArg: TThis,
  args: TArgs,
): Promise<ModPreflightExecutionOutcome<TResult>> {
  if (isDisposed()) {
    return blocked("disposed", EMPTY_STATUS);
  }
  if (!officialIdentityMatches(dependencies, officialExecutor)) {
    return blocked("identity-drift", EMPTY_STATUS);
  }

  let snapshot: readonly ArchiveSnapshot<TArchive>[];
  try {
    snapshot = await takeArchiveSnapshot(dependencies);
  } catch (error) {
    return blocked("inventory-failed", EMPTY_STATUS, error);
  }
  if (isDisposed()) {
    return blocked("disposed", EMPTY_STATUS);
  }

  const candidates: ModCompatibilityCandidate[] = [];
  try {
    for (const entry of snapshot) {
      if (isDisposed()) {
        return blocked("disposed", EMPTY_STATUS);
      }
      const inspected = await dependencies.inspectArchive(
        entry.archive,
        entry.identity,
      );
      const candidate = snapshotCandidate(inspected);
      if (candidate.digest !== entry.identity.digest) {
        throw new ModPreflightIdentityDriftError(
          `Scanner digest drifted for archive ${entry.identity.key}`,
        );
      }
      validateCandidate(candidate);
      candidates.push(candidate);
    }
  } catch (error) {
    if (error instanceof ModPreflightIdentityDriftError) {
      return blocked("identity-drift", EMPTY_STATUS, error);
    }
    return blocked("scan-failed", EMPTY_STATUS, error);
  }

  if (isDisposed()) {
    return blocked("disposed", EMPTY_STATUS);
  }
  if (
    !officialIdentityMatches(dependencies, officialExecutor) ||
    !(await inventoryStillMatches(dependencies, snapshot))
  ) {
    return blocked("identity-drift", EMPTY_STATUS);
  }

  let status: ModCompatibilitySessionStatus;
  try {
    const sessions = [];
    for (const candidate of candidates) {
      const highConfidence = candidate.findings.some(
        (finding) => finding.confidence === "high",
      );
      const choice = highConfidence
        ? await resolveChoice(dependencies, candidate)
        : undefined;
      sessions.push(
        choice === undefined ? { candidate } : { candidate, choice },
      );
    }
    status = resolveModCompatibilitySession(sessions);
  } catch (error) {
    if (error instanceof ModPreflightIdentityDriftError) {
      return blocked("identity-drift", EMPTY_STATUS, error);
    }
    return blocked("decision-failed", EMPTY_STATUS, error);
  }

  if (isDisposed()) {
    return blocked("disposed", status);
  }
  if (status.restartRequired) {
    return blocked("restart-required", status);
  }
  if (
    !officialIdentityMatches(dependencies, officialExecutor) ||
    !(await inventoryStillMatches(dependencies, snapshot))
  ) {
    return blocked("identity-drift", status);
  }

  try {
    await dependencies.applyCompatibilityControls(
      status,
      Object.freeze([...candidates]),
    );
  } catch (error) {
    return blocked("apply-failed", status, error);
  }

  if (
    isDisposed() ||
    !officialIdentityMatches(dependencies, officialExecutor) ||
    !(await inventoryStillMatches(dependencies, snapshot))
  ) {
    return blocked(isDisposed() ? "disposed" : "identity-drift", status);
  }

  const disabledDigests = new Set(status.disabledMods);
  const enabledArchives = Object.freeze(
    snapshot
      .filter((entry) => !disabledDigests.has(entry.identity.digest))
      .map((entry) => entry.archive),
  );

  if (disabledDigests.size === 0) {
    let loadOrderMatches: boolean;
    try {
      loadOrderMatches =
        await dependencies.verifyCurrentLoadOrder(enabledArchives);
    } catch (error) {
      return blocked("load-order-failed", status, error);
    }
    if (loadOrderMatches !== true) {
      return blocked("identity-drift", status);
    }
    if (
      isDisposed() ||
      !officialIdentityMatches(dependencies, officialExecutor) ||
      !archiveIdentitiesStillMatch(dependencies, snapshot)
    ) {
      return blocked(isDisposed() ? "disposed" : "identity-drift", status);
    }
    const result = await Reflect.apply(officialExecutor, thisArg, args);
    return Object.freeze({
      kind: "executed",
      status,
      result,
    });
  }

  let installation: ModPreflightLoadOrderInstallation;
  try {
    installation =
      await dependencies.installTemporaryLoadOrder(enabledArchives);
    if (
      installation === null ||
      typeof installation !== "object" ||
      typeof installation.verify !== "function" ||
      typeof installation.restore !== "function"
    ) {
      throw new TypeError(
        "installTemporaryLoadOrder must return verify and restore functions",
      );
    }
  } catch (error) {
    return blocked("load-order-failed", status, error);
  }

  let officialError: unknown;
  let officialFailed = false;
  let result: TResult | undefined;
  let preEvaluationBlock: ModPreflightBlocked | undefined;
  try {
    let loadOrderMatches: boolean | undefined;
    try {
      loadOrderMatches = await installation.verify();
    } catch (error) {
      preEvaluationBlock = blocked("load-order-failed", status, error);
    }
    if (preEvaluationBlock === undefined) {
      if (loadOrderMatches !== true) {
        preEvaluationBlock = blocked("identity-drift", status);
      } else if (
        isDisposed() ||
        !officialIdentityMatches(dependencies, officialExecutor) ||
        !archiveIdentitiesStillMatch(dependencies, snapshot)
      ) {
        preEvaluationBlock = blocked(
          isDisposed() ? "disposed" : "identity-drift",
          status,
        );
      } else {
        try {
          result = await Reflect.apply(officialExecutor, thisArg, args);
        } catch (error) {
          officialFailed = true;
          officialError = error;
        }
      }
    }
  } finally {
    try {
      await installation.restore();
    } catch (restoreError) {
      if (officialFailed) {
        reportDiagnostic(
          Object.freeze({
            code: "official-and-restore-failed",
            officialError,
            restoreError,
          }),
        );
        throw officialError;
      }
      if (preEvaluationBlock !== undefined) {
        return blocked("load-order-failed", status, restoreError);
      }
      return blocked("load-order-failed", status, restoreError);
    }
  }

  if (preEvaluationBlock !== undefined) {
    return preEvaluationBlock;
  }
  if (officialFailed) {
    throw officialError;
  }
  return Object.freeze({
    kind: "executed",
    status,
    result: result as TResult,
  });
}

async function takeArchiveSnapshot<
  TArchive,
  TThis,
  TArgs extends readonly unknown[],
  TResult,
>(
  dependencies: ModPreflightDependencies<TArchive, TThis, TArgs, TResult>,
): Promise<readonly ArchiveSnapshot<TArchive>[]> {
  const inventory = await dependencies.inventory();
  if (!Array.isArray(inventory)) {
    throw new TypeError("Mod inventory must be an array");
  }
  const keys = new Set<string>();
  const digests = new Set<string>();
  const snapshot = inventory.map((archive) => {
    const identity = snapshotIdentity(dependencies.identifyArchive(archive));
    if (keys.has(identity.key)) {
      throw new RangeError(`Duplicate mod archive key: ${identity.key}`);
    }
    if (digests.has(identity.digest)) {
      throw new RangeError(`Duplicate mod archive digest: ${identity.digest}`);
    }
    keys.add(identity.key);
    digests.add(identity.digest);
    return Object.freeze({ archive, identity });
  });
  return Object.freeze(snapshot);
}

async function inventoryStillMatches<
  TArchive,
  TThis,
  TArgs extends readonly unknown[],
  TResult,
>(
  dependencies: ModPreflightDependencies<TArchive, TThis, TArgs, TResult>,
  snapshot: readonly ArchiveSnapshot<TArchive>[],
): Promise<boolean> {
  try {
    const current = await dependencies.inventory();
    if (!Array.isArray(current) || current.length !== snapshot.length) {
      return false;
    }
    for (let index = 0; index < current.length; index += 1) {
      const archive = current[index];
      const expected = snapshot[index];
      if (archive === undefined || expected === undefined) {
        return false;
      }
      const identity = snapshotIdentity(dependencies.identifyArchive(archive));
      if (!identitiesEqual(identity, expected.identity)) {
        return false;
      }
    }
    return archiveIdentitiesStillMatch(dependencies, snapshot);
  } catch {
    return false;
  }
}

function archiveIdentitiesStillMatch<
  TArchive,
  TThis,
  TArgs extends readonly unknown[],
  TResult,
>(
  dependencies: ModPreflightDependencies<TArchive, TThis, TArgs, TResult>,
  snapshot: readonly ArchiveSnapshot<TArchive>[],
): boolean {
  try {
    return snapshot.every((entry) =>
      identitiesEqual(
        snapshotIdentity(dependencies.identifyArchive(entry.archive)),
        entry.identity,
      ),
    );
  } catch {
    return false;
  }
}

async function resolveChoice<
  TArchive,
  TThis,
  TArgs extends readonly unknown[],
  TResult,
>(
  dependencies: ModPreflightDependencies<TArchive, TThis, TArgs, TResult>,
  candidate: ModCompatibilityCandidate,
): Promise<ModCompatibilityChoice> {
  const remembered = dependencies.decisionStore?.lookup(candidate.digest);
  if (remembered !== undefined) {
    return validateDecision(remembered, candidate.digest);
  }
  if (dependencies.headless === true || dependencies.prompt === undefined) {
    return "compatibility";
  }
  const prompted = await dependencies.prompt(candidate);
  if (prompted === undefined) {
    return "compatibility";
  }
  return validateDecision(prompted, candidate.digest);
}

function validateDecision(
  value: ModCompatibilityChoice | RememberedModCompatibilityDecision,
  expectedDigest: string,
): ModCompatibilityChoice {
  if (typeof value === "string") {
    if (CHOICES.has(value)) {
      return value;
    }
    throw new RangeError(`Unknown mod compatibility choice: ${value}`);
  }
  if (value.digest.toLowerCase() !== expectedDigest) {
    throw new ModPreflightIdentityDriftError(
      "Remembered decision digest does not match its archive",
    );
  }
  if (!CHOICES.has(value.choice)) {
    throw new RangeError(`Unknown mod compatibility choice: ${value.choice}`);
  }
  return value.choice;
}

function snapshotIdentity(
  value: ModPreflightArchiveIdentity,
): ModPreflightArchiveIdentity {
  const key = value.key.trim();
  const digest = value.digest.toLowerCase();
  if (key.length === 0) {
    throw new RangeError("Mod archive key is required");
  }
  if (!SHA256_PATTERN.test(digest)) {
    throw new RangeError(
      "Mod archive digest must be a 64-character SHA-256 hex value",
    );
  }
  return Object.freeze({ key, digest });
}

function snapshotCandidate(
  value: ModCompatibilityCandidate,
): ModCompatibilityCandidate {
  return Object.freeze({
    name: value.name,
    digest: value.digest.toLowerCase(),
    findings: Object.freeze(
      value.findings.map((finding) => Object.freeze({ ...finding })),
    ),
  });
}

function validateCandidate(candidate: ModCompatibilityCandidate): void {
  resolveModCompatibilitySession([{ candidate, choice: "compatibility" }]);
}

function identitiesEqual(
  left: ModPreflightArchiveIdentity,
  right: ModPreflightArchiveIdentity,
): boolean {
  return left.key === right.key && left.digest === right.digest;
}

function officialIdentityMatches<
  TArchive,
  TThis,
  TArgs extends readonly unknown[],
  TResult,
>(
  dependencies: ModPreflightDependencies<TArchive, TThis, TArgs, TResult>,
  expected: ModPreflightOfficialExecutor<TThis, TArgs, TResult>,
): boolean {
  try {
    return dependencies.getOfficialExecutor() === expected;
  } catch {
    return false;
  }
}

function blocked(
  reason: ModPreflightBlockedReason,
  status: ModCompatibilitySessionStatus,
  error?: unknown,
): ModPreflightBlocked {
  if (arguments.length >= 3) {
    return Object.freeze({ kind: "blocked", reason, status, error });
  }
  return Object.freeze({ kind: "blocked", reason, status });
}

class ModPreflightIdentityDriftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModPreflightIdentityDriftError";
  }
}
