// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Compatibility behavior in this file is adapted from Kinky Dungeon 5.4.92.

import {
  completeJavaScriptCall,
  decodeQueryResponse,
  encodeQuery,
  encodeSnapshot,
  functionSignature,
  stableHash,
  useJavaScriptFallback,
  type CompletedJavaScriptCall,
  type KDHybridRuntime,
  type NativeFallbackRequest,
  type PathfindingMode,
  type Position,
  type SystemStatus,
  type WasmBatchBridge,
} from "@kd-hybrid/runtime";

const MAX_DIMENSION = 4_096;
const MAX_TILES = 16_777_216;
const MAX_VISITED = 1_000_000;
const MAX_WEIGHT_UNITS = 0x7f;
const MAX_NEARBY_OFFSET_TEMPLATES = 32;
const MAX_ENEMY_CACHE_JOURNAL_CELLS = 8_192;
const MAX_COMMANDER_HELP_REFRESH_SCANS = 16;
export const KD_NEAREST_PLAYER_SOURCE_PATCH_VERSION = "5.4.92-source-v1";
const ENEMY_SELECTOR_ANGER_TAGS = Object.freeze([
  "imprisonable",
  "ropeAnger",
  "ropeRage",
  "metalAnger",
  "metalRage",
  "latexAnger",
  "latexRage",
  "conjureAnger",
  "conjureRage",
  "elementsAnger",
  "elementsRage",
  "illusionAnger",
  "illusionRage",
  "leatherAnger",
  "leatherRage",
  "willAnger",
  "willRage",
]);
const ENEMY_SELECTOR_ANGER_MATCH_INDICES = Object.freeze([
  20, 62, 63, 66, 67, 70, 71, 112, 136, 137, 138, 139, 141, 142, 143, 148, 149,
  151, 152, 153, 157, 158, 159, 200, 201, 203, 207, 208, 209, 210, 211, 212,
  213, 214, 216, 217, 221, 222, 231, 232, 233, 275, 276, 279, 280, 281, 282,
  283, 284, 285, 286, 287, 288, 289, 292, 296, 298, 299, 305,
]);
const ENEMY_SELECTOR_TRAP_TYPES = Object.freeze([
  "illusionTrap",
  "latexTrap",
  "leatherTrap",
  "metalTrap",
  "ropeTrap",
  "skeletonTrap",
]);
const ENEMY_SELECTOR_TRAP_COMMON_TAGS = Object.freeze([
  "EnemyEnemy",
  "EnemyWanted",
  "EnemyHated",
  "JailEnemy",
  "JailWanted",
  "JailHated",
  "ChaseEnemy",
  "ChaseWanted",
  "ChaseHated",
  "KinkyConstructEnemy",
  "KinkyConstructWanted",
  "PlantEnemy",
  "PlantWanted",
  "SlimeEnemy",
  "SlimeWanted",
  "SlimeHated",
  "LatexEnemy",
  "LatexWanted",
  "LatexHated",
  "MoldEnemy",
  "MoldWanted",
  "MoldHated",
  "BeastEnemy",
  "DragonQueenEnemy",
  "DragonQueenWanted",
  "DragonQueenHated",
  "BanditEnemy",
  "WitchEnemy",
  "WitchWanted",
  "ElementalEnemy",
  "BastEnemy",
  "MushyEnemy",
  "NaturalEnemy",
  "NaturalWanted",
  "NaturalHated",
  "DoorEnemy",
  "DoorWanted",
  "DoorHated",
  "GhostEnemy",
  "GhostWanted",
  "GhostHated",
  "ObserverEnemy",
  "ObserverWanted",
  "ObserverHated",
  "RockEnemy",
  "RockWanted",
  "RockHated",
  "DollsmithEnemy",
  "DollsmithWanted",
  "DollsmithHated",
  "WardenEnemy",
  "WardenWanted",
  "WardenHated",
  "VirusEnemy",
  "VirusWanted",
  "VirusHated",
  "DubiousWitchEnemy",
  "DubiousWitchWanted",
  "DubiousWitchHated",
  "ExtraplanarEnemy",
  "ExtraplanarWanted",
  "ExtraplanarHated",
  "OwnersEnemy",
  "OwnersWanted",
  "OwnersHated",
  "DelinquentEnemy",
  "DelinquentWanted",
  "DelinquentHated",
  "ShadowClanEnemy",
  "ShadowClanWanted",
  "ShadowClanHated",
  "FuukaEnemy",
  "FuukaWanted",
  "FuukaHated",
  "RopeDojoEnemy",
  "RopeDojoWanted",
  "RopeDojoHated",
  "DollShoppeEnemy",
  "DollShoppeWanted",
  "DollShoppeHated",
  "WolfhunterEnemy",
  "WolfhunterWanted",
  "WolfhunterHated",
  "AmbushEnemy",
  "AmbushWanted",
  "AmbushHated",
  "CurseEnemy",
  "CurseWanted",
  "CurseHated",
  "posWill",
  "posMetal",
  "posLeather",
  "posIllusion",
  "posConjure",
  "posElements",
  "posLatex",
  "posRope",
  "jailbreak",
]);
const ENEMY_SELECTOR_TRAP_OPTOUT_TAGS = Object.freeze([
  "slimeOptout",
  "bubbleOptout",
  "petOptout",
]);

export function hasKDNearestPlayerSourcePatch(): boolean {
  const sourcePatches = (
    globalThis as typeof globalThis & {
      readonly KDHybridSourcePatches?: Readonly<Record<string, unknown>>;
    }
  ).KDHybridSourcePatches;
  return (
    sourcePatches?.nearestPlayer === KD_NEAREST_PLAYER_SOURCE_PATCH_VERSION
  );
}

const KNOWN_COMMANDER_ORDER_FINGERPRINT = "689f0641fa0c7af8";
const KNOWN_COMMANDER_CLASSIFIER_SIGNATURES = Object.freeze({
  KDBoundEffects: "91258688d4860b1e",
  KDIsImprisoned: "c8a1217b8b02be95",
  KDIsTileDangerous: "243cf4c4cc9bcbb3",
  KinkyDungeonIsDisabled: "6ec1fc839a1da2c7",
  KDNearbyMapTiles: "696670b77b6d3ae6",
  KinkyDungeonEntityAt: "55122007e4f6877e",
  KDIsHumanoid: "258496817d1065ed",
  KDIsImmobile: "d98ce6f3b80b1464",
});
const KNOWN_FIND_MASTER_DEPENDENCY_SIGNATURES = Object.freeze({
  KDGetEnemyCache: "fa5be91665feb99d",
  KDHostile: "8f2d98727327166c",
  KDGetFaction: "cd2da5ae6e321bb8",
  KDEnemyRank: "1cd726776d8cf2c7",
  KDEntityHasFlag: "e30e401802a41161",
  KDEnemyHasFlag: "7d71636556aa98f8",
  KDCollHasFlag: "d28e4153bd7566cc",
  KDFactionHostile: "31da10911a42af4f",
  KDFactionRelation: "1b5dac574bfdee7d",
  KDIsInParty: "f6945acc8e799cc4",
  KDIsServant: "fe228618399b4a47",
  KDistChebyshev: "9cbe7b3bb88f83e2",
});
const KNOWN_ENEMY_UPDATE_CACHE_DEPENDENCY_SIGNATURES = Object.freeze({
  KDMoveEntity: "276368eeadf8baf9",
  KDGetEnemyCache: "fa5be91665feb99d",
  KDGetEffectTiles: "0e068f4b1e82ebdd",
  KinkyDungeonEntityAt: "55122007e4f6877e",
  KinkyDungeonSendEvent: "1664be6e63e383c2",
  KDCheckCollideableBullets: "d4e43b528965a6d9",
});
const KNOWN_NEAREST_PLAYER_REORDER_SIGNATURES = Object.freeze({
  KDHostile: "8f2d98727327166c",
  KDGetFaction: "cd2da5ae6e321bb8",
  KDHelpless: "6bcf07320e7941e0",
  KDIsImprisoned: "c8a1217b8b02be95",
  KDUnPackEnemy: "3ff0699bf04ecec1",
  KDPackEnemy: "96f289ce0a1706dc",
  KinkyDungeonGetEnemyByName: "c37423e05a5090a0",
  KinkyDungeonRefreshEnemiesCache: "f7065d8e6049e09f",
  KDNPCStruggleThreshMult: "c9df5a998abd5c70",
  KDEnemyRank: "1cd726776d8cf2c7",
  KDBoundEffects: "91258688d4860b1e",
  KDGetBindEffectMult: "6caf9f079aee2a62",
  KDEntityHasFlag: "e30e401802a41161",
  KDEnemyHasFlag: "7d71636556aa98f8",
  KDCollHasFlag: "d28e4153bd7566cc",
  KDFactionHostile: "31da10911a42af4f",
  KDFactionRelation: "1b5dac574bfdee7d",
  KDIsInParty: "f6945acc8e799cc4",
  KDIsServant: "fe228618399b4a47",
  KDOpinionRepMod: "45dd66ba7071450f",
});
const KNOWN_JAIL_KEY_DEPENDENCY_SIGNATURES = Object.freeze({
  KinkyDungeonMapGet: "f64d2f67a4f11503",
  KinkyDungeonTilesGet: "75d2f29c2c97b968",
  KDistChebyshev: "9cbe7b3bb88f83e2",
});
const COMMANDER_ORDER_NAMES = Object.freeze([
  "dummy",
  "assault",
  "defend",
  "guard",
  "flee",
  "helpStruggle",
  "helpDanger",
  "moveToCapture",
]);
const COMMANDER_MUTATOR_NAMES = Object.freeze([
  "KinkyDungeonSetEnemyFlag",
  "KDSetFactionRelation",
  "KDChangeFactionRelation",
  "KDAddToParty",
  "KDRemoveFromParty",
  "KDAddOpinion",
  "KDAddOpinionPersistent",
  "KinkyDungeonSendEvent",
  "KinkyDungeonSendDialogue",
  "KinkyDungeonMakeNoiseSignal",
]);

declare const KDMapData: KDMapDataLike | undefined;
declare const KinkyDungeonVisionGet:
  ((x: number, y: number) => number) | undefined;
declare const KDEffectTileTagsLoc:
  ((location: string) => EffectTileTags | undefined) | undefined;
declare const KinkyDungeonPlayerEntity: KDNearestPlayerEnemy | undefined;
declare const KDOpenDoorTiles: readonly unknown[] | undefined;
declare const KinkyDungeonMovableTilesSmartEnemy: string | undefined;
declare const KinkyDungeonMovableTilesEnemy: string | undefined;
declare const KinkyDungeonGroundTiles: string | undefined;
declare const KinkyDungeonEnemies:
  readonly KDEnemySelectorDefinition[] | undefined;
declare const KDPerkToggleTags: readonly string[] | undefined;
declare const KinkyDungeonStatsChoice: Map<unknown, unknown> | undefined;
declare const KinkyDungeonNewGame: number | undefined;
declare const KinkyDungeonGoddessRep:
  Readonly<Record<string, number | undefined>> | undefined;
declare const KDDefaultAvoidTiles: string | undefined;
declare const KDLevelsPerCheckpoint: number | undefined;
declare const KDRandom: (() => number) | undefined;
declare let KDPathCache: KDPathCacheLike | undefined;
declare let KDPathCacheIgnoreLocks: KDPathCacheLike | undefined;
declare let KDPathfindingCacheHits: number | undefined;
declare let KDPathfindingCacheFails: number | undefined;
declare const KDGetEnemyCache:
  (() => KDEnemyPositionCache | undefined) | undefined;
declare let KDEnemyCache: KDEnemyPositionCache | null | undefined;
declare let KDUpdateEnemyCache: boolean | undefined;
declare const KinkyDungeonUpdateEnemies:
  ((maindelta: unknown, allied: unknown) => unknown) | undefined;
declare const KDMoveEntity: ((...args: unknown[]) => unknown) | undefined;
declare const KDGetEffectTiles:
  ((x: unknown, y: unknown, mapData?: unknown) => unknown) | undefined;
declare const KinkyDungeonSendEvent:
  ((...args: unknown[]) => unknown) | undefined;
declare const KDCheckCollideableBullets:
  ((...args: unknown[]) => unknown) | undefined;
declare const KinkyDungeonCurrentTick: unknown;
declare const KDEffectTileMoveOnFunctions:
  Readonly<Record<string, unknown>> | undefined;
declare const KDEventMapSpell: Readonly<Record<string, unknown>> | undefined;
declare const KDEventMapWeapon: Readonly<Record<string, unknown>> | undefined;
declare const KDEventMapInventorySelected:
  Readonly<Record<string, unknown>> | undefined;
declare const KDEventMapInventoryIcon:
  Readonly<Record<string, unknown>> | undefined;
declare const KDEventMapInventory:
  Readonly<Record<string, unknown>> | undefined;
declare const KDEventMapBullet: Readonly<Record<string, unknown>> | undefined;
declare const KDEventMapBuff: Readonly<Record<string, unknown>> | undefined;
declare const KDEventMapOutfit: Readonly<Record<string, unknown>> | undefined;
declare const KDEventMapGeneric: Readonly<Record<string, unknown>> | undefined;
declare const KDEventMapAlt: Readonly<Record<string, unknown>> | undefined;
declare const KDEventMapFacility: Readonly<Record<string, unknown>> | undefined;
declare const KDHostile:
  ((enemy: KDNearbyEnemy, target?: unknown) => boolean) | undefined;
declare const KDGetFaction: ((enemy: KDNearbyEnemy) => unknown) | undefined;
declare const KDFactionRelation:
  ((left: unknown, right: unknown) => number) | undefined;
declare const KDEnemyRank: ((enemy: KDNearbyEnemy) => number) | undefined;
declare const KDEntityHasFlag:
  ((enemy: KDNearbyEnemy, flag: string) => boolean) | undefined;
declare const KDistChebyshev: ((x: number, y: number) => number) | undefined;
declare const KinkyDungeonMapGet:
  ((x: number, y: number) => unknown) | undefined;
declare const KinkyDungeonTilesGet: ((location: string) => unknown) | undefined;
declare const KDMaxKeys: number | undefined;
declare const KDEnemyVisionRadius:
  ((enemy: KDNearestPlayerEnemy) => number) | undefined;
declare const KinkyDungeonCheckLOS:
  | ((
      enemy: KDNearestPlayerEnemy,
      target: KDNearestPlayerEnemy,
      distance: number,
      maxDistance: number,
      allowBlind: boolean,
      allowBars: boolean,
    ) => boolean)
  | undefined;
declare const KinkyDungeonCheckPath:
  | ((
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      allowBars?: boolean,
      blockEnemies?: boolean,
    ) => boolean)
  | undefined;
declare const KDEnemyHasFlag:
  ((enemy: KDNearestPlayerEnemy, flag: string) => boolean) | undefined;
declare const KDNearbyEnemies:
  | ((
      x: number,
      y: number,
      distance: number,
      hostileEnemy?: unknown,
      chebyshev?: boolean,
      nonhostileEnemy?: unknown,
    ) => readonly KDNearestPlayerEnemy[])
  | undefined;
declare const KDHelpless:
  ((enemy: KDNearestPlayerEnemy) => boolean) | undefined;
declare const KDAllied: ((enemy: KDNearestPlayerEnemy) => boolean) | undefined;
declare const KDIsInParty:
  ((enemy: KDNearestPlayerEnemy) => boolean) | undefined;
declare const KinkyDungeonJailGuard:
  (() => KDNearestPlayerEnemy | null) | undefined;
declare const KinkyDungeonSetFlag:
  ((flag: string, duration: number, floors?: number) => void) | undefined;
declare const KinkyDungeonGetEnemyByName:
  ((name: unknown) => KDNearestEnemyDefinition | undefined) | undefined;
declare const KDGameData:
  | {
      PrisonerState?: unknown;
    }
  | undefined;
declare const KinkyDungeonFlags:
  | {
      get(flag: string): unknown;
    }
  | undefined;
declare const KDCommanderOrders: KDCommanderOrdersLike | undefined;
declare const KDBoundEffects:
  ((enemy: KDCommanderEntity) => number) | undefined;
declare const KDIsImprisoned:
  ((enemy: KDCommanderEntity) => boolean) | undefined;
declare const KDIsTileDangerous:
  | ((
      enemy: KDCommanderEntity,
      x: number,
      y: number,
      mapData: KDMapDataLike,
    ) => boolean)
  | undefined;
declare const KinkyDungeonIsDisabled:
  ((enemy: KDCommanderEntity) => boolean) | undefined;
declare const KDNearbyMapTiles:
  | ((x: number, y: number, distance: number) => readonly KDNearbyMapTile[])
  | undefined;
declare const KinkyDungeonEntityAt:
  ((x: number, y: number) => unknown) | undefined;
declare const KDIsHumanoid: ((enemy: KDCommanderEntity) => boolean) | undefined;
declare const KDIsImmobile:
  ((enemy: KDCommanderEntity, movePoints?: unknown) => boolean) | undefined;
declare const KDAssaulters: unknown;
declare const KDMaxAssaulters: unknown;

interface KDMapTile {
  readonly Lock?: unknown;
  readonly OL?: unknown;
  readonly Sfty?: unknown;
}

export interface KDMapDataLike {
  readonly Grid: string;
  readonly GridWidth: number;
  readonly GridHeight: number;
  readonly Tiles?: Readonly<Record<string, KDMapTile | undefined>>;
  readonly TilesMemory?: Readonly<Record<string, unknown>>;
  readonly Traffic?: readonly (readonly number[] | undefined)[];
  readonly Entities?: readonly KDNearbyEnemy[];
}

export interface KDNearbyEnemy {
  readonly x: number;
  readonly y: number;
  readonly id?: unknown;
}

export interface KDEnemySelectorDefinition {
  readonly name?: unknown;
  readonly arousalMode?: unknown;
  readonly shrines?: readonly string[];
  readonly terrainTags: Readonly<Record<string, number | undefined>> & {
    readonly grate?: number;
    readonly increasingWeight?: number;
  };
  readonly tags: Readonly<Record<string, unknown>> & {
    readonly spawnFloorsOnly?: unknown;
  };
  readonly noOverrideFloor?: unknown;
  readonly outOfBoxWeightMult?: unknown;
  readonly allFloors?: unknown;
  readonly floors?: Readonly<Record<string, unknown>>;
  readonly faction?: unknown;
  readonly minLevel: number;
  readonly maxLevel?: number;
  readonly weight: number;
  readonly weightMult?: number;
}

export interface KDEnemySelectorState {
  readonly enemies: readonly KDEnemySelectorDefinition[];
  readonly perkToggleTags: readonly string[];
  readonly statsChoice: Map<unknown, unknown>;
  readonly newGame: number;
  readonly goddessRep: Readonly<Record<string, number | undefined>>;
  readonly groundTiles: string;
  readonly avoidTiles: string;
  readonly levelsPerCheckpoint: number;
  readonly factionRelation: (left: unknown, right: unknown) => number;
  readonly random: () => number;
}

export interface KDEnemySelectorEnvironment {
  state(): KDEnemySelectorState | undefined;
  compatible(state: KDEnemySelectorState): boolean;
  mapGenerationCacheEpoch?(): object | undefined;
  angerCacheEnabled?(): boolean;
  readonly angerMatchIndices?: readonly number[];
  angerCacheStats?(): KDEnemySelectorAngerCacheStats | undefined;
  longTagCacheEnabled?(): boolean;
  longTagQueryKey?(tags: readonly string[]): string | undefined;
  longTagCacheStats?(): KDEnemySelectorLongTagCacheStats | undefined;
  weightedQueryCacheEnabled?(): boolean;
  weightedSingleTagCacheEnabled?(): boolean;
  weightedFilterTagCacheEnabled?(): boolean;
  weightedQueryCacheStats?():
    KDEnemySelectorWeightedQueryCacheStats | undefined;
}

export interface KDEnemySelectorAngerCacheStats {
  optimizedCalls: number;
  fallbackCalls: number;
  cacheBuilds: number;
  cacheHits: number;
  tagChecksElided: number;
  validationFailures: number;
  perEnemyFallbacks: number;
}

export interface KDEnemySelectorLongTagCacheStats {
  optimizedCalls: number;
  fallbackCalls: number;
  cacheBuilds: number;
  cacheHits: number;
  tagChecksElided: number;
  validationFailures: number;
  perEnemyFallbacks: number;
  querySequences: number;
}

export interface KDEnemySelectorWeightedQueryCacheStats {
  optimizedCalls: number;
  fallbackCalls: number;
  cacheBuilds: number;
  cacheHits: number;
  enemiesElided: number;
  validationFailures: number;
}

export interface KDNearestEnemyDefinition {
  readonly name?: unknown;
  readonly maxhp?: number;
  readonly visionRadius?: number;
  readonly blindSight?: number;
  readonly focusPlayer?: unknown;
  readonly noAttack?: unknown;
  readonly spells?: unknown;
  readonly noTargetSilenced?: unknown;
  readonly allied?: unknown;
  readonly followRange?: number;
  readonly lowpriority?: unknown;
  readonly tags?: {
    readonly scenery?: unknown;
  };
}

export interface KDNearestPlayerEnemy extends KDNearbyEnemy {
  readonly Enemy?: KDNearestEnemyDefinition;
  readonly player?: unknown;
  readonly blind?: unknown;
  readonly aware?: unknown;
  readonly rage?: number;
  readonly hostile?: number;
  readonly ceasefire?: number;
  readonly faction?: unknown;
  readonly allied?: unknown;
  readonly modified?: unknown;
  readonly silence?: number;
  readonly gx?: number;
  readonly gy?: number;
}

export interface KDFindMasterEnemy extends KDNearbyEnemy {
  readonly master?: unknown;
  readonly Enemy?: {
    readonly master?: unknown;
  };
}

export interface KDFindMasterResult {
  readonly master: KDFindMasterEnemy | undefined;
  readonly dist: number;
  readonly info: undefined;
}

export interface KDCommanderEntity extends KDNearbyEnemy {
  readonly Enemy?: {
    readonly tags?: {
      readonly nohelp?: unknown;
    };
  };
  readonly IntentAction?: unknown;
  readonly attackPoints?: unknown;
  readonly aware?: unknown;
  readonly ambushtrigger?: unknown;
}

export interface KDNearbyMapTile {
  readonly x: number;
  readonly y: number;
  readonly tile: string;
}

export interface KDCommanderOrder {
  filter: (...args: unknown[]) => unknown;
  readonly [property: string]: unknown;
}

export type KDCommanderOrdersLike = Record<
  string,
  KDCommanderOrder | undefined
>;

export interface KDCommanderHelpEnvironment {
  mapData(): KDMapDataLike | undefined;
  orders(): KDCommanderOrdersLike | undefined;
  boundEffects(enemy: KDCommanderEntity): number;
  imprisoned(enemy: KDCommanderEntity): boolean;
  tileDangerous(
    enemy: KDCommanderEntity,
    x: number,
    y: number,
    mapData: KDMapDataLike,
  ): boolean;
  disabled(enemy: KDCommanderEntity): boolean;
  nearbyMapTiles(
    x: number,
    y: number,
    distance: number,
  ): readonly KDNearbyMapTile[];
  entityAt(x: number, y: number): unknown;
  movableEnemyTiles(): { includes(tile: string): boolean } | undefined;
  candidateMayNeedHelp(enemy: KDCommanderEntity): boolean;
  compatible(): boolean;
  observeMutations(onMutation: () => void): (() => void) | null;
  record?(
    event:
      | "scan"
      | "struggle-shortcut"
      | "danger-shortcut"
      | "struggle-fallback"
      | "danger-fallback"
      | "scan-budget-fallback",
    detail?: Readonly<Record<string, unknown>>,
  ): void;
}

