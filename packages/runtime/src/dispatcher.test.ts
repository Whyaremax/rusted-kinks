import { describe, expect, it } from "vitest";

import {
  completeJavaScriptCall,
  LegacySystemDispatcher,
  useJavaScriptFallback,
} from "./dispatcher.js";
import { functionSignature } from "./signatures.js";

function OfficialPath(value: number): number {
  return value + 1;
}

function OfficialPath19(
  this: unknown,
  arg0: unknown,
  _arg1: unknown,
  _arg2: unknown,
  _arg3: unknown,
  _arg4: unknown,
  _arg5: unknown,
  _arg6: unknown,
  _arg7: unknown,
  _arg8: unknown,
  _arg9: unknown,
  _arg10: unknown,
  _arg11: unknown,
  _arg12: unknown,
  _arg13: unknown,
  _arg14: unknown,
  _arg15: unknown,
  _arg16: unknown,
  _arg17: unknown,
  arg18: unknown,
): {
  thisValue: unknown;
  length: number;
  first: unknown;
  last: unknown;
  extra: unknown;
} {
  return {
    thisValue: this,
    length: arguments.length,
    first: arg0,
    last: arg18,
    extra: arguments[19],
  };
}

const candidate = {
  id: "fixture",
  name: "OfficialPath",
  arity: 1,
  sentinels: ["returnvalue+1"],
} as const;

