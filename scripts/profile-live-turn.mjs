// SPDX-License-Identifier: MPL-2.0
//
// Compatibility probes in this file are adapted from Kinky Dungeon 5.4.92.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

async function main() {
  const { values } = parseArgs({
    options: {
      port: { type: "string", default: "9223" },
      enemies: { type: "string", default: "120" },
      turns: { type: "string", default: "3" },
      "ab-samples": { type: "string", default: "3" },
      "ab-turns": { type: "string", default: "2" },
      scenario: { type: "string", default: "crowded" },
      "probe-faction": { type: "boolean", default: false },
      "probe-enemy-flag": { type: "boolean", default: false },
      "probe-enemy-flag-single-lookup": {
        type: "boolean",
        default: false
      },
      "probe-entity-flag-inline": { type: "boolean", default: false },
      "probe-enemy-flag-tick": { type: "boolean", default: false },
      "probe-enemy-flag-tick-keys": { type: "boolean", default: false },
      "probe-hostile": { type: "boolean", default: false },
      "probe-hostile-inline": { type: "boolean", default: false },
      "probe-master": { type: "boolean", default: false },
      "probe-master-fused": { type: "boolean", default: false },
      "probe-nearest": { type: "boolean", default: false },
      "probe-nearest-hostile-first": { type: "boolean", default: false },
      "probe-nearest-hostile-first-minimal": {
        type: "boolean",
        default: false
      },
      "probe-nearest-hostile-inline": {
        type: "boolean",
        default: false
      },
      "probe-nearest-jailguard-hoist": {
        type: "boolean",
        default: false
      },
      "probe-nearest-faction-inline": {
        type: "boolean",
        default: false
      },
      "probe-nearest-hostility-body-inline": {
        type: "boolean",
        default: false
      },
      "probe-nearest-player-route-reuse": {
        type: "boolean",
        default: false
      },
      "probe-nearest-hostile-after-helpless": {
        type: "boolean",
        default: false
      },
      "probe-nearest-hostile-after-imprisoned": {
        type: "boolean",
        default: false
      },
      "probe-nearest-helpless-fast-negative": {
        type: "boolean",
        default: false
      },
      "probe-global-helpless-fast-negative": {
        type: "boolean",
        default: false
      },
      "probe-helpless-drop-pack-guard": {
        type: "boolean",
        default: false
      },
      "probe-source-helpless-fast-negative": {
        type: "boolean",
        default: false
      },
      "probe-source-enemy-delta-fast-path": {
        type: "boolean",
        default: false
      },
      "probe-enemy-debug-timer-fast-path": {
        type: "boolean",
        default: false
      },
      "probe-enemy-loop-ai-data-literal": {
        type: "boolean",
        default: false
      },
      "probe-source-nearest": {
        type: "boolean",
        default: false
      },
      "probe-nearest-candidate-faction-reuse": {
        type: "boolean",
        default: false
      },
      "probe-source-buff-event-index": {
        type: "boolean",
        default: false
      },
      "probe-buff-event-positive-index": {
        type: "boolean",
        default: false
      },
      "probe-event-family-audit": {
        type: "boolean",
        default: false
      },
      "probe-combat-status-audit": {
        type: "boolean",
        default: false
      },
      "probe-bound-effects-audit": {
        type: "boolean",
        default: false
      },
      "probe-los-audit": {
        type: "boolean",
        default: false
      },
      "probe-enemy-loop-path-reuse-audit": {
        type: "boolean",
        default: false
      },
      "probe-los-distance-first": {
        type: "boolean",
        default: false
      },
      "probe-bound-effects-fast-negative": {
        type: "boolean",
        default: false
      },
      "probe-opinion-id-single-lookup": {
        type: "boolean",
        default: false
      },
      "probe-opinion-id-single-lookup-upper-bound": {
        type: "boolean",
        default: false
      },
      "probe-find-id-single-get": {
        type: "boolean",
        default: false
      },
      "probe-magic-event-cache-guard": {
        type: "boolean",
        default: false
      },
      "probe-event-dispatch": { type: "boolean", default: false },
      "probe-event-dispatch-unchecked": {
        type: "boolean",
        default: false
      },
      "probe-inline-event-map-check": {
        type: "boolean",
        default: false
      },
      "probe-inline-event-map-check-unchecked": {
        type: "boolean",
        default: false
      },
      "probe-inventory-snapshot": { type: "boolean", default: false },
      "probe-restraint-snapshot-upper-bound": {
        type: "boolean",
        default: false
      },
      "probe-tile-get-local-upper-bound": {
        type: "boolean",
        default: false
      },
      "probe-jail-key-early-return": {
        type: "boolean",
        default: false
      },
      "probe-jail-guard-cache": {
        type: "boolean",
        default: false
      },
      "probe-enemy-at-live-cache-upper-bound": {
        type: "boolean",
        default: false
      },
      "probe-enemy-cache-dedup": {
        type: "boolean",
        default: false
      },
      "probe-wanderable-cache": {
        type: "boolean",
        default: false
      },
      "probe-smart-movable-single-get": {
        type: "boolean",
        default: false
      },
      "probe-leashing-enemy-cache": {
        type: "boolean",
        default: false
      },
      "probe-leashing-enemy-fast-path": {
        type: "boolean",
        default: false
      },
      "probe-leashing-enemy-reference-cache": {
        type: "boolean",
        default: false
      },
      "probe-leashing-enemy-scoped-cache": {
        type: "boolean",
        default: false
      },
      "probe-occupancy": { type: "boolean", default: false },
      "probe-no-enemy-except-sub-inline": {
        type: "boolean",
        default: false
      },
      "probe-enemy-can-move-fused": {
        type: "boolean",
        default: false
      },
      "probe-incremental-move-cache": {
        type: "boolean",
        default: false
      },
      "probe-batched-move-cache": {
        type: "boolean",
        default: false
      },
      "probe-batched-move-cache-verified": {
        type: "boolean",
        default: false
      },
      "probe-batched-move-cache-safe": {
        type: "boolean",
        default: false
      },
      "probe-commander-order-keys": { type: "boolean", default: false },
      "probe-commander-local-order": { type: "boolean", default: false },
      "probe-commander-unrolled-orders": {
        type: "boolean",
        default: false
      },
      "probe-commander-batch-unrolled-orders": {
        type: "boolean",
        default: false
      },
      "probe-commander-fused-selection": {
        type: "boolean",
        default: false
      },
      "probe-commander-batch": { type: "boolean", default: false },
      "probe-commander-help": { type: "boolean", default: false },
      "probe-commander-help-prefilter": {
        type: "boolean",
        default: false
      },
      "probe-buff-event-index": {
        type: "boolean",
        default: false
      },
      "probe-buff-stat-cache": { type: "boolean", default: false },
      "probe-buff-stat-tight-loop": {
        type: "boolean",
        default: false
      },
      "probe-immunity-helper": {
        type: "boolean",
        default: false
      },
      "probe-toy-buff-specialization": {
        type: "boolean",
        default: false
      },
      "probe-secret-toy-noop-reapply": {
        type: "boolean",
        default: false
      },
      "probe-toy-buff-tick-noop": {
        type: "boolean",
        default: false
      },
      "probe-buff-tick-key-loop": {
        type: "boolean",
        default: false
      },
      "probe-buff-tick-for-in": {
        type: "boolean",
        default: false
      },
      "probe-buff-update-batch": {
        type: "boolean",
        default: false
      },
      "probe-system-matrix": { type: "boolean", default: false },
      "probe-check-path-count": { type: "boolean", default: false },
      "probe-dynamic-path-array": {
        type: "boolean",
        default: false
      },
      "probe-texture-upload-audit": {
        type: "boolean",
        default: false
      },
      "probe-shared-texture-audit": {
        type: "boolean",
        default: false
      },
      interval: { type: "string", default: "100" },
      output: {
        type: "string",
        default: "artifacts/crowded-turn-profile-latest.json"
      },
      "fixture-input": { type: "string" },
      "fixture-output": { type: "string" }
    }
  });
  const port = parseInteger("port", values.port, 1, 65_535);
  const enemyCount = parseInteger("enemies", values.enemies, 1, 1_000);
  const turnCount = parseInteger("turns", values.turns, 1, 100);
  const abSamples = parseInteger("ab-samples", values["ab-samples"], 1, 20);
  const abTurns = parseInteger("ab-turns", values["ab-turns"], 1, 20);
  const scenario = values.scenario;
  if (!["crowded", "prison", "combat"].includes(scenario)) {
    throw new Error(
      `scenario must be "crowded", "prison", or "combat"; received ${JSON.stringify(scenario)}`
    );
  }
  const probeFaction = values["probe-faction"];
  const probeEnemyFlag = values["probe-enemy-flag"];
  const probeEnemyFlagSingleLookup =
    values["probe-enemy-flag-single-lookup"];
  const probeEntityFlagInline = values["probe-entity-flag-inline"];
  const probeEnemyFlagTick = values["probe-enemy-flag-tick"];
  const probeEnemyFlagTickKeys = values["probe-enemy-flag-tick-keys"];
  const probeHostile = values["probe-hostile"];
  const probeHostileInline = values["probe-hostile-inline"];
  const probeMaster = values["probe-master"];
  const probeMasterFused = values["probe-master-fused"];
  const probeNearest = values["probe-nearest"];
  const probeNearestHostileFirst =
    values["probe-nearest-hostile-first"];
  const probeNearestHostileFirstMinimal =
    values["probe-nearest-hostile-first-minimal"];
  const probeNearestHostileInline =
    values["probe-nearest-hostile-inline"];
  const probeNearestJailGuardHoist =
    values["probe-nearest-jailguard-hoist"];
  const probeNearestFactionInline =
    values["probe-nearest-faction-inline"];
  const probeNearestHostilityBodyInline =
    values["probe-nearest-hostility-body-inline"];
  const probeNearestPlayerRouteReuse =
    values["probe-nearest-player-route-reuse"];
  const probeNearestHostileAfterHelpless =
    values["probe-nearest-hostile-after-helpless"];
  const probeNearestHostileAfterImprisoned =
    values["probe-nearest-hostile-after-imprisoned"];
  const probeNearestHelplessFastNegative =
    values["probe-nearest-helpless-fast-negative"];
  const probeGlobalHelplessFastNegative =
    values["probe-global-helpless-fast-negative"];
  const probeHelplessDropPackGuard =
    values["probe-helpless-drop-pack-guard"];
  const probeSourceHelplessFastNegative =
    values["probe-source-helpless-fast-negative"];
  const probeSourceEnemyDeltaFastPath =
    values["probe-source-enemy-delta-fast-path"];
  const probeEnemyDebugTimerFastPath =
    values["probe-enemy-debug-timer-fast-path"];
  const probeEnemyLoopAIDataLiteral =
    values["probe-enemy-loop-ai-data-literal"];
  const probeSourceNearest = values["probe-source-nearest"];
  const probeNearestCandidateFactionReuse =
    values["probe-nearest-candidate-faction-reuse"];
  const probeSourceBuffEventIndex =
    values["probe-source-buff-event-index"];
  const probeBuffEventPositiveIndex =
    values["probe-buff-event-positive-index"];
  const probeEventFamilyAudit = values["probe-event-family-audit"];
  const probeCombatStatusAudit =
    values["probe-combat-status-audit"];
  const probeBoundEffectsAudit =
    values["probe-bound-effects-audit"];
  const probeLosAudit = values["probe-los-audit"];
  const probeEnemyLoopPathReuseAudit =
    values["probe-enemy-loop-path-reuse-audit"];
  const probeLosDistanceFirst = values["probe-los-distance-first"];
  const probeBoundEffectsFastNegative =
    values["probe-bound-effects-fast-negative"];
  const probeOpinionIdSingleLookup =
    values["probe-opinion-id-single-lookup"];
  const probeOpinionIdSingleLookupUpperBound =
    values["probe-opinion-id-single-lookup-upper-bound"];
  const probeFindIdSingleGet = values["probe-find-id-single-get"];
  const probeMagicEventCacheGuard =
    values["probe-magic-event-cache-guard"];
  const probeEventDispatch = values["probe-event-dispatch"];
  const probeEventDispatchUnchecked =
    values["probe-event-dispatch-unchecked"];
  const probeInlineEventMapCheck =
    values["probe-inline-event-map-check"];
  const probeInlineEventMapCheckUnchecked =
    values["probe-inline-event-map-check-unchecked"];
  const probeInventorySnapshot = values["probe-inventory-snapshot"];
  const probeRestraintSnapshotUpperBound =
    values["probe-restraint-snapshot-upper-bound"];
  const probeTileGetLocalUpperBound =
    values["probe-tile-get-local-upper-bound"];
  const probeJailKeyEarlyReturn =
    values["probe-jail-key-early-return"];
  const probeJailGuardCache = values["probe-jail-guard-cache"];
  const probeEnemyAtLiveCacheUpperBound =
    values["probe-enemy-at-live-cache-upper-bound"];
  const probeEnemyCacheDedup = values["probe-enemy-cache-dedup"];
  const probeWanderableCache = values["probe-wanderable-cache"];
  const probeSmartMovableSingleGet =
    values["probe-smart-movable-single-get"];
  const probeLeashingEnemyCache =
    values["probe-leashing-enemy-cache"];
  const probeLeashingEnemyFastPath =
    values["probe-leashing-enemy-fast-path"];
  const probeLeashingEnemyReferenceCache =
    values["probe-leashing-enemy-reference-cache"];
  const probeLeashingEnemyScopedCache =
    values["probe-leashing-enemy-scoped-cache"];
  const probeOccupancy = values["probe-occupancy"];
  const probeNoEnemyExceptSubInline =
    values["probe-no-enemy-except-sub-inline"];
  const probeEnemyCanMoveFused =
    values["probe-enemy-can-move-fused"];
  const probeIncrementalMoveCache =
    values["probe-incremental-move-cache"];
  const probeBatchedMoveCache =
    values["probe-batched-move-cache"];
  const probeBatchedMoveCacheVerified =
    values["probe-batched-move-cache-verified"];
  const probeBatchedMoveCacheSafe =
    values["probe-batched-move-cache-safe"];
  const probeCommanderOrderKeys = values["probe-commander-order-keys"];
  const probeCommanderLocalOrder =
    values["probe-commander-local-order"];
  const probeCommanderUnrolledOrders =
    values["probe-commander-unrolled-orders"];
  const probeCommanderBatchUnrolledOrders =
    values["probe-commander-batch-unrolled-orders"];
  const probeCommanderFusedSelection =
    values["probe-commander-fused-selection"];
  const probeCommanderBatch = values["probe-commander-batch"];
  const probeCommanderHelp = values["probe-commander-help"];
  const probeCommanderHelpPrefilter =
    values["probe-commander-help-prefilter"];
  const probeBuffEventIndex = values["probe-buff-event-index"];
  const probeBuffStatCache = values["probe-buff-stat-cache"];
  const probeBuffStatTightLoop = values["probe-buff-stat-tight-loop"];
  const probeImmunityHelper = values["probe-immunity-helper"];
  const probeToyBuffSpecialization =
    values["probe-toy-buff-specialization"];
  const probeSecretToyNoopReapply =
    values["probe-secret-toy-noop-reapply"];
  const probeToyBuffTickNoop =
    values["probe-toy-buff-tick-noop"];
  const probeBuffTickKeyLoop =
    values["probe-buff-tick-key-loop"];
  const probeBuffTickForIn =
    values["probe-buff-tick-for-in"];
  const probeBuffUpdateBatch =
    values["probe-buff-update-batch"];
  const probeSystemMatrix = values["probe-system-matrix"];
  const probeCheckPathCount = values["probe-check-path-count"];
  const probeDynamicPathArray = values["probe-dynamic-path-array"];
  const probeTextureUploadAudit = values["probe-texture-upload-audit"];
  const probeSharedTextureAudit = values["probe-shared-texture-audit"];
  const samplingInterval = parseInteger("interval", values.interval, 50, 10_000);
  const outputPath = path.resolve(values.output);
  const fixtureInputPath =
    values["fixture-input"] === undefined
      ? null
      : path.resolve(values["fixture-input"]);
  const fixtureOutputPath =
    values["fixture-output"] === undefined
      ? null
      : path.resolve(values["fixture-output"]);
  const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const gameTarget = targets.find(
    (target) =>
      target.type === "page" &&
      typeof target.url === "string" &&
      target.url.includes("/resources/app/index.html?test=kd-hybrid")
  );

  if (gameTarget?.webSocketDebuggerUrl === undefined) {
    throw new Error(
      `No isolated KD developer page found on localhost:${port}. ` +
        "Launch the test executable with --remote-debugging-port first."
    );
  }

  const client = await CdpClient.connect(gameTarget.webSocketDebuggerUrl);
  try {
    const fixedSeed = "kd-hybrid-crowded-turn-5.4.92";
    let setup = await client.evaluate(
      `(${setupCrowdedTurn.toString()})(${enemyCount}, ${JSON.stringify(fixedSeed)})`,
      120_000
    );
    let scenarioSetup = { kind: scenario };
    if (scenario === "prison" && fixtureInputPath === null) {
      scenarioSetup = await client.evaluate(
        `(${setupPrisonTurn.toString()})(${enemyCount})`,
        120_000
      );
      setup = {
        ...setup,
        actualEnemies: scenarioSetup.actualEnemies,
        map: scenarioSetup.map,
        mapSignature: scenarioSetup.mapSignature
      };
    } else if (scenario === "combat" && fixtureInputPath === null) {
      scenarioSetup = await client.evaluate(
        `(${setupCombatTurn.toString()})(${enemyCount})`,
        120_000
      );
      setup = {
        ...setup,
        actualEnemies: scenarioSetup.actualEnemies,
        map: scenarioSetup.map,
        mapSignature: scenarioSetup.mapSignature
      };
    }
    await client.evaluate(
      `globalThis.kdHybridTurnProfileScenario = ${JSON.stringify(scenario)}`,
      30_000
    );
    let suppliedFixtureState = null;
    if (fixtureInputPath !== null) {
      const fixture = (await readFile(fixtureInputPath, "utf8")).trim();
      if (
        fixture.length < 1_000 ||
        !/^[A-Za-z0-9+/=]+$/.test(fixture)
      ) {
        throw new Error(`Invalid crowded-turn fixture: ${fixtureInputPath}`);
      }
      suppliedFixtureState = await client.evaluate(
        `(() => {
          globalThis.kdHybridCrowdedTurnFixture = ${JSON.stringify(fixture)};
          return (${restoreCrowdedFixture.toString()})();
        })()`,
        120_000
      );
    }
    const nearbyBenchmark =
      setup.ai?.globalName === "KDNearbyEnemies"
        ? await benchmarkNearbyAdapter(
            client,
            enemyCount,
            fixedSeed,
            abSamples,
            abTurns
          )
        : null;
    if (nearbyBenchmark !== null) {
      await client.evaluate('KDHybrid.enableSystem("events")', 30_000);
    }
    if (fixtureOutputPath !== null && nearbyBenchmark !== null) {
      const fixture = await client.evaluate(
        `globalThis.kdHybridCrowdedTurnFixture`,
        120_000
      );
      if (typeof fixture !== "string" || fixture.length < 1_000) {
        throw new Error("Live crowded-turn fixture is unavailable");
      }
      await mkdir(path.dirname(fixtureOutputPath), { recursive: true });
      await writeFile(fixtureOutputPath, `${fixture}\n`, "utf8");
    }
    const pathfindingBenchmark =
      nearbyBenchmark !== null
        ? await benchmarkPathfindingAdapter(client, abSamples, abTurns)
        : null;
    const systemMatrixProbe =
      probeSystemMatrix && nearbyBenchmark !== null
        ? await benchmarkSystemMatrix(client, abSamples, abTurns)
        : null;
    const aiAdapterMatrixProbe =
      probeSystemMatrix && nearbyBenchmark !== null
        ? await benchmarkAiAdapterMatrix(client, abSamples, abTurns)
        : null;
    const factionProbe =
      probeFaction && nearbyBenchmark !== null
        ? await benchmarkFactionFastPath(client, abSamples, abTurns)
        : null;
    const enemyFlagProbe =
      probeEnemyFlag && nearbyBenchmark !== null
        ? await benchmarkEnemyFlagFastPath(client, abSamples, abTurns)
        : null;
    const enemyFlagSingleLookupProbe =
      probeEnemyFlagSingleLookup && nearbyBenchmark !== null
        ? await benchmarkEnemyFlagFastPath(
            client,
            abSamples,
            abTurns,
            createEnemyFlagSingleLookupCandidate,
            true
          )
        : null;
    const entityFlagInlineProbe =
      probeEntityFlagInline && nearbyBenchmark !== null
        ? await benchmarkEntityFlagInline(client, abSamples, abTurns)
        : null;
    const enemyFlagTickProbe =
      probeEnemyFlagTick && nearbyBenchmark !== null
        ? await benchmarkEnemyFlagTick(client, abSamples, abTurns)
        : null;
    const enemyFlagTickKeysProbe =
      probeEnemyFlagTickKeys && nearbyBenchmark !== null
        ? await benchmarkEnemyFlagTick(client, abSamples, abTurns, true)
        : null;
    const hostileProbe =
      probeHostile && nearbyBenchmark !== null
        ? await benchmarkHostileFastPath(
            client,
            abSamples,
            abTurns,
            createHostileMemoProbeCandidate
          )
        : null;
    const hostileInlineProbe =
      probeHostileInline && nearbyBenchmark !== null
        ? await benchmarkHostileFastPath(
            client,
            abSamples,
            abTurns,
            createHostileInlineProbeCandidate
          )
        : null;
    const masterProbe =
      probeMaster && nearbyBenchmark !== null
        ? await benchmarkFindMasterFastPath(client, abSamples, abTurns)
        : null;
    const masterFusedProbe =
      probeMasterFused && nearbyBenchmark !== null
        ? await benchmarkFindMasterFastPath(
            client,
            abSamples,
            abTurns,
            createFindMasterFusedProbeCandidate
          )
        : null;
    const nearestProbe =
      probeNearest && nearbyBenchmark !== null
        ? await benchmarkNearestPlayerFastPath(client, abSamples, abTurns)
        : null;
    const nearestHostileFirstProbe =
      probeNearestHostileFirst && nearbyBenchmark !== null
        ? await benchmarkNearestPlayerFastPath(
            client,
            abSamples,
            abTurns,
            true
          )
        : null;
    const nearestHostileFirstMinimalProbe =
      probeNearestHostileFirstMinimal && nearbyBenchmark !== null
        ? await benchmarkNearestPlayerFastPath(
            client,
            abSamples,
            abTurns,
            true,
            true
          )
        : null;
    const nearestHostileInlineProbe =
      probeNearestHostileInline && nearbyBenchmark !== null
        ? await benchmarkNearestPlayerFastPath(
            client,
            abSamples,
            abTurns,
            true,
            true,
            "first",
            true
          )
        : null;
    const nearestJailGuardHoistProbe =
      probeNearestJailGuardHoist && nearbyBenchmark !== null
        ? await benchmarkNearestPlayerFastPath(
            client,
            abSamples,
            abTurns,
            true,
            true,
            "first",
            true,
            true
          )
        : null;
    const nearestFactionInlineProbe =
      probeNearestFactionInline && nearbyBenchmark !== null
        ? await benchmarkNearestPlayerFastPath(
            client,
            abSamples,
            abTurns,
            true,
            true,
            "first",
            true,
            false,
            true
          )
        : null;
    const nearestHostilityBodyInlineProbe =
      probeNearestHostilityBodyInline && nearbyBenchmark !== null
        ? await benchmarkNearestPlayerFastPath(
            client,
            abSamples,
            abTurns,
            true,
            true,
            "first",
            true,
            false,
            false,
            true
          )
        : null;
    const nearestPlayerRouteReuseProbe =
      probeNearestPlayerRouteReuse && nearbyBenchmark !== null
        ? await benchmarkNearestPlayerFastPath(
            client,
            abSamples,
            abTurns,
            true,
            true,
            "first",
            true,
            false,
            false,
            false,
            true
          )
        : null;
    const nearestHostileAfterHelplessProbe =
      probeNearestHostileAfterHelpless && nearbyBenchmark !== null
        ? await benchmarkNearestPlayerFastPath(
            client,
            abSamples,
            abTurns,
            true,
            true,
            "after-helpless"
          )
        : null;
    const nearestHostileAfterImprisonedProbe =
      probeNearestHostileAfterImprisoned && nearbyBenchmark !== null
        ? await benchmarkNearestPlayerFastPath(
            client,
            abSamples,
            abTurns,
            true,
            true,
            "after-imprisoned"
          )
        : null;
    const nearestHelplessFastNegativeProbe =
      probeNearestHelplessFastNegative && nearbyBenchmark !== null
        ? await benchmarkNearestPlayerFastPath(
            client,
            abSamples,
            abTurns,
            true,
            true,
            "first",
            true,
            false,
            false,
            false,
            false,
            true
          )
        : null;
    const globalHelplessFastNegativeProbe =
      probeGlobalHelplessFastNegative && nearbyBenchmark !== null
        ? await benchmarkGlobalHelplessFastNegative(
            client,
            abSamples,
            abTurns
          )
        : null;
    const helplessDropPackGuardProbe =
      probeHelplessDropPackGuard && nearbyBenchmark !== null
        ? await benchmarkGlobalHelplessFastNegative(
            client,
            abSamples,
            abTurns,
            createHelplessDropPackGuardCandidate
          )
        : null;
    const sourceHelplessFastNegativeProbe =
      probeSourceHelplessFastNegative && nearbyBenchmark !== null
        ? await benchmarkSourceHelplessFastNegative(
            client,
            abSamples,
            abTurns
          )
        : null;
    const sourceEnemyDeltaFastPathProbe =
      probeSourceEnemyDeltaFastPath && nearbyBenchmark !== null
        ? await benchmarkSourceEnemyDeltaFastPath(
            client,
            abSamples,
            abTurns
          )
        : null;
    const enemyDebugTimerFastPathProbe =
      probeEnemyDebugTimerFastPath && nearbyBenchmark !== null
        ? await benchmarkEnemyDebugTimerFastPath(
            client,
            abSamples,
            abTurns
          )
        : null;
    const enemyLoopAIDataLiteralProbe =
      probeEnemyLoopAIDataLiteral && nearbyBenchmark !== null
        ? await benchmarkEnemyLoopAIDataLiteral(
            client,
            abSamples,
            abTurns
          )
        : null;
    const sourceNearestProbe =
      (probeSourceNearest || setup.nearest?.mode === "source") &&
      nearbyBenchmark !== null
        ? await benchmarkSourceNearestPlayerFastPath(
            client,
            abSamples,
            abTurns
          )
        : null;
    const nearestCandidateFactionReuseProbe =
      probeNearestCandidateFactionReuse && nearbyBenchmark !== null
        ? await benchmarkNearestCandidateFactionReuse(
            client,
            abSamples,
            abTurns
          )
        : null;
    const sourceBuffEventIndexProbe =
      probeSourceBuffEventIndex && nearbyBenchmark !== null
        ? await benchmarkSourceBuffEventNegativeIndex(
            client,
            abSamples,
            abTurns
          )
        : null;
    const buffEventPositiveIndexProbe =
      probeBuffEventPositiveIndex && nearbyBenchmark !== null
        ? await benchmarkBuffEventPositiveOwnerIndex(
            client,
            abSamples,
            abTurns
          )
        : null;
    const boundEffectsFastNegativeProbe =
      probeBoundEffectsFastNegative && nearbyBenchmark !== null
        ? await benchmarkBoundEffectsFastNegative(
            client,
            abSamples,
            abTurns
          )
        : null;
    const opinionIdSingleLookupProbe =
      (probeOpinionIdSingleLookup ||
        probeOpinionIdSingleLookupUpperBound) &&
      nearbyBenchmark !== null
        ? await benchmarkOpinionIdSingleLookup(
            client,
            abSamples,
            abTurns,
            !probeOpinionIdSingleLookupUpperBound
          )
        : null;
    const findIdSingleGetProbe =
      probeFindIdSingleGet && nearbyBenchmark !== null
        ? await benchmarkFindIdSingleGet(
            client,
            abSamples,
            abTurns
          )
        : null;
    const losDistanceFirstProbe =
      probeLosDistanceFirst && nearbyBenchmark !== null
        ? await benchmarkLOSDistanceFirst(
            client,
            abSamples,
            abTurns
          )
        : null;
    const eventDispatchProbe =
      probeEventDispatch && nearbyBenchmark !== null
        ? await benchmarkEventDispatchFastPath(
            client,
            abSamples,
            abTurns
          )
        : null;
    const magicEventCacheGuardProbe =
      probeMagicEventCacheGuard && nearbyBenchmark !== null
        ? await benchmarkMagicEventCacheGuard(
            client,
            abSamples,
            abTurns
          )
        : null;
    const eventDispatchUncheckedProbe =
      probeEventDispatchUnchecked && nearbyBenchmark !== null
        ? await benchmarkEventDispatchFastPath(
            client,
            abSamples,
            abTurns,
            false
          )
        : null;
    const inlineEventMapCheckProbe =
      probeInlineEventMapCheck && nearbyBenchmark !== null
        ? await benchmarkInlineEventMapCheck(
            client,
            abSamples,
            abTurns
          )
        : null;
    const inlineEventMapCheckUncheckedProbe =
      probeInlineEventMapCheckUnchecked && nearbyBenchmark !== null
        ? await benchmarkInlineEventMapCheck(
            client,
            abSamples,
            abTurns,
            false
          )
        : null;
    const inventorySnapshotProbe =
      probeInventorySnapshot && nearbyBenchmark !== null
        ? await benchmarkInventorySnapshotFastPath(
            client,
            abSamples,
            abTurns
          )
        : null;
    const restraintSnapshotUpperBoundProbe =
      probeRestraintSnapshotUpperBound && nearbyBenchmark !== null
        ? await benchmarkRestraintSnapshotUpperBound(
            client,
            abSamples,
            abTurns
          )
        : null;
    const tileGetLocalUpperBoundProbe =
      probeTileGetLocalUpperBound && nearbyBenchmark !== null
        ? await benchmarkTileGetLocalUpperBound(
            client,
            abSamples,
            abTurns
          )
        : null;
    const jailKeyEarlyReturnProbe =
      probeJailKeyEarlyReturn && nearbyBenchmark !== null
        ? await benchmarkJailKeyEarlyReturn(
            client,
            abSamples,
            abTurns
          )
        : null;
    const jailGuardCacheProbe =
      probeJailGuardCache && nearbyBenchmark !== null
        ? await benchmarkJailGuardCache(
            client,
            abSamples,
            abTurns
          )
        : null;
    const enemyAtLiveCacheUpperBoundProbe =
      probeEnemyAtLiveCacheUpperBound && nearbyBenchmark !== null
        ? await benchmarkEnemyAtLiveCacheUpperBound(
            client,
            abSamples,
            abTurns
          )
        : null;
    const enemyCacheDedupProbe =
      probeEnemyCacheDedup && nearbyBenchmark !== null
        ? await benchmarkEnemyCacheDedup(
            client,
            abSamples,
            abTurns
          )
        : null;
    const wanderableCacheProbe =
      probeWanderableCache && nearbyBenchmark !== null
        ? await benchmarkWanderableCache(client, abSamples, abTurns)
        : null;
    const smartMovableSingleGetProbe =
      probeSmartMovableSingleGet && nearbyBenchmark !== null
        ? await benchmarkSmartMovableSingleGet(
            client,
            abSamples,
            abTurns
          )
        : null;
    const leashingEnemyCacheProbe =
      probeLeashingEnemyCache && nearbyBenchmark !== null
        ? await benchmarkLeashingEnemyCache(
            client,
            abSamples,
            abTurns
          )
        : null;
    const leashingEnemyFastPathProbe =
      probeLeashingEnemyFastPath && nearbyBenchmark !== null
        ? await benchmarkLeashingEnemyCache(
            client,
            abSamples,
            abTurns,
            "id-cache-fast-path"
          )
        : null;
    const leashingEnemyReferenceCacheProbe =
      probeLeashingEnemyReferenceCache && nearbyBenchmark !== null
        ? await benchmarkLeashingEnemyCache(
            client,
            abSamples,
            abTurns,
            "explicit-id-reference-cache"
          )
        : null;
    const leashingEnemyScopedCacheProbe =
      probeLeashingEnemyScopedCache && nearbyBenchmark !== null
        ? await benchmarkLeashingEnemyCache(
            client,
            abSamples,
            abTurns,
            "scoped-explicit-id-cache"
          )
        : null;
    const occupancyProbe =
      probeOccupancy && nearbyBenchmark !== null
        ? await benchmarkOccupancyFastPath(client, abSamples, abTurns)
        : null;
    const noEnemyExceptSubInlineProbe =
      probeNoEnemyExceptSubInline && nearbyBenchmark !== null
        ? await benchmarkNoEnemyExceptSubInline(
            client,
            abSamples,
            abTurns
          )
        : null;
    const enemyCanMoveFusedProbe =
      probeEnemyCanMoveFused && nearbyBenchmark !== null
        ? await benchmarkEnemyCanMoveFused(
            client,
            abSamples,
            abTurns
          )
        : null;
    const incrementalMoveCacheProbe =
      probeIncrementalMoveCache && nearbyBenchmark !== null
        ? await benchmarkIncrementalMoveCache(
            client,
            abSamples,
            abTurns
          )
        : null;
    const batchedMoveCacheProbe =
      probeBatchedMoveCache && nearbyBenchmark !== null
        ? await benchmarkBatchedMoveCache(
            client,
            abSamples,
            abTurns
          )
        : null;
    const batchedMoveCacheVerifiedProbe =
      probeBatchedMoveCacheVerified && nearbyBenchmark !== null
        ? await benchmarkBatchedMoveCache(
            client,
            abSamples,
            abTurns,
            true
          )
        : null;
    const batchedMoveCacheSafeProbe =
      probeBatchedMoveCacheSafe && nearbyBenchmark !== null
        ? await benchmarkBatchedMoveCache(
            client,
            abSamples,
            abTurns,
            false,
            true
          )
        : null;
    const commanderOrderKeysProbe =
      probeCommanderOrderKeys && nearbyBenchmark !== null
        ? await benchmarkCommanderOrderKeys(client, abSamples, abTurns)
        : null;
    const commanderLocalOrderProbe =
      probeCommanderLocalOrder && nearbyBenchmark !== null
        ? await benchmarkCommanderOrderKeys(
            client,
            abSamples,
            abTurns,
            false
          )
        : null;
    const commanderUnrolledOrdersProbe =
      probeCommanderUnrolledOrders && nearbyBenchmark !== null
        ? await benchmarkCommanderUnrolledOrders(
            client,
            abSamples,
            abTurns
          )
        : null;
    const commanderBatchUnrolledOrdersProbe =
      probeCommanderBatchUnrolledOrders && nearbyBenchmark !== null
        ? await benchmarkCommanderUnrolledOrders(
            client,
            abSamples,
            abTurns,
            true
          )
        : null;
    const commanderFusedSelectionProbe =
      probeCommanderFusedSelection && nearbyBenchmark !== null
        ? await benchmarkCommanderFusedSelection(
            client,
            abSamples,
            abTurns
          )
        : null;
    const commanderBatchProbe =
      probeCommanderBatch && nearbyBenchmark !== null
        ? await benchmarkCommanderRoleBatch(client, abSamples, abTurns)
        : null;
    const commanderHelpProbe =
      probeCommanderHelp && nearbyBenchmark !== null
        ? await benchmarkCommanderHelpShortcuts(client, abSamples, abTurns)
        : null;
    const commanderHelpPrefilterProbe =
      probeCommanderHelpPrefilter && nearbyBenchmark !== null
        ? await benchmarkCommanderHelpShortcuts(
            client,
            abSamples,
            abTurns,
            true
          )
        : null;
    const buffEventIndexProbe =
      probeBuffEventIndex && nearbyBenchmark !== null
        ? await benchmarkBuffEventNegativeIndex(
            client,
            abSamples,
            abTurns
          )
        : null;
    const buffStatCacheProbe =
      probeBuffStatCache && nearbyBenchmark !== null
        ? await benchmarkBuffStatCache(client, abSamples, abTurns)
        : null;
    const buffStatTightLoopProbe =
      probeBuffStatTightLoop && nearbyBenchmark !== null
        ? await benchmarkBuffStatTightLoop(client, abSamples, abTurns)
        : null;
    const immunityHelperProbe =
      probeImmunityHelper && nearbyBenchmark !== null
        ? await benchmarkImmunityHelper(client, abSamples, abTurns)
        : null;
    const toyBuffSpecializationProbe =
      probeToyBuffSpecialization && nearbyBenchmark !== null
        ? await benchmarkToyBuffSpecialization(
            client,
            abSamples,
            abTurns
          )
        : null;
    const secretToyNoopReapplyProbe =
      probeSecretToyNoopReapply && nearbyBenchmark !== null
        ? await benchmarkToyBuffSpecialization(
            client,
            abSamples,
            abTurns,
            "noop-reapply"
          )
        : null;
    const toyBuffTickNoopProbe =
      probeToyBuffTickNoop && nearbyBenchmark !== null
        ? await benchmarkToyBuffTickNoop(
            client,
            abSamples,
            abTurns
          )
        : null;
    const buffTickKeyLoopProbe =
      probeBuffTickKeyLoop && nearbyBenchmark !== null
        ? await benchmarkToyBuffTickNoop(
            client,
            abSamples,
            abTurns,
            "key-loop"
          )
        : null;
    const buffTickForInProbe =
      probeBuffTickForIn && nearbyBenchmark !== null
        ? await benchmarkToyBuffTickNoop(
            client,
            abSamples,
            abTurns,
            "for-in"
          )
        : null;
    const buffUpdateBatchProbe =
      probeBuffUpdateBatch && nearbyBenchmark !== null
        ? await benchmarkBuffUpdateBatch(
            client,
            abSamples,
            abTurns
          )
        : null;
    const checkPathCountProbe =
      probeCheckPathCount && nearbyBenchmark !== null
        ? await benchmarkCheckPathCount(client, abSamples, abTurns)
        : null;
    const dynamicPathArrayProbe =
      probeDynamicPathArray && nearbyBenchmark !== null
        ? await benchmarkDynamicPathArray(client, abSamples, abTurns)
        : null;
    const nearbyParity =
      setup.ai?.globalName === "KDNearbyEnemies"
        ? await client.evaluate(
            `(${verifyIntegratedNearbyParity.toString()})()`,
            120_000
          )
        : null;
    if (nearbyBenchmark !== null) {
      await client.evaluate(`(${restoreCrowdedFixture.toString()})()`, 120_000);
    }
    const turnNearbyParity =
      setup.ai?.globalName === "KDNearbyEnemies"
        ? await client.evaluate(
            `(${verifyTurnNearbyParity.toString()})()`,
            120_000
          )
        : null;
    const commanderCompatibility =
      setup.commander?.globalName === "KDCommanderUpdateRoles"
        ? await client.evaluate(
            `(${verifyCommanderDependencyFallback.toString()})()`,
            120_000
          )
        : null;
    const commanderPotentialParity =
      setup.commander?.globalName === "KDCommanderUpdateRoles"
        ? await client.evaluate(
            `(${verifyCommanderPotentialFallbacks.toString()})()`,
            120_000
          )
        : null;
    const masterCompatibility =
      setup.master?.globalName === "KinkyDungeonFindMaster"
        ? await client.evaluate(
            `(${verifyFindMasterDependencyFallback.toString()})()`,
            120_000
          )
        : null;
    const masterPotentialParity =
      setup.master?.globalName === "KinkyDungeonFindMaster"
        ? await client.evaluate(
            `(${verifyFindMasterPotentialParity.toString()})()`,
            120_000
          )
        : null;
    const nearestCompatibility =
      setup.nearest?.globalName === "KinkyDungeonNearestPlayer"
        ? setup.nearest?.mode === "source"
          ? await client.evaluate(
              `(${verifySourceNearestPlayerDependencyFallback.toString()})()`,
              120_000
            )
          : await client.evaluate(
              `(${verifyNearestPlayerDependencyFallback.toString()})()`,
              120_000
            )
        : null;
    const nearestGuardedParity =
      setup.nearest?.globalName === "KinkyDungeonNearestPlayer"
        ? setup.nearest?.mode === "source"
          ? await client.evaluate(
              `(${verifySourceNearestPlayerGuardedParity.toString()})()`,
              120_000
            )
          : await client.evaluate(
              `(${verifyNearestPlayerGuardedParity.toString()})()`,
              120_000
            )
        : null;
    if (nearbyBenchmark !== null) {
      await client.evaluate(`(${restoreCrowdedFixture.toString()})()`, 120_000);
    }
    const nearestTurnParity =
      setup.nearest?.globalName === "KinkyDungeonNearestPlayer"
        ? setup.nearest?.mode === "source"
          ? await client.evaluate(
              `(${verifySourceNearestPlayerTurnParity.toString()})(${runCrowdedTurns.toString()})`,
              120_000
            )
          : await client.evaluate(
              `(${verifyNearestPlayerTurnParity.toString()})()`,
              120_000
            )
        : null;
    const enemyUpdateCompatibility =
      setup.movement?.globalName === "KinkyDungeonUpdateEnemies"
        ? await client.evaluate(
            `(${verifyEnemyUpdateCacheFallbacks.toString()})()`,
            120_000
          )
        : null;
    const jailKeyCompatibility =
      setup.jailKey?.globalName === "KinkyDungeonPlaceJailKeys"
        ? await client.evaluate(
            `(${verifyJailKeyEarlyReturnFallbacks.toString()})()`,
            120_000
          )
        : null;
    if (nearbyBenchmark !== null) {
      await client.evaluate(`(${restoreCrowdedFixture.toString()})()`, 120_000);
    }
    await client.evaluate('KDHybrid.enableSystem("ai")', 30_000);
    await client.evaluate('KDHybrid.enableSystem("movement")', 30_000);
    const hotCallCounts = await client.evaluate(
      `(${measureHotFunctionCalls.toString()})(${Math.min(turnCount, 10)})`,
      120_000
    );
    if (probeEventFamilyAudit && nearbyBenchmark !== null) {
      await client.evaluate(`(${restoreCrowdedFixture.toString()})()`, 120_000);
      await client.evaluate('KDHybrid.enableSystem("ai")', 30_000);
      await client.evaluate('KDHybrid.enableSystem("movement")', 30_000);
    }
    const eventFamilyAudit =
      probeEventFamilyAudit && nearbyBenchmark !== null
        ? await client.evaluate(
            `(${measureEventFamilyDispatch.toString()})(${Math.min(
              turnCount,
              10
            )})`,
            120_000
          )
        : null;
    if (probeCombatStatusAudit && nearbyBenchmark !== null) {
      await client.evaluate(`(${restoreCrowdedFixture.toString()})()`, 120_000);
      await client.evaluate('KDHybrid.enableSystem("ai")', 30_000);
      await client.evaluate('KDHybrid.enableSystem("movement")', 30_000);
    }
    const combatStatusAudit =
      probeCombatStatusAudit && nearbyBenchmark !== null
        ? await client.evaluate(
            `(${measureCombatStatusTransactions.toString()})(${Math.min(
              turnCount,
              10
            )})`,
            120_000
          )
        : null;
    if (probeBoundEffectsAudit && nearbyBenchmark !== null) {
      await client.evaluate(`(${restoreCrowdedFixture.toString()})()`, 120_000);
      await client.evaluate('KDHybrid.enableSystem("ai")', 30_000);
      await client.evaluate('KDHybrid.enableSystem("movement")', 30_000);
    }
    const boundEffectsAudit =
      probeBoundEffectsAudit && nearbyBenchmark !== null
        ? await client.evaluate(
            `(${measureBoundEffectsCalls.toString()})(${Math.min(
              turnCount,
              10
            )})`,
            120_000
          )
        : null;
    if (probeLosAudit && nearbyBenchmark !== null) {
      await client.evaluate(`(${restoreCrowdedFixture.toString()})()`, 120_000);
      await client.evaluate('KDHybrid.enableSystem("ai")', 30_000);
      await client.evaluate('KDHybrid.enableSystem("movement")', 30_000);
    }
    const losAudit =
      probeLosAudit && nearbyBenchmark !== null
        ? await client.evaluate(
            `(${measureLOSCalls.toString()})(${Math.min(
              turnCount,
              10
            )})`,
            120_000
          )
        : null;
    if (probeEnemyLoopPathReuseAudit && nearbyBenchmark !== null) {
      await client.evaluate(`(${restoreCrowdedFixture.toString()})()`, 120_000);
      await client.evaluate('KDHybrid.enableSystem("ai")', 30_000);
      await client.evaluate('KDHybrid.enableSystem("movement")', 30_000);
    }
    const enemyLoopPathReuseAudit =
      probeEnemyLoopPathReuseAudit && nearbyBenchmark !== null
        ? await client.evaluate(
            `(${measureEnemyLoopPathReuse.toString()})(${Math.min(
              turnCount,
              10
            )})`,
            120_000
          )
        : null;
    if (nearbyBenchmark !== null) {
      await client.evaluate(`(${restoreCrowdedFixture.toString()})()`, 120_000);
    }
    await client.evaluate('KDHybrid.enableSystem("ai")', 30_000);
    await client.evaluate('KDHybrid.enableSystem("movement")', 30_000);
    await client.evaluate('KDHybrid.enableSystem("pathfinding")', 30_000);
    const pathfindingFallbacks = await client.evaluate(
      `(${measurePathfindingFallbacks.toString()})(${turnCount})`,
      120_000
    );
    if (nearbyBenchmark !== null) {
      await client.evaluate(`(${restoreCrowdedFixture.toString()})()`, 120_000);
    }
    const textureUploadAudit =
      probeTextureUploadAudit && nearbyBenchmark !== null
        ? await client.evaluate(
            `(${measureTextureUploads.toString()})(${turnCount})`,
            120_000
          )
        : null;
    if (textureUploadAudit !== null) {
      await client.evaluate(`(${restoreCrowdedFixture.toString()})()`, 120_000);
    }
    const sharedTextureAudit =
      probeSharedTextureAudit && nearbyBenchmark !== null
        ? await client.evaluate(
            `(async () => {
              const restore = ${restoreCrowdedFixture.toString()};
              const audit = ${measureTextureUploads.toString()};
              const createCandidate =
                ${createSharedTextTextureProbeCandidate.toString()};
              const verifyCandidate =
                ${verifySharedTextTextureCandidate.toString()};
              const benchmarkCandidate =
                ${benchmarkSharedTextTextureCandidate.toString()};
              const benchmarkLiveDraw =
                ${benchmarkSharedTextLiveDraw.toString()};
              const benchmarkLiveFrames =
                ${benchmarkSharedTextLiveFrames.toString()};
              restore();
              for (const [id, sprite] of [...kdpixisprites.entries()]) {
                if (sprite instanceof PIXI.Text) {
                  sprite.parent?.removeChild(sprite);
                  if (!sprite.destroyed) sprite.destroy(true);
                  kdpixisprites.delete(id);
                  kdprimitiveparams.delete(id);
                }
              }
              const official = globalThis.DrawTextVisKD;
              if (typeof official !== "function") {
                throw new Error("DrawTextVisKD is unavailable");
              }
              const verification = await verifyCandidate(
                createCandidate,
                official
              );
              const benchmark = await benchmarkCandidate(
                createCandidate,
                official,
                9,
                120
              );
              const liveDrawBenchmark = await benchmarkLiveDraw(
                createCandidate,
                official,
                restore,
                9
              );
              const liveFrameBenchmark = await benchmarkLiveFrames(
                createCandidate,
                official,
                restore,
                9,
                0
              );
              const turnFrameBenchmark = await benchmarkLiveFrames(
                createCandidate,
                official,
                restore,
                9,
                ${turnCount}
              );
              const stats = {
                calls: 0,
                hits: 0,
                misses: 0,
                entries: 0,
                evictions: 0
              };
              const candidate = createCandidate(stats);
              globalThis.DrawTextVisKD = candidate;
              try {
                return {
                  audit: await audit(${turnCount}),
                  stats: { ...stats },
                  verification,
                  benchmark,
                  liveDrawBenchmark,
                  liveFrameBenchmark,
                  turnFrameBenchmark
                };
              } finally {
                if (globalThis.DrawTextVisKD === candidate) {
                  globalThis.DrawTextVisKD = official;
                }
                candidate.dispose();
              }
            })()`,
            120_000
          )
        : null;
    if (sharedTextureAudit !== null) {
      await client.evaluate(`(${restoreCrowdedFixture.toString()})()`, 120_000);
    }
    await client.evaluate('KDHybrid.enableSystem("ai")', 30_000);
    await client.evaluate('KDHybrid.enableSystem("movement")', 30_000);
    await client.evaluate('KDHybrid.enableSystem("pathfinding")', 30_000);
    await client.evaluate('KDHybrid.enableSystem("events")', 30_000);
    await client.call("Profiler.enable");
    await client.call("Profiler.setSamplingInterval", {
      interval: samplingInterval
    });
    await client.call("Profiler.start");
    const run = await client.evaluate(
      `(${runCrowdedTurns.toString()})(${turnCount})`,
      120_000
    );
    const stopped = await client.call("Profiler.stop", undefined, 120_000);
    const summary = summarizeProfile(stopped.profile);
    const acceptance = assessNearbyAdapter(
      setup.ai,
      setup.commander,
      setup.master,
      setup.nearest,
      setup.movement,
      setup.jailKey,
      nearbyBenchmark,
      nearbyParity,
      turnNearbyParity,
      commanderCompatibility,
      commanderPotentialParity,
      masterCompatibility,
      masterPotentialParity,
      nearestCompatibility,
      nearestGuardedParity,
      nearestTurnParity,
      sourceNearestProbe,
      enemyUpdateCompatibility,
      jailKeyCompatibility,
      run.ai,
      run.master,
      run.nearest,
      run.movement,
      run.jailKey,
      scenario === "crowded"
    );
    const report = {
      schema: 1,
      generatedAt: new Date().toISOString(),
      environment: {
        gameVersion: setup.gameVersion,
        packageVersion: setup.packageVersion,
        runtimeVersion: setup.runtimeVersion,
        pathfindingMode: setup.pathfindingMode,
        sourceNearestPatchVersion: setup.sourceNearestPatchVersion,
        map: setup.map,
        requestedEnemies: enemyCount,
        actualEnemies: setup.actualEnemies,
        scenario,
        scenarioSetup,
        fixtureSource:
          fixtureInputPath === null ? "generated" : "provided",
        suppliedFixtureState,
        turns: turnCount,
        samplingIntervalMicroseconds: samplingInterval,
        findMasterSignatures: setup.findMasterSignatures,
        nearestPlayerSignatures: setup.nearestPlayerSignatures,
        enemyUpdateSignatures: setup.enemyUpdateSignatures,
        jailKeySignatures: setup.jailKeySignatures
      },
      nearbyBenchmark,
      pathfindingBenchmark,
      systemMatrixProbe,
      aiAdapterMatrixProbe,
      factionProbe,
      enemyFlagProbe,
      enemyFlagSingleLookupProbe,
      entityFlagInlineProbe,
      enemyFlagTickProbe,
      enemyFlagTickKeysProbe,
      hostileProbe,
      hostileInlineProbe,
      masterProbe,
      masterFusedProbe,
      nearestProbe,
      nearestHostileFirstProbe,
      nearestHostileFirstMinimalProbe,
      nearestHostileInlineProbe,
      nearestJailGuardHoistProbe,
      nearestFactionInlineProbe,
      nearestHostilityBodyInlineProbe,
      nearestPlayerRouteReuseProbe,
      nearestHostileAfterHelplessProbe,
      nearestHostileAfterImprisonedProbe,
      nearestHelplessFastNegativeProbe,
      globalHelplessFastNegativeProbe,
      helplessDropPackGuardProbe,
      sourceHelplessFastNegativeProbe,
      sourceEnemyDeltaFastPathProbe,
      enemyDebugTimerFastPathProbe,
      enemyLoopAIDataLiteralProbe,
      sourceNearestProbe,
      nearestCandidateFactionReuseProbe,
      sourceBuffEventIndexProbe,
      buffEventPositiveIndexProbe,
      boundEffectsFastNegativeProbe,
      opinionIdSingleLookupProbe,
      findIdSingleGetProbe,
      losDistanceFirstProbe,
      eventDispatchProbe,
      eventDispatchUncheckedProbe,
      inlineEventMapCheckProbe,
      inlineEventMapCheckUncheckedProbe,
      magicEventCacheGuardProbe,
      inventorySnapshotProbe,
      restraintSnapshotUpperBoundProbe,
      tileGetLocalUpperBoundProbe,
      jailKeyEarlyReturnProbe,
      jailGuardCacheProbe,
      enemyAtLiveCacheUpperBoundProbe,
      enemyCacheDedupProbe,
      wanderableCacheProbe,
      smartMovableSingleGetProbe,
      leashingEnemyCacheProbe,
      leashingEnemyFastPathProbe,
      leashingEnemyReferenceCacheProbe,
      leashingEnemyScopedCacheProbe,
      occupancyProbe,
      noEnemyExceptSubInlineProbe,
      enemyCanMoveFusedProbe,
      incrementalMoveCacheProbe,
      batchedMoveCacheProbe,
      batchedMoveCacheVerifiedProbe,
      batchedMoveCacheSafeProbe,
      commanderOrderKeysProbe,
      commanderLocalOrderProbe,
      commanderUnrolledOrdersProbe,
      commanderBatchUnrolledOrdersProbe,
      commanderFusedSelectionProbe,
      commanderBatchProbe,
      commanderHelpProbe,
      commanderHelpPrefilterProbe,
      buffEventIndexProbe,
      buffStatCacheProbe,
      buffStatTightLoopProbe,
      immunityHelperProbe,
      toyBuffSpecializationProbe,
      secretToyNoopReapplyProbe,
      toyBuffTickNoopProbe,
      buffTickKeyLoopProbe,
      buffTickForInProbe,
      buffUpdateBatchProbe,
      checkPathCountProbe,
      dynamicPathArrayProbe,
      nearbyParity,
      turnNearbyParity,
      commanderCompatibility,
      commanderPotentialParity,
      masterCompatibility,
      masterPotentialParity,
      nearestCompatibility,
      nearestGuardedParity,
      nearestTurnParity,
      enemyUpdateCompatibility,
      jailKeyCompatibility,
      masterStatus: setup.master,
      nearestStatus: setup.nearest,
      movementStatus: setup.movement,
      jailKeyStatus: setup.jailKey,
      hotCallCounts,
      eventFamilyAudit,
      combatStatusAudit,
      boundEffectsAudit,
      losAudit,
      enemyLoopPathReuseAudit,
      pathfindingFallbacks,
      textureUploadAudit,
      sharedTextureAudit,
      run,
      acceptance,
      profile: summary
    };
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`Report: ${outputPath}\n`);
    if (!acceptance.passed) {
      throw new Error(
        `${scenario}-turn acceptance failed: ${acceptance.reasons.join("; ")}`
      );
    }
  } finally {
    client.close();
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

function parseInteger(name, value, minimum, maximum) {
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    throw new RangeError(`${name} must be an integer within ${minimum}..${maximum}`);
  }
  return parsed;
}

function assessNearbyAdapter(
  initialStatus,
  initialCommanderStatus,
  initialMasterStatus,
  initialNearestStatus,
  initialMovementStatus,
  initialJailKeyStatus,
  benchmark,
  staticParity,
  turnParity,
  commanderCompatibility,
  commanderPotentialParity,
  masterCompatibility,
  masterPotentialParity,
  nearestCompatibility,
  nearestGuardedParity,
  nearestTurnParity,
  sourceNearestProbe,
  enemyUpdateCompatibility,
  jailKeyCompatibility,
  finalStatus,
  finalMasterStatus,
  finalNearestStatus,
  finalMovementStatus,
  finalJailKeyStatus,
  expectJailKeyExercise
) {
  if (benchmark === null) {
    return {
      passed: true,
      exercisedNativeCalls: null,
      reasons: []
    };
  }

  const nativeCalls = Number(benchmark.optimizedNativeCalls ?? 0);
  const commanderNativeCalls = Number(
    benchmark.optimizedCommanderNativeCalls ?? 0
  );
  const masterNativeCalls = Number(
    benchmark.optimizedMasterNativeCalls ?? 0
  );
  const nearestNativeCalls = Number(
    benchmark.optimizedNearestNativeCalls ?? 0
  );
  const sourceNearestActive = initialNearestStatus?.mode === "source";
  const sourceNearestCalls = Number(
    sourceNearestProbe?.verification?.optimized?.optimizedCalls ?? 0
  );
  const movementNativeCalls = Number(
    benchmark.optimizedMovementNativeCalls ?? 0
  );
  const jailKeyNativeCalls = Number(
    benchmark.optimizedJailKeyNativeCalls ?? 0
  );
  const reasons = [];
  if (finalStatus?.mode !== "native") {
    reasons.push(`AI adapter ended in ${String(finalStatus?.mode)} mode`);
  }
  if (nativeCalls <= 0) {
    reasons.push("AI adapter completed no optimized calls");
  }
  if (initialCommanderStatus?.mode !== "native") {
    reasons.push(
      `commander adapter started in ${String(initialCommanderStatus?.mode)} mode`
    );
  }
  if (commanderNativeCalls <= 0) {
    reasons.push("commander adapter completed no optimized calls");
  }
  if (initialMasterStatus?.mode !== "native") {
    reasons.push(
      `master adapter started in ${String(initialMasterStatus?.mode)} mode`
    );
  }
  if (finalMasterStatus?.mode !== "native") {
    reasons.push(
      `master adapter ended in ${String(finalMasterStatus?.mode)} mode`
    );
  }
  if (masterNativeCalls <= 0) {
    reasons.push("master adapter completed no optimized calls");
  }
  if (Number(benchmark.optimizedMasterFallbackCalls ?? 0) !== 0) {
    reasons.push("master adapter unexpectedly fell back during paired timing");
  }
  if (Number(benchmark.optimizedMasterFailures ?? 0) !== 0) {
    reasons.push("master adapter failed during paired timing");
  }
  if (sourceNearestActive) {
    if (
      finalNearestStatus?.mode !== "source" ||
      finalNearestStatus?.sourcePatchVersion !==
        initialNearestStatus?.sourcePatchVersion
    ) {
      reasons.push("nearest-player source patch did not remain active");
    }
    const baselineStats = sourceNearestProbe?.verification?.baseline;
    const optimizedStats = sourceNearestProbe?.verification?.optimized;
    if (
      sourceNearestProbe?.sourcePatchVersion !==
        initialNearestStatus?.sourcePatchVersion ||
      sourceNearestProbe?.allStatesMatch !== true ||
      sourceNearestProbe?.verification?.stateMatches !== true ||
      Number(baselineStats?.calls ?? 0) <= 0 ||
      Number(baselineStats?.fallbackCalls ?? 0) !==
        Number(baselineStats?.calls ?? 0) ||
      Number(baselineStats?.optimizedCalls ?? 0) !== 0 ||
      sourceNearestCalls <= 0 ||
      sourceNearestCalls !== Number(optimizedStats?.calls ?? 0) ||
      Number(optimizedStats?.fallbackCalls ?? 0) !== 0 ||
      Number(optimizedStats?.canonicalCandidates ?? 0) <= 0
    ) {
      reasons.push("nearest-player source A/B verification failed");
    }
    const fasterPairs = sourceNearestProbe?.samples?.filter(
      (sample) => sample.speedup > 1
    ).length ?? 0;
    if (
      !(sourceNearestProbe?.speedup > 1) ||
      !(sourceNearestProbe?.ratioOfMedians > 1) ||
      fasterPairs <= Number(sourceNearestProbe?.sampleCount ?? 0) / 2
    ) {
      reasons.push(
        `nearest-player source speedup was ${Number(
          sourceNearestProbe?.speedup ?? 0
        ).toFixed(4)}x paired`
      );
    }
  } else {
    if (initialNearestStatus?.mode !== "native") {
      reasons.push(
        `nearest-player adapter started in ${String(initialNearestStatus?.mode)} mode`
      );
    }
    if (finalNearestStatus?.mode !== "native") {
      reasons.push(
        `nearest-player adapter ended in ${String(finalNearestStatus?.mode)} mode`
      );
    }
    if (nearestNativeCalls <= 0) {
      reasons.push("nearest-player adapter completed no optimized calls");
    }
    if (Number(benchmark.optimizedNearestFallbackCalls ?? 0) !== 0) {
      reasons.push(
        "nearest-player adapter unexpectedly fell back during paired timing"
      );
    }
    if (Number(benchmark.optimizedNearestFailures ?? 0) !== 0) {
      reasons.push("nearest-player adapter failed during paired timing");
    }
  }
  if (initialMovementStatus?.mode !== "native") {
    reasons.push(
      `enemy-update cache adapter started in ${String(
        initialMovementStatus?.mode
      )} mode`
    );
  }
  if (finalMovementStatus?.mode !== "native") {
    reasons.push(
      `enemy-update cache adapter ended in ${String(
        finalMovementStatus?.mode
      )} mode`
    );
  }
  if (movementNativeCalls <= 0) {
    reasons.push("enemy-update cache adapter completed no optimized calls");
  }
  if (Number(benchmark.optimizedMovementFallbackCalls ?? 0) !== 0) {
    reasons.push(
      "enemy-update cache adapter unexpectedly fell back during paired timing"
    );
  }
  if (Number(benchmark.optimizedMovementFailures ?? 0) !== 0) {
    reasons.push("enemy-update cache adapter failed during paired timing");
  }
  if (Number(benchmark.optimizedMovementEvents?.["unsafe-move"] ?? 0) !== 0) {
    reasons.push(
      "clean crowded fixture unexpectedly used the unsafe movement path"
    );
  }
  if (initialJailKeyStatus?.mode !== "native") {
    reasons.push(
      `jail-key adapter started in ${String(initialJailKeyStatus?.mode)} mode`
    );
  }
  if (finalJailKeyStatus?.mode !== "native") {
    reasons.push(
      `jail-key adapter ended in ${String(finalJailKeyStatus?.mode)} mode`
    );
  }
  if (expectJailKeyExercise && jailKeyNativeCalls <= 0) {
    reasons.push("jail-key adapter completed no optimized calls");
  }
  if (Number(benchmark.optimizedJailKeyFallbackCalls ?? 0) !== 0) {
    reasons.push("jail-key adapter unexpectedly fell back during paired timing");
  }
  if (Number(benchmark.optimizedJailKeyFailures ?? 0) !== 0) {
    reasons.push("jail-key adapter failed during paired timing");
  }
  if (
    expectJailKeyExercise &&
    Number(benchmark.optimizedJailKeyEvents?.["skipped-scan"] ?? 0) <= 0
  ) {
    reasons.push("jail-key adapter skipped no redundant map scans");
  }
  if (Number(benchmark.optimizedCommanderFailures ?? 0) !== 0) {
    reasons.push("commander adapter failed during paired timing");
  }
  if (Number(benchmark.optimizedFailures ?? 0) !== 0) {
    reasons.push("AI adapter failed during paired timing");
  }
  if (!benchmark.allStatesMatch) {
    reasons.push("baseline and optimized final states differed");
  }
  if (!(benchmark.speedup > 1)) {
    reasons.push(
      `median crowded-turn speedup was ${benchmark.speedup.toFixed(4)}x`
    );
  }
  if (
    staticParity?.failures !== 0 ||
    staticParity?.parityMismatches !== 0 ||
    staticParity?.exactMatches !== staticParity?.compared
  ) {
    reasons.push("static KDNearbyEnemies oracle checks failed");
  }
  if (
    staticParity?.dependencyFallback?.exact !== true ||
    staticParity?.dependencyFallback?.delta?.calls !== 1 ||
    staticParity?.dependencyFallback?.delta?.nativeCalls !== 0 ||
    staticParity?.dependencyFallback?.delta?.fallbackCalls !== 1 ||
    staticParity?.dependencyFallback?.delta?.failures !== 0
  ) {
    reasons.push("modded dependency did not route through exact fallback");
  }
  if (
    turnParity?.failures !== 0 ||
    turnParity?.parityMismatches !== 0 ||
    turnParity?.exactMatches !== turnParity?.calls
  ) {
    reasons.push("live-turn KDNearbyEnemies oracle checks failed");
  }
  if (
    commanderCompatibility?.exact !== true ||
    commanderCompatibility?.replacementCalls <= 0 ||
    commanderCompatibility?.delta?.calls !== 1 ||
    commanderCompatibility?.delta?.nativeCalls !== 0 ||
    commanderCompatibility?.delta?.fallbackCalls !== 1 ||
    commanderCompatibility?.delta?.failures !== 0
  ) {
    reasons.push("modded commander order did not route through exact fallback");
  }
  if (
    commanderPotentialParity?.passed !== true ||
    commanderPotentialParity?.scenarios?.struggle?.exact !== true ||
    commanderPotentialParity?.scenarios?.danger?.exact !== true
  ) {
    reasons.push("commander potential-target fallback parity failed");
  }
  if (
    masterCompatibility?.exact !== true ||
    masterCompatibility?.replacementCalls <= 0 ||
    masterCompatibility?.delta?.calls !== 1 ||
    masterCompatibility?.delta?.nativeCalls !== 0 ||
    masterCompatibility?.delta?.fallbackCalls !== 1 ||
    masterCompatibility?.delta?.failures !== 0
  ) {
    reasons.push("modded master dependency did not route through exact fallback");
  }
  if (
    masterPotentialParity?.passed !== true ||
    masterPotentialParity?.scenarios?.rank?.exact !== true ||
    masterPotentialParity?.scenarios?.leader?.exact !== true
  ) {
    reasons.push("master natural-candidate parity failed");
  }
  if (sourceNearestActive) {
    if (
      nearestCompatibility?.implementation !== "source" ||
      nearestCompatibility?.exact !== true ||
      nearestCompatibility?.replacementCalls <= 0 ||
      nearestCompatibility?.stats?.calls !== 1 ||
      nearestCompatibility?.stats?.optimizedCalls !== 0 ||
      nearestCompatibility?.stats?.fallbackCalls !== 1
    ) {
      reasons.push(
        "modded nearest-player dependency did not route through exact source fallback"
      );
    }
  } else if (
    nearestCompatibility?.exact !== true ||
    nearestCompatibility?.replacementCalls <= 0 ||
    nearestCompatibility?.delta?.calls !== 1 ||
    nearestCompatibility?.delta?.nativeCalls !== 0 ||
    nearestCompatibility?.delta?.fallbackCalls !== 1 ||
    nearestCompatibility?.delta?.failures !== 0
  ) {
    reasons.push(
      "modded nearest-player dependency did not route through exact fallback"
    );
  }
  if (
    nearestGuardedParity?.passed !== true ||
    nearestGuardedParity?.scenarios?.packed?.exact !== true ||
    nearestGuardedParity?.scenarios?.noncanonical?.exact !== true
  ) {
    reasons.push("nearest-player guarded-order parity failed");
  }
  if (
    nearestTurnParity?.failures !== 0 ||
    nearestTurnParity?.mismatches !== 0 ||
    nearestTurnParity?.exactMatches !== nearestTurnParity?.calls
  ) {
    reasons.push("live-turn nearest-player oracle checks failed");
  }
  if (
    enemyUpdateCompatibility?.passed !== true ||
    enemyUpdateCompatibility?.scenarios?.dependency?.exact !== true ||
    enemyUpdateCompatibility?.scenarios?.event?.exact !== true ||
    enemyUpdateCompatibility?.scenarios?.bullet?.exact !== true
  ) {
    reasons.push("enemy-update cache fallback or parity checks failed");
  }
  if (
    jailKeyCompatibility?.passed !== true ||
    jailKeyCompatibility?.scenarios?.full?.exact !== true ||
    jailKeyCompatibility?.scenarios?.missing?.exact !== true ||
    jailKeyCompatibility?.scenarios?.dependency?.exact !== true
  ) {
    reasons.push("jail-key shortcut fallback or parity checks failed");
  }

  return {
    passed: reasons.length === 0,
    exercisedNativeCalls: nativeCalls,
    exercisedCommanderNativeCalls: commanderNativeCalls,
    exercisedMasterNativeCalls: masterNativeCalls,
    exercisedNearestNativeCalls: nearestNativeCalls,
    exercisedSourceNearestCalls: sourceNearestCalls,
    exercisedMovementNativeCalls: movementNativeCalls,
    exercisedJailKeyNativeCalls: jailKeyNativeCalls,
    reasons
  };
}

async function benchmarkNearbyAdapter(
  client,
  enemyCount,
  seed,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  const saved = await client.evaluate(
    `(${saveCrowdedFixture.toString()})()`,
    120_000
  );
  let referenceInitialState = null;
  let referenceInitialStateJson = null;
  const runMode = async (mode) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const initial = restore();
        const aiEnabled = ${
          mode === "optimized"
            ? 'KDHybrid.enableSystem("ai")'
            : 'KDHybrid.disableSystem("ai", "crowded-turn-baseline")'
        };
        const movementEnabled = ${
          mode === "optimized"
            ? 'KDHybrid.enableSystem("movement")'
            : 'KDHybrid.disableSystem("movement", "crowded-turn-baseline")'
        };
        const eventsEnabled = ${
          mode === "optimized"
            ? 'KDHybrid.enableSystem("events")'
            : 'KDHybrid.disableSystem("events", "crowded-turn-baseline")'
        };
        if (!aiEnabled || !movementEnabled || !eventsEnabled) {
          throw new Error("Could not enter ${mode} crowded-turn mode");
        }
        const before = KDHybrid.status().systems.find(
          (status) => status.globalName === "KDNearbyEnemies"
        );
        const beforeCommander = KDHybrid.status().systems.find(
          (status) => status.globalName === "KDCommanderUpdateRoles"
        );
        const beforeMaster = KDHybrid.status().systems.find(
          (status) => status.globalName === "KinkyDungeonFindMaster"
        );
        const beforeNearest = KDHybrid.status().systems.find(
          (status) => status.globalName === "KinkyDungeonNearestPlayer"
        );
        const beforeMovement = KDHybrid.status().systems.find(
          (status) => status.globalName === "KinkyDungeonUpdateEnemies"
        );
        const beforeJailKey = KDHybrid.status().systems.find(
          (status) => status.globalName === "KinkyDungeonPlaceJailKeys"
        );
        const movementEvents = {};
        const jailKeyEvents = {};
        const observerName = "__KDHybridEnemyUpdateCacheObserver";
        const hadObserver = Object.hasOwn(globalThis, observerName);
        const previousObserver = globalThis[observerName];
        const jailObserverName = "__KDHybridJailKeyObserver";
        const hadJailObserver = Object.hasOwn(globalThis, jailObserverName);
        const previousJailObserver = globalThis[jailObserverName];
        globalThis[observerName] = (event) => {
          movementEvents[event] = Number(movementEvents[event] ?? 0) + 1;
        };
        globalThis[jailObserverName] = (event, detail) => {
          jailKeyEvents[event] = Number(jailKeyEvents[event] ?? 0) + 1;
          if (event === "fallback" && detail?.reason) {
            const key = event + ":" + detail.reason;
            jailKeyEvents[key] = Number(jailKeyEvents[key] ?? 0) + 1;
          }
        };
        let result;
        try {
          result = run(${turnsPerSample});
        } finally {
          if (hadObserver) {
            globalThis[observerName] = previousObserver;
          } else {
            delete globalThis[observerName];
          }
          if (hadJailObserver) {
            globalThis[jailObserverName] = previousJailObserver;
          } else {
            delete globalThis[jailObserverName];
          }
        }
        const after = KDHybrid.status().systems.find(
          (status) => status.globalName === "KDNearbyEnemies"
        );
        const afterCommander = KDHybrid.status().systems.find(
          (status) => status.globalName === "KDCommanderUpdateRoles"
        );
        const afterMaster = KDHybrid.status().systems.find(
          (status) => status.globalName === "KinkyDungeonFindMaster"
        );
        const afterNearest = KDHybrid.status().systems.find(
          (status) => status.globalName === "KinkyDungeonNearestPlayer"
        );
        const afterMovement = KDHybrid.status().systems.find(
          (status) => status.globalName === "KinkyDungeonUpdateEnemies"
        );
        const afterJailKey = KDHybrid.status().systems.find(
          (status) => status.globalName === "KinkyDungeonPlaceJailKeys"
        );
        return {
          initial,
          run: result,
          delta: {
            calls: Number(after?.calls ?? 0) - Number(before?.calls ?? 0),
            nativeCalls:
              Number(after?.nativeCalls ?? 0) - Number(before?.nativeCalls ?? 0),
            fallbackCalls:
              Number(after?.fallbackCalls ?? 0) -
              Number(before?.fallbackCalls ?? 0),
            failures:
              Number(after?.failures ?? 0) - Number(before?.failures ?? 0)
          },
          commanderDelta: {
            calls:
              Number(afterCommander?.calls ?? 0) -
              Number(beforeCommander?.calls ?? 0),
            nativeCalls:
              Number(afterCommander?.nativeCalls ?? 0) -
              Number(beforeCommander?.nativeCalls ?? 0),
            fallbackCalls:
              Number(afterCommander?.fallbackCalls ?? 0) -
              Number(beforeCommander?.fallbackCalls ?? 0),
            failures:
              Number(afterCommander?.failures ?? 0) -
              Number(beforeCommander?.failures ?? 0)
          },
          masterDelta: {
            calls:
              Number(afterMaster?.calls ?? 0) -
              Number(beforeMaster?.calls ?? 0),
            nativeCalls:
              Number(afterMaster?.nativeCalls ?? 0) -
              Number(beforeMaster?.nativeCalls ?? 0),
            fallbackCalls:
              Number(afterMaster?.fallbackCalls ?? 0) -
              Number(beforeMaster?.fallbackCalls ?? 0),
            failures:
              Number(afterMaster?.failures ?? 0) -
              Number(beforeMaster?.failures ?? 0)
          },
          nearestDelta: {
            calls:
              Number(afterNearest?.calls ?? 0) -
              Number(beforeNearest?.calls ?? 0),
            nativeCalls:
              Number(afterNearest?.nativeCalls ?? 0) -
              Number(beforeNearest?.nativeCalls ?? 0),
            fallbackCalls:
              Number(afterNearest?.fallbackCalls ?? 0) -
              Number(beforeNearest?.fallbackCalls ?? 0),
            failures:
              Number(afterNearest?.failures ?? 0) -
              Number(beforeNearest?.failures ?? 0)
          },
          movementDelta: {
            calls:
              Number(afterMovement?.calls ?? 0) -
              Number(beforeMovement?.calls ?? 0),
            nativeCalls:
              Number(afterMovement?.nativeCalls ?? 0) -
              Number(beforeMovement?.nativeCalls ?? 0),
            fallbackCalls:
              Number(afterMovement?.fallbackCalls ?? 0) -
              Number(beforeMovement?.fallbackCalls ?? 0),
            failures:
              Number(afterMovement?.failures ?? 0) -
              Number(beforeMovement?.failures ?? 0)
          },
          jailKeyDelta: {
            calls:
              Number(afterJailKey?.calls ?? 0) -
              Number(beforeJailKey?.calls ?? 0),
            nativeCalls:
              Number(afterJailKey?.nativeCalls ?? 0) -
              Number(beforeJailKey?.nativeCalls ?? 0),
            fallbackCalls:
              Number(afterJailKey?.fallbackCalls ?? 0) -
              Number(beforeJailKey?.fallbackCalls ?? 0),
            failures:
              Number(afterJailKey?.failures ?? 0) -
              Number(beforeJailKey?.failures ?? 0)
          },
          movementEvents,
          jailKeyEvents
        };
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    referenceInitialStateJson ??= measured.initial.stateJson;
    if (measured.initial.stateSignature !== referenceInitialState) {
      const expected = referenceInitialStateJson ?? "";
      const actual = measured.initial.stateJson ?? "";
      let difference = 0;
      while (
        difference < expected.length &&
        difference < actual.length &&
        expected[difference] === actual[difference]
      ) {
        difference += 1;
      }
      const contextStart = Math.max(0, difference - 80);
      const contextEnd = difference + 160;
      throw new Error(
        "Restoring the crowded-turn fixture changed its state " +
          `(expected ${referenceInitialState}, got ` +
          `${measured.initial.stateSignature}; first JSON difference at ` +
          `${difference}; expected ${JSON.stringify(
            expected.slice(contextStart, contextEnd)
          )}; actual ${JSON.stringify(
            actual.slice(contextStart, contextEnd)
          )})`
      );
    }
    return {
      ...measured.run,
      adapterDelta: measured.delta,
      commanderDelta: measured.commanderDelta,
      masterDelta: measured.masterDelta,
      nearestDelta: measured.nearestDelta,
      movementDelta: measured.movementDelta,
      jailKeyDelta: measured.jailKeyDelta,
      movementEvents: measured.movementEvents,
      jailKeyEvents: measured.jailKeyEvents
    };
  };

  // KD lazily initializes some process-wide AI state on its first turn. Settle
  // both code paths before collecting paired timings or final-state signatures.
  await runMode("baseline");
  await runMode("optimized");

  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? ["baseline", "optimized"] : ["optimized", "baseline"];
    const pair = { baseline: null, optimized: null };
    for (const mode of order) {
      pair[mode] = await runMode(mode);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches: pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature,
      baselineDelta: pair.baseline.adapterDelta,
      optimizedDelta: pair.optimized.adapterDelta,
      baselineCommanderDelta: pair.baseline.commanderDelta,
      optimizedCommanderDelta: pair.optimized.commanderDelta,
      baselineMasterDelta: pair.baseline.masterDelta,
      optimizedMasterDelta: pair.optimized.masterDelta,
      baselineNearestDelta: pair.baseline.nearestDelta,
      optimizedNearestDelta: pair.optimized.nearestDelta,
      baselineMovementDelta: pair.baseline.movementDelta,
      optimizedMovementDelta: pair.optimized.movementDelta,
      baselineJailKeyDelta: pair.baseline.jailKeyDelta,
      optimizedJailKeyDelta: pair.optimized.jailKeyDelta,
      baselineMovementEvents: pair.baseline.movementEvents,
      optimizedMovementEvents: pair.optimized.movementEvents,
      baselineJailKeyEvents: pair.baseline.jailKeyEvents,
      optimizedJailKeyEvents: pair.optimized.jailKeyEvents
    });
  }
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    fixedSeed: seed,
    saveBytes: saved.bytes,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    optimizedNativeCalls: samples.reduce(
      (total, sample) => total + sample.optimizedDelta.nativeCalls,
      0
    ),
    optimizedFallbackCalls: samples.reduce(
      (total, sample) => total + sample.optimizedDelta.fallbackCalls,
      0
    ),
    optimizedFailures: samples.reduce(
      (total, sample) => total + sample.optimizedDelta.failures,
      0
    ),
    optimizedCommanderNativeCalls: samples.reduce(
      (total, sample) => total + sample.optimizedCommanderDelta.nativeCalls,
      0
    ),
    optimizedCommanderFallbackCalls: samples.reduce(
      (total, sample) => total + sample.optimizedCommanderDelta.fallbackCalls,
      0
    ),
    optimizedCommanderFailures: samples.reduce(
      (total, sample) => total + sample.optimizedCommanderDelta.failures,
      0
    ),
    optimizedMasterNativeCalls: samples.reduce(
      (total, sample) => total + sample.optimizedMasterDelta.nativeCalls,
      0
    ),
    optimizedMasterFallbackCalls: samples.reduce(
      (total, sample) => total + sample.optimizedMasterDelta.fallbackCalls,
      0
    ),
    optimizedMasterFailures: samples.reduce(
      (total, sample) => total + sample.optimizedMasterDelta.failures,
      0
    ),
    optimizedNearestNativeCalls: samples.reduce(
      (total, sample) => total + sample.optimizedNearestDelta.nativeCalls,
      0
    ),
    optimizedNearestFallbackCalls: samples.reduce(
      (total, sample) => total + sample.optimizedNearestDelta.fallbackCalls,
      0
    ),
    optimizedNearestFailures: samples.reduce(
      (total, sample) => total + sample.optimizedNearestDelta.failures,
      0
    ),
    optimizedMovementNativeCalls: samples.reduce(
      (total, sample) => total + sample.optimizedMovementDelta.nativeCalls,
      0
    ),
    optimizedMovementFallbackCalls: samples.reduce(
      (total, sample) => total + sample.optimizedMovementDelta.fallbackCalls,
      0
    ),
    optimizedMovementFailures: samples.reduce(
      (total, sample) => total + sample.optimizedMovementDelta.failures,
      0
    ),
    optimizedJailKeyNativeCalls: samples.reduce(
      (total, sample) => total + sample.optimizedJailKeyDelta.nativeCalls,
      0
    ),
    optimizedJailKeyFallbackCalls: samples.reduce(
      (total, sample) => total + sample.optimizedJailKeyDelta.fallbackCalls,
      0
    ),
    optimizedJailKeyFailures: samples.reduce(
      (total, sample) => total + sample.optimizedJailKeyDelta.failures,
      0
    ),
    optimizedMovementEvents: samples.reduce((total, sample) => {
      for (const [event, count] of Object.entries(
        sample.optimizedMovementEvents
      )) {
        total[event] = Number(total[event] ?? 0) + Number(count);
      }
      return total;
    }, {}),
    optimizedJailKeyEvents: samples.reduce((total, sample) => {
      for (const [event, count] of Object.entries(
        sample.optimizedJailKeyEvents
      )) {
        total[event] = Number(total[event] ?? 0) + Number(count);
      }
      return total;
    }, {}),
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    samples
  };
}

async function benchmarkSystemMatrix(client, sampleCount, turnsPerSample) {
  const systems = ["pathfinding", "ai", "movement", "events"];
  const candidates = [
    { name: "pathfinding", enabled: ["pathfinding"] },
    { name: "ai", enabled: ["ai"] },
    { name: "movement", enabled: ["movement"] },
    { name: "events", enabled: ["events"] },
    { name: "ai+movement", enabled: ["ai", "movement"] },
    { name: "ai+events", enabled: ["ai", "events"] },
    { name: "movement+events", enabled: ["movement", "events"] },
    {
      name: "ai+movement+events",
      enabled: ["ai", "movement", "events"]
    },
    {
      name: "all",
      enabled: ["pathfinding", "ai", "movement", "events"]
    }
  ];
  let referenceInitialState = null;
  const runMode = async (enabledSystems) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const initial = restore();
        const enabled = new Set(${JSON.stringify(enabledSystems)});
        for (const system of ${JSON.stringify(systems)}) {
          const entered = enabled.has(system)
            ? KDHybrid.enableSystem(system)
            : KDHybrid.disableSystem(system, "system-matrix");
          if (!entered) {
            throw new Error("Could not enter system-matrix mode for " + system);
          }
        }
        return {
          initial,
          run: run(${turnsPerSample}),
          modes: Object.fromEntries(
            ${JSON.stringify(systems)}.map((system) => [
              system,
              KDHybrid.systemStatus(system)?.mode ?? null
            ])
          )
        };
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("System-matrix fixture restore changed its initial state");
    }
    return measured;
  };

  const results = [];
  try {
    await runMode([]);
    for (const candidate of candidates) {
      await runMode(candidate.enabled);
    }
    for (const candidate of candidates) {
      const samples = [];
      for (let index = 0; index < sampleCount; index += 1) {
        const order =
          index % 2 === 0
            ? [[], candidate.enabled]
            : [candidate.enabled, []];
        const pair = { baseline: null, candidate: null };
        for (const enabled of order) {
          const measured = await runMode(enabled);
          if (enabled.length === 0) pair.baseline = measured;
          else pair.candidate = measured;
        }
        samples.push({
          baselineMilliseconds: pair.baseline.run.totalMilliseconds,
          candidateMilliseconds: pair.candidate.run.totalMilliseconds,
          speedup:
            pair.baseline.run.totalMilliseconds /
            pair.candidate.run.totalMilliseconds,
          stateMatches:
            pair.baseline.run.stateSignature ===
            pair.candidate.run.stateSignature,
          baselineStateSignature: pair.baseline.run.stateSignature,
          candidateStateSignature: pair.candidate.run.stateSignature,
          candidateModes: pair.candidate.modes
        });
      }
      const baseline = samples.map(
        (sample) => sample.baselineMilliseconds
      );
      const candidateTimes = samples.map(
        (sample) => sample.candidateMilliseconds
      );
      const baselineMedianMilliseconds = median(baseline);
      const candidateMedianMilliseconds = median(candidateTimes);
      results.push({
        name: candidate.name,
        enabled: candidate.enabled,
        sampleCount,
        turnsPerSample,
        baselineMedianMilliseconds,
        candidateMedianMilliseconds,
        speedup: median(samples.map((sample) => sample.speedup)),
        ratioOfMedians:
          baselineMedianMilliseconds / candidateMedianMilliseconds,
        fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
        allStatesMatch: samples.every((sample) => sample.stateMatches),
        samples
      });
    }
  } finally {
    await client.evaluate(
      `(() => {
        for (const system of ${JSON.stringify(systems)}) {
          KDHybrid.enableSystem(system);
        }
      })()`,
      30_000
    );
  }
  return {
    baseline: "all-four-systems-disabled",
    initialStateSignature: referenceInitialState,
    results
  };
}

async function benchmarkAiAdapterMatrix(client, sampleCount, turnsPerSample) {
  const names = [
    "KDNearbyEnemies",
    "KDCommanderUpdateRoles",
    "KinkyDungeonFindMaster",
    "KinkyDungeonNearestPlayer"
  ];
  const candidates = [
    { name: "nearby", selected: ["KDNearbyEnemies"] },
    { name: "commander", selected: ["KDCommanderUpdateRoles"] },
    { name: "master", selected: ["KinkyDungeonFindMaster"] },
    {
      name: "nearby+nearest",
      selected: ["KDNearbyEnemies", "KinkyDungeonNearestPlayer"]
    },
    {
      name: "nearby+master",
      selected: ["KDNearbyEnemies", "KinkyDungeonFindMaster"]
    },
    {
      name: "nearby+master+nearest",
      selected: [
        "KDNearbyEnemies",
        "KinkyDungeonFindMaster",
        "KinkyDungeonNearestPlayer"
      ]
    },
    { name: "all-ai", selected: names }
  ];
  let referenceInitialState = null;
  const runMode = async (selectedNames) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const names = ${JSON.stringify(names)};
        const selected = new Set(${JSON.stringify(selectedNames)});
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable AI for the adapter matrix");
        }
        KDHybrid.disableSystem("pathfinding", "ai-adapter-matrix");
        KDHybrid.disableSystem("movement", "ai-adapter-matrix");
        KDHybrid.disableSystem("events", "ai-adapter-matrix");
        const hookId = KDHybrid.registerHook(
          "ai",
          "before",
          (context) => {
            if (!selected.has(context.globalName)) {
              context.cancelled = true;
            }
          },
          {
            id:
              "kd-hybrid-ai-adapter-matrix-" +
              [...selected].join("-"),
            priority: 100_000
          }
        );
        const status = () =>
          Object.fromEntries(
            KDHybrid.status().systems
              .filter((entry) => names.includes(entry.globalName))
              .map((entry) => [entry.globalName, { ...entry }])
          );
        const before = status();
        try {
          const result = run(${turnsPerSample});
          const after = status();
          return {
            initial,
            run: result,
            selected: [...selected],
            deltas: Object.fromEntries(
              names.map((name) => [
                name,
                {
                  calls:
                    Number(after[name]?.calls ?? 0) -
                    Number(before[name]?.calls ?? 0),
                  nativeCalls:
                    Number(after[name]?.nativeCalls ?? 0) -
                    Number(before[name]?.nativeCalls ?? 0),
                  fallbackCalls:
                    Number(after[name]?.fallbackCalls ?? 0) -
                    Number(before[name]?.fallbackCalls ?? 0),
                  failures:
                    Number(after[name]?.failures ?? 0) -
                    Number(before[name]?.failures ?? 0)
                }
              ])
            )
          };
        } finally {
          KDHybrid.unregisterHook(hookId);
          KDHybrid.enableSystem("ai");
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "AI-adapter matrix fixture restore changed its initial state"
      );
    }
    return measured;
  };

  const results = [];
  try {
    await runMode([]);
    for (const candidate of candidates) {
      await runMode(candidate.selected);
    }
    for (const candidate of candidates) {
      const samples = [];
      for (let index = 0; index < sampleCount; index += 1) {
        const order =
          index % 2 === 0
            ? [[], candidate.selected]
            : [candidate.selected, []];
        const pair = { baseline: null, candidate: null };
        for (const selected of order) {
          const measured = await runMode(selected);
          if (selected.length === 0) pair.baseline = measured;
          else pair.candidate = measured;
        }
        samples.push({
          baselineMilliseconds: pair.baseline.run.totalMilliseconds,
          candidateMilliseconds: pair.candidate.run.totalMilliseconds,
          speedup:
            pair.baseline.run.totalMilliseconds /
            pair.candidate.run.totalMilliseconds,
          stateMatches:
            pair.baseline.run.stateSignature ===
            pair.candidate.run.stateSignature,
          baselineStateSignature: pair.baseline.run.stateSignature,
          candidateStateSignature: pair.candidate.run.stateSignature,
          deltas: pair.candidate.deltas
        });
      }
      const baseline = samples.map(
        (sample) => sample.baselineMilliseconds
      );
      const candidateTimes = samples.map(
        (sample) => sample.candidateMilliseconds
      );
      const baselineMedianMilliseconds = median(baseline);
      const candidateMedianMilliseconds = median(candidateTimes);
      results.push({
        name: candidate.name,
        selected: candidate.selected,
        sampleCount,
        turnsPerSample,
        baselineMedianMilliseconds,
        candidateMedianMilliseconds,
        speedup: median(samples.map((sample) => sample.speedup)),
        ratioOfMedians:
          baselineMedianMilliseconds / candidateMedianMilliseconds,
        fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
        allStatesMatch: samples.every((sample) => sample.stateMatches),
        samples
      });
    }
  } finally {
    await client.evaluate(
      `(() => {
        KDHybrid.enableSystem("pathfinding");
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        KDHybrid.enableSystem("events");
      })()`,
      30_000
    );
  }
  return {
    baseline: "all-ai-facades-cancelled-to-official-with-other-systems-disabled",
    initialStateSignature: referenceInitialState,
    results
  };
}

async function benchmarkPathfindingAdapter(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable AI for pathfinding A/B");
        }
        const enabled = ${
          optimized
            ? 'KDHybrid.enableSystem("pathfinding")'
            : 'KDHybrid.disableSystem("pathfinding", "crowded-turn-path-baseline")'
        };
        if (!enabled) {
          throw new Error("Could not enter the requested pathfinding A/B mode");
        }
        const before = KDHybrid.status().systems.find(
          (status) => status.globalName === "KinkyDungeonFindPath"
        );
        const result = run(${turnsPerSample});
        const after = KDHybrid.status().systems.find(
          (status) => status.globalName === "KinkyDungeonFindPath"
        );
        return {
          initial,
          result,
          delta: {
            calls: Number(after?.calls ?? 0) - Number(before?.calls ?? 0),
            nativeCalls:
              Number(after?.nativeCalls ?? 0) - Number(before?.nativeCalls ?? 0),
            fallbackCalls:
              Number(after?.fallbackCalls ?? 0) -
              Number(before?.fallbackCalls ?? 0),
            failures:
              Number(after?.failures ?? 0) - Number(before?.failures ?? 0)
          }
        };
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Pathfinding A/B fixture restore changed its initial state");
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.result.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.result.totalMilliseconds,
      speedup:
        pair.baseline.result.totalMilliseconds /
        pair.optimized.result.totalMilliseconds,
      stateMatches:
        pair.baseline.result.stateSignature ===
        pair.optimized.result.stateSignature,
      baselineStateSignature: pair.baseline.result.stateSignature,
      optimizedStateSignature: pair.optimized.result.stateSignature,
      baselineDelta: pair.baseline.delta,
      optimizedDelta: pair.optimized.delta
    });
  }
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    samples
  };
}

async function benchmarkFactionFastPath(client, sampleCount, turnsPerSample) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createFactionProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable the AI system for faction probing");
        }
        const official = globalThis.KDGetFaction;
        if (typeof official !== "function") {
          throw new Error("KDGetFaction is unavailable");
        }
        const candidate = ${
          optimized ? "createCandidate(official)" : "null"
        };
        if (candidate !== null) globalThis.KDGetFaction = candidate;
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (candidate !== null && globalThis.KDGetFaction === candidate) {
            globalThis.KDGetFaction = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Faction probe fixture restore changed its initial state");
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createFactionProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KDGetFaction;
      const stats = { fastCalls: 0, fallbackCalls: 0, exactMatches: 0, mismatches: 0 };
      const candidate = createCandidate(official, stats, true);
      globalThis.KDGetFaction = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KDGetFaction === candidate) {
          globalThis.KDGetFaction = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createFactionProbeCandidate(official, stats = null, verify = false) {
  const expectedIsInParty = globalThis.KDIsInParty;
  return function KDGetFactionProbe(enemy) {
    if (
      enemy !== null &&
      typeof enemy === "object" &&
      !enemy.player &&
      !(enemy.rage > 0) &&
      !enemy.faction &&
      Array.isArray(KDGameData.Party) &&
      KDGameData.Party.length === 0 &&
      globalThis.KDIsInParty === expectedIsInParty
    ) {
      let result;
      if (
        KDGameData.Collection &&
        KDIsServant(KDGameData.Collection[enemy.id + ""])
      ) {
        result = "Player";
      } else {
        const definition = enemy.Enemy;
        if ((definition && definition.allied) || enemy.allied) {
          result = "Player";
        } else if (definition && definition.faction) {
          result = definition.faction;
        } else {
          result = "Enemy";
        }
      }
      if (stats !== null) {
        stats.fastCalls += 1;
        if (verify) {
          if (result === official(enemy)) {
            stats.exactMatches += 1;
          } else {
            stats.mismatches += 1;
          }
        }
      }
      return result;
    }
    if (stats !== null) {
      stats.fallbackCalls += 1;
    }
    return official(enemy);
  };
}

async function benchmarkEnemyFlagFastPath(
  client,
  sampleCount,
  turnsPerSample,
  candidateFactory = createEnemyFlagProbeCandidate,
  isolateSystems = false
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${candidateFactory.toString()};
        const initial = restore();
        const isolateSystems = ${isolateSystems};
        const controlName = "KDHybridSourcePatchControl";
        const hadControl = Object.prototype.hasOwnProperty.call(
          globalThis,
          controlName
        );
        const previousControl = globalThis[controlName];
        const control =
          previousControl !== null &&
          typeof previousControl === "object"
            ? previousControl
            : {};
        const hadDisableNearest = Object.prototype.hasOwnProperty.call(
          control,
          "disableNearestPlayer"
        );
        const previousDisableNearest = control.disableNearestPlayer;
        if (isolateSystems) {
          if (!hadControl || previousControl !== control) {
            globalThis[controlName] = control;
          }
          control.disableNearestPlayer = true;
          KDHybrid.disableSystem("ai", "enemy-flag-single-lookup-probe");
        } else if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable the AI system for enemy-flag probing");
        }
        const official = globalThis.KDEnemyHasFlag;
        if (typeof official !== "function") {
          throw new Error("KDEnemyHasFlag is unavailable");
        }
        const candidate = ${
          optimized ? "createCandidate(official)" : "null"
        };
        if (candidate !== null) globalThis.KDEnemyHasFlag = candidate;
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (candidate !== null && globalThis.KDEnemyHasFlag === candidate) {
            globalThis.KDEnemyHasFlag = official;
          }
          if (isolateSystems) {
            KDHybrid.enableSystem("ai");
            if (hadDisableNearest) {
              control.disableNearestPlayer = previousDisableNearest;
            } else {
              delete control.disableNearestPlayer;
            }
            if (!hadControl) {
              delete globalThis[controlName];
            } else if (globalThis[controlName] !== previousControl) {
              globalThis[controlName] = previousControl;
            }
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Enemy-flag probe fixture restore changed its initial state"
      );
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${candidateFactory.toString()};
      restore();
      const isolateSystems = ${isolateSystems};
      const controlName = "KDHybridSourcePatchControl";
      const hadControl = Object.prototype.hasOwnProperty.call(
        globalThis,
        controlName
      );
      const previousControl = globalThis[controlName];
      const control =
        previousControl !== null &&
        typeof previousControl === "object"
          ? previousControl
          : {};
      const hadDisableNearest = Object.prototype.hasOwnProperty.call(
        control,
        "disableNearestPlayer"
      );
      const previousDisableNearest = control.disableNearestPlayer;
      if (isolateSystems) {
        if (!hadControl || previousControl !== control) {
          globalThis[controlName] = control;
        }
        control.disableNearestPlayer = true;
        KDHybrid.disableSystem("ai", "enemy-flag-single-lookup-probe");
      } else {
        KDHybrid.enableSystem("ai");
      }
      const official = globalThis.KDEnemyHasFlag;
      const stats = {
        calls: 0,
        localHits: 0,
        collectionHits: 0,
        misses: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KDEnemyHasFlag = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KDEnemyHasFlag === candidate) {
          globalThis.KDEnemyHasFlag = official;
        }
        if (isolateSystems) {
          KDHybrid.enableSystem("ai");
          if (hadDisableNearest) {
            control.disableNearestPlayer = previousDisableNearest;
          } else {
            delete control.disableNearestPlayer;
          }
          if (!hadControl) {
            delete globalThis[controlName];
          } else if (globalThis[controlName] !== previousControl) {
            globalThis[controlName] = previousControl;
          }
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createEnemyFlagProbeCandidate(official, stats = null, verify = false) {
  return function KDEnemyHasFlagProbe(enemy, flag) {
    if (stats !== null) stats.calls += 1;
    const localFlags = enemy.flags;
    let result = false;
    if (localFlags && (localFlags[flag] > 0 || localFlags[flag] == -1)) {
      result = true;
      if (stats !== null) stats.localHits += 1;
    } else {
      const collectionFlags = KDGameData.Collection["" + enemy.id]?.flags;
      result = !!(
        collectionFlags &&
        (collectionFlags[flag] > 0 || collectionFlags[flag] == -1)
      );
      if (stats !== null) {
        if (result) stats.collectionHits += 1;
        else stats.misses += 1;
      }
    }
    if (stats !== null && verify) {
      if (result === official(enemy, flag)) stats.exactMatches += 1;
      else stats.mismatches += 1;
    }
    return result;
  };
}

function createEnemyFlagSingleLookupCandidate(
  official,
  stats = null,
  verify = false
) {
  return function KDEnemyHasFlagSingleLookupProbe(enemy, flag) {
    if (stats !== null) stats.calls += 1;
    const localValue = enemy.flags?.[flag];
    let result;
    if (localValue > 0 || localValue == -1) {
      result = true;
      if (stats !== null) stats.localHits += 1;
    } else {
      result = KDCollHasFlag(enemy.id, flag);
      if (stats !== null) {
        if (result) stats.collectionHits += 1;
        else stats.misses += 1;
      }
    }
    if (stats !== null && verify) {
      if (result === Reflect.apply(official, this, arguments)) {
        stats.exactMatches += 1;
      } else {
        stats.mismatches += 1;
      }
    }
    return result;
  };
}

async function benchmarkEntityFlagInline(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createEntityFlagInlineCandidate.toString()};
        const initial = restore();
        const controlName = "KDHybridSourcePatchControl";
        const hadControl = Object.prototype.hasOwnProperty.call(
          globalThis,
          controlName
        );
        const previousControl = globalThis[controlName];
        const control =
          previousControl !== null &&
          typeof previousControl === "object"
            ? previousControl
            : {};
        if (!hadControl || previousControl !== control) {
          globalThis[controlName] = control;
        }
        const hadDisableNearest = Object.prototype.hasOwnProperty.call(
          control,
          "disableNearestPlayer"
        );
        const previousDisableNearest = control.disableNearestPlayer;
        control.disableNearestPlayer = true;
        KDHybrid.disableSystem("ai", "entity-flag-inline-probe");
        const official = globalThis.KDEntityHasFlag;
        const enemyHasFlag = globalThis.KDEnemyHasFlag;
        const collectionHasFlag = globalThis.KDCollHasFlag;
        if (
          typeof official !== "function" ||
          typeof enemyHasFlag !== "function" ||
          typeof collectionHasFlag !== "function"
        ) {
          throw new Error("Entity-flag probe dependencies are unavailable");
        }
        const stats = ${
          optimized && diagnostic
            ? `{
                calls: 0,
                playerCalls: 0,
                inlineCalls: 0,
                compatibilityFallbacks: 0,
                exactMatches: 0,
                mismatches: 0
              }`
            : "null"
        };
        const candidate = ${
          optimized
            ? `createCandidate(
                official,
                enemyHasFlag,
                collectionHasFlag,
                stats,
                ${diagnostic}
              )`
            : "null"
        };
        if (candidate !== null) globalThis.KDEntityHasFlag = candidate;
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KDEntityHasFlag === candidate
          ) {
            globalThis.KDEntityHasFlag = official;
          }
          KDHybrid.enableSystem("ai");
          if (hadDisableNearest) {
            control.disableNearestPlayer = previousDisableNearest;
          } else {
            delete control.disableNearestPlayer;
          }
          if (!hadControl) {
            delete globalThis[controlName];
          } else if (globalThis[controlName] !== previousControl) {
            globalThis[controlName] = previousControl;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Entity-flag inline fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = (
        await runMode(optimized)
      ).run;
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await runMode(true, true);
  const compatibility = await client.evaluate(
    `(() => {
      const createCandidate =
        ${createEntityFlagInlineCandidate.toString()};
      const official = globalThis.KDEntityHasFlag;
      const enemyHasFlag = globalThis.KDEnemyHasFlag;
      const collectionHasFlag = globalThis.KDCollHasFlag;
      const stats = {
        calls: 0,
        playerCalls: 0,
        inlineCalls: 0,
        compatibilityFallbacks: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(
        official,
        enemyHasFlag,
        collectionHasFlag,
        stats,
        false
      );
      const enemy = { id: 2147483001, player: false, flags: {} };
      const flag = "__kd_hybrid_entity_flag_probe__";
      let enemyReplacementCalls = 0;
      let collectionReplacementCalls = 0;
      globalThis.KDEnemyHasFlag = () => {
        enemyReplacementCalls += 1;
        return true;
      };
      let enemyReplacementResult;
      try {
        enemyReplacementResult = candidate(enemy, flag);
      } finally {
        globalThis.KDEnemyHasFlag = enemyHasFlag;
      }
      globalThis.KDCollHasFlag = () => {
        collectionReplacementCalls += 1;
        return true;
      };
      let collectionReplacementResult;
      try {
        collectionReplacementResult = candidate(enemy, flag);
      } finally {
        globalThis.KDCollHasFlag = collectionHasFlag;
      }
      return {
        enemyReplacementCalls,
        enemyReplacementResult,
        collectionReplacementCalls,
        collectionReplacementResult,
        compatibilityFallbacks: stats.compatibilityFallbacks,
        passed:
          enemyReplacementCalls === 1 &&
          enemyReplacementResult === true &&
          collectionReplacementCalls === 1 &&
          collectionReplacementResult === true &&
          stats.compatibilityFallbacks === 2
      };
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stats: verification.stats,
      stateSignature: verification.run.stateSignature
    },
    compatibility,
    samples
  };
}

function createEntityFlagInlineCandidate(
  official,
  enemyHasFlag,
  collectionHasFlag,
  stats = null,
  verify = false
) {
  return function KDEntityHasFlagInlineProbe(enemy, flag) {
    if (stats !== null) stats.calls += 1;
    let result;
    if (enemy.player) {
      if (stats !== null) stats.playerCalls += 1;
      result = KinkyDungeonFlags.get(flag) > 0;
    } else if (
      globalThis.KDEnemyHasFlag === enemyHasFlag &&
      globalThis.KDCollHasFlag === collectionHasFlag
    ) {
      if (stats !== null) stats.inlineCalls += 1;
      const localValue = enemy.flags?.[flag];
      result =
        localValue > 0 ||
        localValue == -1 ||
        collectionHasFlag(enemy.id, flag);
    } else {
      if (stats !== null) stats.compatibilityFallbacks += 1;
      result = Reflect.apply(official, this, arguments);
    }
    if (stats !== null && verify) {
      if (result === Reflect.apply(official, this, arguments)) {
        stats.exactMatches += 1;
      } else {
        stats.mismatches += 1;
      }
    }
    return result;
  };
}

async function benchmarkEnemyFlagTick(
  client,
  sampleCount,
  turnsPerSample,
  useKeySnapshot = false
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createEnemyFlagTickProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable AI for the enemy-flag tick probe");
        }
        const official = globalThis.KinkyDungeonTickFlagsEnemy;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonTickFlagsEnemy is unavailable");
        }
        const candidate = ${
          optimized
            ? `createCandidate(official, null, ${useKeySnapshot})`
            : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonTickFlagsEnemy = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonTickFlagsEnemy === candidate
          ) {
            globalThis.KinkyDungeonTickFlagsEnemy = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Enemy-flag tick probe fixture restore changed its state");
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createEnemyFlagTickProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KinkyDungeonTickFlagsEnemy;
      const stats = {
        calls: 0,
        restraintLookups: 0,
        flagsVisited: 0,
        restraintsVisited: 0
      };
      const candidate = createCandidate(official, stats, ${useKeySnapshot});
      globalThis.KinkyDungeonTickFlagsEnemy = candidate;
      try {
        const result = run(${turnsPerSample});
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonTickFlagsEnemy === candidate) {
          globalThis.KinkyDungeonTickFlagsEnemy = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    candidate: useKeySnapshot ? "single-lookup-key-snapshot" : "single-lookup",
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createEnemyFlagTickProbeCandidate(
  official,
  stats = null,
  useKeySnapshot = false
) {
  if (useKeySnapshot) {
    return function KinkyDungeonTickFlagsEnemyKeySnapshotProbe(enemy, delta) {
      if (stats !== null) stats.calls += 1;
      let changed = false;
      if (enemy.flags) {
        const flags = enemy.flags;
        for (const flagName of Object.keys(flags)) {
          if (stats !== null) stats.flagsVisited += 1;
          const flagValue = flags[flagName];
          if (flagValue == -1) continue;
          if (flagValue <= delta) {
            delete flags[flagName];
            changed = true;
          } else if (flagValue > 0) {
            flags[flagName] = flagValue - delta;
            changed = true;
          }
        }
      }
      const restraints = KDGetNPCRestraints(enemy.id);
      if (stats !== null) stats.restraintLookups += 1;
      if (restraints) {
        for (const restraint of Object.values(restraints)) {
          if (stats !== null) stats.restraintsVisited += 1;
          KDTickFlagsRestraint(restraint, delta);
        }
      }
      return changed;
    };
  }

  return function KinkyDungeonTickFlagsEnemySingleLookupProbe(enemy, delta) {
    if (stats !== null) stats.calls += 1;
    let changed = false;
    if (enemy.flags) {
      for (const flag of Object.entries(enemy.flags)) {
        if (stats !== null) stats.flagsVisited += 1;
        if (flag[1] == -1) continue;
        if (flag[1] <= delta) {
          delete enemy.flags[flag[0]];
          changed = true;
        } else if (flag[1] > 0) {
          enemy.flags[flag[0]] = flag[1] - delta;
          changed = true;
        }
      }
    }
    const restraints = KDGetNPCRestraints(enemy.id);
    if (stats !== null) stats.restraintLookups += 1;
    if (restraints) {
      for (const restraint of Object.values(restraints)) {
        if (stats !== null) stats.restraintsVisited += 1;
        KDTickFlagsRestraint(restraint, delta);
      }
    }
    return changed;
  };
}

async function benchmarkHostileFastPath(
  client,
  sampleCount,
  turnsPerSample,
  candidateFactory
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${candidateFactory.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable the AI system for hostility probing");
        }
        const official = globalThis.KDHostile;
        if (typeof official !== "function") {
          throw new Error("KDHostile is unavailable");
        }
        const candidate = ${
          optimized ? "createCandidate(official)" : "null"
        };
        if (candidate !== null) globalThis.KDHostile = candidate;
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (candidate !== null && globalThis.KDHostile === candidate) {
            globalThis.KDHostile = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Hostility probe fixture restore changed its initial state");
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${candidateFactory.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KDHostile;
      const stats = {
        calls: 0,
        cacheHits: 0,
        misses: 0,
        staleEntries: 0,
        ineligibleCalls: 0,
        fastCalls: 0,
        fallbackCalls: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats);
      const verifyingCandidate = function (...args) {
        const expected = Reflect.apply(official, this, args);
        const actual = Reflect.apply(candidate, this, args);
        if (actual === expected) {
          stats.exactMatches += 1;
        } else {
          stats.mismatches += 1;
        }
        return actual;
      };
      globalThis.KDHostile = verifyingCandidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KDHostile === verifyingCandidate) {
          globalThis.KDHostile = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createHostileMemoProbeCandidate(official, stats = null) {
  const expected = {
    getFaction: globalThis.KDGetFaction,
    factionHostile: globalThis.KDFactionHostile,
    opinionRepMod: globalThis.KDOpinionRepMod,
    isInParty: globalThis.KDIsInParty,
    isServant: globalThis.KDIsServant,
    factionRelation: globalThis.KDFactionRelation
  };
  const firstLevel = new WeakMap();

  return function KDHostileMemoProbe(enemy, target) {
    if (stats !== null) stats.calls += 1;
    if (
      typeof enemy !== "object" ||
      enemy === null ||
      typeof target !== "object" ||
      target === null ||
      enemy === target ||
      enemy.player ||
      target.player ||
      !Array.isArray(KDGameData.Party) ||
      KDGameData.Party.length !== 0 ||
      !(KDFactionRelations instanceof Map) ||
      globalThis.KDGetFaction !== expected.getFaction ||
      globalThis.KDFactionHostile !== expected.factionHostile ||
      globalThis.KDOpinionRepMod !== expected.opinionRepMod ||
      globalThis.KDIsInParty !== expected.isInParty ||
      globalThis.KDIsServant !== expected.isServant ||
      globalThis.KDFactionRelation !== expected.factionRelation
    ) {
      if (stats !== null) stats.ineligibleCalls += 1;
      return official(enemy, target);
    }

    const targetEntries = firstLevel.get(enemy);
    const cached = targetEntries?.get(target);
    if (cached !== undefined) {
      const enemyCollection = KDGameData.Collection?.[enemy.id + ""];
      const targetCollection = KDGameData.Collection?.[target.id + ""];
      if (
        matches(cached.enemy, enemy, enemyCollection) &&
        matches(cached.target, target, targetCollection) &&
        relationValue(cached.enemyFaction, cached.targetFaction) ===
          cached.relation
      ) {
        if (stats !== null) stats.cacheHits += 1;
        return cached.result;
      }
      if (stats !== null) stats.staleEntries += 1;
    }

    if (stats !== null) stats.misses += 1;
    const result = official(enemy, target);
    const enemySnapshot = snapshot(enemy);
    const targetSnapshot = snapshot(target);
    const enemyFaction = resolvedFaction(enemySnapshot);
    const targetFaction = resolvedFaction(targetSnapshot);
    const entry = {
      enemy: enemySnapshot,
      target: targetSnapshot,
      enemyFaction,
      targetFaction,
      relation: relationValue(enemyFaction, targetFaction),
      result
    };
    let entries = targetEntries;
    if (entries === undefined) {
      entries = new WeakMap();
      firstLevel.set(enemy, entries);
    }
    entries.set(target, entry);
    return result;
  };

  function snapshot(entity) {
    const definition = entity.Enemy;
    const collectionEntry = KDGameData.Collection?.[entity.id + ""];
    return {
      id: entity.id,
      player: entity.player,
      rage: entity.rage,
      ceasefire: entity.ceasefire,
      hostile: entity.hostile,
      faction: entity.faction,
      allied: entity.allied,
      definition,
      definitionAllied: definition?.allied,
      definitionFaction: definition?.faction,
      collectionEntry,
      collectionStatus: collectionEntry?.status
    };
  }

  function matches(saved, entity, collectionEntry) {
    const definition = entity.Enemy;
    return (
      saved.id === entity.id &&
      saved.player === entity.player &&
      saved.rage === entity.rage &&
      saved.ceasefire === entity.ceasefire &&
      saved.hostile === entity.hostile &&
      saved.faction === entity.faction &&
      saved.allied === entity.allied &&
      saved.definition === definition &&
      saved.definitionAllied === definition?.allied &&
      saved.definitionFaction === definition?.faction &&
      saved.collectionEntry === collectionEntry &&
      saved.collectionStatus === collectionEntry?.status
    );
  }

  function resolvedFaction(saved) {
    if (saved.player) return "Player";
    if (saved.rage > 0) return "Rage";
    if (saved.faction) return saved.faction;
    if (
      saved.collectionEntry &&
      saved.collectionStatus == "Servant"
    ) {
      return "Player";
    }
    if (
      (saved.definition && saved.definitionAllied) ||
      saved.allied
    ) {
      return "Player";
    }
    if (saved.definition && saved.definitionFaction) {
      return saved.definitionFaction;
    }
    return "Enemy";
  }

  function relationValue(left, right) {
    if (left == "Rage" || right == "Rage") return -1;
    if (left == right) return 1;
    const row = KDFactionRelations.get(left);
    const value = row?.get(right);
    return value ? value : 0;
  }
}

function createHostileInlineProbeCandidate(official, stats = null) {
  const expected = {
    getFaction: globalThis.KDGetFaction,
    factionHostile: globalThis.KDFactionHostile,
    opinionRepMod: globalThis.KDOpinionRepMod,
    isInParty: globalThis.KDIsInParty,
    isServant: globalThis.KDIsServant,
    factionRelation: globalThis.KDFactionRelation
  };

  return function KDHostileInlineProbe(enemy, target) {
    if (stats !== null) stats.calls += 1;
    if (
      typeof enemy !== "object" ||
      enemy === null ||
      typeof target !== "object" ||
      target === null ||
      enemy === target ||
      enemy.player ||
      target.player ||
      !Array.isArray(KDGameData.Party) ||
      KDGameData.Party.length !== 0 ||
      !(KDFactionRelations instanceof Map) ||
      globalThis.KDGetFaction !== expected.getFaction ||
      globalThis.KDFactionHostile !== expected.factionHostile ||
      globalThis.KDOpinionRepMod !== expected.opinionRepMod ||
      globalThis.KDIsInParty !== expected.isInParty ||
      globalThis.KDIsServant !== expected.isServant ||
      globalThis.KDFactionRelation !== expected.factionRelation
    ) {
      if (stats !== null) stats.fallbackCalls += 1;
      return official(enemy, target);
    }

    if (stats !== null) stats.fastCalls += 1;
    if (enemy.rage > 0) return true;
    if (target.ceasefire > 0) return false;
    const enemyFaction = resolvedFaction(enemy);
    const targetFaction = resolvedFaction(target);
    if (targetFaction == "Player" && enemy.hostile > 0) return true;
    if (enemyFaction == "Player" && target.hostile > 0) return true;
    if (target.rage > 0) return true;
    if (enemyFaction == "Player" && target.allied > 0) return false;
    if (enemyFaction == "Rage" || targetFaction == "Rage") return true;
    if (enemyFaction == "Player" && targetFaction == "Enemy") return true;
    if (targetFaction == "Player" && enemyFaction == "Enemy") return true;
    if (relationValue(enemyFaction, targetFaction) <= -0.5) return true;
    return false;
  };

  function resolvedFaction(entity) {
    if (entity.player) return "Player";
    if (entity.rage > 0) return "Rage";
    if (entity.faction) return entity.faction;
    const collectionEntry = KDGameData.Collection?.[entity.id + ""];
    if (collectionEntry && collectionEntry.status == "Servant") {
      return "Player";
    }
    const definition = entity.Enemy;
    if ((definition && definition.allied) || entity.allied) return "Player";
    if (definition && definition.faction) return definition.faction;
    return "Enemy";
  }

  function relationValue(left, right) {
    if (left == "Rage" || right == "Rage") return -1;
    if (left == right) return 1;
    const row = KDFactionRelations.get(left);
    const value = row?.get(right);
    return value ? value : 0;
  }
}

async function benchmarkNoEnemyExceptSubInline(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createNoEnemyExceptSubInlineProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error(
            "Could not enable the AI system for no-enemy-except-sub probing"
          );
        }
        const official = globalThis.KinkyDungeonNoEnemyExceptSub;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonNoEnemyExceptSub is unavailable");
        }
        const stats = ${
          optimized
            ? "{ calls: 0, mainMapCalls: 0, occupiedCalls: 0 }"
            : "null"
        };
        const candidate = ${
          optimized ? "createCandidate(official, stats)" : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonNoEnemyExceptSub = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonNoEnemyExceptSub === candidate
          ) {
            globalThis.KinkyDungeonNoEnemyExceptSub = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "No-enemy-except-sub probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature === pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      baselineStats: pair.baseline.stats,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createNoEnemyExceptSubInlineProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KinkyDungeonNoEnemyExceptSub;
      const stats = {
        calls: 0,
        mainMapCalls: 0,
        occupiedCalls: 0
      };
      const candidate = createCandidate(official, stats);
      globalThis.KinkyDungeonNoEnemyExceptSub = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonNoEnemyExceptSub === candidate) {
          globalThis.KinkyDungeonNoEnemyExceptSub = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createNoEnemyExceptSubInlineProbeCandidate(official, stats = null) {
  return function KinkyDungeonNoEnemyExceptSubInlineProbe(
    x,
    y,
    Player,
    Enemy,
    mapData
  ) {
    if (stats !== null) stats.calls += 1;
    let resolvedMap = mapData;
    if (!resolvedMap) resolvedMap = KDMapData;

    let entity;
    if (resolvedMap == KDMapData) {
      if (stats !== null) stats.mainMapCalls += 1;
      const cache = KDGetEnemyCache();
      if (cache) {
        entity = cache.get(x + "," + y);
      } else {
        for (const candidate of resolvedMap.Entities) {
          if (candidate.x == x && candidate.y == y) {
            entity = candidate;
            break;
          }
        }
      }
    } else {
      for (const candidate of resolvedMap.Entities) {
        if (candidate.x == x && candidate.y == y) {
          entity = candidate;
          break;
        }
      }
    }

    if (entity && entity.Enemy) {
      if (stats !== null) stats.occupiedCalls += 1;
      if (
        entity.Enemy.master &&
        Enemy &&
        Enemy.Enemy &&
        entity.Enemy.master.type == Enemy.Enemy.name
      ) {
        return true;
      }
      const seniority = Enemy
        ? KinkyDungeonCanSwapWith(entity, Enemy)
        : false;
      return seniority;
    }
    if (Player && resolvedMap == KDMapData) {
      for (const player of KinkyDungeonPlayers) {
        if (player.x == x && player.y == y) return false;
      }
    }
    return true;
  };
}

async function benchmarkEnemyCanMoveFused(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createEnemyCanMoveFusedProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error(
            "Could not enable the AI system for enemy-movement probing"
          );
        }
        const official = globalThis.KinkyDungeonEnemyCanMove;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonEnemyCanMove is unavailable");
        }
        const stats = ${
          optimized
            ? "{ calls: 0, masterChecks: 0, tileChecks: 0 }"
            : "null"
        };
        const candidate = ${
          optimized ? "createCandidate(official, stats)" : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonEnemyCanMove = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonEnemyCanMove === candidate
          ) {
            globalThis.KinkyDungeonEnemyCanMove = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Enemy-movement probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature === pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      baselineStats: pair.baseline.stats,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createEnemyCanMoveFusedProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KinkyDungeonEnemyCanMove;
      const stats = {
        calls: 0,
        masterChecks: 0,
        tileChecks: 0
      };
      const candidate = createCandidate(official, stats);
      globalThis.KinkyDungeonEnemyCanMove = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonEnemyCanMove === candidate) {
          globalThis.KinkyDungeonEnemyCanMove = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createEnemyCanMoveFusedProbeCandidate(official, stats = null) {
  return function KinkyDungeonEnemyCanMoveFusedProbe(
    enemy,
    dir,
    MovableTiles,
    AvoidTiles,
    ignoreLocks,
    Tries
  ) {
    if (stats !== null) stats.calls += 1;
    if (!dir) return false;

    const master = enemy.master || enemy.Enemy.master;
    const xx = enemy.x + dir.x;
    const yy = enemy.y + dir.y;
    if (master && (!master.aggressive || !enemy.aware || enemy.ignore)) {
      if (stats !== null) stats.masterChecks += 1;
      const found = KinkyDungeonFindMaster(enemy);
      const findMaster = found.master;
      const masterDist = found.dist;
      if (findMaster) {
        const xDistance = xx - findMaster.x;
        const yDistance = yy - findMaster.y;
        const nextDistance = Math.sqrt(
          xDistance * xDistance + yDistance * yDistance
        );
        if (
          nextDistance > master.range &&
          nextDistance > masterDist
        ) {
          return false;
        }
      }
    }

    if (stats !== null) stats.tileChecks += 1;
    const tile = KinkyDungeonMapGet(xx, yy);
    if (
      !((Tries && Tries > 5) || !AvoidTiles.includes(tile)) ||
      !MovableTiles.includes(tile)
    ) {
      return false;
    }
    const tileData = KinkyDungeonTilesGet(xx + "," + yy);
    if (!ignoreLocks && tileData && tileData.Lock) return false;
    return KinkyDungeonNoEnemyExceptSub(
      xx,
      yy,
      !KinkyDungeonLeashingEnemy(),
      enemy
    );
  };
}

async function benchmarkIncrementalMoveCache(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createIncrementalMoveCacheProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error(
            "Could not enable the AI system for incremental-cache probing"
          );
        }
        const official = globalThis.KDMoveEntity;
        if (typeof official !== "function") {
          throw new Error("KDMoveEntity is unavailable");
        }
        const stats = ${
          optimized
            ? `{
                calls: 0,
                movedCalls: 0,
                incrementalUpdates: 0,
                dirtySkips: 0,
                overlapSkips: 0,
                structuralSkips: 0,
                cacheReplacementSkips: 0,
                verifyCache: ${sampleCount === 1},
                cacheMatches: 0,
                cacheMismatches: 0,
                mismatchDetails: []
              }`
            : "null"
        };
        const candidate = ${
          optimized ? "createCandidate(official, stats)" : "null"
        };
        if (candidate !== null) globalThis.KDMoveEntity = candidate;
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KDMoveEntity === candidate
          ) {
            globalThis.KDMoveEntity = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Incremental-cache probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature === pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createIncrementalMoveCacheProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KDMoveEntity;
      const stats = {
        calls: 0,
        movedCalls: 0,
        incrementalUpdates: 0,
        dirtySkips: 0,
        overlapSkips: 0,
        structuralSkips: 0,
        cacheReplacementSkips: 0,
        verifyCache: false,
        cacheMatches: 0,
        cacheMismatches: 0,
        mismatchDetails: []
      };
      const candidate = createCandidate(official, stats);
      globalThis.KDMoveEntity = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KDMoveEntity === candidate) {
          globalThis.KDMoveEntity = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createIncrementalMoveCacheProbeCandidate(official, stats = null) {
  return function KDMoveEntityIncrementalCacheProbe(
    enemy,
    x,
    y,
    willing,
    dash,
    forceHitBullets,
    ignoreBlocked,
    noEvent,
    mapData
  ) {
    if (stats !== null) stats.calls += 1;
    const resolvedMap = mapData || KDMapData;
    const oldX = enemy?.x;
    const oldY = enemy?.y;
    const entities = KDMapData.Entities;
    const entityCount = entities.length;
    const cache = KDEnemyCache;
    const eligible =
      resolvedMap == KDMapData &&
      !KDUpdateEnemyCache &&
      cache instanceof Map &&
      cache.size === entityCount &&
      Number.isSafeInteger(oldX) &&
      Number.isSafeInteger(oldY);
    if (!eligible && stats !== null) stats.dirtySkips += 1;

    const result = Reflect.apply(official, this, [
      enemy,
      x,
      y,
      willing,
      dash,
      forceHitBullets,
      ignoreBlocked,
      noEvent,
      mapData
    ]);

    const newX = enemy?.x;
    const newY = enemy?.y;
    if (newX == oldX && newY == oldY) return result;
    if (stats !== null) stats.movedCalls += 1;
    if (!eligible) return result;
    if (
      KDMapData.Entities !== entities ||
      entities.length !== entityCount
    ) {
      if (stats !== null) stats.structuralSkips += 1;
      return result;
    }
    if (KDEnemyCache !== cache) {
      if (stats !== null) stats.cacheReplacementSkips += 1;
      return result;
    }

    const oldKey = oldX + "," + oldY;
    const newKey = newX + "," + newY;
    const oldEntry = cache.get(oldKey);
    const newEntry = cache.get(newKey);
    if (
      oldEntry !== enemy ||
      newEntry !== undefined
    ) {
      if (stats !== null) stats.overlapSkips += 1;
      return result;
    }

    const next = new Map(cache);
    if (oldKey !== newKey && next.get(oldKey) === enemy) {
      next.delete(oldKey);
    }
    next.set(newKey, enemy);
    if (stats !== null && stats.verifyCache) {
      const expected = new Map();
      for (const candidate of entities) {
        expected.set(candidate.x + "," + candidate.y, candidate);
      }
      let mismatch = expected.size !== next.size;
      let mismatchKey;
      if (!mismatch) {
        for (const [key, expectedEntity] of expected) {
          if (next.get(key) !== expectedEntity) {
            mismatch = true;
            mismatchKey = key;
            break;
          }
        }
      }
      if (mismatch) {
        stats.cacheMismatches += 1;
        if (stats.mismatchDetails.length < 20) {
          const expectedEntity = mismatchKey
            ? expected.get(mismatchKey)
            : undefined;
          const actualEntity = mismatchKey
            ? next.get(mismatchKey)
            : undefined;
          stats.mismatchDetails.push({
            movedId: enemy.id,
            oldKey,
            newKey,
            mismatchKey,
            expectedId: expectedEntity?.id,
            actualId: actualEntity?.id,
            expectedSize: expected.size,
            actualSize: next.size
          });
        }
      } else {
        stats.cacheMatches += 1;
      }
    }
    KDEnemyCache = next;
    KDUpdateEnemyCache = false;
    if (stats !== null) stats.incrementalUpdates += 1;
    return result;
  };
}

async function benchmarkBatchedMoveCache(
  client,
  sampleCount,
  turnsPerSample,
  forceVerification = false,
  strictSafety = false
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createBatchedMoveCacheProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error(
            "Could not enable the AI system for batched move-cache probing"
          );
        }
        const officialUpdate = globalThis.KinkyDungeonUpdateEnemies;
        const officialMove = globalThis.KDMoveEntity;
        if (
          typeof officialUpdate !== "function" ||
          typeof officialMove !== "function"
        ) {
          throw new Error("KD enemy update globals are unavailable");
        }
        const generationKey = "__KDHybridEnemyCacheGeneration";
        const hadGeneration = Object.prototype.hasOwnProperty.call(
          globalThis,
          generationKey
        );
        const previousGeneration = globalThis[generationKey];
        const stats = ${
          optimized
            ? `{
                updateCalls: 0,
                transactionCalls: 0,
                nestedFallbacks: 0,
                dependencyFallbacks: 0,
                riskFallbacks: 0,
                riskScans: 0,
                riskReasons: {},
                effectRiskMoves: 0,
                bulletRiskMoves: 0,
                moveCalls: 0,
                movedCalls: 0,
                fastMoves: 0,
                scannedMoves: 0,
                unsafeMoves: 0,
                workingCopies: 0,
                verifyCache: ${forceVerification || sampleCount === 1},
                cacheMatches: 0,
                cacheMismatches: 0,
                mismatchDetails: []
              }`
            : "null"
        };
        const candidate = ${
          optimized
            ? `createCandidate(
                officialUpdate,
                officialMove,
                stats,
                ${strictSafety}
              )`
            : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonUpdateEnemies = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonUpdateEnemies === candidate
          ) {
            globalThis.KinkyDungeonUpdateEnemies = officialUpdate;
          }
          if (globalThis.KDMoveEntity !== officialMove) {
            globalThis.KDMoveEntity = officialMove;
          }
          if (hadGeneration) {
            globalThis[generationKey] = previousGeneration;
          } else {
            delete globalThis[generationKey];
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Batched move-cache probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature === pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createBatchedMoveCacheProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const officialUpdate = globalThis.KinkyDungeonUpdateEnemies;
      const officialMove = globalThis.KDMoveEntity;
      const generationKey = "__KDHybridEnemyCacheGeneration";
      const hadGeneration = Object.prototype.hasOwnProperty.call(
        globalThis,
        generationKey
      );
      const previousGeneration = globalThis[generationKey];
      const stats = {
        updateCalls: 0,
        transactionCalls: 0,
        nestedFallbacks: 0,
        dependencyFallbacks: 0,
        riskFallbacks: 0,
        riskScans: 0,
        riskReasons: {},
        effectRiskMoves: 0,
        bulletRiskMoves: 0,
        moveCalls: 0,
        movedCalls: 0,
        fastMoves: 0,
        scannedMoves: 0,
        unsafeMoves: 0,
        workingCopies: 0,
        verifyCache: true,
        cacheMatches: 0,
        cacheMismatches: 0,
        mismatchDetails: []
      };
      const candidate = createCandidate(
        officialUpdate,
        officialMove,
        stats,
        ${strictSafety}
      );
      globalThis.KinkyDungeonUpdateEnemies = candidate;
      try {
        const result = run(3);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonUpdateEnemies === candidate) {
          globalThis.KinkyDungeonUpdateEnemies = officialUpdate;
        }
        if (globalThis.KDMoveEntity !== officialMove) {
          globalThis.KDMoveEntity = officialMove;
        }
        if (hadGeneration) {
          globalThis[generationKey] = previousGeneration;
        } else {
          delete globalThis[generationKey];
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    forceVerification,
    strictSafety,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createBatchedMoveCacheProbeCandidate(
  officialUpdate,
  officialMove,
  stats = null,
  strictSafety = false
) {
  const generationKey = "__KDHybridEnemyCacheGeneration";
  let generation = Number(globalThis[generationKey]);
  if (!Number.isSafeInteger(generation) || generation < 0) {
    generation = 0;
  }
  let transaction = null;
  let riskTick;
  let riskEntities;
  let riskEntityCount = -1;
  let cachedRiskReasons = [];

  const advanceGeneration = () => {
    generation =
      generation >= Number.MAX_SAFE_INTEGER ? 1 : generation + 1;
    globalThis[generationKey] = generation;
  };

  const currentRiskReasons = () => {
    const entities = KDMapData.Entities;
    if (
      riskTick === KinkyDungeonCurrentTick &&
      riskEntities === entities &&
      riskEntityCount === entities.length
    ) {
      return cachedRiskReasons;
    }
    if (stats !== null) stats.riskScans += 1;
    const reasons = [];
    const hasMoveEvent = (events) =>
      Array.isArray(events) &&
      events.some((event) => event?.trigger === "enemyMove");
    let entityEvents = false;
    for (const entity of entities) {
      if (
        hasMoveEvent(entity?.events) ||
        hasMoveEvent(entity?.Enemy?.events)
      ) {
        entityEvents = true;
        break;
      }
    }
    if (entityEvents) reasons.push("entity-events");
    for (const [name, eventMap] of [
      ["spell", KDEventMapSpell],
      ["weapon", KDEventMapWeapon],
      ["inventory-selected", KDEventMapInventorySelected],
      ["inventory-icon", KDEventMapInventoryIcon],
      ["inventory", KDEventMapInventory],
      ["bullet", KDEventMapBullet],
      ["buff", KDEventMapBuff],
      ["outfit", KDEventMapOutfit],
      ["generic", KDEventMapGeneric],
      ["alt", KDEventMapAlt],
      ["facility", KDEventMapFacility]
    ]) {
      if (eventMap?.enemyMove !== undefined) {
        reasons.push(name + "-handler");
      }
    }
    riskTick = KinkyDungeonCurrentTick;
    riskEntities = entities;
    riskEntityCount = entities.length;
    cachedRiskReasons = reasons;
    return reasons;
  };

  const moveCandidate = function KDMoveEntityBatchedCacheProbe(
    enemy,
    x,
    y,
    willing,
    dash,
    forceHitBullets,
    ignoreBlocked,
    noEvent,
    mapData
  ) {
    if (stats !== null) stats.moveCalls += 1;
    const active = transaction;
    const resolvedMap = mapData || KDMapData;
    const oldX = enemy?.x;
    const oldY = enemy?.y;
    const entities = KDMapData.Entities;
    const entityCount = entities.length;
    const cache = KDEnemyCache;
    let effectRisk = false;
    let bulletRisk = false;
    if (active !== null && resolvedMap == KDMapData && !noEvent) {
      const effectTiles =
        KDMapData.EffectTiles?.[x + "," + y];
      if (effectTiles) {
        for (const tile of Object.values(effectTiles)) {
          if (
            tile?.duration > 0 &&
            typeof KDEffectTileMoveOnFunctions?.[tile.name] === "function"
          ) {
            effectRisk = true;
            break;
          }
        }
      }
      bulletRisk = KDMapData.Bullets?.length > 0;
    }
    if (stats !== null) {
      if (effectRisk) stats.effectRiskMoves += 1;
      if (bulletRisk) stats.bulletRiskMoves += 1;
    }
    const eligible =
      active !== null &&
      resolvedMap == KDMapData &&
      !effectRisk &&
      !bulletRisk &&
      !KDUpdateEnemyCache &&
      cache instanceof Map &&
      Number.isSafeInteger(oldX) &&
      Number.isSafeInteger(oldY);

    const result = Reflect.apply(officialMove, this, [
      enemy,
      x,
      y,
      willing,
      dash,
      forceHitBullets,
      ignoreBlocked,
      noEvent,
      mapData
    ]);

    const newX = enemy?.x;
    const newY = enemy?.y;
    if (newX == oldX && newY == oldY) return result;
    if (stats !== null) stats.movedCalls += 1;
    if (
      !eligible ||
      KDMapData.Entities !== entities ||
      entities.length !== entityCount ||
      KDEnemyCache !== cache
    ) {
      if (stats !== null) stats.unsafeMoves += 1;
      return result;
    }

    const oldKey = oldX + "," + oldY;
    const newKey = newX + "," + newY;
    const requiresScan =
      cache.size !== entityCount ||
      cache.get(oldKey) !== enemy ||
      cache.has(newKey);
    if (requiresScan) {
      cache.delete(oldKey);
      if (newKey !== oldKey) cache.delete(newKey);
      for (const candidate of entities) {
        const key = candidate.x + "," + candidate.y;
        if (key === oldKey || key === newKey) {
          cache.set(key, candidate);
        }
      }
      if (stats !== null) stats.scannedMoves += 1;
    } else {
      cache.delete(oldKey);
      cache.set(newKey, enemy);
      if (stats !== null) stats.fastMoves += 1;
    }

    if (stats !== null && stats.verifyCache) {
      const expected = new Map();
      for (const candidate of entities) {
        expected.set(candidate.x + "," + candidate.y, candidate);
      }
      let mismatch = expected.size !== cache.size;
      let mismatchKey;
      if (!mismatch) {
        for (const [key, expectedEntity] of expected) {
          if (cache.get(key) !== expectedEntity) {
            mismatch = true;
            mismatchKey = key;
            break;
          }
        }
      }
      if (mismatch) {
        stats.cacheMismatches += 1;
        if (stats.mismatchDetails.length < 20) {
          stats.mismatchDetails.push({
            movedId: enemy.id,
            oldKey,
            newKey,
            mismatchKey,
            expectedSize: expected.size,
            actualSize: cache.size
          });
        }
        KDUpdateEnemyCache = true;
        return result;
      }
      stats.cacheMatches += 1;
    }

    KDUpdateEnemyCache = false;
    active.moved = true;
    advanceGeneration();
    return result;
  };

  return function KinkyDungeonUpdateEnemiesBatchedCacheProbe(
    ...args
  ) {
    if (stats !== null) stats.updateCalls += 1;
    if (transaction !== null) {
      if (stats !== null) stats.nestedFallbacks += 1;
      return Reflect.apply(officialUpdate, this, args);
    }
    if (globalThis.KDMoveEntity !== officialMove) {
      if (stats !== null) stats.dependencyFallbacks += 1;
      return Reflect.apply(officialUpdate, this, args);
    }
    if (strictSafety) {
      const reasons = currentRiskReasons();
      if (reasons.length > 0) {
        if (stats !== null) {
          stats.riskFallbacks += 1;
          for (const reason of reasons) {
            stats.riskReasons[reason] =
              (stats.riskReasons[reason] ?? 0) + 1;
          }
        }
        return Reflect.apply(officialUpdate, this, args);
      }
    }

    const baseCache = KDGetEnemyCache();
    if (!(baseCache instanceof Map)) {
      if (stats !== null) stats.dependencyFallbacks += 1;
      return Reflect.apply(officialUpdate, this, args);
    }
    const previousMove = globalThis.KDMoveEntity;
    const workingCache = new Map(baseCache);
    KDEnemyCache = workingCache;
    KDUpdateEnemyCache = false;
    advanceGeneration();
    transaction = { moved: false };
    globalThis.KDMoveEntity = moveCandidate;
    if (stats !== null) {
      stats.transactionCalls += 1;
      stats.workingCopies += 1;
    }
    try {
      return Reflect.apply(officialUpdate, this, args);
    } finally {
      const moved = transaction.moved;
      transaction = null;
      if (globalThis.KDMoveEntity === moveCandidate) {
        globalThis.KDMoveEntity = previousMove;
      }
      if (moved) {
        KDUpdateEnemyCache = true;
      } else if (
        KDEnemyCache === workingCache &&
        !KDUpdateEnemyCache
      ) {
        KDEnemyCache = baseCache;
        advanceGeneration();
      }
    }
  };
}

async function benchmarkCommanderOrderKeys(
  client,
  sampleCount,
  turnsPerSample,
  cacheKeys = true
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createCommanderOrderKeysProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable the AI system for order-key probing");
        }
        const official = globalThis.KDGetOrdersList;
        if (typeof official !== "function") {
          throw new Error("KDGetOrdersList is unavailable");
        }
        const stats = ${optimized ? "{ calls: 0 }" : "null"};
        const candidate = ${
          optimized
            ? `createCandidate(official, stats, ${cacheKeys})`
            : "null"
        };
        if (candidate !== null) globalThis.KDGetOrdersList = candidate;
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KDGetOrdersList === candidate
          ) {
            globalThis.KDGetOrdersList = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Commander order-key probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature === pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createCommanderOrderKeysProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KDGetOrdersList;
      const stats = { calls: 0 };
      const candidate = createCandidate(official, stats, ${cacheKeys});
      globalThis.KDGetOrdersList = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KDGetOrdersList === candidate) {
          globalThis.KDGetOrdersList = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    cacheKeys,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createCommanderOrderKeysProbeCandidate(
  official,
  stats = null,
  cacheKeys = true
) {
  const orders = KDCommanderOrders;
  if (!cacheKeys) {
    return function KDGetOrdersListLocalOrderProbe(enemy, data) {
      if (stats !== null) stats.calls += 1;
      const result = {};
      for (const name of Object.keys(orders)) {
        const order = orders[name];
        if (order.filter(enemy, data)) {
          result[name] = order.weight(enemy, data);
        }
      }
      return result;
    };
  }
  const orderNames = Object.keys(orders);
  return function KDGetOrdersListKeyProbe(enemy, data) {
    if (stats !== null) stats.calls += 1;
    const result = {};
    for (const name of orderNames) {
      const order = orders[name];
      if (order.filter(enemy, data)) {
        result[name] = order.weight(enemy, data);
      }
    }
    return result;
  };
}

async function benchmarkCommanderUnrolledOrders(
  client,
  sampleCount,
  turnsPerSample,
  cacheCompatibilityByData = false
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createCommanderUnrolledOrdersCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error(
            "Could not enable the AI system for unrolled commander probing"
          );
        }
        const official = globalThis.KDGetOrdersList;
        if (typeof official !== "function") {
          throw new Error("KDGetOrdersList is unavailable");
        }
        const candidate = ${
          optimized
            ? `createCandidate(official, null, ${cacheCompatibilityByData})`
            : "null"
        };
        if (candidate !== null) {
          globalThis.KDGetOrdersList = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidate !== null &&
            globalThis.KDGetOrdersList === candidate
          ) {
            globalThis.KDGetOrdersList = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Unrolled commander fixture restore changed its initial state"
      );
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createCommanderUnrolledOrdersCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KDGetOrdersList;
      const stats = {
        calls: 0,
        canonicalCalls: 0,
        fallbackCalls: 0
      };
      const candidate = createCandidate(
        official,
        stats,
        ${cacheCompatibilityByData}
      );
      globalThis.KDGetOrdersList = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KDGetOrdersList === candidate) {
          globalThis.KDGetOrdersList = official;
        }
      }
    })()`,
    120_000
  );
  const compatibility = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const createCandidate =
        ${createCommanderUnrolledOrdersCandidate.toString()};
      restore();
      const official = globalThis.KDGetOrdersList;
      const originalOrders = KDCommanderOrders;
      const stats = {
        calls: 0,
        canonicalCalls: 0,
        fallbackCalls: 0
      };
      const candidate = createCandidate(
        official,
        stats,
        ${cacheCompatibilityByData}
      );
      const enemy = KDMapData.Entities[0];
      if (!enemy) {
        throw new Error("Unrolled commander probe needs an enemy");
      }
      const data = {
        delta: 1,
        aggressive: false,
        fleeThresh: 0.6,
        VavgWeight: 2,
        combat: false,
        invalidChoke: {},
        globalIgnore: false
      };
      const makeOrder = (name, eligible, weight) => ({
        ...originalOrders[name],
        filter: () => eligible,
        weight: () => weight
      });
      const canonicalOrders = {
        dummy: makeOrder("dummy", false, 0),
        assault: makeOrder("assault", true, 11),
        defend: makeOrder("defend", false, 12),
        guard: makeOrder("guard", true, 13),
        flee: makeOrder("flee", false, 14),
        helpStruggle: makeOrder("helpStruggle", true, 15),
        helpDanger: makeOrder("helpDanger", false, 16),
        moveToCapture: makeOrder("moveToCapture", true, 17)
      };
      const compare = (name, orders) => {
        KDCommanderOrders = orders;
        const caseData = { ...data, invalidChoke: {} };
        const baseline = official(enemy, caseData);
        const optimized = candidate(enemy, caseData);
        return {
          name,
          baseline,
          optimized,
          matches:
            JSON.stringify(baseline) === JSON.stringify(optimized)
        };
      };
      let publicReplacementTookControl = false;
      const cases = [];
      try {
        cases.push(compare("canonical-mod-functions", canonicalOrders));
        cases.push(
          compare("extra-mod-order", {
            ...canonicalOrders,
            modOrder: {
              ...canonicalOrders.guard,
              filter: () => true,
              weight: () => 91
            }
          })
        );
        const reordered = {
          guard: canonicalOrders.guard,
          dummy: canonicalOrders.dummy,
          assault: canonicalOrders.assault,
          defend: canonicalOrders.defend,
          flee: canonicalOrders.flee,
          helpStruggle: canonicalOrders.helpStruggle,
          helpDanger: canonicalOrders.helpDanger,
          moveToCapture: canonicalOrders.moveToCapture
        };
        cases.push(compare("reordered-canonical-keys", reordered));

        const publicReplacement = function () {
          publicReplacementTookControl = true;
          return { replacement: 1 };
        };
        globalThis.KDGetOrdersList = publicReplacement;
        publicReplacementTookControl =
          globalThis.KDGetOrdersList().replacement === 1 &&
          publicReplacementTookControl;
      } finally {
        KDCommanderOrders = originalOrders;
        globalThis.KDGetOrdersList = official;
        restore();
      }
      return {
        cases,
        stats,
        publicReplacementTookControl,
        passed:
          cases.every((entry) => entry.matches) &&
          stats.canonicalCalls === 1 &&
          stats.fallbackCalls === 2 &&
          publicReplacementTookControl
      };
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    cacheCompatibilityByData,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    compatibility,
    samples
  };
}

function createCommanderUnrolledOrdersCandidate(
  official,
  stats = null,
  cacheCompatibilityByData = false
) {
  const orders = KDCommanderOrders;
  const dependencies = [
    "dummy",
    "assault",
    "defend",
    "guard",
    "flee",
    "helpStruggle",
    "helpDanger",
    "moveToCapture"
  ].map((name) => ({
    name,
    order: orders[name]
  }));
  let cachedData = null;
  let cachedCanonical = false;
  return function KDGetOrdersListUnrolledProbe(enemy, data) {
    if (stats !== null) stats.calls += 1;
    let names = null;
    let canonical = false;
    if (
      cacheCompatibilityByData &&
      data === cachedData &&
      cachedCanonical
    ) {
      canonical = true;
      if (stats !== null) {
        stats.compatibilityCacheHits =
          (stats.compatibilityCacheHits ?? 0) + 1;
      }
    } else {
      names = Object.keys(KDCommanderOrders);
      canonical =
        names.length === 8 &&
        names[0] === "dummy" &&
        names[1] === "assault" &&
        names[2] === "defend" &&
        names[3] === "guard" &&
        names[4] === "flee" &&
        names[5] === "helpStruggle" &&
        names[6] === "helpDanger" &&
        names[7] === "moveToCapture";
      if (cacheCompatibilityByData && canonical) {
        canonical =
          KDCommanderOrders === orders &&
          dependencies.every(
            (dependency) =>
              KDCommanderOrders[dependency.name] === dependency.order
          );
      }
      if (cacheCompatibilityByData) {
        cachedData = data;
        cachedCanonical = canonical;
        if (stats !== null) {
          stats.compatibilityChecks =
            (stats.compatibilityChecks ?? 0) + 1;
        }
      }
    }
    const result = {};
    if (!canonical) {
      if (stats !== null) stats.fallbackCalls += 1;
      for (const name of names) {
        if (KDCommanderOrders[name].filter(enemy, data)) {
          result[name] = KDCommanderOrders[name].weight(enemy, data);
        }
      }
      return result;
    }
    if (stats !== null) stats.canonicalCalls += 1;
    if (KDCommanderOrders.dummy.filter(enemy, data)) {
      result.dummy = KDCommanderOrders.dummy.weight(enemy, data);
    }
    if (KDCommanderOrders.assault.filter(enemy, data)) {
      result.assault = KDCommanderOrders.assault.weight(enemy, data);
    }
    if (KDCommanderOrders.defend.filter(enemy, data)) {
      result.defend = KDCommanderOrders.defend.weight(enemy, data);
    }
    if (KDCommanderOrders.guard.filter(enemy, data)) {
      result.guard = KDCommanderOrders.guard.weight(enemy, data);
    }
    if (KDCommanderOrders.flee.filter(enemy, data)) {
      result.flee = KDCommanderOrders.flee.weight(enemy, data);
    }
    if (KDCommanderOrders.helpStruggle.filter(enemy, data)) {
      result.helpStruggle =
        KDCommanderOrders.helpStruggle.weight(enemy, data);
    }
    if (KDCommanderOrders.helpDanger.filter(enemy, data)) {
      result.helpDanger = KDCommanderOrders.helpDanger.weight(enemy, data);
    }
    if (KDCommanderOrders.moveToCapture.filter(enemy, data)) {
      result.moveToCapture =
        KDCommanderOrders.moveToCapture.weight(enemy, data);
    }
    return result;
  };
}

async function benchmarkCommanderFusedSelection(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createCommanderFusedSelectionProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error(
            "Could not enable the AI system for fused commander selection"
          );
        }
        const officialList = globalThis.KDGetOrdersList;
        const officialSelect = globalThis.KDGetByWeight;
        if (
          typeof officialList !== "function" ||
          typeof officialSelect !== "function"
        ) {
          throw new Error("Commander selection functions are unavailable");
        }
        const stats = ${
          optimized
            ? `{
                listCalls: 0,
                selectCalls: 0,
                fusedCalls: 0,
                fallbackCalls: 0,
                exactMatches: 0,
                mismatches: 0
              }`
            : "null"
        };
        const candidate = ${
          optimized
            ? "createCandidate(officialList, officialSelect, stats, false)"
            : "null"
        };
        if (candidate !== null) {
          globalThis.KDGetOrdersList = candidate.list;
          globalThis.KDGetByWeight = candidate.select;
        }
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KDGetOrdersList === candidate.list
          ) {
            globalThis.KDGetOrdersList = officialList;
          }
          if (
            candidate !== null &&
            globalThis.KDGetByWeight === candidate.select
          ) {
            globalThis.KDGetByWeight = officialSelect;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Fused commander selection changed the restored initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createCommanderFusedSelectionProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const officialList = globalThis.KDGetOrdersList;
      const officialSelect = globalThis.KDGetByWeight;
      const stats = {
        listCalls: 0,
        selectCalls: 0,
        fusedCalls: 0,
        fallbackCalls: 0,
        exactMatches: 0,
        mismatches: 0,
        prefixChecks: 0,
        prefixSkips: 0,
        prefixCacheHits: 0,
        scanBudgetFallbacks: 0
      };
      const candidate = createCandidate(
        officialList,
        officialSelect,
        stats,
        true
      );
      globalThis.KDGetOrdersList = candidate.list;
      globalThis.KDGetByWeight = candidate.select;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KDGetOrdersList === candidate.list) {
          globalThis.KDGetOrdersList = officialList;
        }
        if (globalThis.KDGetByWeight === candidate.select) {
          globalThis.KDGetByWeight = officialSelect;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createCommanderFusedSelectionProbeCandidate(
  officialList,
  officialSelect,
  stats = null,
  verify = false
) {
  const orders = KDCommanderOrders;
  const orderNames = Object.keys(orders);
  const token = Object.freeze({});
  const eligible = new Array(orderNames.length).fill(false);
  const thresholds = new Array(orderNames.length).fill(0);
  let pending = false;
  let pendingTotal = 0;
  let active = false;
  let oracle = null;

  const list = function KDGetOrdersListFusedProbe(enemy, data) {
    if (stats !== null) stats.listCalls += 1;
    if (active || pending || KDCommanderOrders !== orders) {
      if (stats !== null) stats.fallbackCalls += 1;
      return Reflect.apply(officialList, this, arguments);
    }
    active = true;
    pendingTotal = 0;
    if (verify) oracle = {};
    try {
      for (let index = 0; index < orderNames.length; index += 1) {
        const name = orderNames[index];
        const order = orders[name];
        const accepted = Boolean(order.filter(enemy, data));
        eligible[index] = accepted;
        thresholds[index] = pendingTotal;
        if (accepted) {
          const weight = order.weight(enemy, data);
          pendingTotal += weight;
          if (verify) oracle[name] = weight;
        }
      }
      pending = true;
      return token;
    } finally {
      active = false;
    }
  };

  const select = function KDGetByWeightFusedProbe(candidateList) {
    if (stats !== null) stats.selectCalls += 1;
    if (candidateList !== token || !pending || active) {
      if (stats !== null) stats.fallbackCalls += 1;
      return Reflect.apply(officialSelect, this, arguments);
    }
    pending = false;
    const selection = KDRandom() * pendingTotal;
    let selected = "";
    for (let index = orderNames.length - 1; index >= 0; index -= 1) {
      if (eligible[index] && selection > thresholds[index]) {
        selected = orderNames[index];
        break;
      }
    }
    if (stats !== null) stats.fusedCalls += 1;
    if (verify && stats !== null) {
      let total = 0;
      const weights = [];
      for (const entry of Object.entries(oracle)) {
        weights.push({ name: entry[0], threshold: total });
        total += entry[1];
      }
      let expected = "";
      const oracleSelection =
        pendingTotal === total ? selection : Number.NaN;
      for (let index = weights.length - 1; index >= 0; index -= 1) {
        if (oracleSelection > weights[index].threshold) {
          expected = weights[index].name;
          break;
        }
      }
      if (selected === expected) stats.exactMatches += 1;
      else stats.mismatches += 1;
    }
    return selected;
  };

  return { list, select };
}

async function benchmarkBuffEventNegativeIndex(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createBuffEventNegativeIndexProbeCandidate.toString()};
        const initial = restore();
        const officialSend = globalThis.KinkyDungeonSendBuffEvent;
        const officialApply = globalThis.KinkyDungeonApplyBuffToEntity;
        if (
          typeof officialSend !== "function" ||
          typeof officialApply !== "function"
        ) {
          throw new Error("KD buff-event globals are unavailable");
        }
        const stats = ${
          optimized
            ? `{
                calls: 0,
                applyCalls: 0,
                indexedTriggers: 0,
                rebuilds: 0,
                warmupScans: 0,
                negativeSkips: 0,
                fallbackScans: 0,
                dependencyFallbacks: 0,
                invalidations: 0,
                eventfulApplies: 0
              }`
            : "null"
        };
        const candidate = ${
          optimized
            ? "createCandidate(officialSend, officialApply, stats)"
            : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonApplyBuffToEntity = candidate.apply;
          globalThis.KinkyDungeonSendBuffEvent = candidate.send;
        }
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonSendBuffEvent === candidate.send
          ) {
            globalThis.KinkyDungeonSendBuffEvent = officialSend;
          }
          if (
            candidate !== null &&
            globalThis.KinkyDungeonApplyBuffToEntity === candidate.apply
          ) {
            globalThis.KinkyDungeonApplyBuffToEntity = officialApply;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Buff-event probe fixture restore changed its state");
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createBuffEventNegativeIndexProbeCandidate.toString()};
      const officialSend = globalThis.KinkyDungeonSendBuffEvent;
      const officialApply = globalThis.KinkyDungeonApplyBuffToEntity;
      const stats = {
        calls: 0,
        applyCalls: 0,
        indexedTriggers: 0,
        rebuilds: 0,
        warmupScans: 0,
        negativeSkips: 0,
        fallbackScans: 0,
        dependencyFallbacks: 0,
        invalidations: 0,
        eventfulApplies: 0
      };
      const candidate = createCandidate(
        officialSend,
        officialApply,
        stats
      );
      const install = () => {
        globalThis.KinkyDungeonApplyBuffToEntity = candidate.apply;
        globalThis.KinkyDungeonSendBuffEvent = candidate.send;
      };
      const uninstall = () => {
        if (globalThis.KinkyDungeonSendBuffEvent === candidate.send) {
          globalThis.KinkyDungeonSendBuffEvent = officialSend;
        }
        if (
          globalThis.KinkyDungeonApplyBuffToEntity === candidate.apply
        ) {
          globalThis.KinkyDungeonApplyBuffToEntity = officialApply;
        }
      };
      const makeEventBuff = (id) => ({
        id,
        type: "KDHybridProbe",
        power: 0,
        duration: 10,
        events: [{
          trigger: "beforeDamageEnemy",
          type: "__KDHybridMissingProbeHandler"
        }]
      });

      restore();
      install();
      let turn;
      let standardApply;
      let explicitInvalidation;
      let tickRefresh;
      let dependencyFallback;
      try {
        turn = run(1);

        restore();
        candidate.invalidate();
        for (let index = 0; index < candidate.activationThreshold; index += 1) {
          candidate.send("beforeDamageEnemy", {});
        }
        KinkyDungeonApplyBuffToEntity(
          KinkyDungeonPlayerEntity,
          makeEventBuff("__KDHybridStandardApply")
        );
        const beforeStandard = { ...stats };
        KinkyDungeonSendBuffEvent("beforeDamageEnemy", {});
        standardApply = {
          fallbackDelta:
            stats.fallbackScans - beforeStandard.fallbackScans,
          dependencyFallbackDelta:
            stats.dependencyFallbacks -
            beforeStandard.dependencyFallbacks
        };

        restore();
        KinkyDungeonPlayerBuffs.__KDHybridDirectInvalidated =
          makeEventBuff("__KDHybridDirectInvalidated");
        candidate.invalidate();
        const beforeInvalidated = { ...stats };
        candidate.send("beforeDamageEnemy", {});
        explicitInvalidation = {
          fallbackDelta:
            stats.fallbackScans - beforeInvalidated.fallbackScans
        };
        delete KinkyDungeonPlayerBuffs.__KDHybridDirectInvalidated;

        restore();
        candidate.invalidate();
        for (let index = 0; index < candidate.activationThreshold; index += 1) {
          candidate.send("beforeDamageEnemy", {});
        }
        KinkyDungeonPlayerBuffs.__KDHybridDirectNextTick =
          makeEventBuff("__KDHybridDirectNextTick");
        const savedTick = KinkyDungeonCurrentTick;
        KinkyDungeonCurrentTick = savedTick + 1;
        const beforeTick = { ...stats };
        candidate.send("beforeDamageEnemy", {});
        tickRefresh = {
          fallbackDelta: stats.fallbackScans - beforeTick.fallbackScans
        };
        KinkyDungeonCurrentTick = savedTick;
        delete KinkyDungeonPlayerBuffs.__KDHybridDirectNextTick;

        restore();
        candidate.invalidate();
        const replacementApply = function (...args) {
          return Reflect.apply(officialApply, this, args);
        };
        globalThis.KinkyDungeonApplyBuffToEntity = replacementApply;
        const beforeDependency = { ...stats };
        candidate.send("tick", {});
        dependencyFallback = {
          fallbackDelta:
            stats.dependencyFallbacks -
            beforeDependency.dependencyFallbacks
        };
        if (
          globalThis.KinkyDungeonApplyBuffToEntity === replacementApply
        ) {
          globalThis.KinkyDungeonApplyBuffToEntity = candidate.apply;
        }
      } finally {
        uninstall();
      }
      return {
        stats,
        turnStateSignature: turn.stateSignature,
        standardApply,
        explicitInvalidation,
        tickRefresh,
        dependencyFallback,
        passed:
          standardApply.fallbackDelta === 1 &&
          standardApply.dependencyFallbackDelta === 0 &&
          explicitInvalidation.fallbackDelta === 1 &&
          tickRefresh.fallbackDelta === 1 &&
          dependencyFallback.fallbackDelta === 1
      };
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createBuffEventNegativeIndexProbeCandidate(
  officialSend,
  officialApply,
  stats = null
) {
  let triggers = null;
  let indexedTick = Number.NaN;
  let indexedPlayerBuffs = null;
  let indexedEntities = null;
  let indexedEntityCount = -1;
  let mapHitsThisEpoch = 0;
  const activationThreshold = 8;

  const addBuffTriggers = (buff) => {
    if (!buff?.events) return;
    for (const event of buff.events) {
      if (event?.trigger !== undefined) triggers.add(event.trigger);
    }
  };
  const rebuild = () => {
    triggers = new Set();
    for (const buff of Object.values(KinkyDungeonPlayerBuffs ?? {})) {
      addBuffTriggers(buff);
    }
    for (const entity of KDMapData.Entities) {
      if (entity.buffs) {
        for (const buff of Object.values(entity.buffs)) {
          addBuffTriggers(buff);
        }
      }
    }
    indexedTick = KinkyDungeonCurrentTick;
    indexedPlayerBuffs = KinkyDungeonPlayerBuffs;
    indexedEntities = KDMapData.Entities;
    indexedEntityCount = KDMapData.Entities.length;
    if (stats !== null) {
      stats.rebuilds += 1;
      stats.indexedTriggers += triggers.size;
    }
  };
  const refreshEpoch = () => {
    if (
      indexedTick !== KinkyDungeonCurrentTick ||
      indexedPlayerBuffs !== KinkyDungeonPlayerBuffs ||
      indexedEntities !== KDMapData.Entities ||
      indexedEntityCount !== KDMapData.Entities.length
    ) {
      triggers = null;
      mapHitsThisEpoch = 0;
      indexedTick = KinkyDungeonCurrentTick;
      indexedPlayerBuffs = KinkyDungeonPlayerBuffs;
      indexedEntities = KDMapData.Entities;
      indexedEntityCount = KDMapData.Entities.length;
    }
  };

  const apply = function KinkyDungeonApplyBuffToEntityEventIndexProbe(
    entity,
    buff,
    changes
  ) {
    if (stats !== null) stats.applyCalls += 1;
    const result = Reflect.apply(officialApply, this, arguments);
    if (triggers !== null && result?.events?.length > 0) {
      addBuffTriggers(result);
      if (stats !== null) stats.eventfulApplies += 1;
    }
    return result;
  };
  const send = function KinkyDungeonSendBuffEventNegativeIndexProbe(
    event,
    data
  ) {
    if (stats !== null) stats.calls += 1;
    if (!KDMapHasEvent(KDEventMapBuff, event)) return;
    if (globalThis.KinkyDungeonApplyBuffToEntity !== apply) {
      if (stats !== null) stats.dependencyFallbacks += 1;
      return Reflect.apply(officialSend, this, arguments);
    }
    refreshEpoch();
    if (triggers === null) {
      mapHitsThisEpoch += 1;
      if (mapHitsThisEpoch < activationThreshold) {
        if (stats !== null) {
          stats.warmupScans += 1;
          stats.fallbackScans += 1;
        }
        return Reflect.apply(officialSend, this, arguments);
      }
      rebuild();
    }
    if (!triggers.has(event)) {
      if (stats !== null) stats.negativeSkips += 1;
      return;
    }
    if (stats !== null) stats.fallbackScans += 1;
    return Reflect.apply(officialSend, this, arguments);
  };

  return {
    apply,
    send,
    activationThreshold,
    invalidate() {
      triggers = null;
      mapHitsThisEpoch = 0;
      if (stats !== null) stats.invalidations += 1;
    }
  };
}

async function benchmarkBuffStatCache(client, sampleCount, turnsPerSample) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createBuffStatCacheProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable AI for the buff-stat cache probe");
        }
        const official = globalThis.KinkyDungeonGetBuffedStat;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonGetBuffedStat is unavailable");
        }
        const stats = ${
          optimized
            ? `{
                calls: 0,
                hits: 0,
                misses: 0,
                invalidations: 0,
                fallbacks: 0,
                exactMatches: 0,
                mismatches: 0
              }`
            : "null"
        };
        const candidate = ${
          optimized
            ? "createCandidate(official, stats, false)"
            : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonGetBuffedStat = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonGetBuffedStat === candidate
          ) {
            globalThis.KinkyDungeonGetBuffedStat = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Buff-stat probe fixture restore changed its state");
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createBuffStatCacheProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KinkyDungeonGetBuffedStat;
      const stats = {
        calls: 0,
        hits: 0,
        misses: 0,
        invalidations: 0,
        fallbacks: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KinkyDungeonGetBuffedStat = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonGetBuffedStat === candidate) {
          globalThis.KinkyDungeonGetBuffedStat = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createBuffStatCacheProbeCandidate(
  official,
  stats = null,
  verify = false
) {
  let tick = KinkyDungeonCurrentTick;
  let cache = new WeakMap();

  return function KinkyDungeonGetBuffedStatCacheProbe(
    list,
    stat,
    onlyPositiveDuration
  ) {
    if (stats !== null) stats.calls += 1;
    if (
      (typeof list !== "object" || list === null) &&
      typeof list !== "function"
    ) {
      if (stats !== null) stats.fallbacks += 1;
      return Reflect.apply(official, this, arguments);
    }
    if (KinkyDungeonCurrentTick !== tick) {
      tick = KinkyDungeonCurrentTick;
      cache = new WeakMap();
      if (stats !== null) stats.invalidations += 1;
    }
    if (KDBuffedStatTypeMemoUpdate.get(list)?.length > 0) {
      cache.delete(list);
      if (stats !== null) stats.invalidations += 1;
    }
    let listCache = cache.get(list);
    if (listCache === undefined) {
      listCache = new Map();
      cache.set(list, listCache);
    }
    const positiveKey = Boolean(onlyPositiveDuration);
    let statCache = listCache.get(stat);
    if (statCache?.has(positiveKey)) {
      if (stats !== null) stats.hits += 1;
      const result = statCache.get(positiveKey);
      if (verify && stats !== null) {
        const expected = Reflect.apply(official, this, arguments);
        if (Object.is(result, expected)) stats.exactMatches += 1;
        else stats.mismatches += 1;
      }
      return result;
    }
    if (stats !== null) stats.misses += 1;
    const result = Reflect.apply(official, this, arguments);
    if (KDBuffedStatTypeMemoUpdate.get(list)?.length > 0) {
      cache.delete(list);
    } else {
      if (statCache === undefined) {
        statCache = new Map();
        listCache.set(stat, statCache);
      }
      statCache.set(positiveKey, result);
    }
    return result;
  };
}

async function benchmarkBuffStatTightLoop(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createBuffStatTightLoopProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable AI for the buff-stat loop probe");
        }
        const official = globalThis.KinkyDungeonGetBuffedStat;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonGetBuffedStat is unavailable");
        }
        const candidate = ${
          optimized ? "createCandidate(official)" : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonGetBuffedStat = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonGetBuffedStat === candidate
          ) {
            globalThis.KinkyDungeonGetBuffedStat = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Buff-stat loop fixture restore changed its state");
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createBuffStatTightLoopProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KinkyDungeonGetBuffedStat;
      const stats = {
        calls: 0,
        memoRebuilds: 0,
        indexedBuffs: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KinkyDungeonGetBuffedStat = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonGetBuffedStat === candidate) {
          globalThis.KinkyDungeonGetBuffedStat = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createBuffStatTightLoopProbeCandidate(
  official,
  stats = null,
  verify = false
) {
  return function KinkyDungeonGetBuffedStatTightLoopProbe(
    list,
    statName,
    onlyPositiveDuration
  ) {
    if (stats !== null) stats.calls += 1;
    let stat = 0;
    if (list) {
      const updateList = KDBuffedStatTypeMemoUpdate.get(list);
      let memo = KDBuffedStatTypeMemo.get(list);
      if (updateList?.length > 0 || !memo) {
        KDUpdateBuffedStatTypeMemo(list);
        memo = KDBuffedStatTypeMemo.get(list);
        if (stats !== null) stats.memoRebuilds += 1;
      }
      const buffs = memo?.[statName];
      if (buffs) {
        for (let index = 0; index < buffs.length; index += 1) {
          const buff = buffs[index];
          if (
            buff &&
            buff.type == statName &&
            KDBuffEnabled(list, buff, onlyPositiveDuration)
          ) {
            stat += buff.power;
          }
          if (stats !== null) stats.indexedBuffs += 1;
        }
      }
    }
    if (verify && stats !== null) {
      const expected = Reflect.apply(official, this, arguments);
      if (Object.is(stat, expected)) stats.exactMatches += 1;
      else stats.mismatches += 1;
    }
    return stat;
  };
}

async function benchmarkImmunityHelper(client, sampleCount, turnsPerSample) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createImmunityHelperProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable AI for the immunity-helper probe");
        }
        const official = globalThis.KinkyDungeonGetImmunity;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonGetImmunity is unavailable");
        }
        const candidate = ${
          optimized ? "createCandidate(official)" : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonGetImmunity = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonGetImmunity === candidate
          ) {
            globalThis.KinkyDungeonGetImmunity = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Immunity-helper probe fixture restore changed its state");
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createImmunityHelperProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KinkyDungeonGetImmunity;
      const stats = {
        calls: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KinkyDungeonGetImmunity = candidate;
      try {
        const result = run(${turnsPerSample});
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonGetImmunity === candidate) {
          globalThis.KinkyDungeonGetImmunity = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createImmunityHelperProbeCandidate(
  official,
  stats = null,
  verify = false
) {
  const hasImmunity = (t, tags, profile, type, resist, mode) => {
    if (!mode || mode == 1) {
      if (tags && tags[t + resist]) return true;
      if (profile) {
        for (const profileName of profile) {
          const resistanceProfile = KDResistanceProfiles[profileName];
          if (resistanceProfile && resistanceProfile[t + resist]) return true;
        }
      }
    }
    if (!mode || mode == 2) {
      if (
        tags &&
        (((KinkyDungeonMeleeDamageTypes.includes(t) &&
          (type != "unarmed" || !resist.includes("weakness"))) &&
          tags["melee" + resist]) ||
          (!KinkyDungeonMeleeDamageTypes.includes(t) &&
            tags["magic" + resist]))
      ) {
        return true;
      }
      if (profile) {
        for (const profileName of profile) {
          const resistanceProfile = KDResistanceProfiles[profileName];
          if (
            resistanceProfile &&
            (((KinkyDungeonMeleeDamageTypes.includes(t) &&
              (type != "unarmed" || !resist.includes("weakness"))) &&
              resistanceProfile["melee" + resist]) ||
              (!KinkyDungeonMeleeDamageTypes.includes(t) &&
                resistanceProfile["magic" + resist]))
          ) {
            return true;
          }
        }
      }
    }
    return false;
  };

  return function KinkyDungeonGetImmunitySharedHelperProbe(
    tags,
    profile,
    type,
    resist,
    mode = 0
  ) {
    if (stats !== null) stats.calls += 1;
    let result = false;
    if (hasImmunity(
      KDDamageEquivalencies[type] || type,
      tags,
      profile,
      type,
      resist,
      mode
    )) {
      result = true;
    } else {
      let currentType = KDDamageEquivalencies[type] || type;
      if (KinkyDungeonDamageTypesExtension[currentType]) {
        for (let index = 0; index < 10; index += 1) {
          if (KinkyDungeonDamageTypesExtension[currentType]) {
            currentType = KinkyDungeonDamageTypesExtension[currentType];
          } else {
            if (
              hasImmunity(
                currentType,
                tags,
                profile,
                type,
                resist,
                mode
              )
            ) {
              result = true;
            }
            break;
          }
        }
      }
    }
    if (verify && stats !== null) {
      const expected = Reflect.apply(official, this, arguments);
      if (Object.is(result, expected)) stats.exactMatches += 1;
      else stats.mismatches += 1;
    }
    return result;
  };
}

async function benchmarkToyBuffSpecialization(
  client,
  sampleCount,
  turnsPerSample,
  candidateKind = "fresh-object"
) {
  const candidateFactory =
    candidateKind === "noop-reapply"
      ? createSecretToyNoopReapplyCandidate
      : createToyBuffSpecializationCandidate;
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${candidateFactory.toString()};
        const firstInitial = restore();
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        KDHybrid.enableSystem("pathfinding");
        KDHybrid.enableSystem("events");
        const official = globalThis.KinkyDungeonApplyBuffToEntity;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonApplyBuffToEntity is unavailable");
        }
        const candidate = ${
          optimized ? "createCandidate(official)" : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonApplyBuffToEntity = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonApplyBuffToEntity === candidate
          ) {
            globalThis.KinkyDungeonApplyBuffToEntity = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Toy-buff specialization fixture restore changed its initial state"
      );
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds /
        pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature ===
        pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${candidateFactory.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      KDHybrid.enableSystem("movement");
      KDHybrid.enableSystem("pathfinding");
      KDHybrid.enableSystem("events");
      const official = globalThis.KinkyDungeonApplyBuffToEntity;
      const stats = {
        calls: 0,
        fastCalls: 0,
        fallbackCalls: 0,
        exactMatches: 0,
        mismatches: 0,
        shapeCompatible: false
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KinkyDungeonApplyBuffToEntity = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonApplyBuffToEntity === candidate) {
          globalThis.KinkyDungeonApplyBuffToEntity = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    candidateKind,
    safety:
      candidateKind === "noop-reapply"
        ? "upper-bound-value-exact-object-identity-different"
        : "exact-kd-5.4.92-toy-shape-fresh-object-specialization",
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

async function benchmarkToyBuffTickNoop(
  client,
  sampleCount,
  turnsPerSample,
  candidateKind = "toy-noop"
) {
  const candidateFactory =
    candidateKind === "key-loop"
      ? createBuffTickKeyLoopCandidate
      : candidateKind === "for-in"
        ? createBuffTickForInCandidate
        : createToyBuffTickNoopCandidate;
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${candidateFactory.toString()};
        const initial = restore();
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        KDHybrid.enableSystem("pathfinding");
        KDHybrid.enableSystem("events");
        const official = globalThis.KinkyDungeonTickBuffs;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonTickBuffs is unavailable");
        }
        const stats = {
          calls: 0,
          fastCalls: 0,
          fallbackCalls: 0
        };
        const candidate = ${
          optimized ? "createCandidate(official, stats)" : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonTickBuffs = candidate;
        }
        let result;
        try {
          result = run(${turnsPerSample});
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonTickBuffs === candidate
          ) {
            globalThis.KinkyDungeonTickBuffs = official;
          }
        }
        return {
          initial,
          run: result,
          stats,
          restored:
            globalThis.KinkyDungeonTickBuffs === official
        };
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Toy-buff tick fixture restore changed its initial state"
      );
    }
    if (!measured.restored) {
      throw new Error(
        "Toy-buff tick candidate did not restore the official function"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats,
      baselineRestored: pair.baseline.restored,
      optimizedRestored: pair.optimized.restored
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${candidateFactory.toString()};
      const initial = restore();
      KDHybrid.enableSystem("ai");
      KDHybrid.enableSystem("movement");
      KDHybrid.enableSystem("pathfinding");
      KDHybrid.enableSystem("events");
      const official = globalThis.KinkyDungeonTickBuffs;
      const stats = {
        calls: 0,
        fastCalls: 0,
        fallbackCalls: 0
      };
      const candidate = createCandidate(official, stats);
      globalThis.KinkyDungeonTickBuffs = candidate;
      let result;
      try {
        result = run(1);
      } finally {
        if (globalThis.KinkyDungeonTickBuffs === candidate) {
          globalThis.KinkyDungeonTickBuffs = official;
        }
      }
      return {
        initialStateSignature: initial.stateSignature,
        stateSignature: result.stateSignature,
        ...stats,
        restored: globalThis.KinkyDungeonTickBuffs === official
      };
    })()`,
    120_000
  );
  const compatibility =
    candidateKind === "toy-noop"
      ? await client.evaluate(
          `(() => {
      const createCandidate =
        ${createToyBuffTickNoopCandidate.toString()};
      const official = globalThis.KinkyDungeonTickBuffs;
      let observedOfficialCalls = 0;
      const observedOfficial = function (...args) {
        observedOfficialCalls += 1;
        return Reflect.apply(official, this, args);
      };
      const stats = {
        calls: 0,
        fastCalls: 0,
        fallbackCalls: 0
      };
      const candidate = createCandidate(observedOfficial, stats);
      const baseBuff = () => ({
        id: "Toy",
        type: "Plug",
        power: 0.1,
        duration: 9999,
        infinite: true,
        range: 0.5,
        tags: ["toy"]
      });
      const results = [];
      const exerciseFallback = (
        name,
        entity,
        delta = 1,
        endFloor = false
      ) => {
        const before = observedOfficialCalls;
        candidate(entity, delta, endFloor);
        results.push({
          name,
          routedToOfficial:
            observedOfficialCalls === before + 1
        });
      };

      const officialFastEntity = { buffs: { Toy: baseBuff() } };
      const candidateFastEntity = { buffs: { Toy: baseBuff() } };
      official(officialFastEntity, 1, false);
      const beforeFastOfficialCalls = observedOfficialCalls;
      candidate(candidateFastEntity, 1, false);
      const fastExact =
        JSON.stringify(candidateFastEntity) ===
        JSON.stringify(officialFastEntity);
      const fastStayedNative =
        observedOfficialCalls === beforeFastOfficialCalls;

      exerciseFallback("multiple-buffs", {
        buffs: {
          Toy: baseBuff(),
          Other: {
            id: "Other",
            type: "Other",
            duration: 9999,
            infinite: true
          }
        }
      });
      exerciseFallback("expired-duration", {
        buffs: { Toy: { ...baseBuff(), duration: 0 } }
      });
      exerciseFallback("finite", {
        buffs: { Toy: { ...baseBuff(), infinite: false } }
      });
      exerciseFallback(
        "end-floor",
        {
          buffs: { Toy: { ...baseBuff(), endFloor: true } }
        },
        1,
        true
      );

      const sleepTurns = KDGameData.SleepTurns;
      try {
        KDGameData.SleepTurns = 2;
        exerciseFallback("end-sleep", {
          buffs: { Toy: { ...baseBuff(), endSleep: true } }
        });
      } finally {
        KDGameData.SleepTurns = sleepTurns;
      }

      const hadCustomPlug = Object.prototype.hasOwnProperty.call(
        KDCustomBuff,
        "Plug"
      );
      const customPlug = KDCustomBuff.Plug;
      let customPlugCalls = 0;
      try {
        KDCustomBuff.Plug = () => {
          customPlugCalls += 1;
        };
        exerciseFallback("custom-plug-handler", {
          buffs: { Toy: baseBuff() }
        });
      } finally {
        if (hadCustomPlug) KDCustomBuff.Plug = customPlug;
        else delete KDCustomBuff.Plug;
      }

      const replacement = function KDModTickReplacement() {};
      globalThis.KinkyDungeonTickBuffs = replacement;
      const replacementObserved =
        globalThis.KinkyDungeonTickBuffs === replacement;
      globalThis.KinkyDungeonTickBuffs = official;
      const officialRestored =
        globalThis.KinkyDungeonTickBuffs === official;
      return {
        fastExact,
        fastStayedNative,
        fallbackCases: results,
        allFallbacks:
          results.length === 6 &&
          results.every((entry) => entry.routedToOfficial),
        customPlugCalls,
        replacementObserved,
        officialRestored,
        stats,
        passed:
          fastExact &&
          fastStayedNative &&
          results.length === 6 &&
          results.every((entry) => entry.routedToOfficial) &&
          customPlugCalls === 1 &&
          replacementObserved &&
          officialRestored
      };
    })()`,
          120_000
        )
      : await verifyBuffTickLoopCompatibility(
          client,
          candidateFactory,
          candidateKind
        );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map(
    (sample) => sample.optimizedMilliseconds
  );
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  const fasterPairs = samples.filter(
    (sample) =>
      sample.optimizedMilliseconds < sample.baselineMilliseconds
  ).length;
  const ratioOfMedians =
    baselineMedianMilliseconds / optimizedMedianMilliseconds;
  return {
    candidateKind,
    safety:
      candidateKind === "toy-noop"
        ? "exact-noop-guard-with-official-fallback-and-mod-handler-check"
        : "own-key-empty-or-single-fast-path-with-multi-buff-fallback",
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians,
    fasterPairs,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    allFunctionsRestored: samples.every(
      (sample) =>
        sample.baselineRestored && sample.optimizedRestored
    ),
    verification,
    compatibility,
    accepted:
      ratioOfMedians >= 1.05 &&
      fasterPairs >= Math.ceil(sampleCount * 0.75) &&
      samples.every((sample) => sample.stateMatches) &&
      samples.every(
        (sample) =>
          sample.baselineRestored && sample.optimizedRestored
      ) &&
      verification.fastCalls > 0 &&
      (candidateKind === "toy-noop"
        ? verification.fallbackCalls > 0
        : compatibility.fallbackCalls > 0) &&
      verification.restored &&
      compatibility.passed,
    samples
  };
}

async function verifyBuffTickLoopCompatibility(
  client,
  candidateFactory,
  candidateKind
) {
  return client.evaluate(
    `(() => {
      const createCandidate = ${candidateFactory.toString()};
      const official = globalThis.KinkyDungeonTickBuffs;
      let observedOfficialCalls = 0;
      const observedOfficial = function (...args) {
        observedOfficialCalls += 1;
        return Reflect.apply(official, this, args);
      };
      const stats = {
        calls: 0,
        fastCalls: 0,
        fallbackCalls: 0
      };
      const candidate = createCandidate(observedOfficial, stats);
      const cases = [];
      const previousMemo = KDBuffedStatTypeMemo;
      const previousMemoUpdate = KDBuffedStatTypeMemoUpdate;
      const customType = "KDHybridBuffTickProbe";
      const hadCustom = Object.prototype.hasOwnProperty.call(
        KDCustomBuff,
        customType
      );
      const previousCustom = KDCustomBuff[customType];
      const customCalls = { official: 0, candidate: 0 };
      let customPhase = "official";

      const makeBuff = (changes = {}) => ({
        id: "Probe",
        type: "Other",
        power: 1,
        duration: 9999,
        infinite: true,
        ...changes
      });
      const runPair = (
        name,
        makeList,
        expectedRoute,
        delta = 1,
        endFloor = false,
        beforeOfficial = null,
        beforeCandidate = null
      ) => {
        const officialEntity = { buffs: makeList() };
        const candidateEntity = { buffs: makeList() };
        beforeOfficial?.();
        official(officialEntity, delta, endFloor);
        const officialCallsBefore = observedOfficialCalls;
        const fastCallsBefore = stats.fastCalls;
        const fallbackCallsBefore = stats.fallbackCalls;
        beforeCandidate?.();
        candidate(candidateEntity, delta, endFloor);
        const actualRoute =
          observedOfficialCalls === officialCallsBefore + 1
            ? "fallback"
            : stats.fastCalls === fastCallsBefore + 1
              ? "fast"
              : "unknown";
        cases.push({
          name,
          expectedRoute,
          actualRoute,
          exact:
            JSON.stringify(candidateEntity) ===
            JSON.stringify(officialEntity),
          fallbackCountExact:
            expectedRoute === "fallback"
              ? stats.fallbackCalls === fallbackCallsBefore + 1
              : stats.fallbackCalls === fallbackCallsBefore
        });
      };

      try {
        KDBuffedStatTypeMemo = new Map();
        KDBuffedStatTypeMemoUpdate = new Map();
        KDCustomBuff[customType] = (entity, buff) => {
          customCalls[customPhase] += 1;
          buff.power += 1;
        };

        runPair("empty", () => ({}), "fast");
        runPair(
          "single-infinite",
          () => ({ Probe: makeBuff() }),
          "fast"
        );
        runPair(
          "single-finite",
          () => ({
            Probe: makeBuff({ duration: 3, infinite: false })
          }),
          "fast"
        );
        runPair(
          "single-expired",
          () => ({
            Probe: makeBuff({ duration: 0, infinite: false })
          }),
          "fast"
        );
        runPair(
          "single-reset-duration",
          () => ({
            Probe: makeBuff({
              duration: 0,
              infinite: false,
              resetDurationTime: 4,
              resetDurationPower: 1,
              power: 3
            })
          }),
          "fast"
        );
        runPair(
          "single-end-floor",
          () => ({
            Probe: makeBuff({ endFloor: true })
          }),
          "fast",
          1,
          true
        );
        runPair(
          "single-custom-handler",
          () => ({
            Probe: makeBuff({ type: customType })
          }),
          "fast",
          1,
          false,
          () => {
            customPhase = "official";
          },
          () => {
            customPhase = "candidate";
          }
        );
        runPair(
          "null-prototype",
          () => {
            const list = Object.create(null);
            list.Probe = makeBuff();
            return list;
          },
          "fast"
        );
        runPair(
          "multiple-buffs",
          () => ({
            First: makeBuff(),
            Second: makeBuff({ id: "Second" })
          }),
          "fallback"
        );
        runPair(
          "custom-container",
          () => {
            class BuffList {}
            const list = new BuffList();
            list.Probe = makeBuff();
            return list;
          },
          "fast"
        );
      } finally {
        KDBuffedStatTypeMemo = previousMemo;
        KDBuffedStatTypeMemoUpdate = previousMemoUpdate;
        if (hadCustom) KDCustomBuff[customType] = previousCustom;
        else delete KDCustomBuff[customType];
      }

      const replacement = function KDModTickReplacement() {};
      globalThis.KinkyDungeonTickBuffs = replacement;
      const replacementObserved =
        globalThis.KinkyDungeonTickBuffs === replacement;
      globalThis.KinkyDungeonTickBuffs = official;
      const officialRestored =
        globalThis.KinkyDungeonTickBuffs === official;
      const exactCases = cases.every(
        (entry) =>
          entry.actualRoute === entry.expectedRoute &&
          entry.exact &&
          entry.fallbackCountExact
      );
      return {
        candidateKind: ${JSON.stringify(candidateKind)},
        cases,
        customCalls,
        replacementObserved,
        officialRestored,
        fastCalls: stats.fastCalls,
        fallbackCalls: stats.fallbackCalls,
        stats,
        passed:
          exactCases &&
          customCalls.official === 1 &&
          customCalls.candidate === 1 &&
          replacementObserved &&
          officialRestored
      };
    })()`,
    120_000
  );
}

async function benchmarkBuffUpdateBatch(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createBuffUpdateBatchCandidate.toString()};
        const initial = restore();
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        KDHybrid.enableSystem("pathfinding");
        KDHybrid.enableSystem("events");
        const officialUpdate =
          globalThis.KinkyDungeonUpdateBuffs;
        const officialTick =
          globalThis.KinkyDungeonTickBuffs;
        if (
          typeof officialUpdate !== "function" ||
          typeof officialTick !== "function"
        ) {
          throw new Error(
            "The official buff update functions are unavailable"
          );
        }
        const stats = {
          calls: 0,
          playerTickCalls: 0,
          fastEnemyTicks: 0,
          emptyEnemyTicks: 0,
          singleEnemyTicks: 0,
          fallbackEnemyTicks: 0,
          dynamicTickCalls: 0
        };
        const candidate = ${
          optimized
            ? "createCandidate(officialTick, stats)"
            : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonUpdateBuffs = candidate;
        }
        let result;
        try {
          result = run(${turnsPerSample});
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonUpdateBuffs === candidate
          ) {
            globalThis.KinkyDungeonUpdateBuffs = officialUpdate;
          }
        }
        return {
          initial,
          run: result,
          stats,
          restored:
            globalThis.KinkyDungeonUpdateBuffs === officialUpdate &&
            globalThis.KinkyDungeonTickBuffs === officialTick
        };
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Buff-update batch fixture restore changed its initial state"
      );
    }
    if (!measured.restored) {
      throw new Error(
        "Buff-update batch did not restore the official functions"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats,
      baselineRestored: pair.baseline.restored,
      optimizedRestored: pair.optimized.restored
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createBuffUpdateBatchCandidate.toString()};
      const initial = restore();
      KDHybrid.enableSystem("ai");
      KDHybrid.enableSystem("movement");
      KDHybrid.enableSystem("pathfinding");
      KDHybrid.enableSystem("events");
      const officialUpdate =
        globalThis.KinkyDungeonUpdateBuffs;
      const officialTick =
        globalThis.KinkyDungeonTickBuffs;
      const stats = {
        calls: 0,
        playerTickCalls: 0,
        fastEnemyTicks: 0,
        emptyEnemyTicks: 0,
        singleEnemyTicks: 0,
        fallbackEnemyTicks: 0,
        dynamicTickCalls: 0
      };
      const candidate = createCandidate(officialTick, stats);
      globalThis.KinkyDungeonUpdateBuffs = candidate;
      let result;
      try {
        result = run(1);
      } finally {
        if (globalThis.KinkyDungeonUpdateBuffs === candidate) {
          globalThis.KinkyDungeonUpdateBuffs = officialUpdate;
        }
      }
      return {
        initialStateSignature: initial.stateSignature,
        stateSignature: result.stateSignature,
        ...stats,
        restored:
          globalThis.KinkyDungeonUpdateBuffs === officialUpdate &&
          globalThis.KinkyDungeonTickBuffs === officialTick
      };
    })()`,
    120_000
  );
  const compatibility = await verifyBuffUpdateBatchCompatibility(
    client
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map(
    (sample) => sample.optimizedMilliseconds
  );
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  const fasterPairs = samples.filter(
    (sample) =>
      sample.optimizedMilliseconds < sample.baselineMilliseconds
  ).length;
  const ratioOfMedians =
    baselineMedianMilliseconds / optimizedMedianMilliseconds;
  return {
    candidateKind: "transaction-scoped-enemy-buff-tick-batch",
    safety:
      "player-official-dynamic-tick-guard-multi-buff-fallback",
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians,
    fasterPairs,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    allFunctionsRestored: samples.every(
      (sample) =>
        sample.baselineRestored && sample.optimizedRestored
    ),
    verification,
    compatibility,
    accepted:
      ratioOfMedians >= 1.05 &&
      fasterPairs >= Math.ceil(sampleCount * 0.75) &&
      samples.every((sample) => sample.stateMatches) &&
      samples.every(
        (sample) =>
          sample.baselineRestored && sample.optimizedRestored
      ) &&
      verification.calls > 0 &&
      verification.fastEnemyTicks > 0 &&
      verification.restored &&
      compatibility.passed,
    samples
  };
}

async function verifyBuffUpdateBatchCompatibility(client) {
  return client.evaluate(
    `(() => {
      const createCandidate =
        ${createBuffUpdateBatchCandidate.toString()};
      const officialUpdate =
        globalThis.KinkyDungeonUpdateBuffs;
      const officialTick =
        globalThis.KinkyDungeonTickBuffs;
      const previousEntities = KDMapData.Entities;
      const previousBullets = KDMapData.Bullets;
      const previousPlayerBuffs = KinkyDungeonPlayerBuffs;
      const previousMemo = KDBuffedStatTypeMemo;
      const previousMemoUpdate = KDBuffedStatTypeMemoUpdate;
      const previousSendEvent = globalThis.KinkyDungeonSendEvent;
      const previousUpdateShield = globalThis.KDUpdatePlayerShield;
      const customType = "KDHybridBuffUpdateBatchProbe";
      const hadCustom = Object.prototype.hasOwnProperty.call(
        KDCustomBuff,
        customType
      );
      const previousCustom = KDCustomBuff[customType];
      const customCalls = { official: 0, candidate: 0 };
      let customPhase = "official";

      const makeBuff = (changes = {}) => ({
        id: "Probe",
        type: "Other",
        power: 1,
        duration: 9999,
        infinite: true,
        ...changes
      });
      const makeEntities = () => [
        { id: 1, x: 1, y: 1, buffs: {} },
        {
          id: 2,
          x: 2,
          y: 1,
          buffs: { Infinite: makeBuff() }
        },
        {
          id: 3,
          x: 3,
          y: 1,
          buffs: {
            Finite: makeBuff({
              duration: 3,
              infinite: false
            })
          }
        },
        {
          id: 4,
          x: 4,
          y: 1,
          buffs: {
            Expired: makeBuff({
              duration: 0,
              infinite: false
            })
          }
        },
        {
          id: 5,
          x: 5,
          y: 1,
          buffs: {
            Reset: makeBuff({
              duration: 0,
              infinite: false,
              resetDurationTime: 4,
              resetDurationPower: 1,
              power: 3
            })
          }
        },
        {
          id: 6,
          x: 6,
          y: 1,
          buffs: {
            Custom: makeBuff({ type: customType })
          }
        },
        {
          id: 7,
          x: 7,
          y: 1,
          buffs: {
            First: makeBuff(),
            Second: makeBuff({ id: "Second" })
          }
        }
      ];
      const prepare = () => {
        KinkyDungeonPlayerBuffs = {};
        KDMapData.Entities = makeEntities();
        KDMapData.Bullets = [];
        KDBuffedStatTypeMemo = new Map();
        KDBuffedStatTypeMemoUpdate = new Map();
      };
      let officialState = null;
      let candidateState = null;
      let stats = null;
      let dynamicOfficialState = null;
      let dynamicCandidateState = null;
      const dynamicCalls = { official: 0, candidate: 0 };
      let dynamicPhase = "official";

      try {
        globalThis.KinkyDungeonSendEvent = () => {};
        globalThis.KDUpdatePlayerShield = () => {};
        KDCustomBuff[customType] = (entity, buff) => {
          customCalls[customPhase] += 1;
          buff.power += 1;
        };

        prepare();
        customPhase = "official";
        officialUpdate(1, false);
        officialState = JSON.stringify(KDMapData.Entities);

        prepare();
        customPhase = "candidate";
        stats = {
          calls: 0,
          playerTickCalls: 0,
          fastEnemyTicks: 0,
          emptyEnemyTicks: 0,
          singleEnemyTicks: 0,
          fallbackEnemyTicks: 0,
          dynamicTickCalls: 0
        };
        const candidate =
          createCandidate(officialTick, stats);
        candidate(1, false);
        candidateState = JSON.stringify(KDMapData.Entities);

        const dynamicTick = function (...args) {
          dynamicCalls[dynamicPhase] += 1;
          return Reflect.apply(officialTick, this, args);
        };
        globalThis.KinkyDungeonTickBuffs = dynamicTick;

        prepare();
        dynamicPhase = "official";
        customPhase = "official";
        officialUpdate(1, false);
        dynamicOfficialState = JSON.stringify(KDMapData.Entities);

        prepare();
        dynamicPhase = "candidate";
        customPhase = "candidate";
        const dynamicStats = {
          calls: 0,
          playerTickCalls: 0,
          fastEnemyTicks: 0,
          emptyEnemyTicks: 0,
          singleEnemyTicks: 0,
          fallbackEnemyTicks: 0,
          dynamicTickCalls: 0
        };
        const dynamicCandidate =
          createCandidate(officialTick, dynamicStats);
        dynamicCandidate(1, false);
        dynamicCandidateState = JSON.stringify(KDMapData.Entities);
        stats.dynamicReplacement = dynamicStats;
      } finally {
        globalThis.KinkyDungeonTickBuffs = officialTick;
        KDMapData.Entities = previousEntities;
        KDMapData.Bullets = previousBullets;
        KinkyDungeonPlayerBuffs = previousPlayerBuffs;
        KDBuffedStatTypeMemo = previousMemo;
        KDBuffedStatTypeMemoUpdate = previousMemoUpdate;
        globalThis.KinkyDungeonSendEvent = previousSendEvent;
        globalThis.KDUpdatePlayerShield = previousUpdateShield;
        if (hadCustom) KDCustomBuff[customType] = previousCustom;
        else delete KDCustomBuff[customType];
      }

      const replacement = function KDModBuffUpdateReplacement() {};
      globalThis.KinkyDungeonUpdateBuffs = replacement;
      const replacementObserved =
        globalThis.KinkyDungeonUpdateBuffs === replacement;
      globalThis.KinkyDungeonUpdateBuffs = officialUpdate;
      const officialRestored =
        globalThis.KinkyDungeonUpdateBuffs === officialUpdate &&
        globalThis.KinkyDungeonTickBuffs === officialTick;
      const ordinaryExact = candidateState === officialState;
      const dynamicExact =
        dynamicCandidateState === dynamicOfficialState;
      const dynamicCallCountsExact =
        dynamicCalls.official === dynamicCalls.candidate;
      return {
        ordinaryExact,
        dynamicExact,
        dynamicCallCountsExact,
        customCalls,
        dynamicCalls,
        stats,
        replacementObserved,
        officialRestored,
        passed:
          ordinaryExact &&
          dynamicExact &&
          dynamicCallCountsExact &&
          customCalls.official === 2 &&
          customCalls.candidate === 2 &&
          stats.fastEnemyTicks === 6 &&
          stats.fallbackEnemyTicks === 1 &&
          stats.dynamicReplacement.dynamicTickCalls === 8 &&
          replacementObserved &&
          officialRestored
      };
    })()`,
    120_000
  );
}

function createBuffUpdateBatchCandidate(officialTick, stats = null) {
  return function KinkyDungeonUpdateBuffsBatchProbe(
    delta,
    endFloor
  ) {
    if (stats !== null) stats.calls += 1;
    if (delta > 0) {
      KDBuffedStatTypeMemo = new Map();
      KDBuffedStatTypeMemoUpdate = new Map();
    }
    KinkyDungeonSendEvent("tickBuffs", { delta });

    let tickFunction = globalThis.KinkyDungeonTickBuffs;
    if (stats !== null) stats.playerTickCalls += 1;
    if (tickFunction !== officialTick && stats !== null)
      stats.dynamicTickCalls += 1;
    Reflect.apply(tickFunction, globalThis, [
      KinkyDungeonPlayerEntity,
      delta,
      endFloor
    ]);

    for (const enemy of KDMapData.Entities) {
      if (!enemy.buffs) enemy.buffs = {};
      tickFunction = globalThis.KinkyDungeonTickBuffs;
      if (tickFunction !== officialTick) {
        if (stats !== null) stats.dynamicTickCalls += 1;
        Reflect.apply(tickFunction, globalThis, [
          enemy,
          delta,
          endFloor
        ]);
        continue;
      }

      const list = enemy.buffs;
      let key = null;
      let multiple = false;
      for (const candidateKey in list) {
        if (!Object.hasOwn(list, candidateKey)) continue;
        if (key !== null) {
          multiple = true;
          break;
        }
        key = candidateKey;
      }
      if (multiple) {
        if (stats !== null) stats.fallbackEnemyTicks += 1;
        Reflect.apply(officialTick, globalThis, [
          enemy,
          delta,
          endFloor
        ]);
        continue;
      }
      if (stats !== null) stats.fastEnemyTicks += 1;
      if (key === null) {
        if (stats !== null) stats.emptyEnemyTicks += 1;
        continue;
      }
      if (stats !== null) stats.singleEnemyTicks += 1;
      const buff = list[key];
      if (buff) {
        let end = false;
        if (buff.endFloor && endFloor) end = true;
        else if (buff.endSleep && KDGameData.SleepTurns > 1)
          end = true;
        else if (!buff.duration || buff.duration < 0) {
          if (buff.resetDurationTime) {
            const amt = buff.resetDurationPower || 1;
            const newPower = buff.power - amt;
            if (
              (amt > 0 && newPower <= 0) ||
              (amt < 0 && newPower >= 0)
            ) {
              end = true;
            } else {
              buff.duration = buff.resetDurationTime;
            }
          } else {
            end = true;
          }
        }
        if (!end) {
          if (buff.type == "restore_mp")
            KDChangeMana(buff.id, "buff", "tick", buff.power);
          else if (buff.type == "restore_wp")
            KDChangeWill(buff.id, "buff", "tick", buff.power);
          else if (buff.type == "restore_sp")
            KDChangeStamina(buff.id, "buff", "tick", buff.power);
          else if (buff.type == "restore_ap")
            KDChangeDistraction(
              buff.id,
              "buff",
              "tick",
              buff.power,
              true
            );
          else if (
            buff.type == "SpellCastConstant" &&
            buff.spell &&
            enemy
          ) {
            KinkyDungeonCastSpell(
              enemy.x,
              enemy.y,
              KinkyDungeonFindSpell(buff.spell, true),
              undefined,
              undefined,
              undefined
            );
          } else if (buff.type == "Flag") {
            KinkyDungeonSetFlag(buff.id, 1 + delta);
          } else if (KDCustomBuff[buff.type]) {
            KDCustomBuff[buff.type](enemy, buff);
          }
          if (!buff.infinite) buff.duration -= delta;
        } else {
          KinkyDungeonExpireBuff(enemy, key);
        }
      }
    }

    for (const b of KDMapData.Bullets) {
      if (b.bullet.spell && b.bullet.spell.buffs) {
        for (const buff of b.bullet.spell.buffs) {
          if (
            buff.player &&
            buff.range >=
              Math.sqrt(
                (KinkyDungeonPlayerEntity.x - b.x) *
                  (KinkyDungeonPlayerEntity.x - b.x) +
                  (KinkyDungeonPlayerEntity.y - b.y) *
                    (KinkyDungeonPlayerEntity.y - b.y)
              )
          ) {
            KinkyDungeonApplyBuffToEntity(
              KinkyDungeonPlayerEntity,
              buff
            );
          }
          if (buff.enemies) {
            const nearby = KDNearbyEnemies(
              b.x,
              b.y,
              buff.range
            );
            for (const enemy of nearby) {
              if (
                (KDHostile(enemy) || !buff.noAlly) &&
                (KDAllied(enemy) || !buff.onlyAlly) &&
                (!b.bullet.spell.filterTags ||
                  b.bullet.spell.filterTags.some(
                    (tag) => enemy.Enemy.tags[tag]
                  ))
              ) {
                KinkyDungeonApplyBuffToEntity(enemy, buff);
              }
            }
          }
        }
      }
    }
    KDUpdatePlayerShield();
  };
}

function createBuffTickKeyLoopCandidate(official, stats = null) {
  return function KinkyDungeonTickBuffsKeyLoopProbe(
    entity,
    delta,
    endFloor
  ) {
    if (stats !== null) stats.calls += 1;
    let list = null;
    if (entity == KinkyDungeonPlayerEntity)
      list = KinkyDungeonPlayerBuffs;
    else if (entity.buffs) list = entity.buffs;
    if (!list) {
      if (stats !== null) stats.fallbackCalls += 1;
      return Reflect.apply(official, this, arguments);
    }
    const keys = Object.keys(list);
    if (keys.length > 1) {
      if (stats !== null) stats.fallbackCalls += 1;
      return Reflect.apply(official, this, arguments);
    }
    if (stats !== null) stats.fastCalls += 1;
    if (keys.length === 0) return;
    const key = keys[0];
    const buff = list[key];
    if (buff) {
      let end = false;
      if (buff.endFloor && endFloor) end = true;
      else if (buff.endSleep && KDGameData.SleepTurns > 1) end = true;
      else if (!buff.duration || buff.duration < 0) {
        if (buff.resetDurationTime) {
          const amt = buff.resetDurationPower || 1;
          const newPower = buff.power - amt;
          if (
            (amt > 0 && newPower <= 0) ||
            (amt < 0 && newPower >= 0)
          ) {
            end = true;
          } else {
            buff.duration = buff.resetDurationTime;
          }
        } else {
          end = true;
        }
      }
      if (!end) {
        if (buff.type == "restore_mp")
          KDChangeMana(buff.id, "buff", "tick", buff.power);
        else if (buff.type == "restore_wp")
          KDChangeWill(buff.id, "buff", "tick", buff.power);
        else if (buff.type == "restore_sp")
          KDChangeStamina(buff.id, "buff", "tick", buff.power);
        else if (buff.type == "restore_ap")
          KDChangeDistraction(
            buff.id,
            "buff",
            "tick",
            buff.power,
            true
          );
        else if (
          buff.type == "SpellCastConstant" &&
          buff.spell &&
          entity
        ) {
          KinkyDungeonCastSpell(
            entity.x,
            entity.y,
            KinkyDungeonFindSpell(buff.spell, true),
            undefined,
            undefined,
            undefined
          );
        } else if (buff.type == "Flag") {
          KinkyDungeonSetFlag(buff.id, 1 + delta);
        } else if (KDCustomBuff[buff.type]) {
          KDCustomBuff[buff.type](entity, buff);
        }
        if (!buff.infinite) buff.duration -= delta;
      } else {
        KinkyDungeonExpireBuff(entity, key);
      }
    }
  };
}

function createBuffTickForInCandidate(official, stats = null) {
  return function KinkyDungeonTickBuffsForInProbe(
    entity,
    delta,
    endFloor
  ) {
    if (stats !== null) stats.calls += 1;
    let list = null;
    if (entity == KinkyDungeonPlayerEntity)
      list = KinkyDungeonPlayerBuffs;
    else if (entity.buffs) list = entity.buffs;
    if (!list) {
      if (stats !== null) stats.fallbackCalls += 1;
      return Reflect.apply(official, this, arguments);
    }
    let key = null;
    for (const candidateKey in list) {
      if (
        !Object.hasOwn(list, candidateKey)
      ) {
        continue;
      }
      if (key !== null) {
        if (stats !== null) stats.fallbackCalls += 1;
        return Reflect.apply(official, this, arguments);
      }
      key = candidateKey;
    }
    if (stats !== null) stats.fastCalls += 1;
    if (key === null) return;
    const buff = list[key];
    if (buff) {
      let end = false;
      if (buff.endFloor && endFloor) end = true;
      else if (buff.endSleep && KDGameData.SleepTurns > 1) end = true;
      else if (!buff.duration || buff.duration < 0) {
        if (buff.resetDurationTime) {
          const amt = buff.resetDurationPower || 1;
          const newPower = buff.power - amt;
          if (
            (amt > 0 && newPower <= 0) ||
            (amt < 0 && newPower >= 0)
          ) {
            end = true;
          } else {
            buff.duration = buff.resetDurationTime;
          }
        } else {
          end = true;
        }
      }
      if (!end) {
        if (buff.type == "restore_mp")
          KDChangeMana(buff.id, "buff", "tick", buff.power);
        else if (buff.type == "restore_wp")
          KDChangeWill(buff.id, "buff", "tick", buff.power);
        else if (buff.type == "restore_sp")
          KDChangeStamina(buff.id, "buff", "tick", buff.power);
        else if (buff.type == "restore_ap")
          KDChangeDistraction(
            buff.id,
            "buff",
            "tick",
            buff.power,
            true
          );
        else if (
          buff.type == "SpellCastConstant" &&
          buff.spell &&
          entity
        ) {
          KinkyDungeonCastSpell(
            entity.x,
            entity.y,
            KinkyDungeonFindSpell(buff.spell, true),
            undefined,
            undefined,
            undefined
          );
        } else if (buff.type == "Flag") {
          KinkyDungeonSetFlag(buff.id, 1 + delta);
        } else if (KDCustomBuff[buff.type]) {
          KDCustomBuff[buff.type](entity, buff);
        }
        if (!buff.infinite) buff.duration -= delta;
      } else {
        KinkyDungeonExpireBuff(entity, key);
      }
    }
  };
}

function createToyBuffTickNoopCandidate(official, stats = null) {
  return function KinkyDungeonTickBuffsToyNoopProbe(
    entity,
    delta,
    endFloor
  ) {
    if (stats !== null) stats.calls += 1;
    const list =
      entity == KinkyDungeonPlayerEntity
        ? KinkyDungeonPlayerBuffs
        : entity?.buffs;
    const keys =
      list && typeof list === "object" ? Object.keys(list) : null;
    const buff =
      keys?.length === 1 && keys[0] === "Toy"
        ? list.Toy
        : null;
    if (
      buff &&
      buff.duration > 0 &&
      buff.infinite === true &&
      (!buff.endFloor || !endFloor) &&
      (!buff.endSleep || KDGameData.SleepTurns <= 1) &&
      buff.type === "Plug" &&
      !KDCustomBuff.Plug
    ) {
      if (stats !== null) stats.fastCalls += 1;
      return;
    }
    if (stats !== null) stats.fallbackCalls += 1;
    return Reflect.apply(official, this, arguments);
  };
}

function createSecretToyNoopReapplyCandidate(
  official,
  stats = null,
  verify = false
) {
  const toy = KDToySecret;
  const expectedToyKeys = [
    "id",
    "type",
    "power",
    "duration",
    "infinite",
    "range",
    "tags"
  ];
  const expectedBuffKeys = [
    "id",
    "type",
    "power",
    "duration",
    "infinite",
    "range",
    "tags",
    "events",
    "buffTextReplace",
    "disableTypes"
  ];
  const toyKeys =
    toy && typeof toy === "object" ? Object.keys(toy) : [];
  const shapeCompatible =
    toyKeys.length === expectedToyKeys.length &&
    expectedToyKeys.every((key, index) => toyKeys[index] === key) &&
    toy.id === "Toy" &&
    toy.type === "Plug" &&
    toy.power === 0.1 &&
    toy.duration === 9999 &&
    toy.infinite === true &&
    toy.range === 0.5 &&
    Array.isArray(toy.tags) &&
    toy.tags.length === 1 &&
    toy.tags[0] === "toy";
  if (stats !== null) stats.shapeCompatible = Boolean(shapeCompatible);

  return function KinkyDungeonApplySecretToyNoopReapplyProbe(
    entity,
    origbuff,
    changes
  ) {
    if (stats !== null) stats.calls += 1;
    if (
      shapeCompatible &&
      entity &&
      !entity.player &&
      origbuff === toy &&
      changes === undefined
    ) {
      const existing = entity.buffs?.Toy;
      const existingKeys =
        existing && typeof existing === "object"
          ? Object.keys(existing)
          : [];
      const existingMatches =
        existingKeys.length === expectedBuffKeys.length &&
        expectedBuffKeys.every(
          (key, index) => existingKeys[index] === key
        ) &&
        existing.id === "Toy" &&
        existing.type === "Plug" &&
        existing.power === 0.1 &&
        existing.duration === 9999 &&
        existing.infinite === true &&
        existing.range === 0.5 &&
        Array.isArray(existing.tags) &&
        existing.tags.length === 1 &&
        existing.tags[0] === "toy" &&
        Array.isArray(existing.events) &&
        existing.events.length === 0 &&
        existing.buffTextReplace !== null &&
        typeof existing.buffTextReplace === "object" &&
        Object.keys(existing.buffTextReplace).length === 0 &&
        Array.isArray(existing.disableTypes) &&
        existing.disableTypes.length === 0;
      if (existingMatches) {
        if (stats !== null) stats.fastCalls += 1;
        if (stats !== null && verify) {
          const resultKeys = existingKeys.join("\0");
          const resultJson = JSON.stringify(existing);
          const expected = Reflect.apply(official, this, arguments);
          const expectedKeys =
            expected && typeof expected === "object"
              ? Object.keys(expected).join("\0")
              : "";
          if (
            resultKeys === expectedKeys &&
            resultJson === JSON.stringify(expected)
          ) {
            stats.exactMatches += 1;
          } else {
            stats.mismatches += 1;
          }
        }
        return existing;
      }
    }

    if (stats !== null) stats.fallbackCalls += 1;
    const result = Reflect.apply(official, this, arguments);
    if (stats !== null && verify) stats.exactMatches += 1;
    return result;
  };
}

function createToyBuffSpecializationCandidate(
  official,
  stats = null,
  verify = false
) {
  const toy = KDToySecret;
  const expectedKeys = [
    "id",
    "type",
    "power",
    "duration",
    "infinite",
    "range",
    "tags"
  ];
  const shapeCompatible =
    toy &&
    Object.keys(toy).length === expectedKeys.length &&
    expectedKeys.every((key, index) => Object.keys(toy)[index] === key) &&
    toy.id === "Toy" &&
    toy.type === "Plug" &&
    toy.power === 0.1 &&
    toy.duration === 9999 &&
    toy.infinite === true &&
    toy.tags?.length === 1 &&
    toy.tags[0] === "toy";
  if (stats !== null) stats.shapeCompatible = Boolean(shapeCompatible);

  return function KinkyDungeonApplyToyBuffSpecializationProbe(
    entity,
    origbuff,
    changes
  ) {
    if (stats !== null) stats.calls += 1;
    if (
      shapeCompatible &&
      entity &&
      !entity.player &&
      origbuff === toy &&
      changes === undefined
    ) {
      if (!entity.buffs) entity.buffs = {};
      const list = entity.buffs;
      const existing = list.Toy;
      const shouldReplace =
        !existing ||
        (existing.power >= 0 && toy.power >= existing.power) ||
        (existing.power < 0 &&
          ((toy.power > 0 && toy.power >= existing.power) ||
            toy.power <= existing.power));
      if (shouldReplace && !existing?.cancelOnReapply) {
        const buff = {
          id: toy.id,
          type: toy.type,
          power: toy.power,
          duration: toy.duration,
          infinite: toy.infinite,
          range: toy.range,
          tags: [...toy.tags],
          events: [],
          buffTextReplace: {},
          disableTypes: []
        };
        list.Toy = buff;
        KDUpdateBuffStatMemo(list, buff.type);
        if (stats !== null) stats.fastCalls += 1;
        return finish(buff, this, arguments);
      }
    }

    if (stats !== null) stats.fallbackCalls += 1;
    return finish(
      Reflect.apply(official, this, arguments),
      this,
      arguments,
      false
    );
  };

  function finish(
    result,
    thisArgument,
    args,
    compareWithOfficial = true
  ) {
    if (stats !== null && verify) {
      if (!compareWithOfficial) {
        stats.exactMatches += 1;
      } else {
        const resultKeys =
          result && typeof result === "object"
            ? Object.keys(result).join("\0")
            : "";
        const resultJson = JSON.stringify(result);
        const expected = Reflect.apply(official, thisArgument, args);
        const expectedKeys =
          expected && typeof expected === "object"
            ? Object.keys(expected).join("\0")
            : "";
        if (
          resultKeys === expectedKeys &&
          resultJson === JSON.stringify(expected)
        ) {
          stats.exactMatches += 1;
        } else {
          stats.mismatches += 1;
        }
      }
    }
    return result;
  }
}

async function benchmarkCheckPathCount(client, sampleCount, turnsPerSample) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createCheckPathCountProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable AI for the path-count probe");
        }
        const official = globalThis.KinkyDungeonCheckPathCount;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonCheckPathCount is unavailable");
        }
        const stats = ${
          optimized
            ? `{
                calls: 0,
                fastCalls: 0,
                fallbackCalls: 0,
                maskBuilds: 0,
                exactMatches: 0,
                mismatches: 0
              }`
            : "null"
        };
        const candidate = ${
          optimized
            ? "createCandidate(official, stats, false)"
            : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonCheckPathCount = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonCheckPathCount === candidate
          ) {
            globalThis.KinkyDungeonCheckPathCount = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Path-count probe fixture restore changed its state");
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createCheckPathCountProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KinkyDungeonCheckPathCount;
      const stats = {
        calls: 0,
        fastCalls: 0,
        fallbackCalls: 0,
        maskBuilds: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KinkyDungeonCheckPathCount = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonCheckPathCount === candidate) {
          globalThis.KinkyDungeonCheckPathCount = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createCheckPathCountProbeCandidate(
  official,
  stats = null,
  verify = false
) {
  const masks = [null, null];
  const finiteNumber = (value) =>
    typeof value === "number" && Number.isFinite(value);
  const transparentAt = (loaded, x, y) =>
    x >= 0 &&
    y >= 0 &&
    x < loaded.width &&
    y < loaded.height &&
    loaded.cells[x + y * loaded.width] === 1;
  const blockedAt = (bars, x, y) =>
    bars && KDVisionBlockers.get(x + "," + y);

  return function KinkyDungeonCheckPathCountDenseProbe(
    x1,
    y1,
    x2,
    y2,
    allowBars,
    blockEnemies,
    maxFails,
    blockOnlyLOSBlock
  ) {
    if (stats !== null) stats.calls += 1;
    const map = KDMapData;
    const width = map?.GridWidth;
    const height = map?.GridHeight;
    const grid = map?.Grid;
    if (
      blockEnemies ||
      typeof grid !== "string" ||
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      !finiteNumber(x1) ||
      !finiteNumber(y1) ||
      !finiteNumber(x2) ||
      !finiteNumber(y2) ||
      (maxFails !== undefined &&
        maxFails !== null &&
        typeof maxFails !== "number")
    ) {
      if (stats !== null) stats.fallbackCalls += 1;
      return Reflect.apply(official, this, arguments);
    }
    if (x1 == x2 && y1 == y2) {
      if (stats !== null) stats.fastCalls += 1;
      return 0;
    }
    const bars = Boolean(allowBars);
    const transparent = bars
      ? KinkyDungeonTransparentObjects
      : KinkyDungeonTransparentMovableObjects;
    if (typeof transparent !== "string") {
      if (stats !== null) stats.fallbackCalls += 1;
      return Reflect.apply(official, this, arguments);
    }
    const maskIndex = bars ? 1 : 0;
    let loaded = masks[maskIndex];
    if (
      loaded === null ||
      loaded.grid !== grid ||
      loaded.width !== width ||
      loaded.height !== height ||
      loaded.transparent !== transparent
    ) {
      const cells = new Uint8Array(width * height);
      const stride = width + 1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          cells[x + y * width] = transparent.includes(
            grid[x + y * stride]
          )
            ? 1
            : 0;
        }
      }
      loaded = { grid, width, height, transparent, cells };
      masks[maskIndex] = loaded;
      if (stats !== null) stats.maskBuilds += 1;
    }
    const length = Math.sqrt(
      (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2)
    );
    const maxFailsAllowed = maxFails ? maxFails : 1;
    let fails = 0;
    for (let step = 0; step <= length; step += 1) {
      const xx = x1 + ((x2 - x1) * step) / length;
      const yy = y1 + ((y2 - y1) * step) / length;
      const roundedX = Math.round(xx);
      const roundedY = Math.round(yy);
      if (
        (roundedX != x1 || roundedY != y1) &&
        (roundedX != x2 || roundedY != y2)
      ) {
        const floorX = Math.floor(xx);
        const floorY = Math.floor(yy);
        const ceilX = Math.ceil(xx);
        const ceilY = Math.ceil(yy);
        let hits = 0;
        if (
          !transparentAt(loaded, floorX, floorY) ||
          ((xx != x1 || yy != y1) && blockedAt(bars, floorX, floorY))
        ) {
          hits += 1;
        }
        if (
          !transparentAt(loaded, roundedX, roundedY) ||
          ((xx != x1 || yy != y1) &&
            blockedAt(bars, roundedX, roundedY))
        ) {
          hits += 1;
        }
        if (
          (hits < 2 && !transparentAt(loaded, ceilX, ceilY)) ||
          ((xx != x1 || yy != y1) && blockedAt(bars, ceilX, ceilY))
        ) {
          hits += 1;
        }
        if (hits >= 2) {
          fails += 1;
          if (fails >= maxFailsAllowed) {
            if (stats !== null) stats.fastCalls += 1;
            if (verify && stats !== null) {
              const expected = Reflect.apply(official, this, arguments);
              if (Object.is(fails, expected)) stats.exactMatches += 1;
              else stats.mismatches += 1;
            }
            return fails;
          }
        }
      }
    }
    if (stats !== null) stats.fastCalls += 1;
    if (verify && stats !== null) {
      const expected = Reflect.apply(official, this, arguments);
      if (Object.is(fails, expected)) stats.exactMatches += 1;
      else stats.mismatches += 1;
    }
    return fails;
  };
}

async function benchmarkCommanderRoleBatch(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createCommanderRoleBatchProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable the AI system for commander probing");
        }
        const official = globalThis.KDCommanderUpdateRoles;
        if (typeof official !== "function") {
          throw new Error("KDCommanderUpdateRoles is unavailable");
        }
        const stats = ${
          optimized
            ? `{
                roleCalls: 0,
                eligibleRoleCalls: 0,
                fallbackRoleCalls: 0,
                factionCalls: 0,
                factionHits: 0,
                factionMisses: 0,
                factionSuspendedCalls: 0,
                hostileCalls: 0,
                hostileHits: 0,
                hostileMisses: 0,
                hostileSuspendedCalls: 0,
                invalidations: 0,
                exactMatches: 0,
                mismatches: 0
              }`
            : "null"
        };
        const candidate = ${
          optimized ? "createCandidate(official, stats)" : "null"
        };
        if (candidate !== null) globalThis.KDCommanderUpdateRoles = candidate;
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KDCommanderUpdateRoles === candidate
          ) {
            globalThis.KDCommanderUpdateRoles = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Commander batch probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature === pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createCommanderRoleBatchProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KDCommanderUpdateRoles;
      const stats = {
        roleCalls: 0,
        eligibleRoleCalls: 0,
        fallbackRoleCalls: 0,
        factionCalls: 0,
        factionHits: 0,
        factionMisses: 0,
        factionSuspendedCalls: 0,
        hostileCalls: 0,
        hostileHits: 0,
        hostileMisses: 0,
        hostileSuspendedCalls: 0,
        invalidations: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KDCommanderUpdateRoles = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KDCommanderUpdateRoles === candidate) {
          globalThis.KDCommanderUpdateRoles = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createCommanderRoleBatchProbeCandidate(
  officialRoleUpdate,
  stats = null,
  verify = false
) {
  const expectedOrderNames = [
    "dummy",
    "assault",
    "defend",
    "guard",
    "flee",
    "helpStruggle",
    "helpDanger",
    "moveToCapture"
  ];
  const orderMethodNames = [
    "filter",
    "weight",
    "apply",
    "maintain",
    "remove",
    "update",
    "global_before",
    "global_after"
  ];
  const expectedOrders = new Map(
    expectedOrderNames.map((name) => [
      name,
      Object.fromEntries(
        orderMethodNames.map((method) => [
          method,
          KDCommanderOrders?.[name]?.[method]
        ])
      )
    ])
  );
  const dependencyNames = [
    "KDGetFaction",
    "KDHostile",
    "KDFactionHostile",
    "KDOpinionRepMod",
    "KDGetModifiedOpinionID",
    "KDIsInParty",
    "KDIsServant",
    "KDFactionRelation",
    "KDPlayer"
  ];
  const expectedDependencies = new Map(
    dependencyNames.map((name) => [name, globalThis[name]])
  );
  const mutatorNames = [
    "KinkyDungeonSetEnemyFlag",
    "KDSetFactionRelation",
    "KDChangeFactionRelation",
    "KDAddToParty",
    "KDRemoveFromParty",
    "KDAddOpinion",
    "KDAddOpinionPersistent",
    "KinkyDungeonSendEvent",
    "KinkyDungeonSendDialogue",
    "KinkyDungeonMakeNoiseSignal"
  ];
  const expectedMutators = new Map(
    mutatorNames
      .filter((name) => typeof globalThis[name] === "function")
      .map((name) => [name, globalThis[name]])
  );
  const officialGetFaction = expectedDependencies.get("KDGetFaction");
  const officialHostile = expectedDependencies.get("KDHostile");
  let activeDepth = 0;

  return function KDCommanderUpdateRolesBatchProbe(...args) {
    if (stats !== null) stats.roleCalls += 1;
    if (
      activeDepth > 0 ||
      !dependenciesMatch() ||
      !ordersMatch() ||
      typeof officialGetFaction !== "function" ||
      typeof officialHostile !== "function"
    ) {
      if (stats !== null) stats.fallbackRoleCalls += 1;
      return Reflect.apply(officialRoleUpdate, this, args);
    }

    if (stats !== null) stats.eligibleRoleCalls += 1;
    activeDepth += 1;
    let suspendedDepth = 0;
    let factionObjectCache = new WeakMap();
    let factionPrimitiveCache = new Map();
    let hostileCache = new WeakMap();
    let cacheDisabled = false;
    const installedMutators = [];

    const clearCaches = () => {
      factionObjectCache = new WeakMap();
      factionPrimitiveCache = new Map();
      hostileCache = new WeakMap();
    };
    const runSuspended = (callback, countInvalidation) => {
      if (countInvalidation && stats !== null) stats.invalidations += 1;
      clearCaches();
      suspendedDepth += 1;
      try {
        return callback();
      } finally {
        suspendedDepth -= 1;
        clearCaches();
        if (!installedDependenciesMatch()) cacheDisabled = true;
      }
    };
    const verifyResult = (actual, official, thisArg, callArgs) => {
      if (!verify || stats === null) return;
      const expected = runSuspended(
        () => Reflect.apply(official, thisArg, callArgs),
        false
      );
      if (actual === expected) {
        stats.exactMatches += 1;
      } else {
        stats.mismatches += 1;
      }
    };
    const cachedGetFaction = function (...callArgs) {
      if (stats !== null) stats.factionCalls += 1;
      if (suspendedDepth > 0 || cacheDisabled) {
        if (stats !== null) stats.factionSuspendedCalls += 1;
        return Reflect.apply(officialGetFaction, this, callArgs);
      }
      const key = callArgs[0];
      const objectKey =
        (typeof key === "object" && key !== null) ||
        typeof key === "function";
      const cache = objectKey ? factionObjectCache : factionPrimitiveCache;
      if (cache.has(key)) {
        if (stats !== null) stats.factionHits += 1;
        const result = cache.get(key);
        verifyResult(result, officialGetFaction, this, callArgs);
        return result;
      }
      if (stats !== null) stats.factionMisses += 1;
      const result = Reflect.apply(officialGetFaction, this, callArgs);
      cache.set(key, result);
      verifyResult(result, officialGetFaction, this, callArgs);
      return result;
    };
    const cachedHostile = function (...callArgs) {
      if (stats !== null) stats.hostileCalls += 1;
      const enemy = callArgs[0];
      if (
        suspendedDepth > 0 ||
        cacheDisabled ||
        ((typeof enemy !== "object" || enemy === null) &&
          typeof enemy !== "function")
      ) {
        if (stats !== null) stats.hostileSuspendedCalls += 1;
        return Reflect.apply(officialHostile, this, callArgs);
      }
      const target = callArgs[1];
      let targetCache = hostileCache.get(enemy);
      if (targetCache?.has(target)) {
        if (stats !== null) stats.hostileHits += 1;
        const result = targetCache.get(target);
        verifyResult(result, officialHostile, this, callArgs);
        return result;
      }
      if (stats !== null) stats.hostileMisses += 1;
      const result = Reflect.apply(officialHostile, this, callArgs);
      if (targetCache === undefined) {
        targetCache = new Map();
        hostileCache.set(enemy, targetCache);
      }
      targetCache.set(target, result);
      verifyResult(result, officialHostile, this, callArgs);
      return result;
    };
    function installedDependenciesMatch() {
      for (const [name, expected] of expectedDependencies) {
        const actual = globalThis[name];
        if (name === "KDGetFaction") {
          if (actual !== cachedGetFaction) return false;
        } else if (name === "KDHostile") {
          if (actual !== cachedHostile) return false;
        } else if (actual !== expected) {
          return false;
        }
      }
      return true;
    }

    globalThis.KDGetFaction = cachedGetFaction;
    globalThis.KDHostile = cachedHostile;
    for (const [name, original] of expectedMutators) {
      const wrapper = function (...callArgs) {
        return runSuspended(
          () => Reflect.apply(original, this, callArgs),
          true
        );
      };
      globalThis[name] = wrapper;
      installedMutators.push({ name, original, wrapper });
    }

    try {
      return Reflect.apply(officialRoleUpdate, this, args);
    } finally {
      for (const { name, original, wrapper } of installedMutators) {
        if (globalThis[name] === wrapper) {
          globalThis[name] = original;
        }
      }
      if (globalThis.KDGetFaction === cachedGetFaction) {
        globalThis.KDGetFaction = officialGetFaction;
      }
      if (globalThis.KDHostile === cachedHostile) {
        globalThis.KDHostile = officialHostile;
      }
      activeDepth -= 1;
    }
  };

  function dependenciesMatch() {
    for (const [name, expected] of expectedDependencies) {
      if (globalThis[name] !== expected) return false;
    }
    return true;
  }

  function ordersMatch() {
    if (
      typeof KDCommanderOrders !== "object" ||
      KDCommanderOrders === null ||
      Object.keys(KDCommanderOrders).length !== expectedOrderNames.length
    ) {
      return false;
    }
    for (const name of expectedOrderNames) {
      const order = KDCommanderOrders[name];
      const expected = expectedOrders.get(name);
      if (typeof order !== "object" || order === null) return false;
      for (const method of orderMethodNames) {
        if (order[method] !== expected[method]) return false;
      }
    }
    return true;
  }
}

async function benchmarkCommanderHelpShortcuts(
  client,
  sampleCount,
  turnsPerSample,
  comparePrefilter = false
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createCommanderHelpShortcutProbeCandidate.toString()};
        const initial = restore();
        const modeReady = ${
          comparePrefilter
            ? `KDHybrid.disableSystem(
                "ai",
                "commander-help-prefilter-baseline"
              )`
            : `KDHybrid.enableSystem("ai")`
        };
        if (!modeReady) {
          throw new Error("Could not select the AI system mode for commander probing");
        }
        const official = globalThis.KDCommanderUpdateRoles;
        if (typeof official !== "function") {
          throw new Error("KDCommanderUpdateRoles is unavailable");
        }
        const stats = ${
          optimized || comparePrefilter
            ? `{
                roleCalls: 0,
                eligibleRoleCalls: 0,
                fallbackRoleCalls: 0,
                scans: 0,
                scannedEntities: 0,
                strugglePotentialScans: 0,
                dangerPotentialScans: 0,
                struggleShortcuts: 0,
                dangerShortcuts: 0,
                struggleFallbacks: 0,
                dangerFallbacks: 0,
                invalidations: 0,
                exactMatches: 0,
                mismatches: 0,
                prefixChecks: 0,
                prefixSkips: 0,
                prefixCacheHits: 0,
                scanBudgetFallbacks: 0
              }`
            : "null"
        };
        const candidate = ${
          comparePrefilter
            ? `createCandidate(
                official,
                stats,
                false,
                ${optimized ? "true" : "false"},
                16
              )`
            : optimized
              ? "createCandidate(official, stats)"
              : "null"
        };
        if (candidate !== null) globalThis.KDCommanderUpdateRoles = candidate;
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KDCommanderUpdateRoles === candidate
          ) {
            globalThis.KDCommanderUpdateRoles = official;
          }
          KDHybrid.enableSystem("ai");
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Commander help probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature === pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      baselineStats: pair.baseline.stats,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createCommanderHelpShortcutProbeCandidate.toString()};
      restore();
      ${
        comparePrefilter
          ? `KDHybrid.disableSystem(
              "ai",
              "commander-help-prefilter-verification"
            )`
          : `KDHybrid.enableSystem("ai")`
      };
      const official = globalThis.KDCommanderUpdateRoles;
      const stats = {
        roleCalls: 0,
        eligibleRoleCalls: 0,
        fallbackRoleCalls: 0,
        scans: 0,
        scannedEntities: 0,
        strugglePotentialScans: 0,
        dangerPotentialScans: 0,
        struggleShortcuts: 0,
        dangerShortcuts: 0,
        struggleFallbacks: 0,
        dangerFallbacks: 0,
        invalidations: 0,
        exactMatches: 0,
        mismatches: 0,
        prefixChecks: 0,
        prefixSkips: 0,
        prefixCacheHits: 0,
        scanBudgetFallbacks: 0
      };
      const candidate = createCandidate(
        official,
        stats,
        true,
        ${comparePrefilter ? "true" : "false"},
        ${comparePrefilter ? "16" : "Number.POSITIVE_INFINITY"}
      );
      globalThis.KDCommanderUpdateRoles = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KDCommanderUpdateRoles === candidate) {
          globalThis.KDCommanderUpdateRoles = official;
        }
        KDHybrid.enableSystem("ai");
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    comparison: comparePrefilter
      ? "current-commander-help-vs-prefix-prefilter"
      : "official-vs-commander-help",
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createCommanderHelpShortcutProbeCandidate(
  officialRoleUpdate,
  stats = null,
  verify = false,
  prefilter = false,
  refreshLimit = Number.POSITIVE_INFINITY
) {
  const expectedOrderNames = [
    "dummy",
    "assault",
    "defend",
    "guard",
    "flee",
    "helpStruggle",
    "helpDanger",
    "moveToCapture"
  ];
  const orderMethodNames = [
    "filter",
    "weight",
    "apply",
    "maintain",
    "remove",
    "update",
    "global_before",
    "global_after"
  ];
  const expectedOrders = new Map(
    expectedOrderNames.map((name) => [
      name,
      Object.fromEntries(
        orderMethodNames.map((method) => [
          method,
          KDCommanderOrders?.[name]?.[method]
        ])
      )
    ])
  );
  const struggleOrder = KDCommanderOrders?.helpStruggle;
  const dangerOrder = KDCommanderOrders?.helpDanger;
  const officialStruggleFilter = struggleOrder?.filter;
  const officialDangerFilter = dangerOrder?.filter;
  const classifierDependencies = new Map(
    [
      "KDBoundEffects",
      "KDIsImprisoned",
      "KDIsTileDangerous",
      "KinkyDungeonIsDisabled",
      "KDNearbyMapTiles",
      "KinkyDungeonEntityAt"
    ].map((name) => [name, globalThis[name]])
  );
  const mutatorNames = [
    "KinkyDungeonSetEnemyFlag",
    "KDSetFactionRelation",
    "KDChangeFactionRelation",
    "KDAddToParty",
    "KDRemoveFromParty",
    "KDAddOpinion",
    "KDAddOpinionPersistent",
    "KinkyDungeonSendEvent",
    "KinkyDungeonSendDialogue",
    "KinkyDungeonMakeNoiseSignal"
  ];
  const expectedMutators = new Map(
    mutatorNames
      .filter((name) => typeof globalThis[name] === "function")
      .map((name) => [name, globalThis[name]])
  );
  let activeDepth = 0;

  return function KDCommanderUpdateRolesHelpShortcutProbe(...args) {
    if (stats !== null) stats.roleCalls += 1;
    if (
      activeDepth > 0 ||
      !ordersMatch() ||
      !classifierDependenciesMatch() ||
      typeof officialStruggleFilter !== "function" ||
      typeof officialDangerFilter !== "function"
    ) {
      if (stats !== null) stats.fallbackRoleCalls += 1;
      return invokeOfficialRoleUpdate(this, args);
    }

    if (stats !== null) stats.eligibleRoleCalls += 1;
    activeDepth += 1;
    let dirty = true;
    let shortcutDisabled = false;
    let refreshScans = 0;
    let hasStrugglePotential = true;
    let hasDangerPotential = true;
    const installedMutators = [];

    const refreshPotentials = () => {
      if (!dirty || shortcutDisabled) return;
      if (refreshScans >= refreshLimit) {
        shortcutDisabled = true;
        if (stats !== null) stats.scanBudgetFallbacks += 1;
        return;
      }
      refreshScans += 1;
      if (stats !== null) stats.scans += 1;
      hasStrugglePotential = false;
      hasDangerPotential = false;
      const entities = Array.isArray(KDMapData?.Entities)
        ? KDMapData.Entities
        : [];
      for (const entity of entities) {
        if (stats !== null) stats.scannedEntities += 1;
        if (!hasStrugglePotential) {
          if (stats !== null) stats.strugglePotentialScans += 1;
          hasStrugglePotential =
            KDBoundEffects(entity) > 1 &&
            !KDIsImprisoned(entity) &&
            !KDIsTileDangerous(entity, entity.x, entity.y, KDMapData);
        }
        if (!hasDangerPotential) {
          if (stats !== null) stats.dangerPotentialScans += 1;
          if (
            KinkyDungeonIsDisabled(entity) &&
            !KDIsImprisoned(entity) &&
            KDIsTileDangerous(entity, entity.x, entity.y, KDMapData)
          ) {
            hasDangerPotential = KDNearbyMapTiles(
              entity.x,
              entity.y,
              1.5
            ).some(
              (tile) =>
                (tile.x !== entity.x || tile.y !== entity.y) &&
                !KinkyDungeonEntityAt(tile.x, tile.y) &&
                KinkyDungeonMovableTilesEnemy.includes(tile.tile) &&
                !KDIsTileDangerous(entity, tile.x, tile.y, KDMapData)
            );
          }
        }
        if (hasStrugglePotential && hasDangerPotential) break;
      }
      dirty = false;
    };
    const verifyFilter = (actual, official, thisArg, callArgs) => {
      if (!verify || stats === null) return;
      const expected = Reflect.apply(official, thisArg, callArgs);
      if (actual === expected) {
        stats.exactMatches += 1;
      } else {
        stats.mismatches += 1;
      }
    };
    const struggleFilter = function (...callArgs) {
      if (
        prefilter &&
        dirty &&
        !shortcutDisabled &&
        !candidateMayReachNearby(callArgs[0])
      ) {
        if (stats !== null) stats.struggleShortcuts += 1;
        const result = false;
        verifyFilter(result, officialStruggleFilter, this, callArgs);
        return result;
      }
      refreshPotentials();
      if (!shortcutDisabled && !hasStrugglePotential) {
        if (stats !== null) stats.struggleShortcuts += 1;
        const result = false;
        verifyFilter(result, officialStruggleFilter, this, callArgs);
        return result;
      }
      if (stats !== null) stats.struggleFallbacks += 1;
      const result = Reflect.apply(officialStruggleFilter, this, callArgs);
      verifyFilter(result, officialStruggleFilter, this, callArgs);
      return result;
    };
    const dangerFilter = function (...callArgs) {
      if (
        prefilter &&
        dirty &&
        !shortcutDisabled &&
        !candidateMayReachNearby(callArgs[0])
      ) {
        if (stats !== null) stats.dangerShortcuts += 1;
        const result = false;
        verifyFilter(result, officialDangerFilter, this, callArgs);
        return result;
      }
      refreshPotentials();
      if (!shortcutDisabled && !hasDangerPotential) {
        if (stats !== null) stats.dangerShortcuts += 1;
        const result = false;
        verifyFilter(result, officialDangerFilter, this, callArgs);
        return result;
      }
      if (stats !== null) stats.dangerFallbacks += 1;
      const result = Reflect.apply(officialDangerFilter, this, callArgs);
      verifyFilter(result, officialDangerFilter, this, callArgs);
      return result;
    };

    const candidateMayReachNearby = (enemy) => {
      if (stats !== null) stats.prefixChecks += 1;
      if (typeof enemy !== "object" || enemy === null) return true;
      try {
        if (!enemy.aware || KDAssaulters >= KDMaxAssaulters) {
          return true;
        }
        let reachesNearby = false;
        if (
          !enemy.IntentAction &&
          KDIsHumanoid(enemy) &&
          enemy.attackPoints < 1 &&
          !enemy.Enemy?.tags?.nohelp &&
          !KDIsImmobile(enemy) &&
          KDBoundEffects(enemy) < 4
        ) {
          reachesNearby = false;
        }
        if (!reachesNearby) {
          if (stats !== null) stats.prefixSkips += 1;
        }
        return reachesNearby;
      } catch {
        return true;
      }
    };

    struggleOrder.filter = struggleFilter;
    dangerOrder.filter = dangerFilter;
    for (const [name, original] of expectedMutators) {
      const wrapper = function (...callArgs) {
        dirty = true;
        try {
          return Reflect.apply(original, this, callArgs);
        } finally {
          dirty = true;
          if (stats !== null) stats.invalidations += 1;
        }
      };
      globalThis[name] = wrapper;
      installedMutators.push({ name, original, wrapper });
    }

    try {
      return invokeOfficialRoleUpdate(this, args);
    } finally {
      for (const { name, original, wrapper } of installedMutators) {
        if (globalThis[name] === wrapper) {
          globalThis[name] = original;
        }
      }
      if (struggleOrder.filter === struggleFilter) {
        struggleOrder.filter = officialStruggleFilter;
      }
      if (dangerOrder.filter === dangerFilter) {
        dangerOrder.filter = officialDangerFilter;
      }
      activeDepth -= 1;
    }

    function invokeOfficialRoleUpdate(thisArg, callArgs) {
      const installed = globalThis.KDCommanderUpdateRoles;
      const officialIsFacade =
        officialRoleUpdate?.__kdHybridFacade === true &&
        installed === KDCommanderUpdateRolesHelpShortcutProbe;
      if (officialIsFacade) {
        globalThis.KDCommanderUpdateRoles = officialRoleUpdate;
      }
      try {
        return Reflect.apply(officialRoleUpdate, thisArg, callArgs);
      } finally {
        if (
          officialIsFacade &&
          globalThis.KDCommanderUpdateRoles === officialRoleUpdate
        ) {
          globalThis.KDCommanderUpdateRoles =
            KDCommanderUpdateRolesHelpShortcutProbe;
        }
      }
    }
  };

  function classifierDependenciesMatch() {
    for (const [name, expected] of classifierDependencies) {
      if (globalThis[name] !== expected) return false;
    }
    return true;
  }

  function ordersMatch() {
    if (
      typeof KDCommanderOrders !== "object" ||
      KDCommanderOrders === null ||
      Object.keys(KDCommanderOrders).length !== expectedOrderNames.length
    ) {
      return false;
    }
    for (const name of expectedOrderNames) {
      const order = KDCommanderOrders[name];
      const expected = expectedOrders.get(name);
      if (typeof order !== "object" || order === null) return false;
      for (const method of orderMethodNames) {
        if (order[method] !== expected[method]) return false;
      }
    }
    return true;
  }
}

async function benchmarkFindMasterFastPath(
  client,
  sampleCount,
  turnsPerSample,
  candidateFactory = createFindMasterProbeCandidate
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${candidateFactory.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable the AI system for master probing");
        }
        const official = globalThis.KinkyDungeonFindMaster;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonFindMaster is unavailable");
        }
        const candidate = ${
          optimized ? "createCandidate(official)" : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonFindMaster = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonFindMaster === candidate
          ) {
            globalThis.KinkyDungeonFindMaster = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Master probe fixture restore changed its initial state");
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${candidateFactory.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KinkyDungeonFindMaster;
      const stats = {
        calls: 0,
        optimizedCalls: 0,
        fallbackCalls: 0,
        factionCacheHits: 0,
        rankCacheHits: 0,
        denseBuilds: 0,
        scannedCells: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats);
      const verifyingCandidate = function (...args) {
        const expected = Reflect.apply(official, this, args);
        const actual = Reflect.apply(candidate, this, args);
        if (
          actual?.master === expected?.master &&
          Object.is(actual?.dist, expected?.dist) &&
          actual?.info === expected?.info
        ) {
          stats.exactMatches += 1;
        } else {
          stats.mismatches += 1;
        }
        return actual;
      };
      globalThis.KinkyDungeonFindMaster = verifyingCandidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonFindMaster === verifyingCandidate) {
          globalThis.KinkyDungeonFindMaster = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createFindMasterProbeCandidate(official, stats = null) {
  const expectedNearbyEnemies = globalThis.KDNearbyEnemies;
  const expectedGetFaction = globalThis.KDGetFaction;
  const expectedEnemyRank = globalThis.KDEnemyRank;
  const expectedEntityHasFlag = globalThis.KDEntityHasFlag;
  const expectedChebyshev = globalThis.KDistChebyshev;

  return function KinkyDungeonFindMasterProbe(enemy) {
    if (stats !== null) stats.calls += 1;
    if (
      enemy.master ||
      enemy.Enemy.master ||
      globalThis.KDNearbyEnemies !== expectedNearbyEnemies ||
      globalThis.KDGetFaction !== expectedGetFaction ||
      globalThis.KDEnemyRank !== expectedEnemyRank ||
      globalThis.KDEntityHasFlag !== expectedEntityHasFlag ||
      globalThis.KDistChebyshev !== expectedChebyshev
    ) {
      if (stats !== null) stats.fallbackCalls += 1;
      return official(enemy);
    }

    if (stats !== null) stats.optimizedCalls += 1;
    let checkDist = 4;
    if (KDEntityHasFlag(enemy, "led")) checkDist = 10;
    let closestmaster = null;
    let closestdist = checkDist + 1;
    const nearby = KDNearbyEnemies(
      enemy.x,
      enemy.y,
      checkDist,
      undefined,
      true,
      enemy
    );
    let factionKnown = false;
    let enemyFaction;
    let rankKnown = false;
    let enemyRank;
    for (const candidate of nearby) {
      if (!factionKnown) {
        enemyFaction = KDGetFaction(enemy);
        factionKnown = true;
      } else if (stats !== null) {
        stats.factionCacheHits += 1;
      }
      if (enemyFaction == KDGetFaction(candidate)) {
        const candidateRank = KDEnemyRank(candidate);
        if (!rankKnown) {
          enemyRank = KDEnemyRank(enemy);
          rankKnown = true;
        } else if (stats !== null) {
          stats.rankCacheHits += 1;
        }
        let rankDiff = candidateRank - enemyRank;
        if (KDEntityHasFlag(candidate, "leader")) rankDiff += 2;
        if (rankDiff >= 2) {
          const distance = KDistChebyshev(
            candidate.x - enemy.x,
            candidate.y - enemy.y
          );
          if (distance < closestdist) {
            closestmaster = candidate;
            closestdist = distance;
          }
        }
      }
    }
    if (closestmaster) {
      return { master: closestmaster, dist: closestdist, info: undefined };
    }
    return { master: undefined, dist: 1000, info: undefined };
  };
}

function createFindMasterFusedProbeCandidate(official, stats = null) {
  let loadedCache = null;
  let loadedWidth = 0;
  let loadedHeight = 0;
  let dense = [];
  const offsets = [];
  for (let dx = -4; dx < 4; dx += 1) {
    for (let dy = -4; dy < 4; dy += 1) {
      offsets.push(dx, dy);
    }
  }

  return function KinkyDungeonFindMasterFusedProbe(enemy) {
    if (stats !== null) stats.calls += 1;
    const map = KDMapData;
    const entities = map?.Entities;
    const width = map?.GridWidth;
    const height = map?.GridHeight;
    if (
      enemy.master ||
      enemy.Enemy.master ||
      KDEntityHasFlag(enemy, "led") ||
      !Number.isSafeInteger(enemy.x) ||
      !Number.isSafeInteger(enemy.y) ||
      !Array.isArray(entities) ||
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      48 > entities.length
    ) {
      if (stats !== null) stats.fallbackCalls += 1;
      return official(enemy);
    }

    const cache = KDGetEnemyCache();
    if (!cache || typeof cache.get !== "function") {
      if (stats !== null) stats.fallbackCalls += 1;
      return official(enemy);
    }
    if (
      cache !== loadedCache ||
      width !== loadedWidth ||
      height !== loadedHeight
    ) {
      const replacement = new Array(width * height);
      for (const entity of entities) {
        if (
          !Number.isSafeInteger(entity.x) ||
          !Number.isSafeInteger(entity.y) ||
          entity.x < 0 ||
          entity.y < 0 ||
          entity.x >= width ||
          entity.y >= height
        ) {
          if (stats !== null) stats.fallbackCalls += 1;
          return official(enemy);
        }
        const cached = cache.get(entity.x + "," + entity.y);
        if (cached !== undefined) {
          replacement[entity.x + entity.y * width] = cached;
        }
      }
      loadedCache = cache;
      loadedWidth = width;
      loadedHeight = height;
      dense = replacement;
      if (stats !== null) stats.denseBuilds += 1;
    }

    if (stats !== null) stats.optimizedCalls += 1;
    const enemyRank = KDEnemyRank(enemy);
    let enemyFaction;
    let factionKnown = false;
    let closestMaster = null;
    let closestDistance = 5;
    for (let index = 0; index < offsets.length; index += 2) {
      const x = enemy.x + offsets[index];
      const y = enemy.y + offsets[index + 1];
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if (stats !== null) stats.scannedCells += 1;
      const candidate = dense[x + y * width];
      if (candidate === undefined) continue;
      let rankDiff = KDEnemyRank(candidate) - enemyRank;
      if (KDEntityHasFlag(candidate, "leader")) rankDiff += 2;
      if (rankDiff >= 2) {
        if (KDHostile(candidate, enemy)) continue;
        if (!factionKnown) {
          enemyFaction = KDGetFaction(enemy);
          factionKnown = true;
        }
        if (enemyFaction != KDGetFaction(candidate)) continue;
        const distance = Math.max(
          Math.abs(candidate.x - enemy.x),
          Math.abs(candidate.y - enemy.y)
        );
        if (distance < closestDistance) {
          closestMaster = candidate;
          closestDistance = distance;
        }
      }
    }
    if (closestMaster) {
      return {
        master: closestMaster,
        dist: closestDistance,
        info: undefined
      };
    }
    return { master: undefined, dist: 1000, info: undefined };
  };
}

async function benchmarkSourceHelplessFastNegative(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  let sourcePatchVersion = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const firstInitial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable AI for the source helpless probe");
        }
        const patchVersion =
          globalThis.KDHybridSourcePatches?.helplessFastNegative;
        if (typeof patchVersion !== "string") {
          throw new Error("The source helpless patch marker is unavailable");
        }
        const hadControl = Object.prototype.hasOwnProperty.call(
          globalThis,
          "KDHybridSourcePatchControl"
        );
        const previousControl = globalThis.KDHybridSourcePatchControl;
        if (
          previousControl !== undefined &&
          (previousControl === null || typeof previousControl !== "object")
        ) {
          throw new Error("KDHybridSourcePatchControl is not an object");
        }
        const control = previousControl || {};
        const hadDisable = Object.prototype.hasOwnProperty.call(
          control,
          "disableHelplessFastNegative"
        );
        const previousDisable = control.disableHelplessFastNegative;
        const hadStats = Object.prototype.hasOwnProperty.call(
          control,
          "helplessFastNegativeStats"
        );
        const previousStats = control.helplessFastNegativeStats;
        const stats = ${diagnostic}
          ? {
              calls: 0,
              fastReturns: 0,
              officialCalls: 0,
              compatibilityFallbacks: 0
            }
          : null;

        globalThis.KDHybridSourcePatchControl = control;
        control.disableHelplessFastNegative = ${!optimized};
        delete control.helplessFastNegativeStats;
        try {
          run(3);
          const initial = restore();
          if (initial.stateSignature !== firstInitial.stateSignature) {
            throw new Error("Source helpless warm-up changed fixture restore");
          }
          if (stats !== null) {
            control.helplessFastNegativeStats = stats;
          }
          return {
            initial,
            patchVersion,
            optimized: ${optimized},
            stats,
            run: run(${turnsPerSample})
          };
        } finally {
          if (hadDisable) {
            control.disableHelplessFastNegative = previousDisable;
          } else {
            delete control.disableHelplessFastNegative;
          }
          if (hadStats) {
            control.helplessFastNegativeStats = previousStats;
          } else {
            delete control.helplessFastNegativeStats;
          }
          if (hadControl) {
            globalThis.KDHybridSourcePatchControl = previousControl;
          } else {
            delete globalThis.KDHybridSourcePatchControl;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Source helpless fixture restore changed its initial state"
      );
    }
    sourcePatchVersion ??= measured.patchVersion;
    if (measured.patchVersion !== sourcePatchVersion) {
      throw new Error("Source helpless patch marker changed during the probe");
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const compatibility = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      restore();
      const officialHelpless = globalThis.KDHelpless;
      const originalUnpack = globalThis.KDUnPackEnemy;
      const originalPack = globalThis.KDPackEnemy;
      const originalThreshold = globalThis.KDNPCStruggleThreshMult;
      const previousControl = globalThis.KDHybridSourcePatchControl;
      const control =
        previousControl && typeof previousControl === "object"
          ? previousControl
          : {};
      const hadDisable = Object.prototype.hasOwnProperty.call(
        control,
        "disableHelplessFastNegative"
      );
      const previousDisable = control.disableHelplessFastNegative;
      const hadStats = Object.prototype.hasOwnProperty.call(
        control,
        "helplessFastNegativeStats"
      );
      const previousStats = control.helplessFastNegativeStats;
      const source = KDMapData.Entities[0];
      if (!source) throw new Error("Source helpless probe needs an enemy");
      const makeEnemy = (overrides = {}) => ({
        ...source,
        Enemy: source.Enemy,
        flags: { ...(source.flags || {}) },
        buffs: { ...(source.buffs || {}) },
        ...overrides
      });
      const stats = {
        calls: 0,
        fastReturns: 0,
        officialCalls: 0,
        compatibilityFallbacks: 0
      };
      const runCall = (disabled, enemy) => {
        globalThis.KDHybridSourcePatchControl = control;
        control.disableHelplessFastNegative = disabled;
        control.helplessFastNegativeStats = stats;
        return officialHelpless(enemy);
      };
      const cases = [];
      const dependencyFallbacks = [];
      let escapeHatch;
      let publicReplacementTookControl = false;
      try {
        const makeHealthy = () =>
          makeEnemy({
            hp: source.Enemy.maxhp,
            boundLevel: 0
          });
        const makeLowHealth = () =>
          makeEnemy({ hp: 0.5, boundLevel: 0 });
        const makeBound = () =>
          makeEnemy({
            hp: source.Enemy.maxhp,
            boundLevel: source.Enemy.maxhp * 2
          });
        const makePacked = () =>
          makeEnemy({
            Enemy: { name: source.Enemy.name },
            hp: source.Enemy.maxhp,
            boundLevel: 0
          });
        const makePlayer = () =>
          makeEnemy({
            player: true,
            hp: source.Enemy.maxhp,
            boundLevel: 0
          });
        for (const [name, makeCase] of [
          ["healthy-unbound", makeHealthy],
          ["low-health", makeLowHealth],
          ["actively-bound", makeBound],
          ["packed-healthy", makePacked],
          ["player-entity", makePlayer]
        ]) {
          const baselineEnemy = makeCase();
          const optimizedEnemy = makeCase();
          const baselineWasPacked = !baselineEnemy.Enemy?.maxhp;
          const optimizedWasPacked = !optimizedEnemy.Enemy?.maxhp;
          const baseline = runCall(true, baselineEnemy);
          const optimized = runCall(false, optimizedEnemy);
          cases.push({
            name,
            baseline,
            optimized,
            matches: baseline === optimized,
            baselineWasPacked,
            optimizedWasPacked,
            baselinePackedAfter: !baselineEnemy.Enemy?.maxhp,
            optimizedPackedAfter: !optimizedEnemy.Enemy?.maxhp
          });
        }

        const beforeEscapeFallbacks = stats.compatibilityFallbacks;
        const beforeEscapeFastReturns = stats.fastReturns;
        escapeHatch = {
          result: runCall(true, makeHealthy()),
          compatibilityFallbacks:
            stats.compatibilityFallbacks - beforeEscapeFallbacks,
          fastReturns: stats.fastReturns - beforeEscapeFastReturns
        };

        const probeDependency = (
          name,
          property,
          original,
          makeCase
        ) => {
          const baseline = runCall(true, makeCase());
          let replacementCalls = 0;
          const replacement = function (...args) {
            replacementCalls += 1;
            return Reflect.apply(original, this, args);
          };
          const beforeFallbacks = stats.compatibilityFallbacks;
          globalThis[property] = replacement;
          control.disableHelplessFastNegative = false;
          const enemy = makeCase();
          let result;
          try {
            result = officialHelpless(enemy);
          } finally {
            if (globalThis[property] === replacement) {
              globalThis[property] = original;
            }
          }
          dependencyFallbacks.push({
            name,
            baseline,
            result,
            matches: baseline === result,
            replacementCalls,
            compatibilityFallbacks:
              stats.compatibilityFallbacks - beforeFallbacks,
            packedAfter: !enemy.Enemy?.maxhp
          });
        };
        probeDependency(
          "KDUnPackEnemy",
          "KDUnPackEnemy",
          originalUnpack,
          makeHealthy
        );
        probeDependency(
          "KDPackEnemy",
          "KDPackEnemy",
          originalPack,
          makePacked
        );
        probeDependency(
          "KDNPCStruggleThreshMult",
          "KDNPCStruggleThreshMult",
          originalThreshold,
          makeBound
        );

        const publicReplacement = function () {
          publicReplacementTookControl = true;
          return "replacement";
        };
        globalThis.KDHelpless = publicReplacement;
        publicReplacementTookControl =
          globalThis.KDHelpless() === "replacement" &&
          publicReplacementTookControl;
      } finally {
        if (globalThis.KDHelpless !== officialHelpless) {
          globalThis.KDHelpless = officialHelpless;
        }
        if (globalThis.KDUnPackEnemy !== originalUnpack) {
          globalThis.KDUnPackEnemy = originalUnpack;
        }
        if (globalThis.KDPackEnemy !== originalPack) {
          globalThis.KDPackEnemy = originalPack;
        }
        if (
          globalThis.KDNPCStruggleThreshMult !== originalThreshold
        ) {
          globalThis.KDNPCStruggleThreshMult = originalThreshold;
        }
        if (hadDisable) {
          control.disableHelplessFastNegative = previousDisable;
        } else {
          delete control.disableHelplessFastNegative;
        }
        if (hadStats) {
          control.helplessFastNegativeStats = previousStats;
        } else {
          delete control.helplessFastNegativeStats;
        }
        if (
          previousControl !== undefined &&
          previousControl !== null &&
          typeof previousControl === "object"
        ) {
          globalThis.KDHybridSourcePatchControl = previousControl;
        } else {
          delete globalThis.KDHybridSourcePatchControl;
        }
        restore();
      }
      return {
        cases,
        dependencyFallbacks,
        escapeHatch,
        publicReplacementTookControl,
        stats,
        passed:
          cases.every(
            (entry) =>
              entry.matches &&
              entry.baselineWasPacked === entry.optimizedWasPacked &&
              entry.baselinePackedAfter === entry.optimizedPackedAfter
          ) &&
          dependencyFallbacks.length === 3 &&
          dependencyFallbacks.every(
            (entry) =>
              entry.matches &&
              entry.replacementCalls > 0 &&
              entry.compatibilityFallbacks === 1
          ) &&
          escapeHatch?.result === false &&
          escapeHatch?.compatibilityFallbacks === 1 &&
          escapeHatch?.fastReturns === 0 &&
          publicReplacementTookControl
      };
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    sourcePatchVersion,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baseline: baselineVerification.stats,
      optimized: optimizedVerification.stats
    },
    compatibility,
    samples
  };
}

async function benchmarkEnemyDebugTimerFastPath(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;

  const runMode = async (
    optimized,
    diagnostic = false,
    debugEnabled = false
  ) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const firstInitial = restore();
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        if (typeof KinkyDungeonUpdateEnemies !== "function") {
          throw new Error("The enemy-update function is unavailable");
        }
        const hadControl = Object.prototype.hasOwnProperty.call(
          globalThis,
          "KDHybridSourcePatchControl"
        );
        const previousControl = globalThis.KDHybridSourcePatchControl;
        if (
          previousControl !== undefined &&
          (previousControl === null || typeof previousControl !== "object")
        ) {
          throw new Error("KDHybridSourcePatchControl is not an object");
        }
        const control = previousControl || {};
        const hadDisable = Object.prototype.hasOwnProperty.call(
          control,
          "disableEnemyDebugTimerFastPath"
        );
        const previousDisable = control.disableEnemyDebugTimerFastPath;
        const previousDebug = KDDebug;
        const previousLog = console.log;
        const ownNowDescriptor = Object.getOwnPropertyDescriptor(
          performance,
          "now"
        );
        const originalNow = performance.now;
        let nowCalls = 0;

        globalThis.KDHybridSourcePatchControl = control;
        control.disableEnemyDebugTimerFastPath = ${!optimized};
        if (${debugEnabled}) {
          KDDebug = true;
          console.log = function KDHybridSuppressedDebugLog() {};
        }
        if (${diagnostic}) {
          Object.defineProperty(performance, "now", {
            configurable: true,
            value: function KDHybridCountedPerformanceNow(...args) {
              nowCalls += 1;
              return Reflect.apply(originalNow, performance, args);
            }
          });
        }
        try {
          run(3);
          const initial = restore();
          if (initial.stateSignature !== firstInitial.stateSignature) {
            throw new Error(
              "Enemy debug-timer warm-up changed fixture restore"
            );
          }
          nowCalls = 0;
          return {
            initial,
            optimized: ${optimized},
            debugEnabled: ${debugEnabled},
            run: run(${turnsPerSample}),
            nowCalls
          };
        } finally {
          if (${diagnostic}) {
            if (ownNowDescriptor) {
              Object.defineProperty(performance, "now", ownNowDescriptor);
            } else {
              delete performance.now;
            }
          }
          console.log = previousLog;
          KDDebug = previousDebug;
          if (hadDisable) {
            control.disableEnemyDebugTimerFastPath = previousDisable;
          } else {
            delete control.disableEnemyDebugTimerFastPath;
          }
          if (hadControl) {
            globalThis.KDHybridSourcePatchControl = previousControl;
          } else {
            delete globalThis.KDHybridSourcePatchControl;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Enemy debug-timer fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const baselineDebug = await runMode(false, false, true);
  const optimizedDebug = await runMode(true, false, true);
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);

  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baselineNowCalls: baselineVerification.nowCalls,
      optimizedNowCalls: optimizedVerification.nowCalls,
      skippedNowCalls:
        baselineVerification.nowCalls - optimizedVerification.nowCalls
    },
    debugCompatibility: {
      stateMatches:
        baselineDebug.run.stateSignature ===
        optimizedDebug.run.stateSignature,
      baselineStateSignature: baselineDebug.run.stateSignature,
      optimizedStateSignature: optimizedDebug.run.stateSignature
    },
    samples
  };
}

async function benchmarkSourceEnemyDeltaFastPath(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  let sourcePatchVersion = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const firstInitial = restore();
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        const patchVersion =
          globalThis.KDHybridSourcePatches?.enemyDeltaFastPath;
        if (typeof patchVersion !== "string") {
          throw new Error("The source enemy-delta patch marker is unavailable");
        }
        const hadControl = Object.prototype.hasOwnProperty.call(
          globalThis,
          "KDHybridSourcePatchControl"
        );
        const previousControl = globalThis.KDHybridSourcePatchControl;
        if (
          previousControl !== undefined &&
          (previousControl === null || typeof previousControl !== "object")
        ) {
          throw new Error("KDHybridSourcePatchControl is not an object");
        }
        const control = previousControl || {};
        const hadDisable = Object.prototype.hasOwnProperty.call(
          control,
          "disableEnemyDeltaFastPath"
        );
        const previousDisable = control.disableEnemyDeltaFastPath;
        const hadStats = Object.prototype.hasOwnProperty.call(
          control,
          "enemyDeltaFastPathStats"
        );
        const previousStats = control.enemyDeltaFastPathStats;
        const stats = ${diagnostic}
          ? {
              calls: 0,
              fastCalls: 0,
              officialCalls: 0,
              skippedTimeImmuneChecks: 0,
              skippedDeltaWrites: 0
            }
          : null;

        globalThis.KDHybridSourcePatchControl = control;
        control.disableEnemyDeltaFastPath = ${!optimized};
        delete control.enemyDeltaFastPathStats;
        try {
          run(3);
          const initial = restore();
          if (initial.stateSignature !== firstInitial.stateSignature) {
            throw new Error(
              "Source enemy-delta warm-up changed fixture restore"
            );
          }
          if (stats !== null) {
            control.enemyDeltaFastPathStats = stats;
          }
          return {
            initial,
            patchVersion,
            optimized: ${optimized},
            stats,
            movementStatus: KDHybrid.status("movement"),
            run: run(${turnsPerSample})
          };
        } finally {
          if (hadDisable) {
            control.disableEnemyDeltaFastPath = previousDisable;
          } else {
            delete control.disableEnemyDeltaFastPath;
          }
          if (hadStats) {
            control.enemyDeltaFastPathStats = previousStats;
          } else {
            delete control.enemyDeltaFastPathStats;
          }
          if (hadControl) {
            globalThis.KDHybridSourcePatchControl = previousControl;
          } else {
            delete globalThis.KDHybridSourcePatchControl;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Source enemy-delta fixture restore changed its initial state"
      );
    }
    sourcePatchVersion ??= measured.patchVersion;
    if (measured.patchVersion !== sourcePatchVersion) {
      throw new Error(
        "Source enemy-delta patch marker changed during the probe"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const compatibility = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const officialUpdate = globalThis.KinkyDungeonUpdateEnemies;
      const originalTimeImmune = globalThis.KDIsTimeImmune;
      const previousControl = globalThis.KDHybridSourcePatchControl;
      const control =
        previousControl && typeof previousControl === "object"
          ? previousControl
          : {};
      const hadDisable = Object.prototype.hasOwnProperty.call(
        control,
        "disableEnemyDeltaFastPath"
      );
      const previousDisable = control.disableEnemyDeltaFastPath;
      const hadStats = Object.prototype.hasOwnProperty.call(
        control,
        "enemyDeltaFastPathStats"
      );
      const previousStats = control.enemyDeltaFastPathStats;
      const freshStats = () => ({
        calls: 0,
        fastCalls: 0,
        officialCalls: 0,
        skippedTimeImmuneChecks: 0,
        skippedDeltaWrites: 0
      });
      const runCase = (name, disabled, configure = null) => {
        globalThis.KinkyDungeonUpdateEnemies = officialUpdate;
        globalThis.KDIsTimeImmune = originalTimeImmune;
        const initial = restore();
        if (configure !== null) configure();
        const stats = freshStats();
        globalThis.KDHybridSourcePatchControl = control;
        control.disableEnemyDeltaFastPath = disabled;
        control.enemyDeltaFastPathStats = stats;
        const result = run(1);
        return {
          name,
          initialStateSignature: initial.stateSignature,
          stateSignature: result.stateSignature,
          stats
        };
      };
      const pairs = [];
      let dependencyReplacementCalls = 0;
      let publicReplacementTookControl = false;
      try {
        const normalBaseline = runCase("normal-baseline", true);
        const normalOptimized = runCase("normal-optimized", false);
        pairs.push({
          name: "normal",
          baseline: normalBaseline,
          optimized: normalOptimized,
          matches:
            normalBaseline.stateSignature ===
            normalOptimized.stateSignature
        });

        const configureTimeSlow = () => {
          KinkyDungeonFlags.set("TimeSlowTick", 3);
          KinkyDungeonFlags.set("TimeSlow", 3);
        };
        const timeSlowBaseline = runCase(
          "time-slow-baseline",
          true,
          configureTimeSlow
        );
        const timeSlowOptimized = runCase(
          "time-slow-optimized",
          false,
          configureTimeSlow
        );
        pairs.push({
          name: "time-slow",
          baseline: timeSlowBaseline,
          optimized: timeSlowOptimized,
          matches:
            timeSlowBaseline.stateSignature ===
            timeSlowOptimized.stateSignature
        });

        const configureReplacement = () => {
          globalThis.KDIsTimeImmune = function (...args) {
            dependencyReplacementCalls += 1;
            return Reflect.apply(originalTimeImmune, this, args);
          };
        };
        const replacementBaseline = runCase(
          "dependency-baseline",
          true,
          configureReplacement
        );
        const baselineReplacementCalls = dependencyReplacementCalls;
        dependencyReplacementCalls = 0;
        const replacementOptimized = runCase(
          "dependency-optimized",
          false,
          configureReplacement
        );
        const optimizedReplacementCalls = dependencyReplacementCalls;
        pairs.push({
          name: "dependency-replacement",
          baseline: replacementBaseline,
          optimized: replacementOptimized,
          baselineReplacementCalls,
          optimizedReplacementCalls,
          matches:
            replacementBaseline.stateSignature ===
            replacementOptimized.stateSignature
        });

        const publicReplacement = function () {
          publicReplacementTookControl = true;
          return "replacement";
        };
        globalThis.KinkyDungeonUpdateEnemies = publicReplacement;
        publicReplacementTookControl =
          globalThis.KinkyDungeonUpdateEnemies() === "replacement" &&
          publicReplacementTookControl;
      } finally {
        globalThis.KinkyDungeonUpdateEnemies = officialUpdate;
        globalThis.KDIsTimeImmune = originalTimeImmune;
        if (hadDisable) {
          control.disableEnemyDeltaFastPath = previousDisable;
        } else {
          delete control.disableEnemyDeltaFastPath;
        }
        if (hadStats) {
          control.enemyDeltaFastPathStats = previousStats;
        } else {
          delete control.enemyDeltaFastPathStats;
        }
        if (
          previousControl !== undefined &&
          previousControl !== null &&
          typeof previousControl === "object"
        ) {
          globalThis.KDHybridSourcePatchControl = previousControl;
        } else {
          delete globalThis.KDHybridSourcePatchControl;
        }
        restore();
      }
      const normal = pairs.find((entry) => entry.name === "normal");
      const timeSlow = pairs.find((entry) => entry.name === "time-slow");
      const dependency = pairs.find(
        (entry) => entry.name === "dependency-replacement"
      );
      return {
        pairs,
        publicReplacementTookControl,
        passed:
          pairs.every((entry) => entry.matches) &&
          normal?.optimized.stats.fastCalls > 0 &&
          normal?.optimized.stats.skippedTimeImmuneChecks > 0 &&
          normal?.optimized.stats.skippedDeltaWrites > 0 &&
          timeSlow?.optimized.stats.officialCalls > 0 &&
          dependency?.optimized.stats.fastCalls === 0 &&
          dependency?.optimized.stats.officialCalls > 0 &&
          dependency?.baselineReplacementCalls > 0 &&
          dependency?.optimizedReplacementCalls > 0 &&
          publicReplacementTookControl
      };
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    sourcePatchVersion,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baseline: baselineVerification.stats,
      optimized: optimizedVerification.stats,
      movementStatus: optimizedVerification.movementStatus
    },
    compatibility,
    samples
  };
}

async function benchmarkGlobalHelplessFastNegative(
  client,
  sampleCount,
  turnsPerSample,
  candidateFactory = createGlobalHelplessFastNegativeCandidate
) {
  const samples = [];
  let referenceInitialState = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${candidateFactory.toString()};
        const firstInitial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable AI for the helpless probe");
        }
        const official = globalThis.KDHelpless;
        if (
          typeof official !== "function" ||
          typeof KDHybridNearestPlayerDependencies !== "object"
        ) {
          throw new Error("Helpless/source-nearest dependencies are unavailable");
        }
        const stats = ${diagnostic}
          ? {
              calls: 0,
              fastReturns: 0,
              officialCalls: 0,
              compatibilityFallbacks: 0
            }
          : null;
        const candidate = ${optimized}
          ? createCandidate(official, stats, true)
          : null;
        const previousNearestDependency =
          KDHybridNearestPlayerDependencies.helpless;
        if (candidate !== null) {
          globalThis.KDHelpless = candidate;
          KDHybridNearestPlayerDependencies.helpless = candidate;
        }
        try {
          run(3);
          const initial = restore();
          if (initial.stateSignature !== firstInitial.stateSignature) {
            throw new Error("Helpless fast-negative warm-up changed fixture restore");
          }
          if (stats !== null) {
            stats.calls = 0;
            stats.fastReturns = 0;
            stats.officialCalls = 0;
            stats.compatibilityFallbacks = 0;
          }
          return {
            initial,
            stats,
            run: run(${turnsPerSample})
          };
        } finally {
          KDHybridNearestPlayerDependencies.helpless =
            previousNearestDependency;
          if (
            candidate !== null &&
            globalThis.KDHelpless === candidate
          ) {
            globalThis.KDHelpless = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Helpless fast-negative fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const compatibility = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const createCandidate =
        ${candidateFactory.toString()};
      restore();
      const official = globalThis.KDHelpless;
      const stats = {
        calls: 0,
        fastReturns: 0,
        officialCalls: 0,
        compatibilityFallbacks: 0
      };
      const candidate = createCandidate(official, stats, true);
      const source = KDMapData.Entities[0];
      if (!source) throw new Error("Helpless probe needs an enemy");
      const makeEnemy = (overrides = {}) => ({
        ...source,
        Enemy: source.Enemy,
        flags: { ...(source.flags || {}) },
        buffs: { ...(source.buffs || {}) },
        ...overrides
      });
      const compare = (name, enemy) => {
        const baseline = official(enemy);
        const optimized = candidate(enemy);
        return { name, baseline, optimized, matches: baseline === optimized };
      };
      const cases = [
        compare(
          "healthy-unbound",
          makeEnemy({ hp: source.Enemy.maxhp, boundLevel: 0 })
        ),
        compare("low-health", makeEnemy({ hp: 0.5, boundLevel: 0 })),
        compare(
          "actively-bound",
          makeEnemy({
            hp: source.Enemy.maxhp,
            boundLevel: source.Enemy.maxhp * 2
          })
        )
      ];

      const originalUnpack = globalThis.KDUnPackEnemy;
      let replacementCalls = 0;
      const replacementUnpack = function (...args) {
        replacementCalls += 1;
        return Reflect.apply(originalUnpack, this, args);
      };
      const beforeFallbacks = stats.compatibilityFallbacks;
      let dependencyFallback;
      globalThis.KDUnPackEnemy = replacementUnpack;
      try {
        dependencyFallback = {
          result: candidate(
            makeEnemy({ hp: source.Enemy.maxhp, boundLevel: 0 })
          ),
          replacementCalls,
          compatibilityFallbacks:
            stats.compatibilityFallbacks - beforeFallbacks
        };
      } finally {
        if (globalThis.KDUnPackEnemy === replacementUnpack) {
          globalThis.KDUnPackEnemy = originalUnpack;
        }
      }

      let publicReplacementTookControl = false;
      const publicReplacement = function () {
        publicReplacementTookControl = true;
        return "replacement";
      };
      globalThis.KDHelpless = candidate;
      try {
        globalThis.KDHelpless = publicReplacement;
        publicReplacementTookControl =
          globalThis.KDHelpless() === "replacement" &&
          publicReplacementTookControl;
      } finally {
        if (
          globalThis.KDHelpless === candidate ||
          globalThis.KDHelpless === publicReplacement
        ) {
          globalThis.KDHelpless = official;
        }
        restore();
      }
      return {
        cases,
        dependencyFallback,
        publicReplacementTookControl,
        stats,
        passed:
          cases.every((entry) => entry.matches) &&
          dependencyFallback?.result === false &&
          dependencyFallback?.replacementCalls > 0 &&
          dependencyFallback?.compatibilityFallbacks === 1 &&
          publicReplacementTookControl
      };
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baseline: baselineVerification.stats,
      optimized: optimizedVerification.stats
    },
    compatibility,
    samples
  };
}

function createGlobalHelplessFastNegativeCandidate(
  official,
  stats = null,
  guardDependencies = true
) {
  const dependencies = {
    unpack: globalThis.KDUnPackEnemy,
    pack: globalThis.KDPackEnemy,
    struggleThreshold: globalThis.KDNPCStruggleThreshMult
  };
  if (stats === null) {
    return function KDHelplessFastNegative(enemy) {
      const compatible =
        !guardDependencies ||
        (globalThis.KDUnPackEnemy === dependencies.unpack &&
          globalThis.KDPackEnemy === dependencies.pack &&
          globalThis.KDNPCStruggleThreshMult ===
            dependencies.struggleThreshold);
      if (
        compatible &&
        enemy &&
        !enemy.player &&
        enemy.hp > 0.52 &&
        !(enemy.boundLevel > 0)
      ) {
        return false;
      }
      return Reflect.apply(official, this, arguments);
    };
  }
  return function KDHelplessFastNegativeDiagnostic(enemy) {
    stats.calls += 1;
    const compatible =
      !guardDependencies ||
      (globalThis.KDUnPackEnemy === dependencies.unpack &&
        globalThis.KDPackEnemy === dependencies.pack &&
        globalThis.KDNPCStruggleThreshMult ===
          dependencies.struggleThreshold);
    if (
      compatible &&
      enemy &&
      !enemy.player &&
      enemy.hp > 0.52 &&
      !(enemy.boundLevel > 0)
    ) {
      stats.fastReturns += 1;
      return false;
    }
    if (!compatible) stats.compatibilityFallbacks += 1;
    stats.officialCalls += 1;
    return Reflect.apply(official, this, arguments);
  };
}

function createHelplessDropPackGuardCandidate(
  official,
  stats = null,
  guardDependencies = true
) {
  const dependencies = {
    unpack: globalThis.KDUnPackEnemy,
    struggleThreshold: globalThis.KDNPCStruggleThreshMult
  };
  return function KDHelplessDropPackGuardProbe(enemy) {
    if (stats !== null) stats.calls += 1;
    const sourceControl = globalThis.KDHybridSourcePatchControl;
    const compatible =
      !guardDependencies ||
      (globalThis.KDUnPackEnemy === dependencies.unpack &&
        globalThis.KDNPCStruggleThreshMult ===
          dependencies.struggleThreshold);
    if (
      !sourceControl?.disableHelplessFastNegative &&
      compatible &&
      enemy &&
      !enemy.player &&
      enemy.Enemy?.maxhp &&
      enemy.hp > 0.52 &&
      !(enemy.boundLevel > 0)
    ) {
      if (stats !== null) stats.fastReturns += 1;
      return false;
    }
    if (stats !== null) {
      if (!compatible) stats.compatibilityFallbacks += 1;
      stats.officialCalls += 1;
    }
    return Reflect.apply(official, this, arguments);
  };
}

async function benchmarkEnemyLoopAIDataLiteral(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createEnemyLoopAIDataLiteralCandidate.toString()};
        const firstInitial = restore();
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        const official = globalThis.KinkyDungeonEnemyLoop;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonEnemyLoop is unavailable");
        }
        const candidate = createCandidate(official, ${optimized});
        globalThis.KinkyDungeonEnemyLoop = candidate;
        try {
          run(3);
          const initial = restore();
          if (initial.stateSignature !== firstInitial.stateSignature) {
            throw new Error("Enemy-loop literal warm-up changed fixture restore");
          }
          const result = run(${turnsPerSample});
          return {
            initial,
            run: result,
            aiDataKeys: Object.keys(AIData),
            aiDataTypes: Object.fromEntries(
              Object.entries(AIData).map(([key, value]) => [key, typeof value])
            )
          };
        } finally {
          if (globalThis.KinkyDungeonEnemyLoop === candidate) {
            globalThis.KinkyDungeonEnemyLoop = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Enemy-loop literal fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      aiDataMatches:
        JSON.stringify(pair.baseline.aiDataKeys) ===
          JSON.stringify(pair.optimized.aiDataKeys) &&
        JSON.stringify(pair.baseline.aiDataTypes) ===
          JSON.stringify(pair.optimized.aiDataTypes),
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    allAIDataMatches: samples.every((sample) => sample.aiDataMatches),
    samples
  };
}

function createEnemyLoopAIDataLiteralCandidate(official, optimized) {
  const source = Function.prototype.toString.call(official);
  const assignmentBlock = `AIData = {};
    if (!enemy.Enemy.maxhp) {
        enemy.Enemy = KinkyDungeonGetEnemyByName(enemy.Enemy.name);
    }
    AIData.playerItems = playerItems;
    AIData.player = player;
    AIData.defeat = false;
    AIData.idle = true;
    AIData.moved = false;
    AIData.ignore = false;
    AIData.visionMod = visionMod;
    AIData.followRange = enemy.Enemy.followRange == 1 ? 1.5 : enemy.Enemy.followRange;
    AIData.visionRadius = enemy.Enemy.visionRadius ? (KDEnemyVisionRadius(enemy) + ((enemy.lifetime > 0 && enemy.Enemy.visionSummoned) ? enemy.Enemy.visionSummoned : 0)) : 0;`;
  const literalBlock = `if (!enemy.Enemy.maxhp) {
        AIData = {};
        enemy.Enemy = KinkyDungeonGetEnemyByName(enemy.Enemy.name);
    }
    AIData = {
        playerItems: playerItems,
        player: player,
        defeat: false,
        idle: true,
        moved: false,
        ignore: false,
        visionMod: visionMod,
        followRange: enemy.Enemy.followRange == 1 ? 1.5 : enemy.Enemy.followRange,
        visionRadius: enemy.Enemy.visionRadius ? (KDEnemyVisionRadius(enemy) + ((enemy.lifetime > 0 && enemy.Enemy.visionSummoned) ? enemy.Enemy.visionSummoned : 0)) : 0
    };`;
  const occurrences = source.split(assignmentBlock).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `Expected one enemy-loop AIData assignment block, found ${occurrences}`
    );
  }
  const candidateSource = optimized
    ? source.replace(assignmentBlock, literalBlock)
    : source;
  const candidate = (0, eval)(`(${candidateSource})`);
  if (typeof candidate !== "function") {
    throw new TypeError("Enemy-loop AIData candidate did not compile");
  }
  return candidate;
}

async function benchmarkNearestCandidateFactionReuse(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createNearestCandidateFactionReuseCandidate.toString()};
        const firstInitial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable AI for the faction-reuse probe");
        }
        const official = globalThis.KinkyDungeonNearestPlayer;
        if (
          typeof official !== "function" ||
          typeof globalThis.KDHybridSourcePatches?.nearestPlayer !== "string"
        ) {
          throw new Error("The source nearest-player patch is unavailable");
        }
        if (official.__kdHybridFacade === true) {
          throw new Error("The runtime nearest-player facade is installed");
        }
        const reuseStats = ${diagnostic}
          ? { hostilityChecks: 0, candidateFactionsReused: 0 }
          : null;
        const candidate = ${optimized}
          ? createCandidate(official, reuseStats)
          : null;
        if (candidate !== null) {
          globalThis.KinkyDungeonNearestPlayer = candidate;
        }

        const hadControl = Object.prototype.hasOwnProperty.call(
          globalThis,
          "KDHybridSourcePatchControl"
        );
        const previousControl = globalThis.KDHybridSourcePatchControl;
        if (
          previousControl !== undefined &&
          (previousControl === null || typeof previousControl !== "object")
        ) {
          throw new Error("KDHybridSourcePatchControl is not an object");
        }
        const control = previousControl || {};
        const hadDisable = Object.prototype.hasOwnProperty.call(
          control,
          "disableNearestPlayer"
        );
        const previousDisable = control.disableNearestPlayer;
        const hadStats = Object.prototype.hasOwnProperty.call(
          control,
          "nearestPlayerStats"
        );
        const previousStats = control.nearestPlayerStats;
        const sourceStats = ${diagnostic}
          ? {
              calls: 0,
              optimizedCalls: 0,
              fallbackCalls: 0,
              candidates: 0,
              canonicalCandidates: 0,
              guardedCandidates: 0
            }
          : null;

        globalThis.KDHybridSourcePatchControl = control;
        control.disableNearestPlayer = false;
        delete control.nearestPlayerStats;
        try {
          run(3);
          const initial = restore();
          if (initial.stateSignature !== firstInitial.stateSignature) {
            throw new Error("Faction-reuse warm-up changed fixture restore");
          }
          if (reuseStats !== null) {
            reuseStats.hostilityChecks = 0;
            reuseStats.candidateFactionsReused = 0;
          }
          if (sourceStats !== null) {
            control.nearestPlayerStats = sourceStats;
          }
          return {
            initial,
            optimized: ${optimized},
            reuseStats,
            sourceStats,
            run: run(${turnsPerSample})
          };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonNearestPlayer === candidate
          ) {
            globalThis.KinkyDungeonNearestPlayer = official;
          }
          if (hadDisable) control.disableNearestPlayer = previousDisable;
          else delete control.disableNearestPlayer;
          if (hadStats) control.nearestPlayerStats = previousStats;
          else delete control.nearestPlayerStats;
          if (hadControl) {
            globalThis.KDHybridSourcePatchControl = previousControl;
          } else {
            delete globalThis.KDHybridSourcePatchControl;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Nearest faction-reuse fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const compatibility = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createNearestCandidateFactionReuseCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const officialNearest = globalThis.KinkyDungeonNearestPlayer;
      const candidate = createCandidate(officialNearest, null);
      const officialFaction = globalThis.KDGetFaction;
      let replacementCalls = 0;
      const replacementFaction = function (...args) {
        replacementCalls += 1;
        return Reflect.apply(officialFaction, this, args);
      };
      const previousControl = globalThis.KDHybridSourcePatchControl;
      const control =
        previousControl && typeof previousControl === "object"
          ? previousControl
          : {};
      const hadDisable = Object.prototype.hasOwnProperty.call(
        control,
        "disableNearestPlayer"
      );
      const previousDisable = control.disableNearestPlayer;
      const hadStats = Object.prototype.hasOwnProperty.call(
        control,
        "nearestPlayerStats"
      );
      const previousStats = control.nearestPlayerStats;
      const runSelected = (selected) => {
        restore();
        const stats = {
          calls: 0,
          optimizedCalls: 0,
          fallbackCalls: 0,
          candidates: 0,
          canonicalCandidates: 0,
          guardedCandidates: 0
        };
        globalThis.KinkyDungeonNearestPlayer = selected;
        globalThis.KDGetFaction = replacementFaction;
        globalThis.KDHybridSourcePatchControl = control;
        control.disableNearestPlayer = false;
        control.nearestPlayerStats = stats;
        let result;
        try {
          result = { run: run(1), stats: { ...stats } };
        } finally {
          delete control.nearestPlayerStats;
          if (globalThis.KDGetFaction === replacementFaction) {
            globalThis.KDGetFaction = officialFaction;
          }
          if (globalThis.KinkyDungeonNearestPlayer === selected) {
            globalThis.KinkyDungeonNearestPlayer = officialNearest;
          }
        }
        return result;
      };
      let baseline;
      let optimized;
      let replacementTookControl = false;
      const externalReplacement = function () {
        replacementTookControl = true;
        return KinkyDungeonPlayerEntity;
      };
      try {
        baseline = runSelected(officialNearest);
        optimized = runSelected(candidate);
        globalThis.KinkyDungeonNearestPlayer = candidate;
        globalThis.KinkyDungeonNearestPlayer = externalReplacement;
        replacementTookControl =
          globalThis.KinkyDungeonNearestPlayer(null) ===
            KinkyDungeonPlayerEntity &&
          replacementTookControl;
      } finally {
        if (
          globalThis.KinkyDungeonNearestPlayer === candidate ||
          globalThis.KinkyDungeonNearestPlayer === externalReplacement
        ) {
          globalThis.KinkyDungeonNearestPlayer = officialNearest;
        }
        if (globalThis.KDGetFaction === replacementFaction) {
          globalThis.KDGetFaction = officialFaction;
        }
        if (hadDisable) control.disableNearestPlayer = previousDisable;
        else delete control.disableNearestPlayer;
        if (hadStats) control.nearestPlayerStats = previousStats;
        else delete control.nearestPlayerStats;
        if (
          previousControl !== undefined &&
          previousControl !== null &&
          typeof previousControl === "object"
        ) {
          globalThis.KDHybridSourcePatchControl = previousControl;
        } else {
          delete globalThis.KDHybridSourcePatchControl;
        }
        restore();
      }
      return {
        baselineStateSignature: baseline.run.stateSignature,
        optimizedStateSignature: optimized.run.stateSignature,
        baselineStats: baseline.stats,
        optimizedStats: optimized.stats,
        replacementCalls,
        replacementTookControl,
        passed:
          baseline.run.stateSignature === optimized.run.stateSignature &&
          baseline.stats.fallbackCalls > 0 &&
          optimized.stats.fallbackCalls > 0 &&
          baseline.stats.optimizedCalls === 0 &&
          optimized.stats.optimizedCalls === 0 &&
          replacementCalls > 0 &&
          replacementTookControl
      };
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baselineSourceStats: baselineVerification.sourceStats,
      optimizedSourceStats: optimizedVerification.sourceStats,
      optimizedReuseStats: optimizedVerification.reuseStats
    },
    compatibility,
    samples
  };
}

function createNearestCandidateFactionReuseCandidate(
  official,
  stats = null
) {
  const KDHybridProbeCanonicalTargetHostile = (
    subject,
    candidate,
    subjectFaction,
    candidateFaction
  ) => {
    if (stats !== null) {
      stats.hostilityChecks += 1;
      stats.candidateFactionsReused += 1;
    }
    if (subject.rage > 0) return true;
    if (candidate.ceasefire > 0) return false;
    if (candidateFaction == "Player" && subject.hostile > 0) return true;
    if (subjectFaction == "Player" && candidate.hostile > 0) return true;
    if (candidate.rage > 0) return true;
    if (subjectFaction == "Player" && candidate.allied > 0) return false;
    if (
      subjectFaction == "Rage" ||
      candidateFaction == "Rage" ||
      (subjectFaction == "Player" && candidateFaction == "Enemy") ||
      (candidateFaction == "Player" && subjectFaction == "Enemy")
    ) {
      return true;
    }
    return KDFactionRelation(subjectFaction, candidateFaction) <= -0.5;
  };
  let source = Function.prototype.toString.call(official);
  const declarationNeedle = "let commonFiltersComplete = false;";
  if (!source.includes(declarationNeedle)) {
    throw new Error(
      "Nearest faction-reuse candidate could not find its declaration anchor"
    );
  }
  source = source.replace(
    declarationNeedle,
    `${declarationNeedle}\n                let canonicalCandidateFaction;`
  );

  const hostilityPattern =
    /if\s*\(definition\.noAttack\s*\|\|\s*!KDHybridCanonicalTargetHostile\(enemy,\s*e,\s*enemyFaction\)\)\s*continue;/u;
  if (!hostilityPattern.test(source)) {
    throw new Error(
      "Nearest faction-reuse candidate could not find its hostility anchor"
    );
  }
  source = source.replace(
    hostilityPattern,
    `if (definition.noAttack)
                        continue;
                    canonicalCandidateFaction = KDGetFaction(e);
                    if (!KDHybridProbeCanonicalTargetHostile(
                        enemy,
                        e,
                        enemyFaction,
                        canonicalCandidateFaction
                    ))
                        continue;`
  );

  const naturalPattern =
    /if\s*\(KDGetFaction\(e\)\s*==\s*"Natural"\)/gu;
  const naturalMatches = source.match(naturalPattern)?.length ?? 0;
  if (naturalMatches !== 2) {
    throw new Error(
      `Nearest faction-reuse candidate expected two natural-faction anchors, got ${naturalMatches}`
    );
  }
  source = source.replace(
    naturalPattern,
    'if ((canonicalDefinition ? canonicalCandidateFaction : KDGetFaction(e)) == "Natural")'
  );
  return eval(`(${source})`);
}

async function benchmarkSourceNearestPlayerFastPath(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  let sourcePatchVersion = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable AI for the source targeting probe");
        }
        const patchVersion =
          globalThis.KDHybridSourcePatches?.nearestPlayer;
        if (typeof patchVersion !== "string") {
          throw new Error("The source nearest-player patch marker is unavailable");
        }
        if (globalThis.KinkyDungeonNearestPlayer?.__kdHybridFacade === true) {
          throw new Error(
            "The runtime nearest-player facade is still installed over the source patch"
          );
        }

        const hadControl = Object.prototype.hasOwnProperty.call(
          globalThis,
          "KDHybridSourcePatchControl"
        );
        const previousControl = globalThis.KDHybridSourcePatchControl;
        if (
          previousControl !== undefined &&
          (previousControl === null || typeof previousControl !== "object")
        ) {
          throw new Error("KDHybridSourcePatchControl is not an object");
        }
        const control = previousControl || {};
        const hadDisable = Object.prototype.hasOwnProperty.call(
          control,
          "disableNearestPlayer"
        );
        const previousDisable = control.disableNearestPlayer;
        const hadStats = Object.prototype.hasOwnProperty.call(
          control,
          "nearestPlayerStats"
        );
        const previousStats = control.nearestPlayerStats;
        const stats = ${diagnostic}
          ? {
              calls: 0,
              optimizedCalls: 0,
              fallbackCalls: 0,
              candidates: 0,
              canonicalCandidates: 0,
              guardedCandidates: 0
            }
          : null;

        globalThis.KDHybridSourcePatchControl = control;
        control.disableNearestPlayer = ${!optimized};
        if (stats !== null) control.nearestPlayerStats = stats;
        else delete control.nearestPlayerStats;
        try {
          return {
            initial,
            patchVersion,
            optimized: ${optimized},
            stats,
            run: run(${turnsPerSample})
          };
        } finally {
          if (hadDisable) control.disableNearestPlayer = previousDisable;
          else delete control.disableNearestPlayer;
          if (hadStats) control.nearestPlayerStats = previousStats;
          else delete control.nearestPlayerStats;
          if (hadControl) {
            globalThis.KDHybridSourcePatchControl = previousControl;
          } else {
            delete globalThis.KDHybridSourcePatchControl;
          }
        }
      })()`,
      120_000
    );

    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Source targeting probe fixture restore changed its initial state"
      );
    }
    sourcePatchVersion ??= measured.patchVersion;
    if (measured.patchVersion !== sourcePatchVersion) {
      throw new Error("Source targeting patch marker changed during the probe");
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    sourcePatchVersion,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baseline: baselineVerification.stats,
      optimized: optimizedVerification.stats
    },
    samples
  };
}

async function verifySourceBuffEventNegativeIndexCompatibility(client) {
  return client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const officialApply = globalThis.KinkyDungeonApplyBuffToEntity;
      const officialHandler = globalThis.KinkyDungeonHandleBuffEvent;
      const previousControl = globalThis.KDHybridSourcePatchControl;
      if (
        previousControl !== undefined &&
        (previousControl === null || typeof previousControl !== "object")
      ) {
        throw new Error("KDHybridSourcePatchControl is not an object");
      }
      const control = previousControl || {};
      const hadControl = Object.prototype.hasOwnProperty.call(
        globalThis,
        "KDHybridSourcePatchControl"
      );
      const hadDisable = Object.prototype.hasOwnProperty.call(
        control,
        "disableBuffEventIndex"
      );
      const previousDisable = control.disableBuffEventIndex;
      const hadStats = Object.prototype.hasOwnProperty.call(
        control,
        "buffEventIndexStats"
      );
      const previousStats = control.buffEventIndexStats;
      const stats = {
        calls: 0,
        indexedTriggers: 0,
        rebuilds: 0,
        warmupScans: 0,
        negativeSkips: 0,
        fallbackScans: 0,
        dependencyFallbacks: 0,
        invalidations: 0,
        eventfulApplies: 0
      };
      const makeEventBuff = (id) => ({
        id,
        type: "KDHybridProbe",
        power: 0,
        duration: 10,
        events: [{
          trigger: "beforeDamageEnemy",
          type: "__KDHybridMissingProbeHandler"
        }]
      });
      const installHandlerRecorder = () => {
        const calls = [];
        const wrapper = function (event, definition, buff, entity, data) {
          calls.push({
            event,
            buff: buff?.id,
            entity: entity?.player ? "player" : entity?.id
          });
          return Reflect.apply(officialHandler, this, arguments);
        };
        globalThis.KinkyDungeonHandleBuffEvent = wrapper;
        return {
          calls,
          restore() {
            if (globalThis.KinkyDungeonHandleBuffEvent === wrapper) {
              globalThis.KinkyDungeonHandleBuffEvent = officialHandler;
            }
          }
        };
      };
      const primeNegativeIndex = () => {
        globalThis.KDHybridInvalidateBuffEventIndex();
        KinkyDungeonSendBuffEvent("beforeDamageEnemy", {});
        KinkyDungeonSendBuffEvent("beforeDamageEnemy", {});
      };

      globalThis.KDHybridSourcePatchControl = control;
      control.disableBuffEventIndex = false;
      control.buffEventIndexStats = stats;
      let standardApply;
      let explicitInvalidation;
      let tickRefresh;
      let dependencyFallback;
      let disabledFallback;
      try {
        restore();
        primeNegativeIndex();
        const enemy = KDMapData.Entities[0];
        KinkyDungeonApplyBuffToEntity(
          enemy,
          makeEventBuff("__KDHybridEnemyEvent")
        );
        KinkyDungeonApplyBuffToEntity(
          KinkyDungeonPlayerEntity,
          makeEventBuff("__KDHybridPlayerEvent")
        );
        const standardRecorder = installHandlerRecorder();
        const beforeStandard = { ...stats };
        try {
          KinkyDungeonSendBuffEvent("beforeDamageEnemy", {});
        } finally {
          standardRecorder.restore();
        }
        standardApply = {
          calls: standardRecorder.calls,
          fallbackDelta:
            stats.fallbackScans - beforeStandard.fallbackScans,
          eventfulApplyDelta:
            stats.eventfulApplies - beforeStandard.eventfulApplies
        };

        restore();
        primeNegativeIndex();
        const directEnemy = KDMapData.Entities[0];
        directEnemy.buffs.__KDHybridDirectEvent =
          makeEventBuff("__KDHybridDirectEvent");
        globalThis.KDHybridInvalidateBuffEventIndex();
        const directRecorder = installHandlerRecorder();
        const beforeDirect = { ...stats };
        try {
          KinkyDungeonSendBuffEvent("beforeDamageEnemy", {});
        } finally {
          directRecorder.restore();
        }
        explicitInvalidation = {
          calls: directRecorder.calls,
          fallbackDelta: stats.fallbackScans - beforeDirect.fallbackScans
        };

        restore();
        primeNegativeIndex();
        const tickEnemy = KDMapData.Entities[0];
        tickEnemy.buffs.__KDHybridTickEvent =
          makeEventBuff("__KDHybridTickEvent");
        const savedTick = KinkyDungeonCurrentTick;
        KinkyDungeonCurrentTick = savedTick + 1;
        const tickRecorder = installHandlerRecorder();
        const beforeTick = { ...stats };
        try {
          KinkyDungeonSendBuffEvent("beforeDamageEnemy", {});
        } finally {
          tickRecorder.restore();
          KinkyDungeonCurrentTick = savedTick;
        }
        tickRefresh = {
          calls: tickRecorder.calls,
          fallbackDelta: stats.fallbackScans - beforeTick.fallbackScans
        };

        restore();
        primeNegativeIndex();
        const replacementApply = function (...args) {
          return Reflect.apply(officialApply, this, args);
        };
        globalThis.KinkyDungeonApplyBuffToEntity = replacementApply;
        const beforeDependency = { ...stats };
        try {
          KinkyDungeonSendBuffEvent("beforeDamageEnemy", {});
        } finally {
          if (
            globalThis.KinkyDungeonApplyBuffToEntity === replacementApply
          ) {
            globalThis.KinkyDungeonApplyBuffToEntity = officialApply;
          }
        }
        dependencyFallback = {
          fallbackDelta:
            stats.fallbackScans - beforeDependency.fallbackScans,
          dependencyDelta:
            stats.dependencyFallbacks -
            beforeDependency.dependencyFallbacks
        };

        restore();
        primeNegativeIndex();
        control.disableBuffEventIndex = true;
        const beforeDisabled = { ...stats };
        KinkyDungeonSendBuffEvent("beforeDamageEnemy", {});
        disabledFallback = {
          fallbackDelta:
            stats.fallbackScans - beforeDisabled.fallbackScans,
          dependencyDelta:
            stats.dependencyFallbacks -
            beforeDisabled.dependencyFallbacks
        };
        control.disableBuffEventIndex = false;
      } finally {
        globalThis.KinkyDungeonHandleBuffEvent = officialHandler;
        globalThis.KinkyDungeonApplyBuffToEntity = officialApply;
        globalThis.KDHybridInvalidateBuffEventIndex();
        if (hadDisable) {
          control.disableBuffEventIndex = previousDisable;
        } else {
          delete control.disableBuffEventIndex;
        }
        if (hadStats) control.buffEventIndexStats = previousStats;
        else delete control.buffEventIndexStats;
        if (hadControl) {
          globalThis.KDHybridSourcePatchControl = previousControl;
        } else {
          delete globalThis.KDHybridSourcePatchControl;
        }
      }
      const standardOrder = standardApply.calls.map(
        (call) => call.entity
      );
      return {
        stats,
        standardApply,
        explicitInvalidation,
        tickRefresh,
        dependencyFallback,
        disabledFallback,
        passed:
          standardApply.fallbackDelta === 1 &&
          standardOrder.length === 2 &&
          standardOrder[0] === "player" &&
          standardOrder[1] !== "player" &&
          explicitInvalidation.fallbackDelta === 1 &&
          explicitInvalidation.calls.length === 1 &&
          tickRefresh.fallbackDelta === 1 &&
          tickRefresh.calls.length === 1 &&
          dependencyFallback.fallbackDelta === 1 &&
          dependencyFallback.dependencyDelta === 1 &&
          disabledFallback.fallbackDelta === 1 &&
          disabledFallback.dependencyDelta === 1
      };
    })()`,
    120_000
  );
}

async function benchmarkSourceBuffEventNegativeIndex(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  let sourcePatchVersion = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const initial = restore();
        const patchVersion =
          globalThis.KDHybridSourcePatches?.buffEventNegativeIndex;
        if (typeof patchVersion !== "string") {
          throw new Error(
            "The source buff-event index patch marker is unavailable"
          );
        }
        if (
          typeof globalThis.KDHybridInvalidateBuffEventIndex !== "function"
        ) {
          throw new Error("The source buff-event invalidator is unavailable");
        }

        const hadControl = Object.prototype.hasOwnProperty.call(
          globalThis,
          "KDHybridSourcePatchControl"
        );
        const previousControl = globalThis.KDHybridSourcePatchControl;
        if (
          previousControl !== undefined &&
          (previousControl === null || typeof previousControl !== "object")
        ) {
          throw new Error("KDHybridSourcePatchControl is not an object");
        }
        const control = previousControl || {};
        const hadDisable = Object.prototype.hasOwnProperty.call(
          control,
          "disableBuffEventIndex"
        );
        const previousDisable = control.disableBuffEventIndex;
        const hadStats = Object.prototype.hasOwnProperty.call(
          control,
          "buffEventIndexStats"
        );
        const previousStats = control.buffEventIndexStats;
        const stats = ${diagnostic}
          ? {
              calls: 0,
              indexedTriggers: 0,
              rebuilds: 0,
              warmupScans: 0,
              negativeSkips: 0,
              fallbackScans: 0,
              dependencyFallbacks: 0,
              invalidations: 0,
              eventfulApplies: 0
            }
          : null;

        globalThis.KDHybridSourcePatchControl = control;
        control.disableBuffEventIndex = ${!optimized};
        if (stats !== null) control.buffEventIndexStats = stats;
        else delete control.buffEventIndexStats;
        globalThis.KDHybridInvalidateBuffEventIndex();
        try {
          return {
            initial,
            patchVersion,
            optimized: ${optimized},
            stats,
            run: run(${turnsPerSample})
          };
        } finally {
          globalThis.KDHybridInvalidateBuffEventIndex();
          if (hadDisable) {
            control.disableBuffEventIndex = previousDisable;
          } else {
            delete control.disableBuffEventIndex;
          }
          if (hadStats) control.buffEventIndexStats = previousStats;
          else delete control.buffEventIndexStats;
          if (hadControl) {
            globalThis.KDHybridSourcePatchControl = previousControl;
          } else {
            delete globalThis.KDHybridSourcePatchControl;
          }
        }
      })()`,
      120_000
    );

    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Source buff-event probe fixture restore changed its initial state"
      );
    }
    sourcePatchVersion ??= measured.patchVersion;
    if (measured.patchVersion !== sourcePatchVersion) {
      throw new Error("Source buff-event patch marker changed during the probe");
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const compatibility =
    await verifySourceBuffEventNegativeIndexCompatibility(client);
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    sourcePatchVersion,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baseline: baselineVerification.stats,
      optimized: optimizedVerification.stats
    },
    compatibility,
    samples
  };
}

async function benchmarkBuffEventPositiveOwnerIndex(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createBuffEventPositiveOwnerIndexCandidate.toString()};
        const initial = restore();
        const target = KDMapData.Entities.find(
          (entity) => entity?.Enemy && entity.hp > 0
        );
        if (!target) {
          throw new Error("Positive buff-event target is unavailable");
        }
        KinkyDungeonApplyBuffToEntity(target, KDVolcanism);
        globalThis.KDHybridInvalidateBuffEventIndex?.();

        const official = globalThis.KinkyDungeonSendBuffEvent;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonSendBuffEvent is unavailable");
        }
        const stats = ${diagnostic}
          ? {
              calls: 0,
              rebuilds: 0,
              indexedTriggers: 0,
              indexedOwners: 0,
              negativeSkips: 0,
              directDispatches: 0,
              ownersScanned: 0,
              handlerCalls: 0
            }
          : null;
        const candidate = ${optimized}
          ? createCandidate(official, stats)
          : null;
        if (candidate !== null) {
          globalThis.KinkyDungeonSendBuffEvent = candidate;
        }
        try {
          return {
            initial,
            targetId: target.id,
            stats,
            run: run(${turnsPerSample})
          };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonSendBuffEvent === candidate
          ) {
            globalThis.KinkyDungeonSendBuffEvent = official;
          }
          globalThis.KDHybridInvalidateBuffEventIndex?.();
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Positive buff-event probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    fixtureBuff: "KDVolcanism",
    fixtureTargetId: optimizedVerification.targetId,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baseline: baselineVerification.stats,
      optimized: optimizedVerification.stats
    },
    samples
  };
}

function createBuffEventPositiveOwnerIndexCandidate(
  official,
  stats = null
) {
  let indexedTick = Number.NaN;
  let indexedPlayerBuffs = null;
  let indexedEntities = null;
  let indexedEntityCount = -1;
  let ownersByTrigger = null;

  const addOwner = (trigger, owner) => {
    let owners = ownersByTrigger.get(trigger);
    if (owners === undefined) {
      owners = [];
      ownersByTrigger.set(trigger, owners);
    }
    owners.push(owner);
    if (stats !== null) stats.indexedOwners += 1;
  };
  const indexList = (list, owner) => {
    if (!list) return;
    const triggers = new Set();
    for (const buff of Object.values(list)) {
      if (buff?.events) {
        for (const definition of buff.events) {
          if (definition?.trigger !== undefined) {
            triggers.add(definition.trigger);
          }
        }
      }
    }
    for (const trigger of triggers) addOwner(trigger, owner);
  };
  const rebuild = () => {
    ownersByTrigger = new Map();
    indexList(KinkyDungeonPlayerBuffs, {
      player: true,
      entity: KinkyDungeonPlayerEntity
    });
    for (const entity of KDMapData.Entities) {
      indexList(entity.buffs, { player: false, entity });
    }
    indexedTick = KinkyDungeonCurrentTick;
    indexedPlayerBuffs = KinkyDungeonPlayerBuffs;
    indexedEntities = KDMapData.Entities;
    indexedEntityCount = KDMapData.Entities.length;
    if (stats !== null) {
      stats.rebuilds += 1;
      stats.indexedTriggers += ownersByTrigger.size;
    }
  };
  const refresh = () => {
    if (
      ownersByTrigger === null ||
      indexedTick !== KinkyDungeonCurrentTick ||
      indexedPlayerBuffs !== KinkyDungeonPlayerBuffs ||
      indexedEntities !== KDMapData.Entities ||
      indexedEntityCount !== KDMapData.Entities.length
    ) {
      rebuild();
    }
  };

  return function KinkyDungeonSendBuffEventPositiveOwnerIndex(
    event,
    data
  ) {
    if (stats !== null) stats.calls += 1;
    if (!KDMapHasEvent(KDEventMapBuff, event)) return;
    refresh();
    const owners = ownersByTrigger.get(event);
    if (!owners || owners.length === 0) {
      if (stats !== null) stats.negativeSkips += 1;
      return;
    }
    if (stats !== null) stats.directDispatches += 1;
    for (const owner of owners) {
      const list = owner.player
        ? KinkyDungeonPlayerBuffs
        : owner.entity.buffs;
      if (!list) continue;
      if (stats !== null) stats.ownersScanned += 1;
      for (const buff of Object.values(list)) {
        if (buff?.events) {
          for (const definition of buff.events) {
            if (definition.trigger == event) {
              if (stats !== null) stats.handlerCalls += 1;
              KinkyDungeonHandleBuffEvent(
                event,
                definition,
                buff,
                owner.entity,
                data
              );
            }
          }
        }
      }
    }
  };
}

async function benchmarkNearestPlayerFastPath(
  client,
  sampleCount,
  turnsPerSample,
  hostileFirst = false,
  hostileFirstOnly = false,
  hostilityOrder = "first",
  inlineCanonicalHostile = false,
  hoistJailGuard = false,
  inlineCanonicalFaction = false,
  inlineHostileBody = false,
  reusePlayerRoute = false,
  helplessFastNegative = false
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createNearestPlayerProbeCandidate.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable the AI system for targeting probing");
        }
        const official = globalThis.KinkyDungeonNearestPlayer;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonNearestPlayer is unavailable");
        }
        const candidate = ${
          optimized
            ? `createCandidate(official, null, ${hostileFirst}, ${hostileFirstOnly}, ${JSON.stringify(hostilityOrder)}, ${inlineCanonicalHostile}, ${hoistJailGuard}, ${inlineCanonicalFaction}, ${inlineHostileBody}, ${reusePlayerRoute}, ${helplessFastNegative})`
            : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonNearestPlayer = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonNearestPlayer === candidate
          ) {
            globalThis.KinkyDungeonNearestPlayer = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Targeting probe fixture restore changed its initial state");
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createNearestPlayerProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const official = globalThis.KinkyDungeonNearestPlayer;
      const stats = {
        calls: 0,
        optimizedCalls: 0,
        fallbackCalls: 0,
        factionCacheHits: 0,
        flagCacheHits: 0,
        partyCacheHits: 0,
        alliedCacheHits: 0,
        visionCacheHits: 0,
        jailGuardCacheHits: 0,
        jailGuardHoists: 0,
        routeCacheHits: 0,
        playerRouteComputes: 0,
        playerRouteReuses: 0,
        helplessFastNegatives: 0,
        inlineHostileCalls: 0,
        inlineHostileRejects: 0,
        inlineFactionCalls: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(
        official,
        stats,
        ${hostileFirst},
        ${hostileFirstOnly},
        ${JSON.stringify(hostilityOrder)},
        ${inlineCanonicalHostile},
        ${hoistJailGuard},
        ${inlineCanonicalFaction},
        ${inlineHostileBody},
        ${reusePlayerRoute},
        ${helplessFastNegative}
      );
      if (${inlineCanonicalHostile}) {
        globalThis.KinkyDungeonNearestPlayer = candidate;
        try {
          const result = run(1);
          return {
            ...stats,
            exactMatches: null,
            mismatches: null,
            stateSignature: result.stateSignature
          };
        } finally {
          if (globalThis.KinkyDungeonNearestPlayer === candidate) {
            globalThis.KinkyDungeonNearestPlayer = official;
          }
        }
      }
      const verifyingCandidate = function (...args) {
        const expected = Reflect.apply(official, this, args);
        const actual = Reflect.apply(candidate, this, args);
        if (actual === expected) {
          stats.exactMatches += 1;
        } else {
          stats.mismatches += 1;
        }
        return actual;
      };
      globalThis.KinkyDungeonNearestPlayer = verifyingCandidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonNearestPlayer === verifyingCandidate) {
          globalThis.KinkyDungeonNearestPlayer = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createNearestPlayerProbeCandidate(
  official,
  stats = null,
  hostileFirst = false,
  hostileFirstOnly = false,
  hostilityOrder = "first",
  inlineCanonicalHostile = false,
  hoistJailGuard = false,
  inlineCanonicalFaction = false,
  inlineHostileBody = false,
  reusePlayerRoute = false,
  helplessFastNegative = false
) {
  const dependencies = {
    enemyVisionRadius: globalThis.KDEnemyVisionRadius,
    checkLOS: globalThis.KinkyDungeonCheckLOS,
    checkPath: globalThis.KinkyDungeonCheckPath,
    hostile: globalThis.KDHostile,
    getFaction: globalThis.KDGetFaction,
    enemyHasFlag: globalThis.KDEnemyHasFlag,
    nearbyEnemies: globalThis.KDNearbyEnemies,
    helpless: globalThis.KDHelpless,
    imprisoned: globalThis.KDIsImprisoned,
    chebyshev: globalThis.KDistChebyshev,
    visionGet: globalThis.KinkyDungeonVisionGet,
    allied: globalThis.KDAllied,
    inParty: globalThis.KDIsInParty,
    isServant: globalThis.KDIsServant,
    jailGuard: globalThis.KinkyDungeonJailGuard,
    setFlag: globalThis.KinkyDungeonSetFlag,
    getEnemyByName: globalThis.KinkyDungeonGetEnemyByName,
    factionRelation: globalThis.KDFactionRelation
  };
  const canonicalEnemyDefinitions = new WeakMap();
  const canonicalFaction = (entity) => {
    if (stats !== null) stats.inlineFactionCalls += 1;
    if (!entity) return undefined;
    if (typeof entity === "string") return entity;
    if (entity.player) return "Player";
    if (entity.rage > 0) return "Rage";
    if (entity.faction) return entity.faction;
    const collection = KDGameData.Collection;
    if (
      collection &&
      collection[entity.id + ""] &&
      collection[entity.id + ""].status == "Servant"
    ) {
      return "Player";
    }
    const definition = entity.Enemy;
    if ((definition && definition.allied) || entity.allied) return "Player";
    if (!KDGameData.Party) KDGameData.Party = [];
    for (const partyMember of KDGameData.Party) {
      if (partyMember.id == entity.id) return "Player";
    }
    if (definition && definition.faction) return definition.faction;
    return "Enemy";
  };
  const canonicalHostile = (enemy, candidate, enemyFaction) => {
    if (stats !== null) stats.inlineHostileCalls += 1;
    let result;
    if (enemy.rage > 0) {
      result = true;
    } else if (candidate.ceasefire > 0) {
      result = false;
    } else {
      const candidateFaction = inlineCanonicalFaction
        ? canonicalFaction(candidate)
        : KDGetFaction(candidate);
      if (candidateFaction == "Player" && enemy.hostile > 0) {
        result = true;
      } else if (enemyFaction == "Player" && candidate.hostile > 0) {
        result = true;
      } else if (candidate.rage > 0) {
        result = true;
      } else if (enemyFaction == "Player" && candidate.allied > 0) {
        result = false;
      } else if (
        enemyFaction == "Rage" ||
        candidateFaction == "Rage" ||
        (enemyFaction == "Player" && candidateFaction == "Enemy") ||
        (candidateFaction == "Player" && enemyFaction == "Enemy")
      ) {
        result = true;
      } else {
        result =
          KDFactionRelation(enemyFaction, candidateFaction) <= -0.5;
      }
    }
    if (!result && stats !== null) stats.inlineHostileRejects += 1;
    return result;
  };

  if (hostileFirstOnly) {
    return function KinkyDungeonNearestPlayerHostileFirstProbe(
      enemy,
      _requireVision,
      decoy,
      visionRadius,
      _AI_Data
    ) {
      if (stats !== null) stats.calls += 1;
      if (
        globalThis.KDEnemyVisionRadius !== dependencies.enemyVisionRadius ||
        globalThis.KinkyDungeonCheckLOS !== dependencies.checkLOS ||
        globalThis.KinkyDungeonCheckPath !== dependencies.checkPath ||
        globalThis.KDHostile !== dependencies.hostile ||
        globalThis.KDGetFaction !== dependencies.getFaction ||
        globalThis.KDEnemyHasFlag !== dependencies.enemyHasFlag ||
        globalThis.KDNearbyEnemies !== dependencies.nearbyEnemies ||
        globalThis.KDHelpless !== dependencies.helpless ||
        globalThis.KDIsImprisoned !== dependencies.imprisoned ||
        globalThis.KDistChebyshev !== dependencies.chebyshev ||
        globalThis.KinkyDungeonVisionGet !== dependencies.visionGet ||
        globalThis.KDAllied !== dependencies.allied ||
        globalThis.KDIsInParty !== dependencies.inParty ||
        globalThis.KDIsServant !== dependencies.isServant ||
        globalThis.KinkyDungeonJailGuard !== dependencies.jailGuard ||
        globalThis.KinkyDungeonSetFlag !== dependencies.setFlag ||
        globalThis.KinkyDungeonGetEnemyByName !== dependencies.getEnemyByName ||
        globalThis.KDFactionRelation !== dependencies.factionRelation
      ) {
        if (stats !== null) stats.fallbackCalls += 1;
        return official(enemy, _requireVision, decoy, visionRadius, _AI_Data);
      }

      if (stats !== null) stats.optimizedCalls += 1;
      if (enemy && enemy.Enemy && !visionRadius) {
        visionRadius = KDEnemyVisionRadius(enemy);
        if (enemy.blind && !enemy.aware) visionRadius = 1.5;
      }
      if (decoy) {
        const currentJailGuard = hoistJailGuard
          ? KinkyDungeonJailGuard()
          : undefined;
        if (hoistJailGuard && stats !== null) stats.jailGuardHoists += 1;
        let pdist = Math.sqrt(
          (KinkyDungeonPlayerEntity.x - enemy.x) *
            (KinkyDungeonPlayerEntity.x - enemy.x) +
            (KinkyDungeonPlayerEntity.y - enemy.y) *
              (KinkyDungeonPlayerEntity.y - enemy.y)
        );
        let nearestVisible = undefined;
        let playerRouteBlockedKnown = false;
        let playerRouteBlocked = false;
        if (
          enemy.Enemy.focusPlayer &&
          KinkyDungeonCheckLOS(
            enemy,
            KinkyDungeonPlayerEntity,
            pdist,
            visionRadius,
            false,
            false
          ) &&
          !KinkyDungeonCheckPath(
            enemy.x,
            enemy.y,
            KinkyDungeonPlayerEntity.x,
            KinkyDungeonPlayerEntity.y,
            false,
            true
          )
        ) {
          pdist = 1.5;
        }
        const hostile = KDHostile(enemy);
        let nearestDistance = hostile ? pdist - 0.1 : 100000;
        const enemyFaction = inlineCanonicalHostile
          ? KDGetFaction(enemy)
          : undefined;
        if (
          (inlineCanonicalHostile ? enemyFaction : KDGetFaction(enemy)) ==
            "Player" &&
          (KDEnemyHasFlag(enemy, "NoFollow") ||
            KDEnemyHasFlag(enemy, "StayHere"))
        ) {
          nearestDistance = 100000;
        }
        if (
          (enemy.Enemy.visionRadius || enemy.Enemy.blindSight) &&
          !(enemy.Enemy.noAttack && !enemy.Enemy.spells)
        ) {
          const entities = KDNearbyEnemies(
            enemy.x,
            enemy.y,
            Math.min(nearestDistance, visionRadius),
            undefined,
            true
          );
          for (const candidate of entities) {
            if (candidate == enemy) continue;
            let commonFiltersComplete = false;
            if (hostilityOrder === "first") {
              const definition = candidate.Enemy;
              let canonicalDefinition =
                Boolean(definition?.maxhp) &&
                !candidate.player &&
                canonicalEnemyDefinitions.get(candidate) === definition;
              if (
                !canonicalDefinition &&
                definition?.maxhp &&
                !candidate.player &&
                KinkyDungeonGetEnemyByName(definition.name || definition) ===
                  definition
              ) {
                canonicalEnemyDefinitions.set(candidate, definition);
                canonicalDefinition = true;
              }
              if (canonicalDefinition) {
                if (candidate.Enemy.noAttack) {
                  continue;
                }
                let candidateIsHostile;
                if (!inlineCanonicalHostile) {
                  candidateIsHostile = KDHostile(enemy, candidate);
                } else if (!inlineHostileBody) {
                  candidateIsHostile = canonicalHostile(
                    enemy,
                    candidate,
                    enemyFaction
                  );
                } else {
                  if (stats !== null) stats.inlineHostileCalls += 1;
                  if (enemy.rage > 0) {
                    candidateIsHostile = true;
                  } else if (candidate.ceasefire > 0) {
                    candidateIsHostile = false;
                  } else {
                    const candidateFaction = inlineCanonicalFaction
                      ? canonicalFaction(candidate)
                      : KDGetFaction(candidate);
                    if (
                      candidateFaction == "Player" &&
                      enemy.hostile > 0
                    ) {
                      candidateIsHostile = true;
                    } else if (
                      enemyFaction == "Player" &&
                      candidate.hostile > 0
                    ) {
                      candidateIsHostile = true;
                    } else if (candidate.rage > 0) {
                      candidateIsHostile = true;
                    } else if (
                      enemyFaction == "Player" &&
                      candidate.allied > 0
                    ) {
                      candidateIsHostile = false;
                    } else if (
                      enemyFaction == "Rage" ||
                      candidateFaction == "Rage" ||
                      (enemyFaction == "Player" &&
                        candidateFaction == "Enemy") ||
                      (candidateFaction == "Player" &&
                        enemyFaction == "Enemy")
                    ) {
                      candidateIsHostile = true;
                    } else {
                      candidateIsHostile =
                        KDFactionRelation(
                          enemyFaction,
                          candidateFaction
                        ) <= -0.5;
                    }
                  }
                  if (!candidateIsHostile && stats !== null) {
                    stats.inlineHostileRejects += 1;
                  }
                }
                if (!candidateIsHostile) continue;
                const cannotBeHelpless =
                  helplessFastNegative &&
                  candidate.hp > 0.52 &&
                  !(candidate.boundLevel > 0);
                if (cannotBeHelpless) {
                  if (stats !== null) stats.helplessFastNegatives += 1;
                } else if (KDHelpless(candidate)) {
                  continue;
                }
                if (KDIsImprisoned(candidate)) continue;
              } else {
                // Packed or unusual entities retain the exact upstream order;
                // KDHelpless may unpack and repack their Enemy definition.
                if (KDHelpless(candidate) || KDIsImprisoned(candidate)) continue;
                if (KDGetFaction(candidate) == "Natural") continue;
                if (
                  enemy.Enemy.noTargetSilenced &&
                  candidate.silence > 0
                ) {
                  continue;
                }
                commonFiltersComplete = true;
                if (
                  !candidate.Enemy ||
                  candidate.Enemy.noAttack ||
                  !KDHostile(enemy, candidate)
                ) {
                  continue;
                }
              }
            } else if (hostilityOrder === "after-helpless") {
              if (KDHelpless(candidate)) continue;
              if (
                !candidate.Enemy ||
                candidate.Enemy.noAttack ||
                !KDHostile(enemy, candidate)
              ) {
                continue;
              }
              if (KDIsImprisoned(candidate)) continue;
            } else {
              if (KDHelpless(candidate) || KDIsImprisoned(candidate)) continue;
              if (
                !candidate.Enemy ||
                candidate.Enemy.noAttack ||
                !KDHostile(enemy, candidate)
              ) {
                continue;
              }
            }
            if (!commonFiltersComplete) {
              if (KDGetFaction(candidate) == "Natural") continue;
              if (enemy.Enemy.noTargetSilenced && candidate.silence > 0) continue;
            }
            if (
              candidate.Enemy?.tags?.scenery &&
              KDAllied(enemy) &&
              !KDEnemyHasFlag(candidate, "targetedForAttack")
            ) {
              continue;
            }
            let distance = Math.sqrt(
              (candidate.x - enemy.x) * (candidate.x - enemy.x) +
                (candidate.y - enemy.y) * (candidate.y - enemy.y)
            );
            const pdistEnemy =
              (inlineCanonicalHostile
                ? enemyFaction
                : KDGetFaction(enemy)) == "Player" &&
              !KDEnemyHasFlag(enemy, "NoFollow") &&
              !KDEnemyHasFlag(enemy, "StayHere") &&
              (enemy.Enemy.allied ||
                KDIsInParty(enemy) ||
                !KDGameData.PrisonerState ||
                KDGameData.PrisonerState == "chase")
                ? KDistChebyshev(
                    candidate.x - KinkyDungeonPlayerEntity.x,
                    candidate.y - KinkyDungeonPlayerEntity.y
                  )
                : -1;
            if (pdistEnemy > 0 && pdistEnemy < 1.5 && hostile) {
              KinkyDungeonSetFlag("AIHelpPlayer", 4);
            }
            if (
              pdistEnemy > 0 &&
              KinkyDungeonFlags.get("AIHelpPlayer") &&
              distance > 2.5
            ) {
              if (pdistEnemy > 2.5) distance += 2;
              else distance = Math.max(1.01 + distance / 4, distance / 3);
            }
            if (
              distance <= nearestDistance &&
              (pdistEnemy <= 0 ||
                ((KinkyDungeonVisionGet(candidate.x, candidate.y) > 0 ||
                  pdistEnemy < 5 ||
                  candidate ==
                    (hoistJailGuard
                      ? currentJailGuard
                      : KinkyDungeonJailGuard()) ||
                  enemy ==
                    (hoistJailGuard
                      ? currentJailGuard
                      : KinkyDungeonJailGuard())) &&
                  (pdistEnemy < 8 || enemy.Enemy.followRange > 1)))
            ) {
              if (
                KinkyDungeonCheckLOS(
                  enemy,
                  candidate,
                  distance,
                  visionRadius,
                  true,
                  true
                ) &&
                (KinkyDungeonVisionGet(candidate.x, candidate.y) > 0 ||
                  KinkyDungeonVisionGet(enemy.x, enemy.y) > 0 ||
                  candidate.aware ||
                  enemy.aware ||
                  candidate ==
                    (hoistJailGuard
                      ? currentJailGuard
                      : KinkyDungeonJailGuard()) ||
                  enemy ==
                    (hoistJailGuard
                      ? currentJailGuard
                      : KinkyDungeonJailGuard()))
              ) {
                let canSelect =
                  enemy.rage ||
                  !candidate.Enemy.lowpriority ||
                  (enemy.gx == candidate.x && enemy.gy == candidate.y);
                if (!canSelect && reusePlayerRoute) {
                  if (!playerRouteBlockedKnown) {
                    playerRouteBlocked =
                      !KinkyDungeonCheckLOS(
                        enemy,
                        KinkyDungeonPlayerEntity,
                        pdist,
                        visionRadius,
                        true,
                        true
                      ) ||
                      !KinkyDungeonCheckPath(
                        enemy.x,
                        enemy.y,
                        KinkyDungeonPlayerEntity.x,
                        KinkyDungeonPlayerEntity.y,
                        false,
                        true
                      );
                    playerRouteBlockedKnown = true;
                    if (stats !== null) stats.playerRouteComputes += 1;
                  } else if (stats !== null) {
                    stats.playerRouteReuses += 1;
                  }
                  canSelect = playerRouteBlocked;
                } else if (!canSelect) {
                  canSelect =
                    !KinkyDungeonCheckLOS(
                      enemy,
                      KinkyDungeonPlayerEntity,
                      pdist,
                      visionRadius,
                      true,
                      true
                    ) ||
                    !KinkyDungeonCheckPath(
                      enemy.x,
                      enemy.y,
                      KinkyDungeonPlayerEntity.x,
                      KinkyDungeonPlayerEntity.y,
                      false,
                      true
                    );
                }
                if (canSelect) {
                  nearestVisible = candidate;
                  nearestDistance = distance;
                }
              }
            }
          }
        }
        if (nearestVisible) return nearestVisible;
      }
      return KinkyDungeonPlayerEntity;
    };
  }

  return function KinkyDungeonNearestPlayerProbe(
    enemy,
    _requireVision,
    decoy,
    visionRadius,
    _AI_Data
  ) {
    if (stats !== null) stats.calls += 1;
    if (
      globalThis.KDEnemyVisionRadius !== dependencies.enemyVisionRadius ||
      globalThis.KinkyDungeonCheckLOS !== dependencies.checkLOS ||
      globalThis.KinkyDungeonCheckPath !== dependencies.checkPath ||
      globalThis.KDHostile !== dependencies.hostile ||
      globalThis.KDGetFaction !== dependencies.getFaction ||
      globalThis.KDEnemyHasFlag !== dependencies.enemyHasFlag ||
      globalThis.KDNearbyEnemies !== dependencies.nearbyEnemies ||
      globalThis.KDHelpless !== dependencies.helpless ||
      globalThis.KDIsImprisoned !== dependencies.imprisoned ||
      globalThis.KDistChebyshev !== dependencies.chebyshev ||
      globalThis.KinkyDungeonVisionGet !== dependencies.visionGet ||
      globalThis.KDAllied !== dependencies.allied ||
      globalThis.KDIsInParty !== dependencies.inParty ||
      globalThis.KDIsServant !== dependencies.isServant ||
      globalThis.KinkyDungeonJailGuard !== dependencies.jailGuard ||
      globalThis.KinkyDungeonSetFlag !== dependencies.setFlag ||
      globalThis.KinkyDungeonGetEnemyByName !== dependencies.getEnemyByName ||
      globalThis.KDFactionRelation !== dependencies.factionRelation
    ) {
      if (stats !== null) stats.fallbackCalls += 1;
      return official(enemy, _requireVision, decoy, visionRadius, _AI_Data);
    }

    if (stats !== null) stats.optimizedCalls += 1;
    if (enemy && enemy.Enemy && !visionRadius) {
      visionRadius = KDEnemyVisionRadius(enemy);
      if (enemy.blind && !enemy.aware) visionRadius = 1.5;
    }
    if (decoy) {
      let pdist = Math.sqrt(
        (KinkyDungeonPlayerEntity.x - enemy.x) *
          (KinkyDungeonPlayerEntity.x - enemy.x) +
          (KinkyDungeonPlayerEntity.y - enemy.y) *
            (KinkyDungeonPlayerEntity.y - enemy.y)
      );
      let nearestVisible = undefined;
      if (
        enemy.Enemy.focusPlayer &&
        KinkyDungeonCheckLOS(
          enemy,
          KinkyDungeonPlayerEntity,
          pdist,
          visionRadius,
          false,
          false
        ) &&
        !KinkyDungeonCheckPath(
          enemy.x,
          enemy.y,
          KinkyDungeonPlayerEntity.x,
          KinkyDungeonPlayerEntity.y,
          false,
          true
        )
      ) {
        pdist = 1.5;
      }
      const hostile = KDHostile(enemy);
      let nearestDistance = hostile ? pdist - 0.1 : 100000;
      const enemyFaction = KDGetFaction(enemy);
      let noFollow = false;
      let stayHere = false;
      if (enemyFaction == "Player") {
        noFollow = KDEnemyHasFlag(enemy, "NoFollow");
        if (!noFollow) stayHere = KDEnemyHasFlag(enemy, "StayHere");
        if (noFollow || stayHere) nearestDistance = 100000;
      }
      if (
        (enemy.Enemy.visionRadius || enemy.Enemy.blindSight) &&
        !(enemy.Enemy.noAttack && !enemy.Enemy.spells)
      ) {
        const entities = KDNearbyEnemies(
          enemy.x,
          enemy.y,
          Math.min(nearestDistance, visionRadius),
          undefined,
          true
        );
        let partyKnown = false;
        let inParty = false;
        let alliedKnown = false;
        let allied = false;
        let jailGuardKnown = false;
        let jailGuard;
        let enemyVisionKnown = false;
        let enemyVision = 0;
        let playerRouteBlockedKnown = false;
        let playerRouteBlocked = false;
        for (const candidate of entities) {
          if (candidate == enemy) continue;
          if (!candidate.Enemy || candidate.Enemy.noAttack) continue;
          const hostileCandidate = hostileFirst
            ? KDHostile(enemy, candidate)
            : false;
          if (hostileFirst && !hostileCandidate) continue;
          if (KDHelpless(candidate) || KDIsImprisoned(candidate)) continue;
          if (KDGetFaction(candidate) == "Natural") continue;
          if (enemy.Enemy.noTargetSilenced && candidate.silence > 0) continue;
          if (hostileCandidate || KDHostile(enemy, candidate)) {
            if (candidate.Enemy?.tags?.scenery) {
              if (!alliedKnown) {
                allied = KDAllied(enemy);
                alliedKnown = true;
              } else if (stats !== null) {
                stats.alliedCacheHits += 1;
              }
              if (allied && !KDEnemyHasFlag(candidate, "targetedForAttack")) {
                continue;
              }
            }
            const dx = candidate.x - enemy.x;
            const dy = candidate.y - enemy.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (stats !== null) stats.factionCacheHits += 1;
            if (enemyFaction == "Player" && !noFollow && !stayHere) {
              if (stats !== null) stats.flagCacheHits += 2;
              if (!enemy.Enemy.allied) {
                if (!partyKnown) {
                  inParty = KDIsInParty(enemy);
                  partyKnown = true;
                } else if (stats !== null) {
                  stats.partyCacheHits += 1;
                }
              }
            }
            const pdistEnemy =
              enemyFaction == "Player" &&
              !noFollow &&
              !stayHere &&
              (enemy.Enemy.allied ||
                inParty ||
                (!KDGameData.PrisonerState ||
                  KDGameData.PrisonerState == "chase"))
                ? KDistChebyshev(
                    candidate.x - KinkyDungeonPlayerEntity.x,
                    candidate.y - KinkyDungeonPlayerEntity.y
                  )
                : -1;
            if (pdistEnemy > 0 && pdistEnemy < 1.5 && hostile) {
              KinkyDungeonSetFlag("AIHelpPlayer", 4);
            }
            if (
              pdistEnemy > 0 &&
              KinkyDungeonFlags.get("AIHelpPlayer") &&
              distance > 2.5
            ) {
              if (pdistEnemy > 2.5) distance += 2;
              else distance = Math.max(1.01 + distance / 4, distance / 3);
            }
            if (distance <= nearestDistance) {
              let candidateVisionKnown = false;
              let candidateVision = 0;
              let firstVisibility = pdistEnemy <= 0;
              if (!firstVisibility) {
                candidateVision = KinkyDungeonVisionGet(
                  candidate.x,
                  candidate.y
                );
                candidateVisionKnown = true;
                firstVisibility = candidateVision > 0 || pdistEnemy < 5;
                if (!firstVisibility) {
                  if (!jailGuardKnown) {
                    jailGuard = KinkyDungeonJailGuard();
                    jailGuardKnown = true;
                  } else if (stats !== null) {
                    stats.jailGuardCacheHits += 1;
                  }
                  firstVisibility = candidate == jailGuard;
                }
                if (!firstVisibility) {
                  if (stats !== null) stats.jailGuardCacheHits += 1;
                  firstVisibility = enemy == jailGuard;
                }
              }
              if (
                firstVisibility &&
                (pdistEnemy <= 0 ||
                  pdistEnemy < 8 ||
                  enemy.Enemy.followRange > 1) &&
                KinkyDungeonCheckLOS(
                  enemy,
                  candidate,
                  distance,
                  visionRadius,
                  true,
                  true
                )
              ) {
                if (!candidateVisionKnown) {
                  candidateVision = KinkyDungeonVisionGet(
                    candidate.x,
                    candidate.y
                  );
                  candidateVisionKnown = true;
                } else if (stats !== null) {
                  stats.visionCacheHits += 1;
                }
                let secondVisibility = candidateVision > 0;
                if (!secondVisibility) {
                  if (!enemyVisionKnown) {
                    enemyVision = KinkyDungeonVisionGet(enemy.x, enemy.y);
                    enemyVisionKnown = true;
                  } else if (stats !== null) {
                    stats.visionCacheHits += 1;
                  }
                  secondVisibility = enemyVision > 0;
                }
                if (!secondVisibility) {
                  secondVisibility = candidate.aware || enemy.aware;
                }
                if (!secondVisibility) {
                  if (!jailGuardKnown) {
                    jailGuard = KinkyDungeonJailGuard();
                    jailGuardKnown = true;
                  } else if (stats !== null) {
                    stats.jailGuardCacheHits += 1;
                  }
                  secondVisibility = candidate == jailGuard;
                }
                if (!secondVisibility) {
                  if (stats !== null) stats.jailGuardCacheHits += 1;
                  secondVisibility = enemy == jailGuard;
                }
                if (secondVisibility) {
                  let canSelect =
                    enemy.rage ||
                    !candidate.Enemy.lowpriority ||
                    (enemy.gx == candidate.x && enemy.gy == candidate.y);
                  if (!canSelect) {
                    if (!playerRouteBlockedKnown) {
                      playerRouteBlocked =
                        !KinkyDungeonCheckLOS(
                          enemy,
                          KinkyDungeonPlayerEntity,
                          pdist,
                          visionRadius,
                          true,
                          true
                        ) ||
                        !KinkyDungeonCheckPath(
                          enemy.x,
                          enemy.y,
                          KinkyDungeonPlayerEntity.x,
                          KinkyDungeonPlayerEntity.y,
                          false,
                          true
                        );
                      playerRouteBlockedKnown = true;
                    } else if (stats !== null) {
                      stats.routeCacheHits += 1;
                    }
                    canSelect = playerRouteBlocked;
                  }
                  if (canSelect) {
                    nearestVisible = candidate;
                    nearestDistance = distance;
                  }
                }
              }
            }
          }
        }
        if (nearestVisible) return nearestVisible;
      }
    }
    return KinkyDungeonPlayerEntity;
  };
}

async function benchmarkLOSDistanceFirst(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createLOSDistanceFirstCandidate.toString()};
        const firstInitial = restore();
        const official = globalThis.KinkyDungeonCheckLOS;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonCheckLOS is unavailable");
        }
        const stats = ${diagnostic}
          ? { calls: 0, distanceFastReturns: 0, inRangeCalls: 0 }
          : null;
        const candidate = ${optimized}
          ? createCandidate(stats)
          : null;
        if (candidate !== null) {
          globalThis.KinkyDungeonCheckLOS = candidate;
        }
        try {
          run(3);
          const initial = restore();
          if (initial.stateSignature !== firstInitial.stateSignature) {
            throw new Error("LOS distance-first warm-up changed fixture restore");
          }
          if (stats !== null) {
            stats.calls = 0;
            stats.distanceFastReturns = 0;
            stats.inRangeCalls = 0;
          }
          return {
            initial,
            stats,
            run: run(${turnsPerSample})
          };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonCheckLOS === candidate
          ) {
            globalThis.KinkyDungeonCheckLOS = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "LOS distance-first fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const compatibility = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const createCandidate =
        ${createLOSDistanceFirstCandidate.toString()};
      restore();
      const official = globalThis.KinkyDungeonCheckLOS;
      const stats = { calls: 0, distanceFastReturns: 0, inRangeCalls: 0 };
      const candidate = createCandidate(stats);
      const enemy = KDMapData.Entities[0];
      const target = KDMapData.Entities[1];
      if (!enemy || !target) throw new Error("LOS probe needs two enemies");
      const distance = Math.sqrt(
        (target.x - enemy.x) * (target.x - enemy.x) +
        (target.y - enemy.y) * (target.y - enemy.y)
      );
      const compare = (name, args) => {
        const baseline = Reflect.apply(official, null, args);
        const optimized = Reflect.apply(candidate, null, args);
        return { name, baseline, optimized, matches: baseline === optimized };
      };
      const cases = [
        compare("in-range-blind", [
          enemy,
          target,
          distance,
          distance + 1,
          true,
          true
        ]),
        compare("in-range-sight", [
          enemy,
          target,
          distance,
          distance + 1,
          false,
          false
        ]),
        compare("out-of-range", [
          enemy,
          target,
          distance + 2,
          distance,
          true,
          true
        ]),
        compare("nan-distance", [
          enemy,
          target,
          Number.NaN,
          distance,
          true,
          true
        ])
      ];
      let replacementTookControl = false;
      const replacement = function () {
        replacementTookControl = true;
        return "replacement";
      };
      globalThis.KinkyDungeonCheckLOS = candidate;
      try {
        globalThis.KinkyDungeonCheckLOS = replacement;
        replacementTookControl =
          globalThis.KinkyDungeonCheckLOS() === "replacement" &&
          replacementTookControl;
      } finally {
        if (
          globalThis.KinkyDungeonCheckLOS === candidate ||
          globalThis.KinkyDungeonCheckLOS === replacement
        ) {
          globalThis.KinkyDungeonCheckLOS = official;
        }
        restore();
      }
      return {
        cases,
        replacementTookControl,
        stats,
        passed:
          cases.every((entry) => entry.matches) &&
          replacementTookControl
      };
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baseline: baselineVerification.stats,
      optimized: optimizedVerification.stats
    },
    compatibility,
    samples
  };
}

function createLOSDistanceFirstCandidate(stats = null) {
  if (stats === null) {
    return function KinkyDungeonCheckLOSDistanceFirst(
      enemy,
      player,
      distance,
      maxdistance,
      allowBlind,
      allowBars,
      maxFails
    ) {
      if (!(distance <= maxdistance)) return false;
      let blindSight =
        enemy && enemy.Enemy && enemy.Enemy.blindSight
          ? enemy.Enemy.blindSight
          : 0;
      if (KinkyDungeonStatsChoice.get("KillSquad")) blindSight += 3.5;
      if (
        player.player &&
        enemy.Enemy &&
        (enemy.Enemy.playerBlindSight || KDAllied(enemy))
      ) {
        blindSight = enemy.Enemy.playerBlindSight;
      }
      return (
        (allowBlind && blindSight >= distance) ||
        KinkyDungeonCheckPath(
          enemy.x,
          enemy.y,
          player.x,
          player.y,
          allowBars,
          false,
          maxFails
        )
      );
    };
  }
  return function KinkyDungeonCheckLOSDistanceFirstDiagnostic(
    enemy,
    player,
    distance,
    maxdistance,
    allowBlind,
    allowBars,
    maxFails
  ) {
    stats.calls += 1;
    if (!(distance <= maxdistance)) {
      stats.distanceFastReturns += 1;
      return false;
    }
    stats.inRangeCalls += 1;
    let blindSight =
      enemy && enemy.Enemy && enemy.Enemy.blindSight
        ? enemy.Enemy.blindSight
        : 0;
    if (KinkyDungeonStatsChoice.get("KillSquad")) blindSight += 3.5;
    if (
      player.player &&
      enemy.Enemy &&
      (enemy.Enemy.playerBlindSight || KDAllied(enemy))
    ) {
      blindSight = enemy.Enemy.playerBlindSight;
    }
    return (
      (allowBlind && blindSight >= distance) ||
      KinkyDungeonCheckPath(
        enemy.x,
        enemy.y,
        player.x,
        player.y,
        allowBars,
        false,
        maxFails
      )
    );
  };
}

async function benchmarkFindIdSingleGet(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createFindIdSingleGetCandidate.toString()};
        const initial = restore();
        const official = globalThis.KinkyDungeonFindID;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonFindID is unavailable");
        }
        const stats = ${diagnostic}
          ? {
              calls: 0,
              cacheHits: 0,
              mainMapScans: 0,
              alternateMapScans: 0,
              misses: 0
            }
          : null;
        const candidate = ${optimized}
          ? createCandidate(stats)
          : null;
        if (candidate !== null) {
          globalThis.KinkyDungeonFindID = candidate;
        }
        try {
          if (!${diagnostic}) {
            const warmId = KDMapData.Entities[0]?.id;
            if (warmId !== undefined) {
              for (let index = 0; index < 30_000; index += 1) {
                globalThis.KinkyDungeonFindID(warmId);
              }
            }
          }
          return {
            initial,
            stats,
            run: run(${turnsPerSample})
          };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonFindID === candidate
          ) {
            globalThis.KinkyDungeonFindID = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Find-ID probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const compatibility = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const createCandidate =
        ${createFindIdSingleGetCandidate.toString()};
      restore();
      const official = globalThis.KinkyDungeonFindID;
      const stats = {
        calls: 0,
        cacheHits: 0,
        mainMapScans: 0,
        alternateMapScans: 0,
        misses: 0
      };
      const candidate = createCandidate(stats);
      const enemy = KDMapData.Entities[0];
      if (!enemy) throw new Error("Find-ID probe needs an enemy");
      const alternateEntity = {
        id: -2147483003,
        Enemy: { name: "KDHybridFindIdProbe" }
      };
      const alternateMap = { Entities: [alternateEntity] };
      const cases = [
        {
          name: "implicit-main-hit",
          baseline: official(enemy.id),
          optimized: candidate(enemy.id)
        },
        {
          name: "explicit-main-hit",
          baseline: official(enemy.id, KDMapData),
          optimized: candidate(enemy.id, KDMapData)
        },
        {
          name: "implicit-main-miss",
          baseline: official(-2147483004),
          optimized: candidate(-2147483004)
        },
        {
          name: "alternate-hit",
          baseline: official(alternateEntity.id, alternateMap),
          optimized: candidate(alternateEntity.id, alternateMap)
        },
        {
          name: "alternate-miss",
          baseline: official(-2147483005, alternateMap),
          optimized: candidate(-2147483005, alternateMap)
        }
      ].map((entry) => ({
        name: entry.name,
        sameReference: entry.baseline === entry.optimized,
        baselineId: entry.baseline?.id ?? null,
        optimizedId: entry.optimized?.id ?? null
      }));

      let replacementTookControl = false;
      const replacement = function () {
        replacementTookControl = true;
        return alternateEntity;
      };
      globalThis.KinkyDungeonFindID = candidate;
      try {
        globalThis.KinkyDungeonFindID = replacement;
        replacementTookControl =
          globalThis.KinkyDungeonFindID(-2147483006) === alternateEntity &&
          replacementTookControl;
      } finally {
        if (
          globalThis.KinkyDungeonFindID === replacement ||
          globalThis.KinkyDungeonFindID === candidate
        ) {
          globalThis.KinkyDungeonFindID = official;
        }
        restore();
      }
      return {
        cases,
        replacementTookControl,
        stats,
        passed:
          cases.every((entry) => entry.sameReference) &&
          replacementTookControl
      };
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baseline: baselineVerification.stats,
      optimized: optimizedVerification.stats
    },
    compatibility,
    samples
  };
}

function createFindIdSingleGetCandidate(stats = null) {
  if (stats === null) {
    return function KinkyDungeonFindIDSingleGet(id, mapData) {
      if (!mapData || mapData == KDMapData) {
        const cached = KDIDCache.get(id);
        if (cached) return cached;
        for (const entity of KDMapData.Entities) {
          if (entity.id == id) return entity;
        }
      } else {
        for (const entity of mapData.Entities) {
          if (entity.id == id) return entity;
        }
      }
      return null;
    };
  }
  return function KinkyDungeonFindIDSingleGetDiagnostic(id, mapData) {
    stats.calls += 1;
    if (!mapData || mapData == KDMapData) {
      const cached = KDIDCache.get(id);
      if (cached) {
        stats.cacheHits += 1;
        return cached;
      }
      stats.mainMapScans += 1;
      for (const entity of KDMapData.Entities) {
        if (entity.id == id) return entity;
      }
    } else {
      stats.alternateMapScans += 1;
      for (const entity of mapData.Entities) {
        if (entity.id == id) return entity;
      }
    }
    stats.misses += 1;
    return null;
  };
}

async function benchmarkOpinionIdSingleLookup(
  client,
  sampleCount,
  turnsPerSample,
  guardDependencies = true
) {
  const samples = [];
  let referenceInitialState = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createOpinionIdSingleLookupCandidate.toString()};
        const initial = restore();
        const official = globalThis.KDGetModifiedOpinionID;
        if (typeof official !== "function") {
          throw new Error("KDGetModifiedOpinionID is unavailable");
        }
        const stats = ${diagnostic}
          ? {
              calls: 0,
              currentEntityHits: 0,
              officialCalls: 0,
              missingEntityFallbacks: 0,
              persistentFallbacks: 0,
              compatibilityFallbacks: 0,
              duplicateLookupsAvoided: 0
            }
          : null;
        const candidate = ${optimized}
          ? createCandidate(official, stats, ${guardDependencies})
          : null;
        if (candidate !== null) {
          globalThis.KDGetModifiedOpinionID = candidate;
        }
        try {
          return {
            initial,
            stats,
            run: run(${turnsPerSample})
          };
        } finally {
          if (
            candidate !== null &&
            globalThis.KDGetModifiedOpinionID === candidate
          ) {
            globalThis.KDGetModifiedOpinionID = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Opinion-ID probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const compatibility = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const createCandidate =
        ${createOpinionIdSingleLookupCandidate.toString()};
      restore();
      const official = globalThis.KDGetModifiedOpinionID;
      const stats = {
        calls: 0,
        currentEntityHits: 0,
        officialCalls: 0,
        missingEntityFallbacks: 0,
        persistentFallbacks: 0,
        compatibilityFallbacks: 0,
        duplicateLookupsAvoided: 0
      };
      const candidate = createCandidate(official, stats);
      const enemy = KDMapData.Entities[0];
      if (!enemy) throw new Error("Opinion-ID probe needs an enemy");
      const fakeId = -2147483002;
      const collectionKey = String(fakeId);
      const hadCollectionEntry = Object.prototype.hasOwnProperty.call(
        KDGameData.Collection,
        collectionKey
      );
      const savedCollectionEntry = KDGameData.Collection[collectionKey];
      const compare = (name, id, args = []) => {
        const baseline = official(id, ...args);
        const optimized = candidate(id, ...args);
        return {
          name,
          baseline,
          optimized,
          matches: Object.is(baseline, optimized)
        };
      };
      const cases = [];
      let findDependencyFallback;
      let opinionDependencyFallback;
      try {
        delete KDGameData.Collection[collectionKey];
        cases.push(compare("current-defaults", enemy.id));
        cases.push(
          compare("current-no-faction", enemy.id, [false, true, false, 0])
        );
        cases.push(
          compare("current-all-options", enemy.id, [true, true, true, -1])
        );
        cases.push(compare("missing", fakeId));
        KDGameData.Collection[collectionKey] = {
          status: "Free",
          Faction: "Enemy",
          Opinion: 3,
          personality: "Loose",
          type: enemy.Enemy.name
        };
        cases.push(compare("collection-only", fakeId));

        const originalFind = globalThis.KinkyDungeonFindID;
        let replacementCalls = 0;
        const replacementFind = function (...args) {
          replacementCalls += 1;
          return Reflect.apply(originalFind, this, args);
        };
        const beforeFindFallbacks = stats.compatibilityFallbacks;
        globalThis.KinkyDungeonFindID = replacementFind;
        try {
          findDependencyFallback = {
            baseline: official(enemy.id),
            result: candidate(enemy.id),
            replacementCalls,
            compatibilityFallbacks:
              stats.compatibilityFallbacks - beforeFindFallbacks
          };
        } finally {
          if (globalThis.KinkyDungeonFindID === replacementFind) {
            globalThis.KinkyDungeonFindID = originalFind;
          }
        }

        const originalOpinion = globalThis.KDGetModifiedOpinion;
        let opinionReplacementCalls = 0;
        const replacementOpinion = function () {
          opinionReplacementCalls += 1;
          return 123.25;
        };
        const beforeOpinionFallbacks = stats.compatibilityFallbacks;
        globalThis.KDGetModifiedOpinion = replacementOpinion;
        try {
          opinionDependencyFallback = {
            result: candidate(enemy.id),
            replacementCalls: opinionReplacementCalls,
            compatibilityFallbacks:
              stats.compatibilityFallbacks - beforeOpinionFallbacks
          };
        } finally {
          if (globalThis.KDGetModifiedOpinion === replacementOpinion) {
            globalThis.KDGetModifiedOpinion = originalOpinion;
          }
        }
      } finally {
        if (hadCollectionEntry) {
          KDGameData.Collection[collectionKey] = savedCollectionEntry;
        } else {
          delete KDGameData.Collection[collectionKey];
        }
        if (globalThis.KDGetModifiedOpinionID === candidate) {
          globalThis.KDGetModifiedOpinionID = official;
        }
        restore();
      }

      return {
        cases,
        findDependencyFallback,
        opinionDependencyFallback,
        stats,
        passed:
          cases.every((entry) => entry.matches) &&
          Object.is(
            findDependencyFallback?.baseline,
            findDependencyFallback?.result
          ) &&
          findDependencyFallback?.replacementCalls >= 4 &&
          findDependencyFallback?.compatibilityFallbacks === 1 &&
          opinionDependencyFallback?.result === 123.25 &&
          opinionDependencyFallback?.replacementCalls === 1 &&
          opinionDependencyFallback?.compatibilityFallbacks === 1
      };
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    dependencyGuardsEnabled: guardDependencies,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baseline: baselineVerification.stats,
      optimized: optimizedVerification.stats
    },
    compatibility,
    samples
  };
}

function createOpinionIdSingleLookupCandidate(
  official,
  stats = null,
  guardDependencies = true
) {
  const dependencies = {
    isPersistent: globalThis.KDIsNPCPersistent,
    findId: globalThis.KinkyDungeonFindID,
    getModifiedOpinion: globalThis.KDGetModifiedOpinion
  };
  if (stats === null) {
    return function KDGetModifiedOpinionIDSingleLookup(
      id,
      allowFaction = true,
      allowSub = true,
      allowPerk = false,
      allowOnlyPosNegFaction = 0
    ) {
      if (
        guardDependencies &&
        (globalThis.KDIsNPCPersistent !== dependencies.isPersistent ||
          globalThis.KinkyDungeonFindID !== dependencies.findId ||
          globalThis.KDGetModifiedOpinion !==
            dependencies.getModifiedOpinion
        )
      ) {
        return Reflect.apply(official, this, arguments);
      }
      if (!KDIsNPCPersistent(id)) {
        const enemy = KinkyDungeonFindID(id);
        if (enemy) {
          return KDGetModifiedOpinion(
            enemy,
            allowFaction,
            allowSub,
            allowPerk
          );
        }
      }
      return Reflect.apply(official, this, arguments);
    };
  }
  return function KDGetModifiedOpinionIDSingleLookupDiagnostic(
    id,
    allowFaction = true,
    allowSub = true,
    allowPerk = false,
    allowOnlyPosNegFaction = 0
  ) {
    stats.calls += 1;
    if (
      guardDependencies &&
      (globalThis.KDIsNPCPersistent !== dependencies.isPersistent ||
        globalThis.KinkyDungeonFindID !== dependencies.findId ||
        globalThis.KDGetModifiedOpinion !== dependencies.getModifiedOpinion
      )
    ) {
      stats.compatibilityFallbacks += 1;
      stats.officialCalls += 1;
      return Reflect.apply(official, this, arguments);
    }
    if (!KDIsNPCPersistent(id)) {
      const enemy = KinkyDungeonFindID(id);
      if (enemy) {
        stats.currentEntityHits += 1;
        stats.duplicateLookupsAvoided += 1;
        return KDGetModifiedOpinion(
          enemy,
          allowFaction,
          allowSub,
          allowPerk
        );
      }
      stats.missingEntityFallbacks += 1;
    } else {
      stats.persistentFallbacks += 1;
    }
    stats.officialCalls += 1;
    return Reflect.apply(official, this, arguments);
  };
}

async function benchmarkBoundEffectsFastNegative(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createBoundEffectsFastNegativeCandidate.toString()};
        const initial = restore();
        const official = globalThis.KDBoundEffects;
        if (typeof official !== "function") {
          throw new Error("KDBoundEffects is unavailable");
        }
        const stats = ${diagnostic}
          ? {
              calls: 0,
              fastReturns: 0,
              incapableFastReturns: 0,
              unboundFastReturns: 0,
              officialCalls: 0,
              compatibilityFallbacks: 0
            }
          : null;
        const candidate = ${optimized}
          ? createCandidate(official, stats)
          : null;
        if (candidate !== null) {
          globalThis.KDBoundEffects = candidate;
        }
        try {
          return {
            initial,
            stats,
            run: run(${turnsPerSample})
          };
        } finally {
          if (
            candidate !== null &&
            globalThis.KDBoundEffects === candidate
          ) {
            globalThis.KDBoundEffects = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Bound-effects probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const compatibility = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const createCandidate =
        ${createBoundEffectsFastNegativeCandidate.toString()};
      restore();
      const official = globalThis.KDBoundEffects;
      const stats = {
        calls: 0,
        fastReturns: 0,
        incapableFastReturns: 0,
        unboundFastReturns: 0,
        officialCalls: 0,
        compatibilityFallbacks: 0
      };
      const candidate = createCandidate(official, stats);
      const fakeId = -2147483001;
      const collectionKey = String(fakeId);
      const hadCollectionEntry = Object.prototype.hasOwnProperty.call(
        KDGameData.Collection,
        collectionKey
      );
      const savedCollectionEntry = KDGameData.Collection[collectionKey];
      const hadPlayerFlag = KinkyDungeonFlags.has("imprisoned");
      const savedPlayerFlag = KinkyDungeonFlags.get("imprisoned");
      const makeEnemy = (overrides = {}) => ({
        id: fakeId,
        hp: 10,
        boundLevel: 0,
        flags: {},
        Enemy: {
          name: "KDHybridBoundEffectsProbe",
          bound: true,
          maxhp: 10,
          tags: {}
        },
        ...overrides
      });
      const compare = (name, enemy) => {
        const baseline = official(enemy);
        const optimized = candidate(enemy);
        return {
          name,
          baseline,
          optimized,
          matches: Object.is(baseline, optimized)
        };
      };
      const cases = [];
      let dependencyFallback;
      let nestedDependencyFallback;
      try {
        delete KDGameData.Collection[collectionKey];
        KinkyDungeonFlags.delete("imprisoned");
        cases.push(compare("unbound", makeEnemy()));
        cases.push(
          compare(
            "incapable",
            makeEnemy({
              Enemy: {
                name: "KDHybridBoundEffectsProbe",
                bound: undefined,
                maxhp: 10,
                tags: {}
              }
            })
          )
        );
        cases.push(
          compare(
            "local-imprisoned",
            makeEnemy({ flags: { imprisoned: -1 } })
          )
        );
        KDGameData.Collection[collectionKey] = {
          flags: { imprisoned: 2 }
        };
        cases.push(compare("collection-imprisoned", makeEnemy()));
        delete KDGameData.Collection[collectionKey];
        cases.push(
          compare("partly-bound", makeEnemy({ boundLevel: 8 }))
        );
        KinkyDungeonFlags.set("imprisoned", 2);
        cases.push(
          compare("player-imprisoned", makeEnemy({ player: true }))
        );
        KinkyDungeonFlags.delete("imprisoned");

        const originalImprisoned = globalThis.KDIsImprisoned;
        let replacementCalls = 0;
        const replacementImprisoned = function () {
          replacementCalls += 1;
          return true;
        };
        const beforeFallbacks = stats.compatibilityFallbacks;
        globalThis.KDIsImprisoned = replacementImprisoned;
        try {
          dependencyFallback = {
            result: candidate(makeEnemy()),
            replacementCalls,
            compatibilityFallbacks:
              stats.compatibilityFallbacks - beforeFallbacks
          };
        } finally {
          if (globalThis.KDIsImprisoned === replacementImprisoned) {
            globalThis.KDIsImprisoned = originalImprisoned;
          }
        }

        const originalEntityHasFlag = globalThis.KDEntityHasFlag;
        let nestedReplacementCalls = 0;
        const replacementEntityHasFlag = function () {
          nestedReplacementCalls += 1;
          return true;
        };
        const beforeNestedFallbacks = stats.compatibilityFallbacks;
        globalThis.KDEntityHasFlag = replacementEntityHasFlag;
        try {
          nestedDependencyFallback = {
            result: candidate(makeEnemy()),
            replacementCalls: nestedReplacementCalls,
            compatibilityFallbacks:
              stats.compatibilityFallbacks - beforeNestedFallbacks
          };
        } finally {
          if (globalThis.KDEntityHasFlag === replacementEntityHasFlag) {
            globalThis.KDEntityHasFlag = originalEntityHasFlag;
          }
        }
      } finally {
        if (hadCollectionEntry) {
          KDGameData.Collection[collectionKey] = savedCollectionEntry;
        } else {
          delete KDGameData.Collection[collectionKey];
        }
        if (hadPlayerFlag) {
          KinkyDungeonFlags.set("imprisoned", savedPlayerFlag);
        } else {
          KinkyDungeonFlags.delete("imprisoned");
        }
        if (globalThis.KDBoundEffects === candidate) {
          globalThis.KDBoundEffects = official;
        }
        restore();
      }

      return {
        cases,
        dependencyFallback,
        nestedDependencyFallback,
        stats,
        passed:
          cases.every((entry) => entry.matches) &&
          dependencyFallback?.result === 4 &&
          dependencyFallback?.replacementCalls > 0 &&
          dependencyFallback?.compatibilityFallbacks === 1 &&
          nestedDependencyFallback?.result === 4 &&
          nestedDependencyFallback?.replacementCalls > 0 &&
          nestedDependencyFallback?.compatibilityFallbacks === 1
      };
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baseline: baselineVerification.stats,
      optimized: optimizedVerification.stats
    },
    compatibility,
    samples
  };
}

function createBoundEffectsFastNegativeCandidate(official, stats = null) {
  const dependencies = {
    isImprisoned: globalThis.KDIsImprisoned,
    entityHasFlag: globalThis.KDEntityHasFlag,
    enemyHasFlag: globalThis.KDEnemyHasFlag,
    collectionHasFlag: globalThis.KDCollHasFlag
  };
  if (stats === null) {
    return function KDBoundEffectsFastNegative(enemy) {
      if (
        globalThis.KDIsImprisoned !== dependencies.isImprisoned ||
        globalThis.KDEntityHasFlag !== dependencies.entityHasFlag ||
        globalThis.KDEnemyHasFlag !== dependencies.enemyHasFlag ||
        globalThis.KDCollHasFlag !== dependencies.collectionHasFlag
      ) {
        return Reflect.apply(official, this, arguments);
      }
      if (!enemy.Enemy.bound) return 0;
      if (!enemy.boundLevel) {
        if (enemy.player) {
          if (!(KinkyDungeonFlags.get("imprisoned") > 0)) return 0;
        } else {
          const localFlag = enemy.flags?.imprisoned;
          if (!(localFlag > 0 || localFlag == -1)) {
            const collectionFlag =
              KDGameData.Collection[String(enemy.id)]?.flags?.imprisoned;
            if (!(collectionFlag > 0 || collectionFlag == -1)) return 0;
          }
        }
      }
      return Reflect.apply(official, this, arguments);
    };
  }
  return function KDBoundEffectsFastNegativeDiagnostic(enemy) {
    stats.calls += 1;
    if (
      globalThis.KDIsImprisoned !== dependencies.isImprisoned ||
      globalThis.KDEntityHasFlag !== dependencies.entityHasFlag ||
      globalThis.KDEnemyHasFlag !== dependencies.enemyHasFlag ||
      globalThis.KDCollHasFlag !== dependencies.collectionHasFlag
    ) {
      stats.compatibilityFallbacks += 1;
      stats.officialCalls += 1;
      return Reflect.apply(official, this, arguments);
    }
    if (!enemy.Enemy.bound) {
      stats.fastReturns += 1;
      stats.incapableFastReturns += 1;
      return 0;
    }
    if (!enemy.boundLevel) {
      if (enemy.player) {
        if (!(KinkyDungeonFlags.get("imprisoned") > 0)) {
          stats.fastReturns += 1;
          stats.unboundFastReturns += 1;
          return 0;
        }
      } else {
        const localFlag = enemy.flags?.imprisoned;
        if (!(localFlag > 0 || localFlag == -1)) {
          const collectionFlag =
            KDGameData.Collection[String(enemy.id)]?.flags?.imprisoned;
          if (!(collectionFlag > 0 || collectionFlag == -1)) {
            stats.fastReturns += 1;
            stats.unboundFastReturns += 1;
            return 0;
          }
        }
      }
    }
    stats.officialCalls += 1;
    return Reflect.apply(official, this, arguments);
  };
}

async function benchmarkInlineEventMapCheck(
  client,
  sampleCount,
  turnsPerSample,
  checkCompatibility = true
) {
  const samples = [];
  let referenceInitialState = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const install =
          ${installInlineEventMapCheckCandidates.toString()};
        const firstInitial = restore();
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        const stats = ${diagnostic}
          ? { directChecks: 0, fallbackChecks: 0 }
          : null;
        const installed = ${optimized}
          ? install(stats, ${checkCompatibility})
          : null;
        try {
          run(3);
          const initial = restore();
          if (initial.stateSignature !== firstInitial.stateSignature) {
            throw new Error(
              "Inline event-map warm-up changed fixture restore"
            );
          }
          if (stats !== null) {
            stats.directChecks = 0;
            stats.fallbackChecks = 0;
          }
          return {
            initial,
            stats,
            installedNames: installed?.names ?? [],
            run: run(${turnsPerSample})
          };
        } finally {
          installed?.restore();
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Inline event-map fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const compatibility = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const install =
        ${installInlineEventMapCheckCandidates.toString()};
      const originalMapHasEvent = globalThis.KDMapHasEvent;
      const runWithReplacement = (optimized) => {
        restore();
        const stats = { directChecks: 0, fallbackChecks: 0 };
        const installed = optimized
          ? install(stats, ${checkCompatibility})
          : null;
        let replacementCalls = 0;
        const replacement = function (...args) {
          replacementCalls += 1;
          return Reflect.apply(originalMapHasEvent, this, args);
        };
        globalThis.KDMapHasEvent = replacement;
        try {
          const result = run(1);
          return {
            stateSignature: result.stateSignature,
            replacementCalls,
            stats
          };
        } finally {
          if (globalThis.KDMapHasEvent === replacement) {
            globalThis.KDMapHasEvent = originalMapHasEvent;
          }
          installed?.restore();
        }
      };
      let publicReplacementTookControl = false;
      let directInstall;
      try {
        const baseline = runWithReplacement(false);
        const optimized = runWithReplacement(true);
        restore();
        directInstall = install(
          {
            directChecks: 0,
            fallbackChecks: 0
          },
          ${checkCompatibility}
        );
        const targetName = "KinkyDungeonSendMagicEvent";
        const publicReplacement = function () {
          publicReplacementTookControl = true;
          return "replacement";
        };
        globalThis[targetName] = publicReplacement;
        publicReplacementTookControl =
          globalThis[targetName]() === "replacement" &&
          publicReplacementTookControl;
        return {
          baseline,
          optimized,
          installedNames: directInstall.names,
          publicReplacementTookControl,
          passed:
            baseline.stateSignature === optimized.stateSignature &&
            baseline.replacementCalls > 0 &&
            ${
              checkCompatibility
                ? `optimized.replacementCalls === baseline.replacementCalls &&
            optimized.stats.directChecks === 0 &&
            optimized.stats.fallbackChecks > 0`
                : `optimized.replacementCalls === 0 &&
            optimized.stats.directChecks > 0 &&
            optimized.stats.fallbackChecks === 0`
            } &&
            directInstall.names.length === 12 &&
            publicReplacementTookControl
        };
      } finally {
        if (directInstall) {
          const magic = directInstall.entries.find(
            (entry) => entry.name === "KinkyDungeonSendMagicEvent"
          );
          if (
            magic &&
            globalThis.KinkyDungeonSendMagicEvent !== magic.candidate
          ) {
            globalThis.KinkyDungeonSendMagicEvent = magic.candidate;
          }
          directInstall.restore();
        }
        globalThis.KDMapHasEvent = originalMapHasEvent;
        restore();
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    safety: checkCompatibility
      ? "identity-guarded-map-helper"
      : "unchecked-upper-bound",
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      optimized: optimizedVerification.stats,
      installedNames: optimizedVerification.installedNames
    },
    compatibility,
    samples
  };
}

function installInlineEventMapCheckCandidates(
  stats = null,
  checkCompatibility = true
) {
  const specifications = [
    ["KinkyDungeonSendWeaponEvent", "KDEventMapWeapon", "Event"],
    ["KinkyDungeonSendBulletEvent", "KDEventMapBullet", "Event"],
    ["KinkyDungeonHandleGenericEvent", "KDEventMapGeneric", "Event"],
    ["KinkyDungeonSendAltEvent", "KDEventMapAlt", "Event"],
    ["KinkyDungeonSendFacilityEvent", "KDEventMapFacility", "Event"],
    ["KinkyDungeonSendBuffEvent", "KDEventMapBuff", "event"],
    ["KinkyDungeonSendMagicEvent", "KDEventMapSpell", "Event"],
    ["KinkyDungeonSendEnemyEvent", "KDEventMapEnemy", "Event"],
    ["KinkyDungeonSendInventoryEvent", "KDEventMapInventory", "Event"],
    [
      "KinkyDungeonSendInventorySelectedEvent",
      "KDEventMapInventorySelected",
      "Event"
    ],
    [
      "KinkyDungeonSendInventoryIconEvent",
      "KDEventMapInventoryIcon",
      "Event"
    ],
    ["KinkyDungeonSendOutfitEvent", "KDEventMapOutfit", "Event"]
  ];
  const capturedMapHasEvent = globalThis.KDMapHasEvent;
  if (typeof capturedMapHasEvent !== "function") {
    throw new Error("KDMapHasEvent is unavailable");
  }
  const entries = [];
  try {
    for (const [name, mapName, eventName] of specifications) {
      const original = globalThis[name];
      if (typeof original !== "function") {
        throw new Error(`${name} is unavailable`);
      }
      const source = Function.prototype.toString.call(original);
      const needle = `KDMapHasEvent(${mapName}, ${eventName})`;
      if (source.split(needle).length !== 2) {
        throw new Error(
          `${name} did not contain exactly one expected map check`
        );
      }
      const direct =
        stats === null
          ? `(${mapName}[${eventName}] != undefined)`
          : `(probeStats.directChecks += 1, ` +
            `${mapName}[${eventName}] != undefined)`;
      const fallback =
        stats === null
          ? `KDMapHasEvent(${mapName}, ${eventName})`
          : `(probeStats.fallbackChecks += 1, ` +
            `KDMapHasEvent(${mapName}, ${eventName}))`;
      const replacement = checkCompatibility
        ? `(globalThis.KDMapHasEvent === capturedMapHasEvent ` +
          `? ${direct} : ${fallback})`
        : direct;
      const patchedSource = source.replace(needle, replacement);
      const factory = Function(
        "capturedMapHasEvent",
        "probeStats",
        `"use strict"; return (${patchedSource});`
      );
      const candidate = factory(capturedMapHasEvent, stats);
      if (typeof candidate !== "function") {
        throw new Error(`${name} candidate did not compile`);
      }
      entries.push({ name, original, candidate });
      globalThis[name] = candidate;
    }
  } catch (error) {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (globalThis[entry.name] === entry.candidate) {
        globalThis[entry.name] = entry.original;
      }
    }
    throw error;
  }
  return {
    names: entries.map((entry) => entry.name),
    entries,
    restore() {
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (globalThis[entry.name] === entry.candidate) {
          globalThis[entry.name] = entry.original;
        }
      }
    }
  };
}

async function benchmarkMagicEventCacheGuard(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;

  const runMode = async (optimized, diagnostic = false) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createMagicEventCacheGuardCandidate.toString()};
        const initial = restore();
        const official = globalThis.KinkyDungeonSendMagicEvent;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonSendMagicEvent is unavailable");
        }
        const stats = ${diagnostic}
          ? {
              calls: 0,
              optimizedCalls: 0,
              fallbackCalls: 0,
              mapMisses: 0,
              cacheMisses: 0,
              cacheHits: 0,
              handlerCalls: 0
            }
          : null;
        const candidate = ${optimized}
          ? createCandidate(official, stats)
          : null;
        if (candidate !== null) {
          globalThis.KinkyDungeonSendMagicEvent = candidate;
        }
        try {
          return {
            initial,
            stats,
            run: run(${turnsPerSample})
          };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonSendMagicEvent === candidate
          ) {
            globalThis.KinkyDungeonSendMagicEvent = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Magic-event probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] =
        await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature
    });
  }

  const baselineVerification = await runMode(false, true);
  const optimizedVerification = await runMode(true, true);
  const compatibility = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const createCandidate =
        ${createMagicEventCacheGuardCandidate.toString()};
      const official = globalThis.KinkyDungeonSendMagicEvent;
      const stats = {
        calls: 0,
        optimizedCalls: 0,
        fallbackCalls: 0,
        mapMisses: 0,
        cacheMisses: 0,
        cacheHits: 0,
        handlerCalls: 0
      };
      const candidate = createCandidate(official, stats);
      const runCall = (selected, event, data) => {
        restore();
        globalThis.KinkyDungeonSendMagicEvent = selected;
        try {
          selected(event, data);
          return {
            cost: data.cost,
            playerBuffs: Object.keys(KinkyDungeonPlayerBuffs).sort()
          };
        } finally {
          if (globalThis.KinkyDungeonSendMagicEvent === selected) {
            globalThis.KinkyDungeonSendMagicEvent = official;
          }
        }
      };

      const baselinePositive = runCall(
        official,
        "beforeCalcMana",
        { cost: 10, spell: { active: true, passive: false } }
      );
      const beforePositive = { ...stats };
      const optimizedPositive = runCall(
        candidate,
        "beforeCalcMana",
        { cost: 10, spell: { active: true, passive: false } }
      );
      const positiveDelta = {
        calls: stats.calls - beforePositive.calls,
        optimizedCalls:
          stats.optimizedCalls - beforePositive.optimizedCalls,
        cacheHits: stats.cacheHits - beforePositive.cacheHits,
        handlerCalls:
          stats.handlerCalls - beforePositive.handlerCalls
      };

      const beforeNegative = { ...stats };
      runCall(candidate, "afterCalcMana", {});
      const negativeDelta = {
        calls: stats.calls - beforeNegative.calls,
        optimizedCalls:
          stats.optimizedCalls - beforeNegative.optimizedCalls,
        cacheMisses: stats.cacheMisses - beforeNegative.cacheMisses,
        handlerCalls:
          stats.handlerCalls - beforeNegative.handlerCalls
      };

      restore();
      const originalUpcast = globalThis.KDGetUpcast;
      let replacementCalls = 0;
      const replacement = function (...args) {
        replacementCalls += 1;
        return Reflect.apply(originalUpcast, this, args);
      };
      const beforeDependency = { ...stats };
      globalThis.KinkyDungeonSendMagicEvent = candidate;
      globalThis.KDGetUpcast = replacement;
      try {
        candidate("beforeCalcMana", {
          cost: 10,
          spell: { active: true, passive: false }
        });
      } finally {
        if (globalThis.KDGetUpcast === replacement) {
          globalThis.KDGetUpcast = originalUpcast;
        }
        if (globalThis.KinkyDungeonSendMagicEvent === candidate) {
          globalThis.KinkyDungeonSendMagicEvent = official;
        }
      }
      const dependencyDelta = {
        calls: stats.calls - beforeDependency.calls,
        fallbackCalls:
          stats.fallbackCalls - beforeDependency.fallbackCalls,
        replacementCalls
      };
      restore();

      return {
        baselinePositive,
        optimizedPositive,
        positiveDelta,
        negativeDelta,
        dependencyDelta,
        passed:
          JSON.stringify(baselinePositive) ===
            JSON.stringify(optimizedPositive) &&
          positiveDelta.calls === 1 &&
          positiveDelta.optimizedCalls === 1 &&
          positiveDelta.cacheHits === 1 &&
          positiveDelta.handlerCalls > 0 &&
          negativeDelta.calls === 1 &&
          negativeDelta.optimizedCalls === 1 &&
          negativeDelta.cacheMisses === 1 &&
          negativeDelta.handlerCalls === 0 &&
          dependencyDelta.calls === 1 &&
          dependencyDelta.fallbackCalls === 1 &&
          dependencyDelta.replacementCalls > 0
      };
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    fasterPairs: samples.filter((sample) => sample.speedup > 1).length,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification: {
      stateMatches:
        baselineVerification.run.stateSignature ===
        optimizedVerification.run.stateSignature,
      baselineStateSignature:
        baselineVerification.run.stateSignature,
      optimizedStateSignature:
        optimizedVerification.run.stateSignature,
      baseline: baselineVerification.stats,
      optimized: optimizedVerification.stats
    },
    compatibility,
    samples
  };
}

function createMagicEventCacheGuardCandidate(official, stats = null) {
  const dependencies = {
    mapHasEvent: globalThis.KDMapHasEvent,
    updateSpellCache: globalThis.KDUpdateSpellCache,
    entityBuffedStat: globalThis.KDEntityBuffedStat,
    getUpcast: globalThis.KDGetUpcast,
    handleMagicEvent: globalThis.KinkyDungeonHandleMagicEvent
  };
  if (stats === null) {
    return function KinkyDungeonSendMagicEventCacheGuardLean(
      Event,
      data,
      forceSpell
    ) {
      if (!KDMapHasEvent(KDEventMapSpell, Event)) return;
      KDUpdateSpellCache();
      const eventSpells = KDEventSpells.get(Event);
      if (!eventSpells || eventSpells.size === 0) return;

      let iteration = 0;
      let stack = true;
      const upcastLevel = KDEntityBuffedStat(
        KinkyDungeonPlayerEntity,
        "SpellEmpower"
      );
      while (stack && iteration < 100) {
        stack = false;
        for (let i = 0; i < KinkyDungeonSpellChoices.length; i++) {
          const spell =
            (KinkyDungeonSpells[KinkyDungeonSpellChoices[i]]
              ? KDGetUpcast(
                  KinkyDungeonSpells[KinkyDungeonSpellChoices[i]].name,
                  upcastLevel
                )
              : null) ||
            KinkyDungeonSpells[KinkyDungeonSpellChoices[i]];
          if (spell && spell.events && eventSpells.get(spell)) {
            for (const event of spell.events) {
              if (
                event.trigger == Event &&
                !event.always &&
                ((KinkyDungeonSpellChoicesToggle[i] &&
                  spell.type == "passive") ||
                  spell.type != "passive" ||
                  spell.name == forceSpell?.name)
              ) {
                if (
                  iteration ==
                  (event.delayedOrder ? event.delayedOrder : 0)
                ) {
                  KinkyDungeonHandleMagicEvent(
                    Event,
                    event,
                    spell,
                    data
                  );
                } else {
                  stack = true;
                }
              }
            }
          }
        }
        for (const spell of eventSpells.keys()) {
          if ((spell.passive || spell.mixedPassive) && spell.events) {
            for (const event of spell.events) {
              if (
                event.trigger == Event &&
                (spell.passive || event.always)
              ) {
                if (
                  iteration ==
                  (event.delayedOrder ? event.delayedOrder : 0)
                ) {
                  KinkyDungeonHandleMagicEvent(
                    Event,
                    event,
                    spell,
                    data
                  );
                } else {
                  stack = true;
                }
              }
            }
          }
        }
        iteration += 1;
      }
    };
  }
  return function KinkyDungeonSendMagicEventCacheGuard(
    Event,
    data,
    forceSpell
  ) {
    if (stats !== null) stats.calls += 1;
    if (!KDMapHasEvent(KDEventMapSpell, Event)) {
      if (stats !== null) stats.mapMisses += 1;
      return;
    }
    if (
      globalThis.KDMapHasEvent !== dependencies.mapHasEvent ||
      globalThis.KDUpdateSpellCache !== dependencies.updateSpellCache ||
      globalThis.KDEntityBuffedStat !== dependencies.entityBuffedStat ||
      globalThis.KDGetUpcast !== dependencies.getUpcast ||
      globalThis.KinkyDungeonHandleMagicEvent !==
        dependencies.handleMagicEvent
    ) {
      if (stats !== null) stats.fallbackCalls += 1;
      return Reflect.apply(official, this, arguments);
    }
    if (stats !== null) stats.optimizedCalls += 1;
    KDUpdateSpellCache();
    const eventSpells = KDEventSpells.get(Event);
    if (!eventSpells || eventSpells.size === 0) {
      if (stats !== null) stats.cacheMisses += 1;
      return;
    }
    if (stats !== null) stats.cacheHits += 1;

    let iteration = 0;
    let stack = true;
    const upcastLevel = KDEntityBuffedStat(
      KinkyDungeonPlayerEntity,
      "SpellEmpower"
    );
    while (stack && iteration < 100) {
      stack = false;
      for (let i = 0; i < KinkyDungeonSpellChoices.length; i++) {
        const spell =
          (KinkyDungeonSpells[KinkyDungeonSpellChoices[i]]
            ? KDGetUpcast(
                KinkyDungeonSpells[KinkyDungeonSpellChoices[i]].name,
                upcastLevel
              )
            : null) ||
          KinkyDungeonSpells[KinkyDungeonSpellChoices[i]];
        if (spell && spell.events && eventSpells.get(spell)) {
          for (const event of spell.events) {
            if (
              event.trigger == Event &&
              !event.always &&
              ((KinkyDungeonSpellChoicesToggle[i] &&
                spell.type == "passive") ||
                spell.type != "passive" ||
                spell.name == forceSpell?.name)
            ) {
              if (
                iteration ==
                (event.delayedOrder ? event.delayedOrder : 0)
              ) {
                if (stats !== null) stats.handlerCalls += 1;
                KinkyDungeonHandleMagicEvent(
                  Event,
                  event,
                  spell,
                  data
                );
              } else {
                stack = true;
              }
            }
          }
        }
      }
      for (const spell of eventSpells.keys()) {
        if ((spell.passive || spell.mixedPassive) && spell.events) {
          for (const event of spell.events) {
            if (
              event.trigger == Event &&
              (spell.passive || event.always)
            ) {
              if (
                iteration ==
                (event.delayedOrder ? event.delayedOrder : 0)
              ) {
                if (stats !== null) stats.handlerCalls += 1;
                KinkyDungeonHandleMagicEvent(
                  Event,
                  event,
                  spell,
                  data
                );
              } else {
                stack = true;
              }
            }
          }
        }
      }
      iteration += 1;
    }
  };
}

async function benchmarkEventDispatchFastPath(
  client,
  sampleCount,
  turnsPerSample,
  checkCompatibility = true
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createEventDispatchProbeCandidate.toString()};
        const initial = restore();
        const official = globalThis.KinkyDungeonSendEvent;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonSendEvent is unavailable");
        }
        const candidate = ${
          optimized
            ? `createCandidate(official, null, ${checkCompatibility})`
            : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonSendEvent = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonSendEvent === candidate
          ) {
            globalThis.KinkyDungeonSendEvent = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Event probe fixture restore changed its initial state");
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createEventDispatchProbeCandidate.toString()};
      restore();
      const official = globalThis.KinkyDungeonSendEvent;
      const stats = {
        calls: 0,
        optimizedCalls: 0,
        fallbackCalls: 0,
        dispatched: {
          spell: 0,
          weapon: 0,
          inventorySelected: 0,
          inventoryIcon: 0,
          inventory: 0,
          npcRestraint: 0,
          bullet: 0,
          buff: 0,
          outfit: 0,
          enemy: 0,
          generic: 0,
          alt: 0,
          facility: 0
        },
        skippedNoHandler: 0
      };
      const candidate = createCandidate(
        official,
        stats,
        ${checkCompatibility}
      );
      globalThis.KinkyDungeonSendEvent = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonSendEvent === candidate) {
          globalThis.KinkyDungeonSendEvent = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createEventDispatchProbeCandidate(
  official,
  stats = null,
  checkCompatibility = true
) {
  const dependencies = {
    mapHasEvent: globalThis.KDMapHasEvent,
    spell: globalThis.KinkyDungeonSendMagicEvent,
    weapon: globalThis.KinkyDungeonSendWeaponEvent,
    inventorySelected: globalThis.KinkyDungeonSendInventorySelectedEvent,
    inventoryIcon: globalThis.KinkyDungeonSendInventoryIconEvent,
    inventory: globalThis.KinkyDungeonSendInventoryEvent,
    npcRestraint: globalThis.KDSendNPCRestraintEvent,
    bullet: globalThis.KinkyDungeonSendBulletEvent,
    buff: globalThis.KinkyDungeonSendBuffEvent,
    outfit: globalThis.KinkyDungeonSendOutfitEvent,
    enemy: globalThis.KinkyDungeonSendEnemyEvent,
    generic: globalThis.KinkyDungeonHandleGenericEvent,
    alt: globalThis.KinkyDungeonSendAltEvent,
    facility: globalThis.KinkyDungeonSendFacilityEvent
  };
  const compatible = () =>
    globalThis.KDMapHasEvent === dependencies.mapHasEvent &&
    globalThis.KinkyDungeonSendMagicEvent === dependencies.spell &&
    globalThis.KinkyDungeonSendWeaponEvent === dependencies.weapon &&
    globalThis.KinkyDungeonSendInventorySelectedEvent ===
      dependencies.inventorySelected &&
    globalThis.KinkyDungeonSendInventoryIconEvent ===
      dependencies.inventoryIcon &&
    globalThis.KinkyDungeonSendInventoryEvent === dependencies.inventory &&
    globalThis.KDSendNPCRestraintEvent === dependencies.npcRestraint &&
    globalThis.KinkyDungeonSendBulletEvent === dependencies.bullet &&
    globalThis.KinkyDungeonSendBuffEvent === dependencies.buff &&
    globalThis.KinkyDungeonSendOutfitEvent === dependencies.outfit &&
    globalThis.KinkyDungeonSendEnemyEvent === dependencies.enemy &&
    globalThis.KinkyDungeonHandleGenericEvent === dependencies.generic &&
    globalThis.KinkyDungeonSendAltEvent === dependencies.alt &&
    globalThis.KinkyDungeonSendFacilityEvent === dependencies.facility;

  return function KinkyDungeonSendEventProbe(
    Event,
    data,
    forceSpell,
    forceWeapon,
    mapData
  ) {
    if (stats !== null) stats.calls += 1;
    if (checkCompatibility && !compatible()) {
      if (stats !== null) stats.fallbackCalls += 1;
      return official(Event, data, forceSpell, forceWeapon, mapData);
    }
    if (stats !== null) stats.optimizedCalls += 1;

    if (KDEventMapSpell[Event] !== undefined) {
      if (stats !== null) stats.dispatched.spell += 1;
      KinkyDungeonSendMagicEvent(Event, data, forceSpell);
    } else if (stats !== null) {
      stats.skippedNoHandler += 1;
    }
    if (forceWeapon || KDEventMapWeapon[Event] !== undefined) {
      if (stats !== null) stats.dispatched.weapon += 1;
      KinkyDungeonSendWeaponEvent(Event, data, forceWeapon);
    } else if (stats !== null) {
      stats.skippedNoHandler += 1;
    }
    if (KDEventMapInventorySelected[Event] !== undefined) {
      if (stats !== null) stats.dispatched.inventorySelected += 1;
      KinkyDungeonSendInventorySelectedEvent(Event, data);
    } else if (stats !== null) {
      stats.skippedNoHandler += 1;
    }
    if (KDEventMapInventoryIcon[Event] !== undefined) {
      if (stats !== null) stats.dispatched.inventoryIcon += 1;
      KinkyDungeonSendInventoryIconEvent(Event, data);
    } else if (stats !== null) {
      stats.skippedNoHandler += 1;
    }
    if (KDEventMapInventory[Event] !== undefined) {
      if (stats !== null) stats.dispatched.inventory += 1;
      KinkyDungeonSendInventoryEvent(Event, data);
    } else if (stats !== null) {
      stats.skippedNoHandler += 1;
    }
    if (data.NPCRestraintEvents) {
      if (stats !== null) stats.dispatched.npcRestraint += 1;
      KDSendNPCRestraintEvent(Event, data);
    }
    if (KDEventMapBullet[Event] !== undefined) {
      if (stats !== null) stats.dispatched.bullet += 1;
      KinkyDungeonSendBulletEvent(Event, data.bullet, data);
    } else if (stats !== null) {
      stats.skippedNoHandler += 1;
    }
    if (KDEventMapBuff[Event] !== undefined) {
      if (stats !== null) stats.dispatched.buff += 1;
      KinkyDungeonSendBuffEvent(Event, data);
    } else if (stats !== null) {
      stats.skippedNoHandler += 1;
    }
    if (KDEventMapOutfit[Event] !== undefined) {
      if (stats !== null) stats.dispatched.outfit += 1;
      KinkyDungeonSendOutfitEvent(Event, data);
    } else if (stats !== null) {
      stats.skippedNoHandler += 1;
    }
    if (
      (mapData != undefined && mapData != KDMapData) ||
      KDEventMapEnemy[Event] !== undefined
    ) {
      if (stats !== null) stats.dispatched.enemy += 1;
      KinkyDungeonSendEnemyEvent(Event, data, mapData);
    } else if (stats !== null) {
      stats.skippedNoHandler += 1;
    }
    if (KDEventMapGeneric[Event] !== undefined) {
      if (stats !== null) stats.dispatched.generic += 1;
      KinkyDungeonHandleGenericEvent(Event, data);
    } else if (stats !== null) {
      stats.skippedNoHandler += 1;
    }
    if (KDEventMapAlt[Event] !== undefined) {
      if (stats !== null) stats.dispatched.alt += 1;
      KinkyDungeonSendAltEvent(Event, data);
    } else if (stats !== null) {
      stats.skippedNoHandler += 1;
    }
    if (KDEventMapFacility[Event] !== undefined) {
      if (stats !== null) stats.dispatched.facility += 1;
      KinkyDungeonSendFacilityEvent(Event, data);
    } else if (stats !== null) {
      stats.skippedNoHandler += 1;
    }
  };
}

async function benchmarkInventorySnapshotFastPath(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidates = ${createInventorySnapshotProbeCandidates.toString()};
        const initial = restore();
        const officialWeapon = globalThis.KinkyDungeonAllWeapon;
        const officialConsumable = globalThis.KinkyDungeonAllConsumable;
        if (
          typeof officialWeapon !== "function" ||
          typeof officialConsumable !== "function"
        ) {
          throw new Error("KD inventory snapshot globals are unavailable");
        }
        const candidates = ${
          optimized
            ? "createCandidates(officialWeapon, officialConsumable)"
            : "null"
        };
        if (candidates !== null) {
          globalThis.KinkyDungeonAllWeapon = candidates.weapon;
          globalThis.KinkyDungeonAllConsumable = candidates.consumable;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidates !== null &&
            globalThis.KinkyDungeonAllWeapon === candidates.weapon
          ) {
            globalThis.KinkyDungeonAllWeapon = officialWeapon;
          }
          if (
            candidates !== null &&
            globalThis.KinkyDungeonAllConsumable === candidates.consumable
          ) {
            globalThis.KinkyDungeonAllConsumable = officialConsumable;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Inventory snapshot probe fixture restore changed its initial state"
      );
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidates = ${createInventorySnapshotProbeCandidates.toString()};
      restore();
      const officialWeapon = globalThis.KinkyDungeonAllWeapon;
      const officialConsumable = globalThis.KinkyDungeonAllConsumable;
      const stats = {
        weaponCalls: 0,
        weaponBuilds: 0,
        weaponHits: 0,
        consumableCalls: 0,
        consumableBuilds: 0,
        consumableHits: 0,
        fallbacks: 0
      };
      const candidates = createCandidates(
        officialWeapon,
        officialConsumable,
        stats
      );
      globalThis.KinkyDungeonAllWeapon = candidates.weapon;
      globalThis.KinkyDungeonAllConsumable = candidates.consumable;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonAllWeapon === candidates.weapon) {
          globalThis.KinkyDungeonAllWeapon = officialWeapon;
        }
        if (globalThis.KinkyDungeonAllConsumable === candidates.consumable) {
          globalThis.KinkyDungeonAllConsumable = officialConsumable;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createInventorySnapshotProbeCandidates(
  officialWeapon,
  officialConsumable,
  stats = null
) {
  let weaponMap = null;
  let weaponSize = -1;
  let weaponItems = [];
  let consumableMap = null;
  let consumableSize = -1;
  let consumableItems = [];

  return {
    weapon: function KinkyDungeonAllWeaponSnapshotProbe() {
      if (stats !== null) stats.weaponCalls += 1;
      const map = KinkyDungeonInventory.get(Weapon);
      if (!(map instanceof Map)) {
        if (stats !== null) stats.fallbacks += 1;
        return officialWeapon();
      }
      if (map !== weaponMap || map.size !== weaponSize) {
        weaponMap = map;
        weaponSize = map.size;
        weaponItems = officialWeapon();
        if (stats !== null) stats.weaponBuilds += 1;
      } else if (stats !== null) {
        stats.weaponHits += 1;
      }
      return weaponItems.slice();
    },
    consumable: function KinkyDungeonAllConsumableSnapshotProbe() {
      if (stats !== null) stats.consumableCalls += 1;
      const map = KinkyDungeonInventory.get(Consumable);
      if (!(map instanceof Map)) {
        if (stats !== null) stats.fallbacks += 1;
        return officialConsumable();
      }
      if (map !== consumableMap || map.size !== consumableSize) {
        consumableMap = map;
        consumableSize = map.size;
        consumableItems = officialConsumable();
        if (stats !== null) stats.consumableBuilds += 1;
      } else if (stats !== null) {
        stats.consumableHits += 1;
      }
      return consumableItems.slice();
    }
  };
}

async function benchmarkRestraintSnapshotUpperBound(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createRestraintSnapshotUpperBoundCandidate.toString()};
        const initial = restore();
        const official = globalThis.KinkyDungeonAllRestraint;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonAllRestraint is unavailable");
        }
        const stats = ${
          optimized
            ? `{
                calls: 0,
                builds: 0,
                hits: 0,
                fallbacks: 0,
                sharedReturns: 0,
                exactMatches: 0,
                mismatches: 0
              }`
            : "null"
        };
        const candidate = ${
          optimized ? "createCandidate(official, stats, false)" : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonAllRestraint = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonAllRestraint === candidate
          ) {
            globalThis.KinkyDungeonAllRestraint = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Restraint snapshot probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createRestraintSnapshotUpperBoundCandidate.toString()};
      restore();
      const official = globalThis.KinkyDungeonAllRestraint;
      const stats = {
        calls: 0,
        builds: 0,
        hits: 0,
        fallbacks: 0,
        sharedReturns: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KinkyDungeonAllRestraint = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonAllRestraint === candidate) {
          globalThis.KinkyDungeonAllRestraint = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    safety: "upper-bound-only-shared-array",
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createRestraintSnapshotUpperBoundCandidate(
  official,
  stats = null,
  verify = false
) {
  let restraintMap = null;
  let restraintSize = -1;
  let restraintItems = [];

  return function KinkyDungeonAllRestraintSnapshotUpperBoundProbe() {
    if (stats !== null) stats.calls += 1;
    const map = KinkyDungeonInventory.get(Restraint);
    if (!(map instanceof Map)) {
      if (stats !== null) stats.fallbacks += 1;
      return Reflect.apply(official, this, arguments);
    }
    if (map !== restraintMap || map.size !== restraintSize) {
      restraintMap = map;
      restraintSize = map.size;
      restraintItems = Reflect.apply(official, this, arguments);
      if (stats !== null) stats.builds += 1;
    } else if (stats !== null) {
      stats.hits += 1;
    }
    if (verify && stats !== null) {
      const expected = Reflect.apply(official, this, arguments);
      const exact =
        expected.length === restraintItems.length &&
        expected.every((item, index) => item === restraintItems[index]);
      if (exact) stats.exactMatches += 1;
      else stats.mismatches += 1;
    }
    if (stats !== null) stats.sharedReturns += 1;
    return restraintItems;
  };
}

async function benchmarkTileGetLocalUpperBound(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createTileGetLocalUpperBoundCandidate.toString()};
        const initial = restore();
        const official = globalThis.KinkyDungeonTilesGet;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonTilesGet is unavailable");
        }
        const candidate = ${
          optimized ? "createCandidate(official)" : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonTilesGet = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonTilesGet === candidate
          ) {
            globalThis.KinkyDungeonTilesGet = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Tile-get probe fixture restore changed its initial state"
      );
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createTileGetLocalUpperBoundCandidate.toString()};
      restore();
      const official = globalThis.KinkyDungeonTilesGet;
      const stats = {
        calls: 0,
        mapIdentityChanges: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KinkyDungeonTilesGet = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonTilesGet === candidate) {
          globalThis.KinkyDungeonTilesGet = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    safety: "upper-bound-only-captured-tile-map",
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createTileGetLocalUpperBoundCandidate(
  official,
  stats = null,
  verify = false
) {
  const tiles = KDMapData.Tiles;
  return function KinkyDungeonTilesGetLocalUpperBoundProbe(location) {
    const result = tiles[location];
    if (stats !== null) {
      stats.calls += 1;
      if (KDMapData.Tiles !== tiles) stats.mapIdentityChanges += 1;
      if (verify) {
        const expected = Reflect.apply(official, this, arguments);
        if (Object.is(result, expected)) stats.exactMatches += 1;
        else stats.mismatches += 1;
      }
    }
    return result;
  };
}

async function benchmarkJailKeyEarlyReturn(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createJailKeyEarlyReturnCandidate.toString()};
        const initial = restore();
        const official = globalThis.KinkyDungeonPlaceJailKeys;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonPlaceJailKeys is unavailable");
        }
        const stats = ${
          optimized
            ? "{ calls: 0, skippedScans: 0, officialCalls: 0, fallbacks: 0 }"
            : "null"
        };
        const candidate = ${
          optimized ? "createCandidate(official, stats)" : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonPlaceJailKeys = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonPlaceJailKeys === candidate
          ) {
            globalThis.KinkyDungeonPlaceJailKeys = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Jail-key probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    samples
  };
}

function createJailKeyEarlyReturnCandidate(official, stats = null) {
  return function KinkyDungeonPlaceJailKeysEarlyReturnProbe() {
    if (stats !== null) stats.calls += 1;
    const groundItems = KDMapData?.GroundItems;
    if (!Array.isArray(groundItems) || !Number.isFinite(KDMaxKeys)) {
      if (stats !== null) {
        stats.fallbacks += 1;
        stats.officialCalls += 1;
      }
      return Reflect.apply(official, this, arguments);
    }
    let keyCount = 0;
    for (let index = 0; index < groundItems.length; index += 1) {
      if (groundItems[index]?.name === "Keyring") {
        keyCount += 1;
        if (keyCount >= KDMaxKeys) {
          if (stats !== null) stats.skippedScans += 1;
          return undefined;
        }
      }
    }
    if (stats !== null) stats.officialCalls += 1;
    return Reflect.apply(official, this, arguments);
  };
}

async function benchmarkEnemyAtLiveCacheUpperBound(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createEnemyAtLiveCacheUpperBoundCandidate.toString()};
        const initial = restore();
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        KDHybrid.enableSystem("pathfinding");
        KDHybrid.enableSystem("events");
        const official = globalThis.KinkyDungeonEnemyAt;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonEnemyAt is unavailable");
        }
        const candidate = ${
          optimized ? "createCandidate(official)" : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonEnemyAt = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonEnemyAt === candidate
          ) {
            globalThis.KinkyDungeonEnemyAt = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Enemy-at live-cache probe fixture restore changed its initial state"
      );
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createEnemyAtLiveCacheUpperBoundCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      KDHybrid.enableSystem("movement");
      KDHybrid.enableSystem("pathfinding");
      KDHybrid.enableSystem("events");
      const official = globalThis.KinkyDungeonEnemyAt;
      const stats = {
        calls: 0,
        fastCalls: 0,
        fallbackCalls: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KinkyDungeonEnemyAt = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonEnemyAt === candidate) {
          globalThis.KinkyDungeonEnemyAt = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    safety: "upper-bound-only-live-cache-direct-read",
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createEnemyAtLiveCacheUpperBoundCandidate(
  official,
  stats = null,
  verify = false
) {
  return function KinkyDungeonEnemyAtLiveCacheUpperBoundProbe(
    x,
    y,
    mapData
  ) {
    if (stats !== null) stats.calls += 1;
    const effectiveMap = mapData || KDMapData;
    if (
      effectiveMap === KDMapData &&
      !KDUpdateEnemyCache &&
      KDEnemyCache &&
      typeof KDEnemyCache.get === "function"
    ) {
      const result = KDEnemyCache.get(x + "," + y);
      if (stats !== null) {
        stats.fastCalls += 1;
        if (verify) {
          const expected = Reflect.apply(official, this, arguments);
          if (Object.is(result, expected)) stats.exactMatches += 1;
          else stats.mismatches += 1;
        }
      }
      return result;
    }
    if (stats !== null) stats.fallbackCalls += 1;
    return Reflect.apply(official, this, arguments);
  };
}

async function benchmarkEnemyCacheDedup(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createEnemyCacheDedupCandidate.toString()};
        const initial = restore();
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        KDHybrid.enableSystem("pathfinding");
        KDHybrid.enableSystem("events");
        const official = globalThis.KDGetEnemyCache;
        if (typeof official !== "function") {
          throw new Error("KDGetEnemyCache is unavailable");
        }
        const candidate = ${
          optimized ? "createCandidate(official)" : "null"
        };
        if (candidate !== null) {
          globalThis.KDGetEnemyCache = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidate !== null &&
            globalThis.KDGetEnemyCache === candidate
          ) {
            globalThis.KDGetEnemyCache = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Enemy-cache dedup probe fixture restore changed its initial state"
      );
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createEnemyCacheDedupCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      KDHybrid.enableSystem("movement");
      KDHybrid.enableSystem("pathfinding");
      KDHybrid.enableSystem("events");
      const official = globalThis.KDGetEnemyCache;
      const stats = {
        calls: 0,
        rebuilds: 0,
        entitiesVisited: 0,
        cacheWrites: 0,
        duplicateWritesSkipped: 0,
        eventEntries: 0,
        dependencyFallbacks: 0
      };
      const candidate = createCandidate(official, stats);
      globalThis.KDGetEnemyCache = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KDGetEnemyCache === candidate) {
          globalThis.KDGetEnemyCache = official;
        }
      }
    })()`,
    120_000
  );
  const compatibility = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const createCandidate =
        ${createEnemyCacheDedupCandidate.toString()};
      const official = globalThis.KDGetEnemyCache;
      const stats = {
        calls: 0,
        rebuilds: 0,
        entitiesVisited: 0,
        cacheWrites: 0,
        duplicateWritesSkipped: 0,
        eventEntries: 0,
        dependencyFallbacks: 0
      };
      const snapshot = (selected) => {
        globalThis.KDGetEnemyCache = official;
        restore();
        globalThis.KDGetEnemyCache = selected;
        KDUpdateEnemyCache = true;
        const result = selected();
        return {
          returnIsCache: result === KDEnemyCache,
          cache: Array.from(
            KDEnemyCache,
            ([key, enemy]) => [key, enemy?.id]
          ),
          events: Array.from(
            KDEnemyEventCache,
            ([event, ids]) => [event, Array.from(ids)]
          ),
          ids: Array.from(
            KDIDCache,
            ([id, enemy]) => [id, enemy?.id]
          )
        };
      };
      const candidate = createCandidate(official, stats);
      try {
        const baseline = snapshot(official);
        const optimized = snapshot(candidate);
        const mapSet = Map.prototype.set;
        let replacementCalls = 0;
        Map.prototype.set = function (...args) {
          replacementCalls += 1;
          return Reflect.apply(mapSet, this, args);
        };
        let replacementFallback;
        try {
          globalThis.KDGetEnemyCache = candidate;
          KDUpdateEnemyCache = true;
          replacementFallback = candidate();
        } finally {
          Map.prototype.set = mapSet;
        }
        return {
          exactSnapshot:
            JSON.stringify(baseline) === JSON.stringify(optimized),
          baseline,
          optimized,
          replacementFallbackIsCache:
            replacementFallback === KDEnemyCache,
          replacementCalls,
          stats
        };
      } finally {
        globalThis.KDGetEnemyCache = official;
        restore();
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    compatibility,
    samples
  };
}

function createEnemyCacheDedupCandidate(official, stats = null) {
  const mapSet = Map.prototype.set;
  return function KDGetEnemyCacheDedupProbe() {
    if (stats !== null) stats.calls += 1;
    if (KDUpdateEnemyCache || !KDEnemyCache) {
      if (Map.prototype.set !== mapSet) {
        if (stats !== null) stats.dependencyFallbacks += 1;
        return Reflect.apply(official, this, arguments);
      }
      if (stats !== null) stats.rebuilds += 1;
      KDUpdateEnemyCache = false;
      KDEnemyCache = new Map();
      KDEnemyEventCache = new Map();
      KDIDCache = new Map();
      for (const enemy of KDMapData.Entities) {
        if (stats !== null) stats.entitiesVisited += 1;
        KDEnemyCache.set(enemy.x + "," + enemy.y, enemy);
        if (stats !== null) {
          stats.cacheWrites += 1;
          stats.duplicateWritesSkipped += 1;
        }
        if (enemy.Enemy?.events) {
          for (const event of enemy.Enemy.events) {
            if (!KDEnemyEventCache.get(event.trigger)) {
              KDEnemyEventCache.set(event.trigger, new Map());
            }
            KDEnemyEventCache.get(event.trigger).set(enemy.id, true);
            if (stats !== null) stats.eventEntries += 1;
          }
        }
        KDIDCache.set(enemy.id, enemy);
      }
    }
    return KDEnemyCache;
  };
}

async function benchmarkWanderableCache(client, sampleCount, turnsPerSample) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createWanderableCacheCandidate.toString()};
        const initial = restore();
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        KDHybrid.enableSystem("pathfinding");
        KDHybrid.enableSystem("events");
        const official = globalThis.KDPointWanderable;
        if (typeof official !== "function") {
          throw new Error("KDPointWanderable is unavailable");
        }
        const stats = ${
          optimized
            ? `{
                calls: 0,
                cacheHits: 0,
                cacheMisses: 0,
                invalidations: 0,
                fallbackCalls: 0,
                dependencyChanges: 0
              }`
            : "null"
        };
        const candidate = ${
          optimized ? "createCandidate(official, stats)" : "null"
        };
        if (candidate !== null) {
          globalThis.KDPointWanderable = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KDPointWanderable === candidate
          ) {
            globalThis.KDPointWanderable = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Wanderable-cache probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate = ${createWanderableCacheCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      KDHybrid.enableSystem("movement");
      KDHybrid.enableSystem("pathfinding");
      KDHybrid.enableSystem("events");
      const official = globalThis.KDPointWanderable;
      const stats = {
        calls: 0,
        cacheHits: 0,
        cacheMisses: 0,
        invalidations: 0,
        fallbackCalls: 0,
        dependencyChanges: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KDPointWanderable = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KDPointWanderable === candidate) {
          globalThis.KDPointWanderable = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    safety: "generation-aware-main-map-cache-with-live-result-validation",
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createWanderableCacheCandidate(
  official,
  stats = null,
  verify = false
) {
  const entityAt = globalThis.KinkyDungeonEntityAt;
  const enemyHasFlag = globalThis.KDEnemyHasFlag;
  let loadedMap = null;
  let loadedPoints = null;
  let loadedGeneration;
  const entries = new Map();

  return function KDPointWanderableCacheProbe(x, y, mapData) {
    if (stats !== null) stats.calls += 1;
    const effectiveMap = mapData || KDMapData;
    if (
      effectiveMap !== KDMapData ||
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y) ||
      typeof entityAt !== "function" ||
      typeof enemyHasFlag !== "function" ||
      globalThis.KinkyDungeonEntityAt !== entityAt ||
      globalThis.KDEnemyHasFlag !== enemyHasFlag ||
      typeof effectiveMap.RandomPathablePoints !== "object" ||
      effectiveMap.RandomPathablePoints === null
    ) {
      if (stats !== null) {
        stats.fallbackCalls += 1;
        if (
          globalThis.KinkyDungeonEntityAt !== entityAt ||
          globalThis.KDEnemyHasFlag !== enemyHasFlag
        ) {
          stats.dependencyChanges += 1;
        }
      }
      return finish(
        Reflect.apply(official, this, arguments),
        this,
        arguments
      );
    }

    const points = effectiveMap.RandomPathablePoints;
    const generation = globalThis.__KDHybridEnemyCacheGeneration;
    if (
      Boolean(KDUpdateEnemyCache) ||
      effectiveMap !== loadedMap ||
      points !== loadedPoints ||
      generation !== loadedGeneration
    ) {
      if (entries.size > 0 && stats !== null) stats.invalidations += 1;
      entries.clear();
      loadedMap = effectiveMap;
      loadedPoints = points;
      loadedGeneration = generation;
    }

    const key = `${x},${y}`;
    const pathable = points[key] !== undefined;
    const cached = entries.get(key);
    let result;
    if (cached !== undefined && cached.pathable === pathable) {
      if (stats !== null) stats.cacheHits += 1;
      const enemy = cached.enemy;
      result = !(
        enemy &&
        !enemy.player &&
        Reflect.apply(enemyHasFlag, globalThis, [enemy, "tryNotToSwap"])
      ) && pathable;
    } else {
      if (stats !== null) stats.cacheMisses += 1;
      const enemy = Reflect.apply(entityAt, globalThis, [
        x,
        y,
        undefined,
        undefined,
        undefined,
        undefined,
        effectiveMap
      ]);
      result = !(
        enemy &&
        !enemy.player &&
        Reflect.apply(enemyHasFlag, globalThis, [enemy, "tryNotToSwap"])
      ) && pathable;
      entries.set(key, { enemy, pathable });
    }
    return finish(result, this, arguments);
  };

  function finish(result, thisArgument, args) {
    if (stats !== null && verify) {
      const expected = Reflect.apply(official, thisArgument, args);
      if (Object.is(result, expected)) stats.exactMatches += 1;
      else stats.mismatches += 1;
    }
    return result;
  }
}

async function benchmarkSmartMovableSingleGet(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createSmartMovableSingleGetCandidate.toString()};
        const initial = restore();
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        KDHybrid.enableSystem("pathfinding");
        KDHybrid.enableSystem("events");
        const official = globalThis.KDIsSmartMovable;
        if (typeof official !== "function") {
          throw new Error("KDIsSmartMovable is unavailable");
        }
        const stats = ${
          optimized
            ? `{
                calls: 0,
                cacheHits: 0,
                cacheMisses: 0
              }`
            : "null"
        };
        const candidate = ${
          optimized ? "createCandidate(official, stats)" : "null"
        };
        if (candidate !== null) {
          globalThis.KDIsSmartMovable = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KDIsSmartMovable === candidate
          ) {
            globalThis.KDIsSmartMovable = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Smart-movable probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createSmartMovableSingleGetCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      KDHybrid.enableSystem("movement");
      KDHybrid.enableSystem("pathfinding");
      KDHybrid.enableSystem("events");
      const official = globalThis.KDIsSmartMovable;
      const stats = {
        calls: 0,
        cacheHits: 0,
        cacheMisses: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KDIsSmartMovable = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KDIsSmartMovable === candidate) {
          globalThis.KDIsSmartMovable = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    safety: "same-cache-single-get-with-undefined-as-miss",
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createSmartMovableSingleGetCandidate(
  official,
  stats = null,
  verify = false
) {
  return function KDIsSmartMovableSingleGetProbe(x, y) {
    if (stats !== null) stats.calls += 1;
    const key = `${x},${y}`;
    const cached = KDSmartMovable.get(key);
    let result;
    if (cached !== undefined) {
      if (stats !== null) stats.cacheHits += 1;
      result = cached;
    } else {
      if (stats !== null) stats.cacheMisses += 1;
      result = KinkyDungeonMovableTilesSmartEnemy.includes(
        KinkyDungeonMapGet(x, y)
      );
      KDSmartMovable.set(key, result);
    }
    if (stats !== null && verify) {
      const expected = Reflect.apply(official, this, arguments);
      if (Object.is(result, expected)) stats.exactMatches += 1;
      else stats.mismatches += 1;
    }
    return result;
  };
}

async function benchmarkJailGuardCache(
  client,
  sampleCount,
  turnsPerSample
) {
  const runCandidate = async (candidateKind) => {
    const createCandidate =
      candidateKind === "constant"
        ? createJailGuardConstantUpperBoundCandidate
        : createJailGuardIdentityCacheCandidate;
    const samples = [];
    let referenceInitialState = null;
    const runMode = async (optimized) => {
      const measured = await client.evaluate(
        `(() => {
          const restore = ${restoreCrowdedFixture.toString()};
          const run = ${runCrowdedTurns.toString()};
          const createCandidate = ${createCandidate.toString()};
          const initial = restore();
          if (
            !KDHybrid.disableSystem(
              "ai",
              "jail-guard-cache-isolation"
            )
          ) {
            throw new Error(
              "Could not disable AI for jail-guard cache isolation"
            );
          }
          KDHybrid.enableSystem("movement");
          KDHybrid.enableSystem("pathfinding");
          KDHybrid.enableSystem("events");
          const official = globalThis.KinkyDungeonJailGuard;
          if (typeof official !== "function") {
            throw new Error("KinkyDungeonJailGuard is unavailable");
          }
          const candidate = ${
            optimized ? "createCandidate(official)" : "null"
          };
          if (candidate !== null) {
            globalThis.KinkyDungeonJailGuard = candidate;
          }
          try {
            return { initial, run: run(${turnsPerSample}) };
          } finally {
            if (
              candidate !== null &&
              globalThis.KinkyDungeonJailGuard === candidate
            ) {
              globalThis.KinkyDungeonJailGuard = official;
            }
            KDHybrid.enableSystem("ai");
          }
        })()`,
        120_000
      );
      referenceInitialState ??= measured.initial.stateSignature;
      if (measured.initial.stateSignature !== referenceInitialState) {
        throw new Error(
          "Jail-guard cache probe fixture restore changed its initial state"
        );
      }
      return measured.run;
    };

    await runMode(false);
    await runMode(true);
    for (let index = 0; index < sampleCount; index += 1) {
      const order = index % 2 === 0 ? [false, true] : [true, false];
      const pair = { baseline: null, optimized: null };
      for (const optimized of order) {
        pair[optimized ? "optimized" : "baseline"] =
          await runMode(optimized);
      }
      samples.push({
        baselineMilliseconds: pair.baseline.totalMilliseconds,
        optimizedMilliseconds: pair.optimized.totalMilliseconds,
        speedup:
          pair.baseline.totalMilliseconds /
          pair.optimized.totalMilliseconds,
        stateMatches:
          pair.baseline.stateSignature ===
          pair.optimized.stateSignature,
        baselineStateSignature: pair.baseline.stateSignature,
        optimizedStateSignature: pair.optimized.stateSignature
      });
    }

    const verification = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate = ${createCandidate.toString()};
        restore();
        if (
          !KDHybrid.disableSystem(
            "ai",
            "jail-guard-cache-isolation"
          )
        ) {
          throw new Error(
            "Could not disable AI for jail-guard cache isolation"
          );
        }
        KDHybrid.enableSystem("movement");
        KDHybrid.enableSystem("pathfinding");
        KDHybrid.enableSystem("events");
        const official = globalThis.KinkyDungeonJailGuard;
        const stats = {
          calls: 0,
          cacheHits: 0,
          cacheMisses: 0,
          fallbackCalls: 0,
          exactMatches: 0,
          mismatches: 0,
          initialId: null,
          initialWasNull: false
        };
        const candidate = createCandidate(official, stats, true);
        globalThis.KinkyDungeonJailGuard = candidate;
        try {
          const result = run(1);
          return { ...stats, stateSignature: result.stateSignature };
        } finally {
          if (globalThis.KinkyDungeonJailGuard === candidate) {
            globalThis.KinkyDungeonJailGuard = official;
          }
          KDHybrid.enableSystem("ai");
        }
      })()`,
      120_000
    );
    const baseline = samples.map(
      (sample) => sample.baselineMilliseconds
    );
    const optimized = samples.map(
      (sample) => sample.optimizedMilliseconds
    );
    const baselineMedianMilliseconds = median(baseline);
    const optimizedMedianMilliseconds = median(optimized);
    return {
      candidateKind,
      safety:
        candidateKind === "constant"
          ? "upper-bound-only-fixture-constant-jail-guard"
          : "signature-gated-id-and-live-id-cache-reference",
      sampleCount,
      turnsPerSample,
      initialStateSignature: referenceInitialState,
      baselineMedianMilliseconds,
      optimizedMedianMilliseconds,
      speedup: median(samples.map((sample) => sample.speedup)),
      ratioOfMedians:
        baselineMedianMilliseconds / optimizedMedianMilliseconds,
      allStatesMatch: samples.every((sample) => sample.stateMatches),
      verification,
      samples
    };
  };

  return {
    upperBound: await runCandidate("constant"),
    guarded: await runCandidate("guarded")
  };
}

function createJailGuardConstantUpperBoundCandidate(
  official,
  stats = null,
  verify = false
) {
  const cached = Reflect.apply(official, globalThis, []);
  if (stats !== null) {
    stats.initialId = KDGameData.JailGuard ?? null;
    stats.initialWasNull = cached === null || cached === undefined;
  }
  return function KinkyDungeonJailGuardConstantUpperBoundProbe(...args) {
    if (stats !== null) {
      stats.calls += 1;
      stats.cacheHits += 1;
      if (verify) {
        const expected = Reflect.apply(official, this, args);
        if (Object.is(cached, expected)) stats.exactMatches += 1;
        else stats.mismatches += 1;
      }
    }
    return cached;
  };
}

function createJailGuardIdentityCacheCandidate(
  official,
  stats = null,
  verify = false
) {
  let cachedId = null;
  let cachedIdCache = null;
  let cachedResult = null;
  if (stats !== null) {
    stats.initialId = KDGameData.JailGuard ?? null;
    stats.initialWasNull = !KDGameData.JailGuard;
  }

  return function KinkyDungeonJailGuardIdentityCacheProbe(...args) {
    if (stats !== null) stats.calls += 1;
    const id = KDGameData.JailGuard;
    if (!id) {
      if (stats !== null) stats.cacheHits += 1;
      return finish(null, this, args);
    }

    const currentIdCache = KDIDCache;
    if (
      cachedResult &&
      cachedId === id &&
      cachedIdCache === currentIdCache
    ) {
      if (stats !== null) stats.cacheHits += 1;
      return finish(cachedResult, this, args);
    }

    if (stats !== null) {
      stats.cacheMisses += 1;
      stats.fallbackCalls += 1;
    }
    const result = Reflect.apply(official, this, args);
    if (
      result &&
      currentIdCache === KDIDCache &&
      currentIdCache?.get(id) === result
    ) {
      cachedId = id;
      cachedIdCache = currentIdCache;
      cachedResult = result;
    } else {
      cachedId = null;
      cachedIdCache = null;
      cachedResult = null;
    }
    return finish(result, this, args);
  };

  function finish(result, thisArgument, args) {
    if (stats !== null && verify) {
      const expected = Reflect.apply(official, thisArgument, args);
      if (Object.is(result, expected)) stats.exactMatches += 1;
      else stats.mismatches += 1;
    }
    return result;
  }
}

async function benchmarkLeashingEnemyCache(
  client,
  sampleCount,
  turnsPerSample,
  candidateKind = "constant"
) {
  const createCandidate =
    candidateKind === "id-cache-fast-path"
      ? createLeashingEnemyIdCacheFastPathCandidate
      : candidateKind === "explicit-id-reference-cache"
        ? createLeashingEnemyReferenceCacheCandidate
        : candidateKind === "scoped-explicit-id-cache"
          ? createLeashingEnemyScopedCacheCandidate
        : createLeashingEnemyCacheUpperBoundCandidate;
  const restoreActiveLeashingId =
    candidateKind !== "constant";
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidate =
          ${createCandidate.toString()};
        const initial = restore();
        if (${restoreActiveLeashingId}) {
          const leashEntity = KDPlayer().leash?.entity;
          if (!leashEntity) {
            throw new Error(
              "Active-leash probe fixture has no player leash entity"
            );
          }
          KDGameData.KinkyDungeonLeashingEnemy = leashEntity;
          initial.stateSignature += ":active-leash:" + String(leashEntity);
        }
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        KDHybrid.enableSystem("pathfinding");
        KDHybrid.enableSystem("events");
        const official = globalThis.KinkyDungeonLeashingEnemy;
        if (typeof official !== "function") {
          throw new Error("KinkyDungeonLeashingEnemy is unavailable");
        }
        const stats = ${
          optimized
            ? `{
                calls: 0,
                cachedCalls: 0,
                fastCalls: 0,
                earlyNullCalls: 0,
                fallbackCalls: 0,
                dependencyChanges: 0,
                initialId: null,
                initialWasNull: false
              }`
            : "null"
        };
        const candidate = ${
          optimized ? "createCandidate(official, stats)" : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonLeashingEnemy = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}), stats };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonLeashingEnemy === candidate
          ) {
            globalThis.KinkyDungeonLeashingEnemy = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error(
        "Leashing-enemy cache probe fixture restore changed its initial state"
      );
    }
    return measured;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.run.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.run.totalMilliseconds,
      speedup:
        pair.baseline.run.totalMilliseconds /
        pair.optimized.run.totalMilliseconds,
      stateMatches:
        pair.baseline.run.stateSignature ===
        pair.optimized.run.stateSignature,
      baselineStateSignature: pair.baseline.run.stateSignature,
      optimizedStateSignature: pair.optimized.run.stateSignature,
      optimizedStats: pair.optimized.stats
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidate =
        ${createCandidate.toString()};
      restore();
      if (${restoreActiveLeashingId}) {
        const leashEntity = KDPlayer().leash?.entity;
        if (!leashEntity) {
          throw new Error(
            "Active-leash probe fixture has no player leash entity"
          );
        }
        KDGameData.KinkyDungeonLeashingEnemy = leashEntity;
      }
      KDHybrid.enableSystem("ai");
      KDHybrid.enableSystem("movement");
      KDHybrid.enableSystem("pathfinding");
      KDHybrid.enableSystem("events");
      const official = globalThis.KinkyDungeonLeashingEnemy;
      const stats = {
        calls: 0,
        cachedCalls: 0,
        fastCalls: 0,
        earlyNullCalls: 0,
        fallbackCalls: 0,
        dependencyChanges: 0,
        initialId: null,
        initialWasNull: false,
        exactMatches: 0,
        mismatches: 0,
        firstMismatchExpectedId: null,
        firstMismatchActualId: null
      };
      const candidate = createCandidate(official, stats, true);
      globalThis.KinkyDungeonLeashingEnemy = candidate;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonLeashingEnemy === candidate) {
          globalThis.KinkyDungeonLeashingEnemy = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    safety:
      candidateKind === "id-cache-fast-path"
        ? "dependency-guarded-live-id-cache-fast-path"
        : candidateKind === "explicit-id-reference-cache"
          ? "turn-scoped-signature-gated-explicit-id-reference-cache"
          : candidateKind === "scoped-explicit-id-cache"
            ? "enemy-update-scoped-id-and-cache-generation-guard"
        : "upper-bound-only-fixture-constant-leashing-enemy",
    candidateKind,
    fixtureAdjustment:
      restoreActiveLeashingId
        ? "restore-active-leashing-enemy-id-from-player-tether"
        : null,
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createLeashingEnemyCacheUpperBoundCandidate(
  official,
  stats = null,
  verify = false
) {
  const cached = Reflect.apply(official, globalThis, []);
  if (stats !== null) {
    stats.initialId = cached?.id ?? null;
    stats.initialWasNull = cached === null || cached === undefined;
  }
  return function KinkyDungeonLeashingEnemyCacheUpperBoundProbe(...args) {
    if (stats !== null) {
      stats.calls += 1;
      stats.cachedCalls += 1;
      if (verify) {
        const expected = Reflect.apply(official, this, args);
        if (Object.is(cached, expected)) {
          stats.exactMatches += 1;
        } else {
          stats.mismatches += 1;
          if (stats.mismatches === 1) {
            stats.firstMismatchExpectedId = expected?.id ?? null;
            stats.firstMismatchActualId = cached?.id ?? null;
          }
        }
      }
    }
    return cached;
  };
}

function createLeashingEnemyIdCacheFastPathCandidate(
  official,
  stats = null,
  verify = false
) {
  const playerFunction = globalThis.KDPlayer;
  const findIdFunction = globalThis.KinkyDungeonFindID;
  const idCache = KDIDCache;
  if (stats !== null) {
    stats.initialId = KDGameData.KinkyDungeonLeashingEnemy ?? null;
    stats.initialWasNull = false;
  }

  return function KinkyDungeonLeashingEnemyIdCacheFastPathProbe(...args) {
    if (stats !== null) stats.calls += 1;
    if (
      typeof playerFunction !== "function" ||
      typeof findIdFunction !== "function" ||
      globalThis.KDPlayer !== playerFunction ||
      globalThis.KinkyDungeonFindID !== findIdFunction ||
      KDIDCache !== idCache ||
      typeof idCache?.get !== "function"
    ) {
      if (stats !== null) {
        stats.fallbackCalls += 1;
        stats.dependencyChanges += 1;
      }
      return finish(
        Reflect.apply(official, this, args),
        this,
        args
      );
    }

    const player = Reflect.apply(playerFunction, globalThis, []);
    if (!player?.leash && !KDGameData.KinkyDungeonLeashedPlayer) {
      if (stats !== null) stats.earlyNullCalls += 1;
      return finish(null, this, args);
    }
    const id = KDGameData.KinkyDungeonLeashingEnemy;
    if (id) {
      const result = idCache.get(id);
      if (result) {
        if (stats !== null) stats.fastCalls += 1;
        return finish(result, this, args);
      }
    }

    if (stats !== null) stats.fallbackCalls += 1;
    return finish(
      Reflect.apply(official, this, args),
      this,
      args
    );
  };

  function finish(result, thisArgument, args) {
    if (stats !== null && verify) {
      const expected = Reflect.apply(official, thisArgument, args);
      if (Object.is(result, expected)) {
        stats.exactMatches += 1;
      } else {
        stats.mismatches += 1;
        if (stats.mismatches === 1) {
          stats.firstMismatchExpectedId = expected?.id ?? null;
          stats.firstMismatchActualId = result?.id ?? null;
        }
      }
    }
    return result;
  }
}

function createLeashingEnemyReferenceCacheCandidate(
  official,
  stats = null,
  verify = false
) {
  const playerFunction = globalThis.KDPlayer;
  const findIdFunction = globalThis.KinkyDungeonFindID;
  let cachedId = null;
  let cachedIdCache = null;
  let cachedResult = null;
  if (stats !== null) {
    stats.initialId = KDGameData.KinkyDungeonLeashingEnemy ?? null;
    stats.initialWasNull = false;
  }

  return function KinkyDungeonLeashingEnemyReferenceCacheProbe(...args) {
    if (stats !== null) stats.calls += 1;
    if (
      typeof playerFunction !== "function" ||
      typeof findIdFunction !== "function"
    ) {
      if (stats !== null) {
        stats.fallbackCalls += 1;
        stats.dependencyChanges += 1;
      }
      return finish(
        Reflect.apply(official, this, args),
        this,
        args
      );
    }

    const leashedPlayer = KDGameData.KinkyDungeonLeashedPlayer;
    if (
      !leashedPlayer &&
      !Reflect.apply(playerFunction, globalThis, [])?.leash
    ) {
      if (stats !== null) stats.earlyNullCalls += 1;
      return finish(null, this, args);
    }

    const id = KDGameData.KinkyDungeonLeashingEnemy;
    const currentIdCache = KDIDCache;
    if (
      id &&
      cachedResult &&
      id === cachedId &&
      currentIdCache === cachedIdCache
    ) {
      if (stats !== null) {
        stats.cachedCalls += 1;
        stats.fastCalls += 1;
      }
      return finish(cachedResult, this, args);
    }

    if (stats !== null) stats.fallbackCalls += 1;
    const result = Reflect.apply(official, this, args);
    if (
      id &&
      result &&
      currentIdCache === KDIDCache &&
      currentIdCache?.get(id) === result
    ) {
      cachedId = id;
      cachedIdCache = currentIdCache;
      cachedResult = result;
    } else {
      cachedId = null;
      cachedIdCache = null;
      cachedResult = null;
    }
    return finish(result, this, args);
  };

  function finish(result, thisArgument, args) {
    if (stats !== null && verify) {
      const expected = Reflect.apply(official, thisArgument, args);
      if (Object.is(result, expected)) {
        stats.exactMatches += 1;
      } else {
        stats.mismatches += 1;
        if (stats.mismatches === 1) {
          stats.firstMismatchExpectedId = expected?.id ?? null;
          stats.firstMismatchActualId = result?.id ?? null;
        }
      }
    }
    return result;
  }
}

function createLeashingEnemyScopedCacheCandidate(
  official,
  stats = null,
  verify = false
) {
  const guardedId = KDGameData.KinkyDungeonLeashingEnemy;
  const eligible =
    Number(KDGameData.KinkyDungeonLeashedPlayer) > 1 &&
    Boolean(guardedId);
  let cachedIdCache = KDIDCache;
  let cachedResult = eligible
    ? Reflect.apply(official, globalThis, [])
    : null;
  if (
    !cachedResult ||
    cachedIdCache?.get(guardedId) !== cachedResult
  ) {
    cachedResult = null;
  }
  if (stats !== null) {
    stats.initialId = guardedId ?? null;
    stats.initialWasNull = cachedResult === null;
  }

  return function KinkyDungeonLeashingEnemyScopedCacheProbe(...args) {
    if (stats !== null) stats.calls += 1;
    if (
      cachedResult &&
      KDGameData.KinkyDungeonLeashingEnemy === guardedId
    ) {
      if (KDIDCache === cachedIdCache) {
        if (stats !== null) {
          stats.cachedCalls += 1;
          stats.fastCalls += 1;
        }
        return finish(cachedResult, this, args);
      }
      const result = Reflect.apply(official, this, args);
      const currentIdCache = KDIDCache;
      if (currentIdCache?.get(guardedId) === result) {
        cachedIdCache = currentIdCache;
        cachedResult = result;
      } else {
        cachedIdCache = null;
        cachedResult = null;
      }
      if (stats !== null) stats.fallbackCalls += 1;
      return finish(result, this, args);
    }

    if (stats !== null) stats.fallbackCalls += 1;
    return finish(
      Reflect.apply(official, this, args),
      this,
      args
    );
  };

  function finish(result, thisArgument, args) {
    if (stats !== null && verify) {
      const expected = Reflect.apply(official, thisArgument, args);
      if (Object.is(result, expected)) {
        stats.exactMatches += 1;
      } else {
        stats.mismatches += 1;
        if (stats.mismatches === 1) {
          stats.firstMismatchExpectedId = expected?.id ?? null;
          stats.firstMismatchActualId = result?.id ?? null;
        }
      }
    }
    return result;
  }
}

async function benchmarkDynamicPathArray(
  client,
  sampleCount,
  turnsPerSample
) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const capturePathFunctions =
          ${capturePathfindingFunctions.toString()};
        const createCandidate =
          ${createDynamicPathArrayProbeCandidate.toString()};
        const initial = restore();
        KDHybrid.enableSystem("ai");
        KDHybrid.enableSystem("movement");
        KDHybrid.enableSystem("pathfinding");
        const pathFunctions = capturePathFunctions();
        const official = pathFunctions.facade;
        const candidate = ${
          optimized
            ? "createCandidate(pathFunctions.callFacade, null, false, pathFunctions.upstream)"
            : "null"
        };
        if (candidate !== null) {
          globalThis.KinkyDungeonFindPath = candidate;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidate !== null &&
            globalThis.KinkyDungeonFindPath === candidate
          ) {
            globalThis.KinkyDungeonFindPath = official;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Dynamic-path probe fixture restore changed its state");
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const capturePathFunctions =
        ${capturePathfindingFunctions.toString()};
      const createCandidate =
        ${createDynamicPathArrayProbeCandidate.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      KDHybrid.enableSystem("movement");
      KDHybrid.enableSystem("pathfinding");
      const pathFunctions = capturePathFunctions();
      const official = pathFunctions.facade;
      const stats = {
        calls: 0,
        fastCalls: 0,
        fallbackCalls: 0,
        found: 0,
        unreachable: 0,
        expanded: 0,
        fastMilliseconds: 0,
        officialMilliseconds: 0,
        exactMatches: 0,
        mismatches: 0
      };
      const candidate = createCandidate(
        pathFunctions.callFacade,
        stats,
        true,
        pathFunctions.upstream
      );
      globalThis.KinkyDungeonFindPath = candidate;
      try {
        const result = run(${turnsPerSample});
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonFindPath === candidate) {
          globalThis.KinkyDungeonFindPath = official;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function capturePathfindingFunctions() {
  const internal = globalThis.KDHybridRuntimeInternal;
  const runtime = internal?.runtime;
  if (!runtime?.dispatcher) {
    throw new Error("KD Hybrid runtime internals are unavailable");
  }
  const saved = [];
  for (const status of runtime.status().systems) {
    if (
      typeof status.globalName === "string" &&
      status.globalName.length > 0
    ) {
      saved.push([
        status.globalName,
        globalThis[status.globalName],
        status.system
      ]);
    }
  }
  const facade = globalThis.KinkyDungeonFindPath;
  if (typeof facade !== "function") {
    throw new Error("KinkyDungeonFindPath facade is unavailable");
  }
  runtime.dispatcher.restore();
  const upstream = globalThis.KinkyDungeonFindPath;
  for (const [globalName, value] of saved) {
    globalThis[globalName] = value;
  }
  for (const system of new Set(saved.map((entry) => entry[2]))) {
    KDHybrid.enableSystem(system);
  }
  if (typeof upstream !== "function") {
    throw new Error("Captured upstream KinkyDungeonFindPath is unavailable");
  }
  const callFacade = function (...args) {
    const current = globalThis.KinkyDungeonFindPath;
    globalThis.KinkyDungeonFindPath = facade;
    try {
      return Reflect.apply(facade, this, args);
    } finally {
      globalThis.KinkyDungeonFindPath = current;
    }
  };
  return { facade, upstream, callFacade };
}

function createDynamicPathArrayProbeCandidate(
  official,
  stats = null,
  verify = false,
  expectedOfficial = official
) {
  let workspaceMap = null;
  let width = 0;
  let height = 0;
  let cellCount = 0;
  let openSlotByCell = new Int32Array(0);
  let closedEpoch = new Uint32Array(0);
  let closedF = new Float64Array(0);
  let closedParent = new Int32Array(0);
  let epoch = 0;
  const openActive = [];
  const openX = [];
  const openY = [];
  const openG = [];
  const openF = [];
  const openParent = [];

  const pathsEqual = (left, right) => {
    if (left === right) return true;
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (
        left[index]?.x !== right[index]?.x ||
        left[index]?.y !== right[index]?.y
      ) {
        return false;
      }
    }
    return true;
  };

  const ensureWorkspace = (map) => {
    const nextWidth = Number(map?.GridWidth);
    const nextHeight = Number(map?.GridHeight);
    if (
      map !== workspaceMap ||
      nextWidth !== width ||
      nextHeight !== height
    ) {
      workspaceMap = map;
      width = nextWidth;
      height = nextHeight;
      cellCount = width * height;
      openSlotByCell = new Int32Array(cellCount);
      closedEpoch = new Uint32Array(cellCount);
      closedF = new Float64Array(cellCount);
      closedParent = new Int32Array(cellCount);
      epoch = 0;
    }
  };

  const runFast = (
    startx,
    starty,
    endx,
    endy,
    blockPlayer,
    ignoreLocks,
    tiles,
    requireLight,
    noDoors,
    needDoorMemory,
    enemy,
    taxicab,
    ignoreTrafficLaws,
    ignoreAllWeighting
  ) => {
    const map = KDMapData;
    ensureWorkspace(map);
    epoch = (epoch + 1) >>> 0;
    if (epoch === 0) {
      closedEpoch.fill(0);
      epoch = 1;
    }
    openSlotByCell.fill(0);
    let slotCount = 0;
    let openCount = 0;
    let closedCount = 0;
    const cellAt = (x, y) => x + y * width;
    const startCell = cellAt(startx, starty);
    const tilesTemp = noDoors ? tiles.replace("D", "") : tiles;

    const addOpen = (x, y, g, f, parent) => {
      const cell = cellAt(x, y);
      const marker = openSlotByCell[cell];
      if (marker > 0) {
        const slot = marker - 1;
        openX[slot] = x;
        openY[slot] = y;
        openG[slot] = g;
        openF[slot] = f;
        openParent[slot] = parent;
        return;
      }
      const slot = slotCount;
      slotCount += 1;
      openActive[slot] = true;
      openX[slot] = x;
      openY[slot] = y;
      openG[slot] = g;
      openF[slot] = f;
      openParent[slot] = parent;
      openSlotByCell[cell] = slot + 1;
      openCount += 1;
    };

    const closeSlot = (slot) => {
      const x = openX[slot];
      const y = openY[slot];
      const cell = cellAt(x, y);
      if (closedEpoch[cell] !== epoch) closedCount += 1;
      closedEpoch[cell] = epoch;
      closedF[cell] = openF[slot];
      closedParent[cell] = openParent[slot];
      openActive[slot] = false;
      openSlotByCell[cell] = 0;
      openCount -= 1;
      return cell;
    };

    const reconstruct = (fromCell) => {
      const result = [];
      if (endx && endy) result.push({ x: endx, y: endy });
      let current = fromCell;
      while (closedEpoch[current] === epoch) {
        const parent = closedParent[current];
        if (parent < 0) break;
        result.push({
          x: current % width,
          y: Math.floor(current / width)
        });
        current = parent;
      }
      result.reverse();
      return result;
    };

    addOpen(startx, starty, 0, 0, -1);
    while (openCount > 0) {
      let lowestSlot = -1;
      let lowestOldSlot = -1;
      let lowestCost = 1_000_000_000;
      for (let slot = 0; slot < slotCount; slot += 1) {
        if (openActive[slot] && openF[slot] < lowestCost) {
          lowestCost = openF[slot];
          lowestOldSlot = lowestSlot;
          lowestSlot = slot;
        }
      }
      if (lowestSlot < 0) return undefined;
      const lowestX = openX[lowestSlot];
      const lowestY = openY[lowestSlot];
      const lowestG = openG[lowestSlot];
      const lowCell = cellAt(lowestX, lowestY);
      const oldX = lowestOldSlot >= 0 ? openX[lowestOldSlot] : 0;
      const oldY = lowestOldSlot >= 0 ? openY[lowestOldSlot] : 0;

      for (let x = -1; x <= 1; x += 1) {
        for (let y = -1; y <= 1; y += 1) {
          if ((x == 0 && y == 0) || (taxicab && y != 0 && x != 0)) {
            continue;
          }
          const xx = lowestX + x;
          const yy = lowestY + y;
          const loc = `${xx},${yy}`;
          const tile = xx == endx && yy == endy
            ? ""
            : KinkyDungeonMapGet(xx, yy);
          const mapTile = KinkyDungeonTilesGet(loc);
          if (xx == endx && yy == endy) {
            const closedCell = closeSlot(lowestSlot);
            const path = reconstruct(closedCell);
            KDPathfindingCacheFails += 1;
            if (
              path.length > 0 &&
              tilesTemp.includes(
                KinkyDungeonMapGet(path[0].x, path[0].y)
              )
            ) {
              if (stats !== null) stats.found += 1;
              return path;
            }
            if (stats !== null) stats.unreachable += 1;
            return undefined;
          }
          if (
            xx >= 0 &&
            yy >= 0 &&
            xx < width &&
            yy < height &&
            tilesTemp.includes(tile) &&
            (!requireLight || KinkyDungeonVisionGet(xx, yy) > 0) &&
            (ignoreLocks ||
              !mapTile ||
              !mapTile.Lock ||
              (enemy &&
                KDLocks[mapTile.Lock].canNPCPass(
                  xx,
                  yy,
                  mapTile,
                  enemy
                ))) &&
            KinkyDungeonNoEnemyExceptSub(xx, yy, false, enemy) &&
            (!blockPlayer ||
              KinkyDungeonPlayerEntity.x != xx ||
              KinkyDungeonPlayerEntity.y != yy) &&
            (!needDoorMemory ||
              tile != "d" ||
              KDOpenDoorTiles.includes(map.TilesMemory[loc]))
          ) {
            let costBonus = 0;
            if (!ignoreTrafficLaws) {
              if (KDEffectTileTagsLoc(loc)?.danger) costBonus += 30;
              else if (tile == "V" && !mapTile?.Sfty) costBonus = 14;
              else if (tile == "N") costBonus = 30;
              else if (tile == "D") costBonus = 3;
              else if (tile == "d") costBonus = -2;
              else if (tile == "g") costBonus = 9;
              else if (tile == "L") costBonus = 9;
              else if (tile == "T") costBonus = 4;
              costBonus = mapTile?.Lock ? costBonus + 2 : costBonus;
              costBonus = mapTile?.OL ? costBonus + 12 : costBonus;
              costBonus =
                map.Traffic?.length > 0 && map.Traffic[yy]
                  ? costBonus + (map.Traffic[yy][xx] || 0)
                  : costBonus;
              costBonus = Math.max(0, costBonus);
            } else if (!ignoreAllWeighting) {
              if (tile == "V" && !mapTile?.Sfty) costBonus = 3;
              else if (tile == "N") costBonus = 8;
              else if (tile == "L") costBonus = 2;
            }
            if (x && y && lowestOldSlot >= 0) {
              const dx = lowestX - oldX;
              const dy = lowestY - oldY;
              if (dx != x || dy != y) costBonus += 0.45;
              else costBonus += 0.22;
            }
            const g = 1 + costBonus + lowestG;
            const f =
              g +
              0.1 *
                KDistEuclideanApprox(
                  (xx - endx) * (xx - endx),
                  (yy - endy) * (yy - endy)
                );
            const cell = cellAt(xx, yy);
            const marker = openSlotByCell[cell];
            if (marker > 0 && !(openF[marker - 1] > f)) {
              continue;
            }
            if (
              closedEpoch[cell] === epoch &&
              !(closedF[cell] > f)
            ) {
              continue;
            }
            addOpen(xx, yy, g, f, lowCell);
          }
        }
      }
      closeSlot(lowestSlot);
      if (stats !== null) stats.expanded += 1;
      void closedCount;
    }
    if (stats !== null) stats.unreachable += 1;
    return undefined;
  };

  return function KinkyDungeonFindPathArrayProbe(
    startx,
    starty,
    endx,
    endy,
    blockEnemy,
    blockPlayer,
    ignoreLocks,
    tiles,
    requireLight,
    noDoors,
    needDoorMemory,
    enemy,
    trimLongDistance,
    heuristicOverride,
    taxicab,
    ignoreTrafficLaws,
    allowPassable,
    ignoreAllWeighting,
    leashTarget
  ) {
    if (stats !== null) stats.calls += 1;
    const map = KDMapData;
    const eligible =
      blockEnemy === true &&
      !trimLongDistance &&
      (heuristicOverride === undefined || heuristicOverride === null) &&
      !allowPassable &&
      (leashTarget === undefined ||
        leashTarget === null ||
        leashTarget === 0) &&
      enemy !== undefined &&
      enemy !== null &&
      typeof tiles === "string" &&
      Number.isInteger(startx) &&
      Number.isInteger(starty) &&
      Number.isInteger(endx) &&
      Number.isInteger(endy) &&
      Number.isInteger(map?.GridWidth) &&
      Number.isInteger(map?.GridHeight) &&
      startx >= 0 &&
      starty >= 0 &&
      endx >= 0 &&
      endy >= 0 &&
      startx < map.GridWidth &&
      starty < map.GridHeight &&
      endx < map.GridWidth &&
      endy < map.GridHeight &&
      Math.max(Math.abs(startx - endx), Math.abs(starty - endy)) > 1;
    if (!eligible) {
      if (stats !== null) stats.fallbackCalls += 1;
      return Reflect.apply(official, this, arguments);
    }
    if (stats !== null) stats.fastCalls += 1;
    const fastStarted =
      verify && stats !== null ? performance.now() : 0;
    const result = runFast(
      startx,
      starty,
      endx,
      endy,
      blockPlayer,
      ignoreLocks,
      tiles,
      requireLight,
      noDoors,
      needDoorMemory,
      enemy,
      taxicab,
      ignoreTrafficLaws,
      ignoreAllWeighting
    );
    if (verify && stats !== null) {
      stats.fastMilliseconds += performance.now() - fastStarted;
      const officialStarted = performance.now();
      const expected = Reflect.apply(expectedOfficial, this, arguments);
      stats.officialMilliseconds += performance.now() - officialStarted;
      if (pathsEqual(result, expected)) stats.exactMatches += 1;
      else stats.mismatches += 1;
    }
    return result;
  };
}

async function benchmarkOccupancyFastPath(client, sampleCount, turnsPerSample) {
  const samples = [];
  let referenceInitialState = null;
  const runMode = async (optimized) => {
    const measured = await client.evaluate(
      `(() => {
        const restore = ${restoreCrowdedFixture.toString()};
        const run = ${runCrowdedTurns.toString()};
        const createCandidates = ${createOccupancyProbeCandidates.toString()};
        const initial = restore();
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not enable the AI system for occupancy probing");
        }
        const officialEnemyAt = globalThis.KinkyDungeonEnemyAt;
        const officialEntityAt = globalThis.KinkyDungeonEntityAt;
        if (
          typeof officialEnemyAt !== "function" ||
          typeof officialEntityAt !== "function"
        ) {
          throw new Error("KD occupancy globals are unavailable");
        }
        const candidates = ${
          optimized
            ? "createCandidates(officialEnemyAt, officialEntityAt)"
            : "null"
        };
        if (candidates !== null) {
          globalThis.KinkyDungeonEnemyAt = candidates.enemyAt;
          globalThis.KinkyDungeonEntityAt = candidates.entityAt;
        }
        try {
          return { initial, run: run(${turnsPerSample}) };
        } finally {
          if (
            candidates !== null &&
            globalThis.KinkyDungeonEnemyAt === candidates.enemyAt
          ) {
            globalThis.KinkyDungeonEnemyAt = officialEnemyAt;
          }
          if (
            candidates !== null &&
            globalThis.KinkyDungeonEntityAt === candidates.entityAt
          ) {
            globalThis.KinkyDungeonEntityAt = officialEntityAt;
          }
        }
      })()`,
      120_000
    );
    referenceInitialState ??= measured.initial.stateSignature;
    if (measured.initial.stateSignature !== referenceInitialState) {
      throw new Error("Occupancy probe fixture restore changed its initial state");
    }
    return measured.run;
  };

  await runMode(false);
  await runMode(true);
  for (let index = 0; index < sampleCount; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    const pair = { baseline: null, optimized: null };
    for (const optimized of order) {
      pair[optimized ? "optimized" : "baseline"] = await runMode(optimized);
    }
    samples.push({
      baselineMilliseconds: pair.baseline.totalMilliseconds,
      optimizedMilliseconds: pair.optimized.totalMilliseconds,
      speedup:
        pair.baseline.totalMilliseconds / pair.optimized.totalMilliseconds,
      stateMatches:
        pair.baseline.stateSignature === pair.optimized.stateSignature,
      baselineStateSignature: pair.baseline.stateSignature,
      optimizedStateSignature: pair.optimized.stateSignature
    });
  }

  const verification = await client.evaluate(
    `(() => {
      const restore = ${restoreCrowdedFixture.toString()};
      const run = ${runCrowdedTurns.toString()};
      const createCandidates = ${createOccupancyProbeCandidates.toString()};
      restore();
      KDHybrid.enableSystem("ai");
      const officialEnemyAt = globalThis.KinkyDungeonEnemyAt;
      const officialEntityAt = globalThis.KinkyDungeonEntityAt;
      const stats = {
        fastEnemyAt: 0,
        fallbackEnemyAt: 0,
        fastEntityAt: 0,
        fallbackEntityAt: 0,
        exactMatches: 0,
        mismatches: 0,
        rebuilds: 0
      };
      const candidates = createCandidates(
        officialEnemyAt,
        officialEntityAt,
        stats,
        true
      );
      globalThis.KinkyDungeonEnemyAt = candidates.enemyAt;
      globalThis.KinkyDungeonEntityAt = candidates.entityAt;
      try {
        const result = run(1);
        return { ...stats, stateSignature: result.stateSignature };
      } finally {
        if (globalThis.KinkyDungeonEnemyAt === candidates.enemyAt) {
          globalThis.KinkyDungeonEnemyAt = officialEnemyAt;
        }
        if (globalThis.KinkyDungeonEntityAt === candidates.entityAt) {
          globalThis.KinkyDungeonEntityAt = officialEntityAt;
        }
      }
    })()`,
    120_000
  );
  const baseline = samples.map((sample) => sample.baselineMilliseconds);
  const optimized = samples.map((sample) => sample.optimizedMilliseconds);
  const baselineMedianMilliseconds = median(baseline);
  const optimizedMedianMilliseconds = median(optimized);
  return {
    sampleCount,
    turnsPerSample,
    initialStateSignature: referenceInitialState,
    baselineMedianMilliseconds,
    optimizedMedianMilliseconds,
    speedup: median(samples.map((sample) => sample.speedup)),
    ratioOfMedians:
      baselineMedianMilliseconds / optimizedMedianMilliseconds,
    allStatesMatch: samples.every((sample) => sample.stateMatches),
    verification,
    samples
  };
}

function createOccupancyProbeCandidates(
  officialEnemyAt,
  officialEntityAt,
  stats = null,
  verify = false
) {
  const expectedEnemyCache = globalThis.KDGetEnemyCache;
  let loadedCache = null;
  let loadedWidth = 0;
  let loadedHeight = 0;
  let dense = [];

  const lookup = (x, y) => {
    if (
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y) ||
      globalThis.KDGetEnemyCache !== expectedEnemyCache
    ) {
      return { supported: false };
    }
    const map = KDMapData;
    const width = map.GridWidth;
    const height = map.GridHeight;
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      x < 0 ||
      y < 0 ||
      x >= width ||
      y >= height
    ) {
      return { supported: false };
    }
    const cache = KDGetEnemyCache();
    if (!cache || typeof cache.get !== "function") {
      return { supported: false };
    }
    if (
      cache !== loadedCache ||
      width !== loadedWidth ||
      height !== loadedHeight
    ) {
      const next = new Array(width * height);
      for (const enemy of map.Entities) {
        if (
          !Number.isSafeInteger(enemy.x) ||
          !Number.isSafeInteger(enemy.y) ||
          enemy.x < 0 ||
          enemy.y < 0 ||
          enemy.x >= width ||
          enemy.y >= height
        ) {
          return { supported: false };
        }
        const cached = cache.get(enemy.x + "," + enemy.y);
        if (cached !== undefined) {
          next[enemy.x + enemy.y * width] = cached;
        }
      }
      loadedCache = cache;
      loadedWidth = width;
      loadedHeight = height;
      dense = next;
      if (stats !== null) stats.rebuilds += 1;
    }
    return { supported: true, value: dense[x + y * loadedWidth] };
  };

  const record = (kind, result, official, args) => {
    if (stats === null) return;
    stats[kind] += 1;
    if (verify) {
      if (result === Reflect.apply(official, globalThis, args)) {
        stats.exactMatches += 1;
      } else {
        stats.mismatches += 1;
      }
    }
  };

  const enemyAt = function KinkyDungeonEnemyAtProbe(x, y, mapData) {
    const effectiveMap = mapData || KDMapData;
    if (effectiveMap === KDMapData) {
      const result = lookup(x, y);
      if (result.supported) {
        record("fastEnemyAt", result.value, officialEnemyAt, arguments);
        return result.value;
      }
    }
    if (stats !== null) stats.fallbackEnemyAt += 1;
    return Reflect.apply(officialEnemyAt, this, arguments);
  };

  const entityAt = function KinkyDungeonEntityAtProbe(
    x,
    y,
    requireVision = false,
    vx,
    vy,
    player = true,
    mapData
  ) {
    const effectiveMap = mapData || KDMapData;
    if (
      player &&
      effectiveMap === KDMapData &&
      KinkyDungeonPlayerEntity.x == x &&
      KinkyDungeonPlayerEntity.y == y
    ) {
      record(
        "fastEntityAt",
        KinkyDungeonPlayerEntity,
        officialEntityAt,
        arguments
      );
      return KinkyDungeonPlayerEntity;
    }
    if (effectiveMap === KDMapData && !requireVision) {
      const result = lookup(x, y);
      if (result.supported) {
        record("fastEntityAt", result.value, officialEntityAt, arguments);
        return result.value;
      }
    }
    if (stats !== null) stats.fallbackEntityAt += 1;
    return Reflect.apply(officialEntityAt, this, arguments);
  };

  return { enemyAt, entityAt };
}

function saveCrowdedFixture() {
  "use strict";

  if (!KDCurrentModels.get(KinkyDungeonPlayer)?.Poses) {
    throw new Error(
      "Crowded-turn fixture player model was not initialized before save"
    );
  }
  resetCommanderState();
  // KD's save format does not persist these short-lived vision counters.
  // Carry them inside profiler-only game data so every A/B leg, including a
  // portable --fixture-input run, starts from the exact same visual state.
  KDGameData.KDHybridTurnProfileFixtureState = {
    statBlind: KinkyDungeonStatBlind,
    blindLevel: KinkyDungeonBlindLevel,
    // KinkyDungeonLoadGame applies saved flags but does not remove transient
    // entries created after the save. Keep the complete Map so repeated A/B
    // legs and back-to-back scenarios cannot leak flags into one another.
    globalFlags: [...KinkyDungeonFlags.entries()],
    enemyFlags: KDMapData.Entities.filter(
      (enemy) => enemy.kdHybridTurnProfile
    ).map((enemy) => ({
      id: enemy.id,
      profileIndex: enemy.kdHybridTurnProfileIndex,
      flags: JSON.parse(JSON.stringify(enemy.flags ?? {}))
    })),
    enemyState: KDMapData.Entities.filter(
      (enemy) => enemy.kdHybridTurnProfile
    ).map((enemy) => ({
      id: enemy.id,
      profileIndex: enemy.kdHybridTurnProfileIndex,
      gx: enemy.gx,
      gy: enemy.gy,
      tx: enemy.tx,
      ty: enemy.ty,
      target: enemy.target,
      aware: enemy.aware,
      action: enemy.action,
      attackPoints: enemy.attackPoints,
      movePoints: enemy.movePoints,
      specialCD: enemy.specialCD,
      boundLevel: enemy.boundLevel,
      distraction: enemy.distraction,
      stun: enemy.stun,
      freeze: enemy.freeze,
      slow: enemy.slow,
      bind: enemy.bind,
      silence: enemy.silence,
      warningTiles: JSON.parse(JSON.stringify(enemy.warningTiles ?? [])),
      flags: JSON.parse(JSON.stringify(enemy.flags ?? {})),
      buffs: JSON.parse(JSON.stringify(enemy.buffs ?? {}))
    }))
  };
  const compressed = LZString.compressToBase64(
    JSON.stringify(KinkyDungeonSaveGame(true))
  );
  globalThis.kdHybridCrowdedTurnFixture = compressed;
  return { bytes: compressed.length };

  function resetCommanderState() {
    KDCommanderRoles.clear();
    KDStruggleAssisters = {};
    KDCapturers = {};
    KDAssaulters = 0;
    KDAssaulterList = [];
    KDMaxAssaulters = 3;
    KDStationedChokepoints = {};
    KDStationedChokepointsDist = {};
    KD_Avg_VX = 0;
    KD_Avg_VY = 0;
  }
}

function restoreCrowdedFixture() {
  "use strict";

  const fixture = globalThis.kdHybridCrowdedTurnFixture;
  if (typeof fixture !== "string" || !KinkyDungeonLoadGame(fixture, true)) {
    throw new Error("Could not restore the crowded-turn fixture");
  }
  const fixtureState = KDGameData.KDHybridTurnProfileFixtureState;
  KinkyDungeonStatBlind = Number.isFinite(fixtureState?.statBlind)
    ? fixtureState.statBlind
    : 0;
  KinkyDungeonBlindLevel = Number.isFinite(fixtureState?.blindLevel)
    ? fixtureState.blindLevel
    : 0;
  if (Array.isArray(fixtureState?.globalFlags)) {
    KinkyDungeonFlags.clear();
    for (const [name, value] of fixtureState.globalFlags) {
      KinkyDungeonFlags.set(name, value);
    }
  }
  if (Array.isArray(fixtureState?.enemyState)) {
    for (const saved of fixtureState.enemyState) {
      const enemy = KDMapData.Entities.find(
        (candidate) =>
          candidate.kdHybridTurnProfileIndex === saved.profileIndex &&
          candidate.id === saved.id
      );
      if (enemy) {
        enemy.gx = saved.gx;
        enemy.gy = saved.gy;
        enemy.tx = saved.tx;
        enemy.ty = saved.ty;
        enemy.target = saved.target;
        enemy.aware = saved.aware;
        enemy.action = saved.action;
        enemy.attackPoints = saved.attackPoints;
        enemy.movePoints = saved.movePoints;
        enemy.specialCD = saved.specialCD;
        enemy.boundLevel = saved.boundLevel;
        enemy.distraction = saved.distraction;
        enemy.stun = saved.stun;
        enemy.freeze = saved.freeze;
        enemy.slow = saved.slow;
        enemy.bind = saved.bind;
        enemy.silence = saved.silence;
        enemy.warningTiles = JSON.parse(
          JSON.stringify(saved.warningTiles ?? [])
        );
        enemy.flags = JSON.parse(JSON.stringify(saved.flags ?? {}));
        enemy.buffs = JSON.parse(JSON.stringify(saved.buffs ?? {}));
      }
    }
  } else if (Array.isArray(fixtureState?.enemyFlags)) {
    for (const saved of fixtureState.enemyFlags) {
      const enemy = KDMapData.Entities.find(
        (candidate) =>
          candidate.kdHybridTurnProfileIndex === saved.profileIndex &&
          candidate.id === saved.id
      );
      if (enemy) {
        enemy.flags = JSON.parse(JSON.stringify(saved.flags ?? {}));
      }
    }
  }
  KinkyDungeonState = "Game";
  resetCommanderState();
  const state = crowdedState();
  return {
    ...state,
    enemies: KDMapData.Entities.filter(
      (enemy) => enemy.kdHybridTurnProfile
    ).length
  };

  function crowdedState() {
    const stateJson = JSON.stringify({
      player: {
        x: KinkyDungeonPlayerEntity.x,
        y: KinkyDungeonPlayerEntity.y,
        will: KinkyDungeonStatWill,
        stamina: KinkyDungeonStatStamina,
        mana: KinkyDungeonStatMana,
        distraction: KinkyDungeonStatDistraction,
        distractionLower: KinkyDungeonStatDistractionLower,
        blind: KinkyDungeonStatBlind,
        blindLevel: KinkyDungeonBlindLevel,
        state: KinkyDungeonState
      },
      seed: KinkyDungeonSeed,
      currentTick: KinkyDungeonCurrentTick,
      prisonerState: KDGameData.PrisonerState,
      flags: [...KinkyDungeonFlags.entries()].sort(([left], [right]) =>
        String(left).localeCompare(String(right))
      ),
      enemies: KDMapData.Entities
        .filter((enemy) => enemy.kdHybridTurnProfile)
        .sort(
          (left, right) =>
            left.kdHybridTurnProfileIndex - right.kdHybridTurnProfileIndex
        )
        .map((enemy) => ({
          i: enemy.kdHybridTurnProfileIndex,
          id: enemy.id,
          x: enemy.x,
          y: enemy.y,
          gx: enemy.gx,
          gy: enemy.gy,
          tx: enemy.tx,
          ty: enemy.ty,
          target: enemy.target,
          hp: enemy.hp,
          faction: enemy.faction,
          rage: enemy.rage,
          ceasefire: enemy.ceasefire,
          allied: enemy.allied,
          aware: enemy.aware,
          hostile: enemy.hostile,
          action: enemy.action,
          attackPoints: enemy.attackPoints,
          movePoints: enemy.movePoints,
          specialCD: enemy.specialCD,
          boundLevel: enemy.boundLevel,
          distraction: enemy.distraction,
          stun: enemy.stun,
          freeze: enemy.freeze,
          slow: enemy.slow,
          bind: enemy.bind,
          silence: enemy.silence,
          warningTiles: enemy.warningTiles?.map((tile) => ({
            x: tile.x,
            y: tile.y
          })),
          flags: Object.entries(enemy.flags ?? {}).sort(([left], [right]) =>
            left.localeCompare(right)
          ),
          buffs: enemy.buffs
        })),
      groundItems: KDMapData.GroundItems.map((item) => ({
        name: item.name,
        x: item.x,
        y: item.y
      }))
    });
    let hash = 0x811c9dc5;
    for (let index = 0; index < stateJson.length; index += 1) {
      hash ^= stateJson.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return {
      stateSignature: (hash >>> 0).toString(16).padStart(8, "0"),
      stateJson
    };
  }

  function resetCommanderState() {
    KDCommanderRoles.clear();
    KDStruggleAssisters = {};
    KDCapturers = {};
    KDAssaulters = 0;
    KDAssaulterList = [];
    KDMaxAssaulters = 3;
    KDStationedChokepoints = {};
    KDStationedChokepointsDist = {};
    KD_Avg_VX = 0;
    KD_Avg_VY = 0;
  }
}

function verifyIntegratedNearbyParity() {
  "use strict";

  const enemies = KDMapData.Entities.filter(
    (enemy) => enemy.kdHybridTurnProfile
  );
  const queries = [];
  for (const enemy of enemies) {
    queries.push(
      [enemy.x, enemy.y, 1.5, undefined, false, undefined],
      [enemy.x, enemy.y, 3, undefined, true, KinkyDungeonPlayerEntity],
      [enemy.x, enemy.y, 4, undefined, true, KinkyDungeonPlayerEntity],
      [enemy.x, enemy.y, 4.666666666666667, undefined, true, enemy],
      [enemy.x, enemy.y, 6, undefined, true, undefined],
      [enemy.x, enemy.y, 9, undefined, true, undefined],
      [enemy.x, enemy.y, 3, KinkyDungeonPlayerEntity, false, undefined]
    );
  }

  let exactMatches = 0;
  const mismatches = [];
  for (const query of queries) {
    KDHybrid.disableSystem("ai", "nearby-parity-baseline");
    const expected = KDNearbyEnemies(...query);
    if (!KDHybrid.enableSystem("ai")) {
      throw new Error("Could not enable the nearby-enemy adapter for parity");
    }
    const actual = KDNearbyEnemies(...query);
    const exact =
      expected.length === actual.length &&
      expected.every((enemy, index) => actual[index] === enemy);
    if (exact) {
      exactMatches += 1;
    } else if (mismatches.length < 10) {
      mismatches.push({
        query: {
          x: query[0],
          y: query[1],
          distance: query[2],
          hostile: Boolean(query[3]),
          chebyshev: Boolean(query[4]),
          nonhostile: Boolean(query[5])
        },
        expected: expected.map((enemy) => enemy.id),
        actual: actual.map((enemy) => enemy.id)
      });
    }
  }
  KDHybrid.enableSystem("ai");
  KDHybrid.disableSystem("ai", "nearby-dependency-baseline");
  const dependencyQuery = queries[0];
  const dependencyExpected = KDNearbyEnemies(...dependencyQuery);
  if (!KDHybrid.enableSystem("ai")) {
    throw new Error("Could not enable the adapter for dependency fallback");
  }
  const dependencyBefore = { ...KDHybrid.systemStatus("ai") };
  const originalHostile = globalThis.KDHostile;
  const hostileReplacement = function (...args) {
    return Reflect.apply(originalHostile, this, args);
  };
  let dependencyActual;
  globalThis.KDHostile = hostileReplacement;
  try {
    dependencyActual = KDNearbyEnemies(...dependencyQuery);
  } finally {
    if (globalThis.KDHostile === hostileReplacement) {
      globalThis.KDHostile = originalHostile;
    }
  }
  const dependencyAfter = { ...KDHybrid.systemStatus("ai") };
  const dependencyFallback = {
    exact:
      dependencyExpected.length === dependencyActual.length &&
      dependencyExpected.every(
        (enemy, index) => dependencyActual[index] === enemy
      ),
    delta: {
      calls: dependencyAfter.calls - dependencyBefore.calls,
      nativeCalls:
        dependencyAfter.nativeCalls - dependencyBefore.nativeCalls,
      fallbackCalls:
        dependencyAfter.fallbackCalls - dependencyBefore.fallbackCalls,
      failures: dependencyAfter.failures - dependencyBefore.failures
    }
  };
  const status = { ...KDHybrid.systemStatus("ai") };
  return {
    compared: queries.length,
    exactMatches,
    parityMismatches: queries.length - exactMatches,
    mismatches,
    dependencyFallback,
    failures: status.failures,
    status
  };
}

function verifyTurnNearbyParity() {
  "use strict";

  let calls = 0;
  let exactMatches = 0;
  const mismatches = [];
  const hookId = KDHybrid.registerHook(
    "ai",
    "after",
    (context) => {
      if (context.globalName !== "KDNearbyEnemies") {
        return;
      }
      calls += 1;
      KDHybrid.disableSystem("ai", "turn-parity-oracle");
      let expected;
      try {
        expected = KDNearbyEnemies(...context.args);
      } finally {
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not restore the nearby-enemy adapter");
        }
      }
      const actual = context.result;
      const exact =
        Array.isArray(actual) &&
        expected.length === actual.length &&
        expected.every((enemy, index) => actual[index] === enemy);
      if (exact) {
        exactMatches += 1;
      } else if (mismatches.length < 20) {
        mismatches.push({
          query: {
            x: context.args[0],
            y: context.args[1],
            distance: context.args[2],
            hostile: Boolean(context.args[3]),
            chebyshev: Boolean(context.args[4]),
            nonhostile: Boolean(context.args[5])
          },
          expected: expected.map((enemy) => enemy.id),
          actual: Array.isArray(actual)
            ? actual.map((enemy) => enemy.id)
            : typeof actual
        });
      }
    },
    { id: "kd-hybrid-turn-nearby-parity", priority: -1_000 }
  );
  let turnMilliseconds;
  try {
    const started = performance.now();
    KinkyDungeonAdvanceTime(1, false, true);
    turnMilliseconds = performance.now() - started;
  } finally {
    KDHybrid.unregisterHook(hookId);
    KDHybrid.enableSystem("ai");
  }
  const status = { ...KDHybrid.systemStatus("ai") };
  return {
    calls,
    exactMatches,
    parityMismatches: calls - exactMatches,
    mismatches,
    turnMilliseconds,
    failures: status.failures,
    status
  };
}

function verifyCommanderDependencyFallback() {
  "use strict";

  const status = () =>
    KDHybrid.status().systems.find(
      (entry) => entry.globalName === "KDCommanderUpdateRoles"
    );
  const fixture = globalThis.kdHybridCrowdedTurnFixture;
  if (typeof fixture !== "string") {
    throw new Error("Crowded-turn fixture is unavailable");
  }

  const order = KDCommanderOrders.helpStruggle;
  const originalFilter = order.filter;
  let replacementCalls = 0;
  const replacementFilter = function (...args) {
    replacementCalls += 1;
    return Reflect.apply(originalFilter, this, args);
  };
  prepare();
  const before = { ...status() };
  order.filter = replacementFilter;
  try {
    runRoleUpdate();
  } finally {
    if (order.filter === replacementFilter) {
      order.filter = originalFilter;
    }
  }
  const after = { ...status() };
  const delta = statusDelta(before, after);
  const orderExact =
    replacementCalls > 0 &&
    delta.calls === 1 &&
    delta.nativeCalls === 0 &&
    delta.fallbackCalls === 1 &&
    delta.failures === 0;

  const dependencies = {};
  for (const name of ["KDIsHumanoid", "KDIsImmobile"]) {
    const original = globalThis[name];
    let calls = 0;
    const replacement = function (...args) {
      calls += 1;
      return Reflect.apply(original, this, args);
    };
    prepare();
    const dependencyBefore = { ...status() };
    globalThis[name] = replacement;
    try {
      runRoleUpdate();
    } finally {
      if (globalThis[name] === replacement) {
        globalThis[name] = original;
      }
    }
    const dependencyAfter = { ...status() };
    const dependencyDelta = statusDelta(
      dependencyBefore,
      dependencyAfter
    );
    dependencies[name] = {
      replacementCalls: calls,
      delta: dependencyDelta,
      exact:
        calls > 0 &&
        dependencyDelta.calls === 1 &&
        dependencyDelta.nativeCalls === 0 &&
        dependencyDelta.fallbackCalls === 1 &&
        dependencyDelta.failures === 0
    };
  }

  prepare();
  const result = {
    replacementCalls,
    delta,
    dependencies,
    exact:
      orderExact &&
      Object.values(dependencies).every((entry) => entry.exact),
    status: after
  };
  return result;

  function prepare() {
    if (!KinkyDungeonLoadGame(fixture, true)) {
      throw new Error("Could not restore the commander dependency fixture");
    }
    KinkyDungeonState = "Game";
    KDCommanderRoles.clear();
    KDHybrid.enableSystem("ai");
  }

  function runRoleUpdate() {
    KDCommanderUpdateRoles({
      delta: 1,
      aggressive: false,
      fleeThresh: 0.6,
      VavgWeight: 2,
      combat: false,
      invalidChoke: {},
      globalIgnore: false
    });
  }

  function statusDelta(start, end) {
    return {
      calls: Number(end.calls ?? 0) - Number(start.calls ?? 0),
      nativeCalls:
        Number(end.nativeCalls ?? 0) - Number(start.nativeCalls ?? 0),
      fallbackCalls:
        Number(end.fallbackCalls ?? 0) - Number(start.fallbackCalls ?? 0),
      failures: Number(end.failures ?? 0) - Number(start.failures ?? 0)
    };
  }
}

function verifyCommanderPotentialFallbacks() {
  "use strict";

  const originalFixture = globalThis.kdHybridCrowdedTurnFixture;
  if (typeof originalFixture !== "string") {
    throw new Error("Crowded-turn fixture is unavailable");
  }
  const scenarios = {};
  try {
    for (const kind of ["struggle", "danger"]) {
      if (!KinkyDungeonLoadGame(originalFixture, true)) {
        throw new Error(`Could not restore the ${kind} commander fixture`);
      }
      KinkyDungeonState = "Game";
      let target =
        kind === "struggle"
          ? KDMapData.Entities.find(
              (enemy) =>
                enemy.Enemy?.bound &&
                !KDIsImprisoned(enemy) &&
                !KDIsTileDangerous(enemy, enemy.x, enemy.y, KDMapData)
            )
          : KDMapData.Entities.find(
              (enemy) =>
                !KDIsImprisoned(enemy) &&
                KDNearbyMapTiles(enemy.x, enemy.y, 1.5).some(
                  (tile) => {
                    const occupant = KinkyDungeonEntityAt(tile.x, tile.y);
                    return (
                      (tile.x !== enemy.x || tile.y !== enemy.y) &&
                      !occupant?.player &&
                      KinkyDungeonMovableTilesEnemy.includes(tile.tile) &&
                      !KDIsTileDangerous(enemy, tile.x, tile.y, KDMapData)
                    );
                  }
                )
            );
      if (!target && kind === "struggle") {
        const source = KDMapData.Entities.find(
          (enemy) => enemy.kdHybridTurnProfile
        );
        if (source) {
          const { x, y, kdHybridTurnProfileIndex } = source;
          KDRemoveEntity(source);
          target = DialogueCreateEnemy(x, y, "FactoryDoll");
          if (target) {
            target.kdHybridTurnProfile = true;
            target.kdHybridTurnProfileIndex = kdHybridTurnProfileIndex;
            target.aware = true;
            target.hostile = 9_999;
            KDRunCreationScript(target, KDGetCurrentLocation());
          }
        }
      }
      if (!target && kind === "danger") {
        let location = null;
        for (let y = 1; y < KDMapData.GridHeight - 1 && !location; y += 1) {
          for (let x = 1; x < KDMapData.GridWidth - 1 && !location; x += 1) {
            if (
              !KinkyDungeonMovableTilesEnemy.includes(
                KinkyDungeonMapGet(x, y)
              ) ||
              (KinkyDungeonPlayerEntity.x === x &&
                KinkyDungeonPlayerEntity.y === y)
            ) {
              continue;
            }
            const escape = KDNearbyMapTiles(x, y, 1.5).find(
              (tile) =>
                (tile.x !== x || tile.y !== y) &&
                KinkyDungeonMovableTilesEnemy.includes(tile.tile) &&
                !(
                  KinkyDungeonPlayerEntity.x === tile.x &&
                  KinkyDungeonPlayerEntity.y === tile.y
                )
            );
            if (escape) {
              location = { x, y, escape };
            }
          }
        }
        if (location) {
          for (const point of [location, location.escape]) {
            const occupant = KinkyDungeonEntityAt(point.x, point.y);
            if (occupant && !occupant.player) {
              KDRemoveEntity(occupant);
            }
          }
          target = DialogueCreateEnemy(location.x, location.y, "Maidforce");
          if (target) {
            target.kdHybridTurnProfile = true;
            target.kdHybridTurnProfileIndex = -1;
            target.aware = true;
            target.hostile = 9_999;
            KDRunCreationScript(target, KDGetCurrentLocation());
          }
        }
      }
      if (!target) {
        throw new Error(`No ${kind} target was available`);
      }
      if (kind === "struggle") {
        target.boundLevel =
          target.Enemy.maxhp * KDGetBindEffectMult(target) * 0.6;
        target.hp = target.Enemy.maxhp;
        target.stun = 0;
        target.freeze = 0;
      } else {
        const escapeTile = KDNearbyMapTiles(target.x, target.y, 1.5).find(
          (tile) => {
            const occupant = KinkyDungeonEntityAt(tile.x, tile.y);
            return (
              (tile.x !== target.x || tile.y !== target.y) &&
              !occupant?.player &&
              KinkyDungeonMovableTilesEnemy.includes(tile.tile) &&
              !KDIsTileDangerous(target, tile.x, tile.y, KDMapData)
            );
          }
        );
        const escapeOccupant = escapeTile
          ? KinkyDungeonEntityAt(escapeTile.x, escapeTile.y)
          : null;
        if (escapeOccupant && escapeOccupant !== target) {
          KDRemoveEntity(escapeOccupant);
        }
        target.boundLevel = 0;
        target.stun = 5;
        target.freeze = 0;
        KinkyDungeonMapSet(target.x, target.y, "V");
      }
      const scenarioFixture = LZString.compressToBase64(
        JSON.stringify(KinkyDungeonSaveGame(true))
      );
      const baseline = runMode(false, scenarioFixture, kind, target.id);
      const optimized = runMode(true, scenarioFixture, kind, target.id);
      scenarios[kind] = {
        targetId: target.id,
        baseline,
        optimized,
        exact:
          baseline.stateSignature === optimized.stateSignature &&
          optimized.delta.calls === 1 &&
          optimized.delta.nativeCalls === 1 &&
          optimized.delta.fallbackCalls === 0 &&
          optimized.delta.failures === 0
      };
    }
  } finally {
    globalThis.kdHybridCrowdedTurnFixture = originalFixture;
    KinkyDungeonLoadGame(originalFixture, true);
    KinkyDungeonState = "Game";
    KDHybrid.enableSystem("ai");
  }
  return {
    passed: Object.values(scenarios).every((scenario) => scenario.exact),
    scenarios
  };

  function runMode(optimized, fixture, kind, targetId) {
    if (!KinkyDungeonLoadGame(fixture, true)) {
      throw new Error(`Could not reload the ${kind} commander fixture`);
    }
    KinkyDungeonState = "Game";
    KDCommanderRoles.clear();
    KDStruggleAssisters = {};
    KDCapturers = {};
    KDsetSeed(`kd-hybrid-commander-${kind}`);
    const enabled = optimized
      ? KDHybrid.enableSystem("ai")
      : KDHybrid.disableSystem("ai", `commander-${kind}-baseline`);
    if (!enabled) {
      throw new Error(`Could not enter the ${kind} commander mode`);
    }
    const status = () =>
      KDHybrid.status().systems.find(
        (entry) => entry.globalName === "KDCommanderUpdateRoles"
      );
    const before = { ...status() };
    const data = {
      delta: 1,
      aggressive: false,
      fleeThresh: 0.6,
      VavgWeight: 2,
      combat: false,
      invalidChoke: {},
      globalIgnore: false
    };
    KDCommanderUpdateRoles(data);
    const after = { ...status() };
    const roles = [...KDCommanderRoles.entries()].sort(
      (left, right) => Number(left[0]) - Number(right[0])
    );
    const target = KDMapData.Entities.find((enemy) => enemy.id === targetId);
    return {
      stateSignature: hashText(
        JSON.stringify({
          roles,
          target: target
            ? {
                id: target.id,
                x: target.x,
                y: target.y,
                hp: target.hp,
                boundLevel: target.boundLevel,
                stun: target.stun,
                freeze: target.freeze
              }
            : null,
          aggressive: data.aggressive
        })
      ),
      roles: roles.length,
      delta: {
        calls: Number(after.calls ?? 0) - Number(before.calls ?? 0),
        nativeCalls:
          Number(after.nativeCalls ?? 0) - Number(before.nativeCalls ?? 0),
        fallbackCalls:
          Number(after.fallbackCalls ?? 0) - Number(before.fallbackCalls ?? 0),
        failures: Number(after.failures ?? 0) - Number(before.failures ?? 0)
      }
    };
  }

  function hashText(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
}

function verifyFindMasterDependencyFallback() {
  "use strict";

  const fixture = globalThis.kdHybridCrowdedTurnFixture;
  if (typeof fixture !== "string") {
    throw new Error("Crowded-turn fixture is unavailable");
  }
  const status = () =>
    KDHybrid.status().systems.find(
      (entry) => entry.globalName === "KinkyDungeonFindMaster"
    );
  const originalRank = globalThis.KDEnemyRank;
  let replacementCalls = 0;
  const replacement = function (...args) {
    replacementCalls += 1;
    return Reflect.apply(originalRank, this, args);
  };
  try {
    if (!KinkyDungeonLoadGame(fixture, true)) {
      throw new Error("Could not restore the master dependency fixture");
    }
    KinkyDungeonState = "Game";
    const subject = KDMapData.Entities.find(
      (enemy) => enemy.kdHybridTurnProfile
    );
    if (!subject) {
      throw new Error("No profile enemy was available for master fallback");
    }
    KDHybrid.disableSystem("ai", "master-dependency-oracle");
    const expected = KinkyDungeonFindMaster(subject);
    if (!KDHybrid.enableSystem("ai")) {
      throw new Error("Could not enable the master adapter");
    }
    const before = { ...status() };
    globalThis.KDEnemyRank = replacement;
    let actual;
    try {
      actual = KinkyDungeonFindMaster(subject);
    } finally {
      if (globalThis.KDEnemyRank === replacement) {
        globalThis.KDEnemyRank = originalRank;
      }
    }
    const after = { ...status() };
    const delta = statusDelta(before, after);
    const exact =
      actual?.master === expected?.master &&
      Object.is(actual?.dist, expected?.dist) &&
      actual?.info === expected?.info &&
      replacementCalls > 0 &&
      delta.calls === 1 &&
      delta.nativeCalls === 0 &&
      delta.fallbackCalls === 1 &&
      delta.failures === 0;
    return { replacementCalls, delta, exact, status: after };
  } finally {
    if (globalThis.KDEnemyRank === replacement) {
      globalThis.KDEnemyRank = originalRank;
    }
    KinkyDungeonLoadGame(fixture, true);
    KinkyDungeonState = "Game";
    KDHybrid.enableSystem("ai");
  }

  function statusDelta(before, after) {
    return {
      calls: Number(after?.calls ?? 0) - Number(before?.calls ?? 0),
      nativeCalls:
        Number(after?.nativeCalls ?? 0) - Number(before?.nativeCalls ?? 0),
      fallbackCalls:
        Number(after?.fallbackCalls ?? 0) - Number(before?.fallbackCalls ?? 0),
      failures:
        Number(after?.failures ?? 0) - Number(before?.failures ?? 0)
    };
  }
}

function verifyFindMasterPotentialParity() {
  "use strict";

  const fixture = globalThis.kdHybridCrowdedTurnFixture;
  if (typeof fixture !== "string") {
    throw new Error("Crowded-turn fixture is unavailable");
  }
  const scenarios = {};
  try {
    for (const kind of ["rank", "leader"]) {
      if (!KinkyDungeonLoadGame(fixture, true)) {
        throw new Error(`Could not restore the ${kind} master fixture`);
      }
      KinkyDungeonState = "Game";
      const pair = findNearbyPair();
      if (!pair) {
        throw new Error(`No nearby pair was available for ${kind} parity`);
      }
      const { subject, candidate } = pair;
      if (kind === "rank") {
        candidate.Enemy = {
          ...candidate.Enemy,
          tags: {
            ...candidate.Enemy.tags,
            miniboss: true
          }
        };
      } else {
        KinkyDungeonSetEnemyFlag(candidate, "leader", -1);
      }

      KDHybrid.disableSystem("ai", `master-${kind}-oracle`);
      const expected = KinkyDungeonFindMaster(subject);
      if (!KDHybrid.enableSystem("ai")) {
        throw new Error(`Could not enable the ${kind} master adapter`);
      }
      const status = () =>
        KDHybrid.status().systems.find(
          (entry) => entry.globalName === "KinkyDungeonFindMaster"
        );
      const before = { ...status() };
      const actual = KinkyDungeonFindMaster(subject);
      const after = { ...status() };
      const delta = {
        calls: Number(after?.calls ?? 0) - Number(before?.calls ?? 0),
        nativeCalls:
          Number(after?.nativeCalls ?? 0) - Number(before?.nativeCalls ?? 0),
        fallbackCalls:
          Number(after?.fallbackCalls ?? 0) - Number(before?.fallbackCalls ?? 0),
        failures:
          Number(after?.failures ?? 0) - Number(before?.failures ?? 0)
      };
      scenarios[kind] = {
        subjectId: subject.id,
        candidateId: candidate.id,
        expectedMasterId: expected?.master?.id ?? null,
        actualMasterId: actual?.master?.id ?? null,
        expectedDistance: expected?.dist,
        actualDistance: actual?.dist,
        delta,
        exact:
          expected?.master === candidate &&
          actual?.master === expected?.master &&
          Object.is(actual?.dist, expected?.dist) &&
          actual?.info === expected?.info &&
          delta.calls === 1 &&
          delta.nativeCalls === 1 &&
          delta.fallbackCalls === 0 &&
          delta.failures === 0
      };
    }
  } finally {
    KinkyDungeonLoadGame(fixture, true);
    KinkyDungeonState = "Game";
    KDHybrid.enableSystem("ai");
  }
  return {
    passed: Object.values(scenarios).every((scenario) => scenario.exact),
    scenarios
  };

  function findNearbyPair() {
    const entities = KDMapData.Entities.filter(
      (enemy) =>
        enemy.kdHybridTurnProfile &&
        !enemy.master &&
        !enemy.Enemy?.master &&
        !KDEntityHasFlag(enemy, "led")
    );
    for (const subject of entities) {
      if (
        subject.x < 4 ||
        subject.y < 4 ||
        subject.x + 3 >= KDMapData.GridWidth ||
        subject.y + 3 >= KDMapData.GridHeight
      ) {
        continue;
      }
      for (const candidate of entities) {
        if (
          candidate !== subject &&
          candidate.x >= subject.x - 4 &&
          candidate.x < subject.x + 4 &&
          candidate.y >= subject.y - 4 &&
          candidate.y < subject.y + 4 &&
          !KDHostile(candidate, subject) &&
          KDGetFaction(candidate) == KDGetFaction(subject)
        ) {
          return { subject, candidate };
        }
      }
    }
    return null;
  }
}

function verifySourceNearestPlayerDependencyFallback() {
  "use strict";

  const fixture = globalThis.kdHybridCrowdedTurnFixture;
  if (typeof fixture !== "string") {
    throw new Error("Crowded-turn fixture is unavailable");
  }
  const patchVersion = globalThis.KDHybridSourcePatches?.nearestPlayer;
  if (typeof patchVersion !== "string") {
    throw new Error("Source nearest-player patch is unavailable");
  }
  const hadControl = Object.prototype.hasOwnProperty.call(
    globalThis,
    "KDHybridSourcePatchControl"
  );
  const previousControl = globalThis.KDHybridSourcePatchControl;
  if (
    previousControl !== undefined &&
    (previousControl === null || typeof previousControl !== "object")
  ) {
    throw new Error("KDHybridSourcePatchControl is not an object");
  }
  const control = previousControl || {};
  const hadDisable = Object.prototype.hasOwnProperty.call(
    control,
    "disableNearestPlayer"
  );
  const previousDisable = control.disableNearestPlayer;
  const hadStats = Object.prototype.hasOwnProperty.call(
    control,
    "nearestPlayerStats"
  );
  const previousStats = control.nearestPlayerStats;
  const originalHelpless = globalThis.KDHelpless;
  let replacementCalls = 0;
  const replacement = function (...args) {
    replacementCalls += 1;
    return Reflect.apply(originalHelpless, this, args);
  };

  globalThis.KDHybridSourcePatchControl = control;
  try {
    const baseline = runMode(false);
    const dependencyFallback = runMode(true);
    return {
      implementation: "source",
      patchVersion,
      expectedId: baseline.resultId,
      actualId: dependencyFallback.resultId,
      replacementCalls,
      stats: dependencyFallback.stats,
      baseline,
      dependencyFallback,
      exact:
        baseline.stateSignature === dependencyFallback.stateSignature &&
        replacementCalls > 0 &&
        dependencyFallback.stats.calls === 1 &&
        dependencyFallback.stats.optimizedCalls === 0 &&
        dependencyFallback.stats.fallbackCalls === 1
    };
  } finally {
    if (globalThis.KDHelpless === replacement) {
      globalThis.KDHelpless = originalHelpless;
    }
    if (hadDisable) control.disableNearestPlayer = previousDisable;
    else delete control.disableNearestPlayer;
    if (hadStats) control.nearestPlayerStats = previousStats;
    else delete control.nearestPlayerStats;
    if (hadControl) {
      globalThis.KDHybridSourcePatchControl = previousControl;
    } else {
      delete globalThis.KDHybridSourcePatchControl;
    }
    KinkyDungeonLoadGame(fixture, true);
    KinkyDungeonState = "Game";
    KDHybrid.enableSystem("ai");
  }

  function runMode(replaceDependency) {
    if (!KinkyDungeonLoadGame(fixture, true)) {
      throw new Error("Could not restore the source nearest-player fixture");
    }
    KinkyDungeonState = "Game";
    KDHybrid.enableSystem("ai");
    const entities = KDMapData.Entities.filter(
      (enemy) => enemy.kdHybridTurnProfile
    );
    const subject =
      entities.find((enemy) =>
        entities.some(
          (candidate) =>
            candidate !== enemy &&
            Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) <= 10
        )
      ) ?? entities[0];
    if (!subject) {
      throw new Error("No profile enemy was available for source fallback");
    }
    const stats = {
      calls: 0,
      optimizedCalls: 0,
      fallbackCalls: 0,
      candidates: 0,
      canonicalCandidates: 0,
      guardedCandidates: 0
    };
    control.disableNearestPlayer = !replaceDependency;
    control.nearestPlayerStats = stats;
    if (replaceDependency) globalThis.KDHelpless = replacement;
    let result;
    try {
      result = KinkyDungeonNearestPlayer(subject, false, true, 10);
    } finally {
      if (
        replaceDependency &&
        globalThis.KDHelpless === replacement
      ) {
        globalThis.KDHelpless = originalHelpless;
      }
    }
    const state = {
      result: result?.player ? "player" : (result?.id ?? null),
      aiHelpPlayer: KinkyDungeonFlags.get("AIHelpPlayer") ?? null
    };
    return {
      resultId: result?.id ?? null,
      stateSignature: JSON.stringify(state),
      stats: { ...stats }
    };
  }
}

function verifySourceNearestPlayerGuardedParity() {
  "use strict";

  const fixture = globalThis.kdHybridCrowdedTurnFixture;
  if (typeof fixture !== "string") {
    throw new Error("Crowded-turn fixture is unavailable");
  }
  const hadControl = Object.prototype.hasOwnProperty.call(
    globalThis,
    "KDHybridSourcePatchControl"
  );
  const previousControl = globalThis.KDHybridSourcePatchControl;
  if (
    previousControl !== undefined &&
    (previousControl === null || typeof previousControl !== "object")
  ) {
    throw new Error("KDHybridSourcePatchControl is not an object");
  }
  const control = previousControl || {};
  const hadDisable = Object.prototype.hasOwnProperty.call(
    control,
    "disableNearestPlayer"
  );
  const previousDisable = control.disableNearestPlayer;
  const hadStats = Object.prototype.hasOwnProperty.call(
    control,
    "nearestPlayerStats"
  );
  const previousStats = control.nearestPlayerStats;
  const scenarios = {};

  globalThis.KDHybridSourcePatchControl = control;
  try {
    for (const kind of ["packed", "noncanonical"]) {
      const baseline = runMode(kind, false);
      const optimized = runMode(kind, true);
      scenarios[kind] = {
        baseline,
        optimized,
        exact:
          baseline.stateSignature === optimized.stateSignature &&
          baseline.stats.calls === 1 &&
          baseline.stats.fallbackCalls === 1 &&
          optimized.stats.calls === 1 &&
          optimized.stats.optimizedCalls === 1 &&
          optimized.stats.fallbackCalls === 0 &&
          optimized.stats.guardedCandidates > 0
      };
    }
  } finally {
    if (hadDisable) control.disableNearestPlayer = previousDisable;
    else delete control.disableNearestPlayer;
    if (hadStats) control.nearestPlayerStats = previousStats;
    else delete control.nearestPlayerStats;
    if (hadControl) {
      globalThis.KDHybridSourcePatchControl = previousControl;
    } else {
      delete globalThis.KDHybridSourcePatchControl;
    }
    KinkyDungeonLoadGame(fixture, true);
    KinkyDungeonState = "Game";
    KDHybrid.enableSystem("ai");
  }
  return {
    implementation: "source",
    passed: Object.values(scenarios).every((scenario) => scenario.exact),
    scenarios
  };

  function runMode(kind, optimized) {
    if (!KinkyDungeonLoadGame(fixture, true)) {
      throw new Error(`Could not restore the ${kind} source targeting fixture`);
    }
    KinkyDungeonState = "Game";
    KDHybrid.enableSystem("ai");
    const pair = findNearbyPair();
    if (!pair) {
      throw new Error(`No nearby pair was available for ${kind} source parity`);
    }
    const { subject, candidate } = pair;
    if (kind === "packed") {
      candidate.Enemy = { name: candidate.Enemy.name };
      candidate.modified = false;
    } else {
      candidate.Enemy = { ...candidate.Enemy };
      candidate.modified = true;
    }
    const stats = {
      calls: 0,
      optimizedCalls: 0,
      fallbackCalls: 0,
      candidates: 0,
      canonicalCandidates: 0,
      guardedCandidates: 0
    };
    control.disableNearestPlayer = !optimized;
    control.nearestPlayerStats = stats;
    const result = KinkyDungeonNearestPlayer(
      subject,
      false,
      true,
      10
    );
    const state = {
      result: result?.player ? "player" : (result?.id ?? null),
      subject: subject.id,
      candidate: candidate.id,
      candidateEnemy: candidate.Enemy,
      candidateModified: candidate.modified,
      candidateCanonical:
        candidate.Enemy ===
        KinkyDungeonGetEnemyByName(
          candidate.Enemy?.name || candidate.Enemy
        )
    };
    return {
      ...state,
      stateSignature: JSON.stringify(state),
      stats: { ...stats }
    };
  }

  function findNearbyPair() {
    const entities = KDMapData.Entities.filter(
      (enemy) => enemy.kdHybridTurnProfile && enemy.Enemy
    );
    for (const subject of entities) {
      for (const candidate of entities) {
        if (
          candidate !== subject &&
          Math.max(
            Math.abs(candidate.x - subject.x),
            Math.abs(candidate.y - subject.y)
          ) <= 4
        ) {
          return { subject, candidate };
        }
      }
    }
    return null;
  }
}

function verifySourceNearestPlayerTurnParity(runTurns) {
  "use strict";

  const fixture = globalThis.kdHybridCrowdedTurnFixture;
  if (typeof fixture !== "string") {
    throw new Error("Crowded-turn fixture is unavailable");
  }
  const source = globalThis.KinkyDungeonNearestPlayer;
  if (typeof source !== "function") {
    throw new Error("KinkyDungeonNearestPlayer is unavailable");
  }
  const hadControl = Object.prototype.hasOwnProperty.call(
    globalThis,
    "KDHybridSourcePatchControl"
  );
  const previousControl = globalThis.KDHybridSourcePatchControl;
  if (
    previousControl !== undefined &&
    (previousControl === null || typeof previousControl !== "object")
  ) {
    throw new Error("KDHybridSourcePatchControl is not an object");
  }
  const control = previousControl || {};
  const hadDisable = Object.prototype.hasOwnProperty.call(
    control,
    "disableNearestPlayer"
  );
  const previousDisable = control.disableNearestPlayer;
  const hadStats = Object.prototype.hasOwnProperty.call(
    control,
    "nearestPlayerStats"
  );
  const previousStats = control.nearestPlayerStats;
  let calls = 0;
  let exactMatches = 0;
  let mismatches = 0;
  const mismatchDetails = [];

  const verifyingNearestPlayer = function (...args) {
    calls += 1;
    const hadAiHelp = KinkyDungeonFlags.has("AIHelpPlayer");
    const previousAiHelp = KinkyDungeonFlags.get("AIHelpPlayer");
    control.disableNearestPlayer = true;
    const expected = Reflect.apply(source, this, args);
    if (hadAiHelp) KinkyDungeonFlags.set("AIHelpPlayer", previousAiHelp);
    else KinkyDungeonFlags.delete("AIHelpPlayer");
    control.disableNearestPlayer = false;
    const actual = Reflect.apply(source, this, args);
    if (actual === expected) {
      exactMatches += 1;
    } else {
      mismatches += 1;
      if (mismatchDetails.length < 20) {
        mismatchDetails.push({
          enemyId: args[0]?.id ?? null,
          enemyFaction: args[0] ? KDGetFaction(args[0]) : null,
          enemyRage: args[0]?.rage ?? null,
          enemyHostile: args[0]?.hostile ?? null,
          decoy: args[2] ?? null,
          visionRadius: args[3] ?? null,
          expectedId: expected?.id ?? null,
          actualId: actual?.id ?? null
        });
      }
    }
    return actual;
  };

  globalThis.KDHybridSourcePatchControl = control;
  control.nearestPlayerStats = undefined;
  try {
    if (!KinkyDungeonLoadGame(fixture, true)) {
      throw new Error("Could not restore the source turn-parity fixture");
    }
    KinkyDungeonState = "Game";
    KDHybrid.enableSystem("ai");
    control.disableNearestPlayer = false;
    globalThis.KinkyDungeonNearestPlayer = verifyingNearestPlayer;
    const run = runTurns(1);
    return {
      implementation: "source",
      calls,
      exactMatches,
      mismatches,
      mismatchDetails,
      turnMilliseconds: run.totalMilliseconds,
      failures: 0,
      stateSignature: run.stateSignature
    };
  } finally {
    if (globalThis.KinkyDungeonNearestPlayer === verifyingNearestPlayer) {
      globalThis.KinkyDungeonNearestPlayer = source;
    }
    if (hadDisable) control.disableNearestPlayer = previousDisable;
    else delete control.disableNearestPlayer;
    if (hadStats) control.nearestPlayerStats = previousStats;
    else delete control.nearestPlayerStats;
    if (hadControl) {
      globalThis.KDHybridSourcePatchControl = previousControl;
    } else {
      delete globalThis.KDHybridSourcePatchControl;
    }
    KinkyDungeonLoadGame(fixture, true);
    KinkyDungeonState = "Game";
    KDHybrid.enableSystem("ai");
  }
}

function verifyNearestPlayerDependencyFallback() {
  "use strict";

  const fixture = globalThis.kdHybridCrowdedTurnFixture;
  if (typeof fixture !== "string") {
    throw new Error("Crowded-turn fixture is unavailable");
  }
  const status = () =>
    KDHybrid.status().systems.find(
      (entry) => entry.globalName === "KinkyDungeonNearestPlayer"
    );
  const originalHelpless = globalThis.KDHelpless;
  let replacementCalls = 0;
  const replacement = function (...args) {
    replacementCalls += 1;
    return Reflect.apply(originalHelpless, this, args);
  };
  try {
    if (!KinkyDungeonLoadGame(fixture, true)) {
      throw new Error("Could not restore the nearest-player dependency fixture");
    }
    KinkyDungeonState = "Game";
    const entities = KDMapData.Entities.filter(
      (enemy) => enemy.kdHybridTurnProfile
    );
    const subject =
      entities.find((enemy) =>
        entities.some(
          (candidate) =>
            candidate !== enemy &&
            Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) <= 10
        )
      ) ?? entities[0];
    if (!subject) {
      throw new Error("No profile enemy was available for nearest fallback");
    }
    KDHybrid.disableSystem("ai", "nearest-dependency-oracle");
    const expected = KinkyDungeonNearestPlayer(
      subject,
      false,
      true,
      10
    );
    if (!KDHybrid.enableSystem("ai")) {
      throw new Error("Could not enable the nearest-player adapter");
    }
    const before = { ...status() };
    globalThis.KDHelpless = replacement;
    let actual;
    try {
      actual = KinkyDungeonNearestPlayer(subject, false, true, 10);
    } finally {
      if (globalThis.KDHelpless === replacement) {
        globalThis.KDHelpless = originalHelpless;
      }
    }
    const after = { ...status() };
    const delta = statusDelta(before, after);
    const exact =
      actual === expected &&
      replacementCalls > 0 &&
      delta.calls === 1 &&
      delta.nativeCalls === 0 &&
      delta.fallbackCalls === 1 &&
      delta.failures === 0;
    return {
      expectedId: expected?.id ?? null,
      actualId: actual?.id ?? null,
      replacementCalls,
      delta,
      exact,
      status: after
    };
  } finally {
    if (globalThis.KDHelpless === replacement) {
      globalThis.KDHelpless = originalHelpless;
    }
    KinkyDungeonLoadGame(fixture, true);
    KinkyDungeonState = "Game";
    KDHybrid.enableSystem("ai");
  }

  function statusDelta(before, after) {
    return {
      calls: Number(after?.calls ?? 0) - Number(before?.calls ?? 0),
      nativeCalls:
        Number(after?.nativeCalls ?? 0) - Number(before?.nativeCalls ?? 0),
      fallbackCalls:
        Number(after?.fallbackCalls ?? 0) - Number(before?.fallbackCalls ?? 0),
      failures:
        Number(after?.failures ?? 0) - Number(before?.failures ?? 0)
    };
  }
}

function verifyNearestPlayerGuardedParity() {
  "use strict";

  const fixture = globalThis.kdHybridCrowdedTurnFixture;
  if (typeof fixture !== "string") {
    throw new Error("Crowded-turn fixture is unavailable");
  }
  const scenarios = {};
  try {
    for (const kind of ["packed", "noncanonical"]) {
      const baseline = runMode(kind, false);
      const optimized = runMode(kind, true);
      scenarios[kind] = {
        baseline,
        optimized,
        exact:
          baseline.stateSignature === optimized.stateSignature &&
          optimized.delta.calls === 1 &&
          optimized.delta.nativeCalls === 1 &&
          optimized.delta.fallbackCalls === 0 &&
          optimized.delta.failures === 0
      };
    }
  } finally {
    KinkyDungeonLoadGame(fixture, true);
    KinkyDungeonState = "Game";
    KDHybrid.enableSystem("ai");
  }
  return {
    passed: Object.values(scenarios).every((scenario) => scenario.exact),
    scenarios
  };

  function runMode(kind, optimized) {
    if (!KinkyDungeonLoadGame(fixture, true)) {
      throw new Error(`Could not restore the ${kind} nearest-player fixture`);
    }
    KinkyDungeonState = "Game";
    const pair = findNearbyPair();
    if (!pair) {
      throw new Error(`No nearby pair was available for ${kind} parity`);
    }
    const { subject, candidate } = pair;
    if (kind === "packed") {
      candidate.Enemy = { name: candidate.Enemy.name };
      candidate.modified = false;
    } else {
      candidate.Enemy = { ...candidate.Enemy };
      candidate.modified = true;
    }
    const enabled = optimized
      ? KDHybrid.enableSystem("ai")
      : KDHybrid.disableSystem("ai", `nearest-${kind}-oracle`);
    if (!enabled) {
      throw new Error(`Could not enter the ${kind} nearest-player mode`);
    }
    const status = () =>
      KDHybrid.status().systems.find(
        (entry) => entry.globalName === "KinkyDungeonNearestPlayer"
      );
    const before = { ...status() };
    const result = KinkyDungeonNearestPlayer(
      subject,
      false,
      true,
      10
    );
    const after = { ...status() };
    const delta = {
      calls: Number(after?.calls ?? 0) - Number(before?.calls ?? 0),
      nativeCalls:
        Number(after?.nativeCalls ?? 0) - Number(before?.nativeCalls ?? 0),
      fallbackCalls:
        Number(after?.fallbackCalls ?? 0) - Number(before?.fallbackCalls ?? 0),
      failures:
        Number(after?.failures ?? 0) - Number(before?.failures ?? 0)
    };
    const state = {
      result: result?.player ? "player" : (result?.id ?? null),
      subject: subject.id,
      candidate: candidate.id,
      candidateEnemy: candidate.Enemy,
      candidateModified: candidate.modified,
      candidateCanonical:
        candidate.Enemy ===
        KinkyDungeonGetEnemyByName(
          candidate.Enemy?.name || candidate.Enemy
        )
    };
    return {
      ...state,
      stateSignature: JSON.stringify(state),
      delta
    };
  }

  function findNearbyPair() {
    const entities = KDMapData.Entities.filter(
      (enemy) => enemy.kdHybridTurnProfile && enemy.Enemy
    );
    for (const subject of entities) {
      for (const candidate of entities) {
        if (
          candidate !== subject &&
          Math.max(
            Math.abs(candidate.x - subject.x),
            Math.abs(candidate.y - subject.y)
          ) <= 4
        ) {
          return { subject, candidate };
        }
      }
    }
    return null;
  }
}

function verifyNearestPlayerTurnParity() {
  "use strict";

  let calls = 0;
  let exactMatches = 0;
  let mismatches = 0;
  const mismatchDetails = [];
  const status = () =>
    KDHybrid.status().systems.find(
      (entry) => entry.globalName === "KinkyDungeonNearestPlayer"
    );
  KDHybrid.enableSystem("ai");
  const before = { ...status() };
  const hookId = KDHybrid.registerHook(
    "ai",
    "after",
    (context) => {
      if (context.globalName !== "KinkyDungeonNearestPlayer") {
        return;
      }
      calls += 1;
      KDHybrid.disableSystem("ai", "nearest-turn-parity-oracle");
      let expected;
      try {
        expected = KinkyDungeonNearestPlayer(...context.args);
      } finally {
        if (!KDHybrid.enableSystem("ai")) {
          throw new Error("Could not restore the nearest-player adapter");
        }
      }
      if (context.result === expected) {
        exactMatches += 1;
      } else {
        mismatches += 1;
        if (mismatchDetails.length < 20) {
          mismatchDetails.push({
            enemyId: context.args[0]?.id,
            expectedId: expected?.id ?? null,
            actualId: context.result?.id ?? null
          });
        }
      }
    },
    { id: "kd-hybrid-turn-nearest-parity", priority: -1_000 }
  );
  let turnMilliseconds;
  try {
    const started = performance.now();
    KinkyDungeonAdvanceTime(1, false, true);
    turnMilliseconds = performance.now() - started;
  } finally {
    KDHybrid.unregisterHook(hookId);
    KDHybrid.enableSystem("ai");
  }
  const after = { ...status() };
  return {
    calls,
    exactMatches,
    mismatches,
    mismatchDetails,
    turnMilliseconds,
    failures:
      Number(after?.failures ?? 0) - Number(before?.failures ?? 0),
    status: after
  };
}

function verifyEnemyUpdateCacheFallbacks() {
  "use strict";

  const fixture = globalThis.kdHybridCrowdedTurnFixture;
  if (typeof fixture !== "string") {
    throw new Error("Crowded-turn fixture is unavailable");
  }
  const scenarios = {};
  try {
    for (const kind of ["dependency", "event", "bullet"]) {
      const baseline = runMode(kind, false);
      const optimized = runMode(kind, true);
      const expectedNativeCalls = kind === "bullet" ? 1 : 0;
      const expectedFallbackCalls = kind === "bullet" ? 0 : 1;
      const routeExact =
        optimized.delta.calls === 1 &&
        optimized.delta.nativeCalls === expectedNativeCalls &&
        optimized.delta.fallbackCalls === expectedFallbackCalls &&
        optimized.delta.failures === 0;
      const riskExact =
        kind === "dependency"
          ? Number(
              optimized.events["fallback:dependency-changed"] ?? 0
            ) === 1 && optimized.replacementCalls > 0
          : kind === "event"
            ? Number(
                optimized.events["fallback:active-movement-events"] ?? 0
              ) === 1
            : Number(optimized.events["unsafe-move"] ?? 0) > 0;
      scenarios[kind] = {
        baseline,
        optimized,
        exact:
          baseline.stateSignature === optimized.stateSignature &&
          baseline.cacheExact &&
          optimized.cacheExact &&
          routeExact &&
          riskExact
      };
    }
  } finally {
    restore();
    KDHybrid.enableSystem("ai");
    KDHybrid.enableSystem("movement");
  }
  return {
    passed: Object.values(scenarios).every((scenario) => scenario.exact),
    scenarios
  };

  function runMode(kind, optimized) {
    restore();
    if (kind === "event") {
      const enemy = KDMapData.Entities.find(
        (candidate) => candidate.kdHybridTurnProfile && candidate.Enemy
      );
      if (!enemy) {
        throw new Error("No profile enemy was available for event fallback");
      }
      enemy.Enemy = {
        ...enemy.Enemy,
        events: [
          ...(enemy.Enemy.events ?? []),
          {
            trigger: "enemyMove",
            type: "__KDHybridParityNoop"
          }
        ]
      };
      enemy.modified = true;
      KDUpdateEnemyCache = true;
    } else if (kind === "bullet") {
      const movers = KDMapData.Entities.filter(
        (candidate) => candidate.kdHybridTurnProfile && candidate.Enemy
      ).slice(0, 8);
      if (movers.length === 0) {
        throw new Error("No profile enemy was available for bullet fallback");
      }
      const moverSet = new Set(movers);
      for (const enemy of [...KDMapData.Entities]) {
        if (!moverSet.has(enemy)) KDRemoveEntity(enemy);
      }
      for (const enemy of movers) {
        enemy.faction = "Enemy";
        enemy.rage = 0;
        enemy.hostile = 9_999;
        enemy.ceasefire = 0;
        enemy.allied = 0;
        enemy.aware = true;
        enemy.vp = 1;
        enemy.aggro = 1;
        enemy.warningTiles = [];
        enemy.attackPoints = 0;
        enemy.movePoints = 0;
        enemy.gx = KinkyDungeonPlayerEntity.x;
        enemy.gy = KinkyDungeonPlayerEntity.y;
      }
      KinkyDungeonRefreshEnemiesCache();
      KDMapData.Bullets.push({
        x: -10_000,
        y: -10_000,
        time: 2,
        bullet: null
      });
    }

    const entered = optimized
      ? KDHybrid.enableSystem("movement")
      : KDHybrid.disableSystem("movement", `enemy-update-${kind}-oracle`);
    if (!entered) {
      throw new Error(`Could not enter the ${kind} enemy-update mode`);
    }
    KDHybrid.enableSystem("ai");
    const status = () =>
      KDHybrid.status().systems.find(
        (entry) => entry.globalName === "KinkyDungeonUpdateEnemies"
      );
    const before = { ...status() };
    const observerName = "__KDHybridEnemyUpdateCacheObserver";
    const hadObserver = Object.prototype.hasOwnProperty.call(
      globalThis,
      observerName
    );
    const previousObserver = globalThis[observerName];
    const events = {};
    globalThis[observerName] = (event, detail) => {
      events[event] = Number(events[event] ?? 0) + 1;
      if (event === "fallback" && detail?.reason) {
        const key = `${event}:${detail.reason}`;
        events[key] = Number(events[key] ?? 0) + 1;
      }
    };

    const originalDependency = globalThis.KDGetEnemyCache;
    let replacementCalls = 0;
    const replacement = function (...args) {
      replacementCalls += 1;
      return Reflect.apply(originalDependency, this, args);
    };
    if (kind === "dependency") {
      globalThis.KDGetEnemyCache = replacement;
    }
    try {
      KinkyDungeonUpdateEnemies(10, false);
    } finally {
      if (
        kind === "dependency" &&
        globalThis.KDGetEnemyCache === replacement
      ) {
        globalThis.KDGetEnemyCache = originalDependency;
      }
      if (hadObserver) {
        globalThis[observerName] = previousObserver;
      } else {
        delete globalThis[observerName];
      }
    }
    const after = { ...status() };
    return {
      ...snapshot(),
      replacementCalls,
      events,
      delta: statusDelta(before, after),
      status: after
    };
  }

  function restore() {
    if (!KinkyDungeonLoadGame(fixture, true)) {
      throw new Error("Could not restore the enemy-update parity fixture");
    }
    KinkyDungeonState = "Game";
    KDCommanderRoles.clear();
    KDStruggleAssisters = {};
    KDCapturers = {};
    KDAssaulters = 0;
    KDAssaulterList = [];
    KDMaxAssaulters = 3;
    KDStationedChokepoints = {};
    KDStationedChokepointsDist = {};
    KD_Avg_VX = 0;
    KD_Avg_VY = 0;
  }

  function snapshot() {
    const expected = new Map();
    for (const enemy of KDMapData.Entities) {
      expected.set(`${enemy.x},${enemy.y}`, enemy);
    }
    const cache = KDGetEnemyCache();
    let cacheExact = cache.size === expected.size;
    if (cacheExact) {
      for (const [key, enemy] of expected) {
        if (cache.get(key) !== enemy) {
          cacheExact = false;
          break;
        }
      }
    }
    const saveText = JSON.stringify(KinkyDungeonSaveGame(true));
    return {
      stateSignature: `${hashText(saveText)}:${saveText.length}`,
      cacheExact,
      cacheSize: cache.size,
      expectedCacheSize: expected.size
    };
  }

  function statusDelta(before, after) {
    return {
      calls: Number(after?.calls ?? 0) - Number(before?.calls ?? 0),
      nativeCalls:
        Number(after?.nativeCalls ?? 0) - Number(before?.nativeCalls ?? 0),
      fallbackCalls:
        Number(after?.fallbackCalls ?? 0) -
        Number(before?.fallbackCalls ?? 0),
      failures:
        Number(after?.failures ?? 0) - Number(before?.failures ?? 0)
    };
  }

  function hashText(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
}

function verifyJailKeyEarlyReturnFallbacks() {
  "use strict";

  const fixture = globalThis.kdHybridCrowdedTurnFixture;
  if (typeof fixture !== "string") {
    throw new Error("Crowded-turn fixture is unavailable");
  }
  const scenarios = {};
  try {
    for (const kind of ["full", "missing", "dependency"]) {
      const baseline = runMode(kind, false);
      const optimized = runMode(kind, true);
      const expectedNativeCalls = kind === "full" ? 1 : 0;
      const expectedFallbackCalls = kind === "full" ? 0 : 1;
      const routeExact =
        optimized.delta.calls === 1 &&
        optimized.delta.nativeCalls === expectedNativeCalls &&
        optimized.delta.fallbackCalls === expectedFallbackCalls &&
        optimized.delta.failures === 0;
      const eventExact =
        kind === "full"
          ? Number(optimized.events["skipped-scan"] ?? 0) === 1
          : Number(optimized.events.fallback ?? 0) === 1;
      const dependencyExact =
        kind !== "dependency" || optimized.replacementCalls > 0;
      scenarios[kind] = {
        baseline,
        optimized,
        exact:
          baseline.stateSignature === optimized.stateSignature &&
          routeExact &&
          eventExact &&
          dependencyExact
      };
    }
  } finally {
    restore();
    KDHybrid.enableSystem("events");
  }
  return {
    passed: Object.values(scenarios).every((scenario) => scenario.exact),
    scenarios
  };

  function runMode(kind, optimized) {
    restore();
    if (kind === "full") {
      const existingKeys = KDMapData.GroundItems.filter(
        (item) => item.name === "Keyring"
      ).length;
      for (let index = existingKeys; index < KDMaxKeys; index += 1) {
        KDMapData.GroundItems.push({
          x: KinkyDungeonPlayerEntity.x,
          y: KinkyDungeonPlayerEntity.y,
          name: "Keyring"
        });
      }
    } else if (kind === "missing") {
      KDMapData.GroundItems = KDMapData.GroundItems.filter(
        (item) => item.name !== "Keyring"
      );
    }
    const entered = optimized
      ? KDHybrid.enableSystem("events")
      : KDHybrid.disableSystem("events", `jail-key-${kind}-oracle`);
    if (!entered) {
      throw new Error(`Could not enter the ${kind} jail-key mode`);
    }
    const status = () =>
      KDHybrid.status().systems.find(
        (entry) => entry.globalName === "KinkyDungeonPlaceJailKeys"
      );
    const before = { ...status() };
    const observerName = "__KDHybridJailKeyObserver";
    const hadObserver = Object.prototype.hasOwnProperty.call(
      globalThis,
      observerName
    );
    const previousObserver = globalThis[observerName];
    const events = {};
    globalThis[observerName] = (event, detail) => {
      events[event] = Number(events[event] ?? 0) + 1;
      if (event === "fallback" && detail?.reason) {
        const key = `${event}:${detail.reason}`;
        events[key] = Number(events[key] ?? 0) + 1;
      }
    };

    const originalDependency = globalThis.KinkyDungeonMapGet;
    let replacementCalls = 0;
    const replacement = function (...args) {
      replacementCalls += 1;
      return Reflect.apply(originalDependency, this, args);
    };
    if (kind === "dependency") {
      globalThis.KinkyDungeonMapGet = replacement;
    }
    try {
      KinkyDungeonPlaceJailKeys();
    } finally {
      if (
        kind === "dependency" &&
        globalThis.KinkyDungeonMapGet === replacement
      ) {
        globalThis.KinkyDungeonMapGet = originalDependency;
      }
      if (hadObserver) {
        globalThis[observerName] = previousObserver;
      } else {
        delete globalThis[observerName];
      }
    }
    const after = { ...status() };
    return {
      ...snapshot(),
      replacementCalls,
      events,
      delta: statusDelta(before, after),
      status: after
    };
  }

  function restore() {
    if (!KinkyDungeonLoadGame(fixture, true)) {
      throw new Error("Could not restore the jail-key parity fixture");
    }
    KinkyDungeonState = "Game";
  }

  function snapshot() {
    const saveText = JSON.stringify(KinkyDungeonSaveGame(true));
    return {
      stateSignature: `${hashText(saveText)}:${saveText.length}`,
      keyrings: KDMapData.GroundItems.filter(
        (item) => item.name === "Keyring"
      ).length,
      maxKeys: KDMaxKeys
    };
  }

  function statusDelta(before, after) {
    return {
      calls: Number(after?.calls ?? 0) - Number(before?.calls ?? 0),
      nativeCalls:
        Number(after?.nativeCalls ?? 0) - Number(before?.nativeCalls ?? 0),
      fallbackCalls:
        Number(after?.fallbackCalls ?? 0) -
        Number(before?.fallbackCalls ?? 0),
      failures:
        Number(after?.failures ?? 0) - Number(before?.failures ?? 0)
    };
  }

  function hashText(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
}

function measurePathfindingFallbacks(turns) {
  "use strict";
  if (!Number.isInteger(turns) || turns < 1) turns = 1;

  const observerName = "__KDHybridPathfindingFallbackObserver";
  const hadObserver = Object.prototype.hasOwnProperty.call(
    globalThis,
    observerName
  );
  const previousObserver = globalThis[observerName];
  const reasons = {};
  const argumentShapes = {};
  const pathStatus = () =>
    KDHybrid.status().systems.find(
      (status) => status.globalName === "KinkyDungeonFindPath"
    );
  KDHybrid.enableSystem("pathfinding");
  const before = { ...pathStatus() };
  globalThis[observerName] = (reason) => {
    const key = typeof reason === "string" ? reason : String(reason);
    reasons[key] = (reasons[key] ?? 0) + 1;
  };
  const hookId = KDHybrid.registerHook(
    "pathfinding",
    "before",
    (context) => {
      const args = context.args;
      if (!args[4]) return;
      const shape = [
        args[11] !== undefined && args[11] !== null
          ? "enemy-context"
          : "no-enemy-context",
        args[16] ? "allow-passable" : "no-passable",
        args[18] !== undefined && args[18] !== null && args[18] !== 0
          ? "leash-target"
          : "no-leash-target",
        args[5] ? "block-player" : "no-block-player",
        args[6] ? "ignore-locks" : "respect-locks",
        args[8] ? "require-light" : "no-light",
        args[9] ? "no-doors" : "doors",
        args[10] ? "door-memory" : "no-door-memory",
        args[12] ? "trim-long" : "no-trim",
        args[14] ? "taxicab" : "diagonal",
        args[15] ? "ignore-traffic" : "traffic",
        args[17] ? "ignore-weighting" : "weighted",
        args[7] === KinkyDungeonMovableTilesSmartEnemy
          ? "smart-enemy-tiles"
          : args[7] === KinkyDungeonMovableTilesEnemy
            ? "enemy-tiles"
            : "custom-tiles",
        typeof args[11]?.Enemy?.name === "string"
          ? `enemy:${args[11].Enemy.name}`
          : "enemy:none"
      ].join("|");
      argumentShapes[shape] = (argumentShapes[shape] ?? 0) + 1;
    },
    { id: "kd-hybrid-pathfinding-fallback-audit", priority: -2_000 }
  );

  let turnMilliseconds;
  try {
    const started = performance.now();
    for (let turn = 0; turn < turns; turn += 1) {
      KinkyDungeonAdvanceTime(1, false, true);
    }
    turnMilliseconds = performance.now() - started;
  } finally {
    KDHybrid.unregisterHook(hookId);
    if (hadObserver) {
      globalThis[observerName] = previousObserver;
    } else {
      delete globalThis[observerName];
    }
  }
  const after = { ...pathStatus() };
  return {
    turns,
    turnMilliseconds,
    reasons,
    argumentShapes,
    delta: {
      calls: Number(after.calls ?? 0) - Number(before.calls ?? 0),
      nativeCalls:
        Number(after.nativeCalls ?? 0) - Number(before.nativeCalls ?? 0),
      fallbackCalls:
        Number(after.fallbackCalls ?? 0) - Number(before.fallbackCalls ?? 0),
      failures: Number(after.failures ?? 0) - Number(before.failures ?? 0)
    },
    status: after
  };
}

async function measureTextureUploads(turns) {
  "use strict";
  if (!Number.isInteger(turns) || turns < 1) turns = 1;
  KDHybrid.enableSystem("ai");
  KDHybrid.enableSystem("movement");
  KDHybrid.enableSystem("pathfinding");

  const sourceIds = new WeakMap();
  const sources = new Map();
  const stacks = new Map();
  const callsByMethod = {};
  const restorers = [];
  let nextSourceId = 1;
  let calls = 0;
  let estimatedBytes = 0;
  let reusedSourceCalls = 0;
  let phase = 0;
  const phases = [
    { calls: 0, estimatedBytes: 0, reusedSourceCalls: 0, turnMilliseconds: 0 },
    { calls: 0, estimatedBytes: 0, reusedSourceCalls: 0, turnMilliseconds: 0 }
  ];

  const dimension = (source, primary, fallback) => {
    const first = Number(source?.[primary]);
    if (Number.isFinite(first) && first >= 0) return first;
    const second = Number(source?.[fallback]);
    return Number.isFinite(second) && second >= 0 ? second : 0;
  };
  const sourceUrl = (source) => {
    for (const key of ["currentSrc", "src"]) {
      const value = source?.[key];
      if (typeof value === "string" && value.length > 0) {
        return value.length > 240 ? `${value.slice(0, 237)}...` : value;
      }
    }
    return null;
  };
  const stackKey = () => {
    const stack = new Error().stack;
    if (typeof stack !== "string") return "(stack unavailable)";
    return stack
      .split("\n")
      .slice(3, 8)
      .map((line) => line.trim())
      .join(" <- ");
  };
  const canvasHash = (source, width, height) => {
    if (
      source?.constructor?.name !== "HTMLCanvasElement" ||
      width <= 0 ||
      height <= 0 ||
      width * height > 4_000_000
    ) {
      return null;
    }
    try {
      const context = source.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      const data = context.getImageData(0, 0, width, height).data;
      let hash = 0x811c9dc5;
      for (let index = 0; index < data.length; index += 1) {
        hash ^= data[index];
        hash = Math.imul(hash, 0x01000193);
      }
      return `${width}x${height}:${(hash >>> 0)
        .toString(16)
        .padStart(8, "0")}`;
    } catch {
      return null;
    }
  };
  const record = (method, args) => {
    calls += 1;
    phases[phase].calls += 1;
    callsByMethod[method] = (callsByMethod[method] ?? 0) + 1;
    const stack = stackKey();
    stacks.set(stack, (stacks.get(stack) ?? 0) + 1);

    let width = 0;
    let height = 0;
    let source;
    if (
      args.length >= 9 &&
      Number.isFinite(Number(args[3])) &&
      Number.isFinite(Number(args[4]))
    ) {
      width = Math.max(0, Number(args[3]));
      height = Math.max(0, Number(args[4]));
      source = args[8];
    } else {
      source = args[5];
      width = dimension(source, "videoWidth", "naturalWidth");
      if (!width) width = dimension(source, "width", "width");
      height = dimension(source, "videoHeight", "naturalHeight");
      if (!height) height = dimension(source, "height", "height");
    }
    const bytes = width * height * 4;
    if (Number.isFinite(bytes)) {
      estimatedBytes += bytes;
      phases[phase].estimatedBytes += bytes;
    }

    if (
      (typeof source === "object" && source !== null) ||
      typeof source === "function"
    ) {
      let id = sourceIds.get(source);
      if (id === undefined) {
        id = nextSourceId;
        nextSourceId += 1;
        sourceIds.set(source, id);
      } else {
        reusedSourceCalls += 1;
        phases[phase].reusedSourceCalls += 1;
      }
      const existing = sources.get(id);
      if (existing === undefined) {
        sources.set(id, {
          id,
          kind: source.constructor?.name ?? typeof source,
          url: sourceUrl(source),
          contentHash: canvasHash(source, width, height),
          calls: 1,
          phaseCalls: [phase === 0 ? 1 : 0, phase === 1 ? 1 : 0],
          estimatedBytes: bytes,
          widths: new Set([width]),
          heights: new Set([height])
        });
      } else {
        existing.calls += 1;
        existing.phaseCalls[phase] += 1;
        existing.estimatedBytes += bytes;
        existing.widths.add(width);
        existing.heights.add(height);
      }
    } else {
      const id = `primitive:${String(source)}`;
      const existing = sources.get(id);
      if (existing === undefined) {
        sources.set(id, {
          id,
          kind: source === null ? "null" : typeof source,
          url: null,
          contentHash: null,
          calls: 1,
          phaseCalls: [phase === 0 ? 1 : 0, phase === 1 ? 1 : 0],
          estimatedBytes: bytes,
          widths: new Set([width]),
          heights: new Set([height])
        });
      } else {
        existing.calls += 1;
        existing.phaseCalls[phase] += 1;
        existing.estimatedBytes += bytes;
        existing.widths.add(width);
        existing.heights.add(height);
      }
    }
  };
  const install = (prototype, method) => {
    if (!prototype) return;
    const own = Object.prototype.hasOwnProperty.call(prototype, method);
    if (!own) return;
    const descriptor = own
      ? Object.getOwnPropertyDescriptor(prototype, method)
      : undefined;
    const original = prototype[method];
    if (typeof original !== "function") return;
    const wrapped = function (...args) {
      record(method, args);
      return Reflect.apply(original, this, args);
    };
    Object.defineProperty(prototype, method, {
      configurable: true,
      writable: true,
      value: wrapped
    });
    restorers.push(() => {
      if (descriptor !== undefined) {
        Object.defineProperty(prototype, method, descriptor);
      } else {
        delete prototype[method];
      }
    });
  };

  const installed = new Set();
  for (const constructor of [
    globalThis.WebGLRenderingContext,
    globalThis.WebGL2RenderingContext
  ]) {
    const prototype = constructor?.prototype;
    if (!prototype || installed.has(prototype)) continue;
    installed.add(prototype);
    for (const method of ["texImage2D", "texSubImage2D"]) {
      install(prototype, method);
    }
  }

  const waitForFrames = () =>
    new Promise((resolve) => {
      let remainingFrames = 4;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const frame = () => {
        remainingFrames -= 1;
        if (remainingFrames <= 0) finish();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      setTimeout(finish, 500);
    });
  let turnMilliseconds = 0;
  try {
    const started = performance.now();
    for (let turn = 0; turn < turns; turn += 1) {
      KinkyDungeonAdvanceTime(1, false, true);
    }
    turnMilliseconds = performance.now() - started;
    phases[0].turnMilliseconds = turnMilliseconds;
    await waitForFrames();
    phase = 1;
    const secondStarted = performance.now();
    for (let turn = 0; turn < turns; turn += 1) {
      KinkyDungeonAdvanceTime(1, false, true);
    }
    phases[1].turnMilliseconds = performance.now() - secondStarted;
    await waitForFrames();
  } finally {
    for (let index = restorers.length - 1; index >= 0; index -= 1) {
      restorers[index]();
    }
  }
  const sourceRows = [...sources.values()]
    .map((source) => ({
      ...source,
      widths: [...source.widths].sort((left, right) => left - right),
      heights: [...source.heights].sort((left, right) => left - right)
    }))
    .sort(
      (left, right) =>
        right.estimatedBytes - left.estimatedBytes ||
        right.calls - left.calls
    );
  const stackRows = [...stacks.entries()]
    .map(([stack, count]) => ({ stack, count }))
    .sort((left, right) => right.count - left.count);
  const contentGroups = new Map();
  for (const source of sourceRows) {
    if (source.contentHash === null) continue;
    const existing = contentGroups.get(source.contentHash);
    if (existing === undefined) {
      contentGroups.set(source.contentHash, {
        contentHash: source.contentHash,
        sources: 1,
        calls: source.calls,
        estimatedBytes: source.estimatedBytes
      });
    } else {
      existing.sources += 1;
      existing.calls += source.calls;
      existing.estimatedBytes += source.estimatedBytes;
    }
  }
  return {
    turns,
    turnMilliseconds,
    phases,
    calls,
    callsByMethod,
    uniqueSources: sources.size,
    reusedSourceCalls,
    estimatedBytes,
    duplicateContentGroups: [...contentGroups.values()]
      .filter((group) => group.sources > 1)
      .sort(
        (left, right) =>
          right.estimatedBytes - left.estimatedBytes ||
          right.sources - left.sources
      )
      .slice(0, 30),
    topSources: sourceRows.slice(0, 30),
    topStacks: stackRows.slice(0, 20)
  };
}

function createSharedTextTextureProbeCandidate(stats = null, options = {}) {
  const cache = new Map();
  const observations = new Map();
  const sprites = new Set();
  const sharedMarker = "__kdHybridSharedTextTexture";
  const maxEntries = Number.isInteger(options.maxEntries)
    ? Math.max(8, options.maxEntries)
    : 512;
  const maxIdleMilliseconds = Number.isFinite(options.maxIdleMilliseconds)
    ? Math.max(1_000, options.maxIdleMilliseconds)
    : 30_000;
  const shareThreshold = Number.isInteger(options.shareThreshold)
    ? Math.max(2, options.shareThreshold)
    : 8;
  const maxObservedKeys = Number.isInteger(options.maxObservedKeys)
    ? Math.max(maxEntries, options.maxObservedKeys)
    : Math.max(2_048, maxEntries * 4);
  let callsSinceCleanup = 0;
  let disposed = false;

  const updateStats = () => {
    if (stats === null) return;
    stats.entries = cache.size;
    stats.observedKeys = observations.size;
    stats.liveSprites = sprites.size;
    stats.peakEntries = Math.max(stats.peakEntries ?? 0, cache.size);
    stats.peakLiveSprites = Math.max(
      stats.peakLiveSprites ?? 0,
      sprites.size
    );
  };

  const destroyOwner = (entry) => {
    if (entry.owner !== null && !entry.owner.destroyed) {
      entry.owner.destroy({
        children: true,
        texture: true,
        baseTexture: true
      });
    }
  };

  const removeEntry = (key, entry) => {
    if (entry.references !== 0) return false;
    cache.delete(key);
    destroyOwner(entry);
    if (stats !== null) stats.evictions = (stats.evictions ?? 0) + 1;
    return true;
  };

  const cleanup = (force = false) => {
    const now = performance.now();
    if (force) {
      for (const sprite of [...sprites]) {
        sprite.parent?.removeChild(sprite);
        if (sprite.__kdHybridSpriteMap?.get(sprite.__kdHybridSpriteId) === sprite) {
          sprite.__kdHybridSpriteMap.delete(sprite.__kdHybridSpriteId);
          kdprimitiveparams.delete(sprite.__kdHybridSpriteId);
        }
        if (!sprite.destroyed) sprite.destroy();
      }
    }
    for (const [key, entry] of cache) {
      if (
        entry.references === 0 &&
        (force ||
          now - entry.lastUsed >= maxIdleMilliseconds ||
          cache.size > maxEntries)
      ) {
        removeEntry(key, entry);
      }
    }
    if (!force && cache.size > maxEntries) {
      for (const [key, entry] of cache) {
        if (cache.size <= maxEntries) break;
        removeEntry(key, entry);
      }
    }
    for (const [key, observation] of observations) {
      if (
        force ||
        (cache.get(key) === undefined &&
          (now - observation.lastUsed >= maxIdleMilliseconds ||
            observations.size > maxObservedKeys))
      ) {
        observations.delete(key);
      }
    }
    callsSinceCleanup = 0;
    updateStats();
  };

  class SharedTextSprite extends PIXI.Sprite {
    constructor(entry, spriteMap, id) {
      super(entry.texture);
      this.__kdHybridEntry = entry;
      this.__kdHybridSpriteMap = spriteMap;
      this.__kdHybridSpriteId = id;
      Object.defineProperty(this, sharedMarker, {
        configurable: true,
        value: entry.key
      });
      entry.references += 1;
      entry.lastUsed = performance.now();
      sprites.add(this);
      updateStats();
    }

    destroy(options) {
      if (this.destroyed) return;
      const entry = this.__kdHybridEntry;
      this.__kdHybridEntry = null;
      if (entry !== null && entry !== undefined) {
        entry.references = Math.max(0, entry.references - 1);
        entry.lastUsed = performance.now();
      }
      sprites.delete(this);
      const destroyChildren =
        options === true ||
        (typeof options === "object" &&
          options !== null &&
          options.children === true);
      super.destroy({
        children: destroyChildren,
        texture: false,
        baseTexture: false
      });
      updateStats();
    }
  }

  const destroyDisplayObject = (sprite) => {
    if (sprite?.[sharedMarker]) {
      sprite.destroy();
    } else {
      sprite.destroy(true);
    }
  };

  const candidate = function DrawTextVisKDSharedTextureProbe(
    container,
    spriteMap,
    id,
    params
  ) {
    if (disposed) {
      throw new Error("Shared text texture candidate has been disposed");
    }
    if (stats !== null) stats.calls += 1;
    if (!KDAllowText) return [0];
    let sprite = spriteMap.get(id);
    let same = true;
    const previous = kdprimitiveparams.get(id);
    if (sprite && previous) {
      for (const [key, value] of Object.entries(previous)) {
        if (
          params[key] != value &&
          ((key != "X" && key != "Y") || !params.unique)
        ) {
          same = false;
          break;
        }
      }
      for (const [key, value] of Object.entries(params)) {
        if (
          previous[key] != value &&
          ((key != "X" && key != "Y") || !params.unique)
        ) {
          same = false;
          break;
        }
      }
    }
    if (!sprite || !same) {
      if (sprite) destroyDisplayObject(sprite);
      const text = params.wordwrap
        ? params.Text.replaceAll("|", "\n")
        : params.Text;
      const style = {
        fontFamily: params.font || KDSelectedFont || KDFontName,
        fontSize: params.FontSize ? params.FontSize : 30,
        fill: string2hex(params.Color),
        stroke:
          params.BackColor != "none"
            ? params.BackColor
              ? string2hex(params.BackColor)
              : "#333333"
            : 0x010203,
        strokeThickness:
          params.border != undefined
            ? params.border
            : params.BackColor != "none"
              ? params.FontSize
                ? Math.ceil(params.FontSize / 8)
                : 2
              : 1,
        miterLimit: 2,
        padding: 5,
        wordWrap: params.wordwrap,
        wordWrapWidth: params.Width,
        breakWords:
          params.wordwrap && CharacterCheckerHasCJK(params.Text) != null
      };
      const cacheKey = JSON.stringify([
        text,
        style.fontFamily,
        style.fontSize,
        style.fill,
        style.stroke,
        style.strokeThickness,
        style.miterLimit,
        style.padding,
        Boolean(style.wordWrap),
        style.wordWrap ? style.wordWrapWidth : null,
        Boolean(style.breakWords),
        PIXI.settings.RESOLUTION
      ]);
      let entry = cache.get(cacheKey);
      if (
        entry?.texture?.destroyed ||
        entry?.texture?.baseTexture?.destroyed ||
        entry?.owner?.destroyed
      ) {
        cache.delete(cacheKey);
        entry = undefined;
      }
      if (entry === undefined) {
        const now = performance.now();
        const observation = observations.get(cacheKey) ?? {
          count: 0,
          lastUsed: now
        };
        observation.count += 1;
        observation.lastUsed = now;
        observations.delete(cacheKey);
        observations.set(cacheKey, observation);
        if (observation.count < shareThreshold) {
          sprite = new PIXI.Text(text, style);
          if (stats !== null) {
            stats.bypasses = (stats.bypasses ?? 0) + 1;
          }
        } else {
          const owner = new PIXI.Text(text, style);
          owner.updateText(true);
          entry = {
            key: cacheKey,
            owner,
            texture: owner.texture,
            references: 0,
            lastUsed: now
          };
          cache.set(cacheKey, entry);
          sprite = new SharedTextSprite(entry, spriteMap, id);
          if (stats !== null) stats.misses += 1;
        }
      } else {
        cache.delete(cacheKey);
        cache.set(cacheKey, entry);
        entry.lastUsed = performance.now();
        sprite = new SharedTextSprite(entry, spriteMap, id);
        if (stats !== null) stats.hits += 1;
      }
      if (params.Width) {
        sprite.scale.x = Math.min(1, params.Width / Math.max(1, sprite.width));
        sprite.scale.y = sprite.scale.x;
      }
      sprite.roundPixels = true;
      spriteMap.set(id, sprite);
      container.addChild(sprite);
      if (!kdprimitiveparams.has(id) || !same) {
        kdprimitiveparams.set(id, params);
      }
      callsSinceCleanup += 1;
      if (callsSinceCleanup >= 128 || cache.size > maxEntries) {
        cleanup();
      } else {
        updateStats();
      }
    }
    if (sprite) {
      sprite.visible = true;
      sprite.name = id;
      sprite.position.x =
        params.X +
        (params.align == "center"
          ? -sprite.width / 2
          : params.align == "right"
            ? -sprite.width
            : 0);
      sprite.position.y =
        params.Y +
        (params.valign == "top"
          ? 0
          : params.valign == "bottom"
            ? -Math.ceil(sprite.height)
            : -Math.ceil(sprite.height / 2));
      sprite.zIndex = params.zIndex ? params.zIndex : 0;
      sprite.alpha = params.alpha ? params.alpha : 1;
      kdSpritesDrawn.set(id, true);
      return [sprite.width, sprite.height];
    }
    return [0];
  };

  candidate.dispose = () => {
    if (disposed) return;
    cleanup(true);
    disposed = true;
  };
  candidate.cleanup = cleanup;
  candidate.status = () => ({
    cacheEntries: cache.size,
    observedKeys: observations.size,
    liveSprites: sprites.size,
    referencedEntries: [...cache.values()].filter(
      (entry) => entry.references > 0
    ).length,
    totalReferences: [...cache.values()].reduce(
      (total, entry) => total + entry.references,
      0
    ),
    disposed
  });
  candidate.sharedMarker = sharedMarker;
  updateStats();
  return candidate;
}

async function verifySharedTextTextureCandidate(createCandidate, official) {
  "use strict";
  if (typeof createCandidate !== "function" || typeof official !== "function") {
    throw new TypeError("Shared-text verification requires both implementations");
  }
  const width = 960;
  const height = 520;
  const officialContainer = new PIXI.Container();
  const candidateContainer = new PIXI.Container();
  officialContainer.sortableChildren = true;
  candidateContainer.sortableChildren = true;
  const officialMap = new Map();
  const candidateMap = new Map();
  const officialIds = [];
  const candidateIds = [];
  const stats = {
    calls: 0,
    hits: 0,
    misses: 0,
    entries: 0,
    evictions: 0
  };
  const candidate = createCandidate(stats, {
    maxEntries: 32,
    maxIdleMilliseconds: 1_000,
    shareThreshold: 2
  });
  const officialTexture = PIXI.RenderTexture.create({
    width,
    height,
    resolution: 1
  });
  const candidateTexture = PIXI.RenderTexture.create({
    width,
    height,
    resolution: 1
  });
  const cases = [
    {
      Text: "Shared restraint",
      X: 155,
      Y: 50,
      Width: 250,
      Color: "#ffffff",
      BackColor: "#222222",
      FontSize: 24,
      align: "center",
      zIndex: 4,
      alpha: 1
    },
    {
      Text: "Shared restraint",
      X: 480,
      Y: 50,
      Width: 250,
      Color: "#ffffff",
      BackColor: "#222222",
      FontSize: 24,
      align: "center",
      zIndex: 4,
      alpha: 1
    },
    {
      Text: "Shared restraint",
      X: 860,
      Y: 50,
      Width: 150,
      Color: "#ffffff",
      BackColor: "#222222",
      FontSize: 24,
      align: "right",
      zIndex: 4,
      alpha: 1
    },
    {
      Text: "No outline",
      X: 40,
      Y: 130,
      Width: 190,
      Color: "#ff7fab",
      BackColor: "none",
      FontSize: 22,
      align: "left",
      valign: "top",
      border: 0,
      zIndex: 3,
      alpha: 0.75
    },
    {
      Text: "No outline",
      X: 300,
      Y: 130,
      Width: 190,
      Color: "#ff7fab",
      BackColor: "none",
      FontSize: 22,
      align: "left",
      valign: "top",
      border: 0,
      zIndex: 3,
      alpha: 0.75
    },
    {
      Text: "Wrapped text|uses two lines",
      X: 620,
      Y: 165,
      Width: 230,
      Color: "#d9f2ff",
      BackColor: "#17354d",
      FontSize: 20,
      align: "center",
      valign: "bottom",
      wordwrap: true,
      zIndex: 2,
      alpha: 1
    },
    {
      Text: "Wrapped text|uses two lines",
      X: 840,
      Y: 165,
      Width: 230,
      Color: "#d9f2ff",
      BackColor: "#17354d",
      FontSize: 20,
      align: "center",
      valign: "bottom",
      wordwrap: true,
      zIndex: 2,
      alpha: 1
    },
    {
      Text: "拘束テスト",
      X: 180,
      Y: 260,
      Width: 250,
      Color: "#ffe9a8",
      BackColor: "#4a3815",
      FontSize: 28,
      align: "center",
      zIndex: 5,
      alpha: 1
    },
    {
      Text: "拘束テスト",
      X: 485,
      Y: 260,
      Width: 250,
      Color: "#ffe9a8",
      BackColor: "#4a3815",
      FontSize: 28,
      align: "center",
      zIndex: 5,
      alpha: 1
    },
    {
      Text: "Move-only unique label",
      X: 720,
      Y: 260,
      Width: 260,
      Color: "#b9ffb9",
      BackColor: "#143814",
      FontSize: 21,
      align: "left",
      unique: true,
      zIndex: 6,
      alpha: 1
    },
    {
      Text: "Default background",
      X: 220,
      Y: 390,
      Width: undefined,
      Color: "#ffffff",
      BackColor: undefined,
      FontSize: 26,
      align: "center",
      zIndex: 1,
      alpha: 1
    },
    {
      Text: "Default background",
      X: 620,
      Y: 390,
      Width: undefined,
      Color: "#ffffff",
      BackColor: undefined,
      FontSize: 26,
      align: "center",
      zIndex: 1,
      alpha: 1
    }
  ];
  const officialDimensions = [];
  const candidateDimensions = [];
  const officialTransforms = [];
  const candidateTransforms = [];
  const renderer = PIXIapp.renderer;

  const snapshotTransform = (sprite) => ({
    x: sprite.position.x,
    y: sprite.position.y,
    scaleX: sprite.scale.x,
    scaleY: sprite.scale.y,
    width: sprite.width,
    height: sprite.height,
    zIndex: sprite.zIndex,
    alpha: sprite.alpha,
    visible: sprite.visible,
    roundPixels: sprite.roundPixels
  });
  const hashPixels = (pixels) => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < pixels.length; index += 1) {
      hash ^= pixels[index];
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  };
  const comparePixels = (left, right) => {
    let mismatched = 0;
    let maximumDifference = 0;
    for (let index = 0; index < left.length; index += 1) {
      const difference = Math.abs(left[index] - right[index]);
      if (difference !== 0) mismatched += 1;
      maximumDifference = Math.max(maximumDifference, difference);
    }
    return { mismatched, maximumDifference, bytes: left.length };
  };
  const cleanupMap = (map, ids, shared) => {
    if (shared) {
      candidate.dispose();
    }
    for (const sprite of map.values()) {
      sprite.parent?.removeChild(sprite);
      if (!sprite.destroyed) sprite.destroy(true);
    }
    map.clear();
    for (const id of ids) {
      kdprimitiveparams.delete(id);
      kdSpritesDrawn.delete(id);
    }
  };

  let result;
  try {
    for (let index = 0; index < cases.length; index += 1) {
      const officialId = `kd-hybrid-text-verify-official-${index}`;
      const candidateId = `kd-hybrid-text-verify-candidate-${index}`;
      officialIds.push(officialId);
      candidateIds.push(candidateId);
      officialDimensions.push(
        Reflect.apply(official, globalThis, [
          officialContainer,
          officialMap,
          officialId,
          { ...cases[index] }
        ])
      );
      candidateDimensions.push(
        candidate(
          candidateContainer,
          candidateMap,
          candidateId,
          { ...cases[index] }
        )
      );
      officialTransforms.push(
        snapshotTransform(officialMap.get(officialId))
      );
      candidateTransforms.push(
        snapshotTransform(candidateMap.get(candidateId))
      );
    }
    renderer.render(officialContainer, {
      renderTexture: officialTexture,
      clear: true
    });
    renderer.gl.finish();
    renderer.render(candidateContainer, {
      renderTexture: candidateTexture,
      clear: true
    });
    renderer.gl.finish();
    const officialPixels = renderer.extract.pixels(officialTexture);
    const candidatePixels = renderer.extract.pixels(candidateTexture);
    const pixelComparison = comparePixels(officialPixels, candidatePixels);
    const dimensionsExact =
      JSON.stringify(officialDimensions) ===
      JSON.stringify(candidateDimensions);
    const transformsExact =
      JSON.stringify(officialTransforms) ===
      JSON.stringify(candidateTransforms);

    const firstShared = candidateMap.get(candidateIds[0]);
    const secondShared = candidateMap.get(candidateIds[1]);
    const thirdShared = candidateMap.get(candidateIds[2]);
    const lifecycleId = "kd-hybrid-text-verify-candidate-lifecycle";
    candidateIds.push(lifecycleId);
    candidate(
      candidateContainer,
      candidateMap,
      lifecycleId,
      { ...cases[2], X: 760, Y: 95 }
    );
    const lifecycleShared = candidateMap.get(lifecycleId);
    const sameTexture =
      secondShared.texture === thirdShared.texture &&
      thirdShared.texture === lifecycleShared.texture &&
      firstShared.texture !== secondShared.texture;
    const sharedTexture = secondShared.texture;
    secondShared.parent?.removeChild(secondShared);
    secondShared.destroy();
    const survivesCullDestroy =
      !sharedTexture.destroyed &&
      !sharedTexture.baseTexture.destroyed &&
      !thirdShared.destroyed &&
      !lifecycleShared.destroyed;

    candidate(
      candidateContainer,
      candidateMap,
      candidateIds[2],
      {
        ...cases[2],
        Text: "Replacement label"
      }
    );
    renderer.render(candidateContainer, {
      renderTexture: candidateTexture,
      clear: true
    });
    renderer.gl.finish();
    const survivesReplacementDestroy =
      !sharedTexture.destroyed &&
      !sharedTexture.baseTexture.destroyed &&
      !lifecycleShared.destroyed;
    const beforeDispose = candidate.status();
    result = {
      passed:
        dimensionsExact &&
        transformsExact &&
        pixelComparison.mismatched === 0 &&
        sameTexture &&
        survivesCullDestroy &&
        survivesReplacementDestroy,
      dimensionsExact,
      transformsExact,
      pixelComparison,
      officialPixelHash: hashPixels(officialPixels),
      candidatePixelHash: hashPixels(candidatePixels),
      sameTexture,
      survivesCullDestroy,
      survivesReplacementDestroy,
      beforeDispose,
      stats: { ...stats }
    };
  } finally {
    cleanupMap(officialMap, officialIds, false);
    cleanupMap(candidateMap, candidateIds, true);
    officialContainer.destroy({ children: false });
    candidateContainer.destroy({ children: false });
    officialTexture.destroy(true);
    candidateTexture.destroy(true);
  }
  return {
    ...result,
    afterDispose: candidate.status()
  };
}

async function benchmarkSharedTextTextureCandidate(
  createCandidate,
  official,
  samples,
  labelCount
) {
  "use strict";
  if (samples === undefined) samples = 9;
  if (labelCount === undefined) labelCount = 120;
  if (!Number.isInteger(samples) || samples < 1) samples = 1;
  if (!Number.isInteger(labelCount) || labelCount < 2) labelCount = 2;
  const renderer = PIXIapp.renderer;
  const renderTexture = PIXI.RenderTexture.create({
    width: 1_000,
    height: 640,
    resolution: 1
  });
  let runIndex = 0;

  const hashPixels = (pixels) => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < pixels.length; index += 1) {
      hash ^= pixels[index];
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  };
  const medianLocal = (values) => {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const installUploadCounter = () => {
    const restorers = [];
    let uploads = 0;
    const installed = new Set();
    for (const constructor of [
      globalThis.WebGLRenderingContext,
      globalThis.WebGL2RenderingContext
    ]) {
      const prototype = constructor?.prototype;
      if (!prototype || installed.has(prototype)) continue;
      installed.add(prototype);
      for (const method of ["texImage2D", "texSubImage2D"]) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
        const original = prototype[method];
        if (descriptor === undefined || typeof original !== "function") continue;
        Object.defineProperty(prototype, method, {
          configurable: true,
          writable: true,
          value: function (...args) {
            uploads += 1;
            return Reflect.apply(original, this, args);
          }
        });
        restorers.push(() =>
          Object.defineProperty(prototype, method, descriptor)
        );
      }
    }
    return {
      count: () => uploads,
      restore: () => {
        for (let index = restorers.length - 1; index >= 0; index -= 1) {
          restorers[index]();
        }
      }
    };
  };
  const run = (mode, capturePixels) => {
    runIndex += 1;
    const prefix = `kd-hybrid-text-benchmark-${runIndex}-${mode}`;
    const container = new PIXI.Container();
    const spriteMap = new Map();
    const ids = [];
    const stats = {
      calls: 0,
      hits: 0,
      misses: 0,
      entries: 0,
      evictions: 0
    };
    const candidate =
      mode === "candidate"
        ? createCandidate(stats, {
            maxEntries: 64,
            maxIdleMilliseconds: 30_000
          })
        : null;
    const draw = candidate ?? official;
    const uploadCounter = installUploadCounter();
    let creationMilliseconds = 0;
    let renderMilliseconds = 0;
    let pixelHash = null;
    try {
      const creationStarted = performance.now();
      for (let index = 0; index < labelCount; index += 1) {
        const id = `${prefix}-${index}`;
        ids.push(id);
        const column = index % 12;
        const row = Math.floor(index / 12);
        Reflect.apply(draw, globalThis, [
          container,
          spriteMap,
          id,
          {
            Text: "Restrained",
            X: 50 + column * 82,
            Y: 30 + row * 58,
            Width: 120,
            Color: "#ffffff",
            BackColor: "#222222",
            FontSize: 18,
            align: "center",
            zIndex: 1,
            alpha: 1
          }
        ]);
      }
      creationMilliseconds = performance.now() - creationStarted;
      const renderStarted = performance.now();
      renderer.render(container, {
        renderTexture,
        clear: true
      });
      renderer.gl.finish();
      renderMilliseconds = performance.now() - renderStarted;
      if (capturePixels) {
        pixelHash = hashPixels(renderer.extract.pixels(renderTexture));
      }
      return {
        mode,
        creationMilliseconds,
        renderMilliseconds,
        totalMilliseconds: creationMilliseconds + renderMilliseconds,
        uploads: uploadCounter.count(),
        pixelHash,
        stats: mode === "candidate" ? { ...stats } : null
      };
    } finally {
      uploadCounter.restore();
      if (candidate !== null) {
        candidate.dispose();
      }
      for (const sprite of spriteMap.values()) {
        sprite.parent?.removeChild(sprite);
        if (!sprite.destroyed) sprite.destroy(true);
      }
      spriteMap.clear();
      for (const id of ids) {
        kdprimitiveparams.delete(id);
        kdSpritesDrawn.delete(id);
      }
      container.destroy({ children: false });
    }
  };

  try {
    run("official", false);
    run("candidate", false);
    const pairs = [];
    for (let sample = 0; sample < samples; sample += 1) {
      const candidateFirst = sample % 2 === 1;
      const first = run(
        candidateFirst ? "candidate" : "official",
        true
      );
      const second = run(
        candidateFirst ? "official" : "candidate",
        true
      );
      const officialRun = candidateFirst ? second : first;
      const candidateRun = candidateFirst ? first : second;
      pairs.push({
        order: candidateFirst ? "candidate-official" : "official-candidate",
        official: officialRun,
        candidate: candidateRun,
        exactPixels: officialRun.pixelHash === candidateRun.pixelHash,
        totalSpeedup:
          officialRun.totalMilliseconds / candidateRun.totalMilliseconds,
        renderSpeedup:
          officialRun.renderMilliseconds / candidateRun.renderMilliseconds
      });
    }
    const officialRuns = pairs.map((pair) => pair.official);
    const candidateRuns = pairs.map((pair) => pair.candidate);
    const pairedTotalSpeedups = pairs.map((pair) => pair.totalSpeedup);
    const pairedRenderSpeedups = pairs.map((pair) => pair.renderSpeedup);
    return {
      samples,
      labelCount,
      exactPixelPairs: pairs.filter((pair) => pair.exactPixels).length,
      official: {
        medianCreationMilliseconds: medianLocal(
          officialRuns.map((run) => run.creationMilliseconds)
        ),
        medianRenderMilliseconds: medianLocal(
          officialRuns.map((run) => run.renderMilliseconds)
        ),
        medianTotalMilliseconds: medianLocal(
          officialRuns.map((run) => run.totalMilliseconds)
        ),
        medianUploads: medianLocal(
          officialRuns.map((run) => run.uploads)
        )
      },
      candidate: {
        medianCreationMilliseconds: medianLocal(
          candidateRuns.map((run) => run.creationMilliseconds)
        ),
        medianRenderMilliseconds: medianLocal(
          candidateRuns.map((run) => run.renderMilliseconds)
        ),
        medianTotalMilliseconds: medianLocal(
          candidateRuns.map((run) => run.totalMilliseconds)
        ),
        medianUploads: medianLocal(
          candidateRuns.map((run) => run.uploads)
        )
      },
      medianPairedTotalSpeedup: medianLocal(pairedTotalSpeedups),
      medianPairedRenderSpeedup: medianLocal(pairedRenderSpeedups),
      fasterTotalPairs: pairedTotalSpeedups.filter(
        (speedup) => speedup > 1
      ).length,
      fasterRenderPairs: pairedRenderSpeedups.filter(
        (speedup) => speedup > 1
      ).length,
      pairs
    };
  } finally {
    renderTexture.destroy(true);
  }
}

async function benchmarkSharedTextLiveDraw(
  createCandidate,
  official,
  restore,
  samples
) {
  "use strict";
  if (samples === undefined) samples = 9;
  if (!Number.isInteger(samples) || samples < 1) samples = 1;
  const renderer = PIXIapp.renderer;
  const fixedTimestamp = performance.now();
  let runIndex = 0;

  const hashBytes = (bytes) => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < bytes.length; index += 1) {
      hash ^= bytes[index];
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  };
  const hashText = (text) => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `${(hash >>> 0).toString(16).padStart(8, "0")}:${text.length}`;
  };
  const medianLocal = (values) => {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const clearTextSprites = () => {
    let removed = 0;
    for (const [id, sprite] of [...kdpixisprites.entries()]) {
      if (
        sprite instanceof PIXI.Text ||
        sprite?.__kdHybridSharedTextTexture
      ) {
        sprite.parent?.removeChild(sprite);
        kdpixisprites.delete(id);
        kdprimitiveparams.delete(id);
        kdSpritesDrawn.delete(id);
        if (!sprite.destroyed) {
          if (sprite.__kdHybridSharedTextTexture) sprite.destroy();
          else sprite.destroy(true);
        }
        removed += 1;
      }
    }
    return removed;
  };
  const installUploadCounter = () => {
    const restorers = [];
    const counts = { cold: 0, warm: 0 };
    let phase = "cold";
    const installed = new Set();
    for (const constructor of [
      globalThis.WebGLRenderingContext,
      globalThis.WebGL2RenderingContext
    ]) {
      const prototype = constructor?.prototype;
      if (!prototype || installed.has(prototype)) continue;
      installed.add(prototype);
      for (const method of ["texImage2D", "texSubImage2D"]) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
        const original = prototype[method];
        if (descriptor === undefined || typeof original !== "function") continue;
        Object.defineProperty(prototype, method, {
          configurable: true,
          writable: true,
          value: function (...args) {
            counts[phase] += 1;
            return Reflect.apply(original, this, args);
          }
        });
        restorers.push(() =>
          Object.defineProperty(prototype, method, descriptor)
        );
      }
    }
    return {
      counts,
      warm: () => {
        phase = "warm";
      },
      restore: () => {
        for (let index = restorers.length - 1; index >= 0; index -= 1) {
          restorers[index]();
        }
      }
    };
  };
  const run = (mode) => {
    runIndex += 1;
    restore();
    const removedBefore = clearTextSprites();
    const stats = {
      calls: 0,
      hits: 0,
      misses: 0,
      entries: 0,
      evictions: 0
    };
    const candidate =
      mode === "candidate"
        ? createCandidate(stats, {
            maxEntries: 512,
            maxIdleMilliseconds: 30_000
          })
        : null;
    const selected = candidate ?? official;
    const uploads = installUploadCounter();
    const previous = globalThis.DrawTextVisKD;
    let coldMilliseconds = 0;
    let warmMilliseconds = 0;
    let screenPixelHash = null;
    let stateSignature = null;
    globalThis.DrawTextVisKD = selected;
    try {
      const coldStarted = performance.now();
      DrawProcess(fixedTimestamp);
      renderer.gl.finish();
      coldMilliseconds = performance.now() - coldStarted;
      uploads.warm();
      const warmStarted = performance.now();
      DrawProcess(fixedTimestamp);
      renderer.gl.finish();
      warmMilliseconds = performance.now() - warmStarted;
      screenPixelHash = hashBytes(renderer.extract.pixels());
      stateSignature = hashText(
        JSON.stringify(KinkyDungeonSaveGame(true))
      );
      return {
        runIndex,
        mode,
        removedBefore,
        coldMilliseconds,
        warmMilliseconds,
        totalMilliseconds: coldMilliseconds + warmMilliseconds,
        coldUploads: uploads.counts.cold,
        warmUploads: uploads.counts.warm,
        screenPixelHash,
        stateSignature,
        textSprites: [...kdpixisprites.values()].filter(
          (sprite) =>
            sprite instanceof PIXI.Text ||
            sprite?.__kdHybridSharedTextTexture
        ).length,
        stats: candidate === null ? null : { ...stats }
      };
    } finally {
      uploads.restore();
      if (globalThis.DrawTextVisKD === selected) {
        globalThis.DrawTextVisKD = previous;
      }
      clearTextSprites();
      candidate?.dispose();
    }
  };

  const pairs = [];
  try {
    run("official");
    run("candidate");
    for (let sample = 0; sample < samples; sample += 1) {
      const candidateFirst = sample % 2 === 1;
      const first = run(candidateFirst ? "candidate" : "official");
      const second = run(candidateFirst ? "official" : "candidate");
      const officialRun = candidateFirst ? second : first;
      const candidateRun = candidateFirst ? first : second;
      pairs.push({
        order: candidateFirst ? "candidate-official" : "official-candidate",
        official: officialRun,
        candidate: candidateRun,
        exactScreenPixels:
          officialRun.screenPixelHash === candidateRun.screenPixelHash,
        exactState:
          officialRun.stateSignature === candidateRun.stateSignature,
        coldSpeedup:
          officialRun.coldMilliseconds / candidateRun.coldMilliseconds,
        warmSpeedup:
          officialRun.warmMilliseconds / candidateRun.warmMilliseconds
      });
    }
  } finally {
    if (globalThis.DrawTextVisKD !== official) {
      globalThis.DrawTextVisKD = official;
    }
    clearTextSprites();
    restore();
  }
  const officialRuns = pairs.map((pair) => pair.official);
  const candidateRuns = pairs.map((pair) => pair.candidate);
  const coldSpeedups = pairs.map((pair) => pair.coldSpeedup);
  const warmSpeedups = pairs.map((pair) => pair.warmSpeedup);
  return {
    samples,
    exactScreenPixelPairs: pairs.filter(
      (pair) => pair.exactScreenPixels
    ).length,
    exactStatePairs: pairs.filter((pair) => pair.exactState).length,
    official: {
      medianColdMilliseconds: medianLocal(
        officialRuns.map((run) => run.coldMilliseconds)
      ),
      medianWarmMilliseconds: medianLocal(
        officialRuns.map((run) => run.warmMilliseconds)
      ),
      medianColdUploads: medianLocal(
        officialRuns.map((run) => run.coldUploads)
      ),
      medianWarmUploads: medianLocal(
        officialRuns.map((run) => run.warmUploads)
      ),
      medianTextSprites: medianLocal(
        officialRuns.map((run) => run.textSprites)
      )
    },
    candidate: {
      medianColdMilliseconds: medianLocal(
        candidateRuns.map((run) => run.coldMilliseconds)
      ),
      medianWarmMilliseconds: medianLocal(
        candidateRuns.map((run) => run.warmMilliseconds)
      ),
      medianColdUploads: medianLocal(
        candidateRuns.map((run) => run.coldUploads)
      ),
      medianWarmUploads: medianLocal(
        candidateRuns.map((run) => run.warmUploads)
      ),
      medianTextSprites: medianLocal(
        candidateRuns.map((run) => run.textSprites)
      )
    },
    medianPairedColdSpeedup: medianLocal(coldSpeedups),
    medianPairedWarmSpeedup: medianLocal(warmSpeedups),
    fasterColdPairs: coldSpeedups.filter((speedup) => speedup > 1).length,
    fasterWarmPairs: warmSpeedups.filter((speedup) => speedup > 1).length,
    pairs
  };
}

async function benchmarkSharedTextLiveFrames(
  createCandidate,
  official,
  restore,
  samples,
  turns
) {
  "use strict";
  if (samples === undefined) samples = 9;
  if (turns === undefined) turns = 0;
  if (!Number.isInteger(samples) || samples < 1) samples = 1;
  if (!Number.isInteger(turns) || turns < 0) turns = 0;
  const renderer = PIXIapp.renderer;
  const fixedTimestamp = performance.now();
  let runIndex = 0;

  const medianLocal = (values) => {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const hashBytes = (bytes) => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < bytes.length; index += 1) {
      hash ^= bytes[index];
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  };
  const crowdedStateSignature = () => {
    const text = JSON.stringify({
      player: {
        x: KinkyDungeonPlayerEntity.x,
        y: KinkyDungeonPlayerEntity.y,
        will: KinkyDungeonStatWill,
        stamina: KinkyDungeonStatStamina,
        state: KinkyDungeonState
      },
      enemies: KDMapData.Entities
        .filter((enemy) => enemy.kdHybridTurnProfile)
        .sort(
          (left, right) =>
            left.kdHybridTurnProfileIndex -
            right.kdHybridTurnProfileIndex
        )
        .map((enemy) => ({
          i: enemy.kdHybridTurnProfileIndex,
          x: enemy.x,
          y: enemy.y,
          gx: enemy.gx,
          gy: enemy.gy,
          hp: enemy.hp,
          aware: enemy.aware,
          hostile: enemy.hostile,
          action: enemy.action,
          attackPoints: enemy.attackPoints,
          specialCD: enemy.specialCD
        }))
    });
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  };
  const clearTextSprites = () => {
    let removed = 0;
    for (const [id, sprite] of [...kdpixisprites.entries()]) {
      if (
        sprite instanceof PIXI.Text ||
        sprite?.__kdHybridSharedTextTexture
      ) {
        sprite.parent?.removeChild(sprite);
        kdpixisprites.delete(id);
        kdprimitiveparams.delete(id);
        kdSpritesDrawn.delete(id);
        if (!sprite.destroyed) {
          if (sprite.__kdHybridSharedTextTexture) sprite.destroy();
          else sprite.destroy(true);
        }
        removed += 1;
      }
    }
    return removed;
  };
  const installUploadCounter = (phaseRef) => {
    const restorers = [];
    const counts = { cold: 0, warm: 0 };
    const installed = new Set();
    for (const constructor of [
      globalThis.WebGLRenderingContext,
      globalThis.WebGL2RenderingContext
    ]) {
      const prototype = constructor?.prototype;
      if (!prototype || installed.has(prototype)) continue;
      installed.add(prototype);
      for (const method of ["texImage2D", "texSubImage2D"]) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
        const original = prototype[method];
        if (descriptor === undefined || typeof original !== "function") continue;
        Object.defineProperty(prototype, method, {
          configurable: true,
          writable: true,
          value: function (...args) {
            counts[phaseRef.value] += 1;
            return Reflect.apply(original, this, args);
          }
        });
        restorers.push(() =>
          Object.defineProperty(prototype, method, descriptor)
        );
      }
    }
    return {
      counts,
      restore: () => {
        for (let index = restorers.length - 1; index >= 0; index -= 1) {
          restorers[index]();
        }
      }
    };
  };
  const run = async (mode) => {
    runIndex += 1;
    const restored = restore();
    const removedBefore = clearTextSprites();
    const stats = {
      calls: 0,
      hits: 0,
      misses: 0,
      entries: 0,
      evictions: 0
    };
    const candidate =
      mode === "candidate"
        ? createCandidate(stats, {
            maxEntries: 512,
            maxIdleMilliseconds: 30_000
          })
        : null;
    const selected = candidate ?? official;
    const previousText = globalThis.DrawTextVisKD;
    const previousDraw = globalThis.DrawProcess;
    const previousRender = renderer.render;
    const phase = { value: "cold" };
    const uploads = installUploadCounter(phase);
    const records = {
      cold: { drawMilliseconds: 0, stageMilliseconds: 0, draws: 0 },
      warm: { drawMilliseconds: 0, stageMilliseconds: 0, draws: 0 }
    };
    let stageWaiter = null;

    const waitForStage = () =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (stageWaiter?.timer === timer) stageWaiter = null;
          reject(new Error("Timed out waiting for the Pixi stage render"));
        }, 2_000);
        stageWaiter = { resolve, timer };
      });

    globalThis.DrawTextVisKD = selected;
    globalThis.DrawProcess = function KDHybridFixedDrawProcessProbe() {
      const started = performance.now();
      try {
        return Reflect.apply(previousDraw, this, [fixedTimestamp]);
      } finally {
        records[phase.value].drawMilliseconds +=
          performance.now() - started;
        records[phase.value].draws += 1;
      }
    };
    renderer.render = function KDHybridMeasuredStageRender(
      displayObject,
      options
    ) {
      const isStage = displayObject === PIXIapp.stage;
      const started = isStage ? performance.now() : 0;
      const result = Reflect.apply(previousRender, this, arguments);
      if (isStage) {
        renderer.gl.finish();
        records[phase.value].stageMilliseconds +=
          performance.now() - started;
        const waiter = stageWaiter;
        stageWaiter = null;
        if (waiter !== null) {
          clearTimeout(waiter.timer);
          waiter.resolve();
        }
      }
      return result;
    };

    try {
      const turnStarted = performance.now();
      for (let turn = 0; turn < turns; turn += 1) {
        KinkyDungeonAdvanceTime(1, false, true);
      }
      const turnMilliseconds = performance.now() - turnStarted;
      await waitForStage();
      phase.value = "warm";
      await waitForStage();
      const screenPixelHash = hashBytes(renderer.extract.pixels());
      const cold = records.cold;
      const warm = records.warm;
      return {
        runIndex,
        mode,
        turns,
        turnMilliseconds,
        restoredStateSignature: restored.stateSignature,
        stateSignature: crowdedStateSignature(),
        removedBefore,
        cold: {
          ...cold,
          totalMilliseconds:
            cold.drawMilliseconds + cold.stageMilliseconds,
          uploads: uploads.counts.cold
        },
        warm: {
          ...warm,
          totalMilliseconds:
            warm.drawMilliseconds + warm.stageMilliseconds,
          uploads: uploads.counts.warm
        },
        screenPixelHash,
        textSprites: [...kdpixisprites.values()].filter(
          (sprite) =>
            sprite instanceof PIXI.Text ||
            sprite?.__kdHybridSharedTextTexture
        ).length,
        stats: candidate === null ? null : { ...stats },
        measuredTotalMilliseconds:
          turnMilliseconds +
          cold.drawMilliseconds +
          cold.stageMilliseconds +
          warm.drawMilliseconds +
          warm.stageMilliseconds
      };
    } finally {
      if (stageWaiter !== null) {
        clearTimeout(stageWaiter.timer);
        stageWaiter = null;
      }
      renderer.render = previousRender;
      globalThis.DrawProcess = previousDraw;
      if (globalThis.DrawTextVisKD === selected) {
        globalThis.DrawTextVisKD = previousText;
      }
      uploads.restore();
      clearTextSprites();
      candidate?.dispose();
    }
  };

  const pairs = [];
  try {
    await run("official");
    await run("candidate");
    for (let sample = 0; sample < samples; sample += 1) {
      const candidateFirst = sample % 2 === 1;
      const first = await run(
        candidateFirst ? "candidate" : "official"
      );
      const second = await run(
        candidateFirst ? "official" : "candidate"
      );
      const officialRun = candidateFirst ? second : first;
      const candidateRun = candidateFirst ? first : second;
      pairs.push({
        order: candidateFirst ? "candidate-official" : "official-candidate",
        official: officialRun,
        candidate: candidateRun,
        exactScreenPixels:
          officialRun.screenPixelHash === candidateRun.screenPixelHash,
        exactRestoredState:
          officialRun.restoredStateSignature ===
          candidateRun.restoredStateSignature,
        exactState:
          officialRun.stateSignature === candidateRun.stateSignature,
        coldSpeedup:
          officialRun.cold.totalMilliseconds /
          candidateRun.cold.totalMilliseconds,
        warmSpeedup:
          officialRun.warm.totalMilliseconds /
          candidateRun.warm.totalMilliseconds,
        measuredTotalSpeedup:
          officialRun.measuredTotalMilliseconds /
          candidateRun.measuredTotalMilliseconds
      });
    }
  } finally {
    if (globalThis.DrawTextVisKD !== official) {
      globalThis.DrawTextVisKD = official;
    }
    clearTextSprites();
    restore();
  }
  const officialRuns = pairs.map((pair) => pair.official);
  const candidateRuns = pairs.map((pair) => pair.candidate);
  const coldSpeedups = pairs.map((pair) => pair.coldSpeedup);
  const warmSpeedups = pairs.map((pair) => pair.warmSpeedup);
  const measuredTotalSpeedups = pairs.map(
    (pair) => pair.measuredTotalSpeedup
  );
  const summarizePhase = (runs, phaseName) => ({
    medianDrawMilliseconds: medianLocal(
      runs.map((run) => run[phaseName].drawMilliseconds)
    ),
    medianStageMilliseconds: medianLocal(
      runs.map((run) => run[phaseName].stageMilliseconds)
    ),
    medianTotalMilliseconds: medianLocal(
      runs.map((run) => run[phaseName].totalMilliseconds)
    ),
    medianUploads: medianLocal(
      runs.map((run) => run[phaseName].uploads)
    )
  });
  return {
    samples,
    turns,
    exactScreenPixelPairs: pairs.filter(
      (pair) => pair.exactScreenPixels
    ).length,
    exactRestoredStatePairs: pairs.filter(
      (pair) => pair.exactRestoredState
    ).length,
    exactStatePairs: pairs.filter((pair) => pair.exactState).length,
    official: {
      cold: summarizePhase(officialRuns, "cold"),
      warm: summarizePhase(officialRuns, "warm"),
      medianTurnMilliseconds: medianLocal(
        officialRuns.map((run) => run.turnMilliseconds)
      ),
      medianMeasuredTotalMilliseconds: medianLocal(
        officialRuns.map((run) => run.measuredTotalMilliseconds)
      ),
      medianTextSprites: medianLocal(
        officialRuns.map((run) => run.textSprites)
      )
    },
    candidate: {
      cold: summarizePhase(candidateRuns, "cold"),
      warm: summarizePhase(candidateRuns, "warm"),
      medianTurnMilliseconds: medianLocal(
        candidateRuns.map((run) => run.turnMilliseconds)
      ),
      medianMeasuredTotalMilliseconds: medianLocal(
        candidateRuns.map((run) => run.measuredTotalMilliseconds)
      ),
      medianTextSprites: medianLocal(
        candidateRuns.map((run) => run.textSprites)
      )
    },
    medianPairedColdSpeedup: medianLocal(coldSpeedups),
    medianPairedWarmSpeedup: medianLocal(warmSpeedups),
    medianPairedMeasuredTotalSpeedup: medianLocal(
      measuredTotalSpeedups
    ),
    fasterColdPairs: coldSpeedups.filter((speedup) => speedup > 1).length,
    fasterWarmPairs: warmSpeedups.filter((speedup) => speedup > 1).length,
    fasterMeasuredTotalPairs: measuredTotalSpeedups.filter(
      (speedup) => speedup > 1
    ).length,
    pairs
  };
}

function measureEnemyLoopPathReuse(turns) {
  "use strict";
  if (!Number.isInteger(turns) || turns < 1) turns = 1;

  const officialLoop = KinkyDungeonEnemyLoop;
  const officialPath = KinkyDungeonCheckPath;
  const boundaryNames = [
    "KinkyDungeonSendEvent",
    "KinkyDungeonMapSet",
    "KDMoveEntity",
    "KDRemoveEntity",
    "KDAddEntity"
  ];
  const boundaryWrappers = [];
  const signatureCounts = new Map();
  const boundaryCounts = new Map();
  const totals = {
    loopCalls: 0,
    loopsWithPathCalls: 0,
    pathCalls: 0,
    uniquePathQueries: 0,
    repeatedPathQueries: 0,
    sameSegmentRepeatedQueries: 0,
    consecutiveRepeatedQueries: 0,
    sameSegmentResultMismatches: 0
  };
  let active = null;

  const normalize = (args) => {
    const allowBars = args[4] === undefined ? false : Boolean(args[4]);
    const blockEnemies =
      args[5] === undefined ? false : Boolean(args[5]);
    const maxFails = args[6] === undefined ? 1 : Number(args[6]);
    const blockOnly =
      args[7] === undefined ? "default" : String(args[7]);
    return {
      key: [
        Number(args[0]),
        Number(args[1]),
        Number(args[2]),
        Number(args[3]),
        allowBars ? 1 : 0,
        blockEnemies ? 1 : 0,
        maxFails,
        blockOnly
      ].join("|"),
      signature: [
        allowBars ? "bars" : "solid",
        blockEnemies ? "block-enemies" : "ignore-enemies",
        `fails:${maxFails}`,
        `block-only:${blockOnly}`
      ].join("|")
    };
  };

  const loopWrapper = function KDHybridEnemyLoopPathAudit(...args) {
    const previous = active;
    const transaction = {
      keys: new Map(),
      segmentKeys: new Map(),
      segment: 0,
      lastKey: null,
      lastSegment: -1,
      pathCalls: 0
    };
    active = transaction;
    totals.loopCalls += 1;
    try {
      return Reflect.apply(officialLoop, this, args);
    } finally {
      if (transaction.pathCalls > 0) totals.loopsWithPathCalls += 1;
      totals.uniquePathQueries += transaction.keys.size;
      active = previous;
    }
  };

  const pathWrapper = function KDHybridEnemyLoopPathAuditCall(...args) {
    const result = Reflect.apply(officialPath, this, args);
    if (active === null) return result;

    const { key, signature } = normalize(args);
    totals.pathCalls += 1;
    active.pathCalls += 1;
    signatureCounts.set(
      signature,
      Number(signatureCounts.get(signature) ?? 0) + 1
    );
    if (active.keys.has(key)) {
      totals.repeatedPathQueries += 1;
    } else {
      active.keys.set(key, result);
    }
    const segmentKey = `${active.segment}:${key}`;
    if (active.segmentKeys.has(segmentKey)) {
      totals.sameSegmentRepeatedQueries += 1;
      if (active.segmentKeys.get(segmentKey) !== result) {
        totals.sameSegmentResultMismatches += 1;
      }
    } else {
      active.segmentKeys.set(segmentKey, result);
    }
    if (
      active.lastSegment === active.segment &&
      active.lastKey === key
    ) {
      totals.consecutiveRepeatedQueries += 1;
    }
    active.lastKey = key;
    active.lastSegment = active.segment;
    return result;
  };

  KinkyDungeonEnemyLoop = loopWrapper;
  KinkyDungeonCheckPath = pathWrapper;
  for (const name of boundaryNames) {
    const original = globalThis[name];
    if (typeof original !== "function") continue;
    const wrapper = function KDHybridEnemyLoopPathBoundary(...args) {
      if (active !== null) {
        active.segment += 1;
        active.lastKey = null;
        active.lastSegment = -1;
        boundaryCounts.set(
          name,
          Number(boundaryCounts.get(name) ?? 0) + 1
        );
      }
      return Reflect.apply(original, this, args);
    };
    globalThis[name] = wrapper;
    boundaryWrappers.push({ name, original, wrapper });
  }

  const perTurnMilliseconds = [];
  let run;
  try {
    for (let index = 0; index < turns; index += 1) {
      const started = performance.now();
      KinkyDungeonAdvanceTime(1, false, true);
      perTurnMilliseconds.push(performance.now() - started);
    }
    run = {
      turns,
      totalMilliseconds: perTurnMilliseconds.reduce(
        (total, duration) => total + duration,
        0
      ),
      perTurnMilliseconds,
      currentTick: KinkyDungeonCurrentTick,
      entityCount: KDMapData.Entities.length
    };
  } finally {
    if (KinkyDungeonEnemyLoop === loopWrapper) {
      KinkyDungeonEnemyLoop = officialLoop;
    }
    if (KinkyDungeonCheckPath === pathWrapper) {
      KinkyDungeonCheckPath = officialPath;
    }
    for (const { name, original, wrapper } of boundaryWrappers) {
      if (globalThis[name] === wrapper) {
        globalThis[name] = original;
      }
    }
  }

  return {
    turns,
    totals,
    signatures: [...signatureCounts.entries()]
      .map(([signature, calls]) => ({ signature, calls }))
      .sort(
        (left, right) =>
          right.calls - left.calls ||
          left.signature.localeCompare(right.signature)
      ),
    boundaries: [...boundaryCounts.entries()]
      .map(([name, calls]) => ({ name, calls }))
      .sort(
        (left, right) =>
          right.calls - left.calls || left.name.localeCompare(right.name)
      ),
    run
  };
}

function measureLOSCalls(turns) {
  "use strict";
  if (!Number.isInteger(turns) || turns < 1) turns = 1;

  const officialLOS = globalThis.KinkyDungeonCheckLOS;
  const officialPath = globalThis.KinkyDungeonCheckPath;
  if (
    typeof officialLOS !== "function" ||
    typeof officialPath !== "function"
  ) {
    throw new Error("LOS audit dependencies are unavailable");
  }

  const activeCalls = [];
  const signatures = new Map();
  const totals = {
    calls: 0,
    elapsedMilliseconds: 0,
    distanceRejectedInputs: 0,
    inRangeInputs: 0,
    allowBlindInputs: 0,
    allowBarsInputs: 0,
    playerTargets: 0,
    nonplayerTargets: 0,
    playerBlindSightDefinitions: 0,
    baseBlindSightDefinitions: 0,
    pathCalls: 0,
    trueResults: 0,
    falseResults: 0,
    distanceRejectedTrueResults: 0
  };
  const increment = (map, key) =>
    map.set(key, Number(map.get(key) ?? 0) + 1);

  const pathWrapper = function KinkyDungeonCheckPathLOSAudit(...args) {
    const active = activeCalls[activeCalls.length - 1];
    if (active !== undefined) {
      active.pathCalls += 1;
      totals.pathCalls += 1;
    }
    return Reflect.apply(officialPath, this, args);
  };
  const losWrapper = function KinkyDungeonCheckLOSAudit(
    enemy,
    player,
    distance,
    maxdistance,
    allowBlind,
    allowBars,
    maxFails
  ) {
    const distanceRejected = !(distance <= maxdistance);
    const playerTarget = Boolean(player?.player);
    const playerBlindSight = Boolean(enemy?.Enemy?.playerBlindSight);
    const baseBlindSight = Boolean(enemy?.Enemy?.blindSight);
    const signature = [
      distanceRejected ? "out" : "in",
      allowBlind ? "blind" : "sight",
      allowBars ? "bars" : "solid",
      playerTarget ? "player" : "entity",
      playerBlindSight ? "player-bs" : "no-player-bs",
      baseBlindSight ? "base-bs" : "no-base-bs",
      maxFails === undefined ? "default-fails" : `fails:${maxFails}`
    ].join("|");
    const record = {
      distanceRejected,
      pathCalls: 0
    };
    totals.calls += 1;
    if (distanceRejected) totals.distanceRejectedInputs += 1;
    else totals.inRangeInputs += 1;
    if (allowBlind) totals.allowBlindInputs += 1;
    if (allowBars) totals.allowBarsInputs += 1;
    if (playerTarget) totals.playerTargets += 1;
    else totals.nonplayerTargets += 1;
    if (playerBlindSight) totals.playerBlindSightDefinitions += 1;
    if (baseBlindSight) totals.baseBlindSightDefinitions += 1;
    increment(signatures, signature);

    const started = performance.now();
    activeCalls.push(record);
    try {
      const result = Reflect.apply(officialLOS, this, arguments);
      if (result) {
        totals.trueResults += 1;
        if (distanceRejected) totals.distanceRejectedTrueResults += 1;
      } else {
        totals.falseResults += 1;
      }
      return result;
    } finally {
      activeCalls.pop();
      totals.elapsedMilliseconds += performance.now() - started;
    }
  };

  globalThis.KinkyDungeonCheckPath = pathWrapper;
  globalThis.KinkyDungeonCheckLOS = losWrapper;
  const perTurnMilliseconds = [];
  let run;
  try {
    for (let index = 0; index < turns; index += 1) {
      const started = performance.now();
      KinkyDungeonAdvanceTime(1, false, true);
      perTurnMilliseconds.push(performance.now() - started);
    }
    run = {
      turns,
      totalMilliseconds: perTurnMilliseconds.reduce(
        (total, duration) => total + duration,
        0
      ),
      perTurnMilliseconds,
      currentTick: KinkyDungeonCurrentTick,
      entityCount: KDMapData.Entities.length
    };
  } finally {
    if (globalThis.KinkyDungeonCheckLOS === losWrapper) {
      globalThis.KinkyDungeonCheckLOS = officialLOS;
    }
    if (globalThis.KinkyDungeonCheckPath === pathWrapper) {
      globalThis.KinkyDungeonCheckPath = officialPath;
    }
  }

  return {
    turns,
    totals,
    signatures: [...signatures.entries()]
      .map(([signature, calls]) => ({ signature, calls }))
      .sort(
        (left, right) =>
          right.calls - left.calls ||
          left.signature.localeCompare(right.signature)
      ),
    run
  };
}

function measureBoundEffectsCalls(turns) {
  "use strict";
  if (!Number.isInteger(turns) || turns < 1) turns = 1;

  const names = [
    "KDBoundEffects",
    "KDIsImprisoned",
    "KDGetBindEffectMult"
  ];
  const originals = new Map(
    names.map((name) => [name, globalThis[name]])
  );
  if (names.some((name) => typeof originals.get(name) !== "function")) {
    throw new Error("Bound-effects audit dependencies are unavailable");
  }

  const activeCalls = [];
  const byEntity = new Map();
  const byTick = new Map();
  const byCaller = new Map();
  const tickEntityCalls = new Map();
  const tickEntityInputs = new Map();
  const returnCounts = new Map();
  const inputClassCounts = new Map();
  const helperCounts = {
    imprisonmentChecks: 0,
    bindMultiplierChecks: 0
  };
  const totals = {
    calls: 0,
    elapsedMilliseconds: 0,
    uniqueEntities: 0,
    sameTickEntityRepeats: 0,
    sameTickEntitySameInputRepeats: 0,
    consecutiveSameEntityCalls: 0,
    consecutiveSameInputCalls: 0,
    boundCapableCalls: 0,
    incapableCalls: 0,
    noBoundLevelCalls: 0,
    activeBoundLevelCalls: 0,
    imprisonmentChecks: 0,
    imprisonedResults: 0,
    bindMultiplierChecks: 0,
    localImprisonedFlagCalls: 0,
    collectionImprisonedFlagCalls: 0
  };
  let previousEntityId;
  let previousInputKey;

  const increment = (map, key, amount = 1) => {
    map.set(key, Number(map.get(key) ?? 0) + amount);
  };
  const normalizedFlag = (value) =>
    value === undefined ? "undefined" : String(value);
  const activeFlag = (value) => value > 0 || value == -1;
  const captureCaller = () => {
    const lines = String(new Error().stack ?? "").split("\n").slice(1);
    for (const line of lines) {
      if (
        line.includes("KDBoundEffectsAudit") ||
        line.includes("captureCaller") ||
        line.includes("measureBoundEffectsCalls")
      ) {
        continue;
      }
      const match = line.match(/^\s*at\s+([^(]+?)(?:\s+\(|$)/u);
      if (match?.[1]) return match[1].trim();
      return line.trim();
    }
    return "unknown";
  };
  const getEntitySummary = (enemy) => {
    const id = enemy?.id ?? null;
    let summary = byEntity.get(id);
    if (summary === undefined) {
      summary = {
        enemyId: id,
        enemyName: enemy?.Enemy?.name ?? null,
        calls: 0,
        sameTickRepeats: 0,
        sameInputRepeats: 0,
        imprisonmentChecks: 0,
        imprisonedResults: 0,
        bindMultiplierChecks: 0,
        inputClasses: new Map(),
        returns: new Map(),
        inputKeys: new Set()
      };
      byEntity.set(id, summary);
    }
    return summary;
  };

  const officialImprisoned = originals.get("KDIsImprisoned");
  const imprisonmentWrapper = function KDIsImprisonedBoundEffectsAudit(
    ...args
  ) {
    const result = Reflect.apply(officialImprisoned, this, args);
    const active = activeCalls[activeCalls.length - 1];
    if (active !== undefined) {
      active.imprisonmentChecks += 1;
      if (result) active.imprisonedResults += 1;
    }
    helperCounts.imprisonmentChecks += 1;
    return result;
  };

  const officialMultiplier = originals.get("KDGetBindEffectMult");
  const multiplierWrapper = function KDGetBindEffectMultBoundEffectsAudit(
    ...args
  ) {
    const result = Reflect.apply(officialMultiplier, this, args);
    const active = activeCalls[activeCalls.length - 1];
    if (active !== undefined) active.bindMultiplierChecks += 1;
    helperCounts.bindMultiplierChecks += 1;
    return result;
  };

  const officialBoundEffects = originals.get("KDBoundEffects");
  const boundEffectsWrapper = function KDBoundEffectsAudit(enemy) {
    const tick = Number(globalThis.KinkyDungeonCurrentTick ?? 0);
    const entityId = enemy?.id ?? null;
    const enemyName = enemy?.Enemy?.name ?? null;
    const boundCapable = Boolean(enemy?.Enemy?.bound);
    const boundLevel = Number(enemy?.boundLevel ?? 0);
    const hp = Number(enemy?.hp ?? 0);
    const maxhp = Number(enemy?.Enemy?.maxhp ?? 0);
    const unstoppable = Boolean(enemy?.Enemy?.tags?.unstoppable);
    const unflinching = Boolean(enemy?.Enemy?.tags?.unflinching);
    const localImprisonedFlag = enemy?.flags?.imprisoned;
    const collectionImprisonedFlag =
      globalThis.KDGameData?.Collection?.[String(entityId)]?.flags
        ?.imprisoned;
    const inputClass = !boundCapable
      ? "incapable"
      : !boundLevel
        ? "bound-capable-no-level"
        : "active-bound-level";
    const inputKey = [
      entityId,
      boundCapable ? 1 : 0,
      boundLevel,
      hp,
      maxhp,
      unstoppable ? 1 : 0,
      unflinching ? 1 : 0,
      normalizedFlag(localImprisonedFlag),
      normalizedFlag(collectionImprisonedFlag)
    ].join("|");
    const tickEntityKey = `${tick}|${entityId}`;
    const tickEntityInputKey = `${tickEntityKey}|${inputKey}`;
    const priorEntityCalls = Number(
      tickEntityCalls.get(tickEntityKey) ?? 0
    );
    const priorInputCalls = Number(
      tickEntityInputs.get(tickEntityInputKey) ?? 0
    );
    const entitySummary = getEntitySummary(enemy);
    const caller = captureCaller();
    const call = {
      tick,
      entityId,
      enemyName,
      inputClass,
      imprisonmentChecks: 0,
      imprisonedResults: 0,
      bindMultiplierChecks: 0
    };

    totals.calls += 1;
    if (boundCapable) totals.boundCapableCalls += 1;
    else totals.incapableCalls += 1;
    if (boundLevel) totals.activeBoundLevelCalls += 1;
    else totals.noBoundLevelCalls += 1;
    if (activeFlag(localImprisonedFlag)) {
      totals.localImprisonedFlagCalls += 1;
    }
    if (activeFlag(collectionImprisonedFlag)) {
      totals.collectionImprisonedFlagCalls += 1;
    }
    if (priorEntityCalls > 0) {
      totals.sameTickEntityRepeats += 1;
      entitySummary.sameTickRepeats += 1;
    }
    if (priorInputCalls > 0) {
      totals.sameTickEntitySameInputRepeats += 1;
      entitySummary.sameInputRepeats += 1;
    }
    if (previousEntityId === entityId) {
      totals.consecutiveSameEntityCalls += 1;
    }
    if (previousInputKey === inputKey) {
      totals.consecutiveSameInputCalls += 1;
    }
    previousEntityId = entityId;
    previousInputKey = inputKey;
    tickEntityCalls.set(tickEntityKey, priorEntityCalls + 1);
    tickEntityInputs.set(tickEntityInputKey, priorInputCalls + 1);
    increment(byTick, tick);
    increment(byCaller, caller);
    increment(inputClassCounts, inputClass);
    entitySummary.calls += 1;
    increment(entitySummary.inputClasses, inputClass);
    entitySummary.inputKeys.add(inputKey);

    const started = performance.now();
    activeCalls.push(call);
    try {
      const result = Reflect.apply(officialBoundEffects, this, arguments);
      increment(returnCounts, String(result));
      increment(entitySummary.returns, String(result));
      return result;
    } finally {
      activeCalls.pop();
      totals.elapsedMilliseconds += performance.now() - started;
      totals.imprisonmentChecks += call.imprisonmentChecks;
      totals.imprisonedResults += call.imprisonedResults;
      totals.bindMultiplierChecks += call.bindMultiplierChecks;
      entitySummary.imprisonmentChecks += call.imprisonmentChecks;
      entitySummary.imprisonedResults += call.imprisonedResults;
      entitySummary.bindMultiplierChecks += call.bindMultiplierChecks;
    }
  };

  globalThis.KDIsImprisoned = imprisonmentWrapper;
  globalThis.KDGetBindEffectMult = multiplierWrapper;
  globalThis.KDBoundEffects = boundEffectsWrapper;

  const perTurnMilliseconds = [];
  let run;
  try {
    for (let index = 0; index < turns; index += 1) {
      const started = performance.now();
      KinkyDungeonAdvanceTime(1, false, true);
      perTurnMilliseconds.push(performance.now() - started);
    }
    run = {
      turns,
      totalMilliseconds: perTurnMilliseconds.reduce(
        (total, duration) => total + duration,
        0
      ),
      perTurnMilliseconds,
      currentTick: KinkyDungeonCurrentTick,
      entityCount: KDMapData.Entities.length
    };
  } finally {
    if (globalThis.KDBoundEffects === boundEffectsWrapper) {
      globalThis.KDBoundEffects = officialBoundEffects;
    }
    if (globalThis.KDGetBindEffectMult === multiplierWrapper) {
      globalThis.KDGetBindEffectMult = officialMultiplier;
    }
    if (globalThis.KDIsImprisoned === imprisonmentWrapper) {
      globalThis.KDIsImprisoned = officialImprisoned;
    }
  }

  totals.uniqueEntities = byEntity.size;
  const summarizeMap = (map, keyName) =>
    [...map.entries()]
      .map(([key, calls]) => ({ [keyName]: key, calls }))
      .sort(
        (left, right) =>
          right.calls - left.calls ||
          String(left[keyName]).localeCompare(String(right[keyName]))
      );
  const topEntities = [...byEntity.values()]
    .map((summary) => ({
      enemyId: summary.enemyId,
      enemyName: summary.enemyName,
      calls: summary.calls,
      sameTickRepeats: summary.sameTickRepeats,
      sameInputRepeats: summary.sameInputRepeats,
      uniqueInputs: summary.inputKeys.size,
      imprisonmentChecks: summary.imprisonmentChecks,
      imprisonedResults: summary.imprisonedResults,
      bindMultiplierChecks: summary.bindMultiplierChecks,
      inputClasses: summarizeMap(summary.inputClasses, "inputClass"),
      returns: summarizeMap(summary.returns, "result")
    }))
    .sort(
      (left, right) =>
        right.calls - left.calls ||
        Number(left.enemyId ?? 0) - Number(right.enemyId ?? 0)
    )
    .slice(0, 40);

  return {
    turns,
    totals,
    helperCounts,
    inputClasses: summarizeMap(inputClassCounts, "inputClass"),
    returns: summarizeMap(returnCounts, "result"),
    byTick: summarizeMap(byTick, "tick"),
    byCaller: summarizeMap(byCaller, "caller"),
    topEntities,
    run
  };
}

function measureCombatStatusTransactions(turns) {
  "use strict";
  if (!Number.isInteger(turns) || turns < 1) turns = 1;

  const damageName = "KDDamageEnemy";
  const statName = "KinkyDungeonGetBuffedStat";
  const eventName = "KinkyDungeonSendEvent";
  const mutationNames = [
    "KinkyDungeonApplyBuffToEntity",
    "KDApplyBuff",
    "KinkyDungeonExpireBuff",
    "KinkyDungeonTickBuffTag"
  ];
  const originals = new Map();
  const wrappers = new Map();
  const stack = [];
  const transactions = [];
  const listIds = new WeakMap();
  const byStat = {};
  const byEvent = {};
  const byMutation = {};
  let nextListId = 1;
  let outsideStatCalls = 0;

  const increment = (record, key, amount = 1) => {
    record[key] = Number(record[key] ?? 0) + amount;
  };
  const getListId = (list) => {
    if (
      (typeof list !== "object" || list === null) &&
      typeof list !== "function"
    ) {
      return `${typeof list}:${String(list)}`;
    }
    let id = listIds.get(list);
    if (id === undefined) {
      id = nextListId;
      nextListId += 1;
      listIds.set(list, id);
    }
    return `object:${id}`;
  };
  const currentTransaction = () => stack[stack.length - 1] ?? null;
  const breakSegment = (transaction) => {
    if (transaction === null) return;
    transaction.segment += 1;
    transaction.segmentKeys.clear();
    transaction.lastStatKey = null;
  };
  const install = (name, createWrapper) => {
    const original = globalThis[name];
    if (typeof original !== "function") return false;
    const wrapper = createWrapper(original);
    originals.set(name, original);
    wrappers.set(name, wrapper);
    globalThis[name] = wrapper;
    return true;
  };

  if (
    typeof globalThis[damageName] !== "function" ||
    typeof globalThis[statName] !== "function" ||
    typeof globalThis[eventName] !== "function"
  ) {
    throw new Error("Combat/status audit dependencies are unavailable");
  }

  install(damageName, (official) =>
    function KDDamageEnemyCombatStatusAudit(...args) {
      const enemy = args[0];
      const damage = args[1];
      const transaction = {
        index: transactions.length,
        enemyId: enemy?.id ?? null,
        enemyName: enemy?.Enemy?.name ?? null,
        damageType: damage?.type ?? "stun",
        startedMilliseconds: performance.now(),
        elapsedMilliseconds: 0,
        statCalls: 0,
        repeatStatCalls: 0,
        consecutiveDuplicateStatCalls: 0,
        sameSegmentRepeatStatCalls: 0,
        eventCalls: 0,
        mutationCalls: 0,
        segment: 0,
        statKeyCalls: new Map(),
        uniqueStatKeys: new Set(),
        segmentKeys: new Set(),
        lastStatKey: null,
        events: {},
        mutations: {}
      };
      stack.push(transaction);
      try {
        return Reflect.apply(official, this, args);
      } finally {
        stack.pop();
        transaction.elapsedMilliseconds =
          performance.now() - transaction.startedMilliseconds;
        transactions.push(transaction);
      }
    }
  );

  install(statName, (official) =>
    function KinkyDungeonGetBuffedStatCombatStatusAudit(
      list,
      stat,
      onlyPositiveDuration
    ) {
      const transaction = currentTransaction();
      let summary = null;
      if (transaction === null) {
        outsideStatCalls += 1;
      } else {
        const statLabel = String(stat);
        const key = `${getListId(list)}|${statLabel}|${
          onlyPositiveDuration ? 1 : 0
        }`;
        const previousCalls = Number(
          transaction.statKeyCalls.get(key) ?? 0
        );
        const consecutiveDuplicate =
          transaction.lastStatKey === key;
        const sameSegmentRepeat = transaction.segmentKeys.has(key);
        transaction.statCalls += 1;
        transaction.uniqueStatKeys.add(key);
        transaction.statKeyCalls.set(key, previousCalls + 1);
        if (previousCalls > 0) transaction.repeatStatCalls += 1;
        if (consecutiveDuplicate) {
          transaction.consecutiveDuplicateStatCalls += 1;
        }
        if (sameSegmentRepeat) {
          transaction.sameSegmentRepeatStatCalls += 1;
        }
        transaction.segmentKeys.add(key);
        transaction.lastStatKey = key;

        summary = byStat[statLabel] ?? {
          calls: 0,
          repeats: 0,
          consecutiveDuplicates: 0,
          sameSegmentRepeats: 0,
          zeroResults: 0,
          nonzeroResults: 0
        };
        byStat[statLabel] = summary;
        summary.calls += 1;
        if (previousCalls > 0) summary.repeats += 1;
        if (consecutiveDuplicate) {
          summary.consecutiveDuplicates += 1;
        }
        if (sameSegmentRepeat) {
          summary.sameSegmentRepeats += 1;
        }
      }

      const result = Reflect.apply(official, this, arguments);
      if (summary !== null) {
        if (result) summary.nonzeroResults += 1;
        else summary.zeroResults += 1;
      }
      return result;
    }
  );

  install(eventName, (official) =>
    function KinkyDungeonSendEventCombatStatusAudit(event, ...args) {
      const transaction = currentTransaction();
      if (transaction !== null) {
        transaction.eventCalls += 1;
        increment(transaction.events, String(event));
        increment(byEvent, String(event));
        breakSegment(transaction);
      }
      try {
        return Reflect.apply(official, this, [event, ...args]);
      } finally {
        breakSegment(transaction);
      }
    }
  );

  for (const name of mutationNames) {
    install(name, (official) =>
      function KDBuffMutationCombatStatusAudit(...args) {
        const transaction = currentTransaction();
        if (transaction !== null) {
          transaction.mutationCalls += 1;
          increment(transaction.mutations, name);
          increment(byMutation, name);
          breakSegment(transaction);
        }
        try {
          return Reflect.apply(official, this, args);
        } finally {
          breakSegment(transaction);
        }
      }
    );
  }

  const perTurnMilliseconds = [];
  let run;
  try {
    for (let index = 0; index < turns; index += 1) {
      const started = performance.now();
      KinkyDungeonAdvanceTime(1, false, true);
      perTurnMilliseconds.push(performance.now() - started);
    }
    run = {
      turns,
      totalMilliseconds: perTurnMilliseconds.reduce(
        (total, duration) => total + duration,
        0
      ),
      perTurnMilliseconds,
      currentTick: KinkyDungeonCurrentTick,
      entityCount: KDMapData.Entities.length,
      player: {
        x: KinkyDungeonPlayerEntity.x,
        y: KinkyDungeonPlayerEntity.y,
        hp: KinkyDungeonPlayerEntity.hp,
        will: KinkyDungeonStatWill,
        mana: KinkyDungeonStatMana,
        stamina: KinkyDungeonStatStamina,
        distraction: KinkyDungeonStatDistraction
      }
    };
  } finally {
    for (const [name, original] of originals) {
      if (globalThis[name] === wrappers.get(name)) {
        globalThis[name] = original;
      }
    }
  }

  const totals = transactions.reduce(
    (result, transaction) => {
      result.elapsedMilliseconds += transaction.elapsedMilliseconds;
      result.statCalls += transaction.statCalls;
      result.uniqueStatKeys += transaction.uniqueStatKeys.size;
      result.repeatStatCalls += transaction.repeatStatCalls;
      result.consecutiveDuplicateStatCalls +=
        transaction.consecutiveDuplicateStatCalls;
      result.sameSegmentRepeatStatCalls +=
        transaction.sameSegmentRepeatStatCalls;
      result.eventCalls += transaction.eventCalls;
      result.mutationCalls += transaction.mutationCalls;
      return result;
    },
    {
      elapsedMilliseconds: 0,
      statCalls: 0,
      uniqueStatKeys: 0,
      repeatStatCalls: 0,
      consecutiveDuplicateStatCalls: 0,
      sameSegmentRepeatStatCalls: 0,
      eventCalls: 0,
      mutationCalls: 0
    }
  );
  const summarizeCounts = (record, keyName) =>
    Object.entries(record)
      .map(([key, calls]) => ({ [keyName]: key, calls }))
      .sort(
        (left, right) =>
          right.calls - left.calls ||
          String(left[keyName]).localeCompare(String(right[keyName]))
      );
  const topTransactions = transactions
    .map((transaction) => ({
      index: transaction.index,
      enemyId: transaction.enemyId,
      enemyName: transaction.enemyName,
      damageType: transaction.damageType,
      elapsedMilliseconds: transaction.elapsedMilliseconds,
      statCalls: transaction.statCalls,
      uniqueStatKeys: transaction.uniqueStatKeys.size,
      repeatStatCalls: transaction.repeatStatCalls,
      consecutiveDuplicateStatCalls:
        transaction.consecutiveDuplicateStatCalls,
      sameSegmentRepeatStatCalls:
        transaction.sameSegmentRepeatStatCalls,
      eventCalls: transaction.eventCalls,
      mutationCalls: transaction.mutationCalls,
      events: summarizeCounts(transaction.events, "event"),
      mutations: summarizeCounts(transaction.mutations, "mutation")
    }))
    .sort(
      (left, right) =>
        right.statCalls - left.statCalls ||
        right.elapsedMilliseconds - left.elapsedMilliseconds
    )
    .slice(0, 40);

  return {
    turns,
    transactionCount: transactions.length,
    outsideStatCalls,
    totals,
    byStat: Object.entries(byStat)
      .map(([stat, counts]) => ({ stat, ...counts }))
      .sort(
        (left, right) =>
          right.calls - left.calls || left.stat.localeCompare(right.stat)
      ),
    byEvent: summarizeCounts(byEvent, "event"),
    byMutation: summarizeCounts(byMutation, "mutation"),
    topTransactions,
    run
  };
}

function measureEventFamilyDispatch(turns) {
  "use strict";
  if (!Number.isInteger(turns) || turns < 1) turns = 1;

  const senders = [
    "KinkyDungeonSendEvent",
    "KinkyDungeonSendMagicEvent",
    "KinkyDungeonSendWeaponEvent",
    "KinkyDungeonSendInventorySelectedEvent",
    "KinkyDungeonSendInventoryIconEvent",
    "KinkyDungeonSendInventoryEvent",
    "KDSendNPCRestraintEvent",
    "KinkyDungeonSendBulletEvent",
    "KinkyDungeonSendBuffEvent",
    "KinkyDungeonSendOutfitEvent",
    "KinkyDungeonSendEnemyEvent",
    "KinkyDungeonHandleGenericEvent",
    "KinkyDungeonSendAltEvent",
    "KinkyDungeonSendFacilityEvent"
  ];
  const handlers = [
    "KinkyDungeonHandleMagicEvent",
    "KinkyDungeonHandleWeaponEvent",
    "KinkyDungeonHandleInventorySelectedEvent",
    "KinkyDungeonHandleInventoryIconEvent",
    "KinkyDungeonHandleInventoryEvent",
    "KinkyDungeonHandleBulletEvent",
    "KinkyDungeonHandleBuffEvent",
    "KinkyDungeonHandleOutfitEvent",
    "KinkyDungeonHandleEnemyEvent",
    "KinkyDungeonHandleAltEvent",
    "KinkyDungeonHandleFacilityEvent"
  ];
  const mapReaders = {
    KinkyDungeonSendMagicEvent: (event) =>
      KDMapHasEvent(KDEventMapSpell, event),
    KinkyDungeonSendWeaponEvent: (event, args) =>
      Boolean(args[2]) || KDMapHasEvent(KDEventMapWeapon, event),
    KinkyDungeonSendInventorySelectedEvent: (event) =>
      KDMapHasEvent(KDEventMapInventorySelected, event),
    KinkyDungeonSendInventoryIconEvent: (event) =>
      KDMapHasEvent(KDEventMapInventoryIcon, event),
    KinkyDungeonSendInventoryEvent: (event) =>
      KDMapHasEvent(KDEventMapInventory, event),
    KinkyDungeonSendBulletEvent: (event) =>
      KDMapHasEvent(KDEventMapBullet, event),
    KinkyDungeonSendBuffEvent: (event) =>
      KDMapHasEvent(KDEventMapBuff, event),
    KinkyDungeonSendOutfitEvent: (event) =>
      KDMapHasEvent(KDEventMapOutfit, event),
    KinkyDungeonSendEnemyEvent: (event, args) => {
      const mapData = args[2] === undefined ? KDMapData : args[2];
      return mapData !== KDMapData || KDMapHasEvent(KDEventMapEnemy, event);
    },
    KinkyDungeonHandleGenericEvent: (event) =>
      KDMapHasEvent(KDEventMapGeneric, event),
    KinkyDungeonSendAltEvent: (event) =>
      KDMapHasEvent(KDEventMapAlt, event),
    KinkyDungeonSendFacilityEvent: (event) =>
      KDMapHasEvent(KDEventMapFacility, event)
  };
  const originals = new Map();
  const wrappers = new Map();
  const frames = [];
  const records = {};
  const makeRecord = (kind) => ({
    kind,
    calls: 0,
    mapHits: 0,
    mapMisses: 0,
    mapReadFailures: 0,
    handlerCalls: 0,
    inclusiveMilliseconds: 0,
    exclusiveMilliseconds: 0,
    events: {},
    handlers: {}
  });

  for (const name of senders) records[name] = makeRecord("sender");
  for (const name of handlers) records[name] = makeRecord("handler");

  const invokeMeasured = (name, kind, callback) => {
    const record = records[name];
    const frame = { kind, name, childMilliseconds: 0 };
    const started = performance.now();
    frames.push(frame);
    try {
      return callback();
    } finally {
      const elapsed = performance.now() - started;
      frames.pop();
      record.inclusiveMilliseconds += elapsed;
      record.exclusiveMilliseconds += Math.max(
        0,
        elapsed - frame.childMilliseconds
      );
      const parent = frames[frames.length - 1];
      if (parent) parent.childMilliseconds += elapsed;
    }
  };

  for (const name of [...senders, ...handlers]) {
    const original = globalThis[name];
    if (typeof original !== "function") {
      delete records[name];
      continue;
    }
    originals.set(name, original);
    const kind = senders.includes(name) ? "sender" : "handler";
    const wrapper = function (...args) {
      const record = records[name];
      const event = String(args[0] ?? "");
      record.calls += 1;
      record.events[event] = Number(record.events[event] ?? 0) + 1;
      if (kind === "sender") {
        const mapReader = mapReaders[name];
        if (mapReader) {
          try {
            if (mapReader(event, args)) record.mapHits += 1;
            else record.mapMisses += 1;
          } catch {
            record.mapReadFailures += 1;
          }
        }
      } else {
        const senderFrame = [...frames]
          .reverse()
          .find((frame) => frame.kind === "sender");
        if (senderFrame && records[senderFrame.name]) {
          const senderRecord = records[senderFrame.name];
          senderRecord.handlerCalls += 1;
          senderRecord.handlers[name] =
            Number(senderRecord.handlers[name] ?? 0) + 1;
        }
      }
      return invokeMeasured(name, kind, () =>
        Reflect.apply(original, this, args)
      );
    };
    wrappers.set(name, wrapper);
    globalThis[name] = wrapper;
  }

  const perTurnMilliseconds = [];
  try {
    for (let index = 0; index < turns; index += 1) {
      const started = performance.now();
      KinkyDungeonAdvanceTime(1, false, true);
      perTurnMilliseconds.push(performance.now() - started);
    }
  } finally {
    for (const [name, original] of originals) {
      if (globalThis[name] === wrappers.get(name)) {
        globalThis[name] = original;
      }
    }
  }

  const summarizeRecord = (record) => ({
    ...record,
    events: Object.entries(record.events)
      .map(([event, calls]) => ({ event, calls }))
      .sort(
        (left, right) =>
          right.calls - left.calls || left.event.localeCompare(right.event)
      )
      .slice(0, 50),
    handlers: Object.entries(record.handlers)
      .map(([handler, calls]) => ({ handler, calls }))
      .sort(
        (left, right) =>
          right.calls - left.calls ||
          left.handler.localeCompare(right.handler)
      )
  });
  return {
    turns,
    turnMilliseconds: perTurnMilliseconds.reduce(
      (total, duration) => total + duration,
      0
    ),
    perTurnMilliseconds,
    records: Object.fromEntries(
      Object.entries(records).map(([name, record]) => [
        name,
        summarizeRecord(record)
      ])
    )
  };
}

function measureHotFunctionCalls(turns) {
  "use strict";
  if (!Number.isInteger(turns) || turns < 1) turns = 1;

  const names = [
    "KinkyDungeonUpdateEnemies",
    "KinkyDungeonEnemyLoop",
    "KinkyDungeonAllWeapon",
    "KinkyDungeonAllConsumable",
    "KDGetRestraintsEligible",
    "KinkyDungeonGetRestraint",
    "KDGetTags",
    "KDGetExtraTags",
    "KDCanAddRestraint",
    "KinkyDungeonLeashingEnemy",
    "KinkyDungeonUpdateRestraints",
    "KDUpdateRestraintMetadata",
    "KinkyDungeonDealDamage",
    "KDChangeDistraction",
    "KDChangeWill",
    "KinkyDungeonEnemyTryAttack",
    "KinkyDungeonDamageEnemy",
    "KDDamageEnemy",
    "KinkyDungeonAttackEnemy",
    "KinkyDungeonPlayerEffect",
    "KDEnemyAccuracy",
    "KinkyDungeonMultiplicativeStat",
    "KinkyDungeonGetWarningTiles",
    "KinkyDungeonCheckProjectileClearance",
    "KDEnemyAddSound",
    "KinkyDungeonPlaySound",
    "KDAddThought",
    "KinkyDungeonEnemyCheckHP",
    "KDEntityBuffedStat",
    "KDEntityMaxBuffedStat",
    "KDBoundEffects",
    "KDGetBindEffectMult",
    "KinkyDungeonTickBuffs",
    "KinkyDungeonTickBuffTag",
    "KinkyDungeonUpdateBuffs",
    "KinkyDungeonGetBuffedStat",
    "KinkyDungeonGetImmunity",
    "KinkyDungeonApplyBuffToEntity",
    "KDApplyBuff",
    "KDGetFaction",
    "KDHostile",
    "KDFactionHostile",
    "KDFactionRelation",
    "KDOpinionRepMod",
    "KDGetModifiedOpinionID",
    "KDGetModifiedOpinion",
    "KDIsNPCPersistent",
    "KDGetPersistentNPC",
    "KinkyDungeonFindID",
    "KDGetEnemyCache",
    "KinkyDungeonEnemyAt",
    "KinkyDungeonEntityAt",
    "KDPointWanderable",
    "KDEnemyHasFlag",
    "KDEntityHasFlag",
    "KinkyDungeonNearestPlayer",
    "KDEnemyVisionRadius",
    "KinkyDungeonCheckLOS",
    "KinkyDungeonCheckPath",
    "KinkyDungeonVisionGet",
    "KinkyDungeonJailGuard",
    "KDAllied",
    "KDIsInParty",
    "KinkyDungeonFindMaster",
    "KinkyDungeonNoEnemyExceptSub",
    "KinkyDungeonAggressive",
    "KDCommanderUpdate",
    "KDCommanderUpdateRoles",
    "KDCommanderUpdateOrders",
    "KDGetOrdersList",
    "KDGetByWeight",
    "KinkyDungeonSetEnemyFlag",
    "KDSetFactionRelation",
    "KDChangeFactionRelation",
    "KDAddToParty",
    "KDRemoveFromParty",
    "KDAddOpinion",
    "KDAddOpinionPersistent",
    "KinkyDungeonSendEvent",
    "KinkyDungeonSendDialogue",
    "KinkyDungeonMakeNoiseSignal"
  ];
  const commanderRoleMutationNames = new Set([
    "KinkyDungeonSetEnemyFlag",
    "KDSetFactionRelation",
    "KDChangeFactionRelation",
    "KDAddToParty",
    "KDRemoveFromParty",
    "KDAddOpinion",
    "KDAddOpinionPersistent",
    "KinkyDungeonSendEvent",
    "KinkyDungeonSendDialogue",
    "KinkyDungeonMakeNoiseSignal"
  ]);
  const originals = new Map();
  const wrappers = new Map();
  const commanderWrappers = [];
  const calls = Object.fromEntries(names.map((name) => [name, 0]));
  const commanderRoleCalls = Object.fromEntries(
    names.map((name) => [name, 0])
  );
  const objectIds = new WeakMap();
  let nextObjectId = 1;
  const hostilePairs = new Map();
  const commanderRoleHostilePairs = new Map();
  let previousHostilePair = null;
  let consecutiveHostileRepeats = 0;
  let previousCommanderRoleHostilePair = null;
  let consecutiveCommanderRoleHostileRepeats = 0;
  let commanderRoleDepth = 0;
  const commanderRoleInputChanges = [];
  const commanderRoleInputStack = [];
  const commanderFacade = globalThis.KDCommanderUpdateRoles;
  const useCommanderHooks =
    typeof commanderFacade === "function" &&
    commanderFacade.__kdHybridFacade === true &&
    typeof globalThis.KDHybrid?.registerHook === "function";
  const findMasterFacade = globalThis.KinkyDungeonFindMaster;
  const useFindMasterHooks =
    typeof findMasterFacade === "function" &&
    findMasterFacade.__kdHybridFacade === true &&
    typeof globalThis.KDHybrid?.registerHook === "function";
  const nearestPlayerFacade = globalThis.KinkyDungeonNearestPlayer;
  const useNearestPlayerHooks =
    typeof nearestPlayerFacade === "function" &&
    nearestPlayerFacade.__kdHybridFacade === true &&
    typeof globalThis.KDHybrid?.registerHook === "function";
  const enemyUpdateFacade = globalThis.KinkyDungeonUpdateEnemies;
  const useEnemyUpdateHooks =
    typeof enemyUpdateFacade === "function" &&
    enemyUpdateFacade.__kdHybridFacade === true &&
    typeof globalThis.KDHybrid?.registerHook === "function";
  const commanderHookIds = [];
  const enemyAt = {
    integerCoordinates: 0,
    nonIntegerCoordinates: 0,
    defaultMap: 0,
    explicitMainMap: 0,
    otherMap: 0
  };
  const entityAt = {
    integerCoordinates: 0,
    nonIntegerCoordinates: 0,
    defaultMap: 0,
    explicitMainMap: 0,
    otherMap: 0
  };
  const pointWanderableCoordinates = new Map();
  const pointWanderable = {
    calls: 0,
    integerCoordinates: 0,
    nonIntegerCoordinates: 0,
    defaultMap: 0,
    explicitMainMap: 0,
    otherMap: 0,
    trueResults: 0,
    falseResults: 0
  };
  const factionArguments = {
    missing: 0,
    string: 0,
    player: 0,
    rage: 0,
    directFaction: 0,
    otherEntity: 0
  };
  const factionCallerSamples = {};
  const nearestPlayerArguments = {
    calls: 0,
    decoy: 0,
    noDecoy: 0,
    suppliedVisionRadius: 0,
    computedVisionRadius: 0
  };
  const nearbyArguments = {
    calls: 0,
    integerCoordinates: 0,
    nonIntegerCoordinates: 0,
    chebyshev: 0,
    euclidean: 0,
    hostileFilter: 0,
    nonhostileFilter: 0,
    noHostilityFilter: 0,
    cacheBranchEligible: 0,
    scanBranchExpected: 0,
    distances: {}
  };
  const commanderOrderCalls = {};
  const commanderRoleOrderCalls = {};
  const restraintEligibilitySignatures = new Map();
  const restraintEligibility = {
    calls: 0,
    topLevelCalls: 0,
    recursiveCalls: 0,
    maxDepth: 0,
    resultItems: 0,
    emptyResults: 0,
    restraintCatalogSize: Array.isArray(globalThis.KinkyDungeonRestraints)
      ? globalThis.KinkyDungeonRestraints.length
      : null,
    depth: 0
  };
  const buffApplicationSignatures = new Map();
  const buffTicks = {
    calls: 0,
    playerCalls: 0,
    enemyCalls: 0,
    emptyLists: 0,
    nonemptyLists: 0,
    totalEntries: 0
  };

  for (const name of names) {
    const original = globalThis[name];
    if (typeof original !== "function") {
      delete calls[name];
      delete commanderRoleCalls[name];
      continue;
    }
    if (
      (name === "KDCommanderUpdateRoles" && useCommanderHooks) ||
      (name === "KinkyDungeonFindMaster" && useFindMasterHooks) ||
      (name === "KinkyDungeonNearestPlayer" && useNearestPlayerHooks) ||
      (name === "KinkyDungeonUpdateEnemies" && useEnemyUpdateHooks)
    ) {
      continue;
    }
    originals.set(name, original);
    const wrapper = function (...args) {
      calls[name] += 1;
      if (name === "KDCommanderUpdateRoles") {
        commanderRoleCalls[name] += 1;
        const before = captureHostilityInputs();
        commanderRoleDepth += 1;
        try {
          return Reflect.apply(original, this, args);
        } finally {
          commanderRoleDepth -= 1;
          commanderRoleInputChanges.push(
            compareHostilityInputs(before, captureHostilityInputs())
          );
        }
      }
      if (commanderRoleDepth > 0) {
        commanderRoleCalls[name] += 1;
      }
      if (name === "KinkyDungeonApplyBuffToEntity") {
        const target = args[0];
        const buff = args[1];
        const signature = [
          target?.player ? "player" : "enemy",
          String(buff?.id ?? ""),
          String(buff?.type ?? "")
        ].join(":");
        buffApplicationSignatures.set(
          signature,
          Number(buffApplicationSignatures.get(signature) ?? 0) + 1
        );
      } else if (name === "KinkyDungeonTickBuffs") {
        buffTicks.calls += 1;
        const target = args[0];
        if (target?.player) buffTicks.playerCalls += 1;
        else buffTicks.enemyCalls += 1;
        const list = target?.player
          ? KinkyDungeonPlayerBuffs
          : target?.buffs;
        const entries =
          typeof list === "object" && list !== null
            ? Object.keys(list).length
            : 0;
        buffTicks.totalEntries += entries;
        if (entries > 0) buffTicks.nonemptyLists += 1;
        else buffTicks.emptyLists += 1;
      }
      if (name === "KinkyDungeonEnemyAt") {
        recordPositionCall(enemyAt, args[0], args[1], args[2]);
      } else if (name === "KinkyDungeonEntityAt") {
        recordPositionCall(entityAt, args[0], args[1], args[6]);
      } else if (name === "KDPointWanderable") {
        pointWanderable.calls += 1;
        if (
          Number.isSafeInteger(args[0]) &&
          Number.isSafeInteger(args[1])
        ) {
          pointWanderable.integerCoordinates += 1;
        } else {
          pointWanderable.nonIntegerCoordinates += 1;
        }
        const mapKind =
          args[2] === undefined
            ? "default"
            : args[2] === globalThis.KDMapData
              ? "main"
              : "other";
        if (mapKind === "default") pointWanderable.defaultMap += 1;
        else if (mapKind === "main") pointWanderable.explicitMainMap += 1;
        else pointWanderable.otherMap += 1;
        const coordinateKey = `${mapKind}:${String(args[0])},${String(args[1])}`;
        pointWanderableCoordinates.set(
          coordinateKey,
          Number(pointWanderableCoordinates.get(coordinateKey) ?? 0) + 1
        );
        const result = Reflect.apply(original, this, args);
        if (result) pointWanderable.trueResults += 1;
        else pointWanderable.falseResults += 1;
        return result;
      } else if (name === "KDHostile") {
        const key = `${valueId(args[0])}:${valueId(args[1])}`;
        const pair = hostilePairs.get(key) ?? {
          calls: 0,
          hasTarget: args[1] !== undefined && args[1] !== null
        };
        pair.calls += 1;
        hostilePairs.set(key, pair);
        if (key === previousHostilePair) {
          consecutiveHostileRepeats += 1;
        }
        previousHostilePair = key;
        if (commanderRoleDepth > 0) {
          const scopedPair = commanderRoleHostilePairs.get(key) ?? {
            calls: 0,
            hasTarget: args[1] !== undefined && args[1] !== null
          };
          scopedPair.calls += 1;
          commanderRoleHostilePairs.set(key, scopedPair);
          if (key === previousCommanderRoleHostilePair) {
            consecutiveCommanderRoleHostileRepeats += 1;
          }
          previousCommanderRoleHostilePair = key;
        }
      } else if (name === "KDGetFaction") {
        if (calls[name] <= 32 || calls[name] % 2_048 === 0) {
          const stack = String(new Error().stack ?? "")
            .split("\n")
            .slice(2, 5)
            .map((frame) => frame.trim())
            .join(" <- ");
          factionCallerSamples[stack] =
            Number(factionCallerSamples[stack] ?? 0) + 1;
        }
        const value = args[0];
        if (value === undefined || value === null) {
          factionArguments.missing += 1;
        } else if (typeof value === "string") {
          factionArguments.string += 1;
        } else if (value.player) {
          factionArguments.player += 1;
        } else if (value.rage > 0) {
          factionArguments.rage += 1;
        } else if (value.faction) {
          factionArguments.directFaction += 1;
        } else {
          factionArguments.otherEntity += 1;
        }
      } else if (name === "KinkyDungeonNearestPlayer") {
        nearestPlayerArguments.calls += 1;
        if (args[2]) {
          nearestPlayerArguments.decoy += 1;
        } else {
          nearestPlayerArguments.noDecoy += 1;
        }
        if (args[3]) {
          nearestPlayerArguments.suppliedVisionRadius += 1;
        } else {
          nearestPlayerArguments.computedVisionRadius += 1;
        }
      }
      if (name === "KDGetRestraintsEligible") {
        const depth = restraintEligibility.depth;
        restraintEligibility.calls += 1;
        if (depth === 0) {
          restraintEligibility.topLevelCalls += 1;
        } else {
          restraintEligibility.recursiveCalls += 1;
        }
        restraintEligibility.maxDepth = Math.max(
          restraintEligibility.maxDepth,
          depth + 1
        );
        const signature = restraintEligibleSignature(args);
        const signatureRecord =
          restraintEligibilitySignatures.get(signature) ?? {
            calls: 0,
            topLevelCalls: 0,
            recursiveCalls: 0,
            resultItems: 0,
            emptyResults: 0
          };
        signatureRecord.calls += 1;
        if (depth === 0) {
          signatureRecord.topLevelCalls += 1;
        } else {
          signatureRecord.recursiveCalls += 1;
        }
        restraintEligibilitySignatures.set(signature, signatureRecord);
        restraintEligibility.depth += 1;
        try {
          const result = Reflect.apply(original, this, args);
          const itemCount = Array.isArray(result) ? result.length : 0;
          restraintEligibility.resultItems += itemCount;
          signatureRecord.resultItems += itemCount;
          if (itemCount === 0) {
            restraintEligibility.emptyResults += 1;
            signatureRecord.emptyResults += 1;
          }
          return result;
        } finally {
          restraintEligibility.depth -= 1;
        }
      }
      return Reflect.apply(original, this, args);
    };
    wrappers.set(name, wrapper);
    globalThis[name] = wrapper;
  }

  if (useCommanderHooks) {
    commanderHookIds.push(
      KDHybrid.registerHook(
        "ai",
        "before",
        (context) => {
          if (context.globalName !== "KDCommanderUpdateRoles") return;
          calls.KDCommanderUpdateRoles += 1;
          commanderRoleCalls.KDCommanderUpdateRoles += 1;
          commanderRoleInputStack.push(captureHostilityInputs());
          commanderRoleDepth += 1;
        },
        { id: "kd-hybrid-profile-commander-before", priority: 10_000 }
      ),
      KDHybrid.registerHook(
        "ai",
        "after",
        (context) => {
          if (context.globalName !== "KDCommanderUpdateRoles") return;
          finishCommanderRoleScope();
        },
        { id: "kd-hybrid-profile-commander-after", priority: -10_000 }
      ),
      KDHybrid.registerHook(
        "ai",
        "error",
        (context) => {
          if (context.globalName !== "KDCommanderUpdateRoles") return;
          finishCommanderRoleScope();
        },
        { id: "kd-hybrid-profile-commander-error", priority: -10_000 }
      )
    );
  }

  if (useFindMasterHooks) {
    commanderHookIds.push(
      KDHybrid.registerHook(
        "ai",
        "before",
        (context) => {
          if (context.globalName !== "KinkyDungeonFindMaster") return;
          calls.KinkyDungeonFindMaster += 1;
          if (commanderRoleDepth > 0) {
            commanderRoleCalls.KinkyDungeonFindMaster += 1;
          }
        },
        { id: "kd-hybrid-profile-master-before", priority: 8_000 }
      )
    );
  }

  if (useNearestPlayerHooks) {
    commanderHookIds.push(
      KDHybrid.registerHook(
        "ai",
        "before",
        (context) => {
          if (context.globalName !== "KinkyDungeonNearestPlayer") return;
          calls.KinkyDungeonNearestPlayer += 1;
          nearestPlayerArguments.calls += 1;
          if (context.args[2]) {
            nearestPlayerArguments.decoy += 1;
          } else {
            nearestPlayerArguments.noDecoy += 1;
          }
          if (context.args[3]) {
            nearestPlayerArguments.suppliedVisionRadius += 1;
          } else {
            nearestPlayerArguments.computedVisionRadius += 1;
          }
          if (commanderRoleDepth > 0) {
            commanderRoleCalls.KinkyDungeonNearestPlayer += 1;
          }
        },
        { id: "kd-hybrid-profile-nearest-before", priority: 7_000 }
      )
    );
  }

  if (useEnemyUpdateHooks) {
    commanderHookIds.push(
      KDHybrid.registerHook(
        "movement",
        "before",
        (context) => {
          if (context.globalName !== "KinkyDungeonUpdateEnemies") return;
          calls.KinkyDungeonUpdateEnemies += 1;
        },
        { id: "kd-hybrid-profile-enemy-update-before", priority: 10_000 }
      )
    );
  }

  const nearbyFacade = globalThis.KDNearbyEnemies;
  if (
    typeof nearbyFacade === "function" &&
    nearbyFacade.__kdHybridFacade === true &&
    typeof globalThis.KDHybrid?.registerHook === "function"
  ) {
    commanderHookIds.push(
      KDHybrid.registerHook(
        "ai",
        "before",
        (context) => {
          if (context.globalName !== "KDNearbyEnemies") return;
          const [x, y, distance, hostile, chebyshev, nonhostile] =
            context.args;
          nearbyArguments.calls += 1;
          if (Number.isSafeInteger(x) && Number.isSafeInteger(y)) {
            nearbyArguments.integerCoordinates += 1;
          } else {
            nearbyArguments.nonIntegerCoordinates += 1;
          }
          if (chebyshev) nearbyArguments.chebyshev += 1;
          else nearbyArguments.euclidean += 1;
          if (hostile) nearbyArguments.hostileFilter += 1;
          if (nonhostile) nearbyArguments.nonhostileFilter += 1;
          if (!hostile && !nonhostile) {
            nearbyArguments.noHostilityFilter += 1;
          }
          const key = String(distance);
          nearbyArguments.distances[key] =
            (nearbyArguments.distances[key] ?? 0) + 1;
          const entityCount = Array.isArray(KDMapData?.Entities)
            ? KDMapData.Entities.length
            : 0;
          if (
            typeof distance === "number" &&
            Number.isFinite(distance) &&
            3 * distance * distance <= entityCount
          ) {
            nearbyArguments.cacheBranchEligible += 1;
          } else {
            nearbyArguments.scanBranchExpected += 1;
          }
        },
        { id: "kd-hybrid-profile-nearby-before", priority: 9_000 }
      )
    );
  }

  const commanderMethodNames = [
    "filter",
    "weight",
    "apply",
    "maintain",
    "remove",
    "update",
    "global_before",
    "global_after"
  ];
  if (typeof KDCommanderOrders === "object" && KDCommanderOrders !== null) {
    for (const [orderName, order] of Object.entries(KDCommanderOrders)) {
      if (typeof order !== "object" || order === null) continue;
      const orderCalls = {};
      const scopedOrderCalls = {};
      for (const methodName of commanderMethodNames) {
        const original = order[methodName];
        if (typeof original !== "function") continue;
        orderCalls[methodName] = 0;
        scopedOrderCalls[methodName] = 0;
        const wrapper = function (...args) {
          orderCalls[methodName] += 1;
          if (commanderRoleDepth > 0) {
            scopedOrderCalls[methodName] += 1;
          }
          return Reflect.apply(original, this, args);
        };
        order[methodName] = wrapper;
        commanderWrappers.push({ order, methodName, original, wrapper });
      }
      commanderOrderCalls[orderName] = orderCalls;
      commanderRoleOrderCalls[orderName] = scopedOrderCalls;
    }
  }

  const perTurnMilliseconds = [];
  try {
    for (let index = 0; index < turns; index += 1) {
      const started = performance.now();
      KinkyDungeonAdvanceTime(1, false, true);
      perTurnMilliseconds.push(performance.now() - started);
    }
  } finally {
    for (const [name, original] of originals) {
      if (globalThis[name] === wrappers.get(name)) {
        globalThis[name] = original;
      }
    }
    for (const { order, methodName, original, wrapper } of commanderWrappers) {
      if (order[methodName] === wrapper) {
        order[methodName] = original;
      }
    }
    for (const hookId of commanderHookIds) {
      KDHybrid.unregisterHook(hookId);
    }
  }

  const hostilePairSummary = summarizeHostilePairs(
    hostilePairs,
    consecutiveHostileRepeats
  );
  const commanderRoleHostilePairSummary = summarizeHostilePairs(
    commanderRoleHostilePairs,
    consecutiveCommanderRoleHostileRepeats
  );

  return {
    turns,
    turnMilliseconds: perTurnMilliseconds.reduce(
      (total, duration) => total + duration,
      0
    ),
    perTurnMilliseconds,
    calls,
    enemyAt,
    entityAt,
    pointWanderable: {
      ...pointWanderable,
      uniqueCoordinateMapKeys: pointWanderableCoordinates.size,
      repeatedCalls: [...pointWanderableCoordinates.values()].reduce(
        (total, count) => total + Math.max(0, count - 1),
        0
      ),
      maxCallsForOneCoordinate: [...pointWanderableCoordinates.values()].reduce(
        (maximum, count) => Math.max(maximum, count),
        0
      ),
      topCoordinates: [...pointWanderableCoordinates.entries()]
        .map(([coordinate, count]) => ({ coordinate, count }))
        .sort(
          (left, right) =>
            right.count - left.count ||
            left.coordinate.localeCompare(right.coordinate)
        )
        .slice(0, 20)
    },
    factionArguments,
    factionCallerSamples: Object.entries(factionCallerSamples)
      .map(([stack, samples]) => ({ stack, samples }))
      .sort(
        (left, right) =>
          right.samples - left.samples || left.stack.localeCompare(right.stack)
      )
      .slice(0, 30),
    nearestPlayerArguments,
    nearbyArguments,
    restraintEligibility: {
      ...restraintEligibility,
      depth: undefined,
      uniqueContentSignatures: restraintEligibilitySignatures.size,
      repeatedCalls: [...restraintEligibilitySignatures.values()].reduce(
        (total, entry) => total + Math.max(0, entry.calls - 1),
        0
      ),
      signatures: [...restraintEligibilitySignatures.entries()]
        .map(([signature, entry]) => ({ signature, ...entry }))
        .sort(
          (left, right) =>
            right.calls - left.calls ||
            left.signature.localeCompare(right.signature)
        )
        .slice(0, 20)
    },
    buffTicks,
    buffApplications: [...buffApplicationSignatures.entries()]
      .map(([signature, calls]) => ({ signature, calls }))
      .sort(
        (left, right) =>
          right.calls - left.calls ||
          left.signature.localeCompare(right.signature)
      )
      .slice(0, 30),
    hostilePairSummary,
    commanderOrderCalls,
    commanderRoleScope: {
      calls: Object.fromEntries(
        Object.entries(commanderRoleCalls).filter(([, count]) => count > 0)
      ),
      mutatorCalls: Object.fromEntries(
        Object.entries(commanderRoleCalls).filter(
          ([name, count]) => commanderRoleMutationNames.has(name) && count > 0
        )
      ),
      hostilePairSummary: commanderRoleHostilePairSummary,
      orderCalls: commanderRoleOrderCalls,
      hostilityInputChanges: commanderRoleInputChanges
    }
  };

  function summarizeHostilePairs(pairs, consecutiveRepeats) {
    const values = [...pairs.values()];
    return {
      totalCalls: values.reduce((total, pair) => total + pair.calls, 0),
      uniquePairs: values.length,
      repeatedCalls: values.reduce(
        (total, pair) => total + Math.max(0, pair.calls - 1),
        0
      ),
      pairsCalledMoreThanOnce: values.filter((pair) => pair.calls > 1).length,
      maxCallsForOnePair: values.reduce(
        (maximum, pair) => Math.max(maximum, pair.calls),
        0
      ),
      noTargetCalls: values.reduce(
        (total, pair) => total + (pair.hasTarget ? 0 : pair.calls),
        0
      ),
      targetedCalls: values.reduce(
        (total, pair) => total + (pair.hasTarget ? pair.calls : 0),
        0
      ),
      consecutiveRepeats,
      histogram: Object.fromEntries(
        values
          .reduce((entries, pair) => {
            const bucket =
              pair.calls >= 32
                ? "32+"
                : pair.calls >= 16
                  ? "16-31"
                  : pair.calls >= 8
                    ? "8-15"
                    : pair.calls >= 4
                      ? "4-7"
                      : pair.calls >= 2
                        ? "2-3"
                        : "1";
            entries.set(bucket, (entries.get(bucket) ?? 0) + 1);
            return entries;
          }, new Map())
          .entries()
      )
    };
  }

  function finishCommanderRoleScope() {
    if (commanderRoleDepth > 0) {
      commanderRoleDepth -= 1;
    }
    const before = commanderRoleInputStack.pop();
    if (before !== undefined) {
      commanderRoleInputChanges.push(
        compareHostilityInputs(before, captureHostilityInputs())
      );
    }
  }

  function captureHostilityInputs() {
    const partyIds = new Set(
      Array.isArray(KDGameData?.Party)
        ? KDGameData.Party.map((member) => String(member?.id))
        : []
    );
    const entities = [
      KinkyDungeonPlayerEntity,
      ...(Array.isArray(KDMapData?.Entities) ? KDMapData.Entities : [])
    ];
    const entityInputs = entities.map((entity, index) => {
      const collection = KDGameData?.Collection?.[String(entity?.id)];
      return {
        index,
        id: entity?.id,
        player: entity?.player,
        rage: entity?.rage,
        hostile: entity?.hostile,
        ceasefire: entity?.ceasefire,
        faction: entity?.faction,
        allied: entity?.allied,
        opinion: entity?.opinion,
        enemyAllied: entity?.Enemy?.allied,
        enemyFaction: entity?.Enemy?.faction,
        inParty: partyIds.has(String(entity?.id)),
        collectionStatus: collection?.status,
        collectionFaction: collection?.Faction,
        collectionOpinion: collection?.Opinion
      };
    });
    const factionRelations =
      typeof KDFactionRelations === "object" &&
      KDFactionRelations instanceof Map
        ? [...KDFactionRelations.entries()].map(([faction, relations]) => [
            faction,
            relations instanceof Map ? [...relations.entries()] : relations
          ])
        : null;
    return {
      entityInputs,
      factionRelations: JSON.stringify(factionRelations)
    };
  }

  function compareHostilityInputs(before, after) {
    const changedEntities = [];
    const count = Math.max(
      before.entityInputs.length,
      after.entityInputs.length
    );
    for (let index = 0; index < count; index += 1) {
      const left = before.entityInputs[index];
      const right = after.entityInputs[index];
      if (JSON.stringify(left) !== JSON.stringify(right)) {
        changedEntities.push({
          index,
          idBefore: left?.id,
          idAfter: right?.id,
          before: left,
          after: right
        });
      }
    }
    return {
      entityCountBefore: before.entityInputs.length,
      entityCountAfter: after.entityInputs.length,
      changedEntities,
      factionRelationsChanged:
        before.factionRelations !== after.factionRelations
    };
  }

  function recordPositionCall(record, x, y, mapData) {
    if (Number.isSafeInteger(x) && Number.isSafeInteger(y)) {
      record.integerCoordinates += 1;
    } else {
      record.nonIntegerCoordinates += 1;
    }
    if (!mapData) {
      record.defaultMap += 1;
    } else if (mapData === KDMapData) {
      record.explicitMainMap += 1;
    } else {
      record.otherMap += 1;
    }
  }

  function restraintEligibleSignature(args) {
    const enemy = args[0];
    const securityEnemy = args[11];
    return JSON.stringify({
      enemyTags: normalizeValue(enemy?.tags),
      level: args[1],
      index: args[2],
      bypass: args[3],
      lock: args[4],
      requireWill: args[5],
      leashingOnly: args[6],
      noStack: args[7],
      extraTags: normalizeValue(args[8]),
      agnostic: args[9],
      filter: normalizeValue(args[10]),
      securityEnemy:
        securityEnemy === undefined || securityEnemy === null
          ? null
          : {
              id: securityEnemy.id,
              name: securityEnemy.Enemy?.name,
              x: securityEnemy.x,
              y: securityEnemy.y
            },
      curse: normalizeValue(args[12]),
      filterEps: args[13],
      minWeightFallback: args[14],
      useAugmented: args[15],
      augmentedInventoryIdentity:
        args[16] === undefined ? null : valueId(args[16]),
      options: normalizeValue(args[17])
    });
  }

  function normalizeValue(value, depth = 0, seen = new WeakSet()) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === undefined
    ) {
      return value;
    }
    if (typeof value === "function") {
      return valueId(value);
    }
    if (depth >= 4) {
      return valueId(value);
    }
    if (seen.has(value)) {
      return valueId(value);
    }
    seen.add(value);
    if (Array.isArray(value)) {
      return value
        .slice(0, 64)
        .map((entry) => normalizeValue(entry, depth + 1, seen));
    }
    if (value instanceof Map) {
      return [...value.entries()]
        .slice(0, 64)
        .map(([key, entry]) => [
          String(key),
          normalizeValue(entry, depth + 1, seen)
        ])
        .sort(([left], [right]) => left.localeCompare(right));
    }
    if (value instanceof Set) {
      return [...value]
        .slice(0, 64)
        .map((entry) => normalizeValue(entry, depth + 1, seen))
        .sort();
    }
    const normalized = {};
    for (const key of Object.keys(value).sort().slice(0, 64)) {
      normalized[key] = normalizeValue(value[key], depth + 1, seen);
    }
    return normalized;
  }

  function valueId(value) {
    if (
      (typeof value !== "object" || value === null) &&
      typeof value !== "function"
    ) {
      return `${typeof value}:${String(value)}`;
    }
    let id = objectIds.get(value);
    if (id === undefined) {
      id = nextObjectId;
      nextObjectId += 1;
      objectIds.set(value, id);
    }
    return `object:${id}`;
  }
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

class CdpClient {
  #socket;
  #nextId = 1;
  #pending = new Map();

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out connecting to the KD renderer")),
        15_000
      );
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("Failed to connect to the KD renderer"));
        },
        { once: true }
      );
    });
    return new CdpClient(socket);
  }

  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener("message", async (event) => {
      const text =
        typeof event.data === "string" ? event.data : await event.data.text();
      const message = JSON.parse(text);
      if (message.id === undefined) {
        return;
      }
      const pending = this.#pending.get(message.id);
      if (pending === undefined) {
        return;
      }
      this.#pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error !== undefined) {
        pending.reject(
          new Error(`CDP ${pending.method} failed: ${JSON.stringify(message.error)}`)
        );
      } else {
        pending.resolve(message.result);
      }
    });
  }

  call(method, params, timeoutMs = 30_000) {
    const id = this.#nextId;
    this.#nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, timeoutMs);
      this.#pending.set(id, { method, resolve, reject, timer });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, timeoutMs) {
    const response = await this.call(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
        timeout: timeoutMs
      },
      timeoutMs + 5_000
    );
    if (response.exceptionDetails !== undefined) {
      const details = response.exceptionDetails;
      const description =
        details.exception?.description ?? details.text ?? "unknown renderer error";
      throw new Error(description);
    }
    return response.result?.value;
  }

  close() {
    this.#socket.close();
  }
}

async function setupCrowdedTurn(requestedEnemies, fixedSeed) {
  "use strict";

  const waitFor = async (predicate, timeoutMs, label) => {
    const deadline = performance.now() + timeoutMs;
    while (!predicate()) {
      if (performance.now() >= deadline) {
        throw new Error(`Timed out waiting for ${label}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  await waitFor(
    () => {
      try {
        return (
          globalThis.KDHybrid !== undefined &&
          KDHybrid.status().initialized &&
          KDHybrid.status().systems.some(
            (status) =>
              status.globalName === "KinkyDungeonUpdateEnemies"
          ) &&
          typeof globalThis.KinkyDungeonAdvanceTime === "function" &&
          KinkyDungeonPlayer !== null &&
          Array.isArray(KinkyDungeonPlayer.Appearance)
        );
      } catch {
        return false;
      }
    },
    20_000,
    "KD Hybrid, the KD turn loop, and the player character"
  );

  KDSetWorldSlot(0, 1, 0, 0);
  MiniGameKinkyDungeonCheckpoint = "grv";
  KinkyDungeonInitialize(1);
  KDInitPerks();
  MiniGameKinkyDungeonCheckpoint = "grv";
  KDsetSeed(fixedSeed);
  KinkyDungeonCreateMap(
    KinkyDungeonMapParams[
      KinkyDungeonMapIndex[MiniGameKinkyDungeonCheckpoint] ||
        MiniGameKinkyDungeonCheckpoint
    ],
    "",
    "",
    1,
    true,
    fixedSeed,
    undefined,
    undefined,
    false
  );
  KinkyDungeonState = "Game";
  const modelDeadline = performance.now() + 10_000;
  while (!KDCurrentModels.get(KinkyDungeonPlayer)?.Poses) {
    if (performance.now() >= modelDeadline) {
      throw new Error(
        "Timed out waiting for the crowded-turn fixture player model"
      );
    }
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  for (const existing of [...KDMapData.Entities]) {
    KDRemoveEntity(existing);
  }

  const player = {
    x: KinkyDungeonPlayerEntity.x,
    y: KinkyDungeonPlayerEntity.y
  };
  const points = [];
  for (let y = 1; y < KDMapData.GridHeight - 1; y += 1) {
    for (let x = 1; x < KDMapData.GridWidth - 1; x += 1) {
      if (
        Math.max(Math.abs(x - player.x), Math.abs(y - player.y)) > 2 &&
        KinkyDungeonMovableTilesEnemy.includes(KinkyDungeonMapGet(x, y)) &&
        !KinkyDungeonEntityAt(x, y)
      ) {
        points.push({ x, y });
      }
    }
  }
  points.sort((left, right) => {
    const leftHash = ((left.x * 73_856_093) ^ (left.y * 19_349_663)) >>> 0;
    const rightHash = ((right.x * 73_856_093) ^ (right.y * 19_349_663)) >>> 0;
    return leftHash - rightHash || left.y - right.y || left.x - right.x;
  });
  if (points.length < requestedEnemies) {
    throw new Error(
      `Generated map has ${points.length} enemy tiles; ${requestedEnemies} required`
    );
  }

  let profileIndex = 0;
  for (const point of points.slice(0, requestedEnemies)) {
    const enemy = DialogueCreateEnemy(point.x, point.y, "Maidforce");
    if (!enemy) {
      throw new Error(`Failed to create stress enemy at ${point.x},${point.y}`);
    }
    enemy.kdHybridTurnProfile = true;
    enemy.kdHybridTurnProfileIndex = profileIndex;
    profileIndex += 1;
    enemy.aware = true;
    enemy.hostile = 9_999;
    KDRunCreationScript(enemy, KDGetCurrentLocation());
  }
  KDHybrid.enableSystem("pathfinding");
  KDHybrid.enableSystem("ai");
  KDHybrid.enableSystem("movement");
  KDHybrid.setPathfindingMode("fast");
  KinkyDungeonAdvanceTime(1, false, true);

  return {
    gameVersion: globalThis.KDGameVersion ?? "5.4.92",
    packageVersion: globalThis.KDVersionStr ?? null,
    runtimeVersion: KDHybrid.status().runtimeVersion,
    pathfindingMode: KDHybrid.getPathfindingMode(),
    sourceNearestPatchVersion:
      globalThis.KDHybridSourcePatches?.nearestPlayer ?? null,
    ai: { ...KDHybrid.systemStatus("ai") },
    commander: {
      ...KDHybrid.status().systems.find(
        (status) => status.globalName === "KDCommanderUpdateRoles"
      )
    },
    master: {
      ...KDHybrid.status().systems.find(
        (status) => status.globalName === "KinkyDungeonFindMaster"
      )
    },
    nearest: {
      ...(KDHybrid.status().systems.find(
        (status) => status.globalName === "KinkyDungeonNearestPlayer"
      ) ||
        (typeof globalThis.KDHybridSourcePatches?.nearestPlayer === "string"
          ? {
              system: "ai",
              globalName: "KinkyDungeonNearestPlayer",
              mode: "source",
              sourcePatchVersion:
                globalThis.KDHybridSourcePatches.nearestPlayer
            }
          : {}))
    },
    movement: {
      ...KDHybrid.status().systems.find(
        (status) => status.globalName === "KinkyDungeonUpdateEnemies"
      )
    },
    jailKey: {
      ...KDHybrid.status().systems.find(
        (status) => status.globalName === "KinkyDungeonPlaceJailKeys"
      )
    },
    jailKeySignatures: Object.fromEntries(
      [
        "KinkyDungeonPlaceJailKeys",
        "KinkyDungeonMapGet",
        "KinkyDungeonTilesGet",
        "KDistChebyshev"
      ].map((name) => [name, functionSignature(globalThis[name])])
    ),
    findMasterSignatures: Object.fromEntries(
      [
        "KinkyDungeonFindMaster",
        "KDGetEnemyCache",
        "KDHostile",
        "KDGetFaction",
        "KDEnemyRank",
        "KDEntityHasFlag",
        "KDEnemyHasFlag",
        "KDCollHasFlag",
        "KDFactionHostile",
        "KDFactionRelation",
        "KDIsInParty",
        "KDIsServant",
        "KDistChebyshev"
      ].map((name) => [name, functionSignature(globalThis[name])])
    ),
    nearestPlayerSignatures: Object.fromEntries(
      [
        "KinkyDungeonNearestPlayer",
        "KDEnemyVisionRadius",
        "KinkyDungeonCheckLOS",
        "KinkyDungeonCheckPath",
        "KinkyDungeonCheckPathCount",
        "KDHostile",
        "KDGetFaction",
        "KDEnemyHasFlag",
        "KDNearbyEnemies",
        "KDHelpless",
        "KDIsImprisoned",
        "KDistChebyshev",
        "KinkyDungeonVisionGet",
        "KDAllied",
        "KDIsInParty",
        "KinkyDungeonJailGuard",
        "KinkyDungeonSetFlag",
        "KDUnPackEnemy",
        "KDPackEnemy",
        "KinkyDungeonGetEnemyByName",
        "KinkyDungeonRefreshEnemiesCache",
        "KDNPCStruggleThreshMult",
        "KDEnemyRank",
        "KDBoundEffects",
        "KDGetBindEffectMult",
        "KDEntityHasFlag",
        "KDCollHasFlag",
        "KDFactionHostile",
        "KDFactionRelation",
        "KDIsServant",
        "KDOpinionRepMod",
        "KDGetModifiedOpinionID",
        "KDIsNPCPersistent",
        "KDGetPersistentNPC",
        "KinkyDungeonFindID",
        "KDGetModifiedOpinion",
        "KDPlayer",
        "KDGetPersonalityType",
        "KDLookupID"
      ].map((name) => [name, functionSignature(globalThis[name])])
    ),
    enemyUpdateSignatures: Object.fromEntries(
      [
        "KinkyDungeonUpdateEnemies",
        "KDMoveEntity",
        "KDGetEnemyCache",
        "KDGetEffectTiles",
        "KinkyDungeonEntityAt",
        "KinkyDungeonSendEvent",
        "KDCheckCollideableBullets"
      ].map((name) => [name, functionSignature(globalThis[name])])
    ),
    map: {
      width: KDMapData.GridWidth,
      height: KDMapData.GridHeight
    },
    actualEnemies: KDMapData.Entities.filter(
      (enemy) => enemy.kdHybridTurnProfile
    ).length,
    mapSignature: hashText(
      `${KDMapData.Grid}\n${KDMapData.Entities
        .filter((enemy) => enemy.kdHybridTurnProfile)
        .map((enemy) => `${enemy.x},${enemy.y}`)
        .join(";")}`
    )
  };

  function hashText(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function functionSignature(fn) {
    if (typeof fn !== "function") return null;
    const source = Function.prototype.toString
      .call(fn)
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .replace(/(^|[^:\\])\/\/.*$/gmu, "$1")
      .replace(/\s+/gu, "")
      .trim();
    let hash = 0xcbf29ce484222325n;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= BigInt(source.charCodeAt(index));
      hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return {
      name: fn.name,
      arity: fn.length,
      normalizedHash: hash.toString(16).padStart(16, "0")
    };
  }
}

function setupCombatTurn(requestedEnemies) {
  "use strict";

  if (requestedEnemies < 2) {
    throw new Error("The combat fixture requires at least two enemies");
  }
  for (const existing of [...KDMapData.Entities]) {
    KDRemoveEntity(existing);
  }

  const player = {
    x: KinkyDungeonPlayerEntity.x,
    y: KinkyDungeonPlayerEntity.y
  };
  const pointsByKey = new Map();
  for (let y = 1; y < KDMapData.GridHeight - 1; y += 1) {
    for (let x = 1; x < KDMapData.GridWidth - 1; x += 1) {
      if (
        Math.max(Math.abs(x - player.x), Math.abs(y - player.y)) >= 10 &&
        KinkyDungeonMovableTilesEnemy.includes(KinkyDungeonMapGet(x, y))
      ) {
        pointsByKey.set(`${x},${y}`, { x, y });
      }
    }
  }

  const directions = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 }
  ];
  const visited = new Set();
  let component = [];
  for (const point of pointsByKey.values()) {
    const pointKey = `${point.x},${point.y}`;
    if (visited.has(pointKey)) continue;
    const candidate = [];
    const queue = [point];
    visited.add(pointKey);
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head];
      candidate.push(current);
      for (const direction of directions) {
        const key = `${current.x + direction.x},${current.y + direction.y}`;
        const neighbor = pointsByKey.get(key);
        if (neighbor && !visited.has(key)) {
          visited.add(key);
          queue.push(neighbor);
        }
      }
    }
    if (candidate.length > component.length) component = candidate;
  }
  if (component.length < requestedEnemies) {
    throw new Error(
      `Generated map has only ${component.length} connected combat tiles; ${requestedEnemies} required`
    );
  }

  const componentKeys = new Set(
    component.map((point) => `${point.x},${point.y}`)
  );
  component.sort(
    (left, right) =>
      Math.max(
        Math.abs(right.x - player.x),
        Math.abs(right.y - player.y)
      ) -
        Math.max(
          Math.abs(left.x - player.x),
          Math.abs(left.y - player.y)
        ) ||
      left.y - right.y ||
      left.x - right.x
  );
  const selected = [];
  const selectedKeys = new Set();
  const queue = [component[0]];
  selectedKeys.add(`${component[0].x},${component[0].y}`);
  for (
    let head = 0;
    head < queue.length && selected.length < requestedEnemies;
    head += 1
  ) {
    const current = queue[head];
    selected.push(current);
    for (const direction of directions) {
      const key = `${current.x + direction.x},${current.y + direction.y}`;
      if (componentKeys.has(key) && !selectedKeys.has(key)) {
        selectedKeys.add(key);
        queue.push(pointsByKey.get(key));
      }
    }
  }
  if (selected.length < requestedEnemies) {
    throw new Error(
      `Could only select ${selected.length} clustered combat tiles; ${requestedEnemies} required`
    );
  }

  let profileIndex = 0;
  for (const point of selected) {
    const enemy = DialogueCreateEnemy(point.x, point.y, "Maidforce");
    if (!enemy) {
      throw new Error(
        `Failed to create combat enemy at ${point.x},${point.y}`
      );
    }
    KDRunCreationScript(enemy, KDGetCurrentLocation());
    enemy.kdHybridTurnProfile = true;
    enemy.kdHybridTurnProfileIndex = profileIndex;
    profileIndex += 1;
    enemy.faction = (point.x + point.y) % 2 === 0 ? "Enemy" : "Rage";
    enemy.rage = 0;
    enemy.hostile = 0;
    enemy.ceasefire = 0;
    enemy.allied = 0;
    enemy.aware = true;
    enemy.vp = 1;
    enemy.aggro = 1;
    enemy.hp = Math.max(10_000, Number(enemy.Enemy?.maxhp ?? 1) * 1_000);
    enemy.attackPoints = 0;
    enemy.movePoints = 0;
    enemy.warningTiles = [];
    enemy.gx = enemy.x;
    enemy.gy = enemy.y;
  }

  KinkyDungeonRefreshEnemiesCache();
  KDHybrid.enableSystem("pathfinding");
  KDHybrid.enableSystem("ai");
  KDHybrid.enableSystem("movement");
  KDHybrid.enableSystem("events");
  KDHybrid.setPathfindingMode("fast");

  const enemies = KDMapData.Entities.filter(
    (enemy) => enemy.kdHybridTurnProfile
  );
  const hostileNeighborCounts = enemies.map(
    (enemy) =>
      enemies.filter(
        (candidate) =>
          candidate !== enemy &&
          Math.max(
            Math.abs(candidate.x - enemy.x),
            Math.abs(candidate.y - enemy.y)
          ) <= 1 &&
          KDHostile(enemy, candidate)
      ).length
  );
  const factionCounts = Object.fromEntries(
    [...new Set(enemies.map((enemy) => KDGetFaction(enemy)))].map(
      (faction) => [
        faction,
        enemies.filter((enemy) => KDGetFaction(enemy) === faction).length
      ]
    )
  );
  const mapText = `${KDMapData.Grid}\n${enemies
    .map(
      (enemy) =>
        `${enemy.kdHybridTurnProfileIndex}:${enemy.x},${enemy.y}:${KDGetFaction(enemy)}`
    )
    .join(";")}`;
  return {
    kind: "combat",
    map: {
      width: KDMapData.GridWidth,
      height: KDMapData.GridHeight,
      roomType: KDMapData.RoomType,
      mapFaction: KDMapData.MapFaction
    },
    mapSignature: hashText(mapText),
    actualEnemies: enemies.length,
    factions: factionCounts,
    enemiesWithHostileNeighbor: hostileNeighborCounts.filter(
      (count) => count > 0
    ).length,
    minimumHostileNeighbors: Math.min(...hostileNeighborCounts),
    minimumPlayerDistance: Math.min(
      ...enemies.map((enemy) =>
        Math.max(
          Math.abs(enemy.x - player.x),
          Math.abs(enemy.y - player.y)
        )
      )
    )
  };

  function hashText(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
}

function setupPrisonTurn(requestedEnemies) {
  "use strict";

  const captor = KDMapData.Entities.find(
    (enemy) => enemy.kdHybridTurnProfile
  );
  if (!captor) {
    throw new Error("The prison fixture has no Maidforce captor");
  }
  KinkyDungeonDefeat(true, captor);
  KinkyDungeonState = "Game";

  const guard = KinkyDungeonJailGuard();
  if (!guard) {
    throw new Error("KinkyDungeonDefeat did not install a jail guard");
  }
  for (const enemy of [...KDMapData.Entities]) {
    if (enemy !== guard) {
      KDRemoveEntity(enemy);
    }
  }

  guard.kdHybridTurnProfile = true;
  guard.kdHybridTurnProfileIndex = 0;
  guard.aware = true;
  guard.gx = guard.x;
  guard.gy = guard.y;
  const basicLeash = KinkyDungeonGetRestraintByName("BasicLeash");
  if (basicLeash) {
    KinkyDungeonAddRestraintIfWeaker(basicLeash, 0, true);
  }
  KinkyDungeonPlayerTags = KinkyDungeonUpdateRestraints();
  KinkyDungeonAttachTetherToEntity(2.5, guard, KDPlayer());
  KDGameData.KinkyDungeonLeashingEnemy = guard.id;
  KDGameData.KinkyDungeonLeashedPlayer = Math.max(
    30,
    Number(KDGameData.KinkyDungeonLeashedPlayer ?? 0)
  );

  const player = {
    x: KinkyDungeonPlayerEntity.x,
    y: KinkyDungeonPlayerEntity.y
  };
  const points = [];
  for (let y = 1; y < KDMapData.GridHeight - 1; y += 1) {
    for (let x = 1; x < KDMapData.GridWidth - 1; x += 1) {
      if (
        Math.max(Math.abs(x - player.x), Math.abs(y - player.y)) > 2 &&
        KinkyDungeonMovableTilesEnemy.includes(KinkyDungeonMapGet(x, y)) &&
        !KinkyDungeonEntityAt(x, y)
      ) {
        points.push({ x, y });
      }
    }
  }
  points.sort((left, right) => {
    const leftHash = ((left.x * 83_492_791) ^ (left.y * 29_786_033)) >>> 0;
    const rightHash = ((right.x * 83_492_791) ^ (right.y * 29_786_033)) >>> 0;
    return leftHash - rightHash || left.y - right.y || left.x - right.x;
  });
  if (points.length < requestedEnemies - 1) {
    throw new Error(
      `Prison map has ${points.length + 1} enemy slots; ${requestedEnemies} required`
    );
  }

  let profileIndex = 1;
  for (const point of points.slice(0, requestedEnemies - 1)) {
    const enemy = DialogueCreateEnemy(point.x, point.y, "Maidforce");
    if (!enemy) {
      throw new Error(
        `Failed to create prison stress enemy at ${point.x},${point.y}`
      );
    }
    enemy.kdHybridTurnProfile = true;
    enemy.kdHybridTurnProfileIndex = profileIndex;
    profileIndex += 1;
    enemy.aware = true;
    enemy.hostile = 0;
    enemy.gx = enemy.x;
    enemy.gy = enemy.y;
    KDRunCreationScript(enemy, KDGetCurrentLocation());
  }

  KDHybrid.enableSystem("pathfinding");
  KDHybrid.enableSystem("ai");
  KDHybrid.enableSystem("movement");
  KDHybrid.enableSystem("events");
  KDHybrid.setPathfindingMode("fast");

  const leash = KDPlayer().leash;
  const mapText = `${KDMapData.Grid}\n${KDMapData.Entities
    .filter((enemy) => enemy.kdHybridTurnProfile)
    .map((enemy) => `${enemy.x},${enemy.y}`)
    .join(";")}`;
  return {
    kind: "prison",
    map: {
      width: KDMapData.GridWidth,
      height: KDMapData.GridHeight,
      roomType: KDMapData.RoomType,
      mapFaction: KDMapData.MapFaction
    },
    mapSignature: hashText(mapText),
    actualEnemies: KDMapData.Entities.filter(
      (enemy) => enemy.kdHybridTurnProfile
    ).length,
    prisonerState: KDGameData.PrisonerState,
    jailGuard: {
      id: guard.id,
      name: guard.Enemy?.name,
      x: guard.x,
      y: guard.y,
      intentAction: guard.IntentAction,
      action: guard.action
    },
    leashingEnemyId:
      KDGameData.KinkyDungeonLeashingEnemy || leash?.entity || null,
    player: {
      x: KinkyDungeonPlayerEntity.x,
      y: KinkyDungeonPlayerEntity.y,
      leashEntity: leash?.entity ?? null,
      tethered: leash !== undefined,
      leashable: Boolean(KinkyDungeonPlayerTags.get("Leashable"))
    }
  };

  function hashText(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
}

function runCrowdedTurns(turns, includeState) {
  "use strict";

  includeState = includeState === true;
  const perTurnMilliseconds = [];
  for (let index = 0; index < turns; index += 1) {
    const started = performance.now();
    KinkyDungeonAdvanceTime(1, false, true);
    perTurnMilliseconds.push(performance.now() - started);
  }
  const totalMilliseconds = perTurnMilliseconds.reduce(
    (total, duration) => total + duration,
    0
  );
  const state = {
    player: {
      x: KinkyDungeonPlayerEntity.x,
      y: KinkyDungeonPlayerEntity.y,
      will: KinkyDungeonStatWill,
      stamina: KinkyDungeonStatStamina,
      mana: KinkyDungeonStatMana,
      distraction: KinkyDungeonStatDistraction,
      distractionLower: KinkyDungeonStatDistractionLower,
      blind: KinkyDungeonStatBlind,
      blindLevel: KinkyDungeonBlindLevel,
      state: KinkyDungeonState
    },
    seed: KinkyDungeonSeed,
    currentTick: KinkyDungeonCurrentTick,
    prisonerState: KDGameData.PrisonerState,
    flags: [...KinkyDungeonFlags.entries()].sort(([left], [right]) =>
      String(left).localeCompare(String(right))
    ),
    enemies: KDMapData.Entities
      .filter((enemy) => enemy.kdHybridTurnProfile)
      .sort(
        (left, right) =>
          left.kdHybridTurnProfileIndex - right.kdHybridTurnProfileIndex
      )
      .map((enemy) => ({
        i: enemy.kdHybridTurnProfileIndex,
        id: enemy.id,
        x: enemy.x,
        y: enemy.y,
        gx: enemy.gx,
        gy: enemy.gy,
        tx: enemy.tx,
        ty: enemy.ty,
        target: enemy.target,
        hp: enemy.hp,
        faction: enemy.faction,
        rage: enemy.rage,
        ceasefire: enemy.ceasefire,
        allied: enemy.allied,
        aware: enemy.aware,
        hostile: enemy.hostile,
        action: enemy.action,
        attackPoints: enemy.attackPoints,
        movePoints: enemy.movePoints,
        specialCD: enemy.specialCD,
        boundLevel: enemy.boundLevel,
        distraction: enemy.distraction,
        stun: enemy.stun,
        freeze: enemy.freeze,
        slow: enemy.slow,
        bind: enemy.bind,
        silence: enemy.silence,
        warningTiles: enemy.warningTiles?.map((tile) => ({
          x: tile.x,
          y: tile.y
        })),
        flags: Object.entries(enemy.flags ?? {}).sort(
          ([left], [right]) => left.localeCompare(right)
        ),
        buffs: enemy.buffs
      })),
    groundItems: KDMapData.GroundItems.map((item) => ({
      name: item.name,
      x: item.x,
      y: item.y
    }))
  };
  return {
    perTurnMilliseconds,
    totalMilliseconds,
    averageMilliseconds: totalMilliseconds / turns,
    remainingProfileEnemies: KDMapData.Entities.filter(
      (enemy) => enemy.kdHybridTurnProfile
    ).length,
    stateSignature: hashText(JSON.stringify(state)),
    state: includeState ? state : undefined,
    pathfinding: { ...KDHybrid.systemStatus("pathfinding") },
    ai: { ...KDHybrid.systemStatus("ai") },
    commander: {
      ...KDHybrid.status().systems.find(
        (status) => status.globalName === "KDCommanderUpdateRoles"
      )
    },
    master: {
      ...KDHybrid.status().systems.find(
        (status) => status.globalName === "KinkyDungeonFindMaster"
      )
    },
    nearest: {
      ...(KDHybrid.status().systems.find(
        (status) => status.globalName === "KinkyDungeonNearestPlayer"
      ) ||
        (typeof globalThis.KDHybridSourcePatches?.nearestPlayer === "string"
          ? {
              system: "ai",
              globalName: "KinkyDungeonNearestPlayer",
              mode: "source",
              sourcePatchVersion:
                globalThis.KDHybridSourcePatches.nearestPlayer
            }
          : {}))
    },
    movement: {
      ...KDHybrid.status().systems.find(
        (status) => status.globalName === "KinkyDungeonUpdateEnemies"
      )
    },
    jailKey: {
      ...KDHybrid.status().systems.find(
        (status) => status.globalName === "KinkyDungeonPlaceJailKeys"
      )
    }
  };

  function hashText(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
}

function measureNearbyCalls() {
  "use strict";

  const original = KDNearbyEnemies;
  let denseCache = null;
  let denseWidth = 0;
  let denseHeight = 0;
  let denseEntities = [];
  let denseRebuilds = 0;
  const candidate = (
    x,
    y,
    dist,
    hostileEnemy,
    cheb,
    nonhostileEnemy
  ) => {
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      !Number.isFinite(dist) ||
      dist < 0 ||
      3 * dist * dist > KDMapData.Entities.length
    ) {
      return null;
    }
    const cache = KDGetEnemyCache();
    const width = KDMapData.GridWidth;
    const height = KDMapData.GridHeight;
    if (
      cache !== denseCache ||
      width !== denseWidth ||
      height !== denseHeight
    ) {
      denseCache = cache;
      denseWidth = width;
      denseHeight = height;
      denseEntities = new Array(width * height);
      denseRebuilds += 1;
      for (const enemy of KDMapData.Entities) {
        if (
          Number.isInteger(enemy.x) &&
          Number.isInteger(enemy.y) &&
          enemy.x >= 0 &&
          enemy.y >= 0 &&
          enemy.x < width &&
          enemy.y < height
        ) {
          denseEntities[enemy.x + enemy.y * width] = enemy;
        }
      }
    }
    const result = [];
    const integerChebyshevRadius = cheb && Number.isInteger(dist);
    const radiusSquared = dist * dist;
    const minimumX = Math.max(0, Math.floor(x - dist));
    const maximumX = Math.min(width, Math.ceil(x + dist));
    const minimumY = Math.max(0, Math.floor(y - dist));
    const maximumY = Math.min(height, Math.ceil(y + dist));
    for (let entityX = minimumX; entityX < maximumX; entityX += 1) {
      for (let entityY = minimumY; entityY < maximumY; entityY += 1) {
        if (
          (cheb
            ? !integerChebyshevRadius &&
              Math.max(Math.abs(entityX - x), Math.abs(entityY - y)) > dist
            : (entityX - x) * (entityX - x) +
                (entityY - y) * (entityY - y) >
              radiusSquared)
        ) {
          continue;
        }
        const enemy = denseEntities[entityX + entityY * width];
        if (
          enemy &&
          (!hostileEnemy || KDHostile(enemy, hostileEnemy)) &&
          (!nonhostileEnemy ||
            !KDHostile(enemy, cheb ? nonhostileEnemy : hostileEnemy))
        ) {
          result.push(enemy);
        }
      }
    }
    return result;
  };
  const shapes = new Map();
  let calls = 0;
  let measuredMilliseconds = 0;
  let returnedEntities = 0;
  let optimizedCalls = 0;
  let originalOptimizedMilliseconds = 0;
  let candidateMilliseconds = 0;
  let parityMismatches = 0;
  const mismatchExamples = [];
  KDNearbyEnemies = function measuredNearbyEnemies(
    x,
    y,
    dist,
    hostileEnemy,
    cheb,
    nonhostileEnemy
  ) {
    const eligible =
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      Number.isFinite(dist) &&
      dist >= 0 &&
      3 * dist * dist <= KDMapData.Entities.length;
    let candidateResult = null;
    let candidateElapsed = 0;
    let result;
    let elapsed;
    if (eligible && calls % 2 === 0) {
      const candidateStarted = performance.now();
      candidateResult = candidate(
        x,
        y,
        dist,
        hostileEnemy,
        cheb,
        nonhostileEnemy
      );
      candidateElapsed = performance.now() - candidateStarted;
    }
    const started = performance.now();
    result = original(x, y, dist, hostileEnemy, cheb, nonhostileEnemy);
    elapsed = performance.now() - started;
    if (eligible && calls % 2 !== 0) {
      const candidateStarted = performance.now();
      candidateResult = candidate(
        x,
        y,
        dist,
        hostileEnemy,
        cheb,
        nonhostileEnemy
      );
      candidateElapsed = performance.now() - candidateStarted;
    }
    if (eligible) {
      optimizedCalls += 1;
      originalOptimizedMilliseconds += elapsed;
      candidateMilliseconds += candidateElapsed;
      const same =
        candidateResult?.length === result.length &&
        result.every((enemy, index) => candidateResult[index] === enemy);
      if (!same) {
        parityMismatches += 1;
        if (mismatchExamples.length < 5) {
          mismatchExamples.push({
            x,
            y,
            dist,
            hostile: Boolean(hostileEnemy),
            nonhostile: Boolean(nonhostileEnemy),
            expected: result.map((enemy) => enemy.id),
            actual: candidateResult?.map((enemy) => enemy.id) ?? null
          });
        }
      }
    }
    const key = JSON.stringify({
      dist,
      hostile: Boolean(hostileEnemy),
      cheb: Boolean(cheb),
      nonhostile: Boolean(nonhostileEnemy)
    });
    const shape = shapes.get(key) ?? {
      dist,
      hostile: Boolean(hostileEnemy),
      cheb: Boolean(cheb),
      nonhostile: Boolean(nonhostileEnemy),
      calls: 0,
      milliseconds: 0,
      returnedEntities: 0
    };
    shape.calls += 1;
    shape.milliseconds += elapsed;
    shape.returnedEntities += result.length;
    shapes.set(key, shape);
    calls += 1;
    measuredMilliseconds += elapsed;
    returnedEntities += result.length;
    return result;
  };
  let fullTurnMilliseconds;
  try {
    const started = performance.now();
    KinkyDungeonAdvanceTime(1, false, true);
    fullTurnMilliseconds = performance.now() - started;
  } finally {
    KDNearbyEnemies = original;
  }
  return {
    calls,
    measuredMilliseconds,
    returnedEntities,
    optimizedCalls,
    originalOptimizedMilliseconds,
    candidateMilliseconds,
    denseRebuilds,
    speedup:
      candidateMilliseconds > 0
        ? originalOptimizedMilliseconds / candidateMilliseconds
        : null,
    parityMismatches,
    mismatchExamples,
    fullTurnMilliseconds,
    shapes: [...shapes.values()]
      .sort((left, right) => right.milliseconds - left.milliseconds)
      .map((shape) => ({
        ...shape,
        milliseconds: Math.round(shape.milliseconds * 1_000) / 1_000
      }))
  };
}

function summarizeProfile(profile) {
  const nodesById = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map();
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) {
      parents.set(child, node.id);
    }
  }

  const selfById = new Map();
  const totalById = new Map();
  for (let index = 0; index < (profile.samples?.length ?? 0); index += 1) {
    const id = profile.samples[index];
    const duration = profile.timeDeltas?.[index] ?? 0;
    selfById.set(id, (selfById.get(id) ?? 0) + duration);
    let current = id;
    while (current !== undefined) {
      totalById.set(current, (totalById.get(current) ?? 0) + duration);
      current = parents.get(current);
    }
  }

  const merged = new Map();
  const lineTicks = new Map();
  for (const node of profile.nodes) {
    const frame = node.callFrame;
    const key = [
      frame.functionName || "(anonymous)",
      frame.url || "(native)",
      frame.lineNumber,
      frame.columnNumber
    ].join("\0");
    const current = merged.get(key) ?? {
      functionName: frame.functionName || "(anonymous)",
      url: frame.url || "(native)",
      line: frame.lineNumber + 1,
      column: frame.columnNumber + 1,
      selfMicroseconds: 0,
      totalMicroseconds: 0,
      samples: 0
    };
    current.selfMicroseconds += selfById.get(node.id) ?? 0;
    current.totalMicroseconds += totalById.get(node.id) ?? 0;
    current.samples += node.hitCount ?? 0;
    merged.set(key, current);
    for (const position of node.positionTicks ?? []) {
      const line = position.line;
      const lineKey = `${frame.url || "(native)"}\0${line}`;
      const existing = lineTicks.get(lineKey) ?? {
        url: frame.url || "(native)",
        line,
        ticks: 0,
        functions: new Set()
      };
      existing.ticks += position.ticks;
      existing.functions.add(frame.functionName || "(anonymous)");
      lineTicks.set(lineKey, existing);
    }
  }

  const totalMicroseconds = (profile.timeDeltas ?? []).reduce(
    (total, duration) => total + duration,
    0
  );
  const finish = (entry) => ({
    ...entry,
    selfMilliseconds: round(entry.selfMicroseconds / 1_000),
    totalMilliseconds: round(entry.totalMicroseconds / 1_000),
    selfPercent: round(
      totalMicroseconds === 0 ? 0 : (entry.selfMicroseconds / totalMicroseconds) * 100
    ),
    totalPercent: round(
      totalMicroseconds === 0
        ? 0
        : (entry.totalMicroseconds / totalMicroseconds) * 100
    )
  });
  const functions = [...merged.values()];
  const callers = {};
  for (const targetName of [
    "KDGetFaction",
    "KDIsInParty",
    "KDEnemyHasFlag",
    "KDMapHasEvent",
    "KDPointWanderable"
  ]) {
    const byCaller = new Map();
    for (const node of profile.nodes) {
      if (node.callFrame.functionName !== targetName) continue;
      const parent = nodesById.get(parents.get(node.id));
      const frame = parent?.callFrame;
      const key = frame
        ? [
            frame.functionName || "(anonymous)",
            frame.url || "(native)",
            frame.lineNumber,
            frame.columnNumber
          ].join("\0")
        : "(root)";
      const current = byCaller.get(key) ?? {
        functionName: frame?.functionName || "(root)",
        url: frame?.url || "(native)",
        line: (frame?.lineNumber ?? -1) + 1,
        column: (frame?.columnNumber ?? -1) + 1,
        targetMicroseconds: 0,
        targetSelfMicroseconds: 0,
        targetSamples: 0
      };
      current.targetMicroseconds += totalById.get(node.id) ?? 0;
      current.targetSelfMicroseconds += selfById.get(node.id) ?? 0;
      current.targetSamples += node.hitCount ?? 0;
      byCaller.set(key, current);
    }
    callers[targetName] = [...byCaller.values()]
      .sort(
        (left, right) =>
          right.targetMicroseconds - left.targetMicroseconds ||
          left.functionName.localeCompare(right.functionName)
      )
      .slice(0, 25)
      .map((entry) => ({
        ...entry,
        targetMilliseconds: round(entry.targetMicroseconds / 1_000),
        targetSelfMilliseconds: round(entry.targetSelfMicroseconds / 1_000)
      }));
  }
  return {
    startTime: profile.startTime,
    endTime: profile.endTime,
    sampledMicroseconds: totalMicroseconds,
    sampleCount: profile.samples?.length ?? 0,
    topSelf: functions
      .sort((left, right) => right.selfMicroseconds - left.selfMicroseconds)
      .slice(0, 40)
      .map(finish),
    topTotal: functions
      .sort((left, right) => right.totalMicroseconds - left.totalMicroseconds)
      .slice(0, 40)
      .map(finish),
    callers,
    topLines: [...lineTicks.values()]
      .map((entry) => ({
        url: entry.url,
        line: entry.line,
        ticks: entry.ticks,
        functions: [...entry.functions].sort()
      }))
      .sort((left, right) => right.ticks - left.ticks)
      .slice(0, 100)
  };
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

await main();