export interface KDEnemyPositionCache {
  readonly size: number;
  get(location: string): KDNearbyEnemy | undefined;
}

export interface KDEnemyUpdateEntity extends KDNearbyEnemy {
  readonly Enemy?: {
    readonly events?: readonly {
      readonly trigger?: unknown;
    }[];
  };
  readonly events?: readonly {
    readonly trigger?: unknown;
  }[];
}

export interface KDEnemyUpdateMapData {
  readonly Entities: readonly KDEnemyUpdateEntity[];
  readonly Bullets?: readonly unknown[];
  readonly EffectTiles?: Readonly<
    Record<
      string,
      | Readonly<
          Record<
            string,
            | {
                readonly duration?: unknown;
                readonly name?: unknown;
              }
            | undefined
          >
        >
      | undefined
    >
  >;
}

export interface KDMutableEnemyPositionCache extends KDEnemyPositionCache {
  get(location: string): KDEnemyUpdateEntity | undefined;
  has(location: string): boolean;
  set(location: string, enemy: KDEnemyUpdateEntity): this;
  delete(location: string): boolean;
}

export interface KDEnemyCacheCellChange {
  readonly x: number;
  readonly y: number;
}

export interface KDEnemyUpdateCacheEnvironment {
  compatible(): boolean;
  mapData(): KDEnemyUpdateMapData | undefined;
  currentTick(): unknown;
  enemyCache(): KDMutableEnemyPositionCache | undefined;
  currentEnemyCache(): KDMutableEnemyPositionCache | undefined;
  replaceEnemyCache(cache: KDMutableEnemyPositionCache): void;
  cacheDirty(): boolean;
  setCacheDirty(dirty: boolean): void;
  moveFunction(): ((...args: unknown[]) => unknown) | undefined;
  replaceMoveFunction(fn: (...args: unknown[]) => unknown): void;
  updateEnemies(thisArgument: unknown, args: readonly unknown[]): unknown;
  moveEntity(thisArgument: unknown, args: readonly unknown[]): unknown;
  effectMoveHandler(name: unknown): unknown;
  eventRiskReasons(entities: readonly KDEnemyUpdateEntity[]): readonly string[];
  advanceCacheGeneration(
    cache?: KDMutableEnemyPositionCache,
    changes?: readonly KDEnemyCacheCellChange[],
  ): void;
  record?(
    event:
      | "optimized-update"
      | "fallback"
      | "working-copy"
      | "fast-move"
      | "scanned-move"
      | "unsafe-move",
    detail?: Readonly<Record<string, unknown>>,
  ): void;
}

export interface KDJailKeyGroundItem {
  readonly name?: unknown;
}

export interface KDJailKeyEarlyReturnEnvironment {
  compatible(): boolean;
  groundItems(): readonly KDJailKeyGroundItem[] | undefined;
  maxKeys(): number | undefined;
  record?(
    event: "skipped-scan" | "fallback",
    detail?: Readonly<{ reason?: string }>,
  ): void;
}

export interface KDNearbyEnemiesEnvironment {
  mapData(): KDMapDataLike | undefined;
  enemyCache(): KDEnemyPositionCache | undefined;
  enemyCacheGeneration?(): unknown;
  enemyCacheChanges?(
    cache: KDEnemyPositionCache,
    fromGeneration: unknown,
    toGeneration: unknown,
  ): readonly KDEnemyCacheCellChange[] | undefined;
  hostile(enemy: KDNearbyEnemy, target: unknown): boolean;
  compatible?(): boolean;
}

export interface KDFindMasterEnvironment {
  mapData(): KDMapDataLike | undefined;
  enemyCache(): KDEnemyPositionCache | undefined;
  enemyCacheGeneration?(): unknown;
  enemyCacheChanges?(
    cache: KDEnemyPositionCache,
    fromGeneration: unknown,
    toGeneration: unknown,
  ): readonly KDEnemyCacheCellChange[] | undefined;
  hostile(enemy: KDFindMasterEnemy, target: KDFindMasterEnemy): boolean;
  getFaction(enemy: KDFindMasterEnemy): unknown;
  enemyRank(enemy: KDFindMasterEnemy): number;
  entityHasFlag(enemy: KDFindMasterEnemy, flag: string): boolean;
  chebyshev(x: number, y: number): number;
  compatible(): boolean;
  record?(
    event: "optimized" | "fallback" | "dense-build" | "dense-patch",
  ): void;
}

export interface KDNearestPlayerEnvironment {
  player(): KDNearestPlayerEnemy | undefined;
  gameData(): { readonly PrisonerState?: unknown } | undefined;
  flags(): { get(flag: string): unknown } | undefined;
  enemyVisionRadius(enemy: KDNearestPlayerEnemy): number;
  checkLOS(
    enemy: KDNearestPlayerEnemy,
    target: KDNearestPlayerEnemy,
    distance: number,
    maxDistance: unknown,
    allowBlind: boolean,
    allowBars: boolean,
  ): boolean;
  checkPath(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    allowBars?: boolean,
    blockEnemies?: boolean,
  ): boolean;
  hostile(enemy: KDNearestPlayerEnemy, target?: KDNearestPlayerEnemy): boolean;
  getFaction(enemy: KDNearestPlayerEnemy): unknown;
  factionRelation(left: unknown, right: unknown): number;
  enemyHasFlag(enemy: KDNearestPlayerEnemy, flag: string): boolean;
  nearbyEnemies(
    x: number,
    y: number,
    distance: number,
    hostileEnemy?: unknown,
    chebyshev?: boolean,
    nonhostileEnemy?: unknown,
  ): readonly KDNearestPlayerEnemy[];
  helpless(enemy: KDNearestPlayerEnemy): boolean;
  imprisoned(enemy: KDNearestPlayerEnemy): boolean;
  chebyshev(x: number, y: number): number;
  visionGet(x: number, y: number): number;
  allied(enemy: KDNearestPlayerEnemy): boolean;
  inParty(enemy: KDNearestPlayerEnemy): boolean;
  jailGuard(): KDNearestPlayerEnemy | null;
  setFlag(flag: string, duration: number, floors?: number): void;
  getEnemyByName(name: unknown): KDNearestEnemyDefinition | undefined;
  compatible(): boolean;
  record?(
    event: "optimized" | "fallback" | "guarded-order" | "inline-hostile",
  ): void;
}

export interface EffectTileTags {
  readonly danger?: unknown;
}

export interface KDPathCacheLike {
  readonly size: number;
  has(key: string): boolean;
  get(key: string): readonly Position[] | undefined;
  set(key: string, path: readonly Position[]): unknown;
  delete(key: string): boolean;
  clear?(): void;
}

export interface KDPathfindingEnvironment {
  mapData(): KDMapDataLike | undefined;
  mapGenerationActive?(): boolean;
  visionAt(x: number, y: number): number | undefined;
  effectTagsAt(location: string): EffectTileTags | undefined;
  playerPosition(): Position | undefined;
  openDoorTiles(): readonly unknown[] | undefined;
  pathCache?(ignoreLocks: boolean): KDPathCacheLike | undefined;
  tileShort?(movableTiles: string): string;
  recordCacheHit?(): void;
  recordCacheFill?(): void;
  recordFallback?(reason: string): void;
  clearPathCaches?(): void;
}

type NativePathBridge = Pick<WasmBatchBridge, "loadSnapshot" | "query">;
type AdapterResult = readonly Position[] | undefined | NativeFallbackRequest;

export interface KDMapGenerationGuardState {
  depth: number;
  enemySelectorCacheEpoch?: object;
}

export interface KDMapGenerationAdapterOptions {
  readonly runWithDirectPathfindingFallback?: <T>(
    callback: () => T,
    recordActivation?: (active: boolean) => void,
  ) => T;
  readonly directPathfindingFallbackEnabled?: () => boolean;
  readonly recordDirectPathfindingFallback?: (active: boolean) => void;
  readonly enemySelectorCacheEnabled?: () => boolean;
  /** @deprecated Use enemySelectorCacheEnabled. */
  readonly enemySelectorAngerCacheEnabled?: () => boolean;
}

type NearbyAdapterResult = readonly KDNearbyEnemy[] | NativeFallbackRequest;
type FindMasterAdapterResult = KDFindMasterResult | NativeFallbackRequest;
type NearestPlayerAdapterResult = KDNearestPlayerEnemy | NativeFallbackRequest;

interface NearbyOffsetTemplate {
  readonly offsets: readonly number[];
  readonly minimumX: number;
  readonly maximumX: number;
  readonly minimumY: number;
  readonly maximumY: number;
  linearWidth: number;
  linearOffsets: readonly number[];
}

/**
 * Creates the native implementation behind the signature-gated KD facade.
 *
 * Unsupported dynamic argument combinations request a one-call JavaScript
 * fallback. No game state is changed until a complete native path has been
 * decoded and validated.
 */
export function createKinkyDungeonPathfindingHandler(
  bridge: NativePathBridge,
  environment: KDPathfindingEnvironment = browserEnvironment,
  pathfindingMode: () => PathfindingMode = () => "fast",
): (...args: unknown[]) => AdapterResult {
  let cacheStates = new WeakMap<object, CacheState>();
  let loadedGrid: LoadedGrid | null = null;
  let activeMode = pathfindingMode();

  return (...args: unknown[]): AdapterResult => {
    const mode = pathfindingMode();
    if (mode !== activeMode) {
      environment.clearPathCaches?.();
      cacheStates = new WeakMap<object, CacheState>();
      loadedGrid = null;
      activeMode = mode;
    }
    if (environment.mapGenerationActive?.()) {
      environment.recordFallback?.("map-generation");
      return useJavaScriptFallback();
    }
    const startX = integerCoordinate(args[0]);
    const startY = integerCoordinate(args[1]);
    const goalX = integerCoordinate(args[2]);
    const goalY = integerCoordinate(args[3]);
    const movableTiles = args[7];
    if (
      startX === null ||
      startY === null ||
      goalX === null ||
      goalY === null ||
      typeof movableTiles !== "string"
    ) {
      environment.recordFallback?.("invalid-endpoint-or-movable-tiles");
      return useJavaScriptFallback();
    }

    const blockEnemy = Boolean(args[4]);
    const blockPlayer = Boolean(args[5]);
    const ignoreLocks = Boolean(args[6]);
    const requireLight = Boolean(args[8]);
    const noDoors = Boolean(args[9]);
    const needDoorMemory = Boolean(args[10]);
    const cacheEligible =
      !blockEnemy &&
      !blockPlayer &&
      !requireLight &&
      !noDoors &&
      !needDoorMemory;
    const tileShort = environment.tileShort?.(movableTiles) ?? movableTiles;
    const pathCache = cacheEligible
      ? environment.pathCache?.(ignoreLocks)
      : undefined;
    const modeTileShort =
      mode === "fast" ? tileShort : `${tileShort}\u001fkdhybrid:${mode}`;
    const cacheKey = `${startX},${startY},${goalX},${goalY},${modeTileShort}`;
    const cached = pathCache?.get(cacheKey);
    if (cached !== undefined) {
      environment.recordCacheHit?.();
      const first = cached[0];
      if (
        first !== undefined &&
        Math.max(Math.abs(first.x - startX), Math.abs(first.y - startY)) < 1.5
      ) {
        return cached.slice();
      }
      pathCache?.delete(cacheKey);
    }

    // The upstream function returns the target directly for the same or an
    // adjacent square, before performing a graph search.
    if (Math.max(Math.abs(startX - goalX), Math.abs(startY - goalY)) <= 1) {
      return [{ x: goalX, y: goalY }];
    }

    const enemy = args[11];
    const trimLongDistance = Boolean(args[12]);
    const heuristicOverride = args[13];
    const allowPassable = Boolean(args[16]);
    const leashTarget = args[18];
    if (blockEnemy) {
      const reasons = ["block-enemy"];
      if (enemy !== undefined && enemy !== null) reasons.push("enemy-context");
      if (trimLongDistance) reasons.push("trim-long-distance");
      if (allowPassable) reasons.push("allow-passable");
      if (
        leashTarget !== undefined &&
        leashTarget !== null &&
        leashTarget !== 0
      ) {
        reasons.push("leash-target");
      }
      environment.recordFallback?.(reasons.join("+"));
      return useJavaScriptFallback();
    }
    if (enemy !== undefined && enemy !== null) {
      environment.recordFallback?.("enemy-context");
      return useJavaScriptFallback();
    }
    if (trimLongDistance) {
      environment.recordFallback?.("trim-long-distance");
      return useJavaScriptFallback();
    }
    if (heuristicOverride !== undefined && heuristicOverride !== null) {
      environment.recordFallback?.("heuristic-override");
      return useJavaScriptFallback();
    }
    if (allowPassable) {
      environment.recordFallback?.("allow-passable");
      return useJavaScriptFallback();
    }
    if (
      leashTarget !== undefined &&
      leashTarget !== null &&
      leashTarget !== 0
    ) {
      environment.recordFallback?.("leash-target");
      return useJavaScriptFallback();
    }

    const cacheEpoch =
      pathCache === undefined ? -1 : observeCache(cacheStates, pathCache);
    const start = { x: startX, y: startY };
    const goal = { x: goalX, y: goalY };
    const map = environment.mapData();
    if (
      map === undefined ||
      !validMap(map) ||
      !inMap(map, start) ||
      !inMap(map, goal)
    ) {
      environment.recordFallback?.("invalid-map-or-endpoint");
      return useJavaScriptFallback();
    }
    const gridOptions = {
      blockPlayer,
      ignoreLocks,
      requireLight,
      noDoors,
      needDoorMemory,
      ignoreTrafficLaws: Boolean(args[15]),
      ignoreAllWeighting: Boolean(args[17]),
    };
    const canReuseGrid = pathCache !== undefined;
    const unreachableKey = `${cacheKey},${Number(Boolean(args[14]))},${mode}`;
    let tiles: Uint8Array;
    const sameGridIdentity =
      canReuseGrid &&
      loadedGrid !== null &&
      sameLoadedGridIdentity(
        loadedGrid,
        map,
        movableTiles,
        gridOptions,
        pathCache,
      );
    if (
      sameGridIdentity &&
      loadedGrid !== null &&
      loadedGrid.cacheEpoch === cacheEpoch
    ) {
      tiles = loadedGrid.tiles;
      if (loadedGrid.unreachableKeys.has(unreachableKey)) {
        return undefined;
      }
    } else {
      const encoded = encodeKinkyDungeonGrid(
        map,
        movableTiles,
        gridOptions,
        environment,
      );
      if (encoded === null) {
        environment.recordFallback?.("unsupported-grid-encoding");
        return useJavaScriptFallback();
      }
      const unchangedGrid =
        sameGridIdentity &&
        loadedGrid !== null &&
        equalBytes(loadedGrid.tiles, encoded);
      tiles = unchangedGrid && loadedGrid !== null ? loadedGrid.tiles : encoded;
      if (!unchangedGrid) {
        bridge.loadSnapshot(
          encodeSnapshot({
            width: map.GridWidth,
            height: map.GridHeight,
            turn: 0n,
            seed: 0n,
            tiles,
            entities: [],
            buffs: [],
          }),
        );
      }
      loadedGrid = canReuseGrid
        ? {
            map,
            grid: map.Grid,
            mapTiles: map.Tiles,
            traffic: map.Traffic,
            movableTiles,
            options: gridOptions,
            cache: pathCache,
            cacheEpoch,
            tiles,
            unreachableKeys: new Set(),
          }
        : null;
    }

    const response = decodeQueryResponse(
      bridge.query(
        encodeQuery({
          kind: "gridPath",
          start,
          goal,
          maxVisited: Math.min(tiles.length * 4, MAX_VISITED),
          diagonal: !Boolean(args[14]),
          mode,
        }),
      ),
    );
    if (response.kind !== "path") {
      throw new TypeError("Native grid path returned a non-path response");
    }
    if (response.status !== "found") {
      if (
        response.status === "unreachable" &&
        canReuseGrid &&
        loadedGrid !== null
      ) {
        loadedGrid.unreachableKeys.add(unreachableKey);
      }
      return undefined;
    }
    validatePath(
      response.positions,
      start,
      goal,
      tiles,
      map.GridWidth,
      !Boolean(args[14]),
    );
    const result = response.positions.slice(1).map(({ x, y }) => ({ x, y }));
    if (pathCache !== undefined && !pathCache.has(cacheKey)) {
      setPathCache(pathCache, result, goal, modeTileShort, cacheKey);
      synchronizeCache(cacheStates, pathCache);
    }
    environment.recordCacheFill?.();
    return result;
  };
}

const browserMapGenerationGuard: KDMapGenerationGuardState = { depth: 0 };

/**
 * Runs KD's exact map generator while marking its nested path queries as
 * transient. The official JavaScript pathfinder remains faster and preserves
 * KD's deterministic generation choices while the grid is changing.
 */
export function createKinkyDungeonMapGenerationHandler(
  official: (...args: unknown[]) => unknown,
  state: KDMapGenerationGuardState = browserMapGenerationGuard,
  options: KDMapGenerationAdapterOptions = {},
): (...args: unknown[]) => CompletedJavaScriptCall {
  return function mapGenerationHandler(...args: unknown[]) {
    return completeJavaScriptCall(() => {
      const outermost = state.depth === 0;
      const previousEnemySelectorCacheEpoch = state.enemySelectorCacheEpoch;
      if (outermost) {
        let enableEnemySelectorCache = true;
        try {
          enableEnemySelectorCache =
            (options.enemySelectorCacheEnabled?.() ??
              options.enemySelectorAngerCacheEnabled?.()) !== false;
        } catch {
          enableEnemySelectorCache = false;
        }
        if (enableEnemySelectorCache) {
          state.enemySelectorCacheEpoch = Object.freeze({});
        } else {
          delete state.enemySelectorCacheEpoch;
        }
      }
      state.depth += 1;
      try {
        const invokeOfficial = () => Reflect.apply(official, globalThis, args);
        if (
          options.runWithDirectPathfindingFallback !== undefined &&
          options.directPathfindingFallbackEnabled?.() !== false
        ) {
          return options.runWithDirectPathfindingFallback(
            invokeOfficial,
            options.recordDirectPathfindingFallback,
          );
        }
        options.recordDirectPathfindingFallback?.(false);
        return invokeOfficial();
      } finally {
        state.depth -= 1;
        if (outermost) {
          if (previousEnemySelectorCacheEpoch === undefined) {
            delete state.enemySelectorCacheEpoch;
          } else {
            state.enemySelectorCacheEpoch = previousEnemySelectorCacheEpoch;
          }
        }
      }
    });
  };
}

/**
 * Preserves KD's enemy-selection order and random stream while hoisting values
 * that are invariant across the full enemy-catalog scan.
 *
 * Dynamic inputs, a recursive min-weight retry, replaced dependencies, and
 * unusual mod-owned collections stay on KD's official implementation.
 */
