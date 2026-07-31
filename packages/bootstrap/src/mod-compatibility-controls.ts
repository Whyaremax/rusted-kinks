// SPDX-License-Identifier: MIT

import type {
  ModCompatibilitySessionStatus,
  ModCompatibilitySubsystem,
} from "./mod-compatibility-decisions.js";
import { KD_ENEMY_POSITION_CACHE_COMPATIBILITY_FLAG } from "./kd-adapters.js";

export const KD_SOURCE_PATCH_CONTROL_NAME = "KDHybridSourcePatchControl";
export const KD_BUFF_EVENT_INDEX_COMPATIBILITY_FLAG = "disableBuffEventIndex";
export const KD_PATHFINDING_COMPATIBILITY_REASON =
  "kd-hybrid-mod-compatibility:pathfinding";
export const KD_PATHFINDING_SOURCE_COMPATIBILITY_FLAGS = Object.freeze([
  "disablePathfindingTopCacheSingleRead",
  "disablePathfindingContinuationCacheLookup",
  "disablePathfindingDeferredTileMetadata",
  "disablePathfindingDirectSuccessors",
  "disablePathfindingOpenValues",
  "disablePathfindingHoistedCacheIndex",
  "disablePathfindingNumericCoordinateKeys",
  "disablePathfindingTileMembershipTable",
  "disablePathfindingNumericContinuationIndex",
  "disablePathfindingClosedFirstSuccessors",
  "disablePathCacheSingleSlice",
  "disablePathCacheHoistedKeySuffix",
  "disablePathCacheEdgeIdentitySkip",
  "disablePathCacheKnownTailSkip",
] as const);

export type ModCompatibilityPathfindingRuntimeMode =
  "native" | "js-fallback" | "disabled" | "missing";

export interface ModCompatibilityPathfindingRuntimeState {
  /**
   * Stable identity for the registered pathfinding facade set.
   */
  readonly identity: unknown;
  readonly mode: ModCompatibilityPathfindingRuntimeMode;
  readonly reason: string | null;
}

export interface ModCompatibilityPathfindingRuntime {
  state(): ModCompatibilityPathfindingRuntimeState;
  disable(reason: string): boolean;
  enable(): boolean;
}

export interface ModCompatibilityControlDependencies {
  readonly target?: object;
  readonly pathfindingRuntime: ModCompatibilityPathfindingRuntime;
}

export type ModCompatibilityControlStatusKind =
  "applied" | "unchanged" | "restart-required" | "failed" | "disposed";

export interface ModCompatibilityControlReason {
  readonly subsystem: ModCompatibilitySubsystem;
  readonly code:
    | "official-buff-events"
    | "official-enemy-position-cache"
    | "official-pathfinding"
    | "restart-for-original-source";
  readonly message: string;
}

export interface ModCompatibilityControlStatus {
  readonly kind: ModCompatibilityControlStatusKind;
  readonly requestedSubsystems: readonly ModCompatibilitySubsystem[];
  readonly disabledSubsystems: readonly ModCompatibilitySubsystem[];
  readonly compatibilityMods: readonly string[];
  readonly forcedUnstableMods: readonly string[];
  readonly disabledMods: readonly string[];
  readonly activeFlags: readonly string[];
  readonly reasons: readonly ModCompatibilityControlReason[];
  readonly restartRequired: boolean;
  readonly error?: unknown;
}

export interface ModCompatibilityControlApplier {
  /**
   * Applies one activation's safest aggregate policy. Controls only become
   * stricter during the lifetime of this applier.
   */
  apply(session: ModCompatibilitySessionStatus): ModCompatibilityControlStatus;
  status(): ModCompatibilityControlStatus;
  /**
   * Restores only properties and the runtime mode still demonstrably owned by
   * this applier.
   */
  dispose(): ModCompatibilityControlStatus;
  isDisposed(): boolean;
}

/**
 * A pre-evaluation host can treat every thrown instance as a hard block and
 * render the attached immutable status without guessing from an error string.
 */
export class ModCompatibilityControlApplyError extends Error {
  readonly status: ModCompatibilityControlStatus;

