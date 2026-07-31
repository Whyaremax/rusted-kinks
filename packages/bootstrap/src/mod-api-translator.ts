// SPDX-License-Identifier: MIT

import {
  analyzeOfficialModSource,
  type OfficialModWriteKind,
} from "./official-mod-analyzer.js";

/**
 * Conservative compatibility translation for KD mods.
 *
 * Ordinary KD mods remain JavaScript. Byte-exact reviewed archives use their
 * audited profiles; other archives are parsed without execution and receive a
 * proof only when their executable source stays within recognizable official
 * API effects and does not replace a source-fast-path assumption.
 */

export const MAP_GENERATION_SOURCE_OPTIMIZATIONS = Object.freeze([
  "map-tile-filling-coordinate-reuse",
  "paste-tile-serialized-cache",
  "accessible-queue",
  "eligible-restraint-catalog",
  "pathfinding-numeric-coordinate-keys",
  "pathfinding-numeric-continuation-index",
  "path-cache-edge-identity-skip",
  "path-cache-known-tail-skip",
] as const);

export type MapGenerationSourceOptimization =
  (typeof MAP_GENERATION_SOURCE_OPTIMIZATIONS)[number];

export type KDApiEffect =
  | "read-only"
  | "deterministic-random"
  | "grid-write"
  | "tile-metadata-write"
  | "effect-tile-write"
  | "entity-write"
  | "buff-write"
  | "event-dispatch"
  | "game-state-write"
  | "ui-only";

export interface KDApiTranslation {
  readonly api: string;
  readonly effect: KDApiEffect;
  readonly nativeHandling:
    | "no-native-state"
    | "grid-identity-observed"
    | "javascript-state-recaptured"
    | "javascript-callback"
    | "javascript-authoritative";
}

