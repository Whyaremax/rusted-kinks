import { describe, expect, it } from "vitest";

import type {
  ModCompatibilitySessionStatus,
  ModCompatibilitySubsystem,
} from "./mod-compatibility-decisions.js";
import {
  createModCompatibilityControlApplier,
  KD_BUFF_EVENT_INDEX_COMPATIBILITY_FLAG,
  ModCompatibilityControlApplyError,
  KD_PATHFINDING_COMPATIBILITY_REASON,
  KD_PATHFINDING_SOURCE_COMPATIBILITY_FLAGS,
  KD_SOURCE_PATCH_CONTROL_NAME,
  type ModCompatibilityPathfindingRuntime,
  type ModCompatibilityPathfindingRuntimeMode,
  type ModCompatibilityControlApplier,
  type ModCompatibilityControlStatus,
  type ModCompatibilityControlStatusKind,
} from "./mod-compatibility-controls.js";
import { KD_ENEMY_POSITION_CACHE_COMPATIBILITY_FLAG } from "./kd-adapters.js";

const digestA = "a".repeat(64);
const digestB = "b".repeat(64);

describe("atomic mod compatibility controls", () => {
  it("covers every accepted-v6 path and path-cache source fallback", () => {
    expect(KD_PATHFINDING_SOURCE_COMPATIBILITY_FLAGS).toEqual([
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
    ]);
  });

  it("atomically applies every runtime-safe subsystem and restores owned state", () => {
    const target = {};
    const pathfinding = runtime();
    const applier = createModCompatibilityControlApplier({
      target,
      pathfindingRuntime: pathfinding.control,
    });

    const status = applier.apply(
      session(["buff-event-index", "enemy-position-cache", "pathfinding"]),
    );

    expect(status.kind).toBe("applied");
    expect(status.disabledSubsystems).toEqual([
      "buff-event-index",
      "enemy-position-cache",
      "pathfinding",
    ]);
    expect(status.reasons.map(({ code }) => code)).toEqual([
      "official-buff-events",
      "official-enemy-position-cache",
      "official-pathfinding",
    ]);
    expect(status.activeFlags).toEqual([
      KD_BUFF_EVENT_INDEX_COMPATIBILITY_FLAG,
      KD_ENEMY_POSITION_CACHE_COMPATIBILITY_FLAG,
      ...KD_PATHFINDING_SOURCE_COMPATIBILITY_FLAGS,
    ]);
    expect(Object.isFrozen(status)).toBe(true);
    expect(Object.isFrozen(status.activeFlags)).toBe(true);
    expect(Object.isFrozen(status.reasons)).toBe(true);
    expect(Object.isFrozen(status.reasons[0])).toBe(true);

    const control = readControl(target);
    for (const flag of status.activeFlags) {
      expect(Object.getOwnPropertyDescriptor(control, flag)).toMatchObject({
        value: true,
      });
    }
    expect(pathfinding.mode()).toBe("disabled");
    expect(pathfinding.reason()).toBe(KD_PATHFINDING_COMPATIBILITY_REASON);
    expect(pathfinding.disableCalls()).toBe(1);

    const disposed = applier.dispose();
    expect(disposed.kind).toBe("disposed");
    expect(disposed.disabledSubsystems).toEqual([]);
    expect(
      Object.getOwnPropertyDescriptor(target, KD_SOURCE_PATCH_CONTROL_NAME),
    ).toBeUndefined();
    expect(pathfinding.mode()).toBe("native");
    expect(pathfinding.reason()).toBeNull();
    expect(pathfinding.enableCalls()).toBe(1);
  });

  it("preserves preexisting safe flags and unrelated control properties", () => {
    const control = {
      marker: "keep",
      [KD_BUFF_EVENT_INDEX_COMPATIBILITY_FLAG]: true,
    };
    const target = {
      [KD_SOURCE_PATCH_CONTROL_NAME]: control,
    };
    const pathfinding = runtime("js-fallback", "signature-mismatch");
    const applier = createModCompatibilityControlApplier({
      target,
      pathfindingRuntime: pathfinding.control,
    });

    expect(
      applier.apply(session(["buff-event-index", "enemy-position-cache"])).kind,
    ).toBe("applied");
    expect(control[KD_BUFF_EVENT_INDEX_COMPATIBILITY_FLAG]).toBe(true);
    expect(
      (control as Record<string, unknown>)[
        KD_ENEMY_POSITION_CACHE_COMPATIBILITY_FLAG
      ],
    ).toBe(true);

    applier.dispose();
    expect(control).toEqual({
      marker: "keep",
      [KD_BUFF_EVENT_INDEX_COMPATIBILITY_FLAG]: true,
    });
    expect(target[KD_SOURCE_PATCH_CONTROL_NAME]).toBe(control);
    expect(pathfinding.disableCalls()).toBe(0);
    expect(pathfinding.enableCalls()).toBe(0);
  });

  it("restores an owned writable flag's exact original descriptor", () => {
    const control = {};
    Object.defineProperty(control, KD_BUFF_EVENT_INDEX_COMPATIBILITY_FLAG, {
      configurable: false,
      enumerable: false,
      value: false,
      writable: true,
    });
    const original = Object.getOwnPropertyDescriptor(
      control,
      KD_BUFF_EVENT_INDEX_COMPATIBILITY_FLAG,
    );
    const target = {
      [KD_SOURCE_PATCH_CONTROL_NAME]: control,
    };
    const applier = createModCompatibilityControlApplier({
      target,
      pathfindingRuntime: runtime().control,
    });

    expect(applier.apply(session(["buff-event-index"])).kind).toBe("applied");
    expect(
      Object.getOwnPropertyDescriptor(
        control,
        KD_BUFF_EVENT_INDEX_COMPATIBILITY_FLAG,
      ),
    ).toEqual({ ...original, value: true });

    applier.dispose();
    expect(
      Object.getOwnPropertyDescriptor(
        control,
        KD_BUFF_EVENT_INDEX_COMPATIBILITY_FLAG,
      ),
    ).toEqual(original);
  });

  it("blocks source compatibility before changing any runtime state", () => {
    const target = {};
    const pathfinding = runtime();
    const applier = createModCompatibilityControlApplier({
      target,
      pathfindingRuntime: pathfinding.control,
    });

    const status = failedApply(
      applier,
      session(["source-optimizations"], {
        restartRequired: true,
      }),
      "restart-required",
    );

    expect(status).toMatchObject({
      kind: "restart-required",
      requestedSubsystems: ["source-optimizations"],
      disabledSubsystems: [],
      restartRequired: true,
    });
    expect(status.reasons.map(({ code }) => code)).toEqual([
      "restart-for-original-source",
    ]);
    expect(Reflect.ownKeys(target)).toEqual([]);
    expect(pathfinding.disableCalls()).toBe(0);
  });

  it("never invokes a hostile root accessor", () => {
    const target = {};
    let getterCalls = 0;
    Object.defineProperty(target, KD_SOURCE_PATCH_CONTROL_NAME, {
      configurable: true,
      get: () => {
        getterCalls += 1;
        return {};
      },
    });
    const original = Object.getOwnPropertyDescriptor(
      target,
      KD_SOURCE_PATCH_CONTROL_NAME,
    );
    const pathfinding = runtime();
    const applier = createModCompatibilityControlApplier({
      target,
      pathfindingRuntime: pathfinding.control,
    });

    const status = failedApply(applier, session(["buff-event-index"]));

    expect(status.kind).toBe("failed");
    expect(getterCalls).toBe(0);
    expect(
      Object.getOwnPropertyDescriptor(target, KD_SOURCE_PATCH_CONTROL_NAME),
    ).toEqual(original);
    expect(pathfinding.disableCalls()).toBe(0);
  });

  it("preflights every flag before writing around a hostile flag accessor", () => {
    const control = {};
    let getterCalls = 0;
    const hostileFlag = KD_PATHFINDING_SOURCE_COMPATIBILITY_FLAGS[4];
    Object.defineProperty(control, hostileFlag, {
      configurable: true,
      get: () => {
        getterCalls += 1;
        return false;
      },
    });
    const original = Object.getOwnPropertyDescriptor(control, hostileFlag);
    const target = {
      [KD_SOURCE_PATCH_CONTROL_NAME]: control,
    };
    const pathfinding = runtime();
    const applier = createModCompatibilityControlApplier({
      target,
      pathfindingRuntime: pathfinding.control,
    });

    const status = failedApply(applier, session(["pathfinding"]));

    expect(status.kind).toBe("failed");
    expect(getterCalls).toBe(0);
    expect(Reflect.ownKeys(control)).toEqual([hostileFlag]);
    expect(Object.getOwnPropertyDescriptor(control, hostileFlag)).toEqual(
      original,
    );
    expect(pathfinding.disableCalls()).toBe(0);
  });

  it("rolls back every flag when runtime disable fails", () => {
    for (const mutatesBeforeFailure of [false, true]) {
      const target = {};
      const pathfinding = runtime();
      pathfinding.setDisableBehavior((reason) => {
        if (mutatesBeforeFailure) {
          pathfinding.setMode("disabled", reason);
        }
        return false;
      });
      const applier = createModCompatibilityControlApplier({
        target,
        pathfindingRuntime: pathfinding.control,
      });

      const status = failedApply(applier, session(["pathfinding"]));

      expect(status.kind).toBe("failed");
      expect(Reflect.ownKeys(target)).toEqual([]);
      expect(pathfinding.mode()).toBe("native");
      expect(pathfinding.reason()).toBeNull();
      expect(pathfinding.enableCalls()).toBe(mutatesBeforeFailure ? 1 : 0);
    }
  });

  it("fails closed without enabling a drifted runtime identity", () => {
    const target = {};
    const pathfinding = runtime();
    pathfinding.setDisableBehavior((reason) => {
      pathfinding.replaceIdentity();
      pathfinding.setMode("disabled", reason);
      return true;
    });
    const applier = createModCompatibilityControlApplier({
      target,
      pathfindingRuntime: pathfinding.control,
    });

    const status = failedApply(applier, session(["pathfinding"]));

    expect(status.kind).toBe("failed");
    expect(Reflect.ownKeys(target)).toEqual([]);
    expect(pathfinding.mode()).toBe("disabled");
    expect(pathfinding.enableCalls()).toBe(0);
  });

  it("is idempotent and never lets force-load undo compatibility", () => {
    const target = {};
    const pathfinding = runtime();
    const applier = createModCompatibilityControlApplier({
      target,
      pathfindingRuntime: pathfinding.control,
    });
    const first = applier.apply(
      session(["enemy-position-cache"], {
        compatibilityMods: [digestA],
      }),
    );
    const firstDescriptor = Object.getOwnPropertyDescriptor(
      readControl(target),
      KD_ENEMY_POSITION_CACHE_COMPATIBILITY_FLAG,
    );

    const second = applier.apply(
      session([], {
        forcedUnstableMods: [digestB],
      }),
    );

    expect(first.kind).toBe("applied");
    expect(second.kind).toBe("unchanged");
    expect(second.disabledSubsystems).toEqual(["enemy-position-cache"]);
    expect(second.forcedUnstableMods).toEqual([digestB]);
    expect(
      Object.getOwnPropertyDescriptor(
        readControl(target),
        KD_ENEMY_POSITION_CACHE_COMPATIBILITY_FLAG,
      ),
    ).toEqual(firstDescriptor);
    expect(
      (readControl(target) as Record<string, unknown>)[
        KD_ENEMY_POSITION_CACHE_COMPATIBILITY_FLAG
      ],
    ).toBe(true);
    expect(pathfinding.disableCalls()).toBe(0);
  });

  it("uses source fallbacks without changing an already-safe runtime mode", () => {
    for (const [mode, reason] of [
      ["js-fallback", "signature-mismatch"],
      ["disabled", "another-owner"],
      ["missing", "not-registered"],
    ] as const) {
      const target = {};
      const pathfinding = runtime(mode, reason);
      const applier = createModCompatibilityControlApplier({
        target,
        pathfindingRuntime: pathfinding.control,
      });

      expect(applier.apply(session(["pathfinding"])).kind).toBe("applied");
      expect(pathfinding.disableCalls()).toBe(0);
      applier.dispose();
      expect(pathfinding.mode()).toBe(mode);
      expect(pathfinding.reason()).toBe(reason);
      expect(pathfinding.enableCalls()).toBe(0);
    }
  });

  it("can monotonically add another subsystem after a preexisting JS fallback", () => {
    const target = {};
    const pathfinding = runtime("js-fallback", "signature-mismatch");
    const applier = createModCompatibilityControlApplier({
      target,
      pathfindingRuntime: pathfinding.control,
    });

    expect(applier.apply(session(["pathfinding"])).kind).toBe("applied");
    const extended = applier.apply(
      session(["pathfinding", "buff-event-index"]),
    );

    expect(extended.kind).toBe("applied");
    expect(extended.disabledSubsystems).toEqual([
      "buff-event-index",
      "pathfinding",
    ]);
    expect(pathfinding.disableCalls()).toBe(0);
  });

  it("restores only an owned runtime mode and leaves later owners alone", () => {
    const target = {};
    const pathfinding = runtime();
    const applier = createModCompatibilityControlApplier({
      target,
      pathfindingRuntime: pathfinding.control,
    });
    expect(applier.apply(session(["pathfinding"])).kind).toBe("applied");

    pathfinding.setMode("disabled", "external-owner");
    applier.dispose();

    expect(pathfinding.mode()).toBe("disabled");
    expect(pathfinding.reason()).toBe("external-owner");
    expect(pathfinding.enableCalls()).toBe(0);
  });

  it("does not overwrite a replacement control after identity drift", () => {
    const target: Record<string, unknown> = {};
    const pathfinding = runtime();
    const applier = createModCompatibilityControlApplier({
      target,
      pathfindingRuntime: pathfinding.control,
    });
    expect(applier.apply(session(["buff-event-index"])).kind).toBe("applied");
    const replacement = { owner: "mod" };
    target[KD_SOURCE_PATCH_CONTROL_NAME] = replacement;

    const drift = failedApply(applier, session(["enemy-position-cache"]));
    expect(drift.kind).toBe("failed");
    applier.dispose();
    expect(target[KD_SOURCE_PATCH_CONTROL_NAME]).toBe(replacement);
    expect(replacement).toEqual({ owner: "mod" });
  });

  it("rejects malformed subsystem input without any writes", () => {
    const target = {};
    const pathfinding = runtime();
    const applier = createModCompatibilityControlApplier({
      target,
      pathfindingRuntime: pathfinding.control,
    });
    const malformed = session([]) as unknown as {
      disabledSubsystems: string[];
    };
    malformed.disabledSubsystems = ["unknown"];

    const status = failedApply(
      applier,
      malformed as unknown as ModCompatibilitySessionStatus,
    );

    expect(status.kind).toBe("failed");
    expect(Reflect.ownKeys(target)).toEqual([]);
    expect(pathfinding.disableCalls()).toBe(0);
  });
});