  constructor(status: ModCompatibilityControlStatus) {
    super(controlApplyErrorMessage(status), {
      ...(status.error === undefined ? {} : { cause: status.error }),
    });
    this.name = "ModCompatibilityControlApplyError";
    this.status = status;
    Object.freeze(this);
  }
}

interface SessionSnapshot {
  readonly disabledSubsystems: readonly ModCompatibilitySubsystem[];
  readonly compatibilityMods: readonly string[];
  readonly forcedUnstableMods: readonly string[];
  readonly disabledMods: readonly string[];
  readonly restartRequired: boolean;
}

interface FlagPlan {
  readonly name: string;
  readonly original: PropertyDescriptor | undefined;
  readonly installed: PropertyDescriptor;
  readonly preexisting: boolean;
}

interface FlagOwnership {
  readonly control: object;
  readonly name: string;
  readonly original: PropertyDescriptor | undefined;
  readonly installed: PropertyDescriptor;
}

interface FlagGuard {
  readonly control: object;
  readonly name: string;
  readonly expected: PropertyDescriptor;
}

interface PreparedControl {
  readonly control: object;
  readonly createdRoot: boolean;
  readonly rootDescriptor: PropertyDescriptor;
  readonly plans: readonly FlagPlan[];
}

const SUBSYSTEM_ORDER = Object.freeze([
  "buff-event-index",
  "enemy-position-cache",
  "pathfinding",
  "source-optimizations",
] satisfies readonly ModCompatibilitySubsystem[]);

const CONTROL_REASONS = Object.freeze({
  "buff-event-index": Object.freeze({
    subsystem: "buff-event-index",
    code: "official-buff-events",
    message:
      "Direct buff mutation uses KD's official buff-event scan for this session.",
  }),
  "enemy-position-cache": Object.freeze({
    subsystem: "enemy-position-cache",
    code: "official-enemy-position-cache",
    message:
      "Enemy updates and dependent nearby/master queries use KD's official position-cache behavior.",
  }),
  pathfinding: Object.freeze({
    subsystem: "pathfinding",
    code: "official-pathfinding",
    message:
      "Pathfinding and path-cache operations use KD's official JavaScript behavior.",
  }),
  "source-optimizations": Object.freeze({
    subsystem: "source-optimizations",
    code: "restart-for-original-source",
    message:
      "Original function source must be restored before this mod can execute.",
  }),
} satisfies Readonly<
  Record<ModCompatibilitySubsystem, ModCompatibilityControlReason>
>);

const FLAGS_BY_SUBSYSTEM = Object.freeze({
  "buff-event-index": Object.freeze([KD_BUFF_EVENT_INDEX_COMPATIBILITY_FLAG]),
  "enemy-position-cache": Object.freeze([
    KD_ENEMY_POSITION_CACHE_COMPATIBILITY_FLAG,
  ]),
  pathfinding: KD_PATHFINDING_SOURCE_COMPATIBILITY_FLAGS,
  "source-optimizations": Object.freeze([]),
} satisfies Readonly<Record<ModCompatibilitySubsystem, readonly string[]>>);

const EMPTY_SESSION: SessionSnapshot = Object.freeze({
  disabledSubsystems: Object.freeze([]),
  compatibilityMods: Object.freeze([]),
  forcedUnstableMods: Object.freeze([]),
  disabledMods: Object.freeze([]),
  restartRequired: false,
});

/**
 * Applies compatibility controls without touching a KD save, storage, mod
 * archive, or network API.
 */