const API_TRANSLATIONS = Object.freeze({
  addTextKey: translation("addTextKey", "ui-only", "no-native-state"),
  DrawBoxKD: translation("DrawBoxKD", "ui-only", "no-native-state"),
  DrawTextFitKD: translation("DrawTextFitKD", "ui-only", "no-native-state"),
  KDDraw: translation("KDDraw", "ui-only", "no-native-state"),
  KDTex: translation("KDTex", "ui-only", "no-native-state"),
  KDDrawChibi: translation("KDDrawChibi", "ui-only", "no-native-state"),
  KDGetOrMakeRenderTexture: translation(
    "KDGetOrMakeRenderTexture",
    "ui-only",
    "no-native-state",
  ),
  MouseIn: translation("MouseIn", "read-only", "no-native-state"),
  TextGet: translation("TextGet", "read-only", "no-native-state"),
  "KinkyDungeonFlags.get": translation(
    "KinkyDungeonFlags.get",
    "read-only",
    "no-native-state",
  ),
  "KinkyDungeonHiddenFactions.has": translation(
    "KinkyDungeonHiddenFactions.has",
    "read-only",
    "no-native-state",
  ),
  "KDStatRep.includes": translation(
    "KDStatRep.includes",
    "read-only",
    "no-native-state",
  ),
  "KDModSettings.hasOwnProperty": translation(
    "KDModSettings.hasOwnProperty",
    "read-only",
    "no-native-state",
  ),
  "KDUniqueBulletHits.has": translation(
    "KDUniqueBulletHits.has",
    "read-only",
    "no-native-state",
  ),
  KDRandom: translation(
    "KDRandom",
    "deterministic-random",
    "javascript-authoritative",
  ),
  KinkyDungeonMapGet: translation(
    "KinkyDungeonMapGet",
    "read-only",
    "no-native-state",
  ),
  KinkyDungeonTilesGet: translation(
    "KinkyDungeonTilesGet",
    "read-only",
    "no-native-state",
  ),
  KinkyDungeonTilesSet: translation(
    "KinkyDungeonTilesSet",
    "tile-metadata-write",
    "javascript-state-recaptured",
  ),
  KinkyDungeonEntityAt: translation(
    "KinkyDungeonEntityAt",
    "read-only",
    "no-native-state",
  ),
  KinkyDungeonEnemyAt: translation(
    "KinkyDungeonEnemyAt",
    "read-only",
    "no-native-state",
  ),
  KinkyDungeonGetEnemyByName: translation(
    "KinkyDungeonGetEnemyByName",
    "read-only",
    "no-native-state",
  ),
  KDGetEnemyCache: translation(
    "KDGetEnemyCache",
    "read-only",
    "no-native-state",
  ),
  KDNearbyEnemies: translation(
    "KDNearbyEnemies",
    "read-only",
    "no-native-state",
  ),
  KDGetEffectTiles: translation(
    "KDGetEffectTiles",
    "read-only",
    "no-native-state",
  ),
  KinkyDungeonGetClosestSpecialAreaDist: translation(
    "KinkyDungeonGetClosestSpecialAreaDist",
    "read-only",
    "no-native-state",
  ),
  KinkyDungeonMapSet: translation(
    "KinkyDungeonMapSet",
    "grid-write",
    "grid-identity-observed",
  ),
  KinkyDungeonMapSetForce: translation(
    "KinkyDungeonMapSetForce",
    "grid-write",
    "grid-identity-observed",
  ),
  KinkyDungeonMapDataSet: translation(
    "KinkyDungeonMapDataSet",
    "grid-write",
    "grid-identity-observed",
  ),
  KDCreateEffectTile: translation(
    "KDCreateEffectTile",
    "effect-tile-write",
    "javascript-state-recaptured",
  ),
  KDMoveEntity: translation(
    "KDMoveEntity",
    "entity-write",
    "javascript-state-recaptured",
  ),
  KDAddEntity: translation(
    "KDAddEntity",
    "entity-write",
    "javascript-state-recaptured",
  ),
  KinkyDungeonSummonEnemy: translation(
    "KinkyDungeonSummonEnemy",
    "entity-write",
    "javascript-state-recaptured",
  ),
  KinkyDungeonDamageEnemy: translation(
    "KinkyDungeonDamageEnemy",
    "entity-write",
    "javascript-state-recaptured",
  ),
  KinkyDungeonSetEnemyFlag: translation(
    "KinkyDungeonSetEnemyFlag",
    "entity-write",
    "javascript-state-recaptured",
  ),
  KDAddToParty: translation(
    "KDAddToParty",
    "entity-write",
    "javascript-state-recaptured",
  ),
  KDRemoveFromParty: translation(
    "KDRemoveFromParty",
    "entity-write",
    "javascript-state-recaptured",
  ),
  KinkyDungeonApplyBuffToEntity: translation(
    "KinkyDungeonApplyBuffToEntity",
    "buff-write",
    "javascript-state-recaptured",
  ),
  KDApplyBuff: translation(
    "KDApplyBuff",
    "buff-write",
    "javascript-state-recaptured",
  ),
  KinkyDungeonSendEvent: translation(
    "KinkyDungeonSendEvent",
    "event-dispatch",
    "javascript-callback",
  ),
  KinkyDungeonSendDialogue: translation(
    "KinkyDungeonSendDialogue",
    "ui-only",
    "no-native-state",
  ),
  KinkyDungeonSendTextMessage: translation(
    "KinkyDungeonSendTextMessage",
    "ui-only",
    "no-native-state",
  ),
  KinkyDungeonSendActionMessage: translation(
    "KinkyDungeonSendActionMessage",
    "ui-only",
    "no-native-state",
  ),
  DrawTextKD: translation("DrawTextKD", "ui-only", "no-native-state"),
  DrawButtonKDEx: translation("DrawButtonKDEx", "ui-only", "no-native-state"),
  KinkyDungeonMakeNoise: translation(
    "KinkyDungeonMakeNoise",
    "event-dispatch",
    "javascript-callback",
  ),
  KinkyDungeonMakeNoiseSignal: translation(
    "KinkyDungeonMakeNoiseSignal",
    "event-dispatch",
    "javascript-callback",
  ),
  KinkyDungeonAddRestraintText: translation(
    "KinkyDungeonAddRestraintText",
    "ui-only",
    "no-native-state",
  ),
  KinkyDungeonLoad: translation(
    "KinkyDungeonLoad",
    "game-state-write",
    "javascript-authoritative",
  ),
  KinkyDungeonLoadStats: translation(
    "KinkyDungeonLoadStats",
    "game-state-write",
    "javascript-authoritative",
  ),
  KinkyDungeonRefreshRestraintsCache: translation(
    "KinkyDungeonRefreshRestraintsCache",
    "game-state-write",
    "javascript-authoritative",
  ),
  "KinkyDungeonRestraints.forEach": translation(
    "KinkyDungeonRestraints.forEach",
    "read-only",
    "no-native-state",
  ),
  "KinkyDungeonRestraints.push": translation(
    "KinkyDungeonRestraints.push",
    "game-state-write",
    "javascript-authoritative",
  ),
  KDIsEdged: translation("KDIsEdged", "read-only", "no-native-state"),
  KinkyDungeonGagTotal: translation(
    "KinkyDungeonGagTotal",
    "read-only",
    "no-native-state",
  ),
  KinkyDungeonInterruptSleep: translation(
    "KinkyDungeonInterruptSleep",
    "game-state-write",
    "javascript-authoritative",
  ),
  KinkyDungeonHandleSpellCast: translation(
    "KinkyDungeonHandleSpellCast",
    "game-state-write",
    "javascript-authoritative",
  ),
  KinkyDungeonCastSpell: translation(
    "KinkyDungeonCastSpell",
    "game-state-write",
    "javascript-authoritative",
  ),
  KDChangeStamina: translation(
    "KDChangeStamina",
    "game-state-write",
    "javascript-authoritative",
  ),
  KDSendInput: translation(
    "KDSendInput",
    "game-state-write",
    "javascript-authoritative",
  ),
  KDModsAfterLoad: translation(
    "KDModsAfterLoad",
    "event-dispatch",
    "javascript-callback",
  ),
  KinkyDungeonChangeRep: translation(
    "KinkyDungeonChangeRep",
    "game-state-write",
    "javascript-authoritative",
  ),
  KinkyDungeonSetFlag: translation(
    "KinkyDungeonSetFlag",
    "game-state-write",
    "javascript-authoritative",
  ),
  KDSetFactionRelation: translation(
    "KDSetFactionRelation",
    "game-state-write",
    "javascript-authoritative",
  ),
  KDChangeFactionRelation: translation(
    "KDChangeFactionRelation",
    "game-state-write",
    "javascript-authoritative",
  ),
  KDAddOpinion: translation(
    "KDAddOpinion",
    "game-state-write",
    "javascript-authoritative",
  ),
  KDAddOpinionPersistent: translation(
    "KDAddOpinionPersistent",
    "game-state-write",
    "javascript-authoritative",
  ),
  KinkyDungeonFindSpell: translation(
    "KinkyDungeonFindSpell",
    "read-only",
    "no-native-state",
  ),
  KDEnemyName: translation("KDEnemyName", "read-only", "no-native-state"),
  KDRestraint: translation("KDRestraint", "read-only", "no-native-state"),
  KDItemDataQuery: translation(
    "KDItemDataQuery",
    "read-only",
    "no-native-state",
  ),
  KinkyDungeonGetRestraintByName: translation(
    "KinkyDungeonGetRestraintByName",
    "read-only",
    "no-native-state",
  ),
  KDistEuclidean: translation("KDistEuclidean", "read-only", "no-native-state"),
  KDFactionRelation: translation(
    "KDFactionRelation",
    "read-only",
    "no-native-state",
  ),
  KDGetMainFaction: translation(
    "KDGetMainFaction",
    "read-only",
    "no-native-state",
  ),
  KDGetPersonality: translation(
    "KDGetPersonality",
    "read-only",
    "no-native-state",
  ),
  KDEnemyHelpfulness: translation(
    "KDEnemyHelpfulness",
    "read-only",
    "no-native-state",
  ),
  KDHelpless: translation("KDHelpless", "read-only", "no-native-state"),
  KDIsImprisoned: translation("KDIsImprisoned", "read-only", "no-native-state"),
  KDCanSeeEnemy: translation("KDCanSeeEnemy", "read-only", "no-native-state"),
  KDEnemyHasFlag: translation("KDEnemyHasFlag", "read-only", "no-native-state"),
  KinkyDungeonCanPlay: translation(
    "KinkyDungeonCanPlay",
    "read-only",
    "no-native-state",
  ),
  KDIsSubmissiveEnough: translation(
    "KDIsSubmissiveEnough",
    "read-only",
    "no-native-state",
  ),
  KDEnemyCanTalk: translation("KDEnemyCanTalk", "read-only", "no-native-state"),
  KDAllied: translation("KDAllied", "read-only", "no-native-state"),
  KDEntityHasFlag: translation(
    "KDEntityHasFlag",
    "read-only",
    "no-native-state",
  ),
  KDHostile: translation("KDHostile", "read-only", "no-native-state"),
  KDFactionHostile: translation(
    "KDFactionHostile",
    "read-only",
    "no-native-state",
  ),
  KDGetFaction: translation("KDGetFaction", "read-only", "no-native-state"),
  KDistChebyshev: translation("KDistChebyshev", "read-only", "no-native-state"),
  KinkyDungeonCheckLOS: translation(
    "KinkyDungeonCheckLOS",
    "read-only",
    "no-native-state",
  ),
  KinkyDungeonCheckPath: translation(
    "KinkyDungeonCheckPath",
    "read-only",
    "no-native-state",
  ),
  KinkyDungeonGetBuffedStat: translation(
    "KinkyDungeonGetBuffedStat",
    "read-only",
    "no-native-state",
  ),
  KDIsInParty: translation("KDIsInParty", "read-only", "no-native-state"),
  KDIsServant: translation("KDIsServant", "read-only", "no-native-state"),
  KDIsHumanoid: translation("KDIsHumanoid", "read-only", "no-native-state"),
  KDIsImmobile: translation("KDIsImmobile", "read-only", "no-native-state"),
  KinkyDungeonIsDisabled: translation(
    "KinkyDungeonIsDisabled",
    "read-only",
    "no-native-state",
  ),
  KDBoundEffects: translation("KDBoundEffects", "read-only", "no-native-state"),
  KDGetFactionOriginal: translation(
    "KDGetFactionOriginal",
    "read-only",
    "no-native-state",
  ),
} satisfies Record<string, KDApiTranslation>);

