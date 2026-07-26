import { describe, expect, it } from "vitest";

import {
  AdaptiveAssetManager,
  type AssetBackend
} from "./assets.js";

describe("adaptive asset manager", () => {
  it("deduplicates concurrent atlas loads and evicts only unreferenced pages", async () => {
    let loads = 0;
    const disposed: string[] = [];
    const backend: AssetBackend<string> = {
      async loadPage(pageId, tier) {
        loads += 1;
        await Promise.resolve();
        return { resource: `${tier}:${pageId}`, byteLength: 100 };
      },
      disposePage(resource) {
        disposed.push(resource);
      }
    };
    let now = 0;
    const manager = new AdaptiveAssetManager(backend, "high", () => now);
    manager.register({
      id: "hero",
      pageByTier: {
        high: "characters-2k",
        balanced: "characters-1k",
        performance: "characters-512"
      }
    });
    manager.register({
      id: "enemy",
      pageByTier: {
        high: "characters-2k",
        balanced: "characters-1k",
        performance: "characters-512"
      }
    });
    const [hero, enemy] = await Promise.all([
      manager.acquire("hero"),
      manager.acquire("enemy")
    ]);
    expect(loads).toBe(1);
    expect(manager.status().referencedPages).toBe(1);
    hero.release();
    expect(manager.evict({ maxIdleMs: 0, byteBudget: 0 })).toBe(0);
    enemy.release();
    now = 10;
    expect(manager.evict({ maxIdleMs: 1, byteBudget: 0 })).toBe(1);
    expect(disposed).toEqual(["high:characters-2k"]);
  });
});