export function createModCompatibilityControlApplier(
  dependencies: ModCompatibilityControlDependencies,
): ModCompatibilityControlApplier {
  const target = dependencies.target ?? globalThis;
  if (
    (typeof target !== "object" && typeof target !== "function") ||
    target === null
  ) {
    throw new TypeError("Compatibility control target must be an object");
  }

  const activeSubsystems = new Set<ModCompatibilitySubsystem>();
  const ownedFlags = new Map<string, FlagOwnership>();
  const guardedFlags = new Map<string, FlagGuard>();
  let controlObject: object | undefined;
  let createdControlRoot = false;
  let installedRootDescriptor: PropertyDescriptor | undefined;
  let ownedRuntime:
    | {
        readonly original: ModCompatibilityPathfindingRuntimeState;
        readonly disabled: ModCompatibilityPathfindingRuntimeState;
      }
    | undefined;
  let pathfindingRuntimeIdentity: unknown;
  let pathfindingRuntimeGuarded = false;
  let disposed = false;
  let lastStatus = makeStatus("unchanged", EMPTY_SESSION, activeSubsystems);

  const api: ModCompatibilityControlApplier = {
    apply(sessionInput) {
      let session: SessionSnapshot;
      try {
        session = snapshotSession(sessionInput);
      } catch (error) {
        lastStatus = makeStatus(
          "failed",
          EMPTY_SESSION,
          activeSubsystems,
          error,
        );
        throw new ModCompatibilityControlApplyError(lastStatus);
      }
      if (disposed) {
        lastStatus = makeStatus("disposed", session, activeSubsystems);
        throw new ModCompatibilityControlApplyError(lastStatus);
      }
      if (
        session.restartRequired ||
        session.disabledSubsystems.includes("source-optimizations")
      ) {
        lastStatus = makeStatus("restart-required", session, activeSubsystems);
        throw new ModCompatibilityControlApplyError(lastStatus);
      }

      try {
        verifyOwnedControls(
          target,
          controlObject,
          installedRootDescriptor,
          ownedFlags,
          guardedFlags,
          dependencies.pathfindingRuntime,
          ownedRuntime,
          pathfindingRuntimeGuarded,
          pathfindingRuntimeIdentity,
        );
      } catch (error) {
        lastStatus = makeStatus("failed", session, activeSubsystems, error);
        throw new ModCompatibilityControlApplyError(lastStatus);
      }

      const newSubsystems = session.disabledSubsystems.filter(
        (subsystem) => !activeSubsystems.has(subsystem),
      );
      if (newSubsystems.length === 0) {
        lastStatus = makeStatus("unchanged", session, activeSubsystems);
        return lastStatus;
      }

      const newFlags = uniqueStrings(flagsForSubsystems(newSubsystems)).filter(
        (flag) => !guardedFlags.has(flag),
      );

      let prepared: PreparedControl;
      let originalRuntime: ModCompatibilityPathfindingRuntimeState;
      try {
        prepared = prepareControl(
          target,
          controlObject,
          installedRootDescriptor,
          newFlags,
        );
        originalRuntime = snapshotRuntimeState(
          dependencies.pathfindingRuntime.state(),
        );
        if (
          activeSubsystems.has("pathfinding") &&
          (ownedRuntime !== undefined
            ? !runtimeIsOwnedDisabled(originalRuntime, ownedRuntime)
            : originalRuntime.identity !== pathfindingRuntimeIdentity ||
              originalRuntime.mode === "native")
        ) {
          throw new Error(
            "Owned pathfinding runtime compatibility mode drifted",
          );
        }
      } catch (error) {
        lastStatus = makeStatus("failed", session, activeSubsystems, error);
        throw new ModCompatibilityControlApplyError(lastStatus);
      }

      const acquired: FlagOwnership[] = [];
      const acquiredGuards: FlagGuard[] = [];
      let rootInstalled = false;
      let runtimeAcquired:
        | {
            readonly original: ModCompatibilityPathfindingRuntimeState;
            readonly disabled: ModCompatibilityPathfindingRuntimeState;
          }
        | undefined;
      try {
        if (prepared.createdRoot) {
          Object.defineProperty(
            target,
            KD_SOURCE_PATCH_CONTROL_NAME,
            prepared.rootDescriptor,
          );
          rootInstalled = true;
          requireRootIdentity(
            target,
            prepared.control,
            prepared.rootDescriptor,
          );
        }

        for (const plan of prepared.plans) {
          if (plan.preexisting) {
            continue;
          }
          Object.defineProperty(prepared.control, plan.name, plan.installed);
          requireDescriptor(prepared.control, plan.name, plan.installed);
          acquired.push({
            control: prepared.control,
            name: plan.name,
            original: plan.original,
            installed: plan.installed,
          });
        }
        requireRootIdentity(target, prepared.control, prepared.rootDescriptor);

        if (
          newSubsystems.includes("pathfinding") &&
          originalRuntime.mode === "native"
        ) {
          const immediatelyBefore = snapshotRuntimeState(
            dependencies.pathfindingRuntime.state(),
          );
          if (!runtimeStatesEqual(immediatelyBefore, originalRuntime)) {
            throw new Error(
              "Pathfinding runtime identity drifted before disable",
            );
          }
          const disabled = dependencies.pathfindingRuntime.disable(
            KD_PATHFINDING_COMPATIBILITY_REASON,
          );
          const disabledState = snapshotRuntimeState(
            dependencies.pathfindingRuntime.state(),
          );
          if (
            disabled !== true ||
            disabledState.identity !== originalRuntime.identity ||
            disabledState.mode !== "disabled" ||
            disabledState.reason !== KD_PATHFINDING_COMPATIBILITY_REASON
          ) {
            runtimeAcquired = {
              original: originalRuntime,
              disabled: disabledState,
            };
            throw new Error("Could not disable native pathfinding atomically");
          }
          runtimeAcquired = {
            original: originalRuntime,
            disabled: disabledState,
          };
        } else if (newSubsystems.includes("pathfinding")) {
          const stillSafe = snapshotRuntimeState(
            dependencies.pathfindingRuntime.state(),
          );
          if (
            stillSafe.identity !== originalRuntime.identity ||
            stillSafe.mode === "native"
          ) {
            throw new Error(
              "Pathfinding runtime became native during compatibility apply",
            );
          }
        }

        requireRootIdentity(target, prepared.control, prepared.rootDescriptor);
        for (const flag of newFlags) {
          const descriptor = Object.getOwnPropertyDescriptor(
            prepared.control,
            flag,
          );
          if (
            descriptor === undefined ||
            !("value" in descriptor) ||
            descriptor.value !== true
          ) {
            throw new Error(
              `Compatibility flag ${flag} did not remain enabled`,
            );
          }
          acquiredGuards.push({
            control: prepared.control,
            name: flag,
            expected: snapshotDescriptor(descriptor),
          });
        }
      } catch (error) {
        const rollbackErrors = rollbackAcquisition(
          target,
          dependencies.pathfindingRuntime,
          prepared,
          acquired,
          rootInstalled,
          runtimeAcquired,
        );
        lastStatus = makeStatus(
          "failed",
          session,
          activeSubsystems,
          combineErrors(error, rollbackErrors),
        );
        throw new ModCompatibilityControlApplyError(lastStatus);
      }

      if (controlObject === undefined) {
        controlObject = prepared.control;
        createdControlRoot = prepared.createdRoot;
        installedRootDescriptor = prepared.rootDescriptor;
      }
      for (const ownership of acquired) {
        ownedFlags.set(ownership.name, ownership);
      }
      for (const guard of acquiredGuards) {
        guardedFlags.set(guard.name, guard);
      }
      if (runtimeAcquired !== undefined) {
        ownedRuntime = runtimeAcquired;
      }
      if (newSubsystems.includes("pathfinding")) {
        pathfindingRuntimeGuarded = true;
        pathfindingRuntimeIdentity = originalRuntime.identity;
      }
      for (const subsystem of newSubsystems) {
        activeSubsystems.add(subsystem);
      }
      lastStatus = makeStatus("applied", session, activeSubsystems);
      return lastStatus;
    },
    status: () => lastStatus,
    dispose() {
      if (disposed) {
        return lastStatus;
      }
      disposed = true;
      const restoreErrors: unknown[] = [];

      for (const ownership of [...ownedFlags.values()].reverse()) {
        try {
          restoreOwnedFlag(ownership);
        } catch (error) {
          restoreErrors.push(error);
        }
      }
      ownedFlags.clear();
      guardedFlags.clear();

      if (
        createdControlRoot &&
        controlObject !== undefined &&
        installedRootDescriptor !== undefined
      ) {
        try {
          removeOwnedEmptyRoot(target, controlObject, installedRootDescriptor);
        } catch (error) {
          restoreErrors.push(error);
        }
      }

      if (ownedRuntime !== undefined) {
        try {
          restoreOwnedRuntime(dependencies.pathfindingRuntime, ownedRuntime);
        } catch (error) {
          restoreErrors.push(error);
        }
      }
      activeSubsystems.clear();
      controlObject = undefined;
      installedRootDescriptor = undefined;
      ownedRuntime = undefined;
      pathfindingRuntimeGuarded = false;
      pathfindingRuntimeIdentity = undefined;
      lastStatus = makeStatus(
        "disposed",
        EMPTY_SESSION,
        activeSubsystems,
        restoreErrors.length === 0
          ? undefined
          : new AggregateError(
              restoreErrors,
              "Compatibility control disposal was incomplete",
            ),
      );
      return lastStatus;
    },
    isDisposed: () => disposed,
  };
  return Object.freeze(api);
}