export type RecognizedKDApi = keyof typeof API_TRANSLATIONS;

export function translateOfficialKDApi(
  api: string,
): KDApiTranslation | undefined {
  return (API_TRANSLATIONS as Readonly<Record<string, KDApiTranslation>>)[api];
}

export interface AuditedLegacyModProfile {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly archiveSha256: string;
  readonly archiveEntries: readonly string[];
  readonly recognizedApis: readonly string[];
  readonly javascriptEvents: readonly string[];
  readonly replacedGlobals: readonly string[];
  readonly directWrites: readonly string[];
  readonly safeSourceOptimizations: readonly MapGenerationSourceOptimization[];
}

const ALL_MAP_GENERATION_SOURCE_OPTIMIZATIONS =
  MAP_GENERATION_SOURCE_OPTIMIZATIONS;

export const AUDITED_LEGACY_MOD_PROFILES = Object.freeze([
  profile({
    id: "useful-tooltips-1.33",
    name: "Useful Tooltips",
    version: "1.33",
    archiveSha256:
      "d529b818ce537c5989190957b3f97e2965c231186f65a67fc7afaab0b3136cfe",
    archiveEntries: ["mod.json", "UsefulTooltips.ks"],
    recognizedApis: [
      "addTextKey",
      "KinkyDungeonSendTextMessage",
      "TextGet",
      "KinkyDungeonFlags.get",
      "KinkyDungeonHiddenFactions.has",
      "KDStatRep.includes",
      "KDCanSeeEnemy",
      "KDGetPersonality",
      "KDEnemyHelpfulness",
      "KDEnemyHasFlag",
      "KDFactionRelation",
      "KDGetFactionOriginal",
      "KinkyDungeonCanPlay",
      "KDIsSubmissiveEnough",
      "KDEnemyCanTalk",
      "KDAllied",
      "KDHelpless",
      "KDIsImprisoned",
      "DrawBoxKD",
      "KDDraw",
      "MouseIn",
      "DrawTextFitKD",
    ],
    javascriptEvents: [
      "generic.afterModSettingsLoad",
      "generic.afterModConfig",
      "generic.tick",
    ],
    replacedGlobals: [
      "KDTileTooltips.B",
      "KDDrawTooltip",
      "KinkyDungeonDrawReputation",
    ],
    directWrites: ["KDModSettings", "KDModConfigs"],
    safeSourceOptimizations: ALL_MAP_GENERATION_SOURCE_OPTIMIZATIONS,
  }),
  profile({
    id: "prisoner-revaluation-1.14",
    name: "Prisoner Revaluation",
    version: "1.14",
    archiveSha256:
      "43218198e3920546ab1bdb822f0aedc43560852a3fae22d5b0bcd34fc063c16d",
    archiveEntries: ["mod.json", "PrisonerRevaluation.ks"],
    recognizedApis: [
      "addTextKey",
      "TextGet",
      "KinkyDungeonSendDialogue",
      "KinkyDungeonHiddenFactions.has",
      "KDGetMainFaction",
      "KDFactionRelation",
      "KDRandom",
      "KinkyDungeonChangeRep",
    ],
    javascriptEvents: [
      "generic.afterModSettingsLoad",
      "generic.afterModConfig",
      "guard.jailRemovePrisonerRep",
      "dom.mouseup",
    ],
    replacedGlobals: ["KDAssignGuardAction"],
    directWrites: [
      "KDGuardActions.jailRemovePrisonerRep",
      "KDGameData.GuardApplyTime",
      "guard.CurrentAction",
    ],
    safeSourceOptimizations: ALL_MAP_GENERATION_SOURCE_OPTIMIZATIONS,
  }),
  profile({
    id: "breach-explosives-1.04",
    name: "Breach Explosives",
    // The supplied v1.04 archive reports modbuild 1.03 in mod.json.
    version: "1.04 (manifest 1.03)",
    archiveSha256:
      "7f725792050d4f7457dbe2445abf3df2347c89ed61420b1b11a2d76052b42354",
    archiveEntries: ["BreachExplosives.ks", "mod.json"],
    recognizedApis: [
      "KinkyDungeonFindSpell",
      "KDistEuclidean",
      "KinkyDungeonMapGet",
      "KDCreateEffectTile",
      "KDRandom",
      "KinkyDungeonMapSet",
      "KinkyDungeonTilesGet",
    ],
    javascriptEvents: [
      "generic.afterModSettingsLoad",
      "bullet.afterBulletHit.BreachExplosive",
    ],
    replacedGlobals: [],
    directWrites: ["spell.events", "tile.Type", "KinkyDungeonUpdateLightGrid"],
    safeSourceOptimizations: ALL_MAP_GENERATION_SOURCE_OPTIMIZATIONS,
  }),
] satisfies readonly AuditedLegacyModProfile[]);

export interface LegacyModArchive {
  readonly name: string;
  readonly blob: Blob;
}

export interface LegacyModArchiveEntry {
  readonly filename: string;
  readonly directory: boolean;
  readonly uncompressedBytes: number;
  readonly source?: string;
}

export interface LegacyModArchiveReadLimits {
  readonly maxEntries: number;
  readonly maxExecutableFiles: number;
  readonly maxExecutableBytes: number;
  readonly maxTotalExecutableBytes: number;
}

export type LegacyModArchiveReader = (
  archive: LegacyModArchive,
  limits: LegacyModArchiveReadLimits,
) => Promise<readonly LegacyModArchiveEntry[]>;

export type LegacyModTranslationState =
  "idle" | "inspecting" | "compatible" | "fallback" | "failed" | "disposed";

export interface LegacyModTranslationProfileStatus {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly effects: readonly KDApiEffect[];
  readonly javascriptEvents: readonly string[];
}

export interface LegacyModTranslationStatus {
  readonly version: 1;
  readonly state: LegacyModTranslationState;
  readonly reason: string | null;
  readonly archiveCount: number;
  readonly profiles: readonly LegacyModTranslationProfileStatus[];
  readonly allowedSourceOptimizations: readonly MapGenerationSourceOptimization[];
}