function failedApply(
  applier: ModCompatibilityControlApplier,
  value: ModCompatibilitySessionStatus,
  expectedKind: ModCompatibilityControlStatusKind = "failed",
): ModCompatibilityControlStatus {
  let received: unknown;
  try {
    applier.apply(value);
  } catch (error) {
    received = error;
  }
  expect(received).toBeInstanceOf(ModCompatibilityControlApplyError);
  const failure = received as ModCompatibilityControlApplyError;
  expect(failure.status.kind).toBe(expectedKind);
  expect(applier.status()).toBe(failure.status);
  return failure.status;
}

function session(
  disabledSubsystems: readonly ModCompatibilitySubsystem[],
  overrides: Partial<ModCompatibilitySessionStatus> = {},
): ModCompatibilitySessionStatus {
  return {
    disabledMods: overrides.disabledMods ?? [],
    forcedUnstableMods: overrides.forcedUnstableMods ?? [],
    compatibilityMods: overrides.compatibilityMods ?? [digestA],
    disabledSubsystems,
    restartRequired: overrides.restartRequired ?? false,
  };
}

function readControl(target: object): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    target,
    KD_SOURCE_PATCH_CONTROL_NAME,
  );
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    typeof descriptor.value !== "object" ||
    descriptor.value === null
  ) {
    throw new Error("source compatibility control is unavailable");
  }
  return descriptor.value;
}