function prepareControl(
  target: object,
  expectedControl: object | undefined,
  expectedRootDescriptor: PropertyDescriptor | undefined,
  flags: readonly string[],
): PreparedControl {
  const currentRoot = Object.getOwnPropertyDescriptor(
    target,
    KD_SOURCE_PATCH_CONTROL_NAME,
  );
  let control: object;
  let createdRoot = false;
  let rootDescriptor: PropertyDescriptor;

  if (expectedControl !== undefined) {
    if (
      expectedRootDescriptor === undefined ||
      currentRoot === undefined ||
      !descriptorsEqual(currentRoot, expectedRootDescriptor) ||
      !("value" in currentRoot) ||
      currentRoot.value !== expectedControl
    ) {
      throw new Error("Source compatibility control identity drifted");
    }
    control = expectedControl;
    rootDescriptor = expectedRootDescriptor;
  } else if (currentRoot === undefined) {
    if (!Object.isExtensible(target)) {
      throw new TypeError(
        "Source compatibility control target is not extensible",
      );
    }
    control = {};
    createdRoot = true;
    rootDescriptor = Object.freeze({
      configurable: true,
      enumerable: true,
      value: control,
      writable: true,
    });
  } else {
    if (
      !("value" in currentRoot) ||
      typeof currentRoot.value !== "object" ||
      currentRoot.value === null
    ) {
      throw new TypeError("Source compatibility control must be a data object");
    }
    control = currentRoot.value;
    const prototype = Object.getPrototypeOf(control);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(
        "Source compatibility control must be a plain object",
      );
    }
    rootDescriptor = snapshotDescriptor(currentRoot);
  }

  const plans = flags.map((name): FlagPlan => {
    const original = Object.getOwnPropertyDescriptor(control, name);
    if (original === undefined) {
      if (!Object.isExtensible(control)) {
        throw new TypeError(`Source compatibility control cannot add ${name}`);
      }
      return Object.freeze({
        name,
        original: undefined,
        installed: Object.freeze({
          configurable: true,
          enumerable: true,
          value: true,
          writable: true,
        }),
        preexisting: false,
      });
    }
    if (!("value" in original)) {
      throw new TypeError(
        `Source compatibility flag ${name} must not be an accessor`,
      );
    }
    if (original.value === true) {
      return Object.freeze({
        name,
        original: snapshotDescriptor(original),
        installed: snapshotDescriptor(original),
        preexisting: true,
      });
    }
    if (original.writable !== true) {
      throw new TypeError(`Source compatibility flag ${name} is not writable`);
    }
    return Object.freeze({
      name,
      original: snapshotDescriptor(original),
      installed: Object.freeze({
        configurable: original.configurable ?? false,
        enumerable: original.enumerable ?? false,
        value: true,
        writable: original.writable,
      }),
      preexisting: false,
    });
  });

  return Object.freeze({
    control,
    createdRoot,
    rootDescriptor,
    plans: Object.freeze(plans),
  });
}