export interface KDHybridModCompatibilityApi {
  readonly version: 1;
  inspect(
    archives: readonly LegacyModArchive[],
  ): Promise<LegacyModTranslationStatus>;
  allowsSourceOptimization(
    optimization: MapGenerationSourceOptimization,
    loadedFiles: unknown,
  ): boolean;
  status(): LegacyModTranslationStatus;
}

export interface LegacyModTranslatorOptions {
  readonly profiles?: readonly AuditedLegacyModProfile[];
  readonly digest?: (blob: Blob) => Promise<string>;
  readonly readArchive?: LegacyModArchiveReader;
  /**
   * Test/embedding override. The browser default snapshots KD's own global
   * function surface synchronously before the first selected mod executes.
   */
  readonly officialApis?: readonly string[];
  readonly maxArchives?: number;
  readonly maxArchiveBytes?: number;
  readonly maxTotalBytes?: number;
  readonly maxArchiveEntries?: number;
  readonly maxTotalEntries?: number;
  readonly maxExecutableFiles?: number;
  readonly maxTotalExecutableFiles?: number;
  readonly maxExecutableBytes?: number;
  readonly maxTotalExecutableBytes?: number;
}

const DEFAULT_MAX_ARCHIVES = 64;
const DEFAULT_MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const DEFAULT_MAX_ARCHIVE_ENTRIES = 8_192;
const DEFAULT_MAX_TOTAL_ENTRIES = 32_768;
const DEFAULT_MAX_EXECUTABLE_FILES = 256;
const DEFAULT_MAX_TOTAL_EXECUTABLE_FILES = 1_024;
const DEFAULT_MAX_EXECUTABLE_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_EXECUTABLE_BYTES = 64 * 1024 * 1024;
const trustedCompatibilityApis = new WeakSet<KDHybridModCompatibilityApi>();

export function createLegacyModTranslator(
  options: LegacyModTranslatorOptions = {},
): KDHybridModCompatibilityApi & { dispose(): void } {
  const profiles = new Map(
    (options.profiles ?? AUDITED_LEGACY_MOD_PROFILES).map((candidate) => [
      candidate.archiveSha256.toLowerCase(),
      candidate,
    ]),
  );
  const digest = options.digest ?? sha256Blob;
  const readArchive = options.readArchive ?? readArchiveWithKDZipModel;
  const maxArchives = options.maxArchives ?? DEFAULT_MAX_ARCHIVES;
  const maxArchiveBytes = options.maxArchiveBytes ?? DEFAULT_MAX_ARCHIVE_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  const maxArchiveEntries =
    options.maxArchiveEntries ?? DEFAULT_MAX_ARCHIVE_ENTRIES;
  const maxTotalEntries = options.maxTotalEntries ?? DEFAULT_MAX_TOTAL_ENTRIES;
  const maxExecutableFiles =
    options.maxExecutableFiles ?? DEFAULT_MAX_EXECUTABLE_FILES;
  const maxTotalExecutableFiles =
    options.maxTotalExecutableFiles ?? DEFAULT_MAX_TOTAL_EXECUTABLE_FILES;
  const maxExecutableBytes =
    options.maxExecutableBytes ?? DEFAULT_MAX_EXECUTABLE_BYTES;
  const maxTotalExecutableBytes =
    options.maxTotalExecutableBytes ?? DEFAULT_MAX_TOTAL_EXECUTABLE_BYTES;
  const readLimits = Object.freeze({
    maxEntries: maxArchiveEntries,
    maxExecutableFiles,
    maxExecutableBytes,
    maxTotalExecutableBytes,
  });
  let generation = 0;
  let expectedEntries: readonly string[] = Object.freeze([]);
  let acceptedProfiles: readonly AuditedLegacyModProfile[] = Object.freeze([]);
  let status = freezeStatus({
    version: 1,
    state: "idle",
    reason: null,
    archiveCount: 0,
    profiles: [],
    allowedSourceOptimizations: [],
  });

  const api = {
    version: 1 as const,
    async inspect(
      archives: readonly LegacyModArchive[],
    ): Promise<LegacyModTranslationStatus> {
      const currentGeneration = ++generation;
      if (status.state === "disposed") {
        return status;
      }
      status = freezeStatus({
        version: 1,
        state: "inspecting",
        reason: null,
        archiveCount: archives.length,
        profiles: [],
        allowedSourceOptimizations: [],
      });
      expectedEntries = Object.freeze([]);
      acceptedProfiles = Object.freeze([]);

      try {
        const officialApis = new Set(
          options.officialApis ?? snapshotOfficialKDGlobalFunctions(),
        );
        if (archives.length > maxArchives) {
          return commitFallback(
            currentGeneration,
            `archive-count-exceeds-${maxArchives}`,
            archives.length,
          );
        }
        let totalBytes = 0;
        let totalEntries = 0;
        let totalExecutableFiles = 0;
        let totalExecutableBytes = 0;
        const matched: AuditedLegacyModProfile[] = [];
        const seenDigests = new Set<string>();
        for (const archive of archives) {
          if (!isBlobLike(archive.blob)) {
            return commitFallback(
              currentGeneration,
              "invalid-archive-object",
              archives.length,
            );
          }
          if (archive.blob.size > maxArchiveBytes) {
            return commitFallback(
              currentGeneration,
              "archive-too-large",
              archives.length,
            );
          }
          totalBytes += archive.blob.size;
          if (totalBytes > maxTotalBytes) {
            return commitFallback(
              currentGeneration,
              "archive-total-too-large",
              archives.length,
            );
          }
          const hash = (await digest(archive.blob)).toLowerCase();
          if (
            currentGeneration !== generation ||
            isDisposedTranslationStatus(status)
          ) {
            return status;
          }
          if (!/^[a-f0-9]{64}$/u.test(hash)) {
            return commitFailure(
              currentGeneration,
              "invalid-digest",
              archives.length,
            );
          }
          if (seenDigests.has(hash)) {
            return commitFallback(
              currentGeneration,
              "duplicate-archive",
              archives.length,
            );
          }
          seenDigests.add(hash);
          const matchedProfile = profiles.get(hash);
          if (matchedProfile !== undefined) {
            totalEntries += matchedProfile.archiveEntries.length;
            if (totalEntries > maxTotalEntries) {
              return commitFallback(
                currentGeneration,
                "archive-entry-total-too-large",
                archives.length,
              );
            }
            matched.push(matchedProfile);
            continue;
          }

          let archiveEntries: readonly LegacyModArchiveEntry[];
          try {
            archiveEntries = await readArchive(archive, readLimits);
          } catch {
            return commitFallback(
              currentGeneration,
              "archive-read-error",
              archives.length,
            );
          }
          if (
            currentGeneration !== generation ||
            isDisposedTranslationStatus(status)
          ) {
            return status;
          }
          const contentProfile = createContentInspectedProfile(
            archive,
            hash,
            archiveEntries,
            readLimits,
            officialApis,
          );
          if (contentProfile.profile === null) {
            return commitFallback(
              currentGeneration,
              contentProfile.reason,
              archives.length,
            );
          }
          totalEntries += contentProfile.entryCount;
          totalExecutableFiles += contentProfile.executableFiles;
          totalExecutableBytes += contentProfile.executableBytes;
          if (totalEntries > maxTotalEntries) {
            return commitFallback(
              currentGeneration,
              "archive-entry-total-too-large",
              archives.length,
            );
          }
          if (totalExecutableFiles > maxTotalExecutableFiles) {
            return commitFallback(
              currentGeneration,
              "executable-file-total-too-large",
              archives.length,
            );
          }
          if (totalExecutableBytes > maxTotalExecutableBytes) {
            return commitFallback(
              currentGeneration,
              "executable-byte-total-too-large",
              archives.length,
            );
          }
          matched.push(contentProfile.profile);
        }

        const allowed = intersectSourceOptimizations(matched);
        const entries = matched
          .flatMap((candidate) => candidate.archiveEntries)
          .sort((left, right) => left.localeCompare(right));
        acceptedProfiles = Object.freeze([...matched]);
        expectedEntries = Object.freeze(entries);
        status = freezeStatus({
          version: 1,
          state: "compatible",
          reason: null,
          archiveCount: archives.length,
          profiles: matched.map(profileStatus),
          allowedSourceOptimizations: allowed,
        });
        return status;
      } catch {
        return commitFailure(
          currentGeneration,
          "inspection-error",
          archives.length,
        );
      }
    },
    allowsSourceOptimization(
      optimization: MapGenerationSourceOptimization,
      loadedFiles: unknown,
    ): boolean {
      if (
        status.state !== "compatible" ||
        !status.allowedSourceOptimizations.includes(optimization) ||
        !Array.isArray(loadedFiles)
      ) {
        return false;
      }
      const actualEntries: string[] = [];
      for (const entry of loadedFiles) {
        if (
          typeof entry !== "object" ||
          entry === null ||
          typeof (entry as { readonly filename?: unknown }).filename !==
            "string"
        ) {
          return false;
        }
        actualEntries.push((entry as { readonly filename: string }).filename);
      }
      actualEntries.sort((left, right) => left.localeCompare(right));
      return (
        actualEntries.length === expectedEntries.length &&
        actualEntries.every(
          (entry, index) => entry === expectedEntries[index],
        ) &&
        acceptedProfiles.length === status.profiles.length
      );
    },
    status: () => status,
    dispose(): void {
      generation += 1;
      trustedCompatibilityApis.delete(api);
      expectedEntries = Object.freeze([]);
      acceptedProfiles = Object.freeze([]);
      status = freezeStatus({
        version: 1,
        state: "disposed",
        reason: "disposed",
        archiveCount: 0,
        profiles: [],
        allowedSourceOptimizations: [],
      });
    },
  };

  function commitFallback(
    expectedGeneration: number,
    reason: string,
    archiveCount: number,
  ): LegacyModTranslationStatus {
    if (expectedGeneration !== generation || status.state === "disposed") {
      return status;
    }
    expectedEntries = Object.freeze([]);
    acceptedProfiles = Object.freeze([]);
    status = freezeStatus({
      version: 1,
      state: "fallback",
      reason,
      archiveCount,
      profiles: [],
      allowedSourceOptimizations: [],
    });
    return status;
  }

  function commitFailure(
    expectedGeneration: number,
    reason: string,
    archiveCount: number,
  ): LegacyModTranslationStatus {
    if (expectedGeneration !== generation || status.state === "disposed") {
      return status;
    }
    expectedEntries = Object.freeze([]);
    acceptedProfiles = Object.freeze([]);
    status = freezeStatus({
      version: 1,
      state: "failed",
      reason,
      archiveCount,
      profiles: [],
      allowedSourceOptimizations: [],
    });
    return status;
  }

  const frozenApi = Object.freeze(api);
  trustedCompatibilityApis.add(frozenApi);
  return frozenApi;
}

