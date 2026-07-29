import { describe, expect, it, vi } from "vitest";

import { KNOWN_UPSTREAM } from "@kd-hybrid/runtime";

import { installKinkyDungeonFramePacing } from "./frame-pacing.js";

describe("Kinky Dungeon GPU frame pacing", () => {
  it("paces only idle stage renders and keeps other render targets exact", () => {
    let time = 0;
    let visible = true;
    let focused = true;
    const stage = {};
    const renderTexture = {};
    const official = vi.fn((displayObject: unknown) => displayObject);
    const renderer = { render: official };
    const listeners = new Map<string, EventListener>();
    const target = {
      PIXI: { VERSION: "7.2.1" },
      PIXIapp: { renderer, stage },
      KDHybridRuntimeControl: {},
      addEventListener: (
        event: string,
        listener: EventListener
      ): void => {
        listeners.set(event, listener);
      },
      removeEventListener: (event: string): void => {
        listeners.delete(event);
      }
    };
    const pacing = installKinkyDungeonFramePacing(
      {
        upstreamVersion: KNOWN_UPSTREAM.gameVersion,
        upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256,
        mode: "adaptive",
        activeWindowMs: 0,
        idleIntervalMs: 15,
        backgroundIntervalMs: 33,
        hiddenIntervalMs: 100,
        now: () => time,
        isVisible: () => visible,
        hasFocus: () => focused
      },
      target
    );

    expect(renderer.render(stage)).toBe(stage);
    time = 8;
    expect(renderer.render(stage)).toBeUndefined();
    expect(renderer.render(renderTexture)).toBe(renderTexture);
    time = 16;
    expect(renderer.render(stage)).toBe(stage);

    focused = false;
    time = 30;
    expect(renderer.render(stage)).toBe(stage);
    time = 50;
    expect(renderer.render(stage)).toBeUndefined();
    time = 64;
    expect(renderer.render(stage)).toBe(stage);

    visible = false;
    time = 120;
    expect(renderer.render(stage)).toBe(stage);
    time = 151;
    expect(renderer.render(stage)).toBeUndefined();
    time = 221;
    expect(renderer.render(stage)).toBe(stage);

    expect(pacing.status()).toMatchObject({
      compatible: true,
      installed: true,
      currentProfile: "hidden",
      currentRateCeilingFps: 10,
      stageCalls: 9,
      renderedStageCalls: 6,
      skippedStageCalls: 3,
      otherRenderCalls: 1
    });
    expect(listeners.has("pointermove")).toBe(true);
  });

  it("returns immediately to unpaced rendering on activity", () => {
    let time = 0;
    const stage = {};
    const official = vi.fn();
    const renderer = { render: official };
    const target = {
      PIXI: { VERSION: "7.2.1" },
      PIXIapp: { renderer, stage },
      KDHybridRuntimeControl: {}
    };
    const pacing = installKinkyDungeonFramePacing(
      {
        upstreamVersion: KNOWN_UPSTREAM.gameVersion,
        upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256,
        mode: "adaptive",
        activeWindowMs: 100,
        idleIntervalMs: 15,
        now: () => time,
        isVisible: () => true,
        hasFocus: () => true
      },
      target
    );

    renderer.render(stage);
    time = 108;
    renderer.render(stage);
    time = 110;
    renderer.render(stage);
    expect(official).toHaveBeenCalledTimes(2);

    pacing.notifyActivity();
    time = 111;
    renderer.render(stage);
    time = 112;
    renderer.render(stage);
    expect(official).toHaveBeenCalledTimes(4);
  });

  it("holds the requested average cadence on a 144 Hz request stream", () => {
    let time = 0;
    const stage = {};
    const official = vi.fn();
    const renderer = { render: official };
    const target = {
      PIXI: { VERSION: "7.2.1" },
      PIXIapp: { renderer, stage },
      KDHybridRuntimeControl: {}
    };
    const pacing = installKinkyDungeonFramePacing(
      {
        upstreamVersion: KNOWN_UPSTREAM.gameVersion,
        upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256,
        mode: "adaptive",
        activeWindowMs: 0,
        now: () => time,
        isVisible: () => true,
        hasFocus: () => true
      },
      target
    );

    for (let frame = 0; frame < 144; frame += 1) {
      time = (frame * 1_000) / 144;
      renderer.render(stage);
    }

    expect(official).toHaveBeenCalledTimes(60);
    expect(pacing.status()).toMatchObject({
      currentProfile: "idle",
      currentRateCeilingFps: 60,
      stageCalls: 144,
      renderedStageCalls: 60,
      skippedStageCalls: 84
    });
  });

  it("honors the live disable switch without replacing the renderer again", () => {
    let time = 0;
    const stage = {};
    const official = vi.fn();
    const renderer = { render: official };
    const control = { disableGpuFramePacing: false };
    const target = {
      PIXI: { VERSION: "7.2.1" },
      PIXIapp: { renderer, stage },
      KDHybridRuntimeControl: control
    };
    const pacing = installKinkyDungeonFramePacing(
      {
        upstreamVersion: KNOWN_UPSTREAM.gameVersion,
        upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256,
        mode: "adaptive",
        activeWindowMs: 0,
        now: () => time,
        isVisible: () => true,
        hasFocus: () => true
      },
      target
    );

    renderer.render(stage);
    time = 1;
    renderer.render(stage);
    control.disableGpuFramePacing = true;
    time = 2;
    renderer.render(stage);
    time = 3;
    renderer.render(stage);

    expect(official).toHaveBeenCalledTimes(3);
    expect(pacing.status()).toMatchObject({
      skippedStageCalls: 1,
      bypassedStageCalls: 2
    });
  });

  it("fails closed on unknown KD or Pixi builds", () => {
    const renderer = { render: vi.fn() };
    const stage = {};
    const target = {
      PIXI: { VERSION: "8.0.0" },
      PIXIapp: { renderer, stage }
    };
    const pacing = installKinkyDungeonFramePacing(
      {
        upstreamVersion: KNOWN_UPSTREAM.gameVersion,
        upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256,
        mode: "adaptive"
      },
      target
    );

    expect(renderer.render).toBe(target.PIXIapp.renderer.render);
    expect(pacing.status()).toMatchObject({
      compatible: false,
      installed: false,
      compatibilityReason: "unsupported-pixi-version:8.0.0"
    });
  });

  it("restores the exact renderer property shape and preserves later wrappers", () => {
    const stage = {};
    const official = vi.fn();
    const prototype = { render: official };
    const renderer = Object.create(prototype) as {
      render: typeof official;
    };
    const target = {
      PIXI: { VERSION: "7.2.1" },
      PIXIapp: { renderer, stage }
    };
    const pacing = installKinkyDungeonFramePacing(
      {
        upstreamVersion: KNOWN_UPSTREAM.gameVersion,
        upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256,
        mode: "adaptive"
      },
      target
    );
    expect(Object.hasOwn(renderer, "render")).toBe(true);

    pacing.dispose();
    expect(Object.hasOwn(renderer, "render")).toBe(false);
    expect(renderer.render).toBe(official);

    const second = installKinkyDungeonFramePacing(
      {
        upstreamVersion: KNOWN_UPSTREAM.gameVersion,
        upstreamBundleSha256: KNOWN_UPSTREAM.bundleSha256,
        mode: "adaptive"
      },
      target
    );
    const laterWrapper = vi.fn();
    renderer.render = laterWrapper;
    second.dispose();
    expect(renderer.render).toBe(laterWrapper);
  });
});