function verifyOwnedControls(
  target: object,
  control: object | undefined,
  rootDescriptor: PropertyDescriptor | undefined,
  flags: ReadonlyMap<string, FlagOwnership>,
  guardedFlags: ReadonlyMap<string, FlagGuard>,
  runtime: ModCompatibilityPathfindingRuntime,
  ownedRuntime:
    | {
        readonly original: ModCompatibilityPathfindingRuntimeState;
        readonly disabled: ModCompatibilityPathfindingRuntimeState;
      }
    | undefined,
  pathfindingRuntimeGuarded: boolean,
  pathfindingRuntimeIdentity: unknown,
): void {
  if (control !== undefined && rootDescriptor !== undefined) {
    requireRootIdentity(target, control, rootDescriptor);
  }
  for (const ownership of flags.values()) {
    requireDescriptor(ownership.control, ownership.name, ownership.installed);
  }
  for (const guard of guardedFlags.values()) {
    requireDescriptor(guard.control, guard.name, guard.expected);
  }
  if (ownedRuntime !== undefined) {
    const current = snapshotRuntimeState(runtime.state());
    if (!runtimeIsOwnedDisabled(current, ownedRuntime)) {
      throw new Error("Pathfinding runtime compatibility mode drifted");
    }
  } else if (pathfindingRuntimeGuarded) {
    const current = snapshotRuntimeState(runtime.state());
    if (
      current.identity !== pathfindingRuntimeIdentity ||
      current.mode === "native"
    ) {
      throw new Error("Pathfinding runtime compatibility mode drifted");
    }
  }
}

