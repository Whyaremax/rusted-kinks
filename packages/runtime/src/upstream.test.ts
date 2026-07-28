import { describe, expect, it } from "vitest";

import { KNOWN_UPSTREAM, UPSTREAM_5_4_92_FACADES } from "./upstream.js";

describe("upstream release metadata", () => {
  it("keeps the in-game and Electron package versions distinct", () => {
    expect(KNOWN_UPSTREAM).toMatchObject({
      version: "5.4.92",
      gameVersion: "5.4.92",
      packageVersion: "5.1.12",
      bundleSha256:
        "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4",
    });
  });

  it("labels the exact pathfinding signature with the in-game version", () => {
    const facade = UPSTREAM_5_4_92_FACADES.find(
      ({ globalName }) => globalName === "KinkyDungeonFindPath",
    );
    expect(facade?.candidates[0]?.id).toBe("5.4.92:KinkyDungeonFindPath");
    expect(facade?.candidates[0]?.normalizedHash).toBe("8d44a53be83c0922");
    expect(facade?.candidates[1]?.id).toBe("5.4.92:KinkyDungeonFindPath");
    expect(facade?.candidates[1]?.normalizedHash).toBe("385572aa929dbe67");
    expect(facade?.candidates[2]?.id).toBe("5.4.92:KinkyDungeonFindPath");
    expect(facade?.candidates[2]?.normalizedHash).toBe("38b3c74d127c7185");
    expect(facade?.candidates[3]?.id).toBe("5.4.92:KinkyDungeonFindPath");
    expect(facade?.candidates[3]?.normalizedHash).toBe("3838b0e6dfe754d7");
    expect(facade?.candidates[4]?.id).toBe("5.4.92:KinkyDungeonFindPath");
    expect(facade?.candidates[4]?.normalizedHash).toBe("a59440e8a342df98");
    expect(facade?.candidates[5]?.id).toBe("5.4.92:KinkyDungeonFindPath");
    expect(facade?.candidates[5]?.normalizedHash).toBe("b664183c8f7de804");
    expect(facade?.candidates[6]?.id).toBe("5.4.92:KinkyDungeonFindPath");
    expect(facade?.candidates[6]?.normalizedHash).toBe("ebdbae7b2fb5261b");
    expect(facade?.candidates[7]?.id).toBe("5.4.92:KinkyDungeonFindPath");
    expect(facade?.candidates[7]?.normalizedHash).toBe("4d4e0a875f2846cc");
    expect(facade?.candidates[8]?.id).toBe("5.4.92:KinkyDungeonFindPath");
    expect(facade?.candidates[8]?.normalizedHash).toBe("2a8a36170c5dde72");
    expect(facade?.candidates[9]?.id).toBe("5.4.92:KinkyDungeonFindPath");
    expect(facade?.candidates[9]?.normalizedHash).toBe("088c0f0251a35468");
  });

  it("signature-gates the map-generation enemy selector", () => {
    const facade = UPSTREAM_5_4_92_FACADES.find(
      ({ globalName }) => globalName === "KinkyDungeonGetEnemy",
    );
    expect(facade).toMatchObject({
      system: "mapGeneration",
      candidates: [
        {
          id: "5.4.92:KinkyDungeonGetEnemy",
          arity: 9,
          normalizedHash: "f471bc58d58eb3c1",
        },
      ],
    });
  });

  it("signature-gates the nearby-enemy hot path", () => {
    const facade = UPSTREAM_5_4_92_FACADES.find(
      ({ globalName }) => globalName === "KDNearbyEnemies",
    );
    expect(facade).toMatchObject({
      system: "ai",
      candidates: [
        {
          id: "5.4.92:KDNearbyEnemies",
          normalizedHash: "2aef3dad0d1dc18b",
        },
      ],
    });
  });

  it("signature-gates the commander role batch", () => {
    const facade = UPSTREAM_5_4_92_FACADES.find(
      ({ globalName }) => globalName === "KDCommanderUpdateRoles",
    );
    expect(facade).toMatchObject({
      system: "ai",
      candidates: [
        {
          id: "5.4.92:KDCommanderUpdateRoles",
          normalizedHash: "5591256712f63567",
        },
      ],
    });
  });

  it("signature-gates the fused implicit-master query", () => {
    const facade = UPSTREAM_5_4_92_FACADES.find(
      ({ globalName }) => globalName === "KinkyDungeonFindMaster",
    );
    expect(facade).toMatchObject({
      system: "ai",
      candidates: [
        {
          id: "5.4.92:KinkyDungeonFindMaster",
          normalizedHash: "1f99a85434dd34c2",
        },
      ],
    });
  });

  it("signature-gates the hostile-first nearest-player query", () => {
    const facade = UPSTREAM_5_4_92_FACADES.find(
      ({ globalName }) => globalName === "KinkyDungeonNearestPlayer",
    );
    expect(facade).toMatchObject({
      system: "ai",
      candidates: [
        {
          id: "5.4.92:KinkyDungeonNearestPlayer",
          normalizedHash: "f7b240c7ec84aee5",
        },
      ],
    });
  });

  it("signature-gates the batched enemy-update position cache", () => {
    const facade = UPSTREAM_5_4_92_FACADES.find(
      ({ globalName }) => globalName === "KinkyDungeonUpdateEnemies",
    );
    expect(facade).toMatchObject({
      system: "movement",
      candidates: [
        {
          id: "5.4.92:KinkyDungeonUpdateEnemies",
          normalizedHash: "300927f475bc8215",
        },
      ],
    });
  });

  it("signature-gates the full jail-key map-scan shortcut", () => {
    const facade = UPSTREAM_5_4_92_FACADES.find(
      ({ globalName }) => globalName === "KinkyDungeonPlaceJailKeys",
    );
    expect(facade).toMatchObject({
      system: "events",
      candidates: [
        {
          id: "5.4.92:KinkyDungeonPlaceJailKeys",
          normalizedHash: "c7481bca5343f8d9",
        },
      ],
    });
  });
});
