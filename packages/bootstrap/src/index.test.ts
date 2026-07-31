// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from "vitest";

import {
  drainModPreflightBeforeTeardown,
  settleNativeAdapterRegistrations,
  shouldInstallKDNearestPlayerAdapter,
} from "./index.js";

describe("mod preflight teardown barrier", () => {
  it("keeps owned runtime state alive until an active load drains", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const dispose = vi.fn();
    const teardown = vi.fn();

    drainModPreflightBeforeTeardown(
      {
        dispose,
        drain: () => pending,
      },
      teardown,
    );

    expect(dispose).toHaveBeenCalledOnce();
    expect(teardown).not.toHaveBeenCalled();
    release();
    await pending;
    await Promise.resolve();
    expect(teardown).toHaveBeenCalledOnce();
  });

  it("tears down synchronously when no activation is in flight", () => {
    const dispose = vi.fn();
    const teardown = vi.fn();

    drainModPreflightBeforeTeardown(
      {
        dispose,
        drain: () => undefined,
      },
      teardown,
    );

    expect(dispose).toHaveBeenCalledOnce();
    expect(teardown).toHaveBeenCalledOnce();
  });
});

describe("native adapter registration barrier", () => {
  it("waits for every sibling before surfacing an early rejection", async () => {
    const failure = new Error("path registration failed");
    let releaseDelayedPath!: () => void;
    const delayedPath = new Promise<void>((resolve) => {
      releaseDelayedPath = resolve;
    });
    const rejectEarly = vi.fn(() => Promise.reject(failure));
    const waitForDelayedPath = vi.fn(() => delayedPath);
    const finishEarly = vi.fn(() => Promise.resolve());
    const disableBridge = vi.fn();
    let activationBarrierSettled = false;

    const barrier = settleNativeAdapterRegistrations([
      rejectEarly,
      waitForDelayedPath,
      finishEarly,
    ]);
    const activationBarrier = barrier.catch((error: unknown) => {
      disableBridge(error);
      return false;
    });
    void activationBarrier.then(() => {
      activationBarrierSettled = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(rejectEarly).toHaveBeenCalledOnce();
    expect(waitForDelayedPath).toHaveBeenCalledOnce();
    expect(finishEarly).toHaveBeenCalledOnce();
    expect(disableBridge).not.toHaveBeenCalled();
    expect(activationBarrierSettled).toBe(false);

    releaseDelayedPath();
    await expect(barrier).rejects.toBe(failure);
    await expect(activationBarrier).resolves.toBe(false);
    expect(disableBridge).toHaveBeenCalledWith(failure);
    expect(activationBarrierSettled).toBe(true);
  });

  it("captures synchronous registration failures without skipping siblings", async () => {
    const failure = new Error("synchronous registration failure");
    const rejectSynchronously = vi.fn(() => {
      throw failure;
    });
    const sibling = vi.fn(() => Promise.resolve());

    await expect(
      settleNativeAdapterRegistrations([rejectSynchronously, sibling]),
    ).rejects.toBe(failure);
    expect(rejectSynchronously).toHaveBeenCalledOnce();
    expect(sibling).toHaveBeenCalledOnce();
  });
});

describe("nearest-player source selection", () => {
  it("does not depend on source-marker timing when optimized source is explicit", () => {
    expect(shouldInstallKDNearestPlayerAdapter(true, false)).toBe(false);
    expect(shouldInstallKDNearestPlayerAdapter(true, true)).toBe(false);
  });

  it("uses the runtime adapter only when neither source signal is present", () => {
    expect(shouldInstallKDNearestPlayerAdapter(false, false)).toBe(true);
    expect(shouldInstallKDNearestPlayerAdapter(undefined, false)).toBe(true);
    expect(shouldInstallKDNearestPlayerAdapter(false, true)).toBe(false);
    expect(shouldInstallKDNearestPlayerAdapter(undefined, true)).toBe(false);
  });
});