function rollbackAcquisition(
  target: object,
  runtime: ModCompatibilityPathfindingRuntime,
  prepared: PreparedControl,
  acquired: readonly FlagOwnership[],
  rootInstalled: boolean,
  runtimeAcquired:
    | {
        readonly original: ModCompatibilityPathfindingRuntimeState;
        readonly disabled: ModCompatibilityPathfindingRuntimeState;
      }
    | undefined,
): readonly unknown[] {
  const errors: unknown[] = [];
  if (runtimeAcquired !== undefined) {
    try {
      restoreOwnedRuntime(runtime, runtimeAcquired);
    } catch (error) {
      errors.push(error);
    }
  }
  for (const ownership of [...acquired].reverse()) {
    try {
      restoreOwnedFlag(ownership);
    } catch (error) {
      errors.push(error);
    }
  }
  if (rootInstalled) {
    try {
      removeOwnedEmptyRoot(target, prepared.control, prepared.rootDescriptor);
    } catch (error) {
      errors.push(error);
    }
  }
  return Object.freeze(errors);
}

function restoreOwnedFlag(ownership: FlagOwnership): void {
  const current = Object.getOwnPropertyDescriptor(
    ownership.control,
    ownership.name,
  );
  if (
    current === undefined ||
    !descriptorsEqual(current, ownership.installed)
  ) {
    // A mod took ownership. Never overwrite its live descriptor.
    return;
  }
  if (ownership.original === undefined) {
    if (!Reflect.deleteProperty(ownership.control, ownership.name)) {
      throw new Error(
        `Could not remove owned compatibility flag ${ownership.name}`,
      );
    }
    if (
      Object.getOwnPropertyDescriptor(ownership.control, ownership.name) !==
      undefined
    ) {
      throw new Error(
        `Owned compatibility flag ${ownership.name} remained installed`,
      );
    }
    return;
  }
  Object.defineProperty(ownership.control, ownership.name, ownership.original);
  requireDescriptor(ownership.control, ownership.name, ownership.original);
}

function removeOwnedEmptyRoot(
  target: object,
  control: object,
  installedRoot: PropertyDescriptor,
): void {
  const current = Object.getOwnPropertyDescriptor(
    target,
    KD_SOURCE_PATCH_CONTROL_NAME,
  );
  if (
    current === undefined ||
    !descriptorsEqual(current, installedRoot) ||
    !("value" in current) ||
    current.value !== control ||
    Reflect.ownKeys(control).length !== 0
  ) {
    return;
  }
  if (!Reflect.deleteProperty(target, KD_SOURCE_PATCH_CONTROL_NAME)) {
    throw new Error("Could not remove owned source compatibility control");
  }
}

