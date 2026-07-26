import { describe, expect, it } from "vitest";

import {
  LegacySystemDispatcher,
  useJavaScriptFallback
} from "./dispatcher.js";

function OfficialPath(value: number): number {
  return value + 1;
}

const candidate = {
  id: "fixture",
  name: "OfficialPath",
  arity: 1,
  sentinels: ["returnvalue+1"]
} as const;

describe("legacy system dispatcher", () => {
  it("uses native handler only for a unique signature", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: (value) => Number(value) + 10
    });
    expect((target.OfficialPath as (value: number) => number)(2)).toBe(12);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "native",
      nativeCalls: 1
    });
  });

  it("falls back only the system replaced by a legacy mod", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: () => 50
    });
    target.OfficialPath = (value: number) => value * 3;
    dispatcher.reconcile();
    expect(dispatcher.dispatch("pathfinding", 4)).toBe(12);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "js-fallback",
      reason: "legacy-global-replaced"
    });
  });

  it("trips to JavaScript after a transactional native exception", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: () => {
        throw new Error("invalid native response");
      }
    });
    expect((target.OfficialPath as (value: number) => number)(4)).toBe(5);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "js-fallback",
      failures: 1,
      fallbackCalls: 1
    });
  });

  it("falls back for one unsupported call without disabling native mode", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: (value) =>
        Number(value) < 0 ? useJavaScriptFallback() : Number(value) + 10
    });

    expect((target.OfficialPath as (value: number) => number)(-2)).toBe(-1);
    expect((target.OfficialPath as (value: number) => number)(2)).toBe(12);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "native",
      nativeCalls: 1,
      fallbackCalls: 1,
      failures: 0
    });
  });

  it("runs ordered before and after hooks", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: (value) => Number(value) * 2
    });
    const order: string[] = [];
    dispatcher.registerHook(
      "pathfinding",
      "before",
      (context) => {
        order.push("high");
        context.args[0] = 3;
      },
      { priority: 10 }
    );
    dispatcher.registerHook("pathfinding", "before", () => order.push("low"));
    dispatcher.registerHook("pathfinding", "after", (context) => {
      order.push("after");
      context.result = Number(context.result) + 1;
    });
    expect((target.OfficialPath as (value: number) => number)(1)).toBe(7);
    expect(order).toEqual(["high", "low", "after"]);
  });
});