export interface KDModLoaderEntry {
  readonly mod: Blob;
  readonly name: string;
}

export interface KDModLoaderEnvironment {
  readExecuteMods(): ((...args: unknown[]) => unknown) | undefined;
  replaceExecuteMods(
    expected: (...args: unknown[]) => unknown,
    replacement: (...args: unknown[]) => unknown,
  ): boolean;
  readModLoadOrder(): readonly KDModLoaderEntry[] | undefined;
  schedule(callback: () => void, delayMs: number): unknown;
  cancelScheduled(handle: unknown): void;
}

export interface KinkyDungeonModTranslatorHandle {
  readonly api: KDHybridModCompatibilityApi;
  readonly loaderReady: Promise<boolean>;
  status(): LegacyModTranslationStatus;
  dispose(): void;
}

declare let KDExecuteMods: ((...args: unknown[]) => unknown) | undefined;
declare let KDModLoadOrder: readonly KDModLoaderEntry[] | undefined;

const browserLoaderEnvironment: KDModLoaderEnvironment = {
  readExecuteMods: () => {
    try {
      return typeof KDExecuteMods === "function" ? KDExecuteMods : undefined;
    } catch {
      return undefined;
    }
  },
  replaceExecuteMods: (expected, replacement) => {
    try {
      if (KDExecuteMods !== expected) {
        return false;
      }
      KDExecuteMods = replacement;
      return KDExecuteMods === replacement;
    } catch {
      return false;
    }
  },
  readModLoadOrder: () => {
    try {
      return Array.isArray(KDModLoadOrder) ? KDModLoadOrder : undefined;
    } catch {
      return undefined;
    }
  },
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancelScheduled: (handle) =>
    clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function installKinkyDungeonModTranslator(
  environment: KDModLoaderEnvironment = browserLoaderEnvironment,
  options: LegacyModTranslatorOptions = {},
): KinkyDungeonModTranslatorHandle {
  const target = globalThis as typeof globalThis & {
    KDHybridModCompatibility?: KDHybridModCompatibilityApi;
  };
  const translator = createLegacyModTranslator(options);
  const previous = target.KDHybridModCompatibility;
  target.KDHybridModCompatibility = translator;
  let disposed = false;
  let scheduled: unknown;
  let official: ((...args: unknown[]) => unknown) | undefined;
  let replacement: ((...args: unknown[]) => unknown) | undefined;
  let resolveReady: ((ready: boolean) => void) | undefined;
  const loaderReady = new Promise<boolean>((resolve) => {
    resolveReady = resolve;
  });
  const deadline = Date.now() + 15_000;
  let attempts = 0;

  const tryInstall = (): void => {
    if (disposed) {
      resolveReady?.(false);
      resolveReady = undefined;
      return;
    }
    const candidate = environment.readExecuteMods();
    if (candidate === undefined) {
      if (Date.now() >= deadline) {
        resolveReady?.(false);
        resolveReady = undefined;
        return;
      }
      attempts += 1;
      scheduled = environment.schedule(tryInstall, attempts < 4 ? 0 : 25);
      return;
    }
    official = candidate;
    replacement = function KDExecuteMods(
      this: unknown,
      ...args: unknown[]
    ): unknown {
      const order = environment.readModLoadOrder();
      let inspection: Promise<LegacyModTranslationStatus>;
      if (order === undefined) {
        inspection = translator.inspect([
          {
            name: "unavailable-load-order",
            blob: new Blob([]),
          },
        ]);
      } else {
        inspection = translator.inspect(
          order.map((entry) => ({
            name: entry.name,
            blob: entry.mod,
          })),
        );
      }
      // KDGetModsLoad deliberately does not await KDExecuteMods. Invoke the
      // official function in the same synchronous turn so its loading flags
      // and promise semantics remain observable to callers.
      const officialResult = Reflect.apply(candidate, this, args);
      if (!isPromiseLike(officialResult)) {
        void inspection;
        return officialResult;
      }
      return Promise.resolve(officialResult).then(
        async (value) => {
          await inspection;
          return value;
        },
        async (error: unknown) => {
          await inspection;
          throw error;
        },
      );
    };
    try {
      Object.defineProperty(replacement, "name", {
        configurable: true,
        value: candidate.name,
      });
    } catch {
      // Function names are diagnostic only.
    }
    const installed = environment.replaceExecuteMods(candidate, replacement);
    resolveReady?.(installed);
    resolveReady = undefined;
  };

  tryInstall();

  return Object.freeze({
    api: translator,
    loaderReady,
    status: () => translator.status(),
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      if (scheduled !== undefined) {
        environment.cancelScheduled(scheduled);
      }
      if (official !== undefined && replacement !== undefined) {
        environment.replaceExecuteMods(replacement, official);
      }
      translator.dispose();
      if (target.KDHybridModCompatibility === translator) {
        if (previous === undefined) {
          Reflect.deleteProperty(target, "KDHybridModCompatibility");
        } else {
          target.KDHybridModCompatibility = previous;
        }
      }
      resolveReady?.(false);
      resolveReady = undefined;
    },
  });
}