export function createKDEnemySelectorHandler(
  environment: KDEnemySelectorEnvironment,
): (...args: unknown[]) => CompletedJavaScriptCall | NativeFallbackRequest {
  let cachedAngerEpoch: object | undefined;
  let cachedAngerMatchCounts: WeakMap<object, number> | null = null;
  let cachedLongTagEpoch: object | undefined;
  const cachedLongTagBuilds = new Map<
    string,
    KDEnemySelectorLongTagCacheBuild | null
  >();
  let cachedWeightedQueryEpoch: object | undefined;
  let cachedWeightedQueryScope: KDEnemySelectorWeightedQueryCacheScope | null =
    null;
  const cachedWeightedQueries = new Map<
    string,
    KDEnemySelectorWeightedQueryCacheEntry
  >();

  return function enemySelectorHandler(
    enemyTagsValue: unknown,
    levelValue: unknown,
    indexValue: unknown,
    tileValue: unknown,
    requireTagsValue?: unknown,
    alliancesValue?: unknown,
    bonusTagsValue?: unknown,
    filterTagsValue?: unknown,
    requireSingleTagValue?: unknown,
    minWeightValue: unknown = 0,
    minWeightFallbackValue: unknown = true,
    noOverrideFloorValue: unknown = false,
  ): CompletedJavaScriptCall | NativeFallbackRequest {
    if (
      !Array.isArray(enemyTagsValue) ||
      typeof levelValue !== "number" ||
      typeof indexValue !== "string" ||
      typeof tileValue !== "string" ||
      typeof minWeightValue !== "number" ||
      (requireTagsValue != null && !Array.isArray(requireTagsValue)) ||
      (filterTagsValue != null && !Array.isArray(filterTagsValue)) ||
      (requireSingleTagValue != null &&
        !Array.isArray(requireSingleTagValue)) ||
      (alliancesValue != null && typeof alliancesValue !== "object") ||
      !plainBonusTags(bonusTagsValue) ||
      (minWeightValue > 0 && Boolean(minWeightFallbackValue))
    ) {
      return useJavaScriptFallback();
    }

    let state: KDEnemySelectorState | undefined;
    try {
      state = environment.state();
      if (state === undefined || !environment.compatible(state)) {
        return useJavaScriptFallback();
      }
    } catch {
      return useJavaScriptFallback();
    }

    const requireTags =
      requireTagsValue == null
        ? undefined
        : (requireTagsValue as readonly string[]);
    const filterTags =
      filterTagsValue == null
        ? undefined
        : (filterTagsValue as readonly string[]);
    const requireSingleTag =
      requireSingleTagValue == null
        ? undefined
        : (requireSingleTagValue as readonly string[]);
    const alliances = alliancesValue as
      | {
          readonly requireHostile?: unknown;
          readonly requireAllied?: unknown;
          readonly requireNonHostile?: unknown;
        }
      | null
      | undefined;
    let bonusEntries:
      [string, { readonly bonus: number; readonly mult: number }][] | null;
    try {
      bonusEntries =
        bonusTagsValue == null
          ? null
          : Object.entries(
              bonusTagsValue as Readonly<
                Record<
                  string,
                  { readonly bonus: number; readonly mult: number }
                >
              >,
            );
    } catch {
      return useJavaScriptFallback();
    }
    const factionRelation = state.factionRelation;
    const random = state.random;

    return completeJavaScriptCall(() => {
      let enemyWeightTotal = 0;
      const enemyWeights: {
        readonly enemy: KDEnemySelectorDefinition;
        readonly weight: number;
      }[] = [];
      const tags = Object.assign([], enemyTagsValue) as string[];
      for (const perkTag of state.perkToggleTags) {
        if (state.statsChoice.get(perkTag)) {
          tags.push(perkTag);
        }
      }

      const effectiveLevel = levelValue + 25 * state.newGame;
      const arousalMode = state.statsChoice.get("arousalMode");
      const hasGrateTag = tags.includes("grate");
      const groundTile = state.groundTiles.includes(tileValue);
      const avoidTile = state.avoidTiles.includes(tileValue);
      const noOverrideTags = new Array<boolean>(tags.length);
      for (let tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
        const tag = tags[tagIndex];
        noOverrideTags[tagIndex] =
          tag === "boss" ||
          tag === "miniboss" ||
          tag === "elite" ||
          tag === "minor";
      }
      const angerTagQuery =
        !noOverrideFloorValue &&
        exactStringSequence(tags, ENEMY_SELECTOR_ANGER_TAGS);
      let angerCacheStats: KDEnemySelectorAngerCacheStats | undefined;
      let angerMatchCounts: WeakMap<object, number> | null = null;
      if (angerTagQuery) {
        try {
          angerCacheStats = environment.angerCacheStats?.();
        } catch {
          angerCacheStats = undefined;
        }
        let cacheEnabled = true;
        try {
          cacheEnabled = environment.angerCacheEnabled?.() !== false;
        } catch {
          cacheEnabled = false;
        }
        let epoch: object | undefined;
        if (cacheEnabled) {
          try {
            epoch = environment.mapGenerationCacheEpoch?.();
          } catch {
            epoch = undefined;
          }
        }
        if (epoch !== undefined) {
          if (cachedAngerEpoch !== epoch) {
            cachedAngerEpoch = epoch;
            const cacheBuild = buildEnemySelectorAngerCache(
              state.enemies,
              environment.angerMatchIndices ?? [],
            );
            cachedAngerMatchCounts = cacheBuild?.matchCounts ?? null;
            if (cachedAngerMatchCounts === null) {
              incrementEnemySelectorAngerStat(
                angerCacheStats,
                "validationFailures",
              );
            } else {
              incrementEnemySelectorAngerStat(
                angerCacheStats,
                "cacheBuilds",
                cacheBuild!.uniqueTagObjects,
              );
            }
          }
          angerMatchCounts = cachedAngerMatchCounts;
        } else {
          cachedAngerEpoch = undefined;
          cachedAngerMatchCounts = null;
        }
        incrementEnemySelectorAngerStat(
          angerCacheStats,
          angerMatchCounts === null ? "fallbackCalls" : "optimizedCalls",
        );
      }
      let longTagQueryKey: string | undefined;
      if (!noOverrideFloorValue) {
        try {
          longTagQueryKey = environment.longTagQueryKey?.(tags);
        } catch {
          longTagQueryKey = undefined;
        }
      }
      let longTagCacheStats: KDEnemySelectorLongTagCacheStats | undefined;
      let longTagMatchCounts: WeakMap<object, number> | null = null;
      if (longTagQueryKey !== undefined) {
        try {
          longTagCacheStats = environment.longTagCacheStats?.();
        } catch {
          longTagCacheStats = undefined;
        }
        let cacheEnabled = true;
        try {
          cacheEnabled = environment.longTagCacheEnabled?.() !== false;
        } catch {
          cacheEnabled = false;
        }
        let epoch: object | undefined;
        if (cacheEnabled) {
          try {
            epoch = environment.mapGenerationCacheEpoch?.();
          } catch {
            epoch = undefined;
          }
        }
        if (epoch !== undefined) {
          if (cachedLongTagEpoch !== epoch) {
            cachedLongTagEpoch = epoch;
            cachedLongTagBuilds.clear();
          }
          let cacheBuild = cachedLongTagBuilds.get(longTagQueryKey);
          if (
            cacheBuild === undefined &&
            !cachedLongTagBuilds.has(longTagQueryKey)
          ) {
            cacheBuild = buildEnemySelectorLongTagCache(state.enemies, tags);
            cachedLongTagBuilds.set(longTagQueryKey, cacheBuild);
            incrementEnemySelectorLongTagStat(
              longTagCacheStats,
              "querySequences",
            );
            if (cacheBuild === null) {
              incrementEnemySelectorLongTagStat(
                longTagCacheStats,
                "validationFailures",
              );
            } else {
              incrementEnemySelectorLongTagStat(
                longTagCacheStats,
                "cacheBuilds",
                cacheBuild.uniqueTagObjects,
              );
            }
          }
          if (
            cacheBuild !== null &&
            cacheBuild !== undefined &&
            exactStringSequence(tags, cacheBuild.queryTags)
          ) {
            longTagMatchCounts = cacheBuild.matchCounts;
          } else if (cacheBuild !== null && cacheBuild !== undefined) {
            incrementEnemySelectorLongTagStat(
              longTagCacheStats,
              "validationFailures",
            );
          }
        } else {
          cachedLongTagEpoch = undefined;
          cachedLongTagBuilds.clear();
        }
        incrementEnemySelectorLongTagStat(
          longTagCacheStats,
          longTagMatchCounts === null ? "fallbackCalls" : "optimizedCalls",
        );
      }
      let weightedQueryCacheStats:
        KDEnemySelectorWeightedQueryCacheStats | undefined;
      let weightedQueryCacheKey: string | undefined;
      let weightedSingleTagQueryKey: string | undefined;
      let weightedFilterTagCacheEnabled = false;
      try {
        if (environment.weightedSingleTagCacheEnabled?.() === true) {
          weightedSingleTagQueryKey =
            canonicalEnemySelectorWeightedSingleTagQueryKey(tags);
        }
      } catch {
        weightedSingleTagQueryKey = undefined;
      }
      try {
        weightedFilterTagCacheEnabled =
          environment.weightedFilterTagCacheEnabled?.() === true;
      } catch {
        weightedFilterTagCacheEnabled = false;
      }
      const weightedQueryCandidate =
        angerTagQuery ||
        longTagQueryKey !== undefined ||
        weightedSingleTagQueryKey !== undefined;
      if (weightedQueryCandidate) {
        try {
          weightedQueryCacheStats = environment.weightedQueryCacheStats?.();
        } catch {
          weightedQueryCacheStats = undefined;
        }
        let cacheEnabled = false;
        try {
          cacheEnabled = environment.weightedQueryCacheEnabled?.() === true;
        } catch {
          cacheEnabled = false;
        }
        let epoch: object | undefined;
        if (cacheEnabled) {
          try {
            epoch = environment.mapGenerationCacheEpoch?.();
          } catch {
            epoch = undefined;
          }
        }
        const matchCacheReady = angerTagQuery
          ? angerMatchCounts !== null
          : longTagQueryKey !== undefined
            ? longTagMatchCounts !== null
            : weightedSingleTagQueryKey !== undefined;
        if (epoch !== undefined && matchCacheReady) {
          if (cachedWeightedQueryEpoch !== epoch) {
            cachedWeightedQueryEpoch = epoch;
            cachedWeightedQueries.clear();
            cachedWeightedQueryScope =
              buildEnemySelectorWeightedQueryCacheScope(state);
            if (cachedWeightedQueryScope === null) {
              incrementEnemySelectorWeightedQueryStat(
                weightedQueryCacheStats,
                "validationFailures",
              );
            }
          } else if (
            cachedWeightedQueryScope !== null &&
            !enemySelectorWeightedQueryCacheScopeMatches(
              cachedWeightedQueryScope,
              state,
            )
          ) {
            cachedWeightedQueryScope = null;
            cachedWeightedQueries.clear();
            incrementEnemySelectorWeightedQueryStat(
              weightedQueryCacheStats,
              "validationFailures",
            );
          }
          if (cachedWeightedQueryScope !== null) {
            weightedQueryCacheKey = enemySelectorWeightedQueryCacheKey(
              angerTagQuery
                ? "anger"
                : longTagQueryKey !== undefined
                  ? `long:${longTagQueryKey}`
                  : `single:${weightedSingleTagQueryKey!}`,
              levelValue,
              indexValue,
              tileValue,
              requireTagsValue,
              alliancesValue,
              bonusTagsValue,
              filterTagsValue,
              weightedFilterTagCacheEnabled,
              requireSingleTagValue,
              minWeightValue,
              minWeightFallbackValue,
              noOverrideFloorValue,
              state,
              Boolean(arousalMode),
            );
          }
          if (weightedQueryCacheKey !== undefined) {
            const cachedQuery = cachedWeightedQueries.get(
              weightedQueryCacheKey,
            );
            if (cachedQuery !== undefined) {
              incrementEnemySelectorWeightedQueryStat(
                weightedQueryCacheStats,
                "optimizedCalls",
              );
              incrementEnemySelectorWeightedQueryStat(
                weightedQueryCacheStats,
                "cacheHits",
              );
              incrementEnemySelectorWeightedQueryStat(
                weightedQueryCacheStats,
                "enemiesElided",
                state.enemies.length,
              );
              const selection = random() * cachedQuery.enemyWeightTotal;
              for (
                let weightIndex = cachedQuery.enemyWeights.length - 1;
                weightIndex >= 0;
                weightIndex -= 1
              ) {
                const weightedEnemy = cachedQuery.enemyWeights[weightIndex]!;
                if (selection > weightedEnemy.weight) {
                  if (weightedEnemy.enemy.name == "Mimic") {
                    console.log("Mimic says boo");
                  }
                  return weightedEnemy.enemy;
                }
              }
              return undefined;
            }
          }
        } else {
          cachedWeightedQueryEpoch = undefined;
          cachedWeightedQueryScope = null;
          cachedWeightedQueries.clear();
        }
        incrementEnemySelectorWeightedQueryStat(
          weightedQueryCacheStats,
          "fallbackCalls",
        );
      }

      for (const enemy of state.enemies) {
        let weightMulti = 1;
        let weightBonus = 0;

        if (!arousalMode && enemy.arousalMode) {
          continue;
        }

        if (enemy.shrines) {
          for (const shrine of enemy.shrines) {
            if (state.goddessRep[shrine]) {
              const reputation = state.goddessRep[shrine]!;
              if (reputation > 0) {
                weightMulti *= Math.max(0, 1 - reputation / 100);
              } else if (reputation < 0) {
                weightMulti = Math.max(
                  weightMulti,
                  Math.max(1, 1 - reputation / 100),
                );
                weightBonus = Math.max(
                  weightBonus,
                  Math.min(10, -reputation / 10),
                );
              }
            }
          }
        }

        if (!enemy.terrainTags?.grate && hasGrateTag) {
          continue;
        }

        let overrideFloor = false;
        const angerMatchCount =
          angerMatchCounts !== null && !enemy.noOverrideFloor
            ? angerMatchCounts.get(enemy.tags)
            : undefined;
        const longTagMatchCount =
          longTagMatchCounts !== null && !enemy.noOverrideFloor
            ? longTagMatchCounts.get(enemy.tags)
            : undefined;
        if (angerMatchCount !== undefined) {
          overrideFloor = angerMatchCount > 0;
          for (
            let matchIndex = 0;
            matchIndex < angerMatchCount;
            matchIndex += 1
          ) {
            weightMulti *= 1.25;
          }
          if (angerCacheStats !== undefined) {
            incrementEnemySelectorAngerStat(angerCacheStats, "cacheHits");
            incrementEnemySelectorAngerStat(
              angerCacheStats,
              "tagChecksElided",
              ENEMY_SELECTOR_ANGER_TAGS.length,
            );
          }
        } else if (longTagMatchCount !== undefined) {
          overrideFloor = longTagMatchCount > 0;
          for (
            let matchIndex = 0;
            matchIndex < longTagMatchCount;
            matchIndex += 1
          ) {
            weightMulti *= 1.25;
          }
          if (longTagCacheStats !== undefined) {
            incrementEnemySelectorLongTagStat(longTagCacheStats, "cacheHits");
            incrementEnemySelectorLongTagStat(
              longTagCacheStats,
              "tagChecksElided",
              tags.length,
            );
          }
        } else {
          if (angerMatchCounts !== null && angerCacheStats !== undefined) {
            incrementEnemySelectorAngerStat(
              angerCacheStats,
              "perEnemyFallbacks",
            );
          }
          if (longTagMatchCounts !== null && longTagCacheStats !== undefined) {
            incrementEnemySelectorLongTagStat(
              longTagCacheStats,
              "perEnemyFallbacks",
            );
          }
          for (let tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
            const tag = tags[tagIndex]!;
            if (
              !noOverrideFloorValue &&
              !enemy.noOverrideFloor &&
              !noOverrideTags[tagIndex]
            ) {
              if (enemy.tags[tag]) {
                overrideFloor = true;
                weightMulti *= 1.25;
              }
            } else if (noOverrideTags[tagIndex]) {
              if (enemy.outOfBoxWeightMult) {
                weightMulti *= 1.25;
              } else {
                weightMulti *= 0.1;
              }
            }
          }
        }

        if (!(
          overrideFloor ||
          enemy.allFloors ||
          !enemy.floors ||
          enemy.floors[indexValue]
        )) {
          continue;
        }

        if (bonusEntries !== null) {
          for (const [tag, bonus] of bonusEntries) {
            if (enemy.tags[tag]) {
              weightBonus += bonus.bonus;
              weightMulti *= bonus.mult;
            }
          }
        }

        if (weightMulti == 0) {
          continue;
        }

        if (
          effectiveLevel >= enemy.minLevel &&
          (!enemy.maxLevel || effectiveLevel < enemy.maxLevel) &&
          (!filterTags ||
            !filterTags.some((tag) => Boolean(enemy.tags[tag]))) &&
          (!alliances?.requireHostile ||
            (alliances.requireHostile == "Player" && !enemy.faction) ||
            (enemy.faction &&
              factionRelation(alliances.requireHostile, enemy.faction) <=
                -0.5)) &&
          (!alliances?.requireAllied ||
            (alliances.requireAllied == "Player" && !enemy.faction) ||
            (enemy.faction &&
              factionRelation(alliances.requireAllied, enemy.faction) > 0.2)) &&
          (!alliances?.requireNonHostile ||
            (alliances.requireNonHostile == "Player" && !enemy.faction) ||
            (enemy.faction &&
              factionRelation(alliances.requireNonHostile, enemy.faction) >
                -0.49)) &&
          (groundTile || !enemy.tags.spawnFloorsOnly) &&
          !avoidTile
        ) {
          let required = true;
          let requiredSingle = false;
          if (requireTags) {
            for (const tag of requireTags) {
              if (!enemy.tags[tag]) {
                required = false;
                break;
              }
            }
          }
          if (requireSingleTag) {
            for (const tag of requireSingleTag) {
              if (enemy.tags[tag]) {
                requiredSingle = true;
                break;
              }
            }
          } else {
            requiredSingle = true;
          }

          if (required && requiredSingle) {
            let weight = enemy.weight + weightBonus;
            if (enemy.terrainTags.increasingWeight) {
              weight +=
                enemy.terrainTags.increasingWeight *
                Math.floor(levelValue / state.levelsPerCheckpoint);
            }
            for (const tag of tags) {
              const terrainWeight = enemy.terrainTags[tag];
              if (terrainWeight) {
                weight += terrainWeight;
              }
            }

            if (enemy.weightMult) {
              weightMulti *= enemy.weightMult;
            }

            if (weight > minWeightValue) {
              enemyWeights.push({
                enemy,
                weight: enemyWeightTotal,
              });
              enemyWeightTotal += Math.max(0, weight * weightMulti);
            }
          }
        }
      }

      if (weightedQueryCacheKey !== undefined) {
        cachedWeightedQueries.set(
          weightedQueryCacheKey,
          Object.freeze({
            enemyWeightTotal,
            enemyWeights: Object.freeze([...enemyWeights]),
          }),
        );
        incrementEnemySelectorWeightedQueryStat(
          weightedQueryCacheStats,
          "cacheBuilds",
        );
      }
      const selection = random() * enemyWeightTotal;
      for (
        let weightIndex = enemyWeights.length - 1;
        weightIndex >= 0;
        weightIndex -= 1
      ) {
        const weightedEnemy = enemyWeights[weightIndex]!;
        if (selection > weightedEnemy.weight) {
          if (weightedEnemy.enemy.name == "Mimic") {
            console.log("Mimic says boo");
          }
          return weightedEnemy.enemy;
        }
      }
      return undefined;
    });
  };
}

interface KDEnemySelectorAngerCacheBuild {
  readonly matchCounts: WeakMap<object, number>;
  readonly uniqueTagObjects: number;
}

interface KDEnemySelectorLongTagCacheBuild {
  readonly queryTags: readonly string[];
  readonly matchCounts: WeakMap<object, number>;
  readonly uniqueTagObjects: number;
}

interface KDEnemySelectorWeightedEnemy {
  readonly enemy: KDEnemySelectorDefinition;
  readonly weight: number;
}

/**
 * The map-generation adapter owns this scope and replaces its epoch for every
 * outer map. Public map-generation hooks suppress the epoch entirely. Validate
 * the catalog once at that boundary, then keep cache hits constant-time; mods
 * that mutate private catalog data inside an unhooked map can opt out through
 * disableEnemySelectorWeightedQueryCache.
 */
interface KDEnemySelectorWeightedQueryCacheScope {
  readonly enemies: readonly KDEnemySelectorDefinition[];
  readonly enemyCount: number;
  readonly firstEnemy: KDEnemySelectorDefinition | undefined;
  readonly lastEnemy: KDEnemySelectorDefinition | undefined;
  readonly statsChoice: Map<unknown, unknown>;
  readonly goddessRep: Readonly<Record<string, number | undefined>>;
  readonly factionRelation: (left: unknown, right: unknown) => number;
}

interface KDEnemySelectorWeightedQueryCacheEntry {
  readonly enemyWeightTotal: number;
  readonly enemyWeights: readonly KDEnemySelectorWeightedEnemy[];
}

const ENEMY_SELECTOR_WEIGHTED_ENEMY_FIELDS = Object.freeze([
  "name",
  "arousalMode",
  "tags",
  "terrainTags",
  "shrines",
  "noOverrideFloor",
  "outOfBoxWeightMult",
  "allFloors",
  "floors",
  "faction",
  "minLevel",
  "maxLevel",
  "weight",
  "weightMult",
]);

function exactStringSequence(
  actual: readonly unknown[],
  expected: readonly string[],
): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) {
      return false;
    }
  }
  return true;
}

function canonicalEnemySelectorWeightedSingleTagQueryKey(
  tags: readonly string[],
): string | undefined {
  if (tags.length !== 1) {
    return undefined;
  }
  const tag = tags[0];
  return tag === "mushroom" ||
    tag === "obstacletile" ||
    tag === "statue" ||
    tag === "elemental" ||
    tag === "human"
    ? tag
    : undefined;
}

function enemySelectorWeightedQueryCacheKey(
  queryKey: string,
  level: number,
  index: string,
  tile: string,
  requireTagsValue: unknown,
  alliancesValue: unknown,
  bonusTagsValue: unknown,
  filterTagsValue: unknown,
  allowFilterTags: boolean,
  requireSingleTagValue: unknown,
  minWeightValue: number,
  minWeightFallbackValue: unknown,
  noOverrideFloorValue: unknown,
  state: KDEnemySelectorState,
  arousalMode: boolean,
): string | undefined {
  if (
    bonusTagsValue != null ||
    (filterTagsValue != null && !allowFilterTags) ||
    requireSingleTagValue != null ||
    minWeightValue !== 0 ||
    minWeightFallbackValue !== true ||
    noOverrideFloorValue !== false
  ) {
    return undefined;
  }
  const requireTags = encodeEnemySelectorStringArray(requireTagsValue);
  const filterTags = encodeEnemySelectorStringArray(filterTagsValue);
  const alliances = encodeEnemySelectorAlliances(alliancesValue);
  if (
    requireTags === undefined ||
    filterTags === undefined ||
    alliances === undefined
  ) {
    return undefined;
  }
  return [
    encodeEnemySelectorString(queryKey),
    encodeEnemySelectorNumber(level),
    encodeEnemySelectorString(index),
    encodeEnemySelectorString(tile),
    requireTags,
    filterTags,
    alliances,
    encodeEnemySelectorNumber(state.newGame),
    arousalMode ? "1" : "0",
    encodeEnemySelectorString(state.groundTiles),
    encodeEnemySelectorString(state.avoidTiles),
    encodeEnemySelectorNumber(state.levelsPerCheckpoint),
  ].join("|");
}

function encodeEnemySelectorString(value: string): string {
  return `${value.length}:${value}`;
}

function encodeEnemySelectorNumber(value: number): string {
  if (Number.isNaN(value)) {
    return "nan";
  }
  if (Object.is(value, -0)) {
    return "-0";
  }
  return String(value);
}

function encodeEnemySelectorStringArray(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return "0:";
  }
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    return undefined;
  }
  let encoded = `${value.length}:`;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string"
    ) {
      return undefined;
    }
    encoded += encodeEnemySelectorString(descriptor.value);
  }
  return encoded;
}

function encodeEnemySelectorAlliances(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return "0:0:0:";
  }
  if (typeof value !== "object") {
    return undefined;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return undefined;
  }
  let encoded = "";
  for (const field of [
    "requireHostile",
    "requireAllied",
    "requireNonHostile",
  ]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (descriptor === undefined) {
      encoded += "0:";
    } else if (!("value" in descriptor)) {
      return undefined;
    } else if (descriptor.value == null) {
      encoded += "0:";
    } else if (typeof descriptor.value === "string") {
      encoded += encodeEnemySelectorString(descriptor.value);
    } else {
      return undefined;
    }
  }
  return encoded;
}

function buildEnemySelectorWeightedQueryCacheScope(
  state: KDEnemySelectorState,
): KDEnemySelectorWeightedQueryCacheScope | null {
  try {
    if (!plainDataRecord(state.goddessRep)) {
      return null;
    }
    for (const enemy of state.enemies) {
      if (!plainWeightedEnemy(enemy)) {
        return null;
      }
    }
  } catch {
    return null;
  }
  return Object.freeze({
    enemies: state.enemies,
    enemyCount: state.enemies.length,
    firstEnemy: state.enemies[0],
    lastEnemy: state.enemies[state.enemies.length - 1],
    statsChoice: state.statsChoice,
    goddessRep: state.goddessRep,
    factionRelation: state.factionRelation,
  });
}

function enemySelectorWeightedQueryCacheScopeMatches(
  scope: KDEnemySelectorWeightedQueryCacheScope,
  state: KDEnemySelectorState,
): boolean {
  return (
    state.enemies === scope.enemies &&
    state.enemies.length === scope.enemyCount &&
    state.enemies[0] === scope.firstEnemy &&
    state.enemies[state.enemies.length - 1] === scope.lastEnemy &&
    state.statsChoice === scope.statsChoice &&
    state.goddessRep === scope.goddessRep &&
    state.factionRelation === scope.factionRelation
  );
}

function plainWeightedEnemy(enemy: KDEnemySelectorDefinition): boolean {
  const prototype = Object.getPrototypeOf(enemy);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  for (const field of ENEMY_SELECTOR_WEIGHTED_ENEMY_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(enemy, field);
    if (descriptor !== undefined && !("value" in descriptor)) {
      return false;
    }
  }
  if (!plainDataRecord(enemy.tags) || !plainDataRecord(enemy.terrainTags)) {
    return false;
  }
  if (enemy.floors !== undefined && !plainDataRecord(enemy.floors)) {
    return false;
  }
  if (enemy.shrines !== undefined) {
    if (
      !Array.isArray(enemy.shrines) ||
      Object.getPrototypeOf(enemy.shrines) !== Array.prototype
    ) {
      return false;
    }
    for (let index = 0; index < enemy.shrines.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(
        enemy.shrines,
        String(index),
      );
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string"
      ) {
        return false;
      }
    }
  }
  return true;
}

function plainDataRecord(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      return false;
    }
  }
  return true;
}