describe("legacy system dispatcher", () => {
  it("uses native handler only for a unique signature", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: (value) => Number(value) + 10,
      directOfficialArity: 19,
    });
    expect((target.OfficialPath as (value: number) => number)(2)).toBe(12);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "native",
      nativeCalls: 1,
    });
  });

  it("falls back only the system replaced by a legacy mod", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: () => 50,
    });
    const facade = target.OfficialPath;
    target.OfficialPath = (value: number) => value * 3;
    dispatcher.reconcile();
    expect(dispatcher.dispatch("pathfinding", 4)).toBe(12);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "js-fallback",
      reason: "legacy-global-replaced",
    });

    target.OfficialPath = facade;
    dispatcher.reconcile();
    expect(dispatcher.dispatch("pathfinding", 4)).toBe(50);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "native",
      reason: null,
    });
  });

  it("lets a legacy wrapper call its captured facade without recursion", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: () => 50,
    });
    const facade = target.OfficialPath as (value: number) => number;
    let replacementCalls = 0;
    target.OfficialPath = (value: number) => {
      replacementCalls += 1;
      return facade(value) * 3;
    };
    dispatcher.reconcile();

    expect((target.OfficialPath as (value: number) => number)(4)).toBe(15);
    expect(replacementCalls).toBe(1);
    expect(dispatcher.dispatch("pathfinding", 5)).toBe(18);
    expect(replacementCalls).toBe(2);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "js-fallback",
      reason: "legacy-global-replaced",
      failures: 0,
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
      },
    });
    expect((target.OfficialPath as (value: number) => number)(4)).toBe(5);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "js-fallback",
      failures: 1,
      fallbackCalls: 1,
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
        Number(value) < 0 ? useJavaScriptFallback() : Number(value) + 10,
    });

    expect((target.OfficialPath as (value: number) => number)(-2)).toBe(-1);
    expect((target.OfficialPath as (value: number) => number)(2)).toBe(12);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "native",
      nativeCalls: 1,
      fallbackCalls: 1,
      failures: 0,
    });
  });

  it("routes a verified facade directly to official JavaScript inside a scope", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: (value) => Number(value) + 10,
    });
    const facade = target.OfficialPath;
    const activations: boolean[] = [];

    const scoped = dispatcher.withDirectOfficial(
      "OfficialPath",
      () => {
        expect(target.OfficialPath).toBe(facade);
        const result = (target.OfficialPath as (value: number) => number)(2);
        expect(dispatcher.status("pathfinding")[0]).toMatchObject({
          calls: 1,
          fallbackCalls: 1,
        });
        return result;
      },
      (active) => activations.push(active),
    );

    expect(scoped).toBe(3);
    expect(activations).toEqual([true]);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "native",
      calls: 1,
      nativeCalls: 0,
      fallbackCalls: 1,
      failures: 0,
    });
    expect((target.OfficialPath as (value: number) => number)(2)).toBe(12);
  });

  it("preserves receiver and arguments in the fixed-arity direct scope", () => {
    const target: Record<string, unknown> = { OfficialPath19 };
    const dispatcher = new LegacySystemDispatcher(target);
    const signature = functionSignature(OfficialPath19);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath19",
      candidates: [
        {
          id: "fixture-19",
          name: signature.name,
          arity: signature.arity,
          normalizedHash: signature.normalizedHash,
        },
      ],
      native: () => "native",
      directOfficialArity: 19,
    });
    const facade = target.OfficialPath19 as (...args: unknown[]) => unknown;
    expect(facade).toHaveLength(19);
    const args = Array.from({ length: 19 }, (_, index) => index);

    const results = dispatcher.withDirectOfficial("OfficialPath19", () => [
      facade(...args),
      facade(...args, "extra"),
    ]) as {
      thisValue: unknown;
      length: number;
      first: unknown;
      last: unknown;
      extra: unknown;
    }[];

    expect(results).toEqual([
      {
        thisValue: target,
        length: 19,
        first: 0,
        last: 18,
        extra: undefined,
      },
      {
        thisValue: target,
        length: 20,
        first: 0,
        last: 18,
        extra: "extra",
      },
    ]);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      calls: 2,
      nativeCalls: 0,
      fallbackCalls: 2,
      failures: 0,
    });
  });

  it("refuses direct official routing when a pathfinding hook is active", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: (value) => Number(value) * 2,
      directOfficialArity: 19,
    });
    dispatcher.registerHook("pathfinding", "before", (context) => {
      context.args[0] = 4;
    });
    let active: boolean | undefined;

    const scoped = dispatcher.withDirectOfficial(
      "OfficialPath",
      () => (target.OfficialPath as (value: number) => number)(1),
      (value) => {
        active = value;
      },
    );

    expect(active).toBe(false);
    expect(scoped).toBe(8);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      nativeCalls: 1,
      fallbackCalls: 0,
    });
  });

  it("refuses direct official routing after a legacy replacement", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: () => 50,
      directOfficialArity: 19,
    });
    target.OfficialPath = (value: number) => value * 3;
    dispatcher.reconcile();
    let active: boolean | undefined;

    const scoped = dispatcher.withDirectOfficial(
      "OfficialPath",
      () => (target.OfficialPath as (value: number) => number)(4),
      (value) => {
        active = value;
      },
    );

    expect(active).toBe(false);
    expect(scoped).toBe(12);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "js-fallback",
      reason: "legacy-global-replaced",
    });
  });

  it("stops direct routing if a hook is registered during the scope", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: (value) => Number(value) * 2,
      directOfficialArity: 19,
    });

    dispatcher.withDirectOfficial("OfficialPath", () => {
      expect((target.OfficialPath as (value: number) => number)(2)).toBe(3);
      dispatcher.registerHook("pathfinding", "before", (context) => {
        context.args[0] = 5;
      });
      expect((target.OfficialPath as (value: number) => number)(2)).toBe(10);
    });

    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      calls: 2,
      nativeCalls: 1,
      fallbackCalls: 1,
    });
  });

  it("clears direct official routing after an exception", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: (value) => Number(value) + 10,
    });

    expect(() =>
      dispatcher.withDirectOfficial("OfficialPath", () => {
        expect((target.OfficialPath as (value: number) => number)(2)).toBe(3);
        throw new Error("scope failed");
      }),
    ).toThrow("scope failed");
    expect((target.OfficialPath as (value: number) => number)(2)).toBe(12);
  });

  it("accepts an already-completed JavaScript call from an around-adapter", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: (value) =>
        completeJavaScriptCall(() => OfficialPath(Number(value)) * 2),
    });

    expect((target.OfficialPath as (value: number) => number)(4)).toBe(10);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "native",
      nativeCalls: 1,
      fallbackCalls: 0,
      failures: 0,
    });
  });

  it("does not rerun JavaScript when an around-adapter already threw", () => {
    let calls = 0;
    const target: Record<string, unknown> = { OfficialPath };
    const alreadyRunningOfficial = (_value: number): number => {
      calls += 1;
      throw new Error("upstream failure");
    };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: (value) =>
        completeJavaScriptCall(() => alreadyRunningOfficial(Number(value))),
    });

    expect(() => (target.OfficialPath as (value: number) => number)(4)).toThrow(
      "upstream failure",
    );
    expect(calls).toBe(1);
    expect(dispatcher.status("pathfinding")[0]).toMatchObject({
      mode: "native",
      nativeCalls: 1,
      fallbackCalls: 0,
      failures: 1,
    });
  });

  it("runs ordered before and after hooks", () => {
    const target: Record<string, unknown> = { OfficialPath };
    const dispatcher = new LegacySystemDispatcher(target);
    dispatcher.registerSystem({
      system: "pathfinding",
      globalName: "OfficialPath",
      candidates: [candidate],
      native: (value) => Number(value) * 2,
    });
    const order: string[] = [];
    dispatcher.registerHook(
      "pathfinding",
      "before",
      (context) => {
        expect(context.globalName).toBe("OfficialPath");
        order.push("high");
        context.args[0] = 3;
      },
      { priority: 10 },
    );
    dispatcher.registerHook("pathfinding", "before", () => order.push("low"));
    dispatcher.registerHook("pathfinding", "after", (context) => {
      order.push("after");
      context.result = Number(context.result) + 1;
    });
    expect((target.OfficialPath as (value: number) => number)(1)).toBe(7);
    expect(order).toEqual(["high", "low", "after"]);
  });

  it("reports hooks globally and by system", () => {
    const dispatcher = new LegacySystemDispatcher({ OfficialPath });
    expect(dispatcher.hasHooks()).toBe(false);
    expect(dispatcher.hasHooks("mapGeneration")).toBe(false);

    const pathHook = dispatcher.registerHook(
      "pathfinding",
      "before",
      () => undefined,
    );
    const mapHook = dispatcher.registerHook(
      "mapGeneration",
      "after",
      () => undefined,
    );

    expect(dispatcher.hasHooks()).toBe(true);
    expect(dispatcher.hasHooks("pathfinding")).toBe(true);
    expect(dispatcher.hasHooks("mapGeneration")).toBe(true);
    expect(dispatcher.hasHooks("movement")).toBe(false);

    expect(dispatcher.unregisterHook(mapHook)).toBe(true);
    expect(dispatcher.hasHooks("mapGeneration")).toBe(false);
    expect(dispatcher.hasHooks()).toBe(true);
    expect(dispatcher.unregisterHook(pathHook)).toBe(true);
    expect(dispatcher.hasHooks()).toBe(false);
  });
});