function restoreOwnedRuntime(
  runtime: ModCompatibilityPathfindingRuntime,
  ownership: {
    readonly original: ModCompatibilityPathfindingRuntimeState;
    readonly disabled: ModCompatibilityPathfindingRuntimeState;
  },
): void {
  const current = snapshotRuntimeState(runtime.state());
  if (
    !runtimeStatesEqual(current, ownership.disabled) ||
    current.identity !== ownership.original.identity ||
    current.mode !== "disabled" ||
    current.reason !== KD_PATHFINDING_COMPATIBILITY_REASON
  ) {
    // Another owner changed the mode or identity. Do not enable over it.
    return;
  }
  if (runtime.enable() !== true) {
    throw new Error("Could not restore native pathfinding mode");
  }
  const restored = snapshotRuntimeState(runtime.state());
  if (
    restored.identity !== ownership.original.identity ||
    restored.mode !== ownership.original.mode ||
    restored.reason !== ownership.original.reason
  ) {
    throw new Error("Native pathfinding mode did not restore exactly");
  }
}

function requireRootIdentity(
  target: object,
  control: object,
  expected: PropertyDescriptor,
): void {
  const current = Object.getOwnPropertyDescriptor(
    target,
    KD_SOURCE_PATCH_CONTROL_NAME,
  );
  if (
    current === undefined ||
    !descriptorsEqual(current, expected) ||
    !("value" in current) ||
    current.value !== control
  ) {
    throw new Error("Source compatibility control identity drifted");
  }
}

function requireDescriptor(
  target: object,
  name: string,
  expected: PropertyDescriptor,
): void {
  const current = Object.getOwnPropertyDescriptor(target, name);
  if (current === undefined || !descriptorsEqual(current, expected)) {
    throw new Error(`Compatibility flag ${name} descriptor drifted`);
  }
}

function snapshotRuntimeState(
  value: ModCompatibilityPathfindingRuntimeState,
): ModCompatibilityPathfindingRuntimeState {
  if (
    typeof value !== "object" ||
    value === null ||
    (value.mode !== "native" &&
      value.mode !== "js-fallback" &&
      value.mode !== "disabled" &&
      value.mode !== "missing") ||
    (value.reason !== null && typeof value.reason !== "string")
  ) {
    throw new TypeError("Invalid pathfinding runtime state");
  }
  return Object.freeze({
    identity: value.identity,
    mode: value.mode,
    reason: value.reason,
  });
}

function runtimeIsOwnedDisabled(
  current: ModCompatibilityPathfindingRuntimeState,
  ownership:
    | {
        readonly disabled: ModCompatibilityPathfindingRuntimeState;
      }
    | undefined,
): boolean {
  return (
    ownership !== undefined &&
    runtimeStatesEqual(current, ownership.disabled) &&
    current.mode === "disabled" &&
    current.reason === KD_PATHFINDING_COMPATIBILITY_REASON
  );
}

function runtimeStatesEqual(
  left: ModCompatibilityPathfindingRuntimeState,
  right: ModCompatibilityPathfindingRuntimeState,
): boolean {
  return (
    left.identity === right.identity &&
    left.mode === right.mode &&
    left.reason === right.reason
  );
}

function snapshotSession(
  value: ModCompatibilitySessionStatus,
): SessionSnapshot {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Compatibility session status is required");
  }
  if (typeof value.restartRequired !== "boolean") {
    throw new TypeError("Compatibility restartRequired must be boolean");
  }
  const disabledSubsystems = readSubsystems(value.disabledSubsystems);
  return Object.freeze({
    disabledSubsystems,
    compatibilityMods: readStrings(
      value.compatibilityMods,
      "compatibilityMods",
    ),
    forcedUnstableMods: readStrings(
      value.forcedUnstableMods,
      "forcedUnstableMods",
    ),
    disabledMods: readStrings(value.disabledMods, "disabledMods"),
    restartRequired: value.restartRequired,
  });
}