function canonicalEnemySelectorLongTagQueryKey(
  tags: readonly string[],
): string | undefined {
  if (
    ENEMY_SELECTOR_TRAP_COMMON_TAGS.length !== 98 ||
    ENEMY_SELECTOR_TRAP_OPTOUT_TAGS.length !== 3 ||
    tags.length < 100 ||
    tags.length > 105 ||
    tags[0] !== "trap"
  ) {
    return undefined;
  }
  const trapType = tags[1];
  if (
    trapType !== ENEMY_SELECTOR_TRAP_TYPES[0] &&
    trapType !== ENEMY_SELECTOR_TRAP_TYPES[1] &&
    trapType !== ENEMY_SELECTOR_TRAP_TYPES[2] &&
    trapType !== ENEMY_SELECTOR_TRAP_TYPES[3] &&
    trapType !== ENEMY_SELECTOR_TRAP_TYPES[4] &&
    trapType !== ENEMY_SELECTOR_TRAP_TYPES[5]
  ) {
    return undefined;
  }
  for (
    let tagIndex = 0;
    tagIndex < ENEMY_SELECTOR_TRAP_COMMON_TAGS.length;
    tagIndex += 1
  ) {
    if (tags[tagIndex + 2] !== ENEMY_SELECTOR_TRAP_COMMON_TAGS[tagIndex]) {
      return undefined;
    }
  }
  let suffixIndex = 100;
  let queryKey = trapType;
  if (
    tags[100] === ENEMY_SELECTOR_TRAP_OPTOUT_TAGS[0] &&
    tags[101] === ENEMY_SELECTOR_TRAP_OPTOUT_TAGS[1] &&
    tags[102] === ENEMY_SELECTOR_TRAP_OPTOUT_TAGS[2]
  ) {
    suffixIndex = 103;
    queryKey = `${queryKey}:optouts`;
  }
  if (tags.length === suffixIndex) {
    return queryKey;
  }
  if (
    tags.length === suffixIndex + 1 &&
    ((trapType === "leatherTrap" && tags[suffixIndex] === "harness") ||
      (trapType === "metalTrap" && tags[suffixIndex] === "cuffs"))
  ) {
    return `${queryKey}:${tags[suffixIndex]}`;
  }
  if (
    tags.length === suffixIndex + 2 &&
    trapType === "leatherTrap" &&
    tags[suffixIndex] === "harness" &&
    tags[suffixIndex + 1] === "gag"
  ) {
    return `${queryKey}:harness:gag`;
  }
  return undefined;
}

/**
 * Returns an exact, collision-safe cache key for long enemy-tag queries.
 *
 * The compact keys preserve the known KD 5.4.92 trap families. Other long
 * queries use their full string sequence, provided they are ordinary dense
 * arrays and do not contain KD's special out-of-box floor tags. Those four
 * tags have different weighting semantics and must stay on the official loop.
 */
export function enemySelectorLongTagQueryKey(
  tags: readonly string[],
  allowGeneralQueries = true,
): string | undefined {
  const canonicalKey = canonicalEnemySelectorLongTagQueryKey(tags);
  if (canonicalKey !== undefined || !allowGeneralQueries || tags.length < 100) {
    return canonicalKey;
  }
  const encodedTags = encodeEnemySelectorStringArray(tags);
  if (encodedTags === undefined) {
    return undefined;
  }
  for (let tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
    const tag = tags[tagIndex]!;
    if (
      tag === "boss" ||
      tag === "miniboss" ||
      tag === "elite" ||
      tag === "minor"
    ) {
      return undefined;
    }
  }
  return `general:${encodedTags}`;
}

function buildEnemySelectorAngerCache(
  enemies: readonly KDEnemySelectorDefinition[],
  expectedMatchIndices: readonly number[],
): KDEnemySelectorAngerCacheBuild | null {
  const matchCounts = new WeakMap<object, number>();
  let uniqueTagObjects = 0;
  let expectedMatchIndex = 0;
  try {
    for (const tag of ENEMY_SELECTOR_ANGER_TAGS) {
      if (
        Object.getOwnPropertyDescriptor(Object.prototype, tag) !== undefined
      ) {
        return null;
      }
    }
    for (let enemyIndex = 0; enemyIndex < enemies.length; enemyIndex += 1) {
      const tags = enemies[enemyIndex]!.tags;
      if (
        (typeof tags !== "object" && typeof tags !== "function") ||
        tags === null
      ) {
        return null;
      }
      const prototype = Object.getPrototypeOf(tags);
      if (prototype !== Object.prototype && prototype !== null) {
        return null;
      }
      let matchCount = 0;
      for (const tag of ENEMY_SELECTOR_ANGER_TAGS) {
        const descriptor = Object.getOwnPropertyDescriptor(tags, tag);
        if (descriptor !== undefined) {
          if (!("value" in descriptor)) {
            return null;
          }
          if (descriptor.value) {
            matchCount += 1;
            if (matchCount > 1) {
              return null;
            }
          }
        }
      }
      if (matchCount > 0) {
        if (expectedMatchIndices[expectedMatchIndex] !== enemyIndex) {
          return null;
        }
        expectedMatchIndex += 1;
      }
      if (!matchCounts.has(tags)) {
        matchCounts.set(tags, matchCount);
        uniqueTagObjects += 1;
      }
    }
  } catch {
    return null;
  }
  if (expectedMatchIndex !== expectedMatchIndices.length) {
    return null;
  }
  return Object.freeze({ matchCounts, uniqueTagObjects });
}

function buildEnemySelectorLongTagCache(
  enemies: readonly KDEnemySelectorDefinition[],
  queryTags: readonly string[],
): KDEnemySelectorLongTagCacheBuild | null {
  const matchCounts = new WeakMap<object, number>();
  let uniqueTagObjects = 0;
  try {
    for (const tag of queryTags) {
      if (
        Object.getOwnPropertyDescriptor(Object.prototype, tag) !== undefined
      ) {
        return null;
      }
    }
    for (const enemy of enemies) {
      const tags = enemy.tags;
      if (
        (typeof tags !== "object" && typeof tags !== "function") ||
        tags === null
      ) {
        return null;
      }
      if (matchCounts.has(tags)) {
        continue;
      }
      const prototype = Object.getPrototypeOf(tags);
      if (prototype !== Object.prototype && prototype !== null) {
        return null;
      }
      let matchCount = 0;
      for (const tag of queryTags) {
        const descriptor = Object.getOwnPropertyDescriptor(tags, tag);
        if (descriptor !== undefined) {
          if (!("value" in descriptor)) {
            return null;
          }
          if (descriptor.value) {
            matchCount += 1;
          }
        }
      }
      matchCounts.set(tags, matchCount);
      uniqueTagObjects += 1;
    }
  } catch {
    return null;
  }
  return Object.freeze({
    queryTags: Object.freeze([...queryTags]),
    matchCounts,
    uniqueTagObjects,
  });
}

function incrementEnemySelectorAngerStat(
  stats: KDEnemySelectorAngerCacheStats | undefined,
  key: keyof KDEnemySelectorAngerCacheStats,
  amount = 1,
): void {
  try {
    if (stats !== undefined && typeof stats[key] === "number") {
      stats[key] += amount;
    }
  } catch {
    // Developer-only counters must never affect enemy selection.
  }
}

function incrementEnemySelectorLongTagStat(
  stats: KDEnemySelectorLongTagCacheStats | undefined,
  key: keyof KDEnemySelectorLongTagCacheStats,
  amount = 1,
): void {
  try {
    if (stats !== undefined && typeof stats[key] === "number") {
      stats[key] += amount;
    }
  } catch {
    // Developer-only counters must never affect enemy selection.
  }
}

function incrementEnemySelectorWeightedQueryStat(
  stats: KDEnemySelectorWeightedQueryCacheStats | undefined,
  key: keyof KDEnemySelectorWeightedQueryCacheStats,
  amount = 1,
): void {
  try {
    if (stats !== undefined && typeof stats[key] === "number") {
      stats[key] += amount;
    }
  } catch {
    // Developer-only counters must never affect enemy selection.
  }
}

/**
 * Keeps KD's position cache live during one enemy-update batch.
 *
 * KD invalidates and fully rebuilds its position, ID, and event maps after
 * ordinary movement even though only two position keys changed. This handler
 * gives the update a fresh position-map generation, applies safe moves to that
 * map, and advances an explicit generation token for the dense adapters.
 * Structural changes, active movement events, bullets, effect-tile callbacks,
 * changed dependencies, and unsupported shapes stay on KD's official path.
 */
export function createKDEnemyUpdateCacheHandler(
  environment: KDEnemyUpdateCacheEnvironment = createBrowserEnemyUpdateCacheEnvironment(),
): (...args: unknown[]) => CompletedJavaScriptCall | NativeFallbackRequest {
  let transaction: { moved: boolean } | null = null;
  let riskTick: unknown;
  let riskEntities: readonly KDEnemyUpdateEntity[] | undefined;
  let riskEntityCount = -1;
  let cachedRiskReasons: readonly string[] = [];

  const riskReasons = (map: KDEnemyUpdateMapData): readonly string[] => {
    if (
      Object.is(riskTick, environment.currentTick()) &&
      riskEntities === map.Entities &&
      riskEntityCount === map.Entities.length
    ) {
      return cachedRiskReasons;
    }
    const reasons = environment.eventRiskReasons(map.Entities);
    riskTick = environment.currentTick();
    riskEntities = map.Entities;
    riskEntityCount = map.Entities.length;
    cachedRiskReasons = reasons;
    return reasons;
  };

  const moveCandidate = function (this: unknown, ...args: unknown[]): unknown {
    const active = transaction;
    const map = environment.mapData();
    const enemy =
      typeof args[0] === "object" && args[0] !== null
        ? (args[0] as KDEnemyUpdateEntity)
        : undefined;
    const mapArgument = args[8];
    const usesMainMap = !mapArgument || mapArgument === map;
    const oldX = enemy?.x;
    const oldY = enemy?.y;
    const cache = environment.currentEnemyCache();
    const entities = map?.Entities;
    const entityCount = entities?.length ?? -1;
    const noEvent = Boolean(args[7]);
    let effectRisk = false;
    let bulletRisk = false;
    if (active !== null && map !== undefined && usesMainMap && !noEvent) {
      const effectTiles =
        map.EffectTiles?.[`${String(args[1])},${String(args[2])}`];
      if (effectTiles !== undefined) {
        for (const tile of Object.values(effectTiles)) {
          if (
            tile !== undefined &&
            Number(tile.duration) > 0 &&
            environment.effectMoveHandler(tile.name) !== undefined
          ) {
            effectRisk = true;
            break;
          }
        }
      }
      bulletRisk = (map.Bullets?.length ?? 0) > 0;
    }
    const eligible =
      active !== null &&
      map !== undefined &&
      entities !== undefined &&
      enemy !== undefined &&
      usesMainMap &&
      !effectRisk &&
      !bulletRisk &&
      !environment.cacheDirty() &&
      cache instanceof Map &&
      Number.isSafeInteger(oldX) &&
      Number.isSafeInteger(oldY);

    const result = environment.moveEntity(this, args);
    const newX = enemy?.x;
    const newY = enemy?.y;
    if (newX === oldX && newY === oldY) {
      return result;
    }
    if (
      !eligible ||
      map !== environment.mapData() ||
      entities !== map.Entities ||
      map.Entities.length !== entityCount ||
      environment.currentEnemyCache() !== cache ||
      !Number.isSafeInteger(newX) ||
      !Number.isSafeInteger(newY)
    ) {
      environment.record?.("unsafe-move", {
        effectRisk,
        bulletRisk,
      });
      return result;
    }

    try {
      const oldKey = `${oldX},${oldY}`;
      const newKey = `${newX},${newY}`;
      const requiresScan =
        cache.size !== entityCount ||
        cache.get(oldKey) !== enemy ||
        cache.has(newKey);
      if (requiresScan) {
        cache.delete(oldKey);
        if (newKey !== oldKey) cache.delete(newKey);
        for (const candidate of entities) {
          const key = `${candidate.x},${candidate.y}`;
          if (key === oldKey || key === newKey) {
            cache.set(key, candidate);
          }
        }
        environment.record?.("scanned-move");
      } else {
        cache.delete(oldKey);
        cache.set(newKey, enemy);
        environment.record?.("fast-move");
      }
      environment.setCacheDirty(false);
      active.moved = true;
      environment.advanceCacheGeneration(cache, [
        { x: oldX as number, y: oldY as number },
        { x: newX as number, y: newY as number },
      ]);
    } catch {
      // The official move already happened. Never run it twice; force KD's
      // complete cache rebuild before the next lookup instead.
      environment.setCacheDirty(true);
      environment.record?.("unsafe-move", {
        reason: "incremental-update-failed",
      });
    }
    return result;
  };

  return function (
    this: unknown,
    ...args: unknown[]
  ): CompletedJavaScriptCall | NativeFallbackRequest {
    if (
      transaction !== null ||
      !environment.compatible() ||
      environment.moveFunction() === undefined
    ) {
      environment.record?.("fallback", {
        reason: transaction !== null ? "nested-update" : "dependency-changed",
      });
      return useJavaScriptFallback();
    }
    const map = environment.mapData();
    if (map === undefined) {
      environment.record?.("fallback", { reason: "missing-map" });
      return useJavaScriptFallback();
    }
    let reasons: readonly string[];
    try {
      reasons = riskReasons(map);
    } catch {
      environment.record?.("fallback", { reason: "risk-check-failed" });
      return useJavaScriptFallback();
    }
    if (reasons.length > 0) {
      environment.record?.("fallback", {
        reason: "active-movement-events",
        reasons,
      });
      return useJavaScriptFallback();
    }

    let baseCache: KDMutableEnemyPositionCache | undefined;
    let workingCache: KDMutableEnemyPositionCache;
    try {
      baseCache = environment.enemyCache();
      if (!(baseCache instanceof Map)) {
        environment.record?.("fallback", {
          reason: "unsupported-cache",
        });
        return useJavaScriptFallback();
      }
      workingCache = new Map(baseCache) as KDMutableEnemyPositionCache;
    } catch {
      environment.record?.("fallback", { reason: "cache-copy-failed" });
      return useJavaScriptFallback();
    }

    const officialMove = environment.moveFunction()!;
    try {
      environment.replaceEnemyCache(workingCache);
      environment.setCacheDirty(false);
      environment.advanceCacheGeneration(workingCache, []);
      transaction = { moved: false };
      environment.replaceMoveFunction(moveCandidate);
      if (environment.moveFunction() !== moveCandidate) {
        throw new TypeError("KDMoveEntity replacement did not stick");
      }
      environment.record?.("working-copy");
    } catch {
      transaction = null;
      try {
        if (environment.moveFunction() === moveCandidate) {
          environment.replaceMoveFunction(officialMove);
        }
        if (environment.currentEnemyCache() === workingCache) {
          environment.replaceEnemyCache(baseCache);
          environment.setCacheDirty(false);
          environment.advanceCacheGeneration(baseCache, []);
        }
      } catch {
        // Reconciliation will disable the facade if a mod took ownership.
      }
      environment.record?.("fallback", { reason: "setup-failed" });
      return useJavaScriptFallback();
    }

    environment.record?.("optimized-update");
    return completeJavaScriptCall(() => {
      try {
        return environment.updateEnemies(this, args);
      } finally {
        const moved = transaction?.moved === true;
        transaction = null;
        if (environment.moveFunction() === moveCandidate) {
          environment.replaceMoveFunction(officialMove);
        }
        if (moved) {
          environment.setCacheDirty(true);
        } else if (
          environment.currentEnemyCache() === workingCache &&
          !environment.cacheDirty()
        ) {
          environment.replaceEnemyCache(baseCache);
          environment.advanceCacheGeneration(baseCache, []);
        }
      }
    });
  };
}

export function installKDEnemyUpdateCacheAdapter(
  runtime: KDHybridRuntime,
  environment?: KDEnemyUpdateCacheEnvironment,
): SystemStatus | null {
  const target = globalThis as Record<string, unknown>;
  if (
    typeof target.KinkyDungeonUpdateEnemies !== "function" ||
    typeof target.KDMoveEntity !== "function" ||
    typeof target.KDGetEnemyCache !== "function"
  ) {
    return null;
  }
  let cacheEnvironment: KDEnemyUpdateCacheEnvironment;
  try {
    cacheEnvironment =
      environment ?? createBrowserEnemyUpdateCacheEnvironment();
  } catch {
    return null;
  }
  return runtime.registerKnownAdapter(
    "KinkyDungeonUpdateEnemies",
    createKDEnemyUpdateCacheHandler(cacheEnvironment),
  );
}

export async function waitForKDEnemyUpdateCacheAdapter(
  runtime: KDHybridRuntime,
  timeoutMs = 15_000,
  pollMs = 50,
  environment?: KDEnemyUpdateCacheEnvironment,
): Promise<SystemStatus | null> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    const status = installKDEnemyUpdateCacheAdapter(runtime, environment);
    if (status !== null) {
      return status;
    }
    await delay(Math.max(1, pollMs));
  } while (Date.now() <= deadline);
  return null;
}

/**
 * KD 5.4.92 builds a complete list of distant key locations before checking
 * whether the map already contains KDMaxKeys keyrings. In that full-key case
 * the official function has no observable vanilla result, so avoid the map
 * scan and fall back for every case that can still place a key.
 */
export function createKDJailKeyEarlyReturnHandler(
  environment: KDJailKeyEarlyReturnEnvironment,
): (...args: unknown[]) => CompletedJavaScriptCall | NativeFallbackRequest {
  return function jailKeyEarlyReturnHandler() {
    try {
      if (!environment.compatible()) {
        environment.record?.("fallback", { reason: "dependency-changed" });
        return useJavaScriptFallback();
      }
      const groundItems = environment.groundItems();
      const maxKeys = environment.maxKeys();
      if (
        !Array.isArray(groundItems) ||
        typeof maxKeys !== "number" ||
        !Number.isSafeInteger(maxKeys) ||
        maxKeys < 0
      ) {
        environment.record?.("fallback", { reason: "invalid-live-state" });
        return useJavaScriptFallback();
      }
      if (maxKeys === 0) {
        environment.record?.("skipped-scan");
        return completeJavaScriptCall(() => undefined);
      }
      let keyCount = 0;
      for (const item of groundItems) {
        if (item?.name === "Keyring") {
          keyCount += 1;
          if (keyCount >= maxKeys) {
            environment.record?.("skipped-scan");
            return completeJavaScriptCall(() => undefined);
          }
        }
      }
    } catch {
      environment.record?.("fallback", { reason: "state-access-failed" });
      return useJavaScriptFallback();
    }
    environment.record?.("fallback", { reason: "missing-keyrings" });
    return useJavaScriptFallback();
  };
}

export function installKDJailKeyEarlyReturnAdapter(
  runtime: KDHybridRuntime,
  environment?: KDJailKeyEarlyReturnEnvironment,
): SystemStatus | null {
  const target = globalThis as Record<string, unknown>;
  if (typeof target.KinkyDungeonPlaceJailKeys !== "function") {
    return null;
  }
  let jailKeyEnvironment: KDJailKeyEarlyReturnEnvironment;
  try {
    jailKeyEnvironment =
      environment ?? createBrowserJailKeyEarlyReturnEnvironment();
  } catch {
    return null;
  }
  return runtime.registerKnownAdapter(
    "KinkyDungeonPlaceJailKeys",
    createKDJailKeyEarlyReturnHandler(jailKeyEnvironment),
  );
}

export async function waitForKDJailKeyEarlyReturnAdapter(
  runtime: KDHybridRuntime,
  timeoutMs = 15_000,
  pollMs = 50,
  environment?: KDJailKeyEarlyReturnEnvironment,
): Promise<SystemStatus | null> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    const status = installKDJailKeyEarlyReturnAdapter(runtime, environment);
    if (status !== null) {
      return status;
    }
    await delay(Math.max(1, pollMs));
  } while (Date.now() <= deadline);
  return null;
}

/**
 * Replaces KD's string-keyed spatial lookups with a dense, generation-scoped
 * index. The returned values are the original entity objects in KD's original
 * iteration order; hostility remains JavaScript/mod-visible.
 */
export function createKDNearbyEnemiesHandler(
  environment: KDNearbyEnemiesEnvironment = createBrowserNearbyEnvironment(),
): (...args: unknown[]) => NearbyAdapterResult {
  let loadedCache: KDEnemyPositionCache | null = null;
  let loadedGeneration: unknown;
  let loadedWidth = 0;
  let loadedHeight = 0;
  let denseEntities: (KDNearbyEnemy | undefined)[] = [];
  const offsetTemplates = [
    new Map<number, NearbyOffsetTemplate>(),
    new Map<number, NearbyOffsetTemplate>(),
  ] as const;

  return (
    xArgument?: unknown,
    yArgument?: unknown,
    distanceArgument?: unknown,
    hostileEnemy?: unknown,
    chebyshevArgument?: unknown,
    nonhostileEnemy?: unknown,
  ): NearbyAdapterResult => {
    const x = safeInteger(xArgument);
    const y = safeInteger(yArgument);
    const distance = finiteNonnegative(distanceArgument);
    if (x === null || y === null || distance === null) {
      return useJavaScriptFallback();
    }
    if (environment.compatible?.() === false) {
      return useJavaScriptFallback();
    }
    const map = environment.mapData();
    const entities = map?.Entities;
    if (
      map === undefined ||
      entities === undefined ||
      !validDimensions(map.GridWidth, map.GridHeight)
    ) {
      return useJavaScriptFallback();
    }

    const chebyshev = Boolean(chebyshevArgument);
    const cache = environment.enemyCache();
    if (cache === undefined || 3 * distance * distance > entities.length) {
      return scanNearbyEntities(
        entities,
        x,
        y,
        distance,
        hostileEnemy,
        chebyshev,
        nonhostileEnemy,
        environment,
      );
    }
    const generation = environment.enemyCacheGeneration?.();

    const cacheChanged = cache !== loadedCache;
    const dimensionsChanged =
      map.GridWidth !== loadedWidth || map.GridHeight !== loadedHeight;
    const generationChanged = generation !== loadedGeneration;
    let patchedGeneration = false;
    if (!cacheChanged && !dimensionsChanged && generationChanged) {
      let changes: readonly KDEnemyCacheCellChange[] | undefined;
      try {
        changes = environment.enemyCacheChanges?.(
          cache,
          loadedGeneration,
          generation,
        );
      } catch {
        changes = undefined;
      }
      if (
        changes !== undefined &&
        changes.length < entities.length &&
        patchDenseEnemyIndex(
          denseEntities,
          cache,
          map.GridWidth,
          map.GridHeight,
          changes,
        )
      ) {
        loadedGeneration = generation;
        patchedGeneration = true;
      }
    }

    if (
      cacheChanged ||
      dimensionsChanged ||
      (generationChanged && !patchedGeneration)
    ) {
      const dense = buildDenseEnemyIndex(
        entities,
        cache,
        map.GridWidth,
        map.GridHeight,
      );
      if (dense === null) {
        return useJavaScriptFallback();
      }
      loadedCache = cache;
      loadedGeneration = generation;
      loadedWidth = map.GridWidth;
      loadedHeight = map.GridHeight;
      denseEntities = dense;
    }

    return queryDenseEnemyIndex(
      denseEntities,
      loadedWidth,
      loadedHeight,
      x,
      y,
      hostileEnemy,
      chebyshev,
      nonhostileEnemy,
      environment,
      nearbyOffsetTemplate(distance, chebyshev, offsetTemplates),
    );
  };
}

export function installKDNearbyEnemiesAdapter(
  runtime: KDHybridRuntime,
  environment?: KDNearbyEnemiesEnvironment,
): SystemStatus | null {
  const target = globalThis as Record<string, unknown>;
  if (
    typeof target.KDNearbyEnemies !== "function" ||
    typeof target.KDGetEnemyCache !== "function" ||
    typeof target.KDHostile !== "function"
  ) {
    return null;
  }
  return runtime.registerKnownAdapter(
    "KDNearbyEnemies",
    createKDNearbyEnemiesHandler(
      environment ?? createBrowserNearbyEnvironment(),
    ),
  );
}

