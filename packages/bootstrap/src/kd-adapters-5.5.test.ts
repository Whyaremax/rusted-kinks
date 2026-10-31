import { describe, expect, it } from "vitest";

import {
  isCompletedJavaScriptCall,
  isNativeFallbackRequest,
} from "@kd-hybrid/runtime";

import {
  createKDCommanderHelpShortcutHandler,
  matchesKnownFunctionSignature,
  type KDCommanderEntity,
  type KDCommanderHelpEnvironment,
  type KDCommanderOrdersLike,
} from "./kd-adapters.js";

describe("KD 5.5 commander player-entity guard", () => {
  it("falls back before observing or replacing filters for a player entity", () => {
    const state = fixture([{ id: -1, x: 1, y: 1, player: true }]);
    const handler = createKDCommanderHelpShortcutHandler(
      state.official,
      state.environment,
    );

    expect(isNativeFallbackRequest(handler({ delta: 1 }))).toBe(true);
    expect(state.calls).toEqual({
      filters: 0,
      observed: 0,
      official: 0,
      stopped: 0,
    });
  });

  it("fails closed on a player accessor without invoking it", () => {
    let getterCalls = 0;
    const entity: KDCommanderEntity = { id: 1, x: 1, y: 1 };
    Object.defineProperty(entity, "player", {
      configurable: true,
      get: () => {
        getterCalls += 1;
        return false;
      },
    });
    const state = fixture([entity]);
    const handler = createKDCommanderHelpShortcutHandler(
      state.official,
      state.environment,
    );

    expect(isNativeFallbackRequest(handler({ delta: 1 }))).toBe(true);
    expect(getterCalls).toBe(0);
    expect(state.calls.observed).toBe(0);
  });

  it("fails closed when the descriptor intrinsic changes", () => {
    const state = fixture([{ id: 1, x: 1, y: 1 }]);
    const handler = createKDCommanderHelpShortcutHandler(
      state.official,
      state.environment,
    );
    const original = Object.getOwnPropertyDescriptor;
    let result: unknown;
    try {
      Object.getOwnPropertyDescriptor = (() => undefined) as typeof original;
      result = handler({ delta: 1 });
    } finally {
      Object.getOwnPropertyDescriptor = original;
    }

    expect(isNativeFallbackRequest(result)).toBe(true);
    expect(state.calls).toEqual({
      filters: 0,
      observed: 0,
      official: 0,
      stopped: 0,
    });
  });

  it("fails closed when the prototype intrinsic changes", () => {
    const state = fixture([{ id: 1, x: 1, y: 1 }]);
    const handler = createKDCommanderHelpShortcutHandler(
      state.official,
      state.environment,
    );
    const original = Object.getPrototypeOf;
    let result: unknown;
    try {
      Object.getPrototypeOf = (() => null) as typeof original;
      result = handler({ delta: 1 });
    } finally {
      Object.getPrototypeOf = original;
    }

    expect(isNativeFallbackRequest(result)).toBe(true);
    expect(state.calls).toEqual({
      filters: 0,
      observed: 0,
      official: 0,
      stopped: 0,
    });
  });

  it("does not trust a mutated Array.prototype.includes for signatures", () => {
    const original = Array.prototype.includes;
    let matched: boolean;
    try {
      Array.prototype.includes = () => true;
      matched = matchesKnownFunctionSignature("changed", ["known"]);
    } finally {
      Array.prototype.includes = original;
    }

    expect(matched).toBe(false);
  });

  it("switches to the exact filter when a mutation adds a player entity", () => {
    const candidate = {
      id: 1,
      x: 1,
      y: 1,
      eligible: false,
    } satisfies FixtureEntity;
    const state = fixture([candidate]);
    const handler = createKDCommanderHelpShortcutHandler(() => {
      const first = state.orders.helpStruggle?.filter(candidate);
      state.mutate(() => {
        state.entities.push({ id: -1, x: 2, y: 1, player: true });
      });
      const second = state.orders.helpStruggle?.filter(candidate);
      return [first, second];
    }, state.environment);

    const result = handler({ delta: 1 });
    expect(isCompletedJavaScriptCall(result)).toBe(true);
    if (!isCompletedJavaScriptCall(result) || !result.ok) {
      throw new Error("commander handler did not complete");
    }
    expect(result.value).toEqual([false, false]);
    expect(state.calls).toEqual({
      filters: 1,
      observed: 1,
      official: 0,
      stopped: 1,
    });
  });
});

interface FixtureEntity extends KDCommanderEntity {
  eligible?: boolean;
}

function fixture(initialEntities: FixtureEntity[]) {
  const entities = [...initialEntities];
  const calls = {
    filters: 0,
    observed: 0,
    official: 0,
    stopped: 0,
  };
  let observer: (() => void) | null = null;
  const orders: KDCommanderOrdersLike = {
    helpStruggle: {
      filter: (enemy: unknown) => {
        calls.filters += 1;
        return (enemy as FixtureEntity).eligible !== false;
      },
    },
    helpDanger: {
      filter: (enemy: unknown) => {
        calls.filters += 1;
        return (enemy as FixtureEntity).eligible !== false;
      },
    },
  };
  const environment: KDCommanderHelpEnvironment = {
    mapData: () => ({
      Grid: "0".repeat(16),
      GridWidth: 4,
      GridHeight: 4,
      Entities: entities,
    }),
    orders: () => orders,
    boundEffects: () => 0,
    imprisoned: () => false,
    tileDangerous: () => false,
    disabled: () => false,
    nearbyMapTiles: () => [],
    entityAt: () => null,
    movableEnemyTiles: () => "0",
    candidateMayNeedHelp: (enemy) =>
      (enemy as FixtureEntity).eligible !== false,
    compatible: () => true,
    observeMutations: (callback) => {
      calls.observed += 1;
      observer = callback;
      return () => {
        calls.stopped += 1;
        observer = null;
      };
    },
  };
  return {
    calls,
    entities,
    environment,
    orders,
    official: () => {
      calls.official += 1;
    },
    mutate(callback: () => void) {
      observer?.();
      callback();
      observer?.();
    },
  };
}
