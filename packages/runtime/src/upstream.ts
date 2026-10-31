import {
  functionSignature,
  type FunctionSignature,
  type SignatureCandidate,
} from "./signatures.js";
import type { SystemName } from "./types.js";

export const KNOWN_UPSTREAM = {
  version: "5.4.92",
  gameVersion: "5.4.92",
  packageVersion: "5.1.12",
  bundleSha256:
    "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4",
} as const;

export const KNOWN_UPSTREAM_5_5_1 = {
  version: "5.5.1",
  gameVersion: "5.5.1",
  packageVersion: "5.1.12",
  bundleSha256:
    "60a85515783853653fd051936429494b8ef85024ff66b08134e68f9fe89248e0",
} as const;

export const KNOWN_UPSTREAM_5_5_6 = { version: "5.5.6", gameVersion: "5.5.6", packageVersion: "5.1.12", bundleSha256: "e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25" } as const;

export interface UpstreamFacade {
  readonly system: SystemName;
  readonly globalName: string;
  readonly candidates: readonly SignatureCandidate[];
}

export interface KnownUpstreamRelease {
  readonly version: string;
  readonly gameVersion: string;
  readonly packageVersion: string;
  readonly bundleSha256: string;
  readonly facades: readonly UpstreamFacade[];
  readonly fingerprint: readonly UpstreamFingerprintEntry[];
}

export interface UpstreamFingerprintEntry {
  readonly globalName: string;
  readonly arity: number;
  readonly normalizedHash: string;
}

function versionedCandidate(
  gameVersion: string,
  globalName: string,
  arity: number,
  sentinels: readonly string[],
  normalizedHash?: string,
): SignatureCandidate {
  return {
    id: `${gameVersion}:${globalName}`,
    name: globalName,
    arity,
    sentinels,
    ...(normalizedHash === undefined ? {} : { normalizedHash }),
  };
}