export async function waitForKDNearbyEnemiesAdapter(
  runtime: KDHybridRuntime,
  timeoutMs = 15_000,
  pollMs = 50,
  environment?: KDNearbyEnemiesEnvironment,
): Promise<SystemStatus | null> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    const status = installKDNearbyEnemiesAdapter(runtime, environment);
    if (status !== null) {
      return status;
    }
    await delay(Math.max(1, pollMs));
  } while (Date.now() <= deadline);
  return null;
}

/**
 * Fuses KD's implicit-master neighborhood query with its rank selection.
 *
 * Exact KD 5.4.92 dependencies are required because the optimized order rejects
 * candidates by pure rank/leader data before calling faction and hostility
 * helpers. Unsupported or modded behavior remains on the captured JavaScript
 * implementation for that call.
 */
export function createKDFindMasterHandler(
  environment: KDFindMasterEnvironment = createBrowserFindMasterEnvironment(),
): (enemy?: unknown) => FindMasterAdapterResult {
  let loadedCache: KDEnemyPositionCache | null = null;
  let loadedGeneration: unknown;
  let loadedWidth = 0;
  let loadedHeight = 0;
  let denseEntities: (KDFindMasterEnemy | undefined)[] = [];
  const offsets: number[] = [];
  for (let dx = -4; dx < 4; dx += 1) {
    for (let dy = -4; dy < 4; dy += 1) {
      offsets.push(dx, dy);
    }
  }
  let linearWidth = 0;
  let linearOffsets: readonly number[] = [];

  return (enemyArgument?: unknown): FindMasterAdapterResult => {
    if (
      environment.compatible() === false ||
      typeof enemyArgument !== "object" ||
      enemyArgument === null
    ) {
      environment.record?.("fallback");
      return useJavaScriptFallback();
    }
    const enemy = enemyArgument as KDFindMasterEnemy;
    if (
      enemy.master ||
      enemy.Enemy?.master ||
      environment.entityHasFlag(enemy, "led")
    ) {
      environment.record?.("fallback");
      return useJavaScriptFallback();
    }
    const map = environment.mapData();
    const entities = map?.Entities as readonly KDFindMasterEnemy[] | undefined;
    if (
      map === undefined ||
      entities === undefined ||
      !validDimensions(map.GridWidth, map.GridHeight) ||
      !Number.isSafeInteger(enemy.x) ||
      !Number.isSafeInteger(enemy.y) ||
      48 > entities.length
    ) {
      environment.record?.("fallback");
      return useJavaScriptFallback();
    }
    const cache = environment.enemyCache();
    if (cache === undefined) {
      environment.record?.("fallback");
      return useJavaScriptFallback();
    }
    const generation = environment.enemyCacheGeneration?.();
    const cacheChanged = cache !== loadedCache;
    const dimensionsChanged =
      map.GridWidth !== loadedWidth || map.GridHeight !== loadedHeight;
    const generationChanged = generation !== loadedGeneration;
    let patchedGeneration = false;
    if (!cacheChanged && !dimensionsChanged && generationChanged) {
      let changes: readonly KDEnemyCacheCellChange[] | undefined;
      try {
        changes = environment.enemyCacheChanges?.(
          cache,
          loadedGeneration,
          generation,
        );
      } catch {
        changes = undefined;
      }
      if (
        changes !== undefined &&
        changes.length < entities.length &&
        patchDenseEnemyIndex(
          denseEntities,
          cache,
          map.GridWidth,
          map.GridHeight,
          changes,
        )
      ) {
        loadedGeneration = generation;
        patchedGeneration = true;
        environment.record?.("dense-patch");
      }
    }
    if (
      cacheChanged ||
      dimensionsChanged ||
      (generationChanged && !patchedGeneration)
    ) {
      const dense = buildDenseEnemyIndex(
        entities,
        cache,
        map.GridWidth,
        map.GridHeight,
      ) as (KDFindMasterEnemy | undefined)[] | null;
      if (dense === null) {
        environment.record?.("fallback");
        return useJavaScriptFallback();
      }
      loadedCache = cache;
      loadedGeneration = generation;
      loadedWidth = map.GridWidth;
      loadedHeight = map.GridHeight;
      denseEntities = dense;
      environment.record?.("dense-build");
    }
    if (linearWidth !== loadedWidth) {
      const replacement = new Array<number>(offsets.length / 2);
      for (let index = 0; index < offsets.length; index += 2) {
        replacement[index / 2] =
          offsets[index]! + offsets[index + 1]! * loadedWidth;
      }
      linearWidth = loadedWidth;
      linearOffsets = replacement;
    }

    environment.record?.("optimized");
    const enemyRank = environment.enemyRank(enemy);
    let factionKnown = false;
    let enemyFaction: unknown;
    let closestMaster: KDFindMasterEnemy | undefined;
    let closestDistance = 5;
    const entirelyInside =
      enemy.x >= 4 &&
      enemy.y >= 4 &&
      enemy.x + 3 < loadedWidth &&
      enemy.y + 3 < loadedHeight;
    if (entirelyInside) {
      const base = enemy.x + enemy.y * loadedWidth;
      for (const offset of linearOffsets) {
        const candidate = denseEntities[base + offset];
        if (candidate === undefined) {
          continue;
        }
        let rankDifference = environment.enemyRank(candidate) - enemyRank;
        if (environment.entityHasFlag(candidate, "leader")) {
          rankDifference += 2;
        }
        if (rankDifference < 2 || environment.hostile(candidate, enemy)) {
          continue;
        }
        if (!factionKnown) {
          enemyFaction = environment.getFaction(enemy);
          factionKnown = true;
        }
        if (enemyFaction != environment.getFaction(candidate)) {
          continue;
        }
        const distance = environment.chebyshev(
          candidate.x - enemy.x,
          candidate.y - enemy.y,
        );
        if (distance < closestDistance) {
          closestMaster = candidate;
          closestDistance = distance;
        }
      }
    } else {
      for (let index = 0; index < offsets.length; index += 2) {
        const x = enemy.x + offsets[index]!;
        const y = enemy.y + offsets[index + 1]!;
        if (x < 0 || y < 0 || x >= loadedWidth || y >= loadedHeight) {
          continue;
        }
        const candidate = denseEntities[x + y * loadedWidth];
        if (candidate === undefined) {
          continue;
        }
        let rankDifference = environment.enemyRank(candidate) - enemyRank;
        if (environment.entityHasFlag(candidate, "leader")) {
          rankDifference += 2;
        }
        if (rankDifference < 2 || environment.hostile(candidate, enemy)) {
          continue;
        }
        if (!factionKnown) {
          enemyFaction = environment.getFaction(enemy);
          factionKnown = true;
        }
        if (enemyFaction != environment.getFaction(candidate)) {
          continue;
        }
        const distance = environment.chebyshev(
          candidate.x - enemy.x,
          candidate.y - enemy.y,
        );
        if (distance < closestDistance) {
          closestMaster = candidate;
          closestDistance = distance;
        }
      }
    }

    return closestMaster === undefined
      ? { master: undefined, dist: 1000, info: undefined }
      : {
          master: closestMaster,
          dist: closestDistance,
          info: undefined,
        };
  };
}

export function installKDFindMasterAdapter(
  runtime: KDHybridRuntime,
  environment?: KDFindMasterEnvironment,
): SystemStatus | null {
  const target = globalThis as Record<string, unknown>;
  if (typeof target.KinkyDungeonFindMaster !== "function") {
    return null;
  }
  return runtime.registerKnownAdapter(
    "KinkyDungeonFindMaster",
    createKDFindMasterHandler(
      environment ?? createBrowserFindMasterEnvironment(),
    ),
  );
}

export async function waitForKDFindMasterAdapter(
  runtime: KDHybridRuntime,
  timeoutMs = 15_000,
  pollMs = 50,
  environment?: KDFindMasterEnvironment,
): Promise<SystemStatus | null> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    const status = installKDFindMasterAdapter(runtime, environment);
    if (status !== null) {
      return status;
    }
    await delay(Math.max(1, pollMs));
  } while (Date.now() <= deadline);
  return null;
}

/**
 * Rejects ordinary active-map candidates by hostility before paying for KD's
 * helpless, imprisonment, faction, and silence checks.
 *
 * Reordering is limited to fully unpacked canonical enemy definitions. Packed,
 * custom, player-like, or noncanonical entities keep the exact KD 5.4.92
 * helper order. The browser environment also signature-gates every helper
 * whose work can be skipped.
 */
export function createKDNearestPlayerHandler(
  environment: KDNearestPlayerEnvironment = createBrowserNearestPlayerEnvironment(),
): (
  enemy?: unknown,
  requireVision?: unknown,
  decoy?: unknown,
  visionRadius?: unknown,
  aiData?: unknown,
) => NearestPlayerAdapterResult {
  const canonicalEnemyDefinitions = new WeakMap<
    KDNearestPlayerEnemy,
    KDNearestEnemyDefinition
  >();
  const playerBinding = environment.player;
  const gameDataBinding = environment.gameData;
  const flagsBinding = environment.flags;
  const enemyVisionRadius = environment.enemyVisionRadius;
  const checkLOS = environment.checkLOS;
  const checkPath = environment.checkPath;
  const hostile = environment.hostile;
  const getFaction = environment.getFaction;
  const factionRelation = environment.factionRelation;
  const enemyHasFlag = environment.enemyHasFlag;
  const nearbyEnemies = environment.nearbyEnemies;
  const helpless = environment.helpless;
  const imprisoned = environment.imprisoned;
  const chebyshev = environment.chebyshev;
  const visionGet = environment.visionGet;
  const allied = environment.allied;
  const inParty = environment.inParty;
  const jailGuard = environment.jailGuard;
  const setFlag = environment.setFlag;
  const getEnemyByName = environment.getEnemyByName;
  const compatible = environment.compatible;
  const record = environment.record;

  return function nearestPlayerHandler(
    enemyArgument?: unknown,
    _requireVision?: unknown,
    decoyArgument?: unknown,
    visionRadiusArgument?: unknown,
    _aiData?: unknown,
  ): NearestPlayerAdapterResult {
    if (!compatible()) {
      record?.("fallback");
      return useJavaScriptFallback();
    }
    const player = playerBinding();
    if (player === undefined) {
      record?.("fallback");
      return useJavaScriptFallback();
    }
    const enemy =
      (typeof enemyArgument === "object" && enemyArgument !== null) ||
      typeof enemyArgument === "function"
        ? (enemyArgument as KDNearestPlayerEnemy)
        : undefined;
    const enemyDefinition = enemy?.Enemy;

    // KD also uses this helper with plain map coordinates and no decoy. Its
    // exact branch only performs the optional vision-radius read before
    // returning the player, so it does not require a full enemy definition.
    if (!decoyArgument) {
      if (enemy !== undefined && enemyDefinition && !visionRadiusArgument) {
        let unusedVisionRadius = enemyVisionRadius(enemy);
        if (enemy.blind && !enemy.aware) {
          unusedVisionRadius = 1.5;
        }
        void unusedVisionRadius;
      }
      record?.("optimized");
      return player;
    }

    const gameData = gameDataBinding();
    const flags = flagsBinding();
    if (
      enemy === undefined ||
      enemyDefinition === undefined ||
      !Number.isFinite(enemy.x) ||
      !Number.isFinite(enemy.y) ||
      !Number.isFinite(player.x) ||
      !Number.isFinite(player.y) ||
      gameData === undefined ||
      flags === undefined ||
      !(
        visionRadiusArgument === undefined ||
        visionRadiusArgument === null ||
        (typeof visionRadiusArgument === "number" &&
          Number.isFinite(visionRadiusArgument) &&
          visionRadiusArgument >= 0)
      )
    ) {
      record?.("fallback");
      return useJavaScriptFallback();
    }

    record?.("optimized");
    let visionRadius = visionRadiusArgument as number | null | undefined;
    if (!visionRadius) {
      visionRadius = enemyVisionRadius(enemy);
      if (enemy.blind && !enemy.aware) {
        visionRadius = 1.5;
      }
    }
    if (decoyArgument) {
      let playerDistance = Math.sqrt(
        (player.x - enemy.x) * (player.x - enemy.x) +
          (player.y - enemy.y) * (player.y - enemy.y),
      );
      let nearestVisible: KDNearestPlayerEnemy | undefined;
      if (
        enemyDefinition.focusPlayer &&
        checkLOS(enemy, player, playerDistance, visionRadius, false, false) &&
        !checkPath(enemy.x, enemy.y, player.x, player.y, false, true)
      ) {
        playerDistance = 1.5;
      }
      const enemyIsHostile = hostile(enemy);
      let nearestDistance = enemyIsHostile ? playerDistance - 0.1 : 100_000;
      const enemyFaction = getFaction(enemy);
      if (
        enemyFaction == "Player" &&
        (enemyHasFlag(enemy, "NoFollow") || enemyHasFlag(enemy, "StayHere"))
      ) {
        nearestDistance = 100_000;
      }
      if (
        (enemyDefinition.visionRadius || enemyDefinition.blindSight) &&
        !(enemyDefinition.noAttack && !enemyDefinition.spells)
      ) {
        const entities = nearbyEnemies(
          enemy.x,
          enemy.y,
          Math.min(nearestDistance, visionRadius),
          undefined,
          true,
        );
        for (const candidate of entities) {
          if (candidate == enemy) {
            continue;
          }

          let commonFiltersComplete = false;
          const definition = candidate.Enemy;
          let canonicalDefinition =
            Boolean(definition?.maxhp) &&
            !candidate.player &&
            canonicalEnemyDefinitions.get(candidate) === definition;
          if (
            !canonicalDefinition &&
            definition?.maxhp &&
            !candidate.player &&
            getEnemyByName(definition.name || definition) === definition
          ) {
            canonicalEnemyDefinitions.set(candidate, definition);
            canonicalDefinition = true;
          }
          if (canonicalDefinition && definition !== undefined) {
            if (
              definition.noAttack ||
              !canonicalTargetHostile(
                enemy,
                candidate,
                enemyFaction,
                getFaction,
                factionRelation,
              )
            ) {
              continue;
            }
            record?.("inline-hostile");
            if (helpless(candidate) || imprisoned(candidate)) {
              continue;
            }
          } else {
            record?.("guarded-order");
            if (helpless(candidate) || imprisoned(candidate)) {
              continue;
            }
            if (getFaction(candidate) == "Natural") {
              continue;
            }
            if (
              enemyDefinition.noTargetSilenced &&
              Number(candidate.silence) > 0
            ) {
              continue;
            }
            commonFiltersComplete = true;
            if (
              definition === undefined ||
              definition.noAttack ||
              !hostile(enemy, candidate)
            ) {
              continue;
            }
          }
          if (!commonFiltersComplete) {
            if (getFaction(candidate) == "Natural") {
              continue;
            }
            if (
              enemyDefinition.noTargetSilenced &&
              Number(candidate.silence) > 0
            ) {
              continue;
            }
          }
          if (
            definition?.tags?.scenery &&
            allied(enemy) &&
            !enemyHasFlag(candidate, "targetedForAttack")
          ) {
            continue;
          }
          let distance = Math.sqrt(
            (candidate.x - enemy.x) * (candidate.x - enemy.x) +
              (candidate.y - enemy.y) * (candidate.y - enemy.y),
          );
          const playerCandidateDistance =
            enemyFaction == "Player" &&
            !enemyHasFlag(enemy, "NoFollow") &&
            !enemyHasFlag(enemy, "StayHere") &&
            (enemyDefinition.allied ||
              inParty(enemy) ||
              !gameData.PrisonerState ||
              gameData.PrisonerState == "chase")
              ? chebyshev(candidate.x - player.x, candidate.y - player.y)
              : -1;
          if (
            playerCandidateDistance > 0 &&
            playerCandidateDistance < 1.5 &&
            enemyIsHostile
          ) {
            setFlag("AIHelpPlayer", 4);
          }
          if (
            playerCandidateDistance > 0 &&
            flags.get("AIHelpPlayer") &&
            distance > 2.5
          ) {
            if (playerCandidateDistance > 2.5) {
              distance += 2;
            } else {
              distance = Math.max(1.01 + distance / 4, distance / 3);
            }
          }
          if (
            distance <= nearestDistance &&
            (playerCandidateDistance <= 0 ||
              ((visionGet(candidate.x, candidate.y) > 0 ||
                playerCandidateDistance < 5 ||
                candidate == jailGuard() ||
                enemy == jailGuard()) &&
                (playerCandidateDistance < 8 ||
                  Number(enemyDefinition.followRange) > 1)))
          ) {
            if (
              checkLOS(enemy, candidate, distance, visionRadius, true, true) &&
              (visionGet(candidate.x, candidate.y) > 0 ||
                visionGet(enemy.x, enemy.y) > 0 ||
                candidate.aware ||
                enemy.aware ||
                candidate == jailGuard() ||
                enemy == jailGuard())
            ) {
              if (
                enemy.rage ||
                !definition?.lowpriority ||
                (enemy.gx == candidate.x && enemy.gy == candidate.y) ||
                !checkLOS(
                  enemy,
                  player,
                  playerDistance,
                  visionRadius,
                  true,
                  true,
                ) ||
                !checkPath(enemy.x, enemy.y, player.x, player.y, false, true)
              ) {
                nearestVisible = candidate;
                nearestDistance = distance;
              }
            }
          }
        }
      }
      if (nearestVisible !== undefined) {
        return nearestVisible;
      }
    }
    return player;
  };
}

/**
 * Exact KD 5.4.92 `KDHostile(subject, candidate)` arithmetic for the
 * canonical, non-player target shape admitted by the nearest-player guard.
 *
 * `KDOpinionRepMod(subject, candidate)` is exactly zero for that shape. The
 * subject faction was already read by the upstream target-selection order, so
 * reusing it removes nested faction lookups without introducing a new cache
 * lifetime.
 */
function canonicalTargetHostile(
  subject: KDNearestPlayerEnemy,
  candidate: KDNearestPlayerEnemy,
  subjectFaction: unknown,
  getFaction: (enemy: KDNearestPlayerEnemy) => unknown,
  factionRelation: (left: unknown, right: unknown) => number,
): boolean {
  if ((subject.rage as number) > 0) {
    return true;
  }
  if ((candidate.ceasefire as number) > 0) {
    return false;
  }

  const candidateFaction = getFaction(candidate);
  if (candidateFaction == "Player" && (subject.hostile as number) > 0) {
    return true;
  }
  if (subjectFaction == "Player" && (candidate.hostile as number) > 0) {
    return true;
  }
  if ((candidate.rage as number) > 0) {
    return true;
  }
  if (subjectFaction == "Player" && (candidate.allied as number) > 0) {
    return false;
  }
  if (
    subjectFaction == "Rage" ||
    candidateFaction == "Rage" ||
    (subjectFaction == "Player" && candidateFaction == "Enemy") ||
    (candidateFaction == "Player" && subjectFaction == "Enemy")
  ) {
    return true;
  }
  return factionRelation(subjectFaction, candidateFaction) <= -0.5;
}

export function installKDNearestPlayerAdapter(
  runtime: KDHybridRuntime,
  environment?: KDNearestPlayerEnvironment,
): SystemStatus | null {
  const target = globalThis as Record<string, unknown>;
  if (typeof target.KinkyDungeonNearestPlayer !== "function") {
    return null;
  }
  let nearestEnvironment: KDNearestPlayerEnvironment;
  try {
    nearestEnvironment = environment ?? createBrowserNearestPlayerEnvironment();
  } catch {
    return null;
  }
  return runtime.registerKnownAdapter(
    "KinkyDungeonNearestPlayer",
    createKDNearestPlayerHandler(nearestEnvironment),
  );
}

export async function waitForKDNearestPlayerAdapter(
  runtime: KDHybridRuntime,
  timeoutMs = 15_000,
  pollMs = 50,
  environment?: KDNearestPlayerEnvironment,
): Promise<SystemStatus | null> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    const status = installKDNearestPlayerAdapter(runtime, environment);
    if (status !== null) {
      return status;
    }
    await delay(Math.max(1, pollMs));
  } while (Date.now() <= deadline);
  return null;
}

/**
 * Skips KD's two rescue-order scans only when a conservative map-wide pass
 * proves that no entity can satisfy their target-only requirements.
 *
 * If either category has a possible target, its exact upstream filter runs.
 * Events and known state mutators invalidate the proof before later enemies
 * are classified, so synchronous mod callbacks remain visible.
 */
export function createKDCommanderHelpShortcutHandler(
  officialRoleUpdate: (...args: unknown[]) => unknown,
  environment: KDCommanderHelpEnvironment,
): (...args: unknown[]) => CompletedJavaScriptCall | NativeFallbackRequest {
  let active = false;

  return function commanderHelpShortcutHandler(
    this: unknown,
    ...args: unknown[]
  ): CompletedJavaScriptCall | NativeFallbackRequest {
    const data = args[0] as { readonly delta?: unknown } | undefined;
    if (active || !(Number(data?.delta) > 0) || !environment.compatible()) {
      return useJavaScriptFallback();
    }

    const orders = environment.orders();
    const struggleOrder = orders?.helpStruggle;
    const dangerOrder = orders?.helpDanger;
    const officialStruggleFilter = struggleOrder?.filter;
    const officialDangerFilter = dangerOrder?.filter;
    if (
      struggleOrder === undefined ||
      dangerOrder === undefined ||
      typeof officialStruggleFilter !== "function" ||
      typeof officialDangerFilter !== "function"
    ) {
      return useJavaScriptFallback();
    }

    let dirty = true;
    let shortcutDisabled = false;
    let refreshScans = 0;
    let hasStrugglePotential = true;
    let hasDangerPotential = true;
    const markDirty = (): void => {
      dirty = true;
    };
    const stopObserving = environment.observeMutations(markDirty);
    if (stopObserving === null) {
      return useJavaScriptFallback();
    }

    const refreshPotentials = (): void => {
      if (!dirty || shortcutDisabled) {
        return;
      }
      if (refreshScans >= MAX_COMMANDER_HELP_REFRESH_SCANS) {
        shortcutDisabled = true;
        environment.record?.("scan-budget-fallback", {
          refreshScans,
        });
        return;
      }
      refreshScans += 1;
      const map = environment.mapData();
      const entities = map?.Entities as
        readonly KDCommanderEntity[] | undefined;
      const movableTiles = environment.movableEnemyTiles();
      if (
        map === undefined ||
        entities === undefined ||
        movableTiles === undefined
      ) {
        shortcutDisabled = true;
        return;
      }

      hasStrugglePotential = false;
      hasDangerPotential = false;
      try {
        for (const entity of entities) {
          if (!hasStrugglePotential) {
            hasStrugglePotential =
              environment.boundEffects(entity) > 1 &&
              !environment.imprisoned(entity) &&
              !environment.tileDangerous(entity, entity.x, entity.y, map);
          }
          if (
            !hasDangerPotential &&
            environment.disabled(entity) &&
            !environment.imprisoned(entity) &&
            environment.tileDangerous(entity, entity.x, entity.y, map)
          ) {
            hasDangerPotential = environment
              .nearbyMapTiles(entity.x, entity.y, 1.5)
              .some(
                (tile) =>
                  (tile.x !== entity.x || tile.y !== entity.y) &&
                  !environment.entityAt(tile.x, tile.y) &&
                  movableTiles.includes(tile.tile) &&
                  !environment.tileDangerous(entity, tile.x, tile.y, map),
              );
          }
          if (hasStrugglePotential && hasDangerPotential) {
            break;
          }
        }
        dirty = false;
        environment.record?.("scan", {
          entities: entities.length,
          hasStrugglePotential,
          hasDangerPotential,
        });
      } catch {
        // A custom map accessor or event hook must never make the optimized
        // facade less reliable than the exact upstream filter.
        shortcutDisabled = true;
      }
    };
    const struggleFilter = function (
      this: unknown,
      ...filterArgs: unknown[]
    ): unknown {
      if (dirty && !shortcutDisabled) {
        try {
          if (
            !environment.candidateMayNeedHelp(
              filterArgs[0] as KDCommanderEntity,
            )
          ) {
            environment.record?.("struggle-shortcut");
            return false;
          }
        } catch {
          shortcutDisabled = true;
        }
      }
      refreshPotentials();
      if (!shortcutDisabled && !hasStrugglePotential) {
        environment.record?.("struggle-shortcut");
        return false;
      }
      environment.record?.("struggle-fallback");
      return Reflect.apply(officialStruggleFilter, this, filterArgs);
    };
    const dangerFilter = function (
      this: unknown,
      ...filterArgs: unknown[]
    ): unknown {
      if (dirty && !shortcutDisabled) {
        try {
          if (
            !environment.candidateMayNeedHelp(
              filterArgs[0] as KDCommanderEntity,
            )
          ) {
            environment.record?.("danger-shortcut");
            return false;
          }
        } catch {
          shortcutDisabled = true;
        }
      }
      refreshPotentials();
      if (!shortcutDisabled && !hasDangerPotential) {
        environment.record?.("danger-shortcut");
        return false;
      }
      environment.record?.("danger-fallback");
      return Reflect.apply(officialDangerFilter, this, filterArgs);
    };
    active = true;
    try {
      struggleOrder.filter = struggleFilter;
      dangerOrder.filter = dangerFilter;
      if (
        struggleOrder.filter !== struggleFilter ||
        dangerOrder.filter !== dangerFilter
      ) {
        restoreCommanderFilters();
        stopObserving();
        active = false;
        return useJavaScriptFallback();
      }
    } catch {
      restoreCommanderFilters();
      stopObserving();
      active = false;
      return useJavaScriptFallback();
    }

    return completeJavaScriptCall(() => {
      try {
        return Reflect.apply(officialRoleUpdate, this, args);
      } finally {
        restoreCommanderFilters();
        stopObserving();
        active = false;
      }
    });

    function restoreCommanderFilters(): void {
      if (struggleOrder?.filter === struggleFilter) {
        struggleOrder.filter = officialStruggleFilter!;
      }
      if (dangerOrder?.filter === dangerFilter) {
        dangerOrder.filter = officialDangerFilter!;
      }
    }
  };
}

