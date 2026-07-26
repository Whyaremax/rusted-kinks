import { describe, expect, it } from "vitest";

import { KNOWN_UPSTREAM, UPSTREAM_5_4_92_FACADES } from "./upstream.js";

describe("upstream release metadata", () => {
  it("keeps the in-game and Electron package versions distinct", () => {
    expect(KNOWN_UPSTREAM).toMatchObject({
      version: "5.4.92",
      gameVersion: "5.4.92",
      packageVersion: "5.1.12",
      bundleSha256:
        "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4"
    });
  });

  it("labels the exact pathfinding signature with the in-game version", () => {
    const facade = UPSTREAM_5_4_92_FACADES.find(
      ({ globalName }) => globalName === "KinkyDungeonFindPath"
    );
    expect(facade?.candidates[0]?.id).toBe("5.4.92:KinkyDungeonFindPath");
    expect(facade?.candidates[0]?.normalizedHash).toBe("8d44a53be83c0922");
  });
});