export interface KDModRegistryEnvironment {
  modsLoaded(): unknown;
  allModFiles(): unknown;
  setModsLoaded(value: boolean): void;
  setAllModFiles(value: unknown[]): void;
  compatibility(): KDHybridModCompatibilityApi | undefined;
}

declare let KDModsLoaded: boolean | undefined;
declare let KDAllModFiles: unknown[] | undefined;

const browserModRegistryEnvironment: KDModRegistryEnvironment = {
  modsLoaded: () => {
    try {
      return KDModsLoaded;
    } catch {
      return undefined;
    }
  },
  allModFiles: () => {
    try {
      return KDAllModFiles;
    } catch {
      return undefined;
    }
  },
  setModsLoaded: (value) => {
    KDModsLoaded = value;
  },
  setAllModFiles: (value) => {
    KDAllModFiles = value;
  },
  compatibility: () =>
    (
      globalThis as typeof globalThis & {
        KDHybridModCompatibility?: KDHybridModCompatibilityApi;
      }
    ).KDHybridModCompatibility,
};

/**
 * Lets the already-guarded v67 source fast paths run for audited or
 * content-proven mods during one official map-generation transaction.
 *
 * The real registry objects are never mutated. Their lexical bindings are
 * restored in `finally`, and any missing proof or unusual registry shape runs
 * the callback without translation.
 */
export function runWithKDTranslatedModSourceOptimizations<T>(
  callback: () => T,
  environment: KDModRegistryEnvironment = browserModRegistryEnvironment,
  recordActivation?: (active: boolean) => void,
): T {
  let modsLoaded: unknown;
  let loadedFiles: unknown;
  let compatibility: KDHybridModCompatibilityApi | undefined;
  try {
    modsLoaded = environment.modsLoaded();
    loadedFiles = environment.allModFiles();
    compatibility = environment.compatibility();
  } catch {
    recordActivationSafely(recordActivation, false);
    return callback();
  }
  let eligible = false;
  try {
    eligible =
      globalThis.KDHybridRuntimeControl
        ?.disableTranslatedModSourceOptimizations !== true &&
      modsLoaded === true &&
      Array.isArray(loadedFiles) &&
      loadedFiles.length > 0 &&
      compatibility !== undefined &&
      trustedCompatibilityApis.has(compatibility) &&
      MAP_GENERATION_SOURCE_OPTIMIZATIONS.every((optimization) =>
        compatibility.allowsSourceOptimization(optimization, loadedFiles),
      );
  } catch {
    eligible = false;
  }
  if (!eligible) {
    recordActivationSafely(recordActivation, false);
    return callback();
  }

  let changedModsLoaded = false;
  let changedModFiles = false;
  try {
    environment.setModsLoaded(false);
    changedModsLoaded = true;
    environment.setAllModFiles([]);
    changedModFiles = true;
    recordActivationSafely(recordActivation, true);
    return callback();
  } finally {
    try {
      if (changedModFiles) {
        environment.setAllModFiles(loadedFiles as unknown[]);
      }
    } finally {
      if (changedModsLoaded) {
        environment.setModsLoaded(true);
      }
    }
  }
}

function recordActivationSafely(
  recordActivation: ((active: boolean) => void) | undefined,
  active: boolean,
): void {
  try {
    recordActivation?.(active);
  } catch {
    // Developer-only diagnostics must never affect official game behavior.
  }
}

interface ContentInspectedProfileResult {
  readonly profile: AuditedLegacyModProfile | null;
  readonly reason: string;
  readonly entryCount: number;
  readonly executableFiles: number;
  readonly executableBytes: number;
}

const SOURCE_SENSITIVE_GLOBALS = new Set([
  "KDAllModFiles",
  "KDCheckMapTileFilling",
  "KDGetRestraintsEligible",
  "KDGeteligrest_gettags",
  "KDLooseIndexRankingSuspend",
  "KDModsLoaded",
  "KDPathCache",
  "KDPathCacheIgnoreLocks",
  "KDSetPathfindCache",
  "KD_GetMapTile",
  "KD_PasteTile",
  "KinkyDungeonCreateMap",
  "KinkyDungeonFindPath",
  "KinkyDungeonGetAccessible",
  "KinkyDungeonGetAccessibleRoom",
  "KinkyDungeonGetPath",
  "KinkyDungeonGroundTiles",
  "KinkyDungeonMapGet",
  "KinkyDungeonMapSet",
  "KinkyDungeonMapSetForce",
  "KinkyDungeonMovableTilesEnemy",
  "KinkyDungeonMovableTilesSmartEnemy",
  "KinkyDungeonPlaceDoors",
  "KinkyDungeonRestraints",
  "KinkyDungeonTilesGet",
  "KinkyDungeonTilesSet",
]);
const SOURCE_SENSITIVE_PREFIXES = Object.freeze([
  "KDHybrid",
  "KDMapTilesPopulate",
  "KinkyDungeonCreateMapGenType",
  "KinkyDungeonGenerateSetpiece",
  "KinkyDungeonPlace",
] as const);
const CONTENT_SAFE_GLOBAL_STATE_ASSIGNMENTS = new Set([
  "KDExpressions",
  "KDLoadingTextKeys",
  "KDModConfigs",
  "KDModSettings",
  "KDModsAfterLoad",
  // Input dispatch is not read by any map-generation source fast path.
  "KDSendInput",
  "KinkyDungeonUpdateLightGrid",
]);

