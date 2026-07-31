// SPDX-License-Identifier: MIT

import type { KDHybridRuntime, SystemStatus } from "@kd-hybrid/runtime";

import type {
  ModCompatibilityPathfindingRuntime,
  ModCompatibilityPathfindingRuntimeState,
} from "./mod-compatibility-controls.js";

interface OwnedDisable {
  readonly before: readonly SystemStatus[];
  readonly reason: string;
}

/**
 * Adapts the runtime's aggregate pathfinding dispatcher to the narrow,
 * identity-checked compatibility-control port.
 */
export function createRuntimePathfindingCompatibilityPort(
  runtime: Pick<KDHybridRuntime, "dispatcher">,
): ModCompatibilityPathfindingRuntime {
  const dispatcher = runtime.dispatcher;
  const identity = dispatcher;
  let ownedDisable: OwnedDisable | undefined;

  const readStatuses = (): readonly SystemStatus[] =>
    snapshotStatuses(dispatcher.status("pathfinding"));
  const current = (): ModCompatibilityPathfindingRuntimeState =>
    stateFromStatuses(identity, readStatuses());

  return Object.freeze({
    state: current,
    disable(reason: string) {
      const before = readStatuses();
      const beforeState = aggregatePathfindingStatus(before);
      if (beforeState.mode === "missing") {
        return false;
      }
      if (!before.some((status) => status.mode === "native")) {
        return true;
      }

      let result: boolean;
      try {
        result = dispatcher.disable("pathfinding", reason);
      } catch {
        rollbackFailedDisable(dispatcher, before);
        return false;
      }

      let after: readonly SystemStatus[];
      try {
        after = readStatuses();
      } catch {
        safeEnable(dispatcher);
        return false;
      }
      if (
        result === true &&
        sameTopology(before, after) &&
        after.every(
          (status) => status.mode === "disabled" && status.reason === reason,
        )
      ) {
        ownedDisable = Object.freeze({ before, reason });
        return true;
      }

      if (!sameRoutingState(before, after)) {
        safeEnable(dispatcher);
      }
      return false;
    },
    enable() {
      const before = readStatuses();
      const beforeState = aggregatePathfindingStatus(before);
      if (beforeState.mode === "missing") {
        return false;
      }
      if (beforeState.mode !== "disabled") {
        return true;
      }

      let result: boolean;
      try {
        result = dispatcher.enable("pathfinding");
      } catch {
        rollbackFailedEnable(dispatcher, beforeState.reason);
        return false;
      }

      let after: readonly SystemStatus[];
      try {
        after = readStatuses();
      } catch {
        rollbackFailedEnable(dispatcher, beforeState.reason);
        return false;
      }
      const afterState = aggregatePathfindingStatus(after);
      if (
        result === true &&
        sameTopology(before, after) &&
        (ownedDisable === undefined ||
          sameTopology(ownedDisable.before, after)) &&
        after.some((status) => status.mode === "native") &&
        afterState.mode === "native" &&
        afterState.reason === null
      ) {
        ownedDisable = undefined;
        return true;
      }

      rollbackFailedEnable(dispatcher, beforeState.reason);
      return false;
    },
  });
}

function stateFromStatuses(
  identity: unknown,
  statuses: readonly SystemStatus[],
): ModCompatibilityPathfindingRuntimeState {
  return Object.freeze({
    identity,
    ...aggregatePathfindingStatus(statuses),
  });
}

function snapshotStatuses(
  statuses: readonly SystemStatus[],
): readonly SystemStatus[] {
  return Object.freeze(statuses.map((status) => Object.freeze({ ...status })));
}

function aggregatePathfindingStatus(
  statuses: readonly SystemStatus[],
): Pick<ModCompatibilityPathfindingRuntimeState, "mode" | "reason"> {
  if (statuses.length === 0) {
    return { mode: "missing", reason: null };
  }
  if (statuses.some((status) => status.mode === "native")) {
    return { mode: "native", reason: null };
  }
  if (statuses.every((status) => status.mode === "disabled")) {
    const firstReason = statuses[0]?.reason ?? null;
    return {
      mode: "disabled",
      reason: statuses.every((status) => status.reason === firstReason)
        ? firstReason
        : "mixed-disabled-reasons",
    };
  }
  return {
    mode: "js-fallback",
    reason:
      statuses.find((status) => status.mode === "js-fallback")?.reason ??
      "mixed-pathfinding-runtime",
  };
}

function sameTopology(
  left: readonly SystemStatus[],
  right: readonly SystemStatus[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (status, index) =>
        status.system === right[index]?.system &&
        status.globalName === right[index]?.globalName &&
        status.signature === right[index]?.signature,
    )
  );
}

function sameRoutingState(
  left: readonly SystemStatus[],
  right: readonly SystemStatus[],
): boolean {
  return (
    sameTopology(left, right) &&
    left.every(
      (status, index) =>
        status.mode === right[index]?.mode &&
        status.reason === right[index]?.reason,
    )
  );
}

function rollbackFailedDisable(
  dispatcher: Pick<KDHybridRuntime["dispatcher"], "enable" | "status">,
  before: readonly SystemStatus[],
): void {
  try {
    const after = snapshotStatuses(dispatcher.status("pathfinding"));
    if (sameRoutingState(before, after)) {
      return;
    }
  } catch {
    // Mutation state is unknown, so conservatively try to restore native paths.
  }
  safeEnable(dispatcher);
}

function safeEnable(
  dispatcher: Pick<KDHybridRuntime["dispatcher"], "enable">,
): void {
  try {
    dispatcher.enable("pathfinding");
  } catch {
    // The caller reports failure; no further in-process restoration is safe.
  }
}

function rollbackFailedEnable(
  dispatcher: Pick<KDHybridRuntime["dispatcher"], "disable">,
  reason: string | null,
): void {
  if (reason === null) {
    return;
  }
  try {
    dispatcher.disable("pathfinding", reason);
  } catch {
    // The caller reports failure; preserving a non-native route is best effort.
  }
}