function readSubsystems(
  values: readonly ModCompatibilitySubsystem[],
): readonly ModCompatibilitySubsystem[] {
  if (!Array.isArray(values)) {
    throw new TypeError("disabledSubsystems must be an array");
  }
  const result = new Set<ModCompatibilitySubsystem>();
  for (const value of values) {
    if (!SUBSYSTEM_ORDER.includes(value)) {
      throw new RangeError(`Unknown compatibility subsystem: ${String(value)}`);
    }
    result.add(value);
  }
  return Object.freeze(
    SUBSYSTEM_ORDER.filter((subsystem) => result.has(subsystem)),
  );
}

function readStrings(
  values: readonly string[],
  name: string,
): readonly string[] {
  if (!Array.isArray(values)) {
    throw new TypeError(`${name} must be an array`);
  }
  const result = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError(`${name} must contain non-empty strings`);
    }
    result.add(value);
  }
  return Object.freeze([...result].sort());
}

function makeStatus(
  kind: ModCompatibilityControlStatusKind,
  session: SessionSnapshot,
  active: ReadonlySet<ModCompatibilitySubsystem>,
  error?: unknown,
): ModCompatibilityControlStatus {
  const disabledSubsystems = Object.freeze(
    SUBSYSTEM_ORDER.filter(
      (subsystem) =>
        subsystem !== "source-optimizations" && active.has(subsystem),
    ),
  );
  const requestedSubsystems = session.restartRequired
    ? Object.freeze(
        SUBSYSTEM_ORDER.filter(
          (subsystem) =>
            session.disabledSubsystems.includes(subsystem) ||
            subsystem === "source-optimizations",
        ),
      )
    : session.disabledSubsystems;
  const reasonSubsystems = new Set(disabledSubsystems);
  if (
    kind === "restart-required" ||
    requestedSubsystems.includes("source-optimizations")
  ) {
    reasonSubsystems.add("source-optimizations");
  }
  const reasons = Object.freeze(
    SUBSYSTEM_ORDER.filter((subsystem) => reasonSubsystems.has(subsystem)).map(
      (subsystem) => CONTROL_REASONS[subsystem],
    ),
  );
  const activeFlags = Object.freeze(
    uniqueStrings(flagsForSubsystems(disabledSubsystems)),
  );
  const base = {
    kind,
    requestedSubsystems,
    disabledSubsystems,
    compatibilityMods: session.compatibilityMods,
    forcedUnstableMods: session.forcedUnstableMods,
    disabledMods: session.disabledMods,
    activeFlags,
    reasons,
    restartRequired: kind === "restart-required",
  } satisfies Omit<ModCompatibilityControlStatus, "error">;
  return error === undefined
    ? Object.freeze(base)
    : Object.freeze({ ...base, error });
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function flagsForSubsystems(
  subsystems: readonly ModCompatibilitySubsystem[],
): readonly string[] {
  const result: string[] = [];
  for (const subsystem of subsystems) {
    result.push(...FLAGS_BY_SUBSYSTEM[subsystem]);
  }
  return result;
}

function snapshotDescriptor(
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  return Object.freeze({ ...descriptor });
}

function descriptorsEqual(
  left: PropertyDescriptor,
  right: PropertyDescriptor,
): boolean {
  const leftData = "value" in left || "writable" in left;
  const rightData = "value" in right || "writable" in right;
  return (
    leftData === rightData &&
    left.configurable === right.configurable &&
    left.enumerable === right.enumerable &&
    (leftData
      ? left.value === right.value && left.writable === right.writable
      : left.get === right.get && left.set === right.set)
  );
}

function combineErrors(
  error: unknown,
  rollbackErrors: readonly unknown[],
): unknown {
  return rollbackErrors.length === 0
    ? error
    : new AggregateError(
        [error, ...rollbackErrors],
        "Compatibility control apply and rollback failed",
      );
}

function controlApplyErrorMessage(
  status: ModCompatibilityControlStatus,
): string {
  switch (status.kind) {
    case "restart-required":
      return "Mod compatibility controls require restart before evaluation";
    case "disposed":
      return "Mod compatibility control applier is disposed";
    case "failed":
      return "Mod compatibility controls failed closed";
    case "applied":
    case "unchanged":
      return "Mod compatibility controls unexpectedly rejected success";
  }
}