function createContentInspectedProfile(
  archive: LegacyModArchive,
  hash: string,
  entries: readonly LegacyModArchiveEntry[],
  limits: LegacyModArchiveReadLimits,
  officialApis: ReadonlySet<string>,
): ContentInspectedProfileResult {
  if (!Array.isArray(entries)) {
    return contentProfileFailure("invalid-archive-entry-list");
  }
  if (entries.length > limits.maxEntries) {
    return contentProfileFailure("archive-entry-count-too-large");
  }

  const filenames: string[] = [];
  const seenFilenames = new Set<string>();
  const recognizedApis = new Set<string>();
  const javascriptEvents = new Set<string>();
  const replacedGlobals = new Set<string>();
  const directWrites = new Set<string>();
  let executableFiles = 0;
  let executableBytes = 0;

  for (const entry of entries) {
    if (!isLegacyModArchiveEntry(entry)) {
      return contentProfileFailure("invalid-archive-entry");
    }
    if (!isSafeArchiveFilename(entry.filename)) {
      return contentProfileFailure("unsafe-archive-filename");
    }
    if (seenFilenames.has(entry.filename)) {
      return contentProfileFailure("duplicate-archive-entry");
    }
    seenFilenames.add(entry.filename);
    filenames.push(entry.filename);
    if (entry.directory || !isExecutableModFilename(entry.filename)) {
      continue;
    }
    if (typeof entry.source !== "string") {
      return contentProfileFailure("missing-executable-source");
    }
    if (entry.source.includes("\0")) {
      return contentProfileFailure("executable-source-contains-null");
    }
    executableFiles += 1;
    const actualBytes = utf8Length(entry.source);
    const boundedBytes = Math.max(entry.uncompressedBytes, actualBytes);
    executableBytes += boundedBytes;
    if (
      executableFiles > limits.maxExecutableFiles ||
      boundedBytes > limits.maxExecutableBytes ||
      executableBytes > limits.maxTotalExecutableBytes
    ) {
      return contentProfileFailure("executable-source-too-large");
    }

    const analysis = analyzeOfficialModSource(entry.source, {
      recognizeApi: (api) =>
        translateOfficialKDApi(api) !== undefined || officialApis.has(api),
      isSensitiveWrite: isSourceSensitiveWrite,
    });
    if (!analysis.compatible) {
      return contentProfileFailure(
        `content-${analysis.reason ?? "incompatible-source"}`,
      );
    }
    for (const api of analysis.recognizedApis) {
      recognizedApis.add(api);
    }
    for (const event of analysis.javascriptEvents) {
      javascriptEvents.add(event);
    }
    for (const replaced of analysis.replacedGlobals) {
      replacedGlobals.add(replaced);
    }
    for (const write of analysis.directWrites) {
      directWrites.add(write);
    }
  }

  const displayName =
    archive.name.replace(/\.zip$/iu, "").trim() || "Content-inspected mod";
  return {
    profile: profile({
      id: `official-api-${hash.slice(0, 16)}`,
      name: displayName,
      version: "content-inspected",
      archiveSha256: hash,
      archiveEntries: filenames,
      recognizedApis: [...recognizedApis].sort(),
      javascriptEvents: [...javascriptEvents].sort(),
      replacedGlobals: [...replacedGlobals].sort(),
      directWrites: [...directWrites].sort(),
      safeSourceOptimizations: ALL_MAP_GENERATION_SOURCE_OPTIMIZATIONS,
    }),
    reason: "",
    entryCount: entries.length,
    executableFiles,
    executableBytes,
  };
}

function contentProfileFailure(reason: string): ContentInspectedProfileResult {
  return {
    profile: null,
    reason,
    entryCount: 0,
    executableFiles: 0,
    executableBytes: 0,
  };
}

function isSourceSensitiveWrite(
  path: string,
  kind: OfficialModWriteKind,
): boolean {
  const root = path.split(".", 1)[0] ?? path;
  if (
    path === root &&
    (kind === "assignment" || kind === "delete" || kind === "update") &&
    (root.startsWith("KD") || root.startsWith("KinkyDungeon")) &&
    !CONTENT_SAFE_GLOBAL_STATE_ASSIGNMENTS.has(root)
  ) {
    return true;
  }
  if (SOURCE_SENSITIVE_PREFIXES.some((prefix) => root.startsWith(prefix))) {
    return true;
  }
  if (!SOURCE_SENSITIVE_GLOBALS.has(root)) {
    return false;
  }
  if (
    kind === "mutation" &&
    (root === "KinkyDungeonRestraints" ||
      root === "KinkyDungeonGroundTiles" ||
      root === "KinkyDungeonMovableTilesEnemy" ||
      root === "KinkyDungeonMovableTilesSmartEnemy")
  ) {
    return false;
  }
  return path === root || root === "KDAllModFiles" || root === "KDHybrid";
}

function isLegacyModArchiveEntry(
  value: unknown,
): value is LegacyModArchiveEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as {
    readonly filename?: unknown;
    readonly directory?: unknown;
    readonly uncompressedBytes?: unknown;
    readonly source?: unknown;
  };
  return (
    typeof candidate.filename === "string" &&
    typeof candidate.directory === "boolean" &&
    Number.isSafeInteger(candidate.uncompressedBytes) &&
    (candidate.uncompressedBytes as number) >= 0 &&
    (candidate.source === undefined || typeof candidate.source === "string")
  );
}

function isSafeArchiveFilename(filename: string): boolean {
  if (
    filename.length === 0 ||
    filename.length > 2_048 ||
    filename.includes("\0") ||
    filename.startsWith("/") ||
    filename.startsWith("\\") ||
    /^[A-Za-z]:/u.test(filename)
  ) {
    return false;
  }
  return !filename.split(/[\\/]/u).some((part) => part === "..");
}