function runtime(
  initialMode: ModCompatibilityPathfindingRuntimeMode = "native",
  initialReason: string | null = null,
) {
  let identity: object = {};
  let mode = initialMode;
  let reason = initialReason;
  let disableCalls = 0;
  let enableCalls = 0;
  let disableBehavior: ((nextReason: string) => boolean) | undefined;
  const control: ModCompatibilityPathfindingRuntime = {
    state: () => ({ identity, mode, reason }),
    disable: (nextReason) => {
      disableCalls += 1;
      if (disableBehavior !== undefined) {
        return disableBehavior(nextReason);
      }
      mode = "disabled";
      reason = nextReason;
      return true;
    },
    enable: () => {
      enableCalls += 1;
      mode = initialMode;
      reason = initialReason;
      return true;
    },
  };
  return {
    control,
    mode: () => mode,
    reason: () => reason,
    disableCalls: () => disableCalls,
    enableCalls: () => enableCalls,
    setDisableBehavior(behavior: (nextReason: string) => boolean) {
      disableBehavior = behavior;
    },
    setMode(
      nextMode: ModCompatibilityPathfindingRuntimeMode,
      nextReason: string | null,
    ) {
      mode = nextMode;
      reason = nextReason;
    },
    replaceIdentity() {
      identity = {};
    },
  };
}