export function installKDCommanderHelpShortcutAdapter(
  runtime: KDHybridRuntime,
  environment?: KDCommanderHelpEnvironment,
): SystemStatus | null {
  const target = globalThis as Record<string, unknown>;
  const officialRoleUpdate = target.KDCommanderUpdateRoles;
  if (typeof officialRoleUpdate !== "function") {
    return null;
  }
  let commanderEnvironment: KDCommanderHelpEnvironment;
  try {
    commanderEnvironment =
      environment ?? createBrowserCommanderHelpEnvironment();
  } catch {
    return null;
  }
  return runtime.registerKnownAdapter(
    "KDCommanderUpdateRoles",
    createKDCommanderHelpShortcutHandler(
      officialRoleUpdate as (...args: unknown[]) => unknown,
      commanderEnvironment,
    ),
  );
}

export async function waitForKDCommanderHelpShortcutAdapter(
  runtime: KDHybridRuntime,
  timeoutMs = 15_000,
  pollMs = 50,
  environment?: KDCommanderHelpEnvironment,
): Promise<SystemStatus | null> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    const status = installKDCommanderHelpShortcutAdapter(runtime, environment);
    if (status !== null) {
      return status;
    }
    await delay(Math.max(1, pollMs));
  } while (Date.now() <= deadline);
  return null;
}

export function installKinkyDungeonMapGenerationAdapter(
  runtime: KDHybridRuntime,
  state: KDMapGenerationGuardState = browserMapGenerationGuard,
): SystemStatus | null {
  const target = globalThis as Record<string, unknown>;
  const official = target.KinkyDungeonCreateMap;
  if (typeof official !== "function") {
    return null;
  }
  return runtime.registerKnownAdapter(
    "KinkyDungeonCreateMap",
    createKinkyDungeonMapGenerationHandler(
      official as (...args: unknown[]) => unknown,
      state,
      {
        runWithDirectPathfindingFallback: (callback, recordActivation) => {
          let directOfficialActive = false;
          return runtime.dispatcher.withDirectOfficial(
            "KinkyDungeonFindPath",
            () => {
              const edgeIdentityEligible =
                directOfficialActive &&
                !runtime.dispatcher.hasHooks("mapGeneration") &&
                browserMapGenerationPathCacheEdgeIdentityEnabled();
              if (!edgeIdentityEligible) {
                browserRecordMapGenerationPathCacheEdgeIdentity(false);
                return callback();
              }
              return runWithKDSourcePathCacheEdgeIdentitySkip(
                callback,
                browserRecordMapGenerationPathCacheEdgeIdentity,
              );
            },
            (active) => {
              directOfficialActive = active;
              recordActivation?.(active);
            },
          );
        },
        directPathfindingFallbackEnabled:
          browserMapGenerationDirectPathfindingFallbackEnabled,
        recordDirectPathfindingFallback:
          browserRecordMapGenerationDirectPathfindingFallback,
        enemySelectorCacheEnabled: () =>
          !runtime.dispatcher.hasHooks("mapGeneration"),
      },
    ),
  );
}

export async function waitForKinkyDungeonMapGenerationAdapter(
  runtime: KDHybridRuntime,
  timeoutMs = 15_000,
  pollMs = 50,
  state: KDMapGenerationGuardState = browserMapGenerationGuard,
): Promise<SystemStatus | null> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    const status = installKinkyDungeonMapGenerationAdapter(runtime, state);
    if (status !== null) {
      return status;
    }
    await delay(Math.max(1, pollMs));
  } while (Date.now() <= deadline);
  return null;
}

export function installKDEnemySelectorAdapter(
  runtime: KDHybridRuntime,
  environment?: KDEnemySelectorEnvironment,
): SystemStatus | null {
  const target = globalThis as Record<string, unknown>;
  if (typeof target.KinkyDungeonGetEnemy !== "function") {
    return null;
  }
  let selectorEnvironment: KDEnemySelectorEnvironment;
  try {
    selectorEnvironment =
      environment ??
      createBrowserEnemySelectorEnvironment(
        () => !runtime.dispatcher.hasHooks("mapGeneration"),
      );
  } catch {
    return null;
  }
  return runtime.registerKnownAdapter(
    "KinkyDungeonGetEnemy",
    createKDEnemySelectorHandler(selectorEnvironment),
  );
}

export async function waitForKDEnemySelectorAdapter(
  runtime: KDHybridRuntime,
  timeoutMs = 15_000,
  pollMs = 50,
  environment?: KDEnemySelectorEnvironment,
): Promise<SystemStatus | null> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    const status = installKDEnemySelectorAdapter(runtime, environment);
    if (status !== null) {
      return status;
    }
    await delay(Math.max(1, pollMs));
  } while (Date.now() <= deadline);
  return null;
}

export function installKinkyDungeonPathfindingAdapter(
  runtime: KDHybridRuntime,
  environment: KDPathfindingEnvironment = browserEnvironment,
): SystemStatus | null {
  const target = globalThis as Record<string, unknown>;
  if (typeof target.KinkyDungeonFindPath !== "function") {
    return null;
  }
  return runtime.registerKnownAdapter(
    "KinkyDungeonFindPath",
    createKinkyDungeonPathfindingHandler(runtime.bridge, environment, () =>
      runtime.getPathfindingMode(),
    ),
    { directOfficialArity: 19 },
  );
}

export async function waitForKinkyDungeonPathfindingAdapter(
  runtime: KDHybridRuntime,
  timeoutMs = 15_000,
  pollMs = 50,
  environment: KDPathfindingEnvironment = browserEnvironment,
): Promise<SystemStatus | null> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    const status = installKinkyDungeonPathfindingAdapter(runtime, environment);
    if (status !== null) {
      return status;
    }
    await delay(Math.max(1, pollMs));
  } while (Date.now() <= deadline);
  return null;
}

interface GridOptions {
  readonly blockPlayer: boolean;
  readonly ignoreLocks: boolean;
  readonly requireLight: boolean;
  readonly noDoors: boolean;
  readonly needDoorMemory: boolean;
  readonly ignoreTrafficLaws: boolean;
  readonly ignoreAllWeighting: boolean;
}

interface CacheState {
  size: number;
  epoch: number;
}

interface LoadedGrid {
  readonly map: KDMapDataLike;
  readonly grid: string;
  readonly mapTiles: KDMapDataLike["Tiles"];
  readonly traffic: KDMapDataLike["Traffic"];
  readonly movableTiles: string;
  readonly options: GridOptions;
  readonly cache: KDPathCacheLike;
  readonly cacheEpoch: number;
  readonly tiles: Uint8Array;
  readonly unreachableKeys: Set<string>;
}

function encodeKinkyDungeonGrid(
  map: KDMapDataLike,
  movableTiles: string,
  options: GridOptions,
  environment: KDPathfindingEnvironment,
): Uint8Array | null {
  const allowed = options.noDoors
    ? movableTiles.replace("D", "")
    : movableTiles;
  const output = new Uint8Array(map.GridWidth * map.GridHeight);
  const mapTiles = map.Tiles ?? {};
  const tileMemory = map.TilesMemory ?? {};
  const openDoorTiles = options.needDoorMemory
    ? environment.openDoorTiles()
    : undefined;
  if (options.needDoorMemory && openDoorTiles === undefined) {
    return null;
  }
  const player = options.blockPlayer ? environment.playerPosition() : undefined;
  if (options.blockPlayer && player === undefined) {
    return null;
  }

  for (let y = 0; y < map.GridHeight; y += 1) {
    for (let x = 0; x < map.GridWidth; x += 1) {
      const index = x + y * map.GridWidth;
      const location = `${x},${y}`;
      const tile = map.Grid[x + y * (map.GridWidth + 1)];
      const metadata = mapTiles[location];
      if (tile === undefined) {
        output[index] = 1;
        continue;
      }
      let blocked =
        !allowed.includes(tile) ||
        (!options.ignoreLocks && Boolean(metadata?.Lock)) ||
        (options.blockPlayer && player?.x === x && player.y === y) ||
        (options.needDoorMemory &&
          tile === "d" &&
          !openDoorTiles?.includes(tileMemory[location]));

      if (!blocked && options.requireLight) {
        const vision = environment.visionAt(x, y);
        if (typeof vision !== "number" || !Number.isFinite(vision)) {
          return null;
        }
        blocked = vision <= 0;
      }

      if (blocked) {
        output[index] = 1;
        continue;
      }
      const weight = movementWeight(
        tile,
        metadata,
        map.Traffic?.[y]?.[x],
        location,
        options,
        environment,
      );
      if (weight === null) {
        return null;
      }
      output[index] = weight << 1;
    }
  }
  return output;
}

function observeCache(
  states: WeakMap<object, CacheState>,
  cache: KDPathCacheLike,
): number {
  const key = cache as object;
  const current = states.get(key);
  if (current === undefined) {
    states.set(key, {
      size: cache.size,
      epoch: 0,
    });
    return 0;
  }
  if (cache.size < current.size) {
    current.epoch += 1;
  }
  current.size = cache.size;
  return current.epoch;
}

function synchronizeCache(
  states: WeakMap<object, CacheState>,
  cache: KDPathCacheLike,
): void {
  const current = states.get(cache as object);
  if (current === undefined) {
    states.set(cache as object, {
      size: cache.size,
      epoch: 0,
    });
  } else {
    current.size = cache.size;
  }
}

function sameLoadedGridIdentity(
  loaded: LoadedGrid,
  map: KDMapDataLike,
  movableTiles: string,
  options: GridOptions,
  cache: KDPathCacheLike,
): boolean {
  return (
    loaded.map === map &&
    loaded.grid === map.Grid &&
    loaded.mapTiles === map.Tiles &&
    loaded.traffic === map.Traffic &&
    loaded.movableTiles === movableTiles &&
    loaded.cache === cache &&
    sameGridOptions(loaded.options, options)
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function sameGridOptions(left: GridOptions, right: GridOptions): boolean {
  return (
    left.blockPlayer === right.blockPlayer &&
    left.ignoreLocks === right.ignoreLocks &&
    left.requireLight === right.requireLight &&
    left.noDoors === right.noDoors &&
    left.needDoorMemory === right.needDoorMemory &&
    left.ignoreTrafficLaws === right.ignoreTrafficLaws &&
    left.ignoreAllWeighting === right.ignoreAllWeighting
  );
}

function setPathCache(
  cache: KDPathCacheLike,
  path: readonly Position[],
  goal: Position,
  tileShort: string,
  finalKey: string,
): void {
  for (let index = 0; index < path.length - 1; index += 1) {
    const suffix = path.slice(index);
    const first = suffix[0];
    if (first !== undefined) {
      cache.set(
        `${first.x},${first.y},${goal.x},${goal.y},${tileShort}`,
        suffix.slice(1),
      );
    }
  }
  cache.set(finalKey, path.slice());
}

function movementWeight(
  tile: string,
  metadata: KDMapTile | undefined,
  traffic: number | undefined,
  location: string,
  options: GridOptions,
  environment: KDPathfindingEnvironment,
): number | null {
  let bonus = 0;
  if (!options.ignoreTrafficLaws) {
    if (environment.effectTagsAt(location)?.danger) {
      bonus += 30;
    } else if (tile === "V" && !metadata?.Sfty) {
      bonus = 14;
    } else if (tile === "N") {
      bonus = 30;
    } else if (tile === "D") {
      bonus = 3;
    } else if (tile === "d") {
      bonus = -2;
    } else if (tile === "g" || tile === "L") {
      bonus = 9;
    } else if (tile === "T") {
      bonus = 4;
    }
    if (metadata?.Lock) {
      bonus += 2;
    }
    if (metadata?.OL) {
      bonus += 12;
    }
    if (traffic !== undefined) {
      if (typeof traffic !== "number" || !Number.isFinite(traffic)) {
        return null;
      }
      bonus += traffic || 0;
    }
    bonus = Math.max(0, bonus);
  } else if (!options.ignoreAllWeighting) {
    if (tile === "V" && !metadata?.Sfty) {
      bonus = 3;
    } else if (tile === "N") {
      bonus = 8;
    } else if (tile === "L") {
      bonus = 2;
    }
  }

  const units = bonus * 4;
  return Number.isSafeInteger(units) && units >= 0 && units <= MAX_WEIGHT_UNITS
    ? units
    : null;
}

function validatePath(
  path: readonly Position[],
  start: Position,
  goal: Position,
  tiles: Uint8Array,
  width: number,
  diagonal: boolean,
): void {
  if (
    path.length < 2 ||
    !samePosition(path[0], start) ||
    !samePosition(path.at(-1), goal)
  ) {
    throw new RangeError("Native grid path endpoints are invalid");
  }
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (previous === undefined || current === undefined) {
      throw new RangeError("Native grid path contains a missing position");
    }
    const dx = Math.abs(current.x - previous.x);
    const dy = Math.abs(current.y - previous.y);
    if (
      dx > 1 ||
      dy > 1 ||
      dx + dy === 0 ||
      (!diagonal && dx !== 0 && dy !== 0)
    ) {
      throw new RangeError("Native grid path contains a non-adjacent step");
    }
    const tile = tiles[current.x + current.y * width];
    if (
      tile === undefined ||
      ((tile & 1) !== 0 && !samePosition(current, goal))
    ) {
      throw new RangeError("Native grid path crosses a blocked tile");
    }
  }
}

function integerCoordinate(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= -0x8000 &&
    value <= 0x7fff
    ? value
    : null;
}

function safeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : null;
}

function finiteNonnegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function validDimensions(width: number, height: number): boolean {
  return (
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_DIMENSION &&
    height <= MAX_DIMENSION &&
    width * height <= MAX_TILES
  );
}

function buildDenseEnemyIndex(
  entities: readonly KDNearbyEnemy[],
  cache: KDEnemyPositionCache,
  width: number,
  height: number,
): (KDNearbyEnemy | undefined)[] | null {
  const dense = new Array<KDNearbyEnemy | undefined>(width * height);
  for (const entity of entities) {
    if (
      !Number.isSafeInteger(entity.x) ||
      !Number.isSafeInteger(entity.y) ||
      entity.x < 0 ||
      entity.y < 0 ||
      entity.x >= width ||
      entity.y >= height
    ) {
      return null;
    }
    const cached = cache.get(`${entity.x},${entity.y}`);
    if (cached !== undefined) {
      dense[entity.x + entity.y * width] = cached;
    }
  }
  return dense;
}

function patchDenseEnemyIndex(
  dense: (KDNearbyEnemy | undefined)[],
  cache: KDEnemyPositionCache,
  width: number,
  height: number,
  changes: readonly KDEnemyCacheCellChange[],
): boolean {
  if (
    dense.length !== width * height ||
    changes.length > MAX_ENEMY_CACHE_JOURNAL_CELLS
  ) {
    return false;
  }
  for (const change of changes) {
    if (
      !Number.isSafeInteger(change.x) ||
      !Number.isSafeInteger(change.y) ||
      change.x < 0 ||
      change.y < 0 ||
      change.x >= width ||
      change.y >= height
    ) {
      return false;
    }
  }
  try {
    for (const change of changes) {
      dense[change.x + change.y * width] = cache.get(`${change.x},${change.y}`);
    }
  } catch {
    return false;
  }
  return true;
}

function scanNearbyEntities(
  entities: readonly KDNearbyEnemy[],
  x: number,
  y: number,
  distance: number,
  hostileEnemy: unknown,
  chebyshev: boolean,
  nonhostileEnemy: unknown,
  environment: KDNearbyEnemiesEnvironment,
): readonly KDNearbyEnemy[] {
  const result: KDNearbyEnemy[] = [];
  const distanceSquared = distance * distance;
  for (const enemy of entities) {
    const dx = x - enemy.x;
    const dy = y - enemy.y;
    const inside = chebyshev
      ? Math.max(Math.abs(dx), Math.abs(dy)) <= distance
      : dx * dx + dy * dy <= distanceSquared;
    if (
      inside &&
      (!hostileEnemy || environment.hostile(enemy, hostileEnemy)) &&
      (!nonhostileEnemy || !environment.hostile(enemy, nonhostileEnemy))
    ) {
      result.push(enemy);
    }
  }
  return result;
}

function queryDenseEnemyIndex(
  dense: readonly (KDNearbyEnemy | undefined)[],
  width: number,
  height: number,
  x: number,
  y: number,
  hostileEnemy: unknown,
  chebyshev: boolean,
  nonhostileEnemy: unknown,
  environment: KDNearbyEnemiesEnvironment,
  template: NearbyOffsetTemplate,
): readonly KDNearbyEnemy[] {
  const result: KDNearbyEnemy[] = [];
  const offsets = template.offsets;
  if (offsets.length === 0) {
    return result;
  }
  const entirelyInside =
    x + template.minimumX >= 0 &&
    y + template.minimumY >= 0 &&
    x + template.maximumX < width &&
    y + template.maximumY < height;
  if (entirelyInside) {
    if (template.linearWidth !== width) {
      const linearOffsets = new Array<number>(offsets.length / 2);
      for (let index = 0; index < offsets.length; index += 2) {
        linearOffsets[index / 2] =
          offsets[index]! + offsets[index + 1]! * width;
      }
      template.linearWidth = width;
      template.linearOffsets = linearOffsets;
    }
    const base = x + y * width;
    if (!hostileEnemy && !nonhostileEnemy) {
      for (const offset of template.linearOffsets) {
        const enemy = dense[base + offset];
        if (enemy !== undefined) {
          result.push(enemy);
        }
      }
      return result;
    }
    if (!hostileEnemy) {
      const nonhostileTarget = chebyshev ? nonhostileEnemy : hostileEnemy;
      for (const offset of template.linearOffsets) {
        const enemy = dense[base + offset];
        if (
          enemy !== undefined &&
          !environment.hostile(enemy, nonhostileTarget)
        ) {
          result.push(enemy);
        }
      }
      return result;
    }
    if (!nonhostileEnemy) {
      for (const offset of template.linearOffsets) {
        const enemy = dense[base + offset];
        if (enemy !== undefined && environment.hostile(enemy, hostileEnemy)) {
          result.push(enemy);
        }
      }
      return result;
    }
    const nonhostileTarget = chebyshev ? nonhostileEnemy : hostileEnemy;
    for (const offset of template.linearOffsets) {
      const enemy = dense[base + offset];
      if (
        enemy !== undefined &&
        environment.hostile(enemy, hostileEnemy) &&
        !environment.hostile(enemy, nonhostileTarget)
      ) {
        result.push(enemy);
      }
    }
    return result;
  }

  for (let index = 0; index < offsets.length; index += 2) {
    const entityX = x + offsets[index]!;
    const entityY = y + offsets[index + 1]!;
    if (entityX < 0 || entityY < 0 || entityX >= width || entityY >= height) {
      continue;
    }
    const enemy = dense[entityX + entityY * width];
    if (
      enemy !== undefined &&
      (!hostileEnemy || environment.hostile(enemy, hostileEnemy)) &&
      (!nonhostileEnemy ||
        !environment.hostile(
          enemy,
          // KD 5.4.92 passes hostileEnemy here in its cached Euclidean
          // branch. Preserve that observable behavior for exact parity.
          chebyshev ? nonhostileEnemy : hostileEnemy,
        ))
    ) {
      result.push(enemy);
    }
  }
  return result;
}

function nearbyOffsetTemplate(
  distance: number,
  chebyshev: boolean,
  templates: readonly [
    Map<number, NearbyOffsetTemplate>,
    Map<number, NearbyOffsetTemplate>,
  ],
): NearbyOffsetTemplate {
  const selected = templates[chebyshev ? 1 : 0];
  const cached = selected.get(distance);
  if (cached !== undefined) {
    return cached;
  }

  const offsets: number[] = [];
  let minimumX = 0;
  let maximumX = 0;
  let minimumY = 0;
  let maximumY = 0;
  let foundOffset = false;
  const integerChebyshevRadius = chebyshev && Number.isInteger(distance);
  const distanceSquared = distance * distance;
  const minimum = Math.floor(-distance);
  const maximum = Math.ceil(distance);
  for (let dx = minimum; dx < maximum; dx += 1) {
    for (let dy = minimum; dy < maximum; dy += 1) {
      if (
        chebyshev
          ? !integerChebyshevRadius &&
            Math.max(Math.abs(dx), Math.abs(dy)) > distance
          : dx * dx + dy * dy > distanceSquared
      ) {
        continue;
      }
      offsets.push(dx, dy);
      if (!foundOffset) {
        minimumX = dx;
        maximumX = dx;
        minimumY = dy;
        maximumY = dy;
        foundOffset = true;
      } else {
        minimumX = Math.min(minimumX, dx);
        maximumX = Math.max(maximumX, dx);
        minimumY = Math.min(minimumY, dy);
        maximumY = Math.max(maximumY, dy);
      }
    }
  }

  if (selected.size >= MAX_NEARBY_OFFSET_TEMPLATES) {
    const oldest = selected.keys().next().value;
    if (oldest !== undefined) {
      selected.delete(oldest);
    }
  }
  const template = {
    offsets,
    minimumX,
    maximumX,
    minimumY,
    maximumY,
    linearWidth: 0,
    linearOffsets: [],
  };
  selected.set(distance, template);
  return template;
}

