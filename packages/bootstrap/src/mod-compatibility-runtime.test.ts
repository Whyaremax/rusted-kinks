// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from "vitest";

import { LegacySystemDispatcher, type SystemStatus } from "@kd-hybrid/runtime";

import { createRuntimePathfindingCompatibilityPort } from "./mod-compatibility-runtime.js";

describe("runtime pathfinding compatibility port", () => {
  it("disables and restores an exact native runtime identity", () => {
    let statuses: readonly SystemStatus[] = [status("native", null)];
    const dispatcher = {
      status: vi.fn(() => statuses),
      disable: vi.fn((_system: string, reason: string) => {
        statuses = [status("disabled", reason)];
        return true;
      }),
      enable: vi.fn(() => {
        statuses = [status("native", null)];
        return true;
      }),
    };
    const port = createRuntimePathfindingCompatibilityPort({
      dispatcher,
    } as never);
    const identity = port.state().identity;

    expect(port.disable("kd-hybrid-mod-compatibility:pathfinding")).toBe(true);
    expect(port.state()).toEqual({
      identity,
      mode: "disabled",
      reason: "kd-hybrid-mod-compatibility:pathfinding",
    });
    expect(port.enable()).toBe(true);
    expect(port.state()).toEqual({
      identity,
      mode: "native",
      reason: null,
    });
  });

  it("reports missing and no-native official modes without mutation", () => {
    let statuses: readonly SystemStatus[] = [];
    const dispatcher = {
      status: vi.fn(() => statuses),
      disable: vi.fn(),
      enable: vi.fn(),
    };
    const port = createRuntimePathfindingCompatibilityPort({
      dispatcher,
    } as never);

    expect(port.state().mode).toBe("missing");
    expect(port.disable("reason")).toBe(false);

    statuses = [status("js-fallback", "signature-mismatch")];
    expect(port.state()).toMatchObject({
      mode: "js-fallback",
      reason: "signature-mismatch",
    });
    expect(port.disable("reason")).toBe(true);

    statuses = [
      status("disabled", "already-disabled", "KinkyDungeonFindPath", "primary"),
      status(
        "js-fallback",
        "signature-mismatch",
        "KinkyDungeonFindPathMany",
        null,
      ),
    ];
    expect(port.state()).toMatchObject({
      mode: "js-fallback",
      reason: "signature-mismatch",
    });
    expect(port.disable("reason")).toBe(true);
    expect(dispatcher.disable).not.toHaveBeenCalled();
  });

  it("disables a mixed native and fallback aggregate through the dispatcher", () => {
    let statuses: readonly SystemStatus[] = mixedStatuses();
    const dispatcher = {
      status: vi.fn(() => statuses),
      disable: vi.fn((_system: string, reason: string) => {
        statuses = statuses.map((entry) =>
          status("disabled", reason, entry.globalName, entry.signature),
        );
        return true;
      }),
      enable: vi.fn(() => {
        statuses = mixedStatuses("disabled");
        return true;
      }),
    };
    const port = createRuntimePathfindingCompatibilityPort({
      dispatcher,
    } as never);
    const identity = port.state().identity;

    expect(port.state()).toEqual({
      identity,
      mode: "native",
      reason: null,
    });
    expect(port.disable("compatibility")).toBe(true);
    expect(dispatcher.disable).toHaveBeenCalledWith(
      "pathfinding",
      "compatibility",
    );
    expect(port.state()).toEqual({
      identity,
      mode: "disabled",
      reason: "compatibility",
    });

    expect(port.enable()).toBe(true);
    expect(dispatcher.enable).toHaveBeenCalledWith("pathfinding");
    expect(port.state()).toEqual({
      identity,
      mode: "native",
      reason: null,
    });
  });

  it("round-trips a real dispatcher with supported and unsupported entries", () => {
    function SupportedPath(value: number): number {
      return value + 1;
    }
    function UnsupportedPath(value: number): number {
      return value - 1;
    }
    const dispatcher = new LegacySystemDispatcher({
      SupportedPath,
      UnsupportedPath,
    });
    const candidates = [
      {
        id: "supported",
        name: "SupportedPath",
        arity: 1,
        sentinels: ["returnvalue+1"],
      },
    ] as const;
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "SupportedPath",
      candidates,
      native: () => 10,
    });
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "UnsupportedPath",
      candidates,
      native: () => 20,
    });
    const port = createRuntimePathfindingCompatibilityPort({
      dispatcher,
    } as never);

    expect(dispatcher.status("pathfinding").map(({ mode }) => mode)).toEqual([
      "native",
      "js-fallback",
    ]);
    expect(port.state()).toMatchObject({ mode: "native", reason: null });

    expect(port.disable("compatibility")).toBe(true);
    expect(
      dispatcher
        .status("pathfinding")
        .map(({ mode, reason }) => ({ mode, reason })),
    ).toEqual([
      { mode: "disabled", reason: "compatibility" },
      { mode: "disabled", reason: "compatibility" },
    ]);

    expect(port.enable()).toBe(true);
    expect(dispatcher.status("pathfinding").map(({ mode }) => mode)).toEqual([
      "native",
      "disabled",
    ]);
    expect(port.state()).toMatchObject({ mode: "native", reason: null });
  });

  it("rolls back a partial disable that misses its exact postcondition", () => {
    const original = mixedStatuses();
    let statuses: readonly SystemStatus[] = original;
    const dispatcher = {
      status: vi.fn(() => statuses),
      disable: vi.fn((_system: string, reason: string) => {
        statuses = [
          status(
            "disabled",
            reason,
            original[0]!.globalName,
            original[0]!.signature,
          ),
          original[1]!,
        ];
        return true;
      }),
      enable: vi.fn(() => {
        statuses = original;
        return true;
      }),
    };
    const port = createRuntimePathfindingCompatibilityPort({
      dispatcher,
    } as never);

    expect(port.disable("compatibility")).toBe(false);
    expect(dispatcher.enable).toHaveBeenCalledWith("pathfinding");
    expect(port.state()).toMatchObject({
      mode: "native",
      reason: null,
    });
  });

  it("rolls back when disable throws after changing routing state", () => {
    let statuses: readonly SystemStatus[] = [status("native", null)];
    const dispatcher = {
      status: vi.fn(() => statuses),
      disable: vi.fn((_system: string, reason: string) => {
        statuses = [status("disabled", reason)];
        throw new Error("disable failed after mutation");
      }),
      enable: vi.fn(() => {
        statuses = [status("native", null)];
        return true;
      }),
    };
    const port = createRuntimePathfindingCompatibilityPort({
      dispatcher,
    } as never);

    expect(port.disable("compatibility")).toBe(false);
    expect(dispatcher.enable).toHaveBeenCalledWith("pathfinding");
    expect(port.state().mode).toBe("native");
  });

  it("does not enable when a failed disable left routing unchanged", () => {
    const statuses: readonly SystemStatus[] = [status("native", null)];
    const dispatcher = {
      status: vi.fn(() => statuses),
      disable: vi.fn(() => false),
      enable: vi.fn(),
    };
    const port = createRuntimePathfindingCompatibilityPort({
      dispatcher,
    } as never);

    expect(port.disable("reason")).toBe(false);
    expect(dispatcher.enable).not.toHaveBeenCalled();
    expect(port.state().mode).toBe("native");
  });

  it("fails topology drift and attempts to restore native routing", () => {
    const original: readonly SystemStatus[] = [status("native", null)];
    let statuses = original;
    const dispatcher = {
      status: vi.fn(() => statuses),
      disable: vi.fn((_system: string, reason: string) => {
        statuses = [
          status("disabled", reason, "UnexpectedPathfinder", "signature"),
        ];
        return true;
      }),
      enable: vi.fn(() => {
        statuses = original;
        return true;
      }),
    };
    const port = createRuntimePathfindingCompatibilityPort({
      dispatcher,
    } as never);

    expect(port.disable("compatibility")).toBe(false);
    expect(dispatcher.enable).toHaveBeenCalledWith("pathfinding");
    expect(port.state().mode).toBe("native");
  });

  it("re-disables pathfinding when enable partially mutates then fails", () => {
    let statuses: readonly SystemStatus[] = [status("native", null)];
    const dispatcher = {
      status: vi.fn(() => statuses),
      disable: vi.fn((_system: string, reason: string) => {
        statuses = [status("disabled", reason)];
        return true;
      }),
      enable: vi.fn(() => {
        statuses = [status("native", null)];
        return false;
      }),
    };
    const port = createRuntimePathfindingCompatibilityPort({
      dispatcher,
    } as never);

    expect(port.disable("compatibility")).toBe(true);
    expect(port.enable()).toBe(false);
    expect(dispatcher.disable).toHaveBeenNthCalledWith(
      2,
      "pathfinding",
      "compatibility",
    );
    expect(port.state()).toMatchObject({
      mode: "disabled",
      reason: "compatibility",
    });
  });
});

function mixedStatuses(
  unsupportedMode: "js-fallback" | "disabled" = "js-fallback",
): readonly SystemStatus[] {
  return Object.freeze([
    status("native", null, "KinkyDungeonFindPath", "primary-signature"),
    status(
      unsupportedMode,
      "signature-mismatch",
      "KinkyDungeonFindPathMany",
      null,
    ),
  ]);
}

function status(
  mode: SystemStatus["mode"],
  reason: string | null,
  globalName = "KinkyDungeonFindPath",
  signature: string | null = "signature",
): SystemStatus {
  return Object.freeze({
    system: "pathfinding",
    globalName,
    mode,
    signature,
    calls: 0,
    nativeCalls: 0,
    fallbackCalls: 0,
    failures: 0,
    reason,
  });
}
