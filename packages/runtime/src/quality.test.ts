import { describe, expect, it } from "vitest";

import {
  AdaptiveQualityController,
  selectInitialTier
} from "./quality.js";

describe("adaptive quality", () => {
  it("selects from physical pixels and device memory", () => {
    expect(
      selectInitialTier({
        width: 3840,
        height: 2160,
        devicePixelRatio: 1,
        deviceMemoryGiB: 16
      })
    ).toBe("high");
    expect(
      selectInitialTier({
        width: 3840,
        height: 2160,
        devicePixelRatio: 2,
        deviceMemoryGiB: 8
      })
    ).toBe("performance");
  });

  it("degrades after three bad windows and upgrades only after stability", () => {
    const controller = new AdaptiveQualityController(
      {
        width: 1920,
        height: 1080,
        devicePixelRatio: 1,
        deviceMemoryGiB: 16
      },
      "auto",
      {
        windowMs: 100,
        badWindowsBeforeDegrade: 3,
        stableMsBeforeUpgrade: 600,
        cooldownMs: 300
      }
    );
    let now = 0;
    const window = (frame: number): void => {
      controller.recordFrame(frame, now);
      now += 100;
      controller.recordFrame(frame, now);
      now += 1;
    };
    window(20);
    window(20);
    window(20);
    expect(controller.status().tier).toBe("balanced");
    for (let index = 0; index < 8; index += 1) {
      window(4);
    }
    expect(controller.status().tier).toBe("high");
  });

  it("honors a manual tier", () => {
    const controller = new AdaptiveQualityController(
      { width: 100, height: 100, devicePixelRatio: 1 },
      "performance"
    );
    controller.recordFrame(1, 0);
    controller.recordFrame(1, 10_000);
    expect(controller.status().tier).toBe("performance");
  });
});