function isExecutableModFilename(filename: string): boolean {
  // Keep this case-sensitive to match KD's official processFile checks.
  return filename.endsWith(".js") || filename.endsWith(".ks");
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function snapshotOfficialKDGlobalFunctions(): readonly string[] {
  let names: string[];
  try {
    names = Object.getOwnPropertyNames(globalThis);
  } catch {
    return Object.freeze([]);
  }
  const result: string[] = [];
  for (const name of names) {
    if (
      (!name.startsWith("KD") && !name.startsWith("KinkyDungeon")) ||
      name.startsWith("KDHybrid")
    ) {
      continue;
    }
    try {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
      if (typeof descriptor?.value === "function") {
        result.push(name);
      }
    } catch {
      // Host accessors are not part of the stable official function surface.
    }
  }
  return Object.freeze(result.sort());
}

interface KDZipModelEntry {
  readonly filename?: unknown;
  readonly directory?: unknown;
  readonly uncompressedSize?: unknown;
}

interface KDZipModel {
  getEntries(
    file: Blob,
    options?: Readonly<Record<string, unknown>>,
  ): Promise<readonly KDZipModelEntry[]>;
  getURL(
    entry: KDZipModelEntry,
    options?: Readonly<Record<string, unknown>>,
  ): Promise<string>;
}

declare const model: KDZipModel | undefined;

export async function readArchiveWithKDZipModel(
  archive: LegacyModArchive,
  limits: LegacyModArchiveReadLimits,
): Promise<readonly LegacyModArchiveEntry[]> {
  let zipModel: KDZipModel | undefined;
  try {
    zipModel = model;
  } catch {
    zipModel = undefined;
  }
  if (
    zipModel === undefined ||
    typeof zipModel.getEntries !== "function" ||
    typeof zipModel.getURL !== "function"
  ) {
    throw new Error("KD ZIP model is unavailable");
  }
  const rawEntries = await zipModel.getEntries(archive.blob, {});
  if (!Array.isArray(rawEntries) || rawEntries.length > limits.maxEntries) {
    throw new Error("Archive entry limit exceeded");
  }

  let executableFiles = 0;
  let declaredExecutableBytes = 0;
  for (const rawEntry of rawEntries) {
    const filename =
      typeof rawEntry.filename === "string" ? rawEntry.filename : "";
    const directory = rawEntry.directory === true;
    if (directory || !isExecutableModFilename(filename)) {
      continue;
    }
    executableFiles += 1;
    const declaredBytes =
      Number.isSafeInteger(rawEntry.uncompressedSize) &&
      (rawEntry.uncompressedSize as number) >= 0
        ? (rawEntry.uncompressedSize as number)
        : limits.maxExecutableBytes + 1;
    declaredExecutableBytes += declaredBytes;
    if (
      executableFiles > limits.maxExecutableFiles ||
      declaredBytes > limits.maxExecutableBytes ||
      declaredExecutableBytes > limits.maxTotalExecutableBytes
    ) {
      throw new Error("Executable source limit exceeded");
    }
  }

  const result: LegacyModArchiveEntry[] = [];
  let actualExecutableBytes = 0;
  for (const rawEntry of rawEntries) {
    const filename =
      typeof rawEntry.filename === "string" ? rawEntry.filename : "";
    const directory = rawEntry.directory === true;
    const declaredBytes =
      Number.isSafeInteger(rawEntry.uncompressedSize) &&
      (rawEntry.uncompressedSize as number) >= 0
        ? (rawEntry.uncompressedSize as number)
        : 0;
    if (directory || !isExecutableModFilename(filename)) {
      result.push(
        Object.freeze({
          filename,
          directory,
          uncompressedBytes: declaredBytes,
        }),
      );
      continue;
    }

    const blobUrl = await zipModel.getURL(rawEntry, {
      password: undefined,
    });
    let sourceBlob: Blob;
    try {
      const response = await fetch(blobUrl);
      if (!response.ok) {
        throw new Error(`Could not read ${filename}`);
      }
      sourceBlob = await response.blob();
    } finally {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // Revocation is cleanup only; validation still uses the fetched copy.
      }
    }
    if (
      sourceBlob.size > limits.maxExecutableBytes ||
      sourceBlob.size > limits.maxTotalExecutableBytes
    ) {
      throw new Error("Executable source limit exceeded");
    }
    actualExecutableBytes += sourceBlob.size;
    if (actualExecutableBytes > limits.maxTotalExecutableBytes) {
      throw new Error("Executable source limit exceeded");
    }
    result.push(
      Object.freeze({
        filename,
        directory: false,
        uncompressedBytes: sourceBlob.size,
        source: await sourceBlob.text(),
      }),
    );
  }
  return Object.freeze(result);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { readonly then?: unknown }).then === "function"
  );
}

function isDisposedTranslationStatus(
  value: LegacyModTranslationStatus,
): boolean {
  return value.state === "disposed";
}

function translation(
  api: string,
  effect: KDApiEffect,
  nativeHandling: KDApiTranslation["nativeHandling"],
): KDApiTranslation {
  return Object.freeze({ api, effect, nativeHandling });
}

function profile(value: AuditedLegacyModProfile): AuditedLegacyModProfile {
  return Object.freeze({
    ...value,
    archiveEntries: Object.freeze([...value.archiveEntries]),
    recognizedApis: Object.freeze([...value.recognizedApis]),
    javascriptEvents: Object.freeze([...value.javascriptEvents]),
    replacedGlobals: Object.freeze([...value.replacedGlobals]),
    directWrites: Object.freeze([...value.directWrites]),
    safeSourceOptimizations: Object.freeze([...value.safeSourceOptimizations]),
  });
}

function profileStatus(
  value: AuditedLegacyModProfile,
): LegacyModTranslationProfileStatus {
  const effects = [
    ...new Set(
      value.recognizedApis.map(
        (api) =>
          translateOfficialKDApi(api)?.effect ??
          ("game-state-write" satisfies KDApiEffect),
      ),
    ),
  ];
  return Object.freeze({
    id: value.id,
    name: value.name,
    version: value.version,
    effects: Object.freeze(effects),
    javascriptEvents: Object.freeze([...value.javascriptEvents]),
  });
}

function intersectSourceOptimizations(
  profiles: readonly AuditedLegacyModProfile[],
): readonly MapGenerationSourceOptimization[] {
  if (profiles.length === 0) {
    return Object.freeze([...MAP_GENERATION_SOURCE_OPTIMIZATIONS]);
  }
  return Object.freeze(
    MAP_GENERATION_SOURCE_OPTIMIZATIONS.filter((optimization) =>
      profiles.every((candidate) =>
        candidate.safeSourceOptimizations.includes(optimization),
      ),
    ),
  );
}

function freezeStatus(
  value: LegacyModTranslationStatus,
): LegacyModTranslationStatus {
  return Object.freeze({
    ...value,
    profiles: Object.freeze([...value.profiles]),
    allowedSourceOptimizations: Object.freeze([
      ...value.allowedSourceOptimizations,
    ]),
  });
}

async function sha256Blob(blob: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new Error("Web Crypto is unavailable");
  }
  const digest = await subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { readonly size?: unknown }).size === "number" &&
    typeof (value as { readonly arrayBuffer?: unknown }).arrayBuffer ===
      "function"
  );
}

declare global {
  // Internal, fail-closed proof consumed by source-optimization transactions.
  // eslint-disable-next-line no-var
  var KDHybridModCompatibility: KDHybridModCompatibilityApi | undefined;
}