function candidate(
  globalName: string,
  arity: number,
  sentinels: readonly string[],
  normalizedHash?: string,
): SignatureCandidate {
  return versionedCandidate(
    KNOWN_UPSTREAM.gameVersion,
    globalName,
    arity,
    sentinels,
    normalizedHash,
  );
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

/**
 * Only facades whose upstream bodies and adapted dependency contracts remained
 * exact are admitted for 5.5.1. Changed facades are intentionally absent so
 * registration keeps the official implementation.
 */
export const UPSTREAM_5_5_1_FACADES: readonly UpstreamFacade[] = [
  {
    system: "events",
    globalName: "KinkyDungeonPlaceJailKeys",
    candidates: [
      versionedCandidate(
        KNOWN_UPSTREAM_5_5_1.gameVersion,
        "KinkyDungeonPlaceJailKeys",
        0,
        ["KDMapData.GroundItems", "KDMaxKeys"],
        "c7481bca5343f8d9",
      ),
    ],
  },
  {
    system: "ai",
    globalName: "KDNearbyEnemies",
    candidates: [
      versionedCandidate(
        KNOWN_UPSTREAM_5_5_1.gameVersion,
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
      versionedCandidate(
        KNOWN_UPSTREAM_5_5_1.gameVersion,
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
      versionedCandidate(
        KNOWN_UPSTREAM_5_5_1.gameVersion,
        "KinkyDungeonFindMaster",
        1,
        ["KDNearbyEnemies", "KDEnemyRank", "KDEntityHasFlag"],
        "1f99a85434dd34c2",
      ),
    ],
  },
] as const;

// Commander orders and KDEnemyRank changed in 5.5.6. Keep those systems on
// official JavaScript even though the outer function signatures still match.
export const UPSTREAM_5_5_6_FACADES: readonly UpstreamFacade[] = UPSTREAM_5_5_1_FACADES
  .filter(facade => ["KDNearbyEnemies", "KinkyDungeonPlaceJailKeys"].includes(facade.globalName))
  .map(facade => ({...facade, candidates: facade.candidates.map(candidate => ({...candidate, id: candidate.id.replace("5.5.1:", "5.5.6:")}))}));

const UPSTREAM_5_4_92_FINGERPRINT: readonly UpstreamFingerprintEntry[] =
  Object.freeze([
    Object.freeze({
      globalName: "KinkyDungeonCreateMap",
      arity: 8,
      normalizedHash: "87827713b260e838",
    }),
    Object.freeze({
      globalName: "KinkyDungeonGetEnemy",
      arity: 9,
      normalizedHash: "f471bc58d58eb3c1",
    }),
    Object.freeze({
      globalName: "KinkyDungeonNearestPlayer",
      arity: 5,
      normalizedHash: "f7b240c7ec84aee5",
    }),
    Object.freeze({
      globalName: "KinkyDungeonUpdateEnemies",
      arity: 2,
      normalizedHash: "300927f475bc8215",
    }),
    Object.freeze({
      globalName: "KinkyDungeonFindPath",
      arity: 19,
      normalizedHash: "8d44a53be83c0922",
    }),
  ]);

const UPSTREAM_5_5_1_FINGERPRINT: readonly UpstreamFingerprintEntry[] =
  Object.freeze([
    Object.freeze({
      globalName: "KinkyDungeonCreateMap",
      arity: 8,
      normalizedHash: "b42af6122a00dea8",
    }),
    Object.freeze({
      globalName: "KinkyDungeonGetEnemy",
      arity: 9,
      normalizedHash: "6fcd2e94f28710e5",
    }),
    Object.freeze({
      globalName: "KinkyDungeonNearestPlayer",
      arity: 5,
      normalizedHash: "e47e64dd4256c738",
    }),
    Object.freeze({
      globalName: "KinkyDungeonUpdateEnemies",
      arity: 2,
      normalizedHash: "648b60fe733f0a19",
    }),
    Object.freeze({
      globalName: "KinkyDungeonFindPath",
      arity: 19,
      normalizedHash: "bef37e618d161ec6",
    }),
  ]);

const UPSTREAM_5_5_6_FINGERPRINT: readonly UpstreamFingerprintEntry[] = Object.freeze([
  {
    "globalName": "KinkyDungeonCreateMap",
    "arity": 8,
    "normalizedHash": "998854c33a940983"
  },
  {
    "globalName": "KinkyDungeonGetEnemy",
    "arity": 9,
    "normalizedHash": "b9703f660a0ff8d9"
  },
  {
    "globalName": "KinkyDungeonNearestPlayer",
    "arity": 5,
    "normalizedHash": "e47e64dd4256c738"
  },
  {
    "globalName": "KinkyDungeonUpdateEnemies",
    "arity": 2,
    "normalizedHash": "d58d8e185e35afae"
  },
  {
    "globalName": "KinkyDungeonFindPath",
    "arity": 24,
    "normalizedHash": "11e7a192cfe27ae0"
  }
]);

export const KNOWN_UPSTREAM_RELEASES: readonly KnownUpstreamRelease[] =
  Object.freeze([
    Object.freeze({
      ...KNOWN_UPSTREAM,
      facades: UPSTREAM_5_4_92_FACADES,
      fingerprint: UPSTREAM_5_4_92_FINGERPRINT,
    }),
    Object.freeze({
      ...KNOWN_UPSTREAM_5_5_6,
      facades: UPSTREAM_5_5_6_FACADES,
      fingerprint: UPSTREAM_5_5_6_FINGERPRINT,
    }),
    Object.freeze({
      ...KNOWN_UPSTREAM_5_5_1,
      facades: UPSTREAM_5_5_1_FACADES,
      fingerprint: UPSTREAM_5_5_1_FINGERPRINT,
    }),
  ]);

export function findKnownUpstreamRelease(
  bundleSha256: string | undefined,
): KnownUpstreamRelease | undefined {
  if (bundleSha256 === undefined) return undefined;
  const normalized = bundleSha256.toLowerCase();
  for (let index = 0; index < KNOWN_UPSTREAM_RELEASES.length; index += 1) {
    const release = KNOWN_UPSTREAM_RELEASES[index];
    if (release?.bundleSha256 === normalized) return release;
  }
  return undefined;
}

export function findKnownUpstreamReleaseByVersion(
  gameVersion: string | undefined,
): KnownUpstreamRelease | undefined {
  if (gameVersion === undefined) return undefined;
  for (let index = 0; index < KNOWN_UPSTREAM_RELEASES.length; index += 1) {
    const release = KNOWN_UPSTREAM_RELEASES[index];
    if (release?.gameVersion === gameVersion) return release;
  }
  return undefined;
}

export function identifyKnownUpstreamRelease(
  target: Readonly<Record<string, unknown>>,
): KnownUpstreamRelease | undefined {
  const signatures: Record<string, FunctionSignature | undefined> =
    Object.create(null) as Record<string, FunctionSignature | undefined>;
  const names = KNOWN_UPSTREAM_RELEASES[0]?.fingerprint;
  if (names === undefined) return undefined;
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index]?.globalName;
    if (name === undefined) return undefined;
    let value: unknown;
    try {
      value = target[name];
    } catch {
      signatures[name] = undefined;
      continue;
    }
    if (typeof value !== "function") {
      signatures[name] = undefined;
      continue;
    }
    try {
      signatures[name] = functionSignature(value);
    } catch {
      signatures[name] = undefined;
    }
  }
  return identifyKnownUpstreamReleaseFromSignatures(signatures);
}

export function identifyKnownUpstreamReleaseFromSignatures(
  signatures: Readonly<Record<string, FunctionSignature | undefined>>,
): KnownUpstreamRelease | undefined {
  let match: KnownUpstreamRelease | undefined;
  for (
    let releaseIndex = 0;
    releaseIndex < KNOWN_UPSTREAM_RELEASES.length;
    releaseIndex += 1
  ) {
    const release = KNOWN_UPSTREAM_RELEASES[releaseIndex];
    if (release === undefined) return undefined;
    let releaseMatches = true;
    for (
      let fingerprintIndex = 0;
      fingerprintIndex < release.fingerprint.length;
      fingerprintIndex += 1
    ) {
      const expected = release.fingerprint[fingerprintIndex];
      if (expected === undefined) return undefined;
      const actual = signatures[expected.globalName];
      if (
        actual === undefined ||
        actual.name !== expected.globalName ||
        actual.arity !== expected.arity ||
        actual.normalizedHash !== expected.normalizedHash
      ) {
        releaseMatches = false;
        break;
      }
    }
    if (releaseMatches) {
      if (match !== undefined) return undefined;
      match = release;
    }
  }
  return match;
}

export function findKnownFacade(
  globalName: string,
): UpstreamFacade | undefined {
  for (
    let releaseIndex = 0;
    releaseIndex < KNOWN_UPSTREAM_RELEASES.length;
    releaseIndex += 1
  ) {
    const release = KNOWN_UPSTREAM_RELEASES[releaseIndex];
    if (release === undefined) continue;
    const facade = findKnownFacadeForRelease(release, globalName);
    if (facade !== undefined) return facade;
  }
  return undefined;
}

export function findKnownFacadeForRelease(
  release: KnownUpstreamRelease,
  globalName: string,
): UpstreamFacade | undefined {
  for (let index = 0; index < release.facades.length; index += 1) {
    const facade = release.facades[index];
    if (facade?.globalName === globalName) return facade;
  }
  return undefined;
}
