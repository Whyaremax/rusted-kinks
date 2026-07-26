import type { SignatureCandidate } from "./signatures.js";
import type { SystemName } from "./types.js";

export const KNOWN_UPSTREAM = {
  version: "5.1.12",
  bundleSha256: "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4"
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
  normalizedHash?: string
): SignatureCandidate {
  return {
    id: `${KNOWN_UPSTREAM.version}:${globalName}`,
    name: globalName,
    arity,
    sentinels,
    ...(normalizedHash === undefined ? {} : { normalizedHash })
  };
}

/**
 * Metadata only: names, arities and identifier sentinels. No upstream source is
 * copied into this project.
 */
export const UPSTREAM_5_1_12_FACADES: readonly UpstreamFacade[] = [
  {
    system: "mapGeneration",
    globalName: "KinkyDungeonCreateMap",
    candidates: [candidate("KinkyDungeonCreateMap", 8, ["KinkyDungeonMapParams"])]
  },
  {
    system: "events",
    globalName: "KinkyDungeonAdvanceTime",
    candidates: [candidate("KinkyDungeonAdvanceTime", 3, ["KinkyDungeonSendEvent"])]
  },
  {
    system: "ai",
    globalName: "KinkyDungeonEnemyLoop",
    candidates: [
      candidate("KinkyDungeonEnemyLoop", 5, [
        "KinkyDungeonEnemyTryMove",
        "KinkyDungeonEnemyTryAttack"
      ])
    ]
  },
  {
    system: "movement",
    globalName: "KinkyDungeonMove",
    candidates: [candidate("KinkyDungeonMove", 5, ["KinkyDungeonMoveTo"])]
  },
  {
    system: "movement",
    globalName: "KinkyDungeonMoveTo",
    candidates: [candidate("KinkyDungeonMoveTo", 5, ["KinkyDungeonMapGet"])]
  },
  {
    system: "pathfinding",
    globalName: "KinkyDungeonFindPath",
    candidates: [
      candidate(
        "KinkyDungeonFindPath",
        19,
        ["KinkyDungeonMapGet", "KDPathCache"],
        "8d44a53be83c0922"
      )
    ]
  },
  {
    system: "pathfinding",
    globalName: "KinkyDungeonGetPath",
    candidates: [candidate("KinkyDungeonGetPath", 5, ["closed.get", "list.reverse"])]
  },
  {
    system: "buffs",
    globalName: "KinkyDungeonGetBuffedStat",
    candidates: [candidate("KinkyDungeonGetBuffedStat", 3, ["duration"])]
  },
  {
    system: "combat",
    globalName: "KinkyDungeonDamageEnemy",
    candidates: [candidate("KinkyDungeonDamageEnemy", 14, ["KinkyDungeonSendEvent"])]
  },
  {
    system: "combat",
    globalName: "KinkyDungeonAttackEnemy",
    candidates: [candidate("KinkyDungeonAttackEnemy", 6, ["KinkyDungeonDamageEnemy"])]
  },
  {
    system: "events",
    globalName: "KinkyDungeonSendEvent",
    candidates: [candidate("KinkyDungeonSendEvent", 5, ["KDEventMap"])]
  }
] as const;