function validMap(map: KDMapDataLike): boolean {
  const { Grid: grid, GridWidth: width, GridHeight: height } = map;
  return (
    typeof grid === "string" &&
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_DIMENSION &&
    height <= MAX_DIMENSION &&
    width * height <= MAX_TILES &&
    grid.length >= (height - 1) * (width + 1) + width
  );
}

function inMap(map: KDMapDataLike, position: Position): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < map.GridWidth &&
    position.y < map.GridHeight
  );
}

function samePosition(left: Position | undefined, right: Position): boolean {
  return left?.x === right.x && left.y === right.y;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function readBinding<T>(
  lexical: () => T | undefined,
  globalName: string,
): T | undefined {
  try {
    const value = lexical();
    if (value !== undefined) {
      return value;
    }
  } catch {
    // A bootstrap loaded before KD can observe an uninitialized global lexical
    // binding. The same value may later be exposed as a global property.
  }
  return (globalThis as Record<string, unknown>)[globalName] as T | undefined;
}

function plainBonusTags(value: unknown): boolean {
  try {
    if (value === undefined || value === null) {
      return true;
    }
    if (typeof value !== "object") {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function nativeBuiltin(functionValue: Function): boolean {
  try {
    return Function.prototype.toString
      .call(functionValue)
      .includes("[native code]");
  } catch {
    return false;
  }
}

let browserTileAliases:
  | {
      readonly smartEnemy: string | undefined;
      readonly enemy: string | undefined;
      readonly ground: string | undefined;
    }
  | undefined;

function browserTileShort(movableTiles: string): string {
  browserTileAliases ??= {
    smartEnemy: readBinding(
      () => KinkyDungeonMovableTilesSmartEnemy,
      "KinkyDungeonMovableTilesSmartEnemy",
    ),
    enemy: readBinding(
      () => KinkyDungeonMovableTilesEnemy,
      "KinkyDungeonMovableTilesEnemy",
    ),
    ground: readBinding(
      () => KinkyDungeonGroundTiles,
      "KinkyDungeonGroundTiles",
    ),
  };
  if (movableTiles === browserTileAliases.smartEnemy) {
    return "TSE";
  }
  if (movableTiles === browserTileAliases.enemy) {
    return "TE";
  }
  if (movableTiles === browserTileAliases.ground) {
    return "TG";
  }
  return movableTiles;
}

function browserPathCache(ignoreLocks: boolean): KDPathCacheLike | undefined {
  try {
    const cache = ignoreLocks ? KDPathCacheIgnoreLocks : KDPathCache;
    if (cache !== undefined) {
      return cache;
    }
  } catch {
    // Fall through for loaders that expose KD state as global properties.
  }
  return (globalThis as Record<string, unknown>)[
    ignoreLocks ? "KDPathCacheIgnoreLocks" : "KDPathCache"
  ] as KDPathCacheLike | undefined;
}

function browserRecordCacheHit(): void {
  try {
    if (typeof KDPathfindingCacheHits === "number") {
      KDPathfindingCacheHits += 1;
      return;
    }
  } catch {
    // Fall through for loaders that expose KD state as global properties.
  }
  incrementGlobalNumber("KDPathfindingCacheHits");
}

function browserRecordCacheFill(): void {
  try {
    if (typeof KDPathfindingCacheFails === "number") {
      KDPathfindingCacheFails += 1;
      return;
    }
  } catch {
    // Fall through for loaders that expose KD state as global properties.
  }
  incrementGlobalNumber("KDPathfindingCacheFails");
}

function browserRecordPathfindingFallback(reason: string): void {
  const observer = (globalThis as Record<string, unknown>)[
    "__KDHybridPathfindingFallbackObserver"
  ];
  if (typeof observer === "function") {
    try {
      Reflect.apply(observer, undefined, [reason]);
    } catch {
      // Diagnostics must never change pathfinding behavior.
    }
  }
}

function browserMapGenerationDirectPathfindingFallbackEnabled(): boolean {
  return (
    globalThis.KDHybridRuntimeControl
      ?.disableMapGenerationPathfindingDirectFallback !== true
  );
}

function browserMapGenerationPathCacheEdgeIdentityEnabled(): boolean {
  return (
    globalThis.KDHybridRuntimeControl
      ?.disableMapGenerationPathCacheEdgeIdentitySkip !== true
  );
}

function browserRecordMapGenerationPathCacheEdgeIdentity(
  active: boolean,
): void {
  const stats =
    globalThis.KDHybridRuntimeControl?.mapGenerationPathCacheEdgeIdentityStats;
  if (stats === undefined) {
    return;
  }
  if (active) {
    stats.optimizedMaps += 1;
  } else {
    stats.fallbackMaps += 1;
  }
}

export function runWithKDSourcePathCacheEdgeIdentitySkip<T>(
  callback: () => T,
  recordActivation?: (active: boolean) => void,
): T {
  const target = globalThis as typeof globalThis & {
    KDHybridSourcePatchControl?: Record<string, unknown>;
  };
  const controlName = "KDHybridSourcePatchControl";
  const flagName = "enablePathCacheEdgeIdentitySkip";
  const previousControlDescriptor = Object.getOwnPropertyDescriptor(
    target,
    controlName,
  );
  let control: Record<string, unknown>;
  let createdControl = false;

  if (previousControlDescriptor === undefined) {
    control = {};
    try {
      Object.defineProperty(target, controlName, {
        configurable: true,
        enumerable: true,
        value: control,
        writable: true,
      });
      createdControl = true;
    } catch {
      recordActivation?.(false);
      return callback();
    }
  } else if (
    !("value" in previousControlDescriptor) ||
    typeof previousControlDescriptor.value !== "object" ||
    previousControlDescriptor.value === null
  ) {
    recordActivation?.(false);
    return callback();
  } else {
    control = previousControlDescriptor.value as Record<string, unknown>;
  }

  const previousFlagDescriptor = Object.getOwnPropertyDescriptor(
    control,
    flagName,
  );
  if (
    previousFlagDescriptor !== undefined &&
    (!("value" in previousFlagDescriptor) ||
      (previousFlagDescriptor.configurable !== true &&
        previousFlagDescriptor.writable !== true))
  ) {
    if (createdControl) {
      Reflect.deleteProperty(target, controlName);
    }
    recordActivation?.(false);
    return callback();
  }

  try {
    Object.defineProperty(control, flagName, {
      configurable: previousFlagDescriptor?.configurable ?? true,
      enumerable: previousFlagDescriptor?.enumerable ?? true,
      value: true,
      writable: previousFlagDescriptor?.writable ?? true,
    });
  } catch {
    if (createdControl) {
      Reflect.deleteProperty(target, controlName);
    }
    recordActivation?.(false);
    return callback();
  }

  recordActivation?.(true);
  try {
    return callback();
  } finally {
    try {
      if (previousFlagDescriptor === undefined) {
        Reflect.deleteProperty(control, flagName);
      } else {
        Object.defineProperty(control, flagName, previousFlagDescriptor);
      }
    } catch {
      // A mod changed the control during the call; preserve its live state.
    }
    if (createdControl) {
      const currentControlDescriptor = Object.getOwnPropertyDescriptor(
        target,
        controlName,
      );
      if (
        currentControlDescriptor !== undefined &&
        "value" in currentControlDescriptor &&
        currentControlDescriptor.value === control
      ) {
        Reflect.deleteProperty(target, controlName);
      }
    }
  }
}

function browserRecordMapGenerationDirectPathfindingFallback(
  active: boolean,
): void {
  const stats =
    globalThis.KDHybridRuntimeControl
      ?.mapGenerationPathfindingDirectFallbackStats;
  if (stats === undefined) {
    return;
  }
  if (active) {
    stats.optimizedMaps += 1;
  } else {
    stats.fallbackMaps += 1;
  }
}

function browserEnemySelectorAngerCacheStats():
  KDEnemySelectorAngerCacheStats | undefined {
  const stats = (
    globalThis as typeof globalThis & {
      readonly KDHybridSourcePatchControl?: {
        readonly enemySelectorAngerCacheStats?: unknown;
      };
    }
  ).KDHybridSourcePatchControl?.enemySelectorAngerCacheStats;
  return typeof stats === "object" && stats !== null
    ? (stats as KDEnemySelectorAngerCacheStats)
    : undefined;
}

function browserEnemySelectorLongTagCacheStats():
  KDEnemySelectorLongTagCacheStats | undefined {
  const stats = (
    globalThis as typeof globalThis & {
      readonly KDHybridSourcePatchControl?: {
        readonly enemySelectorLongTagCacheStats?: unknown;
      };
    }
  ).KDHybridSourcePatchControl?.enemySelectorLongTagCacheStats;
  return typeof stats === "object" && stats !== null
    ? (stats as KDEnemySelectorLongTagCacheStats)
    : undefined;
}

function browserEnemySelectorWeightedQueryCacheStats():
  KDEnemySelectorWeightedQueryCacheStats | undefined {
  const stats = (
    globalThis as typeof globalThis & {
      readonly KDHybridSourcePatchControl?: {
        readonly enemySelectorWeightedQueryCacheStats?: unknown;
      };
    }
  ).KDHybridSourcePatchControl?.enemySelectorWeightedQueryCacheStats;
  return typeof stats === "object" && stats !== null
    ? (stats as KDEnemySelectorWeightedQueryCacheStats)
    : undefined;
}

function browserClearPathCaches(): void {
  browserPathCache(false)?.clear?.();
  browserPathCache(true)?.clear?.();
}

function incrementGlobalNumber(globalName: string): void {
  const target = globalThis as Record<string, unknown>;
  const value = target[globalName];
  if (typeof value === "number") {
    target[globalName] = value + 1;
  }
}

interface BrowserEnemyCacheJournalEntry {
  readonly generation: number;
  readonly changes: readonly KDEnemyCacheCellChange[];
}

interface BrowserEnemyCacheJournal {
  readonly baseGeneration: number;
  latestGeneration: number;
  changedCellCount: number;
  readonly entries: BrowserEnemyCacheJournalEntry[];
}

const browserEnemyCacheJournals = new WeakMap<
  object,
  BrowserEnemyCacheJournal
>();

function advanceBrowserEnemyCacheJournal(
  cache: KDMutableEnemyPositionCache,
  generation: number,
  changes: readonly KDEnemyCacheCellChange[],
): void {
  const existing = browserEnemyCacheJournals.get(cache);
  if (existing === undefined || generation !== existing.latestGeneration + 1) {
    browserEnemyCacheJournals.set(cache, {
      baseGeneration: generation,
      latestGeneration: generation,
      changedCellCount: 0,
      entries: [],
    });
    return;
  }
  if (
    existing.changedCellCount + changes.length >
    MAX_ENEMY_CACHE_JOURNAL_CELLS
  ) {
    browserEnemyCacheJournals.delete(cache);
    return;
  }
  existing.entries.push({
    generation,
    changes: changes.map(({ x, y }) => ({ x, y })),
  });
  existing.latestGeneration = generation;
  existing.changedCellCount += changes.length;
}

function readBrowserEnemyCacheChanges(
  cache: KDEnemyPositionCache,
  fromGeneration: unknown,
  toGeneration: unknown,
): readonly KDEnemyCacheCellChange[] | undefined {
  if (
    !Number.isSafeInteger(fromGeneration) ||
    !Number.isSafeInteger(toGeneration)
  ) {
    return undefined;
  }
  const from = fromGeneration as number;
  const to = toGeneration as number;
  if (from === to) {
    return [];
  }
  const journal = browserEnemyCacheJournals.get(cache);
  if (
    journal === undefined ||
    from < journal.baseGeneration ||
    to > journal.latestGeneration ||
    from > to
  ) {
    return undefined;
  }
  const changes: KDEnemyCacheCellChange[] = [];
  let expectedGeneration = from + 1;
  for (const entry of journal.entries) {
    if (entry.generation <= from) {
      continue;
    }
    if (entry.generation > to) {
      break;
    }
    if (entry.generation !== expectedGeneration) {
      return undefined;
    }
    changes.push(...entry.changes);
    expectedGeneration += 1;
  }
  return expectedGeneration === to + 1 ? changes : undefined;
}

function createBrowserEnemyUpdateCacheEnvironment(): KDEnemyUpdateCacheEnvironment {
  const target = globalThis as Record<string, unknown>;
  const updateEnemies = readRequiredFunction(
    () => KinkyDungeonUpdateEnemies,
    "KinkyDungeonUpdateEnemies",
  );
  const moveEntity = readRequiredFunction(() => KDMoveEntity, "KDMoveEntity");
  const getEnemyCache = readRequiredFunction(
    () => KDGetEnemyCache,
    "KDGetEnemyCache",
  );
  const dependencies = new Map<string, Function>();
  for (const name of Object.keys(
    KNOWN_ENEMY_UPDATE_CACHE_DEPENDENCY_SIGNATURES,
  )) {
    const functionValue = target[name];
    if (typeof functionValue !== "function") {
      throw new TypeError(`${name} is unavailable`);
    }
    dependencies.set(name, functionValue);
  }
  const signaturesMatch = [...dependencies].every(
    ([name, functionValue]) =>
      functionSignature(functionValue).normalizedHash ===
      KNOWN_ENEMY_UPDATE_CACHE_DEPENDENCY_SIGNATURES[
        name as keyof typeof KNOWN_ENEMY_UPDATE_CACHE_DEPENDENCY_SIGNATURES
      ],
  );
  const nonEnemyEventMaps = [
    {
      name: "spell",
      read: () => readBinding(() => KDEventMapSpell, "KDEventMapSpell"),
    },
    {
      name: "weapon",
      read: () => readBinding(() => KDEventMapWeapon, "KDEventMapWeapon"),
    },
    {
      name: "inventory-selected",
      read: () =>
        readBinding(
          () => KDEventMapInventorySelected,
          "KDEventMapInventorySelected",
        ),
    },
    {
      name: "inventory-icon",
      read: () =>
        readBinding(() => KDEventMapInventoryIcon, "KDEventMapInventoryIcon"),
    },
    {
      name: "inventory",
      read: () => readBinding(() => KDEventMapInventory, "KDEventMapInventory"),
    },
    {
      name: "bullet",
      read: () => readBinding(() => KDEventMapBullet, "KDEventMapBullet"),
    },
    {
      name: "buff",
      read: () => readBinding(() => KDEventMapBuff, "KDEventMapBuff"),
    },
    {
      name: "outfit",
      read: () => readBinding(() => KDEventMapOutfit, "KDEventMapOutfit"),
    },
    {
      name: "generic",
      read: () => readBinding(() => KDEventMapGeneric, "KDEventMapGeneric"),
    },
    {
      name: "alt",
      read: () => readBinding(() => KDEventMapAlt, "KDEventMapAlt"),
    },
    {
      name: "facility",
      read: () => readBinding(() => KDEventMapFacility, "KDEventMapFacility"),
    },
  ] as const;

  const eventTableRiskReasons = (): readonly string[] => {
    const reasons: string[] = [];
    for (const eventMap of nonEnemyEventMaps) {
      const handlers = eventMap.read();
      if (handlers?.enemyMove !== undefined) {
        reasons.push(`${eventMap.name}-handler`);
      }
    }
    return reasons;
  };

  return Object.freeze({
    compatible: () => {
      try {
        return (
          signaturesMatch &&
          [...dependencies].every(
            ([name, functionValue]) => target[name] === functionValue,
          ) &&
          eventTableRiskReasons().length === 0
        );
      } catch {
        return false;
      }
    },
    mapData: () => KDMapData as KDEnemyUpdateMapData | undefined,
    currentTick: () => KinkyDungeonCurrentTick,
    enemyCache: () =>
      Reflect.apply(getEnemyCache, globalThis, []) as
        KDMutableEnemyPositionCache | undefined,
    currentEnemyCache: () =>
      (KDEnemyCache ?? undefined) as KDMutableEnemyPositionCache | undefined,
    replaceEnemyCache: (cache: KDMutableEnemyPositionCache) => {
      KDEnemyCache = cache;
    },
    cacheDirty: () => Boolean(KDUpdateEnemyCache),
    setCacheDirty: (dirty: boolean) => {
      KDUpdateEnemyCache = dirty;
    },
    moveFunction: () =>
      typeof target.KDMoveEntity === "function"
        ? (target.KDMoveEntity as (...args: unknown[]) => unknown)
        : undefined,
    replaceMoveFunction: (fn: (...args: unknown[]) => unknown) => {
      target.KDMoveEntity = fn;
    },
    updateEnemies: (thisArgument: unknown, args: readonly unknown[]) =>
      Reflect.apply(updateEnemies, thisArgument, args),
    moveEntity: (thisArgument: unknown, args: readonly unknown[]) =>
      Reflect.apply(moveEntity, thisArgument, args),
    effectMoveHandler: (name: unknown) =>
      KDEffectTileMoveOnFunctions?.[String(name)],
    eventRiskReasons: (
      entities: readonly KDEnemyUpdateEntity[],
    ): readonly string[] => {
      for (const entity of entities) {
        for (const event of entity.events ?? []) {
          if (event.trigger === "enemyMove") {
            return ["entity-instance-event"];
          }
        }
        for (const event of entity.Enemy?.events ?? []) {
          if (event.trigger === "enemyMove") {
            return ["enemy-definition-event"];
          }
        }
      }
      return [];
    },
    advanceCacheGeneration: (
      cache?: KDMutableEnemyPositionCache,
      changes?: readonly KDEnemyCacheCellChange[],
    ) => {
      const current = target.__KDHybridEnemyCacheGeneration;
      const generation =
        Number.isSafeInteger(current) &&
        (current as number) >= 0 &&
        (current as number) < Number.MAX_SAFE_INTEGER
          ? (current as number) + 1
          : 1;
      target.__KDHybridEnemyCacheGeneration = generation;
      if (cache !== undefined && changes !== undefined) {
        advanceBrowserEnemyCacheJournal(cache, generation, changes);
      }
    },
    record: (
      event:
        | "optimized-update"
        | "fallback"
        | "working-copy"
        | "fast-move"
        | "scanned-move"
        | "unsafe-move",
      detail?: Readonly<Record<string, unknown>>,
    ) => {
      const observer = target.__KDHybridEnemyUpdateCacheObserver;
      if (typeof observer === "function") {
        try {
          Reflect.apply(observer, undefined, [event, detail]);
        } catch {
          // Profiling observers must never change game behavior.
        }
      }
    },
  });
}

function createBrowserJailKeyEarlyReturnEnvironment(): KDJailKeyEarlyReturnEnvironment {
  const target = globalThis as Record<string, unknown>;
  const dependencies = new Map<string, Function>([
    [
      "KinkyDungeonMapGet",
      readRequiredFunction(() => KinkyDungeonMapGet, "KinkyDungeonMapGet"),
    ],
    [
      "KinkyDungeonTilesGet",
      readRequiredFunction(() => KinkyDungeonTilesGet, "KinkyDungeonTilesGet"),
    ],
    [
      "KDistChebyshev",
      readRequiredFunction(() => KDistChebyshev, "KDistChebyshev"),
    ],
  ]);
  const signaturesMatch = [...dependencies].every(
    ([name, functionValue]) =>
      functionSignature(functionValue).normalizedHash ===
      KNOWN_JAIL_KEY_DEPENDENCY_SIGNATURES[
        name as keyof typeof KNOWN_JAIL_KEY_DEPENDENCY_SIGNATURES
      ],
  );

  return Object.freeze({
    compatible: () =>
      signaturesMatch &&
      [...dependencies].every(
        ([name, functionValue]) => target[name] === functionValue,
      ),
    groundItems: () => {
      const mapData = readBinding(() => KDMapData, "KDMapData") as
        | {
            readonly GroundItems?: readonly KDJailKeyGroundItem[];
          }
        | undefined;
      return Array.isArray(mapData?.GroundItems)
        ? mapData.GroundItems
        : undefined;
    },
    maxKeys: () => readBinding(() => KDMaxKeys, "KDMaxKeys"),
    record: (
      event: "skipped-scan" | "fallback",
      detail?: Readonly<{ reason?: string }>,
    ) => {
      const observer = target.__KDHybridJailKeyObserver;
      if (typeof observer === "function") {
        try {
          Reflect.apply(observer, undefined, [event, detail]);
        } catch {
          // Profiling observers must never change game behavior.
        }
      }
    },
  });
}

function createBrowserEnemySelectorEnvironment(
  enemySelectorCachesEnabled: () => boolean = () => true,
): KDEnemySelectorEnvironment {
  const expectedEnemies = readBinding(
    () => KinkyDungeonEnemies,
    "KinkyDungeonEnemies",
  );
  const expectedPerkToggleTags = readBinding(
    () => KDPerkToggleTags,
    "KDPerkToggleTags",
  );
  const expectedFactionRelation = readRequiredFunction(
    () => KDFactionRelation,
    "KDFactionRelation",
  );
  if (!Array.isArray(expectedEnemies)) {
    throw new TypeError("KinkyDungeonEnemies is unavailable");
  }
  if (!Array.isArray(expectedPerkToggleTags)) {
    throw new TypeError("KDPerkToggleTags is unavailable");
  }

  const expectedMapGet = Map.prototype.get;
  const expectedArrayIncludes = Array.prototype.includes;
  const expectedStringIncludes = String.prototype.includes;
  const expectedObjectEntries = Object.entries;
  const expectedObjectGetPrototypeOf = Object.getPrototypeOf;
  const expectedObjectKeys = Object.keys;
  const expectedObjectGetOwnPropertyDescriptor =
    Object.getOwnPropertyDescriptor;
  const nativeBuiltins = [
    expectedMapGet,
    expectedArrayIncludes,
    expectedStringIncludes,
    expectedObjectEntries,
    expectedObjectGetPrototypeOf,
    expectedObjectKeys,
    expectedObjectGetOwnPropertyDescriptor,
  ].every(nativeBuiltin);
  const factionRelationMatches =
    functionSignature(expectedFactionRelation).normalizedHash ===
    KNOWN_FIND_MASTER_DEPENDENCY_SIGNATURES.KDFactionRelation;

  return Object.freeze({
    state: (): KDEnemySelectorState | undefined => {
      const enemies = readBinding(
        () => KinkyDungeonEnemies,
        "KinkyDungeonEnemies",
      );
      const perkToggleTags = readBinding(
        () => KDPerkToggleTags,
        "KDPerkToggleTags",
      );
      const statsChoice = readBinding(
        () => KinkyDungeonStatsChoice,
        "KinkyDungeonStatsChoice",
      );
      const newGame = readBinding(
        () => KinkyDungeonNewGame,
        "KinkyDungeonNewGame",
      );
      const goddessRep = readBinding(
        () => KinkyDungeonGoddessRep,
        "KinkyDungeonGoddessRep",
      );
      const groundTiles = readBinding(
        () => KinkyDungeonGroundTiles,
        "KinkyDungeonGroundTiles",
      );
      const avoidTiles = readBinding(
        () => KDDefaultAvoidTiles,
        "KDDefaultAvoidTiles",
      );
      const levelsPerCheckpoint = readBinding(
        () => KDLevelsPerCheckpoint,
        "KDLevelsPerCheckpoint",
      );
      const factionRelation = readBinding(
        () => KDFactionRelation,
        "KDFactionRelation",
      );
      const random = readBinding(() => KDRandom, "KDRandom");
      if (
        !Array.isArray(enemies) ||
        !Array.isArray(perkToggleTags) ||
        !(statsChoice instanceof Map) ||
        typeof newGame !== "number" ||
        typeof goddessRep !== "object" ||
        goddessRep === null ||
        typeof groundTiles !== "string" ||
        typeof avoidTiles !== "string" ||
        typeof levelsPerCheckpoint !== "number" ||
        typeof factionRelation !== "function" ||
        typeof random !== "function"
      ) {
        return undefined;
      }
      return {
        enemies,
        perkToggleTags,
        statsChoice,
        newGame,
        goddessRep,
        groundTiles,
        avoidTiles,
        levelsPerCheckpoint,
        factionRelation,
        random,
      };
    },
    compatible: (state: KDEnemySelectorState): boolean => {
      const control = (
        globalThis as typeof globalThis & {
          readonly KDHybridSourcePatchControl?: {
            readonly disableEnemySelectorHoists?: unknown;
          };
        }
      ).KDHybridSourcePatchControl;
      return (
        !control?.disableEnemySelectorHoists &&
        nativeBuiltins &&
        factionRelationMatches &&
        state.enemies === expectedEnemies &&
        state.perkToggleTags === expectedPerkToggleTags &&
        state.factionRelation === expectedFactionRelation &&
        state.statsChoice.get === expectedMapGet &&
        Map.prototype.get === expectedMapGet &&
        Array.prototype.includes === expectedArrayIncludes &&
        String.prototype.includes === expectedStringIncludes &&
        Object.entries === expectedObjectEntries &&
        Object.getPrototypeOf === expectedObjectGetPrototypeOf &&
        Object.keys === expectedObjectKeys &&
        Object.getOwnPropertyDescriptor ===
          expectedObjectGetOwnPropertyDescriptor
      );
    },
    mapGenerationCacheEpoch: (): object | undefined => {
      try {
        return enemySelectorCachesEnabled()
          ? browserMapGenerationGuard.enemySelectorCacheEpoch
          : undefined;
      } catch {
        return undefined;
      }
    },
    angerCacheEnabled: (): boolean => {
      const control = (
        globalThis as typeof globalThis & {
          readonly KDHybridSourcePatchControl?: {
            readonly disableEnemySelectorAngerCache?: unknown;
          };
        }
      ).KDHybridSourcePatchControl;
      return !control?.disableEnemySelectorAngerCache;
    },
    angerMatchIndices: ENEMY_SELECTOR_ANGER_MATCH_INDICES,
    angerCacheStats: browserEnemySelectorAngerCacheStats,
    longTagCacheEnabled: (): boolean => {
      const control = (
        globalThis as typeof globalThis & {
          readonly KDHybridSourcePatchControl?: {
            readonly disableEnemySelectorLongTagCache?: unknown;
          };
        }
      ).KDHybridSourcePatchControl;
      return !control?.disableEnemySelectorLongTagCache;
    },
    longTagQueryKey: (tags: readonly string[]): string | undefined => {
      const control = (
        globalThis as typeof globalThis & {
          readonly KDHybridSourcePatchControl?: {
            readonly disableEnemySelectorGeneralLongTagCache?: unknown;
          };
        }
      ).KDHybridSourcePatchControl;
      return enemySelectorLongTagQueryKey(
        tags,
        !control?.disableEnemySelectorGeneralLongTagCache,
      );
    },
    longTagCacheStats: browserEnemySelectorLongTagCacheStats,
    weightedQueryCacheEnabled: (): boolean => {
      const control = (
        globalThis as typeof globalThis & {
          readonly KDHybridSourcePatchControl?: {
            readonly disableEnemySelectorWeightedQueryCache?: unknown;
          };
        }
      ).KDHybridSourcePatchControl;
      return !control?.disableEnemySelectorWeightedQueryCache;
    },
    weightedSingleTagCacheEnabled: (): boolean => {
      const control = (
        globalThis as typeof globalThis & {
          readonly KDHybridSourcePatchControl?: {
            readonly disableEnemySelectorWeightedSingleTagCache?: unknown;
          };
        }
      ).KDHybridSourcePatchControl;
      return !control?.disableEnemySelectorWeightedSingleTagCache;
    },
    weightedFilterTagCacheEnabled: (): boolean => {
      const control = (
        globalThis as typeof globalThis & {
          readonly KDHybridSourcePatchControl?: {
            readonly disableEnemySelectorWeightedFilterTagCache?: unknown;
          };
        }
      ).KDHybridSourcePatchControl;
      return !control?.disableEnemySelectorWeightedFilterTagCache;
    },
    weightedQueryCacheStats: browserEnemySelectorWeightedQueryCacheStats,
  });
}

function createBrowserNearbyEnvironment(): KDNearbyEnemiesEnvironment {
  const target = globalThis as Record<string, unknown>;
  const enemyCache = target.KDGetEnemyCache;
  const hostile = target.KDHostile;
  if (typeof enemyCache !== "function") {
    throw new TypeError("KDGetEnemyCache is unavailable");
  }
  if (typeof hostile !== "function") {
    throw new TypeError("KDHostile is unavailable");
  }
  return Object.freeze({
    // KDMapData is a top-level lexical binding in KD 5.4.92, not a property on
    // globalThis. Keep the guarded lexical read even though the callable
    // dependencies can be captured directly.
    mapData: () => KDMapData,
    enemyCache: () => {
      if (!KDUpdateEnemyCache && KDEnemyCache) {
        return KDEnemyCache;
      }
      return enemyCache.call(globalThis);
    },
    enemyCacheGeneration: () => target.__KDHybridEnemyCacheGeneration,
    enemyCacheChanges: readBrowserEnemyCacheChanges,
    hostile: hostile.bind(globalThis) as (
      enemy: KDNearbyEnemy,
      target: unknown,
    ) => boolean,
    compatible: () =>
      target.KDGetEnemyCache === enemyCache && target.KDHostile === hostile,
  });
}

function createBrowserFindMasterEnvironment(): KDFindMasterEnvironment {
  const target = globalThis as Record<string, unknown>;
  const enemyCache = readRequiredFunction(
    () => KDGetEnemyCache,
    "KDGetEnemyCache",
  );
  const hostile = readRequiredFunction(() => KDHostile, "KDHostile");
  const getFaction = readRequiredFunction(() => KDGetFaction, "KDGetFaction");
  const enemyRank = readRequiredFunction(() => KDEnemyRank, "KDEnemyRank");
  const entityHasFlag = readRequiredFunction(
    () => KDEntityHasFlag,
    "KDEntityHasFlag",
  );
  const chebyshev = readRequiredFunction(
    () => KDistChebyshev,
    "KDistChebyshev",
  );
  const dependencies = new Map<string, Function>();
  for (const name of Object.keys(KNOWN_FIND_MASTER_DEPENDENCY_SIGNATURES)) {
    const functionValue = target[name];
    if (typeof functionValue !== "function") {
      throw new TypeError(`${name} is unavailable`);
    }
    dependencies.set(name, functionValue);
  }
  const signaturesMatch = [...dependencies].every(
    ([name, functionValue]) =>
      functionSignature(functionValue).normalizedHash ===
      KNOWN_FIND_MASTER_DEPENDENCY_SIGNATURES[
        name as keyof typeof KNOWN_FIND_MASTER_DEPENDENCY_SIGNATURES
      ],
  );

  return Object.freeze({
    mapData: () => KDMapData,
    enemyCache: () => {
      if (!KDUpdateEnemyCache && KDEnemyCache) {
        return KDEnemyCache;
      }
      return enemyCache.call(globalThis);
    },
    enemyCacheGeneration: () => target.__KDHybridEnemyCacheGeneration,
    enemyCacheChanges: readBrowserEnemyCacheChanges,
    hostile: hostile.bind(globalThis) as (
      enemy: KDFindMasterEnemy,
      targetEnemy: KDFindMasterEnemy,
    ) => boolean,
    getFaction: getFaction.bind(globalThis) as (
      enemy: KDFindMasterEnemy,
    ) => unknown,
    enemyRank: enemyRank.bind(globalThis) as (
      enemy: KDFindMasterEnemy,
    ) => number,
    entityHasFlag: entityHasFlag.bind(globalThis) as (
      enemy: KDFindMasterEnemy,
      flag: string,
    ) => boolean,
    chebyshev: chebyshev.bind(globalThis) as (x: number, y: number) => number,
    compatible: () =>
      signaturesMatch &&
      [...dependencies].every(
        ([name, functionValue]) => target[name] === functionValue,
      ),
  });
}

function createBrowserNearestPlayerEnvironment(): KDNearestPlayerEnvironment {
  const target = globalThis as Record<string, unknown>;
  const enemyVisionRadius = readRequiredFunction(
    () => KDEnemyVisionRadius,
    "KDEnemyVisionRadius",
  );
  const checkLOS = readRequiredFunction(
    () => KinkyDungeonCheckLOS,
    "KinkyDungeonCheckLOS",
  );
  const checkPath = readRequiredFunction(
    () => KinkyDungeonCheckPath,
    "KinkyDungeonCheckPath",
  );
  const hostile = readRequiredFunction(() => KDHostile, "KDHostile");
  const getFaction = readRequiredFunction(() => KDGetFaction, "KDGetFaction");
  const factionRelation = readRequiredFunction(
    () => KDFactionRelation,
    "KDFactionRelation",
  );
  const enemyHasFlag = readRequiredFunction(
    () => KDEnemyHasFlag,
    "KDEnemyHasFlag",
  );
  const nearbyEnemies = readRequiredFunction(
    () => KDNearbyEnemies,
    "KDNearbyEnemies",
  );
  const helpless = readRequiredFunction(() => KDHelpless, "KDHelpless");
  const imprisoned = readRequiredFunction(
    () => KDIsImprisoned,
    "KDIsImprisoned",
  );
  const chebyshev = readRequiredFunction(
    () => KDistChebyshev,
    "KDistChebyshev",
  );
  const visionGet = readRequiredFunction(
    () => KinkyDungeonVisionGet,
    "KinkyDungeonVisionGet",
  );
  const allied = readRequiredFunction(() => KDAllied, "KDAllied");
  const inParty = readRequiredFunction(() => KDIsInParty, "KDIsInParty");
  const jailGuard = readRequiredFunction(
    () => KinkyDungeonJailGuard,
    "KinkyDungeonJailGuard",
  );
  const setFlag = readRequiredFunction(
    () => KinkyDungeonSetFlag,
    "KinkyDungeonSetFlag",
  );
  const getEnemyByName = readRequiredFunction(
    () => KinkyDungeonGetEnemyByName,
    "KinkyDungeonGetEnemyByName",
  );

  const dependencies = new Map<string, Function>();
  for (const name of Object.keys(KNOWN_NEAREST_PLAYER_REORDER_SIGNATURES)) {
    const functionValue = target[name];
    if (typeof functionValue !== "function") {
      throw new TypeError(`${name} is unavailable`);
    }
    dependencies.set(name, functionValue);
  }
  for (const [name, functionValue] of [
    ["KDEnemyVisionRadius", enemyVisionRadius],
    ["KinkyDungeonCheckLOS", checkLOS],
    ["KinkyDungeonCheckPath", checkPath],
    ["KDNearbyEnemies", nearbyEnemies],
    ["KDistChebyshev", chebyshev],
    ["KinkyDungeonVisionGet", visionGet],
    ["KDAllied", allied],
    ["KinkyDungeonJailGuard", jailGuard],
    ["KinkyDungeonSetFlag", setFlag],
  ] as const) {
    dependencies.set(name, functionValue);
  }
  const signaturesMatch = Object.entries(
    KNOWN_NEAREST_PLAYER_REORDER_SIGNATURES,
  ).every(
    ([name, expected]) =>
      functionSignature(dependencies.get(name)!).normalizedHash === expected,
  );
  const compatible = (): boolean => {
    if (!signaturesMatch) {
      return false;
    }
    for (const [name, functionValue] of dependencies) {
      if (target[name] !== functionValue) {
        return false;
      }
    }
    return true;
  };

  return Object.freeze({
    player: () =>
      readBinding(() => KinkyDungeonPlayerEntity, "KinkyDungeonPlayerEntity"),
    gameData: () => readBinding(() => KDGameData, "KDGameData"),
    flags: () => readBinding(() => KinkyDungeonFlags, "KinkyDungeonFlags"),
    enemyVisionRadius: enemyVisionRadius.bind(globalThis) as (
      enemy: KDNearestPlayerEnemy,
    ) => number,
    checkLOS: checkLOS.bind(
      globalThis,
    ) as KDNearestPlayerEnvironment["checkLOS"],
    checkPath: checkPath.bind(
      globalThis,
    ) as KDNearestPlayerEnvironment["checkPath"],
    hostile: hostile.bind(globalThis) as KDNearestPlayerEnvironment["hostile"],
    getFaction: getFaction.bind(
      globalThis,
    ) as KDNearestPlayerEnvironment["getFaction"],
    factionRelation: factionRelation.bind(
      globalThis,
    ) as KDNearestPlayerEnvironment["factionRelation"],
    enemyHasFlag: enemyHasFlag.bind(
      globalThis,
    ) as KDNearestPlayerEnvironment["enemyHasFlag"],
    nearbyEnemies: nearbyEnemies.bind(
      globalThis,
    ) as KDNearestPlayerEnvironment["nearbyEnemies"],
    helpless: helpless.bind(
      globalThis,
    ) as KDNearestPlayerEnvironment["helpless"],
    imprisoned: imprisoned.bind(
      globalThis,
    ) as KDNearestPlayerEnvironment["imprisoned"],
    chebyshev: chebyshev.bind(
      globalThis,
    ) as KDNearestPlayerEnvironment["chebyshev"],
    visionGet: visionGet.bind(
      globalThis,
    ) as KDNearestPlayerEnvironment["visionGet"],
    allied: allied.bind(globalThis) as KDNearestPlayerEnvironment["allied"],
    inParty: inParty.bind(globalThis) as KDNearestPlayerEnvironment["inParty"],
    jailGuard: jailGuard.bind(
      globalThis,
    ) as KDNearestPlayerEnvironment["jailGuard"],
    setFlag: setFlag.bind(globalThis) as KDNearestPlayerEnvironment["setFlag"],
    getEnemyByName: getEnemyByName.bind(
      globalThis,
    ) as KDNearestPlayerEnvironment["getEnemyByName"],
    compatible,
  });
}

function createBrowserCommanderHelpEnvironment(): KDCommanderHelpEnvironment {
  const target = globalThis as Record<string, unknown>;
  const orders = readBinding(() => KDCommanderOrders, "KDCommanderOrders");
  const boundEffects = readRequiredFunction(
    () => KDBoundEffects,
    "KDBoundEffects",
  );
  const imprisoned = readRequiredFunction(
    () => KDIsImprisoned,
    "KDIsImprisoned",
  );
  const tileDangerous = readRequiredFunction(
    () => KDIsTileDangerous,
    "KDIsTileDangerous",
  );
  const disabled = readRequiredFunction(
    () => KinkyDungeonIsDisabled,
    "KinkyDungeonIsDisabled",
  );
  const nearbyMapTiles = readRequiredFunction(
    () => KDNearbyMapTiles,
    "KDNearbyMapTiles",
  );
  const entityAt = readRequiredFunction(
    () => KinkyDungeonEntityAt,
    "KinkyDungeonEntityAt",
  );
  const humanoid = readRequiredFunction(() => KDIsHumanoid, "KDIsHumanoid");
  const immobile = readRequiredFunction(() => KDIsImmobile, "KDIsImmobile");
  if (orders === undefined) {
    throw new TypeError("KDCommanderOrders is unavailable");
  }

  const classifiers = new Map<string, Function>([
    ["KDBoundEffects", boundEffects],
    ["KDIsImprisoned", imprisoned],
    ["KDIsTileDangerous", tileDangerous],
    ["KinkyDungeonIsDisabled", disabled],
    ["KDNearbyMapTiles", nearbyMapTiles],
    ["KinkyDungeonEntityAt", entityAt],
    ["KDIsHumanoid", humanoid],
    ["KDIsImmobile", immobile],
  ]);
  const classifierSignaturesMatch = [...classifiers].every(
    ([name, functionValue]) =>
      functionSignature(functionValue).normalizedHash ===
      KNOWN_COMMANDER_CLASSIFIER_SIGNATURES[
        name as keyof typeof KNOWN_COMMANDER_CLASSIFIER_SIGNATURES
      ],
  );
  const orderFingerprintMatches =
    commanderOrderFingerprint(orders) === KNOWN_COMMANDER_ORDER_FINGERPRINT;
  const orderSnapshot = snapshotCommanderOrders(orders);
  const mutators = new Map<string, (...args: unknown[]) => unknown>();
  for (const name of COMMANDER_MUTATOR_NAMES) {
    const functionValue = target[name];
    if (typeof functionValue === "function") {
      mutators.set(name, functionValue as (...args: unknown[]) => unknown);
    }
  }

  const compatible = (): boolean => {
    const currentOrders = readBinding(
      () => KDCommanderOrders,
      "KDCommanderOrders",
    );
    if (
      !classifierSignaturesMatch ||
      !orderFingerprintMatches ||
      currentOrders !== orders ||
      !commanderOrderSnapshotMatches(orders, orderSnapshot)
    ) {
      return false;
    }
    for (const [name, expected] of classifiers) {
      if (target[name] !== expected) {
        return false;
      }
    }
    for (const [name, expected] of mutators) {
      if (target[name] !== expected) {
        return false;
      }
    }
    return true;
  };

  return Object.freeze({
    mapData: () => readBinding(() => KDMapData, "KDMapData"),
    orders: () => readBinding(() => KDCommanderOrders, "KDCommanderOrders"),
    boundEffects: boundEffects.bind(globalThis) as (
      enemy: KDCommanderEntity,
    ) => number,
    imprisoned: imprisoned.bind(globalThis) as (
      enemy: KDCommanderEntity,
    ) => boolean,
    tileDangerous: tileDangerous.bind(globalThis) as (
      enemy: KDCommanderEntity,
      x: number,
      y: number,
      mapData: KDMapDataLike,
    ) => boolean,
    disabled: disabled.bind(globalThis) as (
      enemy: KDCommanderEntity,
    ) => boolean,
    nearbyMapTiles: nearbyMapTiles.bind(globalThis) as (
      x: number,
      y: number,
      distance: number,
    ) => readonly KDNearbyMapTile[],
    entityAt: entityAt.bind(globalThis) as (x: number, y: number) => unknown,
    movableEnemyTiles: () =>
      readBinding(
        () => KinkyDungeonMovableTilesEnemy,
        "KinkyDungeonMovableTilesEnemy",
      ),
    candidateMayNeedHelp: (enemy: KDCommanderEntity): boolean => {
      const assaulters = readBinding(() => KDAssaulters, "KDAssaulters");
      const maxAssaulters = readBinding(
        () => KDMaxAssaulters,
        "KDMaxAssaulters",
      );
      if (!enemy.aware || (assaulters as number) >= (maxAssaulters as number)) {
        return true;
      }
      if (enemy.IntentAction) return false;
      if (!Reflect.apply(humanoid, globalThis, [enemy])) return false;
      if (!((enemy.attackPoints as number) < 1)) return false;
      if (enemy.Enemy?.tags?.nohelp) return false;
      if (Reflect.apply(immobile, globalThis, [enemy])) return false;
      if (Reflect.apply(boundEffects, globalThis, [enemy]) >= 4) return false;
      return false;
    },
    compatible,
    observeMutations: (onMutation: () => void): (() => void) | null => {
      if (!compatible()) {
        return null;
      }
      const installed: {
        readonly name: string;
        readonly original: (...args: unknown[]) => unknown;
        readonly wrapper: (...args: unknown[]) => unknown;
      }[] = [];
      try {
        for (const [name, original] of mutators) {
          const wrapper = function (
            this: unknown,
            ...args: unknown[]
          ): unknown {
            notifyMutation(onMutation);
            try {
              return Reflect.apply(original, this, args);
            } finally {
              notifyMutation(onMutation);
            }
          };
          target[name] = wrapper;
          if (target[name] !== wrapper) {
            throw new TypeError(`Could not observe ${name}`);
          }
          installed.push({ name, original, wrapper });
        }
      } catch {
        restoreMutators();
        return null;
      }
      return restoreMutators;

      function restoreMutators(): void {
        for (const { name, original, wrapper } of installed) {
          if (target[name] === wrapper) {
            target[name] = original;
          }
        }
      }
    },
  });
}

function readRequiredFunction<T extends Function>(
  lexical: () => T | undefined,
  globalName: string,
): T {
  const functionValue = readBinding(lexical, globalName);
  if (typeof functionValue !== "function") {
    throw new TypeError(`${globalName} is unavailable`);
  }
  return functionValue;
}

function notifyMutation(callback: () => void): void {
  try {
    callback();
  } catch {
    // Cache invalidation observers are internal and must not affect KD.
  }
}

function commanderOrderFingerprint(orders: KDCommanderOrdersLike): string {
  let description = "";
  for (const [orderName, order] of Object.entries(orders)) {
    description += `order:${orderName}\n`;
    if (order === undefined) {
      description += "undefined\n";
      continue;
    }
    for (const [property, value] of Object.entries(order)) {
      if (typeof value === "function") {
        const signature = functionSignature(value);
        description +=
          `${property}:function:${signature.name}:${signature.arity}:` +
          `${signature.normalizedHash}\n`;
      } else {
        description += `${property}:${typeof value}:${JSON.stringify(value)}\n`;
      }
    }
  }
  return stableHash(description);
}

function snapshotCommanderOrders(
  orders: KDCommanderOrdersLike,
): ReadonlyMap<string, ReadonlyMap<string, unknown>> {
  return new Map(
    Object.entries(orders).map(([name, order]) => [
      name,
      new Map(Object.entries(order ?? {})),
    ]),
  );
}

function commanderOrderSnapshotMatches(
  orders: KDCommanderOrdersLike,
  snapshot: ReadonlyMap<string, ReadonlyMap<string, unknown>>,
): boolean {
  const names = Object.keys(orders);
  if (
    names.length !== COMMANDER_ORDER_NAMES.length ||
    names.some((name, index) => name !== COMMANDER_ORDER_NAMES[index])
  ) {
    return false;
  }
  for (const name of names) {
    const order = orders[name];
    const expected = snapshot.get(name);
    if (order === undefined || expected === undefined) {
      return false;
    }
    const properties = Object.keys(order);
    if (
      properties.length !== expected.size ||
      properties.some((property) => order[property] !== expected.get(property))
    ) {
      return false;
    }
  }
  return true;
}

const browserEnvironment: KDPathfindingEnvironment = Object.freeze({
  mapData: () => readBinding(() => KDMapData, "KDMapData"),
  mapGenerationActive: () => browserMapGenerationGuard.depth > 0,
  visionAt: (x: number, y: number) => {
    const functionValue = readBinding(
      () => KinkyDungeonVisionGet,
      "KinkyDungeonVisionGet",
    );
    return typeof functionValue === "function"
      ? functionValue(x, y)
      : undefined;
  },
  effectTagsAt: (location: string) => {
    const functionValue = readBinding(
      () => KDEffectTileTagsLoc,
      "KDEffectTileTagsLoc",
    );
    return typeof functionValue === "function"
      ? functionValue(location)
      : undefined;
  },
  playerPosition: () =>
    readBinding(() => KinkyDungeonPlayerEntity, "KinkyDungeonPlayerEntity"),
  openDoorTiles: () => readBinding(() => KDOpenDoorTiles, "KDOpenDoorTiles"),
  pathCache: browserPathCache,
  tileShort: browserTileShort,
  recordCacheHit: browserRecordCacheHit,
  recordCacheFill: browserRecordCacheFill,
  recordFallback: browserRecordPathfindingFallback,
  clearPathCaches: browserClearPathCaches,
});
