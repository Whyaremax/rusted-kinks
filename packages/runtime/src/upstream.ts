import type { SignatureCandidate } from "./signatures.js";
import type { SystemName } from "./types.js";

export const KNOWN_UPSTREAM = {
  version: "5.4.92",
  gameVersion: "5.4.92",
  packageVersion: "5.1.12",
  bundleSha256:
    "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4",
} as const;

export interface UpstreamFacade {
  readonly system: SystemName;
  readonly globalName: string;
  readonly candidates: readonly SignatureCandidate[];
}

function candidate(
  globalName: string,
  arity: number,
  sentinels: readonly string[],
  normalizedHash?: string,
): SignatureCandidate {
  return {
    id: `${KNOWN_UPSTREAM.gameVersion}:${globalName}`,
    name: globalName,
    arity,
    sentinels,
    ...(normalizedHash === undefined ? {} : { normalizedHash }),
  };
}

/**
 * Metadata only: names, arities and identifier sentinels. No upstream source is
 * copied into this project.
 */
export const UPSTREAM_5_4_92_FACADES: readonly UpstreamFacade[] = [
  {
    system: "mapGeneration",
    globalName: "KinkyDungeonCreateMap",
    candidates: [
      candidate("KinkyDungeonCreateMap", 8, ["KinkyDungeonMapParams"]),
    ],
  },
  {
    system: "mapGeneration",
    globalName: "KinkyDungeonGetEnemy",
    candidates: [
      candidate(
        "KinkyDungeonGetEnemy",
        9,
        ["KDPerkToggleTags", "KinkyDungeonEnemies", "KDRandom"],
        "f471bc58d58eb3c1",
      ),
    ],
  },
  {
    system: "events",
    globalName: "KinkyDungeonAdvanceTime",
    candidates: [
      candidate("KinkyDungeonAdvanceTime", 3, ["KinkyDungeonSendEvent"]),
    ],
  },
  {
    system: "events",
    globalName: "KinkyDungeonPlaceJailKeys",
    candidates: [
      candidate(
        "KinkyDungeonPlaceJailKeys",
        0,
        ["KDMapData.GroundItems", "KDMaxKeys"],
        "c7481bca5343f8d9",
      ),
    ],
  },
  {
    system: "ai",
    globalName: "KinkyDungeonEnemyLoop",
    candidates: [
      candidate("KinkyDungeonEnemyLoop", 5, [
        "KinkyDungeonEnemyTryMove",
        "KinkyDungeonEnemyTryAttack",
      ]),
    ],
  },
  {
    system: "ai",
    globalName: "KDNearbyEnemies",
    candidates: [
      candidate(
        "KDNearbyEnemies",
        6,
        ["KDGetEnemyCache", "KDistEuclideanSquared", "KDHostile"],
        "2aef3dad0d1dc18b",
      ),
    ],
  },
  {
    system: "ai",
    globalName: "KDCommanderUpdateRoles",
    candidates: [
      candidate(
        "KDCommanderUpdateRoles",
        1,
        ["KDGetOrdersList", "KDCommanderRoles"],
        "5591256712f63567",
      ),
    ],
  },
  {
    system: "ai",
    globalName: "KinkyDungeonFindMaster",
    candidates: [
      candidate(
        "KinkyDungeonFindMaster",
        1,
        ["KDNearbyEnemies", "KDEnemyRank", "KDEntityHasFlag"],
        "1f99a85434dd34c2",
      ),
    ],
  },
  {
    system: "ai",
    globalName: "KinkyDungeonNearestPlayer",
    candidates: [
      candidate(
        "KinkyDungeonNearestPlayer",
        5,
        [
          "KDEnemyVisionRadius",
          "KDNearbyEnemies",
          "KDHelpless",
          "KinkyDungeonCheckLOS",
        ],
        "f7b240c7ec84aee5",
      ),
    ],
  },
  {
    system: "movement",
    globalName: "KinkyDungeonMove",
    candidates: [candidate("KinkyDungeonMove", 5, ["KinkyDungeonMoveTo"])],
  },
  {
    system: "movement",
    globalName: "KinkyDungeonMoveTo",
    candidates: [candidate("KinkyDungeonMoveTo", 5, ["KinkyDungeonMapGet"])],
  },
  {
    system: "movement",
    globalName: "KinkyDungeonUpdateEnemies",
    candidates: [
      candidate(
        "KinkyDungeonUpdateEnemies",
        2,
        [
          "KinkyDungeonFindMaster",
          "KinkyDungeonEnemyLoop",
          "KDUpdateRestraintMetadata",
        ],
        "300927f475bc8215",
      ),
    ],
  },
  {
    system: "pathfinding",
    globalName: "KinkyDungeonFindPath",
    candidates: [
      candidate(
        "KinkyDungeonFindPath",
        19,
        ["KinkyDungeonMapGet", "KDPathCache"],
        "8d44a53be83c0922",
      ),
      candidate(
        "KinkyDungeonFindPath",
        19,
        [
          "KinkyDungeonMapGet",
          "KDPathCache",
          "sourceDirectSuccessors",
          "sourceOpenValues",
          "sourceHoistedCacheIndex",
        ],
        "385572aa929dbe67",
      ),
      candidate(
        "KinkyDungeonFindPath",
        19,
        [
          "KinkyDungeonMapGet",
          "KDPathCache",
          "sourceDirectSuccessors",
          "sourceClosedFirstSuccessors",
          "sourceOpenValues",
          "sourceHoistedCacheIndex",
        ],
        "38b3c74d127c7185",
      ),
      candidate(
        "KinkyDungeonFindPath",
        19,
        [
          "KinkyDungeonMapGet",
          "KDPathCache",
          "sourceDirectSuccessors",
          "sourceClosedFirstSuccessors",
          "sourceTopCacheSingleRead",
          "sourceOpenValues",
          "sourceHoistedCacheIndex",
        ],
        "3838b0e6dfe754d7",
      ),
      candidate(
        "KinkyDungeonFindPath",
        19,
        [
          "KinkyDungeonMapGet",
          "KDPathCache",
          "sourceDirectSuccessors",
          "sourceClosedFirstSuccessors",
          "sourceTopCacheSingleRead",
          "sourceDeferredTileMetadata",
          "sourceOpenValues",
          "sourceHoistedCacheIndex",
        ],
        "a59440e8a342df98",
      ),
      candidate(
        "KinkyDungeonFindPath",
        19,
        [
          "KinkyDungeonMapGet",
          "KDPathCache",
          "sourceContinuationCacheLookup",
          "sourceDirectSuccessors",
          "sourceClosedFirstSuccessors",
          "sourceTopCacheSingleRead",
          "sourceDeferredTileMetadata",
          "sourceOpenValues",
          "sourceHoistedCacheIndex",
        ],
        "b664183c8f7de804",
      ),
      candidate(
        "KinkyDungeonFindPath",
        19,
        [
          "KinkyDungeonMapGet",
          "KDPathCache",
          "sourceContinuationCacheLookup",
          "sourceDirectSuccessors",
          "sourceClosedFirstSuccessors",
          "sourceTopCacheSingleRead",
          "sourceDeferredTileMetadata",
          "sourceOpenValues",
          "sourceHoistedCacheIndex",
          "knownCachedTailStart",
          "KDHybridPathCacheKnownTailCompatible",
          "KDHybridPathCacheKnownTailDependencies",
        ],
        "ebdbae7b2fb5261b",
      ),
      candidate(
        "KinkyDungeonFindPath",
        19,
        [
          "KinkyDungeonMapGet",
          "KDPathCache",
          "sourceContinuationCacheLookup",
          "sourceNumericCoordinateKeys",
          "numericCoordinateKeyStride",
          "KDHybridGetNumericCoordinatePath",
          "sourceDirectSuccessors",
          "sourceClosedFirstSuccessors",
          "sourceTopCacheSingleRead",
          "sourceDeferredTileMetadata",
          "sourceOpenValues",
          "sourceHoistedCacheIndex",
          "knownCachedTailStart",
          "KDHybridPathCacheKnownTailCompatible",
          "KDHybridPathCacheKnownTailDependencies",
        ],
        "4d4e0a875f2846cc",
      ),
      candidate(
        "KinkyDungeonFindPath",
        19,
        [
          "KinkyDungeonMapGet",
          "KDPathCache",
          "sourceContinuationCacheLookup",
          "sourceNumericCoordinateKeys",
          "numericCoordinateKeyStride",
          "KDHybridGetNumericCoordinatePath",
          "sourceTileMembershipTable",
          "sourceTileIncluded",
          "sourceDirectSuccessors",
          "sourceClosedFirstSuccessors",
          "sourceTopCacheSingleRead",
          "sourceDeferredTileMetadata",
          "sourceOpenValues",
          "sourceHoistedCacheIndex",
          "knownCachedTailStart",
          "KDHybridPathCacheKnownTailCompatible",
          "KDHybridPathCacheKnownTailDependencies",
        ],
        "2a8a36170c5dde72",
      ),
      candidate(
        "KinkyDungeonFindPath",
        19,
        [
          "KinkyDungeonMapGet",
          "KDPathCache",
          "sourceContinuationCacheLookup",
          "sourceNumericContinuationIndex",
          "sourceNumericContinuationSuffix",
          "KDHybridPathfindingNumericContinuationIndexes",
          "sourceNumericCoordinateKeys",
          "numericCoordinateKeyStride",
          "KDHybridGetNumericCoordinatePath",
          "sourceTileMembershipTable",
          "sourceTileIncluded",
          "sourceDirectSuccessors",
          "sourceClosedFirstSuccessors",
          "sourceTopCacheSingleRead",
          "sourceDeferredTileMetadata",
          "sourceOpenValues",
          "sourceHoistedCacheIndex",
          "knownCachedTailStart",
          "KDHybridPathCacheKnownTailCompatible",
          "KDHybridPathCacheKnownTailDependencies",
          "KDHybridPathfindingNumericContinuationIndexDependencies",
        ],
        "088c0f0251a35468",
      ),
    ],
  },
  {
    system: "pathfinding",
    globalName: "KinkyDungeonGetPath",
    candidates: [
      candidate("KinkyDungeonGetPath", 5, ["closed.get", "list.reverse"]),
    ],
  },
  {
    system: "buffs",
    globalName: "KinkyDungeonGetBuffedStat",
    candidates: [candidate("KinkyDungeonGetBuffedStat", 3, ["duration"])],
  },
  {
    system: "combat",
    globalName: "KinkyDungeonDamageEnemy",
    candidates: [
      candidate("KinkyDungeonDamageEnemy", 14, ["KinkyDungeonSendEvent"]),
    ],
  },
  {
    system: "combat",
    globalName: "KinkyDungeonAttackEnemy",
    candidates: [
      candidate("KinkyDungeonAttackEnemy", 6, ["KinkyDungeonDamageEnemy"]),
    ],
  },
  {
    system: "events",
    globalName: "KinkyDungeonSendEvent",
    candidates: [candidate("KinkyDungeonSendEvent", 5, ["KDEventMap"])],
  },
] as const;
