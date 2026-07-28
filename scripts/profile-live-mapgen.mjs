// SPDX-License-Identifier: MPL-2.0
//
// The live workload calls Kinky Dungeon 5.4.92 map-generation APIs.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

async function main() {
  const { values } = parseArgs({
    options: {
      port: { type: "string", default: "9223" },
      maps: { type: "string", default: "18" },
      "start-index": { type: "string", default: "0" },
      interval: { type: "string", default: "100" },
      "wall-only": { type: "boolean", default: false },
      pathfinding: { type: "string", default: "native" },
      "probe-enemy-selector-hoists": { type: "boolean", default: false },
      "disable-enemy-selector-hoists": {
        type: "boolean",
        default: false,
      },
      "probe-enemy-selector-mod-fallback": {
        type: "boolean",
        default: false,
      },
      "probe-enemy-selector-anger-cache": {
        type: "boolean",
        default: false,
      },
      "probe-enemy-selector-single-tag-cache": {
        type: "boolean",
        default: false,
      },
      "probe-enemy-selector-long-tag-cache": {
        type: "boolean",
        default: false,
      },
      "restrict-probe-enemy-selector-long-tag-cache": {
        type: "boolean",
        default: false,
      },
      "probe-enemy-selector-weighted-query-cache": {
        type: "boolean",
        default: false,
      },
      "probe-enemy-selector-weighted-single-tag-cache": {
        type: "boolean",
        default: false,
      },
      "probe-enemy-selector-weighted-filter-tag-cache": {
        type: "boolean",
        default: false,
      },
      "disable-enemy-selector-weighted-query-cache": {
        type: "boolean",
        default: false,
      },
      "disable-enemy-selector-weighted-single-tag-cache": {
        type: "boolean",
        default: false,
      },
      "disable-enemy-selector-weighted-filter-tag-cache": {
        type: "boolean",
        default: false,
      },
      "trace-enemy-selector-weighted-query-cache": {
        type: "boolean",
        default: false,
      },
      "disable-enemy-selector-long-tag-cache": {
        type: "boolean",
        default: false,
      },
      "disable-enemy-selector-general-long-tag-cache": {
        type: "boolean",
        default: false,
      },
      "trace-enemy-selector-long-tag-cache": {
        type: "boolean",
        default: false,
      },
      "probe-enemy-selector-long-tag-hook-fallback": {
        type: "boolean",
        default: false,
      },
      "probe-enemy-selector-long-tag-catalog-fallback": {
        type: "boolean",
        default: false,
      },
      "disable-enemy-selector-anger-cache": {
        type: "boolean",
        default: false,
      },
      "trace-enemy-selector-anger-cache": {
        type: "boolean",
        default: false,
      },
      "probe-enemy-selector-anger-hook-fallback": {
        type: "boolean",
        default: false,
      },
      "probe-enemy-selector-anger-catalog-fallback": {
        type: "boolean",
        default: false,
      },
      "probe-restraint-tag-keys": {
        type: "boolean",
        default: false,
      },
      "probe-restraint-enemy-keys": {
        type: "boolean",
        default: false,
      },
      "probe-restraint-catalog-fast-path-ceiling": {
        type: "boolean",
        default: false,
      },
      "probe-restraint-equivalence": {
        type: "boolean",
        default: false,
      },
      "probe-restraint-recursion": {
        type: "boolean",
        default: false,
      },
      "verify-restraint-retry-reuse": {
        type: "boolean",
        default: false,
      },
      "disable-restraint-enemy-keys": {
        type: "boolean",
        default: false,
      },
      "disable-restraint-retry-reuse": {
        type: "boolean",
        default: false,
      },
      "disable-restraint-top-level-reuse": {
        type: "boolean",
        default: false,
      },
      "disable-restraint-multi-entry-reuse": {
        type: "boolean",
        default: false,
      },
      "trace-restraint-source": {
        type: "boolean",
        default: false,
      },
      "probe-restraint-mod-fallback": {
        type: "boolean",
        default: false,
      },
      "probe-accessible-frontier-single-read": {
        type: "boolean",
        default: false,
      },
      "probe-accessible-neighbor-single-read": {
        type: "boolean",
        default: false,
      },
      "probe-accessible-queue": {
        type: "boolean",
        default: false,
      },
      "probe-accessible-numeric-state": {
        type: "boolean",
        default: false,
      },
      "verify-accessible-queue": {
        type: "boolean",
        default: false,
      },
      "disable-accessible-queue-source": {
        type: "boolean",
        default: false,
      },
      "disable-accessible-numeric-state-source": {
        type: "boolean",
        default: false,
      },
      "trace-accessible-queue-source": {
        type: "boolean",
        default: false,
      },
      "probe-accessible-queue-source-mod-fallback": {
        type: "boolean",
        default: false,
      },
      "probe-place-doors-accessible-reuse": {
        type: "boolean",
        default: false,
      },
      "verify-place-doors-accessible-reuse": {
        type: "boolean",
        default: false,
      },
      "disable-place-doors-accessible-reuse-source": {
        type: "boolean",
        default: false,
      },
      "trace-place-doors-accessible-reuse-source": {
        type: "boolean",
        default: false,
      },
      "probe-map-tile-filling-coordinate-reuse": {
        type: "boolean",
        default: false,
      },
      "verify-map-tile-filling-coordinate-reuse": {
        type: "boolean",
        default: false,
      },
      "disable-map-tile-filling-coordinate-reuse-source": {
        type: "boolean",
        default: false,
      },
      "trace-map-tile-filling-coordinate-reuse-source": {
        type: "boolean",
        default: false,
      },
      "probe-map-tile-filling-coordinate-reuse-source-equivalence": {
        type: "boolean",
        default: false,
      },
      "probe-paste-tile-serialized-cache": {
        type: "boolean",
        default: false,
      },
      "verify-paste-tile-serialized-cache": {
        type: "boolean",
        default: false,
      },
      "disable-paste-tile-serialized-cache-source": {
        type: "boolean",
        default: false,
      },
      "trace-paste-tile-serialized-cache-source": {
        type: "boolean",
        default: false,
      },
      "verify-paste-tile-serialized-cache-source": {
        type: "boolean",
        default: false,
      },
      "probe-path-cache-single-slice": {
        type: "boolean",
        default: false,
      },
      "probe-path-cache-equivalence": {
        type: "boolean",
        default: false,
      },
      "probe-path-cache-skip-identical-existing": {
        type: "boolean",
        default: false,
      },
      "probe-path-cache-skip-existing-equivalence": {
        type: "boolean",
        default: false,
      },
      "probe-path-cache-edge-identity-skip": {
        type: "boolean",
        default: false,
      },
      "probe-path-cache-edge-identity-equivalence": {
        type: "boolean",
        default: false,
      },
      "probe-path-cache-call-reuse": {
        type: "boolean",
        default: false,
      },
      "disable-path-cache-known-tail-skip": {
        type: "boolean",
        default: false,
      },
      "trace-path-cache-known-tail": {
        type: "boolean",
        default: false,
      },
      "verify-path-cache-known-tail": {
        type: "boolean",
        default: false,
      },
      "probe-path-cache-known-tail-writer-fallback": {
        type: "boolean",
        default: false,
      },
      "probe-path-cache-no-write": {
        type: "boolean",
        default: false,
      },
      "probe-path-cache-hit-distribution": {
        type: "boolean",
        default: false,
      },
      "probe-path-cache-prefix-limit": {
        type: "string",
        default: "0",
      },
      "disable-path-cache-single-slice": {
        type: "boolean",
        default: false,
      },
      "trace-path-cache-source": {
        type: "boolean",
        default: false,
      },
      "probe-path-cache-mod-fallback": {
        type: "boolean",
        default: false,
      },
      "disable-path-cache-hoisted-key-suffix": {
        type: "boolean",
        default: false,
      },
      "trace-path-cache-hoisted-key-suffix": {
        type: "boolean",
        default: false,
      },
      "disable-map-generation-path-cache-edge-identity-skip": {
        type: "boolean",
        default: false,
      },
      "trace-map-generation-path-cache-edge-identity-skip": {
        type: "boolean",
        default: false,
      },
      "probe-map-generation-path-cache-mod-fallback": {
        type: "boolean",
        default: false,
      },
      "disable-pathfinding-direct-tiles": {
        type: "boolean",
        default: false,
      },
      "trace-pathfinding-direct-tiles": {
        type: "boolean",
        default: false,
      },
      "probe-pathfinding-tiles-mod-fallback": {
        type: "boolean",
        default: false,
      },
      "disable-pathfinding-direct-successors": {
        type: "boolean",
        default: false,
      },
      "trace-pathfinding-direct-successors": {
        type: "boolean",
        default: false,
      },
      "disable-pathfinding-closed-first-successors": {
        type: "boolean",
        default: false,
      },
      "trace-pathfinding-closed-first-successors": {
        type: "boolean",
        default: false,
      },
      "disable-pathfinding-numeric-coordinate-keys": {
        type: "boolean",
        default: false,
      },
      "trace-pathfinding-numeric-coordinate-keys": {
        type: "boolean",
        default: false,
      },
      "verify-pathfinding-numeric-coordinate-keys": {
        type: "boolean",
        default: false,
      },
      "disable-pathfinding-tile-membership-table": {
        type: "boolean",
        default: false,
      },
      "trace-pathfinding-tile-membership-table": {
        type: "boolean",
        default: false,
      },
      "verify-pathfinding-tile-membership-table": {
        type: "boolean",
        default: false,
      },
      "disable-pathfinding-numeric-continuation-index": {
        type: "boolean",
        default: false,
      },
      "trace-pathfinding-numeric-continuation-index": {
        type: "boolean",
        default: false,
      },
      "verify-pathfinding-numeric-continuation-index": {
        type: "boolean",
        default: false,
      },
      "probe-pathfinding-tile-membership-dependency-fallback": {
        type: "boolean",
        default: false,
      },
      "probe-pathfinding-numeric-get-path-fallback": {
        type: "boolean",
        default: false,
      },
      "disable-pathfinding-top-cache-single-read": {
        type: "boolean",
        default: false,
      },
      "trace-pathfinding-top-cache-single-read": {
        type: "boolean",
        default: false,
      },
      "probe-pathfinding-top-cache-mod-fallback": {
        type: "boolean",
        default: false,
      },
      "disable-pathfinding-deferred-tile-metadata": {
        type: "boolean",
        default: false,
      },
      "trace-pathfinding-deferred-tile-metadata": {
        type: "boolean",
        default: false,
      },
      "probe-pathfinding-deferred-tile-mod-fallback": {
        type: "boolean",
        default: false,
      },
      "probe-pathfinding-successors-mod-fallback": {
        type: "boolean",
        default: false,
      },
      "disable-pathfinding-open-values": {
        type: "boolean",
        default: false,
      },
      "trace-pathfinding-open-values": {
        type: "boolean",
        default: false,
      },
      "probe-pathfinding-open-values-mod-fallback": {
        type: "boolean",
        default: false,
      },
      "disable-map-generation-pathfinding-direct-fallback": {
        type: "boolean",
        default: false,
      },
      "trace-map-generation-pathfinding-direct-fallback": {
        type: "boolean",
        default: false,
      },
      "probe-map-generation-pathfinding-hook-fallback": {
        type: "boolean",
        default: false,
      },
      "disable-pathfinding-continuation-cache-lookup": {
        type: "boolean",
        default: false,
      },
      "trace-pathfinding-continuation-cache-lookup": {
        type: "boolean",
        default: false,
      },
      "disable-pathfinding-hoisted-cache-index": {
        type: "boolean",
        default: false,
      },
      "trace-pathfinding-hoisted-cache-index": {
        type: "boolean",
        default: false,
      },
      output: {
        type: "string",
        default: "artifacts/mapgen-profile-latest.json",
      },
    },
  });
  const port = parseInteger("port", values.port, 1, 65_535);
  const mapCount = parseInteger("maps", values.maps, 1, 120);
  const startIndex = parseInteger(
    "start-index",
    values["start-index"],
    0,
    100_000,
  );
  const pathfindingMode = parseChoice("pathfinding", values.pathfinding, [
    "native",
    "javascript",
  ]);
  const probeEnemySelectorHoists = values["probe-enemy-selector-hoists"];
  const disableEnemySelectorHoists = values["disable-enemy-selector-hoists"];
  const probeEnemySelectorModFallback =
    values["probe-enemy-selector-mod-fallback"];
  const probeEnemySelectorAngerCache =
    values["probe-enemy-selector-anger-cache"];
  const probeEnemySelectorSingleTagCache =
    values["probe-enemy-selector-single-tag-cache"];
  const probeEnemySelectorLongTagCache =
    values["probe-enemy-selector-long-tag-cache"];
  const restrictProbeEnemySelectorLongTagCache =
    values["restrict-probe-enemy-selector-long-tag-cache"];
  const probeEnemySelectorWeightedQueryCache =
    values["probe-enemy-selector-weighted-query-cache"];
  const probeEnemySelectorWeightedSingleTagCache =
    values["probe-enemy-selector-weighted-single-tag-cache"];
  const probeEnemySelectorWeightedFilterTagCache =
    values["probe-enemy-selector-weighted-filter-tag-cache"];
  const disableEnemySelectorWeightedQueryCache =
    values["disable-enemy-selector-weighted-query-cache"];
  const disableEnemySelectorWeightedSingleTagCache =
    values["disable-enemy-selector-weighted-single-tag-cache"];
  const disableEnemySelectorWeightedFilterTagCache =
    values["disable-enemy-selector-weighted-filter-tag-cache"];
  const traceEnemySelectorWeightedQueryCache =
    values["trace-enemy-selector-weighted-query-cache"];
  const disableEnemySelectorLongTagCache =
    values["disable-enemy-selector-long-tag-cache"];
  const disableEnemySelectorGeneralLongTagCache =
    values["disable-enemy-selector-general-long-tag-cache"];
  const traceEnemySelectorLongTagCache =
    values["trace-enemy-selector-long-tag-cache"];
  const probeEnemySelectorLongTagHookFallback =
    values["probe-enemy-selector-long-tag-hook-fallback"];
  const probeEnemySelectorLongTagCatalogFallback =
    values["probe-enemy-selector-long-tag-catalog-fallback"];
  const disableEnemySelectorAngerCache =
    values["disable-enemy-selector-anger-cache"];
  const traceEnemySelectorAngerCache =
    values["trace-enemy-selector-anger-cache"];
  const probeEnemySelectorAngerHookFallback =
    values["probe-enemy-selector-anger-hook-fallback"];
  const probeEnemySelectorAngerCatalogFallback =
    values["probe-enemy-selector-anger-catalog-fallback"];
  const weightedQueryFallbackExpected =
    disableEnemySelectorWeightedQueryCache ||
    probeEnemySelectorLongTagHookFallback ||
    probeEnemySelectorLongTagCatalogFallback ||
    probeEnemySelectorAngerHookFallback ||
    probeEnemySelectorAngerCatalogFallback;
  const weightedQueryCatalogFallbackExpected =
    probeEnemySelectorLongTagCatalogFallback ||
    probeEnemySelectorAngerCatalogFallback;
  const probeRestraintTagKeys = values["probe-restraint-tag-keys"];
  const probeRestraintEnemyKeys = values["probe-restraint-enemy-keys"];
  const probeRestraintCatalogFastPathCeiling =
    values["probe-restraint-catalog-fast-path-ceiling"];
  const probeRestraintEquivalence = values["probe-restraint-equivalence"];
  const probeRestraintRecursion = values["probe-restraint-recursion"];
  const verifyRestraintRetryReuse = values["verify-restraint-retry-reuse"];
  const disableRestraintEnemyKeys = values["disable-restraint-enemy-keys"];
  const disableRestraintRetryReuse = values["disable-restraint-retry-reuse"];
  const disableRestraintTopLevelReuse =
    values["disable-restraint-top-level-reuse"];
  const disableRestraintMultiEntryReuse =
    values["disable-restraint-multi-entry-reuse"];
  const traceRestraintSource = values["trace-restraint-source"];
  const probeRestraintModFallback = values["probe-restraint-mod-fallback"];
  const probeAccessibleFrontierSingleRead =
    values["probe-accessible-frontier-single-read"];
  const probeAccessibleNeighborSingleRead =
    values["probe-accessible-neighbor-single-read"];
  const probeAccessibleNumericState = values["probe-accessible-numeric-state"];
  const probeAccessibleQueue =
    values["probe-accessible-queue"] || probeAccessibleNumericState;
  const verifyAccessibleQueue = values["verify-accessible-queue"];
  const disableAccessibleQueueSource =
    values["disable-accessible-queue-source"];
  const disableAccessibleNumericStateSource =
    values["disable-accessible-numeric-state-source"];
  const traceAccessibleQueueSource = values["trace-accessible-queue-source"];
  const probeAccessibleQueueSourceModFallback =
    values["probe-accessible-queue-source-mod-fallback"];
  const probePlaceDoorsAccessibleReuse =
    values["probe-place-doors-accessible-reuse"];
  const verifyPlaceDoorsAccessibleReuse =
    values["verify-place-doors-accessible-reuse"];
  const disablePlaceDoorsAccessibleReuseSource =
    values["disable-place-doors-accessible-reuse-source"];
  const tracePlaceDoorsAccessibleReuseSource =
    values["trace-place-doors-accessible-reuse-source"];
  const probeMapTileFillingCoordinateReuse =
    values["probe-map-tile-filling-coordinate-reuse"];
  const verifyMapTileFillingCoordinateReuse =
    values["verify-map-tile-filling-coordinate-reuse"];
  const disableMapTileFillingCoordinateReuseSource =
    values["disable-map-tile-filling-coordinate-reuse-source"];
  const traceMapTileFillingCoordinateReuseSource =
    values["trace-map-tile-filling-coordinate-reuse-source"];
  const probeMapTileFillingCoordinateReuseSourceEquivalence =
    values["probe-map-tile-filling-coordinate-reuse-source-equivalence"];
  const probePasteTileSerializedCache =
    values["probe-paste-tile-serialized-cache"];
  const verifyPasteTileSerializedCache =
    values["verify-paste-tile-serialized-cache"];
  const disablePasteTileSerializedCacheSource =
    values["disable-paste-tile-serialized-cache-source"];
  const tracePasteTileSerializedCacheSource =
    values["trace-paste-tile-serialized-cache-source"];
  const verifyPasteTileSerializedCacheSource =
    values["verify-paste-tile-serialized-cache-source"];
  if (verifyAccessibleQueue && !probeAccessibleQueue) {
    throw new RangeError(
      "--verify-accessible-queue requires --probe-accessible-queue",
    );
  }
  if (verifyPlaceDoorsAccessibleReuse && !probePlaceDoorsAccessibleReuse) {
    throw new RangeError(
      "--verify-place-doors-accessible-reuse requires --probe-place-doors-accessible-reuse",
    );
  }
  if (
    verifyMapTileFillingCoordinateReuse &&
    !probeMapTileFillingCoordinateReuse
  ) {
    throw new RangeError(
      "--verify-map-tile-filling-coordinate-reuse requires --probe-map-tile-filling-coordinate-reuse",
    );
  }
  if (verifyPasteTileSerializedCache && !probePasteTileSerializedCache) {
    throw new RangeError(
      "--verify-paste-tile-serialized-cache requires --probe-paste-tile-serialized-cache",
    );
  }
  if (
    verifyPasteTileSerializedCacheSource &&
    !tracePasteTileSerializedCacheSource
  ) {
    throw new RangeError(
      "--verify-paste-tile-serialized-cache-source requires --trace-paste-tile-serialized-cache-source",
    );
  }
  const probePathCacheSingleSlice = values["probe-path-cache-single-slice"];
  const probePathCacheEquivalence = values["probe-path-cache-equivalence"];
  const probePathCacheSkipIdenticalExisting =
    values["probe-path-cache-skip-identical-existing"];
  const probePathCacheSkipExistingEquivalence =
    values["probe-path-cache-skip-existing-equivalence"];
  const probePathCacheEdgeIdentitySkip =
    values["probe-path-cache-edge-identity-skip"];
  const probePathCacheEdgeIdentityEquivalence =
    values["probe-path-cache-edge-identity-equivalence"];
  const probePathCacheCallReuse = values["probe-path-cache-call-reuse"];
  const disablePathCacheKnownTailSkip =
    values["disable-path-cache-known-tail-skip"];
  const tracePathCacheKnownTail = values["trace-path-cache-known-tail"];
  const verifyPathCacheKnownTail = values["verify-path-cache-known-tail"];
  const probePathCacheKnownTailWriterFallback =
    values["probe-path-cache-known-tail-writer-fallback"];
  const probePathCacheNoWrite = values["probe-path-cache-no-write"];
  const probePathCacheHitDistribution =
    values["probe-path-cache-hit-distribution"];
  const probePathCachePrefixLimit = parseInteger(
    "probe-path-cache-prefix-limit",
    values["probe-path-cache-prefix-limit"],
    0,
    1_000,
  );
  const disablePathCacheSingleSlice = values["disable-path-cache-single-slice"];
  const tracePathCacheSource = values["trace-path-cache-source"];
  const probePathCacheModFallback = values["probe-path-cache-mod-fallback"];
  const disablePathCacheHoistedKeySuffix =
    values["disable-path-cache-hoisted-key-suffix"];
  const tracePathCacheHoistedKeySuffix =
    values["trace-path-cache-hoisted-key-suffix"];
  const disableMapGenerationPathCacheEdgeIdentitySkip =
    values["disable-map-generation-path-cache-edge-identity-skip"];
  const traceMapGenerationPathCacheEdgeIdentitySkip =
    values["trace-map-generation-path-cache-edge-identity-skip"];
  const probeMapGenerationPathCacheModFallback =
    values["probe-map-generation-path-cache-mod-fallback"];
  const disablePathfindingDirectTiles =
    values["disable-pathfinding-direct-tiles"];
  const tracePathfindingDirectTiles = values["trace-pathfinding-direct-tiles"];
  const probePathfindingTilesModFallback =
    values["probe-pathfinding-tiles-mod-fallback"];
  const disablePathfindingDirectSuccessors =
    values["disable-pathfinding-direct-successors"];
  const tracePathfindingDirectSuccessors =
    values["trace-pathfinding-direct-successors"];
  const disablePathfindingClosedFirstSuccessors =
    values["disable-pathfinding-closed-first-successors"];
  const tracePathfindingClosedFirstSuccessors =
    values["trace-pathfinding-closed-first-successors"];
  const disablePathfindingNumericCoordinateKeys =
    values["disable-pathfinding-numeric-coordinate-keys"];
  const tracePathfindingNumericCoordinateKeys =
    values["trace-pathfinding-numeric-coordinate-keys"];
  const verifyPathfindingNumericCoordinateKeys =
    values["verify-pathfinding-numeric-coordinate-keys"];
  const disablePathfindingTileMembershipTable =
    values["disable-pathfinding-tile-membership-table"];
  const tracePathfindingTileMembershipTable =
    values["trace-pathfinding-tile-membership-table"];
  const verifyPathfindingTileMembershipTable =
    values["verify-pathfinding-tile-membership-table"];
  const disablePathfindingNumericContinuationIndex =
    values["disable-pathfinding-numeric-continuation-index"];
  const tracePathfindingNumericContinuationIndex =
    values["trace-pathfinding-numeric-continuation-index"];
  const verifyPathfindingNumericContinuationIndex =
    values["verify-pathfinding-numeric-continuation-index"];
  const probePathfindingTileMembershipDependencyFallback =
    values["probe-pathfinding-tile-membership-dependency-fallback"];
  const probePathfindingNumericGetPathFallback =
    values["probe-pathfinding-numeric-get-path-fallback"];
  const disablePathfindingTopCacheSingleRead =
    values["disable-pathfinding-top-cache-single-read"];
  const tracePathfindingTopCacheSingleRead =
    values["trace-pathfinding-top-cache-single-read"];
  const probePathfindingTopCacheModFallback =
    values["probe-pathfinding-top-cache-mod-fallback"];
  const disablePathfindingDeferredTileMetadata =
    values["disable-pathfinding-deferred-tile-metadata"];
  const tracePathfindingDeferredTileMetadata =
    values["trace-pathfinding-deferred-tile-metadata"];
  const probePathfindingDeferredTileModFallback =
    values["probe-pathfinding-deferred-tile-mod-fallback"];
  const probePathfindingSuccessorsModFallback =
    values["probe-pathfinding-successors-mod-fallback"];
  const disablePathfindingOpenValues =
    values["disable-pathfinding-open-values"];
  const tracePathfindingOpenValues = values["trace-pathfinding-open-values"];
  const probePathfindingOpenValuesModFallback =
    values["probe-pathfinding-open-values-mod-fallback"];
  const disableMapGenerationPathfindingDirectFallback =
    values["disable-map-generation-pathfinding-direct-fallback"];
  const traceMapGenerationPathfindingDirectFallback =
    values["trace-map-generation-pathfinding-direct-fallback"];
  const probeMapGenerationPathfindingHookFallback =
    values["probe-map-generation-pathfinding-hook-fallback"];
  const disablePathfindingContinuationCacheLookup =
    values["disable-pathfinding-continuation-cache-lookup"];
  const tracePathfindingContinuationCacheLookup =
    values["trace-pathfinding-continuation-cache-lookup"];
  const disablePathfindingHoistedCacheIndex =
    values["disable-pathfinding-hoisted-cache-index"];
  const tracePathfindingHoistedCacheIndex =
    values["trace-pathfinding-hoisted-cache-index"];
  const directProbeCount = [
    probeEnemySelectorHoists,
    probeEnemySelectorModFallback,
    probeEnemySelectorAngerCache,
    probeEnemySelectorSingleTagCache,
    probeEnemySelectorLongTagCache,
    probeEnemySelectorWeightedQueryCache,
    probeEnemySelectorWeightedSingleTagCache,
    probeEnemySelectorWeightedFilterTagCache,
    probeEnemySelectorLongTagHookFallback,
    probeEnemySelectorLongTagCatalogFallback,
    probeEnemySelectorAngerHookFallback,
    probeEnemySelectorAngerCatalogFallback,
    probeRestraintTagKeys,
    probeRestraintEnemyKeys,
    probeRestraintCatalogFastPathCeiling,
    probeRestraintEquivalence,
    probeRestraintRecursion,
    verifyRestraintRetryReuse,
    probeRestraintModFallback,
    probeAccessibleFrontierSingleRead,
    probeAccessibleNeighborSingleRead,
    probeAccessibleQueue,
    probeAccessibleQueueSourceModFallback,
    probePlaceDoorsAccessibleReuse,
    probeMapTileFillingCoordinateReuse,
    probeMapTileFillingCoordinateReuseSourceEquivalence,
    probePasteTileSerializedCache,
    probePathCacheSingleSlice,
    probePathCacheEquivalence,
    probePathCacheSkipIdenticalExisting,
    probePathCacheSkipExistingEquivalence,
    probePathCacheEdgeIdentitySkip,
    probePathCacheEdgeIdentityEquivalence,
    probePathCacheCallReuse,
    probePathCacheKnownTailWriterFallback,
    probePathCacheNoWrite,
    probePathCacheHitDistribution,
    probePathCachePrefixLimit > 0,
    probePathCacheModFallback,
    probePathfindingTilesModFallback,
    probePathfindingSuccessorsModFallback,
    probePathfindingTopCacheModFallback,
    probePathfindingDeferredTileModFallback,
    probePathfindingOpenValuesModFallback,
    probePathfindingNumericGetPathFallback,
    probeMapGenerationPathfindingHookFallback,
    probeMapGenerationPathCacheModFallback,
  ].filter(Boolean).length;
  if (directProbeCount > 1) {
    throw new RangeError(
      "The direct map-generation probes are mutually exclusive",
    );
  }
  const samplingInterval = parseInteger(
    "interval",
    values.interval,
    50,
    10_000,
  );
  const collectCpuProfile = !values["wall-only"];
  const outputPath = path.resolve(values.output);
  const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const target = targets.find(
    (candidate) =>
      candidate.type === "page" &&
      candidate.url.includes("index.html") &&
      !candidate.url.startsWith("devtools://"),
  );
  if (target?.webSocketDebuggerUrl === undefined) {
    throw new Error(`No KD renderer target is available on port ${port}`);
  }

  const client = await CdpClient.connect(target.webSocketDebuggerUrl);
  let snapshotCaptured = false;
  let pathfindingConfigured = false;
  try {
    const environment = await client.evaluate(
      `(async () => {
        const deadline = performance.now() + 30000;
        while (
          typeof globalThis.KinkyDungeonCreateMap !== "function" ||
          typeof globalThis.KinkyDungeonSaveGame !== "function" ||
          typeof globalThis.KinkyDungeonLoadGame !== "function" ||
          typeof globalThis.KDsetSeed !== "function" ||
          typeof KinkyDungeonPlayer === "undefined" ||
          KinkyDungeonPlayer === null ||
          !Array.isArray(KinkyDungeonPlayer.Appearance) ||
          typeof KDMapData === "undefined" ||
          typeof KDMapData.Grid !== "string" ||
          typeof KinkyDungeonPlayerEntity === "undefined" ||
          globalThis.KDHybrid === undefined ||
          !KDHybrid.status().initialized ||
          !KDHybrid.status().systems.some(
            (status) =>
              status.globalName === "KinkyDungeonCreateMap" &&
              status.mode === "native"
          )
        ) {
          if (performance.now() >= deadline) {
            throw new Error("Timed out waiting for the KD map generator");
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        let fixtureInitialized = false;
        let restoreJson;
        try {
          restoreJson = JSON.stringify(KinkyDungeonSaveGame(true));
        } catch {
          KDSetWorldSlot(0, 1, 0, 0);
          MiniGameKinkyDungeonCheckpoint = "grv";
          KinkyDungeonInitialize(1);
          KDInitPerks();
          MiniGameKinkyDungeonCheckpoint = "grv";
          KDsetSeed("kd-hybrid-mapgen-restore-fixture-5.4.92");
          KinkyDungeonCreateMap(
            KinkyDungeonMapParams[
              KinkyDungeonMapIndex[MiniGameKinkyDungeonCheckpoint] ||
                MiniGameKinkyDungeonCheckpoint
            ],
            "",
            "",
            1,
            true,
            true,
            undefined,
            { x: 0, y: 1 },
            false
          );
          KinkyDungeonState = "Game";
          fixtureInitialized = true;
          const modelDeadline = performance.now() + 10_000;
          while (!KDCurrentModels.get(KinkyDungeonPlayer)) {
            if (performance.now() >= modelDeadline) {
              throw new Error(
                "Timed out waiting for the deterministic fixture model"
              );
            }
            await new Promise((resolve) =>
              requestAnimationFrame(() => resolve())
            );
          }
          restoreJson = JSON.stringify(KinkyDungeonSaveGame(true));
        }
        globalThis.kdHybridMapgenProfileRestore =
          LZString.compressToBase64(restoreJson);
        const restoreStateText = JSON.stringify({
          checkpoint: MiniGameKinkyDungeonCheckpoint,
          floor: MiniGameKinkyDungeonLevel,
          grid: KDMapData.Grid,
          start: KDMapData.StartPosition,
          end: KDMapData.EndPosition,
          player: [KinkyDungeonPlayerEntity.x, KinkyDungeonPlayerEntity.y],
          entities: KDMapData.Entities.map((enemy) => [
            enemy.id,
            enemy.Enemy?.name ?? enemy.Enemy,
            enemy.x,
            enemy.y
          ]).sort((left, right) =>
            JSON.stringify(left).localeCompare(JSON.stringify(right))
          ),
          groundItems: KDMapData.GroundItems.map((item) => [
            item.name,
            item.x,
            item.y
          ]).sort((left, right) =>
            JSON.stringify(left).localeCompare(JSON.stringify(right))
          )
        });
        let restoreSignature = 0x811c9dc5;
        for (
          let characterIndex = 0;
          characterIndex < restoreStateText.length;
          characterIndex += 1
        ) {
          restoreSignature ^= restoreStateText.charCodeAt(characterIndex);
          restoreSignature = Math.imul(restoreSignature, 0x01000193);
        }
        return {
           gameVersion:
             typeof KinkyDungeonVersion === "string"
               ? KinkyDungeonVersion
               : null,
           rendererSession: {
             processId:
               typeof globalThis.process?.pid === "number"
                 ? globalThis.process.pid
                 : null,
             timeOrigin: performance.timeOrigin
           },
           sourcePatches: {
             ...(globalThis.KDHybridSourcePatches || {})
           },
           runtime: KDHybrid.status(),
          state: KinkyDungeonState,
          checkpoint: MiniGameKinkyDungeonCheckpoint,
          floor: MiniGameKinkyDungeonLevel,
          fixtureInitialized,
          restoreFormat: "lz-string-base64",
          restoreBytes: globalThis.kdHybridMapgenProfileRestore.length,
          restoreSignature: (restoreSignature >>> 0)
            .toString(16)
            .padStart(8, "0"),
          heapBefore:
            performance.memory?.usedJSHeapSize ?? null
        };
      })()`,
      60_000,
    );
    snapshotCaptured = true;
    const initialPathfinding = environment.runtime.systems.find(
      (status) => status.globalName === "KinkyDungeonFindPath",
    );
    if (initialPathfinding?.mode !== "native") {
      throw new Error(
        "The mapgen A/B harness requires pathfinding to begin in native mode",
      );
    }
    const pathfindingBefore = await configurePathfinding(
      client,
      pathfindingMode,
    );
    pathfindingConfigured = true;
    const enemySelectorBefore = await readAdapterStatus(
      client,
      "KinkyDungeonGetEnemy",
    );

    if (collectCpuProfile) {
      await client.call("Profiler.enable");
      await client.call("Profiler.setSamplingInterval", {
        interval: samplingInterval,
      });
      await client.call("Profiler.start");
    }
    let run;
    let stopped;
    try {
      run = await client.evaluate(
        `(async () => {
          const checkpoints = ["grv", "cat", "jng"];
          const floorBands = [1, 7, 13, 19];
          const results = [];
          const enemySelectorStats = {
            calls: 0,
            optimizedCalls: 0,
            fallbackCalls: 0,
            enemiesScanned: 0,
            selections: 0,
            recursiveFallbacks: 0,
            fallbackReasons: {},
            tagLengthCounts: {},
            tagSequenceCounts: {},
            normalTagSlots: 0,
            noOverrideTagSlots: 0,
            dynamicTagChecks: 0,
            dynamicTagMatches: 0,
            uniqueEnemyTagObjects: 0,
            uniqueEnemyTagKeys: 0,
            enemyTagKeyIterations: 0,
            angerCacheCalls: 0,
            angerCacheBuilds: 0,
            angerCacheHits: 0,
            angerTagChecksElided: 0,
            angerCountVector: null,
            singleTagCacheCalls: 0,
            singleTagCacheBuilds: 0,
            singleTagCacheHits: 0,
            singleTagChecksElided: 0,
            singleTagMatchVectors: {},
            longTagCacheCalls: 0,
            longTagCacheBuilds: 0,
            longTagCacheHits: 0,
            longTagChecksElided: 0,
            longTagSequences: 0,
            weightedQueryEpoch: 0,
            weightedQueryCacheCandidates: 0,
            weightedQueryCacheCalls: 0,
            weightedQueryCacheBuilds: 0,
            weightedQueryCacheHits: 0,
            weightedQueryCacheEntries: 0,
            weightedQueryEnemiesElided: 0,
            weightedQueryIneligibleReasons: {},
            weightedSingleTagCacheCalls: 0,
            weightedSingleTagCacheBuilds: 0,
            weightedSingleTagCacheHits: 0,
            weightedSingleTagEnemiesElided: 0,
            weightedFilterTagCacheCalls: 0,
            weightedFilterTagCacheBuilds: 0,
            weightedFilterTagCacheHits: 0,
            weightedFilterTagEnemiesElided: 0
          };
          const restraintEligibleStats = {
            calls: 0,
            tagKeys: 0,
            forcedFastPathRestraints: 0,
            comparedCalls: 0,
            mismatches: 0,
            firstMismatch: null,
            topLevelCalls: 0,
            recursiveCalls: 0,
            recursiveCallsWithExtraOptions: 0,
            sameBaseArgumentRecursiveCalls: 0,
            maxDepth: 0,
            filterEpsTransitions: {},
            uniqueCatalogQueryKeys: 0,
            repeatedCatalogQueryCalls: 0,
            consecutiveCatalogQueryRepeats: 0,
            maximumCatalogQueryRun: 0,
            fifoCapacityHits: {},
            fifoCapacityMisses: {},
            consecutiveEqualResults: 0,
            consecutiveDifferentResults: 0,
            resultFingerprints: []
          };
          const accessibleFrontierStats = {
            accessibleCalls: 0,
            roomCalls: 0
          };
          const accessibleNeighborStats = {
            accessibleCalls: 0,
            roomCalls: 0
          };
          const accessibleQueueStats = {
            accessibleCalls: 0,
            roomCalls: 0,
            comparedCalls: 0,
            mismatches: 0,
            firstMismatch: null
          };
          const pathCacheStats = {
            calls: 0,
            points: 0,
            existingEntries: 0,
            identicalExistingEntries: 0,
            differentExistingEntries: 0,
            edgeIdentityCandidates: 0,
            edgeIdentityFalsePositives: 0,
            newEntries: 0,
            skippedEntries: 0,
            comparedCalls: 0,
            mismatches: 0,
            firstMismatch: null,
            hasCalls: 0,
            hits: 0,
            suffixHits: 0,
            finalHits: 0,
            unknownHits: 0,
            suffixEntries: 0,
            finalEntries: 0,
            pathPoints: 0,
            writesByPathLength: {},
            suffixWritesByLength: {},
            suffixHitsByLength: {},
            suffixHitsBySourceIndex: {},
            suffixHitsByPathLength: {}
          };
          const readPathCacheCounters = () => ({
            hits:
              typeof KDPathfindingCacheHits === "number"
                ? KDPathfindingCacheHits
                : null,
            fills:
              typeof KDPathfindingCacheFails === "number"
                ? KDPathfindingCacheFails
                : null,
            regularEntries:
              typeof KDPathCache !== "undefined" &&
              typeof KDPathCache?.size === "number"
                ? KDPathCache.size
                : null,
            ignoreLockEntries:
              typeof KDPathCacheIgnoreLocks !== "undefined" &&
              typeof KDPathCacheIgnoreLocks?.size === "number"
                ? KDPathCacheIgnoreLocks.size
                : null
          });
          const pathCacheCountersBefore = readPathCacheCounters();
          let pathCacheCountersAfter = null;
          const hadSourceControl =
            Object.prototype.hasOwnProperty.call(
              globalThis,
              "KDHybridSourcePatchControl"
            );
          const sourceControl =
            globalThis.KDHybridSourcePatchControl ||
            (globalThis.KDHybridSourcePatchControl = {});
          const hadRuntimeControl =
            Object.prototype.hasOwnProperty.call(
              globalThis,
              "KDHybridRuntimeControl"
            );
          const runtimeControl =
            globalThis.KDHybridRuntimeControl ||
            (globalThis.KDHybridRuntimeControl = {});
          const hadDisableAccessibleQueue =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableAccessibleQueue"
            );
          const previousDisableAccessibleQueue =
            sourceControl.disableAccessibleQueue;
          const hadDisableAccessibleNumericState =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableAccessibleNumericState"
            );
          const previousDisableAccessibleNumericState =
            sourceControl.disableAccessibleNumericState;
          const hadAccessibleQueueStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "accessibleQueueStats"
            );
          const previousAccessibleQueueStats =
            sourceControl.accessibleQueueStats;
          const accessibleQueueSourceStats = ${
            traceAccessibleQueueSource || probeAccessibleQueueSourceModFallback
              ? `{
                  accessibleCalls: 0,
                  roomCalls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0
                }`
              : "null"
          };
          sourceControl.disableAccessibleQueue =
            ${disableAccessibleQueueSource};
          sourceControl.disableAccessibleNumericState =
            ${disableAccessibleNumericStateSource};
          if (accessibleQueueSourceStats !== null) {
            sourceControl.accessibleQueueStats =
              accessibleQueueSourceStats;
          }
          const canonicalAccessibleQueueObjectEntries = Object.entries;
          let accessibleQueueModFallbackCalls = 0;
          let accessibleQueueModFallbackRestored = null;
          if (${probeAccessibleQueueSourceModFallback}) {
            Object.entries = function accessibleQueueObjectEntriesFallback(
              ...args
            ) {
              accessibleQueueModFallbackCalls += 1;
              return Reflect.apply(
                canonicalAccessibleQueueObjectEntries,
                Object,
                args
              );
            };
          }
          const hadDisablePlaceDoorsAccessibleReuse =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePlaceDoorsAccessibleReuse"
            );
          const previousDisablePlaceDoorsAccessibleReuse =
            sourceControl.disablePlaceDoorsAccessibleReuse;
          const hadPlaceDoorsAccessibleReuseStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "placeDoorsAccessibleReuseStats"
            );
          const previousPlaceDoorsAccessibleReuseStats =
            sourceControl.placeDoorsAccessibleReuseStats;
          const placeDoorsAccessibleReuseSourceStats = ${
            tracePlaceDoorsAccessibleReuseSource
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0,
                  reuses: 0,
                  officialCalls: 0
                }`
              : "null"
          };
          sourceControl.disablePlaceDoorsAccessibleReuse =
            ${disablePlaceDoorsAccessibleReuseSource};
          if (placeDoorsAccessibleReuseSourceStats !== null) {
            sourceControl.placeDoorsAccessibleReuseStats =
              placeDoorsAccessibleReuseSourceStats;
          }
          const hadDisableMapTileFillingCoordinateReuse =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableMapTileFillingCoordinateReuse"
            );
          const previousDisableMapTileFillingCoordinateReuse =
            sourceControl.disableMapTileFillingCoordinateReuse;
          const hadMapTileFillingCoordinateReuseStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "mapTileFillingCoordinateReuseStats"
            );
          const previousMapTileFillingCoordinateReuseStats =
            sourceControl.mapTileFillingCoordinateReuseStats;
          const mapTileFillingCoordinateReuseSourceStats = ${
            traceMapTileFillingCoordinateReuseSource ||
            probeMapTileFillingCoordinateReuseSourceEquivalence
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0,
                  fitChecks: 0
                }`
              : "null"
          };
          sourceControl.disableMapTileFillingCoordinateReuse =
            ${disableMapTileFillingCoordinateReuseSource};
          if (mapTileFillingCoordinateReuseSourceStats !== null) {
            sourceControl.mapTileFillingCoordinateReuseStats =
              mapTileFillingCoordinateReuseSourceStats;
          }
          const hadDisablePasteTileSerializedCache =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePasteTileSerializedCache"
            );
          const previousDisablePasteTileSerializedCache =
            sourceControl.disablePasteTileSerializedCache;
          const hadVerifyPasteTileSerializedCache =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "verifyPasteTileSerializedCache"
            );
          const previousVerifyPasteTileSerializedCache =
            sourceControl.verifyPasteTileSerializedCache;
          const hadPasteTileSerializedCacheStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pasteTileSerializedCacheStats"
            );
          const previousPasteTileSerializedCacheStats =
            sourceControl.pasteTileSerializedCacheStats;
          const pasteTileSerializedCacheSourceStats = ${
            tracePasteTileSerializedCacheSource
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0,
                  cacheResets: 0,
                  hits: 0,
                  misses: 0,
                  verifications: 0,
                  mismatches: 0
                }`
              : "null"
          };
          sourceControl.disablePasteTileSerializedCache =
            ${disablePasteTileSerializedCacheSource};
          sourceControl.verifyPasteTileSerializedCache =
            ${verifyPasteTileSerializedCacheSource};
          if (pasteTileSerializedCacheSourceStats !== null) {
            sourceControl.pasteTileSerializedCacheStats =
              pasteTileSerializedCacheSourceStats;
          }
          const hadDisableMapGenerationPathfindingDirectFallback =
            Object.prototype.hasOwnProperty.call(
              runtimeControl,
              "disableMapGenerationPathfindingDirectFallback"
            );
          const previousDisableMapGenerationPathfindingDirectFallback =
            runtimeControl.disableMapGenerationPathfindingDirectFallback;
          const hadMapGenerationPathfindingDirectFallbackStats =
            Object.prototype.hasOwnProperty.call(
              runtimeControl,
              "mapGenerationPathfindingDirectFallbackStats"
            );
          const previousMapGenerationPathfindingDirectFallbackStats =
            runtimeControl.mapGenerationPathfindingDirectFallbackStats;
          const mapGenerationPathfindingDirectFallbackStats = ${
            traceMapGenerationPathfindingDirectFallback
              ? `{
                  optimizedMaps: 0,
                  fallbackMaps: 0
                }`
              : "null"
          };
          runtimeControl.disableMapGenerationPathfindingDirectFallback =
            ${disableMapGenerationPathfindingDirectFallback};
          if (mapGenerationPathfindingDirectFallbackStats !== null) {
            runtimeControl.mapGenerationPathfindingDirectFallbackStats =
              mapGenerationPathfindingDirectFallbackStats;
          }
          const hadDisableMapGenerationPathCacheEdgeIdentitySkip =
            Object.prototype.hasOwnProperty.call(
              runtimeControl,
              "disableMapGenerationPathCacheEdgeIdentitySkip"
            );
          const previousDisableMapGenerationPathCacheEdgeIdentitySkip =
            runtimeControl.disableMapGenerationPathCacheEdgeIdentitySkip;
          const hadMapGenerationPathCacheEdgeIdentityStats =
            Object.prototype.hasOwnProperty.call(
              runtimeControl,
              "mapGenerationPathCacheEdgeIdentityStats"
            );
          const previousMapGenerationPathCacheEdgeIdentityStats =
            runtimeControl.mapGenerationPathCacheEdgeIdentityStats;
          const mapGenerationPathCacheEdgeIdentityStats = ${
            traceMapGenerationPathCacheEdgeIdentitySkip ||
            probePathCacheCallReuse ||
            probeMapGenerationPathCacheModFallback
              ? `{
                  optimizedMaps: 0,
                  fallbackMaps: 0
                }`
              : "null"
          };
          runtimeControl.disableMapGenerationPathCacheEdgeIdentitySkip =
            ${disableMapGenerationPathCacheEdgeIdentitySkip};
          if (mapGenerationPathCacheEdgeIdentityStats !== null) {
            runtimeControl.mapGenerationPathCacheEdgeIdentityStats =
              mapGenerationPathCacheEdgeIdentityStats;
          }
          const hadDisableEnemySelectorHoists =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableEnemySelectorHoists"
            );
          const previousDisableEnemySelectorHoists =
            sourceControl.disableEnemySelectorHoists;
          sourceControl.disableEnemySelectorHoists = ${
            probeEnemySelectorHoists || disableEnemySelectorHoists
          };
          const hadDisableEnemySelectorAngerCache =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableEnemySelectorAngerCache"
            );
          const previousDisableEnemySelectorAngerCache =
            sourceControl.disableEnemySelectorAngerCache;
          const hadEnemySelectorAngerCacheStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "enemySelectorAngerCacheStats"
            );
          const previousEnemySelectorAngerCacheStats =
            sourceControl.enemySelectorAngerCacheStats;
          const enemySelectorAngerCacheStats = ${
            traceEnemySelectorAngerCache ||
            probeEnemySelectorAngerHookFallback ||
            probeEnemySelectorAngerCatalogFallback
              ? `{
                  optimizedCalls: 0,
                  fallbackCalls: 0,
                  cacheBuilds: 0,
                  cacheHits: 0,
                  tagChecksElided: 0,
                  validationFailures: 0,
                  perEnemyFallbacks: 0
                }`
              : "null"
          };
          sourceControl.disableEnemySelectorAngerCache =
            ${disableEnemySelectorAngerCache};
          if (enemySelectorAngerCacheStats !== null) {
            sourceControl.enemySelectorAngerCacheStats =
              enemySelectorAngerCacheStats;
          }
          const hadDisableEnemySelectorLongTagCache =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableEnemySelectorLongTagCache"
            );
          const previousDisableEnemySelectorLongTagCache =
            sourceControl.disableEnemySelectorLongTagCache;
          const hadDisableEnemySelectorGeneralLongTagCache =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableEnemySelectorGeneralLongTagCache"
            );
          const previousDisableEnemySelectorGeneralLongTagCache =
            sourceControl.disableEnemySelectorGeneralLongTagCache;
          const hadEnemySelectorLongTagCacheStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "enemySelectorLongTagCacheStats"
            );
          const previousEnemySelectorLongTagCacheStats =
            sourceControl.enemySelectorLongTagCacheStats;
          const enemySelectorLongTagCacheStats = ${
            traceEnemySelectorLongTagCache ||
            probeEnemySelectorLongTagHookFallback ||
            probeEnemySelectorLongTagCatalogFallback
              ? `{
                  optimizedCalls: 0,
                  fallbackCalls: 0,
                  cacheBuilds: 0,
                  cacheHits: 0,
                  tagChecksElided: 0,
                  validationFailures: 0,
                  perEnemyFallbacks: 0,
                  querySequences: 0
                }`
              : "null"
          };
          sourceControl.disableEnemySelectorLongTagCache =
            ${disableEnemySelectorLongTagCache};
          sourceControl.disableEnemySelectorGeneralLongTagCache =
            ${disableEnemySelectorGeneralLongTagCache};
          if (enemySelectorLongTagCacheStats !== null) {
            sourceControl.enemySelectorLongTagCacheStats =
              enemySelectorLongTagCacheStats;
          }
          const hadDisableEnemySelectorWeightedQueryCache =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableEnemySelectorWeightedQueryCache"
            );
          const previousDisableEnemySelectorWeightedQueryCache =
            sourceControl.disableEnemySelectorWeightedQueryCache;
          const hadDisableEnemySelectorWeightedSingleTagCache =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableEnemySelectorWeightedSingleTagCache"
            );
          const previousDisableEnemySelectorWeightedSingleTagCache =
            sourceControl.disableEnemySelectorWeightedSingleTagCache;
          const hadDisableEnemySelectorWeightedFilterTagCache =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableEnemySelectorWeightedFilterTagCache"
            );
          const previousDisableEnemySelectorWeightedFilterTagCache =
            sourceControl.disableEnemySelectorWeightedFilterTagCache;
          const hadEnemySelectorWeightedQueryCacheStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "enemySelectorWeightedQueryCacheStats"
            );
          const previousEnemySelectorWeightedQueryCacheStats =
            sourceControl.enemySelectorWeightedQueryCacheStats;
          const enemySelectorWeightedQueryCacheStats = ${
            traceEnemySelectorWeightedQueryCache
              ? `{
                  optimizedCalls: 0,
                  fallbackCalls: 0,
                  cacheBuilds: 0,
                  cacheHits: 0,
                  enemiesElided: 0,
                  validationFailures: 0
                }`
              : "null"
          };
          sourceControl.disableEnemySelectorWeightedQueryCache =
            ${disableEnemySelectorWeightedQueryCache};
          sourceControl.disableEnemySelectorWeightedSingleTagCache =
            ${disableEnemySelectorWeightedSingleTagCache};
          sourceControl.disableEnemySelectorWeightedFilterTagCache =
            ${disableEnemySelectorWeightedFilterTagCache};
          if (enemySelectorWeightedQueryCacheStats !== null) {
            sourceControl.enemySelectorWeightedQueryCacheStats =
              enemySelectorWeightedQueryCacheStats;
          }
          const hadDisableEligibleRestraintEnemyKeys =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableEligibleRestraintEnemyKeys"
            );
          const previousDisableEligibleRestraintEnemyKeys =
            sourceControl.disableEligibleRestraintEnemyKeys;
          const hadDisableEligibleRestraintRetryReuse =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableEligibleRestraintRetryReuse"
            );
          const previousDisableEligibleRestraintRetryReuse =
            sourceControl.disableEligibleRestraintRetryReuse;
          const hadDisableEligibleRestraintTopLevelReuse =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableEligibleRestraintTopLevelReuse"
            );
          const previousDisableEligibleRestraintTopLevelReuse =
            sourceControl.disableEligibleRestraintTopLevelReuse;
          const hadDisableEligibleRestraintMultiEntryReuse =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disableEligibleRestraintMultiEntryReuse"
            );
          const previousDisableEligibleRestraintMultiEntryReuse =
            sourceControl.disableEligibleRestraintMultiEntryReuse;
          const hadEligibleRestraintEnemyKeyStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "eligibleRestraintEnemyKeyStats"
            );
          const previousEligibleRestraintEnemyKeyStats =
            sourceControl.eligibleRestraintEnemyKeyStats;
          const restraintSourceStats = ${
            traceRestraintSource || probeRestraintModFallback
              ? `{
                  restraints: 0,
                  optimizedRestraints: 0,
                  fallbackRestraints: 0
                }`
              : "null"
          };
          sourceControl.disableEligibleRestraintEnemyKeys =
            ${disableRestraintEnemyKeys};
          sourceControl.disableEligibleRestraintRetryReuse =
            ${disableRestraintRetryReuse};
          sourceControl.disableEligibleRestraintTopLevelReuse =
            ${disableRestraintTopLevelReuse};
          sourceControl.disableEligibleRestraintMultiEntryReuse =
            ${disableRestraintMultiEntryReuse};
          if (restraintSourceStats !== null) {
            sourceControl.eligibleRestraintEnemyKeyStats =
              restraintSourceStats;
          }
          const hadDisablePathCacheSingleSlice =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathCacheSingleSlice"
            );
          const previousDisablePathCacheSingleSlice =
            sourceControl.disablePathCacheSingleSlice;
          const hadPathCacheSingleSliceStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathCacheSingleSliceStats"
            );
          const previousPathCacheSingleSliceStats =
            sourceControl.pathCacheSingleSliceStats;
          const pathCacheSourceStats = ${
            tracePathCacheSource
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0
                }`
              : "null"
          };
          sourceControl.disablePathCacheSingleSlice =
            ${disablePathCacheSingleSlice};
          if (pathCacheSourceStats !== null) {
            sourceControl.pathCacheSingleSliceStats =
              pathCacheSourceStats;
          }
          const hadDisablePathCacheHoistedKeySuffix =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathCacheHoistedKeySuffix"
            );
          const previousDisablePathCacheHoistedKeySuffix =
            sourceControl.disablePathCacheHoistedKeySuffix;
          const hadPathCacheHoistedKeySuffixStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathCacheHoistedKeySuffixStats"
            );
          const previousPathCacheHoistedKeySuffixStats =
            sourceControl.pathCacheHoistedKeySuffixStats;
          const pathCacheHoistedKeySuffixStats = ${
            tracePathCacheHoistedKeySuffix
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0
                }`
              : "null"
          };
          sourceControl.disablePathCacheHoistedKeySuffix =
            ${disablePathCacheHoistedKeySuffix};
          if (pathCacheHoistedKeySuffixStats !== null) {
            sourceControl.pathCacheHoistedKeySuffixStats =
              pathCacheHoistedKeySuffixStats;
          }
          const hadPathCacheEdgeIdentitySkipStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathCacheEdgeIdentitySkipStats"
            );
          const previousPathCacheEdgeIdentitySkipStats =
            sourceControl.pathCacheEdgeIdentitySkipStats;
          const pathCacheEdgeIdentitySkipStats = ${
            traceMapGenerationPathCacheEdgeIdentitySkip ||
            probePathCacheCallReuse ||
            probeMapGenerationPathCacheModFallback
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0,
                  skippedEntries: 0,
                  writtenEntries: 0
                }`
              : "null"
          };
          if (pathCacheEdgeIdentitySkipStats !== null) {
            sourceControl.pathCacheEdgeIdentitySkipStats =
              pathCacheEdgeIdentitySkipStats;
          }
          const hadDisablePathCacheKnownTailSkip =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathCacheKnownTailSkip"
            );
          const previousDisablePathCacheKnownTailSkip =
            sourceControl.disablePathCacheKnownTailSkip;
          const hadPathCacheKnownTailStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathCacheKnownTailStats"
            );
          const previousPathCacheKnownTailStats =
            sourceControl.pathCacheKnownTailStats;
          const pathCacheKnownTailStats = ${
            tracePathCacheKnownTail ||
            verifyPathCacheKnownTail ||
            probePathCacheKnownTailWriterFallback
              ? `{
                  verify: ${verifyPathCacheKnownTail},
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0,
                  skippedEntries: 0,
                  verifiedEntries: 0,
                  mismatches: 0,
                  firstMismatch: null
                }`
              : "null"
          };
          sourceControl.disablePathCacheKnownTailSkip =
            ${disablePathCacheKnownTailSkip};
          if (pathCacheKnownTailStats !== null) {
            sourceControl.pathCacheKnownTailStats =
              pathCacheKnownTailStats;
          }
          const hadDisablePathfindingDirectTiles =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathfindingDirectTiles"
            );
          const previousDisablePathfindingDirectTiles =
            sourceControl.disablePathfindingDirectTiles;
          const hadPathfindingDirectTilesStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathfindingDirectTilesStats"
            );
          const previousPathfindingDirectTilesStats =
            sourceControl.pathfindingDirectTilesStats;
          const pathfindingDirectTilesStats = ${
            tracePathfindingDirectTiles || probePathfindingTilesModFallback
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0
                }`
              : "null"
          };
          sourceControl.disablePathfindingDirectTiles =
            ${disablePathfindingDirectTiles};
          if (pathfindingDirectTilesStats !== null) {
            sourceControl.pathfindingDirectTilesStats =
              pathfindingDirectTilesStats;
          }
          const officialTilesGet = globalThis.KinkyDungeonTilesGet;
          const moddedTilesGet = ${
            probePathfindingTilesModFallback ||
            probePathfindingDeferredTileModFallback
              ? `function kdHybridMapgenModdedTilesGet(...args) {
                  return Reflect.apply(officialTilesGet, this, args);
                }`
              : "null"
          };
          if (moddedTilesGet !== null) {
            globalThis.KinkyDungeonTilesGet = moddedTilesGet;
          }
          const hadDisablePathfindingDirectSuccessors =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathfindingDirectSuccessors"
            );
          const previousDisablePathfindingDirectSuccessors =
            sourceControl.disablePathfindingDirectSuccessors;
          const hadPathfindingDirectSuccessorStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathfindingDirectSuccessorStats"
            );
          const previousPathfindingDirectSuccessorStats =
            sourceControl.pathfindingDirectSuccessorStats;
          const pathfindingDirectSuccessorStats = ${
            tracePathfindingDirectSuccessors ||
            probePathfindingSuccessorsModFallback
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0
                }`
              : "null"
          };
          sourceControl.disablePathfindingDirectSuccessors =
            ${disablePathfindingDirectSuccessors};
          if (pathfindingDirectSuccessorStats !== null) {
            sourceControl.pathfindingDirectSuccessorStats =
              pathfindingDirectSuccessorStats;
          }
          const hadDisablePathfindingClosedFirstSuccessors =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathfindingClosedFirstSuccessors"
            );
          const previousDisablePathfindingClosedFirstSuccessors =
            sourceControl.disablePathfindingClosedFirstSuccessors;
          const hadPathfindingClosedFirstSuccessorStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathfindingClosedFirstSuccessorStats"
            );
          const previousPathfindingClosedFirstSuccessorStats =
            sourceControl.pathfindingClosedFirstSuccessorStats;
          const pathfindingClosedFirstSuccessorStats = ${
            tracePathfindingClosedFirstSuccessors
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0
                }`
              : "null"
          };
          sourceControl.disablePathfindingClosedFirstSuccessors =
            ${disablePathfindingClosedFirstSuccessors};
          if (pathfindingClosedFirstSuccessorStats !== null) {
            sourceControl.pathfindingClosedFirstSuccessorStats =
              pathfindingClosedFirstSuccessorStats;
          }
          const hadDisablePathfindingNumericCoordinateKeys =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathfindingNumericCoordinateKeys"
            );
          const previousDisablePathfindingNumericCoordinateKeys =
            sourceControl.disablePathfindingNumericCoordinateKeys;
          const hadPathfindingNumericCoordinateKeyStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathfindingNumericCoordinateKeyStats"
            );
          const previousPathfindingNumericCoordinateKeyStats =
            sourceControl.pathfindingNumericCoordinateKeyStats;
          const pathfindingNumericCoordinateKeyStats = ${
            tracePathfindingNumericCoordinateKeys ||
            verifyPathfindingNumericCoordinateKeys
              ? `{
                  verify: ${verifyPathfindingNumericCoordinateKeys},
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0,
                  keyChecks: 0,
                  collisions: 0,
                  firstCollision: null
                }`
              : "null"
          };
          sourceControl.disablePathfindingNumericCoordinateKeys =
            ${disablePathfindingNumericCoordinateKeys};
          if (pathfindingNumericCoordinateKeyStats !== null) {
            sourceControl.pathfindingNumericCoordinateKeyStats =
              pathfindingNumericCoordinateKeyStats;
          }
          const hadDisablePathfindingTileMembershipTable =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathfindingTileMembershipTable"
            );
          const previousDisablePathfindingTileMembershipTable =
            sourceControl.disablePathfindingTileMembershipTable;
          const hadPathfindingTileMembershipTableStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathfindingTileMembershipTableStats"
            );
          const previousPathfindingTileMembershipTableStats =
            sourceControl.pathfindingTileMembershipTableStats;
          const pathfindingTileMembershipTableStats = ${
            tracePathfindingTileMembershipTable ||
            verifyPathfindingTileMembershipTable ||
            probePathfindingTileMembershipDependencyFallback
              ? `{
                  verify: ${verifyPathfindingTileMembershipTable},
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0,
                  lookups: 0,
                  optimizedLookups: 0,
                  fallbackLookups: 0,
                  verifierChecks: 0,
                  mismatches: 0,
                  firstMismatch: null
                }`
              : "null"
          };
          sourceControl.disablePathfindingTileMembershipTable =
            ${disablePathfindingTileMembershipTable};
          if (pathfindingTileMembershipTableStats !== null) {
            sourceControl.pathfindingTileMembershipTableStats =
              pathfindingTileMembershipTableStats;
          }
          const hadDisablePathfindingNumericContinuationIndex =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathfindingNumericContinuationIndex"
            );
          const previousDisablePathfindingNumericContinuationIndex =
            sourceControl.disablePathfindingNumericContinuationIndex;
          const hadPathfindingNumericContinuationIndexStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathfindingNumericContinuationIndexStats"
            );
          const previousPathfindingNumericContinuationIndexStats =
            sourceControl.pathfindingNumericContinuationIndexStats;
          const pathfindingNumericContinuationIndexStats = ${
            tracePathfindingNumericContinuationIndex ||
            verifyPathfindingNumericContinuationIndex
              ? `{
                  verify: ${verifyPathfindingNumericContinuationIndex},
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0,
                  lookups: 0,
                  hits: 0,
                  misses: 0,
                  verifierChecks: 0,
                  mismatches: 0,
                  firstMismatch: null,
                  writerCalls: 0,
                  optimizedWriterCalls: 0,
                  fallbackWriterCalls: 0,
                  indexedWrites: 0,
                  writerChecks: 0,
                  writerMismatches: 0,
                  firstWriterMismatch: null
                }`
              : "null"
          };
          sourceControl.disablePathfindingNumericContinuationIndex =
            ${disablePathfindingNumericContinuationIndex};
          if (pathfindingNumericContinuationIndexStats !== null) {
            sourceControl.pathfindingNumericContinuationIndexStats =
              pathfindingNumericContinuationIndexStats;
          }
          const officialTileMembershipCharCodeAt =
            String.prototype.charCodeAt;
          let tileMembershipDependencyProbeCalls = 0;
          let tileMembershipDependencyProbeRestored = null;
          const tileMembershipDependencyProbe = ${
            probePathfindingTileMembershipDependencyFallback
              ? `function kdHybridMapgenModdedCharCodeAt(...args) {
                  tileMembershipDependencyProbeCalls += 1;
                  return Reflect.apply(
                    officialTileMembershipCharCodeAt,
                    this,
                    args
                  );
                }`
              : "null"
          };
          if (tileMembershipDependencyProbe !== null) {
            String.prototype.charCodeAt =
              tileMembershipDependencyProbe;
          }
          const officialNumericCoordinateGetPath =
            globalThis.KinkyDungeonGetPath;
          let numericCoordinateGetPathProbeCalls = 0;
          let numericCoordinateGetPathProbeRestored = null;
          const numericCoordinateGetPathProbe = ${
            probePathfindingNumericGetPathFallback
              ? `function kdHybridMapgenModdedGetPath(...args) {
                  numericCoordinateGetPathProbeCalls += 1;
                  return Reflect.apply(
                    officialNumericCoordinateGetPath,
                    this,
                    args
                  );
                }`
              : "null"
          };
          if (numericCoordinateGetPathProbe !== null) {
            globalThis.KinkyDungeonGetPath =
              numericCoordinateGetPathProbe;
          }
          const hadDisablePathfindingTopCacheSingleRead =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathfindingTopCacheSingleRead"
            );
          const previousDisablePathfindingTopCacheSingleRead =
            sourceControl.disablePathfindingTopCacheSingleRead;
          const hadPathfindingTopCacheSingleReadStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathfindingTopCacheSingleReadStats"
            );
          const previousPathfindingTopCacheSingleReadStats =
            sourceControl.pathfindingTopCacheSingleReadStats;
          const pathfindingTopCacheSingleReadStats = ${
            tracePathfindingTopCacheSingleRead ||
            probePathfindingTopCacheModFallback
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0
                }`
              : "null"
          };
          sourceControl.disablePathfindingTopCacheSingleRead =
            ${disablePathfindingTopCacheSingleRead};
          if (pathfindingTopCacheSingleReadStats !== null) {
            sourceControl.pathfindingTopCacheSingleReadStats =
              pathfindingTopCacheSingleReadStats;
          }
          const hadDisablePathfindingDeferredTileMetadata =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathfindingDeferredTileMetadata"
            );
          const previousDisablePathfindingDeferredTileMetadata =
            sourceControl.disablePathfindingDeferredTileMetadata;
          const hadPathfindingDeferredTileMetadataStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathfindingDeferredTileMetadataStats"
            );
          const previousPathfindingDeferredTileMetadataStats =
            sourceControl.pathfindingDeferredTileMetadataStats;
          const pathfindingDeferredTileMetadataStats = ${
            tracePathfindingDeferredTileMetadata ||
            probePathfindingDeferredTileModFallback
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0
                }`
              : "null"
          };
          sourceControl.disablePathfindingDeferredTileMetadata =
            ${disablePathfindingDeferredTileMetadata};
          if (pathfindingDeferredTileMetadataStats !== null) {
            sourceControl.pathfindingDeferredTileMetadataStats =
              pathfindingDeferredTileMetadataStats;
          }
          const hadDisablePathfindingOpenValues =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathfindingOpenValues"
            );
          const previousDisablePathfindingOpenValues =
            sourceControl.disablePathfindingOpenValues;
          const hadPathfindingOpenValuesStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathfindingOpenValuesStats"
            );
          const previousPathfindingOpenValuesStats =
            sourceControl.pathfindingOpenValuesStats;
          const pathfindingOpenValuesStats = ${
            tracePathfindingOpenValues || probePathfindingOpenValuesModFallback
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0
                }`
              : "null"
          };
          sourceControl.disablePathfindingOpenValues =
            ${disablePathfindingOpenValues};
          if (pathfindingOpenValuesStats !== null) {
            sourceControl.pathfindingOpenValuesStats =
              pathfindingOpenValuesStats;
          }
          const hadDisablePathfindingContinuationCacheLookup =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathfindingContinuationCacheLookup"
            );
          const previousDisablePathfindingContinuationCacheLookup =
            sourceControl.disablePathfindingContinuationCacheLookup;
          const hadPathfindingContinuationCacheLookupStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathfindingContinuationCacheLookupStats"
            );
          const previousPathfindingContinuationCacheLookupStats =
            sourceControl.pathfindingContinuationCacheLookupStats;
          const pathfindingContinuationCacheLookupStats = ${
            tracePathfindingContinuationCacheLookup
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0
                }`
              : "null"
          };
          sourceControl.disablePathfindingContinuationCacheLookup =
            ${disablePathfindingContinuationCacheLookup};
          if (pathfindingContinuationCacheLookupStats !== null) {
            sourceControl.pathfindingContinuationCacheLookupStats =
              pathfindingContinuationCacheLookupStats;
          }
          const hadDisablePathfindingHoistedCacheIndex =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "disablePathfindingHoistedCacheIndex"
            );
          const previousDisablePathfindingHoistedCacheIndex =
            sourceControl.disablePathfindingHoistedCacheIndex;
          const hadPathfindingHoistedCacheIndexStats =
            Object.prototype.hasOwnProperty.call(
              sourceControl,
              "pathfindingHoistedCacheIndexStats"
            );
          const previousPathfindingHoistedCacheIndexStats =
            sourceControl.pathfindingHoistedCacheIndexStats;
          const pathfindingHoistedCacheIndexStats = ${
            tracePathfindingHoistedCacheIndex
              ? `{
                  calls: 0,
                  optimizedCalls: 0,
                  fallbackCalls: 0
                }`
              : "null"
          };
          sourceControl.disablePathfindingHoistedCacheIndex =
            ${disablePathfindingHoistedCacheIndex};
          if (pathfindingHoistedCacheIndexStats !== null) {
            sourceControl.pathfindingHoistedCacheIndexStats =
              pathfindingHoistedCacheIndexStats;
          }
          const canonicalMapHas = Map.prototype.has;
          if (${probeRestraintModFallback}) {
            Map.prototype.has = function kdHybridMapgenModHas(key) {
              return Reflect.apply(canonicalMapHas, this, [key]);
            };
          }
          const canonicalMapForEach = Map.prototype.forEach;
          if (${probePathfindingSuccessorsModFallback}) {
            Map.prototype.forEach =
              function kdHybridMapgenModForEach(...args) {
                return Reflect.apply(canonicalMapForEach, this, args);
              };
          }
          const canonicalMapGet = Map.prototype.get;
          if (${probePathfindingTopCacheModFallback}) {
            Map.prototype.get =
              function kdHybridMapgenModGet(...args) {
                return Reflect.apply(canonicalMapGet, this, args);
              };
          }
          const canonicalMapValues = Map.prototype.values;
          if (${probePathfindingOpenValuesModFallback}) {
            Map.prototype.values =
              function kdHybridMapgenModValues(...args) {
                return Reflect.apply(canonicalMapValues, this, args);
              };
          }
          const statsChoiceGetDescriptor =
            Object.getOwnPropertyDescriptor(
              KinkyDungeonStatsChoice,
              "get"
            );
          const statsChoiceGet = KinkyDungeonStatsChoice.get;
          if (${probeEnemySelectorModFallback}) {
            Object.defineProperty(KinkyDungeonStatsChoice, "get", {
              configurable: true,
              writable: true,
              value: function kdHybridMapgenModGet(...args) {
                return Reflect.apply(statsChoiceGet, this, args);
              }
            });
          }
          const officialEnemySelector = globalThis.KinkyDungeonGetEnemy;
          const candidateEnemySelector = ${
            probeEnemySelectorHoists ||
            probeEnemySelectorAngerCache ||
            probeEnemySelectorSingleTagCache ||
            probeEnemySelectorLongTagCache ||
            probeEnemySelectorWeightedQueryCache ||
            probeEnemySelectorWeightedSingleTagCache ||
            probeEnemySelectorWeightedFilterTagCache
              ? `(${createEnemySelectorHoistCandidate.toString()})(
                  officialEnemySelector,
                  enemySelectorStats,
                  ${
                    probeEnemySelectorAngerCache ||
                    probeEnemySelectorSingleTagCache ||
                    probeEnemySelectorLongTagCache ||
                    probeEnemySelectorWeightedQueryCache ||
                    probeEnemySelectorWeightedSingleTagCache ||
                    probeEnemySelectorWeightedFilterTagCache
                  },
                  ${probeEnemySelectorSingleTagCache},
                  ${
                    probeEnemySelectorLongTagCache ||
                    probeEnemySelectorWeightedQueryCache ||
                    probeEnemySelectorWeightedSingleTagCache ||
                    probeEnemySelectorWeightedFilterTagCache
                  },
                  ${
                    probeEnemySelectorWeightedQueryCache ||
                    probeEnemySelectorWeightedSingleTagCache ||
                    probeEnemySelectorWeightedFilterTagCache
                  },
                  ${
                    probeEnemySelectorWeightedSingleTagCache ||
                    probeEnemySelectorWeightedFilterTagCache
                  },
                  ${probeEnemySelectorWeightedFilterTagCache},
                  ${restrictProbeEnemySelectorLongTagCache}
                )`
              : "null"
          };
          if (
            candidateEnemySelector !== null &&
            typeof officialEnemySelector !== "function"
          ) {
            throw new Error("KinkyDungeonGetEnemy is unavailable");
          }
          if (candidateEnemySelector !== null) {
            globalThis.KinkyDungeonGetEnemy = candidateEnemySelector;
          }
          let enemySelectorAngerCatalogProbe = null;
          let enemySelectorAngerCatalogRestore = null;
          if (${probeEnemySelectorAngerCatalogFallback}) {
            const angerTags = [
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
              "willRage"
            ];
            for (
              let enemyIndex = 0;
              enemyIndex < KinkyDungeonEnemies.length &&
                enemySelectorAngerCatalogRestore === null;
              enemyIndex += 1
            ) {
              const tags = KinkyDungeonEnemies[enemyIndex]?.tags;
              for (const tag of angerTags) {
                const descriptor = Object.getOwnPropertyDescriptor(tags, tag);
                if (
                  descriptor !== undefined &&
                  "value" in descriptor &&
                  descriptor.value &&
                  descriptor.configurable
                ) {
                  const preservedValue = descriptor.value;
                  Object.defineProperty(tags, tag, {
                    configurable: descriptor.configurable,
                    enumerable: descriptor.enumerable,
                    get: () => preservedValue
                  });
                  enemySelectorAngerCatalogRestore = {
                    tags,
                    tag,
                    descriptor
                  };
                  enemySelectorAngerCatalogProbe = {
                    enemyIndex,
                    tag,
                    restored: false
                  };
                  break;
                }
              }
            }
            if (enemySelectorAngerCatalogRestore === null) {
              throw new Error(
                "No configurable canonical anger-tag property was available"
              );
            }
          }
          let enemySelectorLongTagCatalogProbe = null;
          let enemySelectorLongTagCatalogRestore = null;
          if (${probeEnemySelectorLongTagCatalogFallback}) {
            for (
              let enemyIndex = 0;
              enemyIndex < KinkyDungeonEnemies.length &&
                enemySelectorLongTagCatalogRestore === null;
              enemyIndex += 1
            ) {
              const tags = KinkyDungeonEnemies[enemyIndex]?.tags;
              if (
                (typeof tags !== "object" && typeof tags !== "function") ||
                tags === null ||
                !Object.isExtensible(tags)
              ) {
                continue;
              }
              const tag = "EnemyEnemy";
              const descriptor = Object.getOwnPropertyDescriptor(tags, tag);
              if (descriptor === undefined) {
                Object.defineProperty(tags, tag, {
                  configurable: true,
                  enumerable: true,
                  get: () => undefined
                });
                enemySelectorLongTagCatalogRestore = {
                  tags,
                  tag,
                  descriptor
                };
                enemySelectorLongTagCatalogProbe = {
                  enemyIndex,
                  tag,
                  restored: false
                };
              }
            }
            if (enemySelectorLongTagCatalogRestore === null) {
              throw new Error(
                "No extensible canonical enemy-tag object was available"
              );
            }
          }
          const officialGetAccessible =
            globalThis.KinkyDungeonGetAccessible;
          const officialGetAccessibleRoom =
            globalThis.KinkyDungeonGetAccessibleRoom;
          const candidateGetAccessible = ${
            probeAccessibleFrontierSingleRead
              ? `(${createAccessibleFrontierSingleReadCandidate.toString()})(
                  officialGetAccessible,
                  accessibleFrontierStats,
                  "accessibleCalls"
                )`
              : probeAccessibleNeighborSingleRead
                ? `(${createAccessibleNeighborSingleReadCandidate.toString()})(
                    officialGetAccessible,
                    accessibleNeighborStats,
                    "accessibleCalls",
                    false
                  )`
                : probeAccessibleQueue
                  ? `(${createAccessibleQueueCandidate.toString()})(
                      officialGetAccessible,
                      accessibleQueueStats,
                      "accessibleCalls",
                      false,
                      ${verifyAccessibleQueue},
                      ${probeAccessibleNumericState}
                    )`
                  : "null"
          };
          const candidateGetAccessibleRoom = ${
            probeAccessibleFrontierSingleRead
              ? `(${createAccessibleFrontierSingleReadCandidate.toString()})(
                  officialGetAccessibleRoom,
                  accessibleFrontierStats,
                  "roomCalls"
                )`
              : probeAccessibleNeighborSingleRead
                ? `(${createAccessibleNeighborSingleReadCandidate.toString()})(
                    officialGetAccessibleRoom,
                    accessibleNeighborStats,
                    "roomCalls",
                    true
                  )`
                : probeAccessibleQueue
                  ? `(${createAccessibleQueueCandidate.toString()})(
                      officialGetAccessibleRoom,
                      accessibleQueueStats,
                      "roomCalls",
                      true,
                      ${verifyAccessibleQueue},
                      ${probeAccessibleNumericState}
                    )`
                  : "null"
          };
          if (
            candidateGetAccessible !== null &&
            (typeof officialGetAccessible !== "function" ||
              typeof officialGetAccessibleRoom !== "function")
          ) {
            throw new Error("KD accessibility functions are unavailable");
          }
          if (candidateGetAccessible !== null) {
            globalThis.KinkyDungeonGetAccessible =
              candidateGetAccessible;
            globalThis.KinkyDungeonGetAccessibleRoom =
              candidateGetAccessibleRoom;
          }
          const officialPlaceDoors = globalThis.KinkyDungeonPlaceDoors;
          const placeDoorsAccessibleReuseStats = ${
            probePlaceDoorsAccessibleReuse
              ? `{
                  calls: 0,
                  roomCalls: 0,
                  cacheHits: 0,
                  officialCalls: 0,
                  comparedCalls: 0,
                  mismatches: 0,
                  firstMismatch: null,
                  restored: false
                }`
              : "null"
          };
          const candidatePlaceDoors = ${
            probePlaceDoorsAccessibleReuse
              ? `(${createPlaceDoorsAccessibleReuseCandidate.toString()})(
                  officialPlaceDoors,
                  officialGetAccessibleRoom,
                  placeDoorsAccessibleReuseStats,
                  ${verifyPlaceDoorsAccessibleReuse}
                )`
              : "null"
          };
          if (
            candidatePlaceDoors !== null &&
            (typeof officialPlaceDoors !== "function" ||
              typeof officialGetAccessibleRoom !== "function")
          ) {
            throw new Error(
              "KD door placement or room accessibility is unavailable"
            );
          }
          if (candidatePlaceDoors !== null) {
            globalThis.KinkyDungeonPlaceDoors = candidatePlaceDoors;
          }
          const officialMapTileFilling =
            globalThis.KDCheckMapTileFilling;
          const officialMapTileFillingCoordinateReuse =
            globalThis.KDHybridCheckMapTileFillingCoordinateReuse;
          const mapTileFillingCoordinateReuseSourceEquivalenceProbe = ${
            probeMapTileFillingCoordinateReuseSourceEquivalence
              ? `{
                  calls: 0,
                  mismatches: 0,
                  firstMismatch: null,
                  restored: false
                }`
              : "null"
          };
          const candidateMapTileFillingCoordinateReuse = ${
            probeMapTileFillingCoordinateReuseSourceEquivalence
              ? `function KDHybridCheckMapTileFillingCoordinateReuseOracle(
                  ...args
                ) {
                  const actual = Reflect.apply(
                    officialMapTileFillingCoordinateReuse,
                    this,
                    args
                  );
                  const expected = Reflect.apply(
                    officialMapTileFilling,
                    this,
                    args.slice(0, 6)
                  );
                  mapTileFillingCoordinateReuseSourceEquivalenceProbe.calls += 1;
                  if (!Object.is(actual, expected)) {
                    mapTileFillingCoordinateReuseSourceEquivalenceProbe.mismatches += 1;
                    if (
                      mapTileFillingCoordinateReuseSourceEquivalenceProbe
                        .firstMismatch === null
                    ) {
                      mapTileFillingCoordinateReuseSourceEquivalenceProbe
                        .firstMismatch = {
                          mapTile: args[0]?.name ?? null,
                          indX: args[1],
                          indY: args[2],
                          expected,
                          actual
                        };
                    }
                  }
                  return actual;
                }`
              : "null"
          };
          if (
            candidateMapTileFillingCoordinateReuse !== null &&
            typeof officialMapTileFillingCoordinateReuse !== "function"
          ) {
            throw new Error(
              "KD Hybrid map-tile filling source helper is unavailable"
            );
          }
          if (candidateMapTileFillingCoordinateReuse !== null) {
            globalThis.KDHybridCheckMapTileFillingCoordinateReuse =
              candidateMapTileFillingCoordinateReuse;
          }
          const mapTileFillingCoordinateReuseStats = ${
            probeMapTileFillingCoordinateReuse
              ? `{
                  calls: 0,
                  comparedCalls: 0,
                  mismatches: 0,
                  firstMismatch: null,
                  restored: false
                }`
              : "null"
          };
          const candidateMapTileFilling = ${
            probeMapTileFillingCoordinateReuse
              ? `(${createMapTileFillingCoordinateReuseCandidate.toString()})(
                  officialMapTileFilling,
                  mapTileFillingCoordinateReuseStats,
                  ${verifyMapTileFillingCoordinateReuse}
                )`
              : "null"
          };
          if (
            candidateMapTileFilling !== null &&
            typeof officialMapTileFilling !== "function"
          ) {
            throw new Error("KD map-tile filling helper is unavailable");
          }
          if (candidateMapTileFilling !== null) {
            globalThis.KDCheckMapTileFilling =
              candidateMapTileFilling;
          }
          const officialPasteTile = globalThis.KD_PasteTile;
          const pasteTileSerializedCacheStats = ${
            probePasteTileSerializedCache
              ? `{
                  calls: 0,
                  cacheHits: 0,
                  cacheMisses: 0,
                  verifiedHits: 0,
                  mismatches: 0,
                  firstMismatch: null,
                  restored: false
                }`
              : "null"
          };
          const candidatePasteTile = ${
            probePasteTileSerializedCache
              ? `(${createPasteTileSerializedCacheCandidate.toString()})(
                  officialPasteTile,
                  pasteTileSerializedCacheStats,
                  ${verifyPasteTileSerializedCache}
                )`
              : "null"
          };
          if (
            candidatePasteTile !== null &&
            typeof officialPasteTile !== "function"
          ) {
            throw new Error("KD_PasteTile is unavailable");
          }
          if (candidatePasteTile !== null) {
            globalThis.KD_PasteTile = candidatePasteTile;
          }
          const officialRestraintsEligible =
            globalThis.KDGetRestraintsEligible;
          const rawCandidateRestraintsEligible = ${
            probeRestraintTagKeys
              ? `(${createRestraintTagKeysCandidate.toString()})(
                  officialRestraintsEligible,
                  restraintEligibleStats
                )`
              : probeRestraintEnemyKeys || probeRestraintEquivalence
                ? `(${createRestraintEnemyKeysCandidate.toString()})(
                    officialRestraintsEligible,
                    restraintEligibleStats
                  )`
                : probeRestraintCatalogFastPathCeiling
                  ? `(${createRestraintCatalogFastPathCeilingCandidate.toString()})(
                    officialRestraintsEligible,
                    restraintEligibleStats
                  )`
                  : probeRestraintRecursion
                    ? `(${createRestraintRecursionProbe.toString()})(
                      officialRestraintsEligible,
                      restraintEligibleStats
                    )`
                    : verifyRestraintRetryReuse
                      ? `(${createRestraintRetryReuseEquivalenceProbe.toString()})(
                        officialRestraintsEligible,
                        restraintEligibleStats,
                        sourceControl
                      )`
                      : "null"
          };
          const candidateRestraintsEligible = ${
            probeRestraintEquivalence
              ? `(${createRestraintEquivalenceCandidate.toString()})(
                  officialRestraintsEligible,
                  rawCandidateRestraintsEligible,
                  restraintEligibleStats
                )`
              : "rawCandidateRestraintsEligible"
          };
          if (
            candidateRestraintsEligible !== null &&
            typeof officialRestraintsEligible !== "function"
          ) {
            throw new Error("KDGetRestraintsEligible is unavailable");
          }
          if (candidateRestraintsEligible !== null) {
            globalThis.KDGetRestraintsEligible =
              candidateRestraintsEligible;
          }
          const officialSetPathfindCache =
            globalThis.KDSetPathfindCache;
          const pathCacheKnownTailWriterProbe = ${
            probePathCacheKnownTailWriterFallback
              ? `{
                  calls: 0,
                  restored: false
                }`
              : "null"
          };
          const pathCacheKnownTailWriterWrapper = ${
            probePathCacheKnownTailWriterFallback
              ? `function kdHybridPathCacheKnownTailWriterWrapper(...args) {
                  pathCacheKnownTailWriterProbe.calls += 1;
                  return Reflect.apply(
                    officialSetPathfindCache,
                    this,
                    args
                  );
                }`
              : "null"
          };
          const pathCacheModFallbackProbe = ${
            probePathCacheModFallback
              ? `(${runPathCacheModFallbackProbe.toString()})(
                  officialSetPathfindCache,
                  sourceControl
                )`
              : "null"
          };
          const rawCandidateSetPathfindCache = ${
            probePathCacheKnownTailWriterFallback
              ? "pathCacheKnownTailWriterWrapper"
              : probePathCacheCallReuse
                ? `(${createPathCacheCallReuseProbe.toString()})(
                  officialSetPathfindCache,
                  pathCacheStats,
                  pathCacheEdgeIdentitySkipStats
                )`
                : probePathCachePrefixLimit > 0
                  ? `(${createPathCachePrefixLimitCandidate.toString()})(
                  ${probePathCachePrefixLimit},
                  pathCacheStats
                )`
                  : probePathCacheHitDistribution
                    ? `(${createPathCacheHitDistributionProbe.toString()})(
                  officialSetPathfindCache,
                  pathCacheStats
                )`
                    : probePathCacheNoWrite
                      ? `(${createPathCacheNoWriteCandidate.toString()})(
                  pathCacheStats
                )`
                      : probePathCacheSkipIdenticalExisting
                        ? `(${createPathCacheSkipIdenticalExistingCandidate.toString()})(
                  null
                )`
                        : probePathCacheEdgeIdentitySkip
                          ? `(${createPathCacheEdgeIdentitySkipCandidate.toString()})(
                  null
                )`
                          : probePathCacheSingleSlice ||
                              probePathCacheEquivalence
                            ? `(${createPathCacheSingleSliceCandidate.toString()})(
                    ${probePathCacheEquivalence ? "pathCacheStats" : "null"}
                  )`
                            : "null"
          };
          const candidateSetPathfindCache = ${
            probePathCacheEdgeIdentityEquivalence
              ? `(${createPathCacheEdgeIdentityEquivalenceProbe.toString()})(
                  officialSetPathfindCache,
                  pathCacheStats
                )`
              : probePathCacheSkipExistingEquivalence
                ? `(${createPathCacheSkipExistingEquivalenceProbe.toString()})(
                  officialSetPathfindCache,
                  pathCacheStats
                )`
                : probePathCacheEquivalence
                  ? `(${createPathCacheEquivalenceCandidate.toString()})(
                  officialSetPathfindCache,
                  rawCandidateSetPathfindCache,
                  pathCacheStats
                )`
                  : "rawCandidateSetPathfindCache"
          };
          if (
            candidateSetPathfindCache !== null &&
            typeof officialSetPathfindCache !== "function"
          ) {
            throw new Error("KDSetPathfindCache is unavailable");
          }
          if (candidateSetPathfindCache !== null) {
            globalThis.KDSetPathfindCache = candidateSetPathfindCache;
          }
          let mapGenerationPathfindingHookCalls = 0;
          let mapGenerationPathfindingHookRemoved = null;
          const mapGenerationPathfindingHookId = ${
            probeMapGenerationPathfindingHookFallback
              ? `KDHybrid.registerHook(
                  "pathfinding",
                  "before",
                  () => {
                    mapGenerationPathfindingHookCalls += 1;
                  }
                )`
              : "null"
          };
          let enemySelectorAngerHookCalls = 0;
          let enemySelectorAngerHookRemoved = null;
          const enemySelectorAngerHookId = ${
            probeEnemySelectorAngerHookFallback
              ? `KDHybrid.registerHook(
                  "mapGeneration",
                  "before",
                  () => {
                    enemySelectorAngerHookCalls += 1;
                  }
                )`
              : "null"
          };
          let enemySelectorLongTagHookCalls = 0;
          let enemySelectorLongTagHookRemoved = null;
          const enemySelectorLongTagHookId = ${
            probeEnemySelectorLongTagHookFallback
              ? `KDHybrid.registerHook(
                  "mapGeneration",
                  "before",
                  () => {
                    enemySelectorLongTagHookCalls += 1;
                  }
                )`
              : "null"
          };
          const originalLog = console.log;
          console.log = () => {};
          const mapGenerationPathCacheModProbe = ${
            probeMapGenerationPathCacheModFallback
              ? `{
                  initialLength: null,
                  activeLength: null,
                  restored: false
                }`
              : "null"
          };
          let mapGenerationPathCacheModFiles = null;
          let mapGenerationPathCacheModFilesSnapshot = null;
          try {
            if (mapGenerationPathCacheModProbe !== null) {
              if (!Array.isArray(KDAllModFiles)) {
                throw new TypeError("KDAllModFiles is not an array");
              }
              mapGenerationPathCacheModFiles = KDAllModFiles;
              mapGenerationPathCacheModFilesSnapshot =
                KDAllModFiles.slice();
              mapGenerationPathCacheModProbe.initialLength =
                KDAllModFiles.length;
              KDAllModFiles.push({
                filename: "__kd_hybrid_path_cache_probe__.js"
              });
              mapGenerationPathCacheModProbe.activeLength =
                KDAllModFiles.length;
            }
            for (let localIndex = 0; localIndex < ${mapCount}; localIndex += 1) {
              const index = ${startIndex} + localIndex;
              const checkpoint = checkpoints[index % checkpoints.length];
              const floor =
                floorBands[Math.floor(index / checkpoints.length) % floorBands.length];
              MiniGameKinkyDungeonCheckpoint = checkpoint;
              KDSetWorldSlot(0, floor, 0, 0);
              const seed =
                "kd-hybrid-mapgen-5.4.92-" +
                  checkpoint +
                  "-" +
                  floor +
                  "-" +
                  index;
              KDsetSeed(seed);
              const params =
                KinkyDungeonMapParams[
                  KinkyDungeonMapIndex[checkpoint] || checkpoint
                ];
              if (!params) {
                throw new Error("Missing map parameters for " + checkpoint);
              }
              if (${
                probeEnemySelectorWeightedQueryCache ||
                probeEnemySelectorWeightedSingleTagCache ||
                probeEnemySelectorWeightedFilterTagCache
              }) {
                enemySelectorStats.weightedQueryEpoch += 1;
              }
              const started = performance.now();
              KinkyDungeonCreateMap(
                params,
                "",
                "",
                floor,
                false,
                true,
                undefined,
                { x: 0, y: floor },
                false
              );
              const elapsedMilliseconds = performance.now() - started;
              const accessible = KinkyDungeonIsAccessible(
                KDMapData.StartPosition.x,
                KDMapData.StartPosition.y
              );
              const stateText = JSON.stringify({
                checkpoint,
                floor,
                grid: KDMapData.Grid,
                start: KDMapData.StartPosition,
                end: KDMapData.EndPosition,
                entities: KDMapData.Entities.map((enemy) => [
                  enemy.Enemy?.name ?? enemy.Enemy,
                  enemy.x,
                  enemy.y
                ]),
                groundItems: KDMapData.GroundItems.map((item) => [
                  item.name,
                  item.x,
                  item.y
                ])
              });
              const stateBytes = new TextEncoder().encode(stateText);
              const contentDigest = new Uint8Array(
                await crypto.subtle.digest("SHA-256", stateBytes)
              );
              const contentSha256 = Array.from(
                contentDigest,
                (byte) => byte.toString(16).padStart(2, "0")
              ).join("");
              let signature = 0x811c9dc5;
              for (
                let characterIndex = 0;
                characterIndex < stateText.length;
                characterIndex += 1
              ) {
                signature ^= stateText.charCodeAt(characterIndex);
                signature = Math.imul(signature, 0x01000193);
              }
              results.push({
                index,
                checkpoint,
                floor,
                seed,
                elapsedMilliseconds,
                accessible,
                width: KDMapData.GridWidth,
                height: KDMapData.GridHeight,
                entities: KDMapData.Entities.length,
                groundItems: KDMapData.GroundItems.length,
                contentBytes: stateBytes.byteLength,
                contentSha256,
                signature: (signature >>> 0).toString(16).padStart(8, "0")
              });
            }
            pathCacheCountersAfter = readPathCacheCounters();
          } finally {
            if (${probeAccessibleQueueSourceModFallback}) {
              Object.entries = canonicalAccessibleQueueObjectEntries;
              accessibleQueueModFallbackRestored =
                Object.entries === canonicalAccessibleQueueObjectEntries;
            }
            if (hadDisableAccessibleQueue) {
              sourceControl.disableAccessibleQueue =
                previousDisableAccessibleQueue;
            } else {
              delete sourceControl.disableAccessibleQueue;
            }
            if (hadDisableAccessibleNumericState) {
              sourceControl.disableAccessibleNumericState =
                previousDisableAccessibleNumericState;
            } else {
              delete sourceControl.disableAccessibleNumericState;
            }
            if (accessibleQueueSourceStats !== null) {
              if (hadAccessibleQueueStats) {
                sourceControl.accessibleQueueStats =
                  previousAccessibleQueueStats;
              } else {
                delete sourceControl.accessibleQueueStats;
              }
            }
            if (hadDisablePlaceDoorsAccessibleReuse) {
              sourceControl.disablePlaceDoorsAccessibleReuse =
                previousDisablePlaceDoorsAccessibleReuse;
            } else {
              delete sourceControl.disablePlaceDoorsAccessibleReuse;
            }
            if (placeDoorsAccessibleReuseSourceStats !== null) {
              if (hadPlaceDoorsAccessibleReuseStats) {
                sourceControl.placeDoorsAccessibleReuseStats =
                  previousPlaceDoorsAccessibleReuseStats;
              } else {
                delete sourceControl.placeDoorsAccessibleReuseStats;
              }
            }
            if (hadDisableMapTileFillingCoordinateReuse) {
              sourceControl.disableMapTileFillingCoordinateReuse =
                previousDisableMapTileFillingCoordinateReuse;
            } else {
              delete sourceControl.disableMapTileFillingCoordinateReuse;
            }
            if (mapTileFillingCoordinateReuseSourceStats !== null) {
              if (hadMapTileFillingCoordinateReuseStats) {
                sourceControl.mapTileFillingCoordinateReuseStats =
                  previousMapTileFillingCoordinateReuseStats;
              } else {
                delete sourceControl.mapTileFillingCoordinateReuseStats;
              }
            }
            if (hadDisablePasteTileSerializedCache) {
              sourceControl.disablePasteTileSerializedCache =
                previousDisablePasteTileSerializedCache;
            } else {
              delete sourceControl.disablePasteTileSerializedCache;
            }
            if (hadVerifyPasteTileSerializedCache) {
              sourceControl.verifyPasteTileSerializedCache =
                previousVerifyPasteTileSerializedCache;
            } else {
              delete sourceControl.verifyPasteTileSerializedCache;
            }
            if (pasteTileSerializedCacheSourceStats !== null) {
              if (hadPasteTileSerializedCacheStats) {
                sourceControl.pasteTileSerializedCacheStats =
                  previousPasteTileSerializedCacheStats;
              } else {
                delete sourceControl.pasteTileSerializedCacheStats;
              }
            }
            if (mapGenerationPathCacheModFiles !== null) {
              try {
                KDAllModFiles = mapGenerationPathCacheModFiles;
                KDAllModFiles.length = 0;
                for (const file of mapGenerationPathCacheModFilesSnapshot) {
                  KDAllModFiles.push(file);
                }
                mapGenerationPathCacheModProbe.restored =
                  KDAllModFiles === mapGenerationPathCacheModFiles &&
                  KDAllModFiles.length ===
                    mapGenerationPathCacheModFilesSnapshot.length &&
                  KDAllModFiles.every(
                    (file, index) =>
                      file === mapGenerationPathCacheModFilesSnapshot[index]
                  );
              } catch {
                mapGenerationPathCacheModProbe.restored = false;
              }
            }
            if (enemySelectorAngerCatalogRestore !== null) {
              try {
                Object.defineProperty(
                  enemySelectorAngerCatalogRestore.tags,
                  enemySelectorAngerCatalogRestore.tag,
                  enemySelectorAngerCatalogRestore.descriptor
                );
                const restoredDescriptor = Object.getOwnPropertyDescriptor(
                  enemySelectorAngerCatalogRestore.tags,
                  enemySelectorAngerCatalogRestore.tag
                );
                enemySelectorAngerCatalogProbe.restored =
                  restoredDescriptor?.value ===
                    enemySelectorAngerCatalogRestore.descriptor.value &&
                  restoredDescriptor?.configurable ===
                    enemySelectorAngerCatalogRestore.descriptor.configurable &&
                  restoredDescriptor?.enumerable ===
                    enemySelectorAngerCatalogRestore.descriptor.enumerable &&
                  restoredDescriptor?.writable ===
                    enemySelectorAngerCatalogRestore.descriptor.writable;
              } catch {
                enemySelectorAngerCatalogProbe.restored = false;
              }
            }
            if (enemySelectorLongTagCatalogRestore !== null) {
              try {
                if (
                  enemySelectorLongTagCatalogRestore.descriptor === undefined
                ) {
                  delete enemySelectorLongTagCatalogRestore.tags[
                    enemySelectorLongTagCatalogRestore.tag
                  ];
                } else {
                  Object.defineProperty(
                    enemySelectorLongTagCatalogRestore.tags,
                    enemySelectorLongTagCatalogRestore.tag,
                    enemySelectorLongTagCatalogRestore.descriptor
                  );
                }
                const restoredDescriptor = Object.getOwnPropertyDescriptor(
                  enemySelectorLongTagCatalogRestore.tags,
                  enemySelectorLongTagCatalogRestore.tag
                );
                enemySelectorLongTagCatalogProbe.restored =
                  restoredDescriptor ===
                  enemySelectorLongTagCatalogRestore.descriptor;
              } catch {
                enemySelectorLongTagCatalogProbe.restored = false;
              }
            }
            if (
              candidateEnemySelector !== null &&
              globalThis.KinkyDungeonGetEnemy === candidateEnemySelector
            ) {
              globalThis.KinkyDungeonGetEnemy = officialEnemySelector;
            }
            if (
              candidateRestraintsEligible !== null &&
              globalThis.KDGetRestraintsEligible ===
                candidateRestraintsEligible
            ) {
              globalThis.KDGetRestraintsEligible =
                officialRestraintsEligible;
            }
            if (
              candidatePlaceDoors !== null &&
              globalThis.KinkyDungeonPlaceDoors === candidatePlaceDoors
            ) {
              globalThis.KinkyDungeonPlaceDoors = officialPlaceDoors;
            }
            if (placeDoorsAccessibleReuseStats !== null) {
              placeDoorsAccessibleReuseStats.restored =
                globalThis.KinkyDungeonPlaceDoors === officialPlaceDoors &&
                globalThis.KinkyDungeonGetAccessibleRoom ===
                  officialGetAccessibleRoom;
            }
            if (
              candidateMapTileFilling !== null &&
              globalThis.KDCheckMapTileFilling ===
                candidateMapTileFilling
            ) {
              globalThis.KDCheckMapTileFilling =
                officialMapTileFilling;
            }
            if (mapTileFillingCoordinateReuseStats !== null) {
              mapTileFillingCoordinateReuseStats.restored =
                globalThis.KDCheckMapTileFilling ===
                officialMapTileFilling;
            }
            if (
              candidateMapTileFillingCoordinateReuse !== null &&
              globalThis.KDHybridCheckMapTileFillingCoordinateReuse ===
                candidateMapTileFillingCoordinateReuse
            ) {
              globalThis.KDHybridCheckMapTileFillingCoordinateReuse =
                officialMapTileFillingCoordinateReuse;
            }
            if (
              mapTileFillingCoordinateReuseSourceEquivalenceProbe !== null
            ) {
              mapTileFillingCoordinateReuseSourceEquivalenceProbe.restored =
                globalThis.KDHybridCheckMapTileFillingCoordinateReuse ===
                officialMapTileFillingCoordinateReuse;
            }
            if (
              candidatePasteTile !== null &&
              globalThis.KD_PasteTile === candidatePasteTile
            ) {
              globalThis.KD_PasteTile = officialPasteTile;
            }
            if (pasteTileSerializedCacheStats !== null) {
              pasteTileSerializedCacheStats.restored =
                globalThis.KD_PasteTile === officialPasteTile;
            }
            if (
              candidateGetAccessible !== null &&
              globalThis.KinkyDungeonGetAccessible ===
                candidateGetAccessible
            ) {
              globalThis.KinkyDungeonGetAccessible =
                officialGetAccessible;
            }
            if (
              candidateGetAccessibleRoom !== null &&
              globalThis.KinkyDungeonGetAccessibleRoom ===
                candidateGetAccessibleRoom
            ) {
              globalThis.KinkyDungeonGetAccessibleRoom =
                officialGetAccessibleRoom;
            }
            if (
              candidateSetPathfindCache !== null &&
              globalThis.KDSetPathfindCache === candidateSetPathfindCache
            ) {
              globalThis.KDSetPathfindCache =
                officialSetPathfindCache;
            }
            if (typeof candidateSetPathfindCache?.restore === "function") {
              candidateSetPathfindCache.restore();
            }
            if (pathCacheKnownTailWriterProbe !== null) {
              pathCacheKnownTailWriterProbe.restored =
                globalThis.KDSetPathfindCache ===
                officialSetPathfindCache;
            }
            if (
              moddedTilesGet !== null &&
              globalThis.KinkyDungeonTilesGet === moddedTilesGet
            ) {
              globalThis.KinkyDungeonTilesGet = officialTilesGet;
            }
            if (mapGenerationPathfindingHookId !== null) {
              mapGenerationPathfindingHookRemoved =
                KDHybrid.unregisterHook(mapGenerationPathfindingHookId);
            }
            if (enemySelectorAngerHookId !== null) {
              enemySelectorAngerHookRemoved =
                KDHybrid.unregisterHook(enemySelectorAngerHookId);
            }
            if (enemySelectorLongTagHookId !== null) {
              enemySelectorLongTagHookRemoved =
                KDHybrid.unregisterHook(enemySelectorLongTagHookId);
            }
            if (hadDisableEnemySelectorHoists) {
              sourceControl.disableEnemySelectorHoists =
                previousDisableEnemySelectorHoists;
            } else {
              delete sourceControl.disableEnemySelectorHoists;
            }
            if (hadDisableEnemySelectorAngerCache) {
              sourceControl.disableEnemySelectorAngerCache =
                previousDisableEnemySelectorAngerCache;
            } else {
              delete sourceControl.disableEnemySelectorAngerCache;
            }
            if (enemySelectorAngerCacheStats !== null) {
              if (hadEnemySelectorAngerCacheStats) {
                sourceControl.enemySelectorAngerCacheStats =
                  previousEnemySelectorAngerCacheStats;
              } else {
                delete sourceControl.enemySelectorAngerCacheStats;
              }
            }
            if (hadDisableEnemySelectorLongTagCache) {
              sourceControl.disableEnemySelectorLongTagCache =
                previousDisableEnemySelectorLongTagCache;
            } else {
              delete sourceControl.disableEnemySelectorLongTagCache;
            }
            if (hadDisableEnemySelectorGeneralLongTagCache) {
              sourceControl.disableEnemySelectorGeneralLongTagCache =
                previousDisableEnemySelectorGeneralLongTagCache;
            } else {
              delete sourceControl.disableEnemySelectorGeneralLongTagCache;
            }
            if (enemySelectorLongTagCacheStats !== null) {
              if (hadEnemySelectorLongTagCacheStats) {
                sourceControl.enemySelectorLongTagCacheStats =
                  previousEnemySelectorLongTagCacheStats;
              } else {
                delete sourceControl.enemySelectorLongTagCacheStats;
              }
            }
            if (hadDisableEnemySelectorWeightedQueryCache) {
              sourceControl.disableEnemySelectorWeightedQueryCache =
                previousDisableEnemySelectorWeightedQueryCache;
            } else {
              delete sourceControl.disableEnemySelectorWeightedQueryCache;
            }
            if (hadDisableEnemySelectorWeightedSingleTagCache) {
              sourceControl.disableEnemySelectorWeightedSingleTagCache =
                previousDisableEnemySelectorWeightedSingleTagCache;
            } else {
              delete sourceControl.disableEnemySelectorWeightedSingleTagCache;
            }
            if (hadDisableEnemySelectorWeightedFilterTagCache) {
              sourceControl.disableEnemySelectorWeightedFilterTagCache =
                previousDisableEnemySelectorWeightedFilterTagCache;
            } else {
              delete sourceControl.disableEnemySelectorWeightedFilterTagCache;
            }
            if (enemySelectorWeightedQueryCacheStats !== null) {
              if (hadEnemySelectorWeightedQueryCacheStats) {
                sourceControl.enemySelectorWeightedQueryCacheStats =
                  previousEnemySelectorWeightedQueryCacheStats;
              } else {
                delete sourceControl.enemySelectorWeightedQueryCacheStats;
              }
            }
            if (hadDisableEligibleRestraintEnemyKeys) {
              sourceControl.disableEligibleRestraintEnemyKeys =
                previousDisableEligibleRestraintEnemyKeys;
            } else {
              delete sourceControl.disableEligibleRestraintEnemyKeys;
            }
            if (hadDisableEligibleRestraintRetryReuse) {
              sourceControl.disableEligibleRestraintRetryReuse =
                previousDisableEligibleRestraintRetryReuse;
            } else {
              delete sourceControl.disableEligibleRestraintRetryReuse;
            }
            if (hadDisableEligibleRestraintTopLevelReuse) {
              sourceControl.disableEligibleRestraintTopLevelReuse =
                previousDisableEligibleRestraintTopLevelReuse;
            } else {
              delete sourceControl.disableEligibleRestraintTopLevelReuse;
            }
            if (hadDisableEligibleRestraintMultiEntryReuse) {
              sourceControl.disableEligibleRestraintMultiEntryReuse =
                previousDisableEligibleRestraintMultiEntryReuse;
            } else {
              delete sourceControl.disableEligibleRestraintMultiEntryReuse;
            }
            if (restraintSourceStats !== null) {
              if (hadEligibleRestraintEnemyKeyStats) {
                sourceControl.eligibleRestraintEnemyKeyStats =
                  previousEligibleRestraintEnemyKeyStats;
              } else {
                delete sourceControl.eligibleRestraintEnemyKeyStats;
              }
            }
            if (hadDisablePathCacheSingleSlice) {
              sourceControl.disablePathCacheSingleSlice =
                previousDisablePathCacheSingleSlice;
            } else {
              delete sourceControl.disablePathCacheSingleSlice;
            }
            if (pathCacheSourceStats !== null) {
              if (hadPathCacheSingleSliceStats) {
                sourceControl.pathCacheSingleSliceStats =
                  previousPathCacheSingleSliceStats;
              } else {
                delete sourceControl.pathCacheSingleSliceStats;
              }
            }
            if (hadDisablePathCacheHoistedKeySuffix) {
              sourceControl.disablePathCacheHoistedKeySuffix =
                previousDisablePathCacheHoistedKeySuffix;
            } else {
              delete sourceControl.disablePathCacheHoistedKeySuffix;
            }
            if (pathCacheHoistedKeySuffixStats !== null) {
              if (hadPathCacheHoistedKeySuffixStats) {
                sourceControl.pathCacheHoistedKeySuffixStats =
                  previousPathCacheHoistedKeySuffixStats;
              } else {
                delete sourceControl.pathCacheHoistedKeySuffixStats;
              }
            }
            if (pathCacheEdgeIdentitySkipStats !== null) {
              if (hadPathCacheEdgeIdentitySkipStats) {
                sourceControl.pathCacheEdgeIdentitySkipStats =
                  previousPathCacheEdgeIdentitySkipStats;
              } else {
                delete sourceControl.pathCacheEdgeIdentitySkipStats;
              }
            }
            if (hadDisablePathCacheKnownTailSkip) {
              sourceControl.disablePathCacheKnownTailSkip =
                previousDisablePathCacheKnownTailSkip;
            } else {
              delete sourceControl.disablePathCacheKnownTailSkip;
            }
            if (pathCacheKnownTailStats !== null) {
              if (hadPathCacheKnownTailStats) {
                sourceControl.pathCacheKnownTailStats =
                  previousPathCacheKnownTailStats;
              } else {
                delete sourceControl.pathCacheKnownTailStats;
              }
            }
            if (hadDisablePathfindingDirectTiles) {
              sourceControl.disablePathfindingDirectTiles =
                previousDisablePathfindingDirectTiles;
            } else {
              delete sourceControl.disablePathfindingDirectTiles;
            }
            if (pathfindingDirectTilesStats !== null) {
              if (hadPathfindingDirectTilesStats) {
                sourceControl.pathfindingDirectTilesStats =
                  previousPathfindingDirectTilesStats;
              } else {
                delete sourceControl.pathfindingDirectTilesStats;
              }
            }
            if (${probeRestraintModFallback}) {
              Map.prototype.has = canonicalMapHas;
            }
            if (${probePathfindingSuccessorsModFallback}) {
              Map.prototype.forEach = canonicalMapForEach;
            }
            if (${probePathfindingTopCacheModFallback}) {
              Map.prototype.get = canonicalMapGet;
            }
            if (${probePathfindingOpenValuesModFallback}) {
              Map.prototype.values = canonicalMapValues;
            }
            if (hadDisablePathfindingDirectSuccessors) {
              sourceControl.disablePathfindingDirectSuccessors =
                previousDisablePathfindingDirectSuccessors;
            } else {
              delete sourceControl.disablePathfindingDirectSuccessors;
            }
            if (pathfindingDirectSuccessorStats !== null) {
              if (hadPathfindingDirectSuccessorStats) {
                sourceControl.pathfindingDirectSuccessorStats =
                  previousPathfindingDirectSuccessorStats;
              } else {
                delete sourceControl.pathfindingDirectSuccessorStats;
              }
            }
            if (hadDisablePathfindingClosedFirstSuccessors) {
              sourceControl.disablePathfindingClosedFirstSuccessors =
                previousDisablePathfindingClosedFirstSuccessors;
            } else {
              delete sourceControl.disablePathfindingClosedFirstSuccessors;
            }
            if (pathfindingClosedFirstSuccessorStats !== null) {
              if (hadPathfindingClosedFirstSuccessorStats) {
                sourceControl.pathfindingClosedFirstSuccessorStats =
                  previousPathfindingClosedFirstSuccessorStats;
              } else {
                delete sourceControl.pathfindingClosedFirstSuccessorStats;
              }
            }
            if (
              numericCoordinateGetPathProbe !== null &&
              globalThis.KinkyDungeonGetPath ===
                numericCoordinateGetPathProbe
            ) {
              globalThis.KinkyDungeonGetPath =
                officialNumericCoordinateGetPath;
            }
            if (numericCoordinateGetPathProbe !== null) {
              numericCoordinateGetPathProbeRestored =
                globalThis.KinkyDungeonGetPath ===
                officialNumericCoordinateGetPath;
            }
            if (hadDisablePathfindingNumericCoordinateKeys) {
              sourceControl.disablePathfindingNumericCoordinateKeys =
                previousDisablePathfindingNumericCoordinateKeys;
            } else {
              delete sourceControl.disablePathfindingNumericCoordinateKeys;
            }
            if (pathfindingNumericCoordinateKeyStats !== null) {
              if (hadPathfindingNumericCoordinateKeyStats) {
                sourceControl.pathfindingNumericCoordinateKeyStats =
                  previousPathfindingNumericCoordinateKeyStats;
              } else {
                delete sourceControl.pathfindingNumericCoordinateKeyStats;
              }
            }
            if (
              tileMembershipDependencyProbe !== null &&
              String.prototype.charCodeAt ===
                tileMembershipDependencyProbe
            ) {
              String.prototype.charCodeAt =
                officialTileMembershipCharCodeAt;
            }
            if (tileMembershipDependencyProbe !== null) {
              tileMembershipDependencyProbeRestored =
                String.prototype.charCodeAt ===
                officialTileMembershipCharCodeAt;
            }
            if (hadDisablePathfindingTileMembershipTable) {
              sourceControl.disablePathfindingTileMembershipTable =
                previousDisablePathfindingTileMembershipTable;
            } else {
              delete sourceControl.disablePathfindingTileMembershipTable;
            }
            if (pathfindingTileMembershipTableStats !== null) {
              if (hadPathfindingTileMembershipTableStats) {
                sourceControl.pathfindingTileMembershipTableStats =
                  previousPathfindingTileMembershipTableStats;
              } else {
                delete sourceControl.pathfindingTileMembershipTableStats;
              }
            }
            if (hadDisablePathfindingNumericContinuationIndex) {
              sourceControl.disablePathfindingNumericContinuationIndex =
                previousDisablePathfindingNumericContinuationIndex;
            } else {
              delete sourceControl.disablePathfindingNumericContinuationIndex;
            }
            if (pathfindingNumericContinuationIndexStats !== null) {
              if (hadPathfindingNumericContinuationIndexStats) {
                sourceControl.pathfindingNumericContinuationIndexStats =
                  previousPathfindingNumericContinuationIndexStats;
              } else {
                delete sourceControl.pathfindingNumericContinuationIndexStats;
              }
            }
            if (hadDisablePathfindingTopCacheSingleRead) {
              sourceControl.disablePathfindingTopCacheSingleRead =
                previousDisablePathfindingTopCacheSingleRead;
            } else {
              delete sourceControl.disablePathfindingTopCacheSingleRead;
            }
            if (pathfindingTopCacheSingleReadStats !== null) {
              if (hadPathfindingTopCacheSingleReadStats) {
                sourceControl.pathfindingTopCacheSingleReadStats =
                  previousPathfindingTopCacheSingleReadStats;
              } else {
                delete sourceControl.pathfindingTopCacheSingleReadStats;
              }
            }
            if (hadDisablePathfindingDeferredTileMetadata) {
              sourceControl.disablePathfindingDeferredTileMetadata =
                previousDisablePathfindingDeferredTileMetadata;
            } else {
              delete sourceControl.disablePathfindingDeferredTileMetadata;
            }
            if (pathfindingDeferredTileMetadataStats !== null) {
              if (hadPathfindingDeferredTileMetadataStats) {
                sourceControl.pathfindingDeferredTileMetadataStats =
                  previousPathfindingDeferredTileMetadataStats;
              } else {
                delete sourceControl.pathfindingDeferredTileMetadataStats;
              }
            }
            if (hadDisablePathfindingOpenValues) {
              sourceControl.disablePathfindingOpenValues =
                previousDisablePathfindingOpenValues;
            } else {
              delete sourceControl.disablePathfindingOpenValues;
            }
            if (pathfindingOpenValuesStats !== null) {
              if (hadPathfindingOpenValuesStats) {
                sourceControl.pathfindingOpenValuesStats =
                  previousPathfindingOpenValuesStats;
              } else {
                delete sourceControl.pathfindingOpenValuesStats;
              }
            }
            if (hadDisablePathfindingContinuationCacheLookup) {
              sourceControl.disablePathfindingContinuationCacheLookup =
                previousDisablePathfindingContinuationCacheLookup;
            } else {
              delete sourceControl.disablePathfindingContinuationCacheLookup;
            }
            if (pathfindingContinuationCacheLookupStats !== null) {
              if (hadPathfindingContinuationCacheLookupStats) {
                sourceControl.pathfindingContinuationCacheLookupStats =
                  previousPathfindingContinuationCacheLookupStats;
              } else {
                delete sourceControl.pathfindingContinuationCacheLookupStats;
              }
            }
            if (hadDisablePathfindingHoistedCacheIndex) {
              sourceControl.disablePathfindingHoistedCacheIndex =
                previousDisablePathfindingHoistedCacheIndex;
            } else {
              delete sourceControl.disablePathfindingHoistedCacheIndex;
            }
            if (pathfindingHoistedCacheIndexStats !== null) {
              if (hadPathfindingHoistedCacheIndexStats) {
                sourceControl.pathfindingHoistedCacheIndexStats =
                  previousPathfindingHoistedCacheIndexStats;
              } else {
                delete sourceControl.pathfindingHoistedCacheIndexStats;
              }
            }
            if (hadDisableMapGenerationPathfindingDirectFallback) {
              runtimeControl.disableMapGenerationPathfindingDirectFallback =
                previousDisableMapGenerationPathfindingDirectFallback;
            } else {
              delete runtimeControl
                .disableMapGenerationPathfindingDirectFallback;
            }
            if (
              mapGenerationPathfindingDirectFallbackStats !== null
            ) {
              if (hadMapGenerationPathfindingDirectFallbackStats) {
                runtimeControl
                  .mapGenerationPathfindingDirectFallbackStats =
                    previousMapGenerationPathfindingDirectFallbackStats;
              } else {
                delete runtimeControl
                  .mapGenerationPathfindingDirectFallbackStats;
              }
            }
            if (hadDisableMapGenerationPathCacheEdgeIdentitySkip) {
              runtimeControl.disableMapGenerationPathCacheEdgeIdentitySkip =
                previousDisableMapGenerationPathCacheEdgeIdentitySkip;
            } else {
              delete runtimeControl
                .disableMapGenerationPathCacheEdgeIdentitySkip;
            }
            if (mapGenerationPathCacheEdgeIdentityStats !== null) {
              if (hadMapGenerationPathCacheEdgeIdentityStats) {
                runtimeControl.mapGenerationPathCacheEdgeIdentityStats =
                  previousMapGenerationPathCacheEdgeIdentityStats;
              } else {
                delete runtimeControl.mapGenerationPathCacheEdgeIdentityStats;
              }
            }
            if (
              !hadRuntimeControl &&
              Object.keys(runtimeControl).length === 0 &&
              globalThis.KDHybridRuntimeControl === runtimeControl
            ) {
              delete globalThis.KDHybridRuntimeControl;
            }
            if (
              !hadSourceControl &&
              Object.keys(sourceControl).length === 0 &&
              globalThis.KDHybridSourcePatchControl === sourceControl
            ) {
              delete globalThis.KDHybridSourcePatchControl;
            }
            if (${probeEnemySelectorModFallback}) {
              if (statsChoiceGetDescriptor === undefined) {
                delete KinkyDungeonStatsChoice.get;
              } else {
                Object.defineProperty(
                  KinkyDungeonStatsChoice,
                  "get",
                  statsChoiceGetDescriptor
                );
              }
            }
            console.log = originalLog;
          }
          return {
            results,
            enemySelectorProbe:
              candidateEnemySelector === null ? null : enemySelectorStats,
            enemySelectorAngerCacheStats,
            enemySelectorAngerCatalogProbe,
            enemySelectorAngerHookProbe:
              enemySelectorAngerHookId === null
                ? null
                : {
                    calls: enemySelectorAngerHookCalls,
                    removed: enemySelectorAngerHookRemoved
                  },
            enemySelectorLongTagCacheStats,
            enemySelectorLongTagCatalogProbe,
            enemySelectorLongTagHookProbe:
              enemySelectorLongTagHookId === null
                ? null
                : {
                    calls: enemySelectorLongTagHookCalls,
                    removed: enemySelectorLongTagHookRemoved
                  },
            enemySelectorWeightedQueryCacheStats,
            restraintEligibleProbe:
              candidateRestraintsEligible === null
                ? null
                : restraintEligibleStats,
            restraintSourceStats,
            accessibleFrontierProbe: ${
              probeAccessibleFrontierSingleRead
                ? "accessibleFrontierStats"
                : "null"
            },
            accessibleNeighborProbe: ${
              probeAccessibleNeighborSingleRead
                ? "accessibleNeighborStats"
                : "null"
            },
            accessibleQueueProbe: ${
              probeAccessibleQueue ? "accessibleQueueStats" : "null"
            },
            accessibleQueueSourceStats,
            accessibleQueueSourceModFallbackProbe: ${
              probeAccessibleQueueSourceModFallback
                ? `{
                    calls: accessibleQueueModFallbackCalls,
                    restored: accessibleQueueModFallbackRestored
                  }`
                : "null"
            },
            placeDoorsAccessibleReuseStats,
            placeDoorsAccessibleReuseSourceStats,
            mapTileFillingCoordinateReuseStats,
            mapTileFillingCoordinateReuseSourceStats,
            mapTileFillingCoordinateReuseSourceEquivalenceProbe,
            pasteTileSerializedCacheStats,
            pasteTileSerializedCacheSourceStats,
            pathCacheProbe:
              candidateSetPathfindCache === null ? null : pathCacheStats,
            pathCacheSourceStats,
            pathCacheHoistedKeySuffixStats,
            pathCacheEdgeIdentitySkipStats,
            pathCacheKnownTailStats,
            pathCacheKnownTailWriterProbe,
            pathCacheCounters:
              pathCacheCountersAfter === null
                ? null
                : {
                    before: pathCacheCountersBefore,
                    after: pathCacheCountersAfter,
                    hitDelta:
                      pathCacheCountersAfter.hits === null ||
                      pathCacheCountersBefore.hits === null
                        ? null
                        : pathCacheCountersAfter.hits -
                          pathCacheCountersBefore.hits,
                    fillDelta:
                      pathCacheCountersAfter.fills === null ||
                      pathCacheCountersBefore.fills === null
                        ? null
                        : pathCacheCountersAfter.fills -
                          pathCacheCountersBefore.fills
                  },
            pathCacheModFallbackProbe,
            pathfindingDirectTilesStats,
            pathfindingDirectSuccessorStats,
            pathfindingClosedFirstSuccessorStats,
            pathfindingNumericCoordinateKeyStats,
            pathfindingTileMembershipTableStats,
            pathfindingNumericContinuationIndexStats,
            pathfindingTileMembershipDependencyProbe:
              tileMembershipDependencyProbe === null
                ? null
                : {
                    calls: tileMembershipDependencyProbeCalls,
                    restored: tileMembershipDependencyProbeRestored
                  },
            pathfindingNumericGetPathProbe:
              numericCoordinateGetPathProbe === null
                ? null
                : {
                    calls: numericCoordinateGetPathProbeCalls,
                    restored: numericCoordinateGetPathProbeRestored
                  },
            pathfindingTopCacheSingleReadStats,
            pathfindingDeferredTileMetadataStats,
            pathfindingOpenValuesStats,
            pathfindingContinuationCacheLookupStats,
            pathfindingHoistedCacheIndexStats,
            mapGenerationPathfindingDirectFallbackStats,
            mapGenerationPathCacheEdgeIdentityStats,
            mapGenerationPathCacheModProbe,
            mapGenerationPathfindingHookProbe:
              mapGenerationPathfindingHookId === null
                ? null
                : {
                    calls: mapGenerationPathfindingHookCalls,
                    removed: mapGenerationPathfindingHookRemoved
                  },
            heapAfter: performance.memory?.usedJSHeapSize ?? null
          };
        })()`,
        240_000,
      );
    } finally {
      stopped = collectCpuProfile
        ? await client.call("Profiler.stop", undefined, 120_000)
        : {
            profile: {
              startTime: 0,
              endTime: 0,
              nodes: [],
              samples: [],
              timeDeltas: [],
            },
          };
    }
    const pathfindingAfter = await readPathfindingStatus(client);
    const enemySelectorAfter = await readAdapterStatus(
      client,
      "KinkyDungeonGetEnemy",
    );

    const restore = await restoreSnapshot(client);
    snapshotCaptured = !restore.loaded;
    restore.exact =
      restore.loaded &&
      restore.checkpoint === environment.checkpoint &&
      restore.floor === environment.floor &&
      restore.signature === environment.restoreSignature;
    const elapsed = run.results.map((entry) => entry.elapsedMilliseconds);
    const sorted = [...elapsed].sort((left, right) => left - right);
    const pathCacheEdgeIdentitySourceFallbackExpected =
      disableMapGenerationPathCacheEdgeIdentitySkip ||
      disableMapGenerationPathfindingDirectFallback ||
      probeMapGenerationPathfindingHookFallback ||
      probeMapGenerationPathCacheModFallback;
    const pathCacheEdgeIdentityScopeFallbackExpected =
      disableMapGenerationPathCacheEdgeIdentitySkip ||
      disableMapGenerationPathfindingDirectFallback ||
      probeMapGenerationPathfindingHookFallback;
    const placeDoorsAccessibleReuseSourceFallbackExpected =
      disablePlaceDoorsAccessibleReuseSource ||
      probeMapGenerationPathCacheModFallback;
    const accessibleQueueSourceFallbackExpected =
      disableAccessibleQueueSource ||
      probeAccessibleQueueSourceModFallback ||
      probeMapGenerationPathCacheModFallback;
    const mapTileFillingCoordinateReuseSourceFallbackExpected =
      disableMapTileFillingCoordinateReuseSource ||
      probeMapTileFillingCoordinateReuse ||
      probeMapGenerationPathCacheModFallback;
    const pasteTileSerializedCacheSourceFallbackExpected =
      disablePasteTileSerializedCacheSource ||
      probeMapGenerationPathCacheModFallback;
    const pathCacheKnownTailFallbackExpected =
      disablePathCacheKnownTailSkip ||
      pathCacheEdgeIdentitySourceFallbackExpected ||
      probePathCacheKnownTailWriterFallback;
    const pathfindingNumericCoordinateKeysFallbackExpected =
      disablePathfindingNumericCoordinateKeys ||
      disablePathfindingDirectSuccessors ||
      disablePathfindingClosedFirstSuccessors ||
      disablePathfindingOpenValues ||
      disablePathfindingHoistedCacheIndex ||
      disableMapGenerationPathfindingDirectFallback ||
      probeMapGenerationPathfindingHookFallback ||
      disableMapGenerationPathCacheEdgeIdentitySkip ||
      probeMapGenerationPathCacheModFallback ||
      probePathfindingTopCacheModFallback ||
      probePathfindingSuccessorsModFallback ||
      probePathfindingOpenValuesModFallback ||
      probePathfindingNumericGetPathFallback;
    const pathfindingTileMembershipTableFallbackExpected =
      disablePathfindingTileMembershipTable ||
      pathfindingNumericCoordinateKeysFallbackExpected ||
      disablePathfindingContinuationCacheLookup ||
      disablePathfindingDeferredTileMetadata ||
      probePathfindingTilesModFallback ||
      probePathfindingDeferredTileModFallback ||
      probePathfindingTileMembershipDependencyFallback;
    const pathfindingNumericContinuationIndexFallbackExpected =
      disablePathfindingNumericContinuationIndex ||
      pathfindingTileMembershipTableFallbackExpected ||
      probePathCacheKnownTailWriterFallback ||
      probeRestraintModFallback;
    const report = {
      schema: 1,
      generatedAt: new Date().toISOString(),
      environment: {
        ...environment,
        requestedMaps: mapCount,
        startIndex,
        samplingIntervalMicroseconds: samplingInterval,
        pathfinding: {
          requested: pathfindingMode,
          before: pathfindingBefore,
        },
        enemySelector: {
          requested: probeEnemySelectorLongTagCache
            ? "anger-and-long-tag-cache"
            : probeEnemySelectorWeightedFilterTagCache
              ? "anger-long-single-and-filter-tag-weighted-query-cache"
              : probeEnemySelectorWeightedSingleTagCache
                ? "anger-long-and-weighted-single-tag-query-cache"
                : probeEnemySelectorWeightedQueryCache
                  ? "anger-long-and-weighted-query-cache"
                  : probeEnemySelectorSingleTagCache
                    ? "anger-and-single-tag-cache"
                    : probeEnemySelectorAngerCache
                      ? "anger-cache"
                      : probeEnemySelectorHoists
                        ? "probe"
                        : probeEnemySelectorModFallback
                          ? "mod-fallback"
                          : disableEnemySelectorHoists
                            ? "javascript"
                            : "product",
          longTagScope: restrictProbeEnemySelectorLongTagCache
            ? "canonical-control"
            : disableEnemySelectorGeneralLongTagCache
              ? "canonical-product-control"
              : "all-safe-long",
          before: enemySelectorBefore,
        },
        enemySelectorAngerCache: {
          requested: probeEnemySelectorAngerCatalogFallback
            ? "catalog-fallback"
            : probeEnemySelectorAngerHookFallback
              ? "hook-fallback"
              : disableEnemySelectorAngerCache
                ? "official-loop"
                : "product",
        },
        enemySelectorLongTagCache: {
          requested: probeEnemySelectorLongTagCatalogFallback
            ? "catalog-fallback"
            : probeEnemySelectorLongTagHookFallback
              ? "hook-fallback"
              : disableEnemySelectorLongTagCache
                ? "official-loop"
                : "product",
        },
        enemySelectorGeneralLongTagCache: {
          requested: disableEnemySelectorGeneralLongTagCache
            ? "v37-control"
            : "product",
        },
        enemySelectorWeightedQueryCache: {
          requested: disableEnemySelectorWeightedQueryCache
            ? "official-loop"
            : "product",
        },
        enemySelectorWeightedSingleTagCache: {
          requested: disableEnemySelectorWeightedSingleTagCache
            ? "v32-control"
            : "product",
        },
        enemySelectorWeightedFilterTagCache: {
          requested: disableEnemySelectorWeightedFilterTagCache
            ? "v33-control"
            : "product",
        },
        pathCache: {
          requested: probePathCacheModFallback
            ? "mod-fallback"
            : probePathCacheCallReuse
              ? "call-reuse"
              : probePathCachePrefixLimit > 0
                ? `prefix-${probePathCachePrefixLimit}`
                : probePathCacheHitDistribution
                  ? "hit-distribution"
                  : probePathCacheNoWrite
                    ? "no-write"
                    : probePathCacheSkipExistingEquivalence
                      ? "skip-existing-equivalence"
                      : probePathCacheEdgeIdentityEquivalence
                        ? "edge-identity-equivalence"
                        : probePathCacheEdgeIdentitySkip
                          ? "edge-identity-skip"
                          : probePathCacheSkipIdenticalExisting
                            ? "skip-identical-existing"
                            : disablePathCacheSingleSlice
                              ? "official-loop"
                              : probePathCacheSingleSlice ||
                                  probePathCacheEquivalence
                                ? "probe"
                                : "product",
        },
        pathCacheHoistedKeySuffix: {
          requested: disablePathCacheHoistedKeySuffix
            ? "repeated-suffix"
            : "product",
        },
        mapGenerationPathCacheEdgeIdentitySkip: {
          requested: probeMapGenerationPathCacheModFallback
            ? "mod-fallback"
            : disableMapGenerationPathCacheEdgeIdentitySkip
              ? "official-write"
              : "product",
        },
        pathCacheKnownTailSkip: {
          requested: probePathCacheKnownTailWriterFallback
            ? "writer-fallback"
            : disablePathCacheKnownTailSkip
              ? "edge-identity-loop"
              : verifyPathCacheKnownTail
                ? "verified-product"
                : "product",
        },
        pathfindingTiles: {
          requested: probePathfindingTilesModFallback
            ? "mod-fallback"
            : disablePathfindingDirectTiles
              ? "official-getter"
              : "product",
        },
        pathfindingSuccessors: {
          requested: probePathfindingSuccessorsModFallback
            ? "mod-fallback"
            : disablePathfindingDirectSuccessors
              ? "temporary-map"
              : "product",
        },
        pathfindingClosedFirstSuccessors: {
          requested: disablePathfindingClosedFirstSuccessors
            ? "open-first"
            : "product",
        },
        pathfindingNumericCoordinateKeys: {
          requested: verifyPathfindingNumericCoordinateKeys
            ? "verified-product"
            : pathfindingNumericCoordinateKeysFallbackExpected
              ? "fallback"
              : "product",
        },
        pathfindingTileMembershipTable: {
          requested: probePathfindingTileMembershipDependencyFallback
            ? "dependency-fallback"
            : verifyPathfindingTileMembershipTable
              ? "verified-product"
              : pathfindingTileMembershipTableFallbackExpected
                ? "fallback"
                : "product",
        },
        pathfindingNumericContinuationIndex: {
          requested: verifyPathfindingNumericContinuationIndex
            ? "verified-product"
            : pathfindingNumericContinuationIndexFallbackExpected
              ? "fallback"
              : "product",
        },
        pathfindingTopCacheSingleRead: {
          requested: probePathfindingTopCacheModFallback
            ? "mod-fallback"
            : disablePathfindingTopCacheSingleRead
              ? "repeated-read"
              : "product",
        },
        pathfindingDeferredTileMetadata: {
          requested: probePathfindingDeferredTileModFallback
            ? "mod-fallback"
            : disablePathfindingDeferredTileMetadata
              ? "eager"
              : "product",
        },
        pathfindingOpenValues: {
          requested: probePathfindingOpenValuesModFallback
            ? "mod-fallback"
            : disablePathfindingOpenValues
              ? "for-each"
              : "product",
        },
        pathfindingContinuationCacheLookup: {
          requested: probePathfindingTopCacheModFallback
            ? "mod-fallback"
            : disablePathfindingContinuationCacheLookup
              ? "per-neighbor"
              : disablePathfindingHoistedCacheIndex
                ? "dependency-fallback"
                : "product",
        },
        pathfindingHoistedCacheIndex: {
          requested: disablePathfindingHoistedCacheIndex
            ? "repeated-index"
            : "product",
        },
        mapGenerationPathfindingDirectFallback: {
          requested: probeMapGenerationPathfindingHookFallback
            ? "hook-fallback"
            : disableMapGenerationPathfindingDirectFallback
              ? "dispatcher"
              : "product",
        },
      },
      run: {
        maps: run.results.length,
        totalMilliseconds: round(
          elapsed.reduce((total, value) => total + value, 0),
        ),
        medianMilliseconds: round(percentile(sorted, 0.5)),
        p95Milliseconds: round(percentile(sorted, 0.95)),
        maximumMilliseconds: round(sorted.at(-1) ?? 0),
        allAccessible: run.results.every((entry) => entry.accessible),
        uniqueSignatures: new Set(run.results.map((entry) => entry.signature))
          .size,
        heapDeltaBytes:
          environment.heapBefore === null || run.heapAfter === null
            ? null
            : run.heapAfter - environment.heapBefore,
        pathfindingDelta: statusDelta(pathfindingBefore, pathfindingAfter),
        enemySelectorDelta: statusDelta(
          enemySelectorBefore,
          enemySelectorAfter,
        ),
        enemySelectorProbe: run.enemySelectorProbe,
        enemySelectorAngerCacheStats: run.enemySelectorAngerCacheStats,
        enemySelectorAngerCatalogProbe: run.enemySelectorAngerCatalogProbe,
        enemySelectorAngerHookProbe: run.enemySelectorAngerHookProbe,
        enemySelectorLongTagCacheStats: run.enemySelectorLongTagCacheStats,
        enemySelectorLongTagCatalogProbe: run.enemySelectorLongTagCatalogProbe,
        enemySelectorLongTagHookProbe: run.enemySelectorLongTagHookProbe,
        enemySelectorWeightedQueryCacheStats:
          run.enemySelectorWeightedQueryCacheStats,
        restraintEligibleProbe: run.restraintEligibleProbe,
        restraintSourceStats: run.restraintSourceStats,
        accessibleFrontierProbe: run.accessibleFrontierProbe,
        accessibleNeighborProbe: run.accessibleNeighborProbe,
        accessibleQueueProbe: run.accessibleQueueProbe,
        accessibleQueueSourceStats: run.accessibleQueueSourceStats,
        accessibleQueueSourceModFallbackProbe:
          run.accessibleQueueSourceModFallbackProbe,
        placeDoorsAccessibleReuseStats: run.placeDoorsAccessibleReuseStats,
        placeDoorsAccessibleReuseSourceStats:
          run.placeDoorsAccessibleReuseSourceStats,
        mapTileFillingCoordinateReuseStats:
          run.mapTileFillingCoordinateReuseStats,
        mapTileFillingCoordinateReuseSourceStats:
          run.mapTileFillingCoordinateReuseSourceStats,
        mapTileFillingCoordinateReuseSourceEquivalenceProbe:
          run.mapTileFillingCoordinateReuseSourceEquivalenceProbe,
        pasteTileSerializedCacheStats: run.pasteTileSerializedCacheStats,
        pasteTileSerializedCacheSourceStats:
          run.pasteTileSerializedCacheSourceStats,
        pathCacheProbe: run.pathCacheProbe,
        pathCacheSourceStats: run.pathCacheSourceStats,
        pathCacheHoistedKeySuffixStats: run.pathCacheHoistedKeySuffixStats,
        pathCacheEdgeIdentitySkipStats: run.pathCacheEdgeIdentitySkipStats,
        pathCacheKnownTailStats: run.pathCacheKnownTailStats,
        pathCacheKnownTailWriterProbe: run.pathCacheKnownTailWriterProbe,
        pathCacheCounters: run.pathCacheCounters,
        pathCacheModFallbackProbe: run.pathCacheModFallbackProbe,
        pathfindingDirectTilesStats: run.pathfindingDirectTilesStats,
        pathfindingDirectSuccessorStats: run.pathfindingDirectSuccessorStats,
        pathfindingClosedFirstSuccessorStats:
          run.pathfindingClosedFirstSuccessorStats,
        pathfindingNumericCoordinateKeyStats:
          run.pathfindingNumericCoordinateKeyStats,
        pathfindingTileMembershipTableStats:
          run.pathfindingTileMembershipTableStats,
        pathfindingNumericContinuationIndexStats:
          run.pathfindingNumericContinuationIndexStats,
        pathfindingTileMembershipDependencyProbe:
          run.pathfindingTileMembershipDependencyProbe,
        pathfindingNumericGetPathProbe: run.pathfindingNumericGetPathProbe,
        pathfindingTopCacheSingleReadStats:
          run.pathfindingTopCacheSingleReadStats,
        pathfindingDeferredTileMetadataStats:
          run.pathfindingDeferredTileMetadataStats,
        pathfindingOpenValuesStats: run.pathfindingOpenValuesStats,
        pathfindingContinuationCacheLookupStats:
          run.pathfindingContinuationCacheLookupStats,
        pathfindingHoistedCacheIndexStats:
          run.pathfindingHoistedCacheIndexStats,
        mapGenerationPathfindingDirectFallbackStats:
          run.mapGenerationPathfindingDirectFallbackStats,
        mapGenerationPathCacheEdgeIdentityStats:
          run.mapGenerationPathCacheEdgeIdentityStats,
        mapGenerationPathCacheModProbe: run.mapGenerationPathCacheModProbe,
        mapGenerationPathfindingHookProbe:
          run.mapGenerationPathfindingHookProbe,
        results: run.results,
      },
      restore,
      acceptance: {
        passed:
          run.results.length === mapCount &&
          run.results.every((entry) => entry.accessible) &&
          restore.exact &&
          (!probeEnemySelectorModFallback ||
            (statusDelta(enemySelectorBefore, enemySelectorAfter)
              .nativeCalls === 0 &&
              statusDelta(enemySelectorBefore, enemySelectorAfter)
                .fallbackCalls > 0)) &&
          (!(
            probeEnemySelectorWeightedQueryCache ||
            probeEnemySelectorWeightedSingleTagCache ||
            probeEnemySelectorWeightedFilterTagCache
          ) ||
            (run.enemySelectorProbe?.weightedQueryCacheCalls > 0 &&
              run.enemySelectorProbe?.weightedQueryCacheBuilds > 0 &&
              run.enemySelectorProbe?.weightedQueryCacheHits > 0 &&
              run.enemySelectorProbe?.weightedQueryEnemiesElided > 0 &&
              (!(
                probeEnemySelectorWeightedSingleTagCache ||
                probeEnemySelectorWeightedFilterTagCache
              ) ||
                (run.enemySelectorProbe?.weightedSingleTagCacheCalls > 0 &&
                  run.enemySelectorProbe?.weightedSingleTagCacheBuilds > 0 &&
                  run.enemySelectorProbe?.weightedSingleTagCacheHits > 0 &&
                  run.enemySelectorProbe?.weightedSingleTagEnemiesElided >
                    0)) &&
              (!probeEnemySelectorWeightedFilterTagCache ||
                (run.enemySelectorProbe?.weightedFilterTagCacheCalls > 0 &&
                  run.enemySelectorProbe?.weightedFilterTagCacheBuilds > 0 &&
                  run.enemySelectorProbe?.weightedFilterTagCacheHits > 0 &&
                  run.enemySelectorProbe?.weightedFilterTagEnemiesElided >
                    0)))) &&
          (!(
            traceEnemySelectorAngerCache ||
            probeEnemySelectorAngerHookFallback ||
            probeEnemySelectorAngerCatalogFallback
          ) ||
            (disableEnemySelectorAngerCache ||
            probeEnemySelectorAngerHookFallback ||
            probeEnemySelectorAngerCatalogFallback
              ? run.enemySelectorAngerCacheStats?.optimizedCalls === 0 &&
                run.enemySelectorAngerCacheStats?.fallbackCalls > 0 &&
                (!probeEnemySelectorAngerCatalogFallback ||
                  run.enemySelectorAngerCacheStats?.validationFailures > 0)
              : run.enemySelectorAngerCacheStats?.optimizedCalls > 0 &&
                run.enemySelectorAngerCacheStats?.fallbackCalls === 0 &&
                run.enemySelectorAngerCacheStats?.cacheBuilds > 0 &&
                run.enemySelectorAngerCacheStats?.cacheHits > 0 &&
                run.enemySelectorAngerCacheStats?.validationFailures === 0)) &&
          (!probeEnemySelectorAngerHookFallback ||
            (run.enemySelectorAngerHookProbe?.calls > 0 &&
              run.enemySelectorAngerHookProbe?.removed === true)) &&
          (!probeEnemySelectorAngerCatalogFallback ||
            run.enemySelectorAngerCatalogProbe?.restored === true) &&
          (!(
            traceEnemySelectorLongTagCache ||
            probeEnemySelectorLongTagHookFallback ||
            probeEnemySelectorLongTagCatalogFallback
          ) ||
            (disableEnemySelectorLongTagCache ||
            probeEnemySelectorLongTagHookFallback ||
            probeEnemySelectorLongTagCatalogFallback
              ? run.enemySelectorLongTagCacheStats?.optimizedCalls === 0 &&
                run.enemySelectorLongTagCacheStats?.fallbackCalls > 0 &&
                (!probeEnemySelectorLongTagCatalogFallback ||
                  run.enemySelectorLongTagCacheStats?.validationFailures > 0)
              : run.enemySelectorLongTagCacheStats?.optimizedCalls > 0 &&
                run.enemySelectorLongTagCacheStats?.fallbackCalls === 0 &&
                run.enemySelectorLongTagCacheStats?.cacheBuilds > 0 &&
                run.enemySelectorLongTagCacheStats?.cacheHits > 0 &&
                run.enemySelectorLongTagCacheStats?.querySequences > 0 &&
                run.enemySelectorLongTagCacheStats?.validationFailures ===
                  0)) &&
          (!probeEnemySelectorLongTagHookFallback ||
            (run.enemySelectorLongTagHookProbe?.calls > 0 &&
              run.enemySelectorLongTagHookProbe?.removed === true)) &&
          (!probeEnemySelectorLongTagCatalogFallback ||
            run.enemySelectorLongTagCatalogProbe?.restored === true) &&
          (!traceEnemySelectorWeightedQueryCache ||
            (weightedQueryFallbackExpected
              ? run.enemySelectorWeightedQueryCacheStats?.optimizedCalls ===
                  0 &&
                run.enemySelectorWeightedQueryCacheStats?.fallbackCalls > 0 &&
                run.enemySelectorWeightedQueryCacheStats?.cacheBuilds === 0 &&
                run.enemySelectorWeightedQueryCacheStats?.cacheHits === 0 &&
                run.enemySelectorWeightedQueryCacheStats?.enemiesElided === 0 &&
                (weightedQueryCatalogFallbackExpected
                  ? run.enemySelectorWeightedQueryCacheStats
                      ?.validationFailures > 0
                  : run.enemySelectorWeightedQueryCacheStats
                      ?.validationFailures === 0)
              : run.enemySelectorWeightedQueryCacheStats?.optimizedCalls > 0 &&
                run.enemySelectorWeightedQueryCacheStats?.fallbackCalls > 0 &&
                run.enemySelectorWeightedQueryCacheStats?.cacheBuilds > 0 &&
                run.enemySelectorWeightedQueryCacheStats?.cacheHits > 0 &&
                run.enemySelectorWeightedQueryCacheStats?.enemiesElided > 0 &&
                run.enemySelectorWeightedQueryCacheStats?.validationFailures ===
                  0)) &&
          (!(probeRestraintEquivalence || verifyRestraintRetryReuse) ||
            (run.restraintEligibleProbe?.comparedCalls > 0 &&
              run.restraintEligibleProbe?.mismatches === 0)) &&
          (!probeRestraintCatalogFastPathCeiling ||
            (run.restraintEligibleProbe?.calls > 0 &&
              run.restraintEligibleProbe?.forcedFastPathRestraints > 0)) &&
          (!probeAccessibleFrontierSingleRead ||
            Number(run.accessibleFrontierProbe?.accessibleCalls ?? 0) +
              Number(run.accessibleFrontierProbe?.roomCalls ?? 0) >
              0) &&
          (!probeAccessibleNeighborSingleRead ||
            Number(run.accessibleNeighborProbe?.accessibleCalls ?? 0) +
              Number(run.accessibleNeighborProbe?.roomCalls ?? 0) >
              0) &&
          (!probeAccessibleQueue ||
            (Number(run.accessibleQueueProbe?.accessibleCalls ?? 0) +
              Number(run.accessibleQueueProbe?.roomCalls ?? 0) >
              0 &&
              (!verifyAccessibleQueue ||
                (run.accessibleQueueProbe?.comparedCalls > 0 &&
                  run.accessibleQueueProbe?.mismatches === 0)))) &&
          (!(
            traceAccessibleQueueSource || probeAccessibleQueueSourceModFallback
          ) ||
            (Number(run.accessibleQueueSourceStats?.accessibleCalls ?? 0) +
              Number(run.accessibleQueueSourceStats?.roomCalls ?? 0) >
              0 &&
              (accessibleQueueSourceFallbackExpected
                ? run.accessibleQueueSourceStats?.optimizedCalls === 0 &&
                  run.accessibleQueueSourceStats?.fallbackCalls > 0
                : run.accessibleQueueSourceStats?.optimizedCalls > 0 &&
                  run.accessibleQueueSourceStats?.fallbackCalls === 0))) &&
          (!probeAccessibleQueueSourceModFallback ||
            (run.accessibleQueueSourceModFallbackProbe?.calls > 0 &&
              run.accessibleQueueSourceModFallbackProbe?.restored === true)) &&
          (!probePlaceDoorsAccessibleReuse ||
            (run.placeDoorsAccessibleReuseStats?.calls > 0 &&
              run.placeDoorsAccessibleReuseStats?.cacheHits > 0 &&
              run.placeDoorsAccessibleReuseStats?.officialCalls > 0 &&
              run.placeDoorsAccessibleReuseStats?.restored === true &&
              (!verifyPlaceDoorsAccessibleReuse ||
                (run.placeDoorsAccessibleReuseStats?.comparedCalls > 0 &&
                  run.placeDoorsAccessibleReuseStats?.mismatches === 0)))) &&
          (!tracePlaceDoorsAccessibleReuseSource ||
            (run.placeDoorsAccessibleReuseSourceStats?.calls > 0 &&
              (placeDoorsAccessibleReuseSourceFallbackExpected
                ? run.placeDoorsAccessibleReuseSourceStats?.optimizedCalls ===
                    0 &&
                  run.placeDoorsAccessibleReuseSourceStats?.fallbackCalls > 0 &&
                  run.placeDoorsAccessibleReuseSourceStats?.reuses === 0 &&
                  run.placeDoorsAccessibleReuseSourceStats?.officialCalls > 0
                : run.placeDoorsAccessibleReuseSourceStats?.optimizedCalls >
                    0 &&
                  run.placeDoorsAccessibleReuseSourceStats?.fallbackCalls ===
                    0 &&
                  run.placeDoorsAccessibleReuseSourceStats?.reuses > 0 &&
                  run.placeDoorsAccessibleReuseSourceStats?.officialCalls ===
                    0))) &&
          (!probeMapTileFillingCoordinateReuse ||
            (run.mapTileFillingCoordinateReuseStats?.calls > 0 &&
              run.mapTileFillingCoordinateReuseStats?.restored === true &&
              (!verifyMapTileFillingCoordinateReuse ||
                (run.mapTileFillingCoordinateReuseStats?.comparedCalls > 0 &&
                  run.mapTileFillingCoordinateReuseStats?.mismatches ===
                    0)))) &&
          (!traceMapTileFillingCoordinateReuseSource ||
            (run.mapTileFillingCoordinateReuseSourceStats?.calls > 0 &&
              (mapTileFillingCoordinateReuseSourceFallbackExpected
                ? run.mapTileFillingCoordinateReuseSourceStats
                    ?.optimizedCalls === 0 &&
                  run.mapTileFillingCoordinateReuseSourceStats?.fallbackCalls >
                    0 &&
                  run.mapTileFillingCoordinateReuseSourceStats?.fitChecks === 0
                : run.mapTileFillingCoordinateReuseSourceStats?.optimizedCalls >
                    0 &&
                  run.mapTileFillingCoordinateReuseSourceStats
                    ?.fallbackCalls === 0 &&
                  run.mapTileFillingCoordinateReuseSourceStats?.fitChecks >
                    0))) &&
          (!probeMapTileFillingCoordinateReuseSourceEquivalence ||
            (run.mapTileFillingCoordinateReuseSourceEquivalenceProbe?.calls >
              0 &&
              run.mapTileFillingCoordinateReuseSourceEquivalenceProbe
                ?.mismatches === 0 &&
              run.mapTileFillingCoordinateReuseSourceEquivalenceProbe
                ?.restored === true)) &&
          (!probePasteTileSerializedCache ||
            (run.pasteTileSerializedCacheStats?.calls > 0 &&
              run.pasteTileSerializedCacheStats?.cacheHits > 0 &&
              run.pasteTileSerializedCacheStats?.cacheMisses > 0 &&
              run.pasteTileSerializedCacheStats?.restored === true &&
              (!verifyPasteTileSerializedCache ||
                (run.pasteTileSerializedCacheStats?.verifiedHits > 0 &&
                  run.pasteTileSerializedCacheStats?.mismatches === 0)))) &&
          (!tracePasteTileSerializedCacheSource ||
            (run.pasteTileSerializedCacheSourceStats?.calls > 0 &&
              (pasteTileSerializedCacheSourceFallbackExpected
                ? run.pasteTileSerializedCacheSourceStats?.optimizedCalls ===
                    0 &&
                  run.pasteTileSerializedCacheSourceStats?.fallbackCalls > 0 &&
                  run.pasteTileSerializedCacheSourceStats?.hits === 0
                : run.pasteTileSerializedCacheSourceStats?.optimizedCalls > 0 &&
                  run.pasteTileSerializedCacheSourceStats?.fallbackCalls ===
                    0 &&
                  run.pasteTileSerializedCacheSourceStats?.hits > 0 &&
                  run.pasteTileSerializedCacheSourceStats?.misses > 0 &&
                  (!verifyPasteTileSerializedCacheSource ||
                    (run.pasteTileSerializedCacheSourceStats?.verifications >
                      0 &&
                      run.pasteTileSerializedCacheSourceStats?.mismatches ===
                        0))))) &&
          (!probeRestraintModFallback ||
            (run.restraintSourceStats?.optimizedRestraints === 0 &&
              run.restraintSourceStats?.fallbackRestraints > 0)) &&
          (!(
            probePathCacheEquivalence ||
            probePathCacheSkipExistingEquivalence ||
            probePathCacheEdgeIdentityEquivalence
          ) ||
            (run.pathCacheProbe?.comparedCalls > 0 &&
              run.pathCacheProbe?.mismatches === 0)) &&
          (!probePathCacheCallReuse ||
            (run.pathCacheProbe?.calls > 0 &&
              run.pathCacheProbe?.distinctPaths > 0)) &&
          (!tracePathCacheSource ||
            (run.pathCacheSourceStats?.calls > 0 &&
              (disablePathCacheSingleSlice
                ? run.pathCacheSourceStats?.optimizedCalls === 0 &&
                  run.pathCacheSourceStats?.fallbackCalls > 0
                : run.pathCacheSourceStats?.optimizedCalls > 0 &&
                  run.pathCacheSourceStats?.fallbackCalls === 0))) &&
          (!tracePathCacheHoistedKeySuffix ||
            (run.pathCacheHoistedKeySuffixStats?.calls > 0 &&
              (disablePathCacheHoistedKeySuffix
                ? run.pathCacheHoistedKeySuffixStats?.optimizedCalls === 0 &&
                  run.pathCacheHoistedKeySuffixStats?.fallbackCalls > 0
                : run.pathCacheHoistedKeySuffixStats?.optimizedCalls > 0 &&
                  run.pathCacheHoistedKeySuffixStats?.fallbackCalls === 0))) &&
          (!(
            traceMapGenerationPathCacheEdgeIdentitySkip ||
            probeMapGenerationPathCacheModFallback
          ) ||
            (run.pathCacheEdgeIdentitySkipStats?.calls > 0 &&
              (pathCacheEdgeIdentitySourceFallbackExpected
                ? run.pathCacheEdgeIdentitySkipStats?.optimizedCalls === 0 &&
                  run.pathCacheEdgeIdentitySkipStats?.fallbackCalls > 0 &&
                  run.pathCacheEdgeIdentitySkipStats?.skippedEntries === 0
                : run.pathCacheEdgeIdentitySkipStats?.optimizedCalls > 0 &&
                  run.pathCacheEdgeIdentitySkipStats?.fallbackCalls === 0 &&
                  run.pathCacheEdgeIdentitySkipStats?.skippedEntries > 0) &&
              (pathCacheEdgeIdentityScopeFallbackExpected
                ? run.mapGenerationPathCacheEdgeIdentityStats?.optimizedMaps ===
                    0 &&
                  run.mapGenerationPathCacheEdgeIdentityStats?.fallbackMaps ===
                    mapCount
                : run.mapGenerationPathCacheEdgeIdentityStats?.optimizedMaps ===
                    mapCount &&
                  run.mapGenerationPathCacheEdgeIdentityStats?.fallbackMaps ===
                    0))) &&
          (!(
            tracePathCacheKnownTail ||
            verifyPathCacheKnownTail ||
            probePathCacheKnownTailWriterFallback
          ) ||
            (run.pathCacheKnownTailStats?.calls > 0 &&
              (pathCacheKnownTailFallbackExpected
                ? run.pathCacheKnownTailStats?.optimizedCalls === 0 &&
                  run.pathCacheKnownTailStats?.fallbackCalls > 0 &&
                  run.pathCacheKnownTailStats?.skippedEntries === 0
                : run.pathCacheKnownTailStats?.optimizedCalls > 0 &&
                  run.pathCacheKnownTailStats?.skippedEntries > 0) &&
              (!verifyPathCacheKnownTail ||
                (run.pathCacheKnownTailStats?.verifiedEntries > 0 &&
                  run.pathCacheKnownTailStats?.mismatches === 0)))) &&
          (!probePathCacheKnownTailWriterFallback ||
            (run.pathCacheKnownTailWriterProbe?.calls > 0 &&
              run.pathCacheKnownTailWriterProbe?.restored === true)) &&
          (!probeMapGenerationPathCacheModFallback ||
            (run.mapGenerationPathCacheModProbe?.activeLength ===
              run.mapGenerationPathCacheModProbe?.initialLength + 1 &&
              run.mapGenerationPathCacheModProbe?.restored === true)) &&
          (!probePathCacheModFallback ||
            (run.pathCacheModFallbackProbe?.exact === true &&
              run.pathCacheModFallbackProbe?.stats?.optimizedCalls === 0 &&
              run.pathCacheModFallbackProbe?.stats?.fallbackCalls > 0 &&
              run.pathCacheModFallbackProbe?.edgeStats?.optimizedCalls === 0 &&
              run.pathCacheModFallbackProbe?.edgeStats?.fallbackCalls > 0)) &&
          (!(tracePathfindingDirectTiles || probePathfindingTilesModFallback) ||
            (run.pathfindingDirectTilesStats?.calls > 0 &&
              (disablePathfindingDirectTiles || probePathfindingTilesModFallback
                ? run.pathfindingDirectTilesStats?.optimizedCalls === 0 &&
                  run.pathfindingDirectTilesStats?.fallbackCalls > 0
                : run.pathfindingDirectTilesStats?.optimizedCalls > 0 &&
                  run.pathfindingDirectTilesStats?.fallbackCalls === 0))) &&
          (!(
            tracePathfindingDirectSuccessors ||
            probePathfindingSuccessorsModFallback
          ) ||
            (run.pathfindingDirectSuccessorStats?.calls > 0 &&
              (disablePathfindingDirectSuccessors ||
              probePathfindingSuccessorsModFallback
                ? run.pathfindingDirectSuccessorStats?.optimizedCalls === 0 &&
                  run.pathfindingDirectSuccessorStats?.fallbackCalls > 0
                : run.pathfindingDirectSuccessorStats?.optimizedCalls > 0 &&
                  run.pathfindingDirectSuccessorStats?.fallbackCalls === 0))) &&
          (!tracePathfindingClosedFirstSuccessors ||
            (run.pathfindingClosedFirstSuccessorStats?.calls > 0 &&
              (disablePathfindingClosedFirstSuccessors
                ? run.pathfindingClosedFirstSuccessorStats?.optimizedCalls ===
                    0 &&
                  run.pathfindingClosedFirstSuccessorStats?.fallbackCalls > 0
                : run.pathfindingClosedFirstSuccessorStats?.optimizedCalls >
                    0 &&
                  run.pathfindingClosedFirstSuccessorStats?.fallbackCalls ===
                    0))) &&
          (!(
            tracePathfindingNumericCoordinateKeys ||
            verifyPathfindingNumericCoordinateKeys
          ) ||
            (run.pathfindingNumericCoordinateKeyStats?.calls > 0 &&
              (pathfindingNumericCoordinateKeysFallbackExpected
                ? run.pathfindingNumericCoordinateKeyStats?.optimizedCalls ===
                    0 &&
                  run.pathfindingNumericCoordinateKeyStats?.fallbackCalls > 0
                : run.pathfindingNumericCoordinateKeyStats?.optimizedCalls >
                  0) &&
              run.pathfindingNumericCoordinateKeyStats?.collisions === 0 &&
              (!verifyPathfindingNumericCoordinateKeys ||
                run.pathfindingNumericCoordinateKeyStats?.keyChecks > 0))) &&
          (!(
            tracePathfindingTileMembershipTable ||
            verifyPathfindingTileMembershipTable ||
            probePathfindingTileMembershipDependencyFallback
          ) ||
            (run.pathfindingTileMembershipTableStats?.calls > 0 &&
              (pathfindingTileMembershipTableFallbackExpected
                ? run.pathfindingTileMembershipTableStats?.optimizedCalls ===
                    0 &&
                  run.pathfindingTileMembershipTableStats?.fallbackCalls > 0
                : run.pathfindingTileMembershipTableStats?.optimizedCalls > 0 &&
                  run.pathfindingTileMembershipTableStats?.optimizedLookups >
                    0) &&
              run.pathfindingTileMembershipTableStats?.mismatches === 0 &&
              (!verifyPathfindingTileMembershipTable ||
                run.pathfindingTileMembershipTableStats?.verifierChecks >
                  0))) &&
          (!probePathfindingTileMembershipDependencyFallback ||
            (run.pathfindingTileMembershipDependencyProbe?.calls > 0 &&
              run.pathfindingTileMembershipDependencyProbe?.restored ===
                true)) &&
          (!probePathfindingNumericGetPathFallback ||
            (run.pathfindingNumericGetPathProbe?.calls > 0 &&
              run.pathfindingNumericGetPathProbe?.restored === true)) &&
          (!(
            tracePathfindingNumericContinuationIndex ||
            verifyPathfindingNumericContinuationIndex
          ) ||
            (run.pathfindingNumericContinuationIndexStats?.calls > 0 &&
              (pathfindingNumericContinuationIndexFallbackExpected
                ? run.pathfindingNumericContinuationIndexStats
                    ?.optimizedCalls === 0 &&
                  run.pathfindingNumericContinuationIndexStats?.fallbackCalls >
                    0 &&
                  run.pathfindingNumericContinuationIndexStats
                    ?.optimizedWriterCalls === 0 &&
                  run.pathfindingNumericContinuationIndexStats
                    ?.fallbackWriterCalls > 0
                : run.pathfindingNumericContinuationIndexStats?.optimizedCalls >
                    0 &&
                  run.pathfindingNumericContinuationIndexStats?.lookups > 0 &&
                  run.pathfindingNumericContinuationIndexStats?.writerCalls >
                    0 &&
                  run.pathfindingNumericContinuationIndexStats
                    ?.optimizedWriterCalls > 0 &&
                  run.pathfindingNumericContinuationIndexStats?.indexedWrites >
                    0) &&
              run.pathfindingNumericContinuationIndexStats?.mismatches === 0 &&
              run.pathfindingNumericContinuationIndexStats?.writerMismatches ===
                0 &&
              (!verifyPathfindingNumericContinuationIndex ||
                pathfindingNumericContinuationIndexFallbackExpected ||
                (run.pathfindingNumericContinuationIndexStats?.verifierChecks >
                  0 &&
                  run.pathfindingNumericContinuationIndexStats?.writerChecks >
                    0)))) &&
          (!(
            tracePathfindingTopCacheSingleRead ||
            probePathfindingTopCacheModFallback
          ) ||
            (run.pathfindingTopCacheSingleReadStats?.calls > 0 &&
              (disablePathfindingTopCacheSingleRead ||
              probePathfindingTopCacheModFallback
                ? run.pathfindingTopCacheSingleReadStats?.optimizedCalls ===
                    0 &&
                  run.pathfindingTopCacheSingleReadStats?.fallbackCalls > 0
                : run.pathfindingTopCacheSingleReadStats?.optimizedCalls > 0 &&
                  run.pathfindingTopCacheSingleReadStats?.fallbackCalls ===
                    0))) &&
          (!(
            tracePathfindingDeferredTileMetadata ||
            probePathfindingDeferredTileModFallback
          ) ||
            (run.pathfindingDeferredTileMetadataStats?.calls > 0 &&
              (disablePathfindingDeferredTileMetadata ||
              probePathfindingDeferredTileModFallback
                ? run.pathfindingDeferredTileMetadataStats?.optimizedCalls ===
                    0 &&
                  run.pathfindingDeferredTileMetadataStats?.fallbackCalls > 0
                : run.pathfindingDeferredTileMetadataStats?.optimizedCalls >
                    0 &&
                  run.pathfindingDeferredTileMetadataStats?.fallbackCalls ===
                    0))) &&
          (!(
            tracePathfindingOpenValues || probePathfindingOpenValuesModFallback
          ) ||
            (run.pathfindingOpenValuesStats?.calls > 0 &&
              (disablePathfindingOpenValues ||
              probePathfindingOpenValuesModFallback
                ? run.pathfindingOpenValuesStats?.optimizedCalls === 0 &&
                  run.pathfindingOpenValuesStats?.fallbackCalls > 0
                : run.pathfindingOpenValuesStats?.optimizedCalls > 0 &&
                  run.pathfindingOpenValuesStats?.fallbackCalls === 0))) &&
          (!tracePathfindingContinuationCacheLookup ||
            (run.pathfindingContinuationCacheLookupStats?.calls > 0 &&
              (disablePathfindingContinuationCacheLookup ||
              disablePathfindingHoistedCacheIndex ||
              probePathfindingTopCacheModFallback
                ? run.pathfindingContinuationCacheLookupStats
                    ?.optimizedCalls === 0 &&
                  run.pathfindingContinuationCacheLookupStats?.fallbackCalls > 0
                : run.pathfindingContinuationCacheLookupStats?.optimizedCalls >
                  0))) &&
          (!tracePathfindingHoistedCacheIndex ||
            (run.pathfindingHoistedCacheIndexStats?.calls > 0 &&
              (disablePathfindingHoistedCacheIndex
                ? run.pathfindingHoistedCacheIndexStats?.optimizedCalls === 0 &&
                  run.pathfindingHoistedCacheIndexStats?.fallbackCalls > 0
                : run.pathfindingHoistedCacheIndexStats?.optimizedCalls > 0 &&
                  run.pathfindingHoistedCacheIndexStats?.fallbackCalls ===
                    0))) &&
          (!traceMapGenerationPathfindingDirectFallback ||
            (statusDelta(pathfindingBefore, pathfindingAfter).calls > 0 &&
              statusDelta(pathfindingBefore, pathfindingAfter).nativeCalls ===
                0 &&
              statusDelta(pathfindingBefore, pathfindingAfter).fallbackCalls >
                0 &&
              (disableMapGenerationPathfindingDirectFallback ||
              probeMapGenerationPathfindingHookFallback
                ? run.mapGenerationPathfindingDirectFallbackStats
                    ?.optimizedMaps === 0 &&
                  run.mapGenerationPathfindingDirectFallbackStats
                    ?.fallbackMaps === mapCount
                : run.mapGenerationPathfindingDirectFallbackStats
                    ?.optimizedMaps === mapCount &&
                  run.mapGenerationPathfindingDirectFallbackStats
                    ?.fallbackMaps === 0))) &&
          (!probeMapGenerationPathfindingHookFallback ||
            (run.mapGenerationPathfindingHookProbe?.calls > 0 &&
              run.mapGenerationPathfindingHookProbe?.removed === true)),
        reasons: [
          ...(run.results.length === mapCount
            ? []
            : [`generated ${run.results.length} of ${mapCount} maps`]),
          ...(run.results.every((entry) => entry.accessible)
            ? []
            : ["at least one generated map was inaccessible"]),
          ...(restore.loaded
            ? []
            : ["the pre-profile snapshot did not restore"]),
          ...(restore.loaded && !restore.exact
            ? ["the restored map identity differs from the pre-profile state"]
            : []),
          ...(probeEnemySelectorModFallback &&
          (statusDelta(enemySelectorBefore, enemySelectorAfter).nativeCalls !==
            0 ||
            statusDelta(enemySelectorBefore, enemySelectorAfter)
              .fallbackCalls === 0)
            ? ["the mod replacement did not force the selector fallback"]
            : []),
          ...((probeEnemySelectorWeightedQueryCache ||
            probeEnemySelectorWeightedSingleTagCache ||
            probeEnemySelectorWeightedFilterTagCache) &&
          (!(run.enemySelectorProbe?.weightedQueryCacheCalls > 0) ||
            !(run.enemySelectorProbe?.weightedQueryCacheBuilds > 0) ||
            !(run.enemySelectorProbe?.weightedQueryCacheHits > 0) ||
            !(run.enemySelectorProbe?.weightedQueryEnemiesElided > 0) ||
            ((probeEnemySelectorWeightedSingleTagCache ||
              probeEnemySelectorWeightedFilterTagCache) &&
              (!(run.enemySelectorProbe?.weightedSingleTagCacheCalls > 0) ||
                !(run.enemySelectorProbe?.weightedSingleTagCacheBuilds > 0) ||
                !(run.enemySelectorProbe?.weightedSingleTagCacheHits > 0) ||
                !(
                  run.enemySelectorProbe?.weightedSingleTagEnemiesElided > 0
                ))) ||
            (probeEnemySelectorWeightedFilterTagCache &&
              (!(run.enemySelectorProbe?.weightedFilterTagCacheCalls > 0) ||
                !(run.enemySelectorProbe?.weightedFilterTagCacheBuilds > 0) ||
                !(run.enemySelectorProbe?.weightedFilterTagCacheHits > 0) ||
                !(run.enemySelectorProbe?.weightedFilterTagEnemiesElided > 0))))
            ? ["the weighted enemy-query cache was not exercised"]
            : []),
          ...((traceEnemySelectorAngerCache ||
            probeEnemySelectorAngerHookFallback ||
            probeEnemySelectorAngerCatalogFallback) &&
          (disableEnemySelectorAngerCache ||
          probeEnemySelectorAngerHookFallback ||
          probeEnemySelectorAngerCatalogFallback
            ? run.enemySelectorAngerCacheStats?.optimizedCalls !== 0 ||
              !(run.enemySelectorAngerCacheStats?.fallbackCalls > 0) ||
              (probeEnemySelectorAngerCatalogFallback &&
                !(run.enemySelectorAngerCacheStats?.validationFailures > 0))
            : !(run.enemySelectorAngerCacheStats?.optimizedCalls > 0) ||
              run.enemySelectorAngerCacheStats?.fallbackCalls !== 0 ||
              !(run.enemySelectorAngerCacheStats?.cacheBuilds > 0) ||
              !(run.enemySelectorAngerCacheStats?.cacheHits > 0) ||
              run.enemySelectorAngerCacheStats?.validationFailures !== 0)
            ? [
                "the enemy-selector anger cache did not match the requested mode",
              ]
            : []),
          ...(probeEnemySelectorAngerHookFallback &&
          (!(run.enemySelectorAngerHookProbe?.calls > 0) ||
            run.enemySelectorAngerHookProbe?.removed !== true)
            ? [
                "the map-generation hook did not disable and restore the anger cache cleanly",
              ]
            : []),
          ...(probeEnemySelectorAngerCatalogFallback &&
          run.enemySelectorAngerCatalogProbe?.restored !== true
            ? [
                "the accessor-based catalog compatibility probe did not restore cleanly",
              ]
            : []),
          ...((traceEnemySelectorLongTagCache ||
            probeEnemySelectorLongTagHookFallback ||
            probeEnemySelectorLongTagCatalogFallback) &&
          (disableEnemySelectorLongTagCache ||
          probeEnemySelectorLongTagHookFallback ||
          probeEnemySelectorLongTagCatalogFallback
            ? run.enemySelectorLongTagCacheStats?.optimizedCalls !== 0 ||
              !(run.enemySelectorLongTagCacheStats?.fallbackCalls > 0) ||
              (probeEnemySelectorLongTagCatalogFallback &&
                !(run.enemySelectorLongTagCacheStats?.validationFailures > 0))
            : !(run.enemySelectorLongTagCacheStats?.optimizedCalls > 0) ||
              run.enemySelectorLongTagCacheStats?.fallbackCalls !== 0 ||
              !(run.enemySelectorLongTagCacheStats?.cacheBuilds > 0) ||
              !(run.enemySelectorLongTagCacheStats?.cacheHits > 0) ||
              !(run.enemySelectorLongTagCacheStats?.querySequences > 0) ||
              run.enemySelectorLongTagCacheStats?.validationFailures !== 0)
            ? [
                "the enemy-selector long-tag cache did not match the requested mode",
              ]
            : []),
          ...(probeEnemySelectorLongTagHookFallback &&
          (!(run.enemySelectorLongTagHookProbe?.calls > 0) ||
            run.enemySelectorLongTagHookProbe?.removed !== true)
            ? [
                "the map-generation hook did not disable and restore the long-tag cache cleanly",
              ]
            : []),
          ...(probeEnemySelectorLongTagCatalogFallback &&
          run.enemySelectorLongTagCatalogProbe?.restored !== true
            ? [
                "the long-tag accessor compatibility probe did not restore cleanly",
              ]
            : []),
          ...(traceEnemySelectorWeightedQueryCache &&
          (weightedQueryFallbackExpected
            ? run.enemySelectorWeightedQueryCacheStats?.optimizedCalls !== 0 ||
              !(run.enemySelectorWeightedQueryCacheStats?.fallbackCalls > 0) ||
              run.enemySelectorWeightedQueryCacheStats?.cacheBuilds !== 0 ||
              run.enemySelectorWeightedQueryCacheStats?.cacheHits !== 0 ||
              run.enemySelectorWeightedQueryCacheStats?.enemiesElided !== 0 ||
              (weightedQueryCatalogFallbackExpected
                ? !(
                    run.enemySelectorWeightedQueryCacheStats
                      ?.validationFailures > 0
                  )
                : run.enemySelectorWeightedQueryCacheStats
                    ?.validationFailures !== 0)
            : !(run.enemySelectorWeightedQueryCacheStats?.optimizedCalls > 0) ||
              !(run.enemySelectorWeightedQueryCacheStats?.fallbackCalls > 0) ||
              !(run.enemySelectorWeightedQueryCacheStats?.cacheBuilds > 0) ||
              !(run.enemySelectorWeightedQueryCacheStats?.cacheHits > 0) ||
              !(run.enemySelectorWeightedQueryCacheStats?.enemiesElided > 0) ||
              run.enemySelectorWeightedQueryCacheStats?.validationFailures !==
                0)
            ? [
                "the weighted enemy-query cache did not match the requested mode",
              ]
            : []),
          ...((probeRestraintEquivalence || verifyRestraintRetryReuse) &&
          (!(run.restraintEligibleProbe?.comparedCalls > 0) ||
            run.restraintEligibleProbe?.mismatches !== 0)
            ? ["the restraint candidate differed from the official result"]
            : []),
          ...(probeRestraintCatalogFastPathCeiling &&
          (!(run.restraintEligibleProbe?.calls > 0) ||
            !(run.restraintEligibleProbe?.forcedFastPathRestraints > 0))
            ? ["the restraint catalog fast-path ceiling was not exercised"]
            : []),
          ...(probeAccessibleFrontierSingleRead &&
          !(
            Number(run.accessibleFrontierProbe?.accessibleCalls ?? 0) +
              Number(run.accessibleFrontierProbe?.roomCalls ?? 0) >
            0
          )
            ? ["the accessibility frontier single-read probe was not exercised"]
            : []),
          ...(probeAccessibleNeighborSingleRead &&
          !(
            Number(run.accessibleNeighborProbe?.accessibleCalls ?? 0) +
              Number(run.accessibleNeighborProbe?.roomCalls ?? 0) >
            0
          )
            ? ["the accessibility neighbor single-read probe was not exercised"]
            : []),
          ...(probeAccessibleQueue &&
          !(
            Number(run.accessibleQueueProbe?.accessibleCalls ?? 0) +
              Number(run.accessibleQueueProbe?.roomCalls ?? 0) >
            0
          )
            ? ["the accessibility queue probe was not exercised"]
            : []),
          ...(verifyAccessibleQueue &&
          (!(run.accessibleQueueProbe?.comparedCalls > 0) ||
            run.accessibleQueueProbe?.mismatches !== 0)
            ? [
                "the accessibility queue candidate differed from the official result",
              ]
            : []),
          ...((traceAccessibleQueueSource ||
            probeAccessibleQueueSourceModFallback) &&
          (!(
            Number(run.accessibleQueueSourceStats?.accessibleCalls ?? 0) +
              Number(run.accessibleQueueSourceStats?.roomCalls ?? 0) >
            0
          ) ||
            (accessibleQueueSourceFallbackExpected
              ? run.accessibleQueueSourceStats?.optimizedCalls !== 0 ||
                !(run.accessibleQueueSourceStats?.fallbackCalls > 0)
              : !(run.accessibleQueueSourceStats?.optimizedCalls > 0) ||
                run.accessibleQueueSourceStats?.fallbackCalls !== 0))
            ? [
                "the source accessibility queue did not match the requested mode",
              ]
            : []),
          ...(probeAccessibleQueueSourceModFallback &&
          (!(run.accessibleQueueSourceModFallbackProbe?.calls > 0) ||
            run.accessibleQueueSourceModFallbackProbe?.restored !== true)
            ? [
                "the Object.entries replacement did not force and restore accessibility fallback",
              ]
            : []),
          ...(probePlaceDoorsAccessibleReuse &&
          (!(run.placeDoorsAccessibleReuseStats?.calls > 0) ||
            !(run.placeDoorsAccessibleReuseStats?.cacheHits > 0) ||
            !(run.placeDoorsAccessibleReuseStats?.officialCalls > 0) ||
            run.placeDoorsAccessibleReuseStats?.restored !== true ||
            (verifyPlaceDoorsAccessibleReuse &&
              (!(run.placeDoorsAccessibleReuseStats?.comparedCalls > 0) ||
                run.placeDoorsAccessibleReuseStats?.mismatches !== 0)))
            ? [
                "the door-placement room reuse was not exercised and restored cleanly",
              ]
            : []),
          ...(tracePlaceDoorsAccessibleReuseSource &&
          (!(run.placeDoorsAccessibleReuseSourceStats?.calls > 0) ||
            (placeDoorsAccessibleReuseSourceFallbackExpected
              ? run.placeDoorsAccessibleReuseSourceStats?.optimizedCalls !==
                  0 ||
                !(
                  run.placeDoorsAccessibleReuseSourceStats?.fallbackCalls > 0
                ) ||
                run.placeDoorsAccessibleReuseSourceStats?.reuses !== 0 ||
                !(run.placeDoorsAccessibleReuseSourceStats?.officialCalls > 0)
              : !(
                  run.placeDoorsAccessibleReuseSourceStats?.optimizedCalls > 0
                ) ||
                run.placeDoorsAccessibleReuseSourceStats?.fallbackCalls !== 0 ||
                !(run.placeDoorsAccessibleReuseSourceStats?.reuses > 0) ||
                run.placeDoorsAccessibleReuseSourceStats?.officialCalls !== 0))
            ? [
                "the source door-placement room reuse did not match the requested mode",
              ]
            : []),
          ...(probeMapTileFillingCoordinateReuse &&
          (!(run.mapTileFillingCoordinateReuseStats?.calls > 0) ||
            run.mapTileFillingCoordinateReuseStats?.restored !== true ||
            (verifyMapTileFillingCoordinateReuse &&
              (!(run.mapTileFillingCoordinateReuseStats?.comparedCalls > 0) ||
                run.mapTileFillingCoordinateReuseStats?.mismatches !== 0)))
            ? [
                "the map-tile filling coordinate reuse did not match and restore cleanly",
              ]
            : []),
          ...(traceMapTileFillingCoordinateReuseSource &&
          (!(run.mapTileFillingCoordinateReuseSourceStats?.calls > 0) ||
            (mapTileFillingCoordinateReuseSourceFallbackExpected
              ? run.mapTileFillingCoordinateReuseSourceStats?.optimizedCalls !==
                  0 ||
                !(
                  run.mapTileFillingCoordinateReuseSourceStats?.fallbackCalls >
                  0
                ) ||
                run.mapTileFillingCoordinateReuseSourceStats?.fitChecks !== 0
              : !(
                  run.mapTileFillingCoordinateReuseSourceStats?.optimizedCalls >
                  0
                ) ||
                run.mapTileFillingCoordinateReuseSourceStats?.fallbackCalls !==
                  0 ||
                !(run.mapTileFillingCoordinateReuseSourceStats?.fitChecks > 0)))
            ? [
                "the source map-tile filling coordinate reuse did not match the requested mode",
              ]
            : []),
          ...(probeMapTileFillingCoordinateReuseSourceEquivalence &&
          (!(
            run.mapTileFillingCoordinateReuseSourceEquivalenceProbe?.calls > 0
          ) ||
            run.mapTileFillingCoordinateReuseSourceEquivalenceProbe
              ?.mismatches !== 0 ||
            run.mapTileFillingCoordinateReuseSourceEquivalenceProbe
              ?.restored !== true)
            ? [
                "the source map-tile filling helper differed from the official result",
              ]
            : []),
          ...(probePasteTileSerializedCache &&
          (!(run.pasteTileSerializedCacheStats?.calls > 0) ||
            !(run.pasteTileSerializedCacheStats?.cacheHits > 0) ||
            !(run.pasteTileSerializedCacheStats?.cacheMisses > 0) ||
            run.pasteTileSerializedCacheStats?.restored !== true ||
            (verifyPasteTileSerializedCache &&
              (!(run.pasteTileSerializedCacheStats?.verifiedHits > 0) ||
                run.pasteTileSerializedCacheStats?.mismatches !== 0)))
            ? [
                "the paste-tile serialized cache was not exercised and restored cleanly",
              ]
            : []),
          ...(tracePasteTileSerializedCacheSource &&
          (!(run.pasteTileSerializedCacheSourceStats?.calls > 0) ||
            (pasteTileSerializedCacheSourceFallbackExpected
              ? run.pasteTileSerializedCacheSourceStats?.optimizedCalls !== 0 ||
                !(run.pasteTileSerializedCacheSourceStats?.fallbackCalls > 0) ||
                run.pasteTileSerializedCacheSourceStats?.hits !== 0
              : !(
                  run.pasteTileSerializedCacheSourceStats?.optimizedCalls > 0
                ) ||
                run.pasteTileSerializedCacheSourceStats?.fallbackCalls !== 0 ||
                !(run.pasteTileSerializedCacheSourceStats?.hits > 0) ||
                !(run.pasteTileSerializedCacheSourceStats?.misses > 0) ||
                (verifyPasteTileSerializedCacheSource &&
                  (!(
                    run.pasteTileSerializedCacheSourceStats?.verifications > 0
                  ) ||
                    run.pasteTileSerializedCacheSourceStats?.mismatches !==
                      0))))
            ? [
                "the source paste-tile serialized cache did not match the requested mode",
              ]
            : []),
          ...(probeRestraintModFallback &&
          (run.restraintSourceStats?.optimizedRestraints !== 0 ||
            !(run.restraintSourceStats?.fallbackRestraints > 0))
            ? ["the Map helper replacement did not force restraint fallback"]
            : []),
          ...((probePathCacheEquivalence ||
            probePathCacheSkipExistingEquivalence ||
            probePathCacheEdgeIdentityEquivalence) &&
          (!(run.pathCacheProbe?.comparedCalls > 0) ||
            run.pathCacheProbe?.mismatches !== 0)
            ? ["the path-cache candidate differed from the official result"]
            : []),
          ...(probePathCacheCallReuse &&
          (!(run.pathCacheProbe?.calls > 0) ||
            !(run.pathCacheProbe?.distinctPaths > 0))
            ? ["the path-cache call-reuse probe was not exercised"]
            : []),
          ...(tracePathCacheSource &&
          (!(run.pathCacheSourceStats?.calls > 0) ||
            (disablePathCacheSingleSlice
              ? run.pathCacheSourceStats?.optimizedCalls !== 0 ||
                !(run.pathCacheSourceStats?.fallbackCalls > 0)
              : !(run.pathCacheSourceStats?.optimizedCalls > 0) ||
                run.pathCacheSourceStats?.fallbackCalls !== 0))
            ? ["the source path-cache branch did not match the requested mode"]
            : []),
          ...(tracePathCacheHoistedKeySuffix &&
          (!(run.pathCacheHoistedKeySuffixStats?.calls > 0) ||
            (disablePathCacheHoistedKeySuffix
              ? run.pathCacheHoistedKeySuffixStats?.optimizedCalls !== 0 ||
                !(run.pathCacheHoistedKeySuffixStats?.fallbackCalls > 0)
              : !(run.pathCacheHoistedKeySuffixStats?.optimizedCalls > 0) ||
                run.pathCacheHoistedKeySuffixStats?.fallbackCalls !== 0))
            ? [
                "the path-cache key-suffix branch did not match the requested mode",
              ]
            : []),
          ...((traceMapGenerationPathCacheEdgeIdentitySkip ||
            probeMapGenerationPathCacheModFallback) &&
          (!(run.pathCacheEdgeIdentitySkipStats?.calls > 0) ||
            (pathCacheEdgeIdentitySourceFallbackExpected
              ? run.pathCacheEdgeIdentitySkipStats?.optimizedCalls !== 0 ||
                !(run.pathCacheEdgeIdentitySkipStats?.fallbackCalls > 0) ||
                run.pathCacheEdgeIdentitySkipStats?.skippedEntries !== 0
              : !(run.pathCacheEdgeIdentitySkipStats?.optimizedCalls > 0) ||
                run.pathCacheEdgeIdentitySkipStats?.fallbackCalls !== 0 ||
                !(run.pathCacheEdgeIdentitySkipStats?.skippedEntries > 0)) ||
            (pathCacheEdgeIdentityScopeFallbackExpected
              ? run.mapGenerationPathCacheEdgeIdentityStats?.optimizedMaps !==
                  0 ||
                run.mapGenerationPathCacheEdgeIdentityStats?.fallbackMaps !==
                  mapCount
              : run.mapGenerationPathCacheEdgeIdentityStats?.optimizedMaps !==
                  mapCount ||
                run.mapGenerationPathCacheEdgeIdentityStats?.fallbackMaps !==
                  0))
            ? [
                "the map-generation path-cache edge-identity branch did not match the requested mode",
              ]
            : []),
          ...((tracePathCacheKnownTail ||
            verifyPathCacheKnownTail ||
            probePathCacheKnownTailWriterFallback) &&
          (!(run.pathCacheKnownTailStats?.calls > 0) ||
            (pathCacheKnownTailFallbackExpected
              ? run.pathCacheKnownTailStats?.optimizedCalls !== 0 ||
                !(run.pathCacheKnownTailStats?.fallbackCalls > 0) ||
                run.pathCacheKnownTailStats?.skippedEntries !== 0
              : !(run.pathCacheKnownTailStats?.optimizedCalls > 0) ||
                !(run.pathCacheKnownTailStats?.skippedEntries > 0)) ||
            (verifyPathCacheKnownTail &&
              (!(run.pathCacheKnownTailStats?.verifiedEntries > 0) ||
                run.pathCacheKnownTailStats?.mismatches !== 0)))
            ? [
                "the path-cache known-tail branch did not match the requested mode",
              ]
            : []),
          ...(probePathCacheKnownTailWriterFallback &&
          (!(run.pathCacheKnownTailWriterProbe?.calls > 0) ||
            run.pathCacheKnownTailWriterProbe?.restored !== true)
            ? [
                "the path-cache writer replacement was not exercised and restored cleanly",
              ]
            : []),
          ...(probeMapGenerationPathCacheModFallback &&
          (run.mapGenerationPathCacheModProbe?.activeLength !==
            run.mapGenerationPathCacheModProbe?.initialLength + 1 ||
            run.mapGenerationPathCacheModProbe?.restored !== true)
            ? ["the loaded-mod path-cache probe did not restore its registry"]
            : []),
          ...(probePathCacheModFallback &&
          (run.pathCacheModFallbackProbe?.exact !== true ||
            run.pathCacheModFallbackProbe?.stats?.optimizedCalls !== 0 ||
            !(run.pathCacheModFallbackProbe?.stats?.fallbackCalls > 0) ||
            run.pathCacheModFallbackProbe?.edgeStats?.optimizedCalls !== 0 ||
            !(run.pathCacheModFallbackProbe?.edgeStats?.fallbackCalls > 0))
            ? ["the array subclass did not take the exact path-cache fallback"]
            : []),
          ...((tracePathfindingDirectTiles ||
            probePathfindingTilesModFallback) &&
          (!(run.pathfindingDirectTilesStats?.calls > 0) ||
            (disablePathfindingDirectTiles || probePathfindingTilesModFallback
              ? run.pathfindingDirectTilesStats?.optimizedCalls !== 0 ||
                !(run.pathfindingDirectTilesStats?.fallbackCalls > 0)
              : !(run.pathfindingDirectTilesStats?.optimizedCalls > 0) ||
                run.pathfindingDirectTilesStats?.fallbackCalls !== 0))
            ? ["the direct-tile source branch did not match the requested mode"]
            : []),
          ...((tracePathfindingDirectSuccessors ||
            probePathfindingSuccessorsModFallback) &&
          (!(run.pathfindingDirectSuccessorStats?.calls > 0) ||
            (disablePathfindingDirectSuccessors ||
            probePathfindingSuccessorsModFallback
              ? run.pathfindingDirectSuccessorStats?.optimizedCalls !== 0 ||
                !(run.pathfindingDirectSuccessorStats?.fallbackCalls > 0)
              : !(run.pathfindingDirectSuccessorStats?.optimizedCalls > 0) ||
                run.pathfindingDirectSuccessorStats?.fallbackCalls !== 0))
            ? [
                "the direct-successor source branch did not match the requested mode",
              ]
            : []),
          ...(tracePathfindingClosedFirstSuccessors &&
          (!(run.pathfindingClosedFirstSuccessorStats?.calls > 0) ||
            (disablePathfindingClosedFirstSuccessors
              ? run.pathfindingClosedFirstSuccessorStats?.optimizedCalls !==
                  0 ||
                !(run.pathfindingClosedFirstSuccessorStats?.fallbackCalls > 0)
              : !(
                  run.pathfindingClosedFirstSuccessorStats?.optimizedCalls > 0
                ) ||
                run.pathfindingClosedFirstSuccessorStats?.fallbackCalls !== 0))
            ? [
                "the closed-first successor branch did not match the requested mode",
              ]
            : []),
          ...((tracePathfindingNumericCoordinateKeys ||
            verifyPathfindingNumericCoordinateKeys) &&
          (!(run.pathfindingNumericCoordinateKeyStats?.calls > 0) ||
            (pathfindingNumericCoordinateKeysFallbackExpected
              ? run.pathfindingNumericCoordinateKeyStats?.optimizedCalls !==
                  0 ||
                !(run.pathfindingNumericCoordinateKeyStats?.fallbackCalls > 0)
              : !(
                  run.pathfindingNumericCoordinateKeyStats?.optimizedCalls > 0
                )) ||
            run.pathfindingNumericCoordinateKeyStats?.collisions !== 0 ||
            (verifyPathfindingNumericCoordinateKeys &&
              !(run.pathfindingNumericCoordinateKeyStats?.keyChecks > 0)))
            ? [
                "the numeric-coordinate pathfinding branch did not match the requested mode",
              ]
            : []),
          ...((tracePathfindingTileMembershipTable ||
            verifyPathfindingTileMembershipTable ||
            probePathfindingTileMembershipDependencyFallback) &&
          (!(run.pathfindingTileMembershipTableStats?.calls > 0) ||
            (pathfindingTileMembershipTableFallbackExpected
              ? run.pathfindingTileMembershipTableStats?.optimizedCalls !== 0 ||
                !(run.pathfindingTileMembershipTableStats?.fallbackCalls > 0)
              : !(
                  run.pathfindingTileMembershipTableStats?.optimizedCalls > 0
                ) ||
                !(
                  run.pathfindingTileMembershipTableStats?.optimizedLookups > 0
                )) ||
            run.pathfindingTileMembershipTableStats?.mismatches !== 0 ||
            (verifyPathfindingTileMembershipTable &&
              !(run.pathfindingTileMembershipTableStats?.verifierChecks > 0)))
            ? [
                "the pathfinding tile-membership table did not match the requested mode",
              ]
            : []),
          ...(probePathfindingTileMembershipDependencyFallback &&
          (!(run.pathfindingTileMembershipDependencyProbe?.calls > 0) ||
            run.pathfindingTileMembershipDependencyProbe?.restored !== true)
            ? [
                "the tile-membership dependency fallback was not exercised and restored",
              ]
            : []),
          ...(probePathfindingNumericGetPathFallback &&
          (!(run.pathfindingNumericGetPathProbe?.calls > 0) ||
            run.pathfindingNumericGetPathProbe?.restored !== true)
            ? [
                "the numeric-coordinate get-path dependency fallback was not exercised and restored",
              ]
            : []),
          ...((tracePathfindingNumericContinuationIndex ||
            verifyPathfindingNumericContinuationIndex) &&
          (!(run.pathfindingNumericContinuationIndexStats?.calls > 0) ||
            (pathfindingNumericContinuationIndexFallbackExpected
              ? run.pathfindingNumericContinuationIndexStats?.optimizedCalls !==
                  0 ||
                !(
                  run.pathfindingNumericContinuationIndexStats?.fallbackCalls >
                  0
                ) ||
                run.pathfindingNumericContinuationIndexStats
                  ?.optimizedWriterCalls !== 0 ||
                !(
                  run.pathfindingNumericContinuationIndexStats
                    ?.fallbackWriterCalls > 0
                )
              : !(
                  run.pathfindingNumericContinuationIndexStats?.optimizedCalls >
                  0
                ) ||
                !(run.pathfindingNumericContinuationIndexStats?.lookups > 0) ||
                !(
                  run.pathfindingNumericContinuationIndexStats?.writerCalls > 0
                ) ||
                !(
                  run.pathfindingNumericContinuationIndexStats
                    ?.optimizedWriterCalls > 0
                ) ||
                !(
                  run.pathfindingNumericContinuationIndexStats?.indexedWrites >
                  0
                )) ||
            run.pathfindingNumericContinuationIndexStats?.mismatches !== 0 ||
            run.pathfindingNumericContinuationIndexStats?.writerMismatches !==
              0 ||
            (verifyPathfindingNumericContinuationIndex &&
              !pathfindingNumericContinuationIndexFallbackExpected &&
              (!(
                run.pathfindingNumericContinuationIndexStats?.verifierChecks > 0
              ) ||
                !(
                  run.pathfindingNumericContinuationIndexStats?.writerChecks > 0
                ))))
            ? [
                "the numeric continuation-cache index did not match the requested mode",
              ]
            : []),
          ...((tracePathfindingTopCacheSingleRead ||
            probePathfindingTopCacheModFallback) &&
          (!(run.pathfindingTopCacheSingleReadStats?.calls > 0) ||
            (disablePathfindingTopCacheSingleRead ||
            probePathfindingTopCacheModFallback
              ? run.pathfindingTopCacheSingleReadStats?.optimizedCalls !== 0 ||
                !(run.pathfindingTopCacheSingleReadStats?.fallbackCalls > 0)
              : !(run.pathfindingTopCacheSingleReadStats?.optimizedCalls > 0) ||
                run.pathfindingTopCacheSingleReadStats?.fallbackCalls !== 0))
            ? [
                "the top path-cache single-read branch did not match the requested mode",
              ]
            : []),
          ...((tracePathfindingDeferredTileMetadata ||
            probePathfindingDeferredTileModFallback) &&
          (!(run.pathfindingDeferredTileMetadataStats?.calls > 0) ||
            (disablePathfindingDeferredTileMetadata ||
            probePathfindingDeferredTileModFallback
              ? run.pathfindingDeferredTileMetadataStats?.optimizedCalls !==
                  0 ||
                !(run.pathfindingDeferredTileMetadataStats?.fallbackCalls > 0)
              : !(
                  run.pathfindingDeferredTileMetadataStats?.optimizedCalls > 0
                ) ||
                run.pathfindingDeferredTileMetadataStats?.fallbackCalls !== 0))
            ? [
                "the deferred tile-metadata branch did not match the requested mode",
              ]
            : []),
          ...((tracePathfindingOpenValues ||
            probePathfindingOpenValuesModFallback) &&
          (!(run.pathfindingOpenValuesStats?.calls > 0) ||
            (disablePathfindingOpenValues ||
            probePathfindingOpenValuesModFallback
              ? run.pathfindingOpenValuesStats?.optimizedCalls !== 0 ||
                !(run.pathfindingOpenValuesStats?.fallbackCalls > 0)
              : !(run.pathfindingOpenValuesStats?.optimizedCalls > 0) ||
                run.pathfindingOpenValuesStats?.fallbackCalls !== 0))
            ? ["the open-values source branch did not match the requested mode"]
            : []),
          ...(tracePathfindingContinuationCacheLookup &&
          (!(run.pathfindingContinuationCacheLookupStats?.calls > 0) ||
            (disablePathfindingContinuationCacheLookup ||
            disablePathfindingHoistedCacheIndex ||
            probePathfindingTopCacheModFallback
              ? run.pathfindingContinuationCacheLookupStats?.optimizedCalls !==
                  0 ||
                !(
                  run.pathfindingContinuationCacheLookupStats?.fallbackCalls > 0
                )
              : !(
                  run.pathfindingContinuationCacheLookupStats?.optimizedCalls >
                  0
                )))
            ? [
                "the continuation-cache lookup branch did not match the requested mode",
              ]
            : []),
          ...(tracePathfindingHoistedCacheIndex &&
          (!(run.pathfindingHoistedCacheIndexStats?.calls > 0) ||
            (disablePathfindingHoistedCacheIndex
              ? run.pathfindingHoistedCacheIndexStats?.optimizedCalls !== 0 ||
                !(run.pathfindingHoistedCacheIndexStats?.fallbackCalls > 0)
              : !(run.pathfindingHoistedCacheIndexStats?.optimizedCalls > 0) ||
                run.pathfindingHoistedCacheIndexStats?.fallbackCalls !== 0))
            ? [
                "the hoisted-cache-index source branch did not match the requested mode",
              ]
            : []),
          ...(traceMapGenerationPathfindingDirectFallback &&
          (!(statusDelta(pathfindingBefore, pathfindingAfter).calls > 0) ||
            statusDelta(pathfindingBefore, pathfindingAfter).nativeCalls !==
              0 ||
            !(
              statusDelta(pathfindingBefore, pathfindingAfter).fallbackCalls > 0
            ) ||
            (disableMapGenerationPathfindingDirectFallback ||
            probeMapGenerationPathfindingHookFallback
              ? run.mapGenerationPathfindingDirectFallbackStats
                  ?.optimizedMaps !== 0 ||
                run.mapGenerationPathfindingDirectFallbackStats
                  ?.fallbackMaps !== mapCount
              : run.mapGenerationPathfindingDirectFallbackStats
                  ?.optimizedMaps !== mapCount ||
                run.mapGenerationPathfindingDirectFallbackStats
                  ?.fallbackMaps !== 0))
            ? [
                "the map-generation pathfinding fallback did not match the requested mode",
              ]
            : []),
          ...(probeMapGenerationPathfindingHookFallback &&
          (!(run.mapGenerationPathfindingHookProbe?.calls > 0) ||
            run.mapGenerationPathfindingHookProbe?.removed !== true)
            ? [
                "the live pathfinding hook was not exercised and removed cleanly",
              ]
            : []),
        ],
      },
      profile: summarizeProfile(stopped.profile),
    };
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await configurePathfinding(client, "native");
    pathfindingConfigured = false;
    process.stdout.write(
      `${JSON.stringify(
        {
          output: outputPath,
          acceptance: report.acceptance,
          run: {
            maps: report.run.maps,
            totalMilliseconds: report.run.totalMilliseconds,
            medianMilliseconds: report.run.medianMilliseconds,
            p95Milliseconds: report.run.p95Milliseconds,
            maximumMilliseconds: report.run.maximumMilliseconds,
            allAccessible: report.run.allAccessible,
            uniqueSignatures: report.run.uniqueSignatures,
            pathfindingDelta: report.run.pathfindingDelta,
            enemySelectorDelta: report.run.enemySelectorDelta,
            enemySelectorProbe: report.run.enemySelectorProbe,
            enemySelectorAngerCacheStats:
              report.run.enemySelectorAngerCacheStats,
            enemySelectorAngerCatalogProbe:
              report.run.enemySelectorAngerCatalogProbe,
            enemySelectorAngerHookProbe: report.run.enemySelectorAngerHookProbe,
            enemySelectorLongTagCacheStats:
              report.run.enemySelectorLongTagCacheStats,
            enemySelectorLongTagCatalogProbe:
              report.run.enemySelectorLongTagCatalogProbe,
            enemySelectorLongTagHookProbe:
              report.run.enemySelectorLongTagHookProbe,
            enemySelectorWeightedQueryCacheStats:
              report.run.enemySelectorWeightedQueryCacheStats,
            restraintEligibleProbe: report.run.restraintEligibleProbe,
            restraintSourceStats: report.run.restraintSourceStats,
            accessibleFrontierProbe: report.run.accessibleFrontierProbe,
            accessibleNeighborProbe: report.run.accessibleNeighborProbe,
            accessibleQueueProbe: report.run.accessibleQueueProbe,
            accessibleQueueSourceStats: report.run.accessibleQueueSourceStats,
            accessibleQueueSourceModFallbackProbe:
              report.run.accessibleQueueSourceModFallbackProbe,
            placeDoorsAccessibleReuseStats:
              report.run.placeDoorsAccessibleReuseStats,
            placeDoorsAccessibleReuseSourceStats:
              report.run.placeDoorsAccessibleReuseSourceStats,
            mapTileFillingCoordinateReuseStats:
              report.run.mapTileFillingCoordinateReuseStats,
            mapTileFillingCoordinateReuseSourceStats:
              report.run.mapTileFillingCoordinateReuseSourceStats,
            mapTileFillingCoordinateReuseSourceEquivalenceProbe:
              report.run.mapTileFillingCoordinateReuseSourceEquivalenceProbe,
            pasteTileSerializedCacheStats:
              report.run.pasteTileSerializedCacheStats,
            pasteTileSerializedCacheSourceStats:
              report.run.pasteTileSerializedCacheSourceStats,
            pathCacheProbe: report.run.pathCacheProbe,
            pathCacheSourceStats: report.run.pathCacheSourceStats,
            pathCacheHoistedKeySuffixStats:
              report.run.pathCacheHoistedKeySuffixStats,
            pathCacheEdgeIdentitySkipStats:
              report.run.pathCacheEdgeIdentitySkipStats,
            pathCacheKnownTailStats: report.run.pathCacheKnownTailStats,
            pathCacheKnownTailWriterProbe:
              report.run.pathCacheKnownTailWriterProbe,
            pathCacheCounters: report.run.pathCacheCounters,
            pathCacheModFallbackProbe: report.run.pathCacheModFallbackProbe,
            pathfindingDirectTilesStats: report.run.pathfindingDirectTilesStats,
            pathfindingDirectSuccessorStats:
              report.run.pathfindingDirectSuccessorStats,
            pathfindingClosedFirstSuccessorStats:
              report.run.pathfindingClosedFirstSuccessorStats,
            pathfindingNumericCoordinateKeyStats:
              report.run.pathfindingNumericCoordinateKeyStats,
            pathfindingTileMembershipTableStats:
              report.run.pathfindingTileMembershipTableStats,
            pathfindingNumericContinuationIndexStats:
              report.run.pathfindingNumericContinuationIndexStats,
            pathfindingTileMembershipDependencyProbe:
              report.run.pathfindingTileMembershipDependencyProbe,
            pathfindingNumericGetPathProbe:
              report.run.pathfindingNumericGetPathProbe,
            pathfindingTopCacheSingleReadStats:
              report.run.pathfindingTopCacheSingleReadStats,
            pathfindingDeferredTileMetadataStats:
              report.run.pathfindingDeferredTileMetadataStats,
            pathfindingOpenValuesStats: report.run.pathfindingOpenValuesStats,
            pathfindingContinuationCacheLookupStats:
              report.run.pathfindingContinuationCacheLookupStats,
            pathfindingHoistedCacheIndexStats:
              report.run.pathfindingHoistedCacheIndexStats,
            mapGenerationPathfindingDirectFallbackStats:
              report.run.mapGenerationPathfindingDirectFallbackStats,
            mapGenerationPathCacheEdgeIdentityStats:
              report.run.mapGenerationPathCacheEdgeIdentityStats,
            mapGenerationPathCacheModProbe:
              report.run.mapGenerationPathCacheModProbe,
            mapGenerationPathfindingHookProbe:
              report.run.mapGenerationPathfindingHookProbe,
          },
          topSelf: report.profile.topSelf.slice(0, 15),
        },
        null,
        2,
      )}\n`,
    );
    if (!report.acceptance.passed) {
      throw new Error(
        `Mapgen acceptance failed: ${report.acceptance.reasons.join("; ")}`,
      );
    }
  } finally {
    if (snapshotCaptured) {
      try {
        await restoreSnapshot(client);
      } catch {
        // Keep the original profiling error; this is an isolated test install.
      }
    }
    if (pathfindingConfigured) {
      try {
        await configurePathfinding(client, "native");
      } catch {
        // Keep the original profiling error; the isolated app can be relaunched.
      }
    }
    client.close();
  }
}

async function restoreSnapshot(client) {
  return client.evaluate(
    `(() => {
      const snapshot = globalThis.kdHybridMapgenProfileRestore;
      const loaded =
        typeof snapshot === "string" &&
        KinkyDungeonLoadGame(snapshot, true);
      let signature = null;
      if (loaded) {
        const stateText = JSON.stringify({
          checkpoint: MiniGameKinkyDungeonCheckpoint,
          floor: MiniGameKinkyDungeonLevel,
          grid: KDMapData.Grid,
          start: KDMapData.StartPosition,
          end: KDMapData.EndPosition,
          player: [KinkyDungeonPlayerEntity.x, KinkyDungeonPlayerEntity.y],
          entities: KDMapData.Entities.map((enemy) => [
            enemy.id,
            enemy.Enemy?.name ?? enemy.Enemy,
            enemy.x,
            enemy.y
          ]).sort((left, right) =>
            JSON.stringify(left).localeCompare(JSON.stringify(right))
          ),
          groundItems: KDMapData.GroundItems.map((item) => [
            item.name,
            item.x,
            item.y
          ]).sort((left, right) =>
            JSON.stringify(left).localeCompare(JSON.stringify(right))
          )
        });
        let stateSignature = 0x811c9dc5;
        for (
          let characterIndex = 0;
          characterIndex < stateText.length;
          characterIndex += 1
        ) {
          stateSignature ^= stateText.charCodeAt(characterIndex);
          stateSignature = Math.imul(stateSignature, 0x01000193);
        }
        signature = (stateSignature >>> 0).toString(16).padStart(8, "0");
        delete globalThis.kdHybridMapgenProfileRestore;
      }
      return {
        loaded: !!loaded,
        state: KinkyDungeonState,
        checkpoint: MiniGameKinkyDungeonCheckpoint,
        floor: MiniGameKinkyDungeonLevel,
        signature
      };
    })()`,
    120_000,
  );
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

async function configurePathfinding(client, mode) {
  return client.evaluate(
    `(() => {
      const changed = ${
        mode === "native"
          ? 'KDHybrid.enableSystem("pathfinding")'
          : 'KDHybrid.disableSystem("pathfinding", "mapgen-javascript-baseline")'
      };
      if (!changed) {
        throw new Error("Could not enter the requested pathfinding mode");
      }
      return KDHybrid.status().systems.find(
        (status) => status.globalName === "KinkyDungeonFindPath"
      );
    })()`,
    30_000,
  );
}

async function readPathfindingStatus(client) {
  return readAdapterStatus(client, "KinkyDungeonFindPath");
}

async function readAdapterStatus(client, globalName) {
  return client.evaluate(
    `KDHybrid.status().systems.find(
      (status) => status.globalName === ${JSON.stringify(globalName)}
    )`,
    30_000,
  );
}

function parseInteger(name, value, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new RangeError(
      `${name} must be an integer within ${minimum}..${maximum}`,
    );
  }
  return parsed;
}

function parseChoice(name, value, choices) {
  if (!choices.includes(value)) {
    throw new RangeError(`${name} must be one of ${choices.join(", ")}`);
  }
  return value;
}

function statusDelta(before, after) {
  return {
    calls: Number(after?.calls ?? 0) - Number(before?.calls ?? 0),
    nativeCalls:
      Number(after?.nativeCalls ?? 0) - Number(before?.nativeCalls ?? 0),
    fallbackCalls:
      Number(after?.fallbackCalls ?? 0) - Number(before?.fallbackCalls ?? 0),
    failures: Number(after?.failures ?? 0) - Number(before?.failures ?? 0),
  };
}

function createRestraintTagKeysCandidate(official, stats) {
  if (typeof official !== "function") {
    throw new TypeError("KDGetRestraintsEligible is unavailable");
  }
  const source = Function.prototype.toString.call(official);
  const arousalAnchor =
    'let arousalMode = KinkyDungeonStatsChoice.get("arousalMode");';
  const tagLoop = "for (let t of tags.keys())";
  const anchorCount = source.split(arousalAnchor).length - 1;
  const tagLoopCount = source.split(tagLoop).length - 1;
  if (anchorCount !== 1 || tagLoopCount !== 2) {
    throw new Error(
      "KDGetRestraintsEligible no longer matches the 5.4.92 probe shape",
    );
  }
  const transformed = source
    .replace(
      arousalAnchor,
      `const kdHybridTagKeys = Array.from(tags.keys());
    stats.calls += 1;
    stats.tagKeys += kdHybridTagKeys.length;
    ${arousalAnchor}`,
    )
    .split(tagLoop)
    .join("for (let t of kdHybridTagKeys)");
  const candidate = eval(`(${transformed})`);
  if (typeof candidate !== "function") {
    throw new TypeError("The restraint tag-key probe did not compile");
  }
  return candidate;
}

function createRestraintRecursionProbe(official, stats) {
  if (typeof official !== "function") {
    throw new TypeError("KDGetRestraintsEligible is unavailable");
  }
  const argumentStack = [];
  const objectIds = new WeakMap();
  const catalogQueryCounts = new Map();
  const fifoCapacityCaches = new Map(
    [1, 2, 4, 8, 16].map((capacity) => [capacity, []]),
  );
  let nextObjectId = 1;
  let lastCatalogQueryKey = null;
  let lastCatalogResultFingerprint = null;
  let catalogQueryRun = 0;
  function identityKey(value) {
    if (
      (typeof value !== "object" || value === null) &&
      typeof value !== "function"
    ) {
      if (typeof value === "number") {
        if (Number.isNaN(value)) return "number:NaN";
        if (Object.is(value, -0)) return "number:-0";
      }
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
  function sequenceKey(value) {
    if (!Array.isArray(value)) return identityKey(value);
    return `array:${value.length}:${value.map(identityKey).join(",")}`;
  }
  function collectionKey(value) {
    if (Array.isArray(value)) return sequenceKey(value);
    if (value instanceof Map) {
      return `map:${value.size}:${Array.from(
        value.entries(),
        ([key, entry]) => `${identityKey(key)}=${identityKey(entry)}`,
      ).join(",")}`;
    }
    if (typeof value === "object" && value !== null) {
      const prototype = Object.getPrototypeOf(value);
      if (prototype === Object.prototype || prototype === null) {
        const keys = Object.keys(value);
        return `record:${keys.length}:${keys
          .map((key) => `${identityKey(key)}=${identityKey(value[key])}`)
          .join(",")}`;
      }
    }
    return identityKey(value);
  }
  function catalogQueryKey(args) {
    const filter = args[10];
    const options = args[17];
    return [
      collectionKey(args[0]?.tags),
      identityKey(args[1]),
      identityKey(args[2]),
      collectionKey(args[8]),
      collectionKey(filter?.ignoreTags),
      collectionKey(filter?.requireTags),
      collectionKey(filter?.filterGroups),
      collectionKey(filter?.require),
      identityKey(globalThis.KinkyDungeonNewGame),
      identityKey(globalThis.KinkyDungeonStatsChoice?.has("TightRestraints")),
      identityKey(globalThis.KinkyDungeonStatsChoice?.get("arousalMode")),
      identityKey(options?.suppressTightPerk),
      collectionKey(options?.extraOptions),
      identityKey(options?.inventoryWeight),
    ].join("|");
  }
  function resultFingerprint(result) {
    if (!Array.isArray(result)) return identityKey(result);
    return result
      .map((entry) =>
        [
          identityKey(entry?.restraint),
          identityKey(entry?.variant),
          identityKey(entry?.inventoryVariant),
          identityKey(entry?.weight),
        ].join(","),
      )
      .join(";");
  }
  return function KDGetRestraintsEligibleRecursionProbe(...args) {
    const depth = argumentStack.length;
    let queryKey = null;
    stats.calls += 1;
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    if (depth === 0) {
      stats.topLevelCalls += 1;
      queryKey = catalogQueryKey(args);
      const previousCount = catalogQueryCounts.get(queryKey) || 0;
      catalogQueryCounts.set(queryKey, previousCount + 1);
      stats.uniqueCatalogQueryKeys = catalogQueryCounts.size;
      if (previousCount > 0) stats.repeatedCatalogQueryCalls += 1;
      for (const [capacity, cache] of fifoCapacityCaches) {
        const statKey = `${capacity}`;
        if (cache.includes(queryKey)) {
          stats.fifoCapacityHits[statKey] =
            (stats.fifoCapacityHits[statKey] || 0) + 1;
        } else {
          stats.fifoCapacityMisses[statKey] =
            (stats.fifoCapacityMisses[statKey] || 0) + 1;
          cache.push(queryKey);
          if (cache.length > capacity) cache.shift();
        }
      }
      if (queryKey === lastCatalogQueryKey) {
        stats.consecutiveCatalogQueryRepeats += 1;
        catalogQueryRun += 1;
      } else {
        catalogQueryRun = 1;
      }
      stats.maximumCatalogQueryRun = Math.max(
        stats.maximumCatalogQueryRun,
        catalogQueryRun,
      );
    } else {
      stats.recursiveCalls += 1;
      const parentArgs = argumentStack[depth - 1];
      if (parentArgs[17]?.extraOptions) {
        stats.recursiveCallsWithExtraOptions += 1;
      }
      let sameBaseArguments = true;
      const maximumLength = Math.max(parentArgs.length, args.length);
      for (let index = 0; index < maximumLength; index += 1) {
        if (
          index !== 13 &&
          index !== 14 &&
          index !== 18 &&
          !Object.is(parentArgs[index], args[index])
        ) {
          sameBaseArguments = false;
          break;
        }
      }
      if (sameBaseArguments) {
        stats.sameBaseArgumentRecursiveCalls += 1;
      }
      const transition = `${String(parentArgs[13])}->${String(args[13])}`;
      stats.filterEpsTransitions[transition] =
        (stats.filterEpsTransitions[transition] || 0) + 1;
    }
    argumentStack.push(args);
    let result;
    try {
      result = Reflect.apply(official, this, args);
    } finally {
      argumentStack.pop();
    }
    if (depth === 0) {
      const fingerprint = resultFingerprint(result);
      stats.resultFingerprints.push(fingerprint);
      if (queryKey === lastCatalogQueryKey) {
        if (fingerprint === lastCatalogResultFingerprint) {
          stats.consecutiveEqualResults += 1;
        } else {
          stats.consecutiveDifferentResults += 1;
        }
      }
      lastCatalogQueryKey = queryKey;
      lastCatalogResultFingerprint = fingerprint;
    }
    return result;
  };
}

function createRestraintRetryReuseEquivalenceProbe(
  official,
  stats,
  sourceControl,
) {
  if (typeof official !== "function") {
    throw new TypeError("KDGetRestraintsEligible is unavailable");
  }
  let active = false;
  return function KDGetRestraintsEligibleRetryReuseEquivalenceProbe(...args) {
    if (active) {
      return Reflect.apply(official, this, args);
    }
    const hadDisable = Object.prototype.hasOwnProperty.call(
      sourceControl,
      "disableEligibleRestraintRetryReuse",
    );
    const previousDisable = sourceControl.disableEligibleRestraintRetryReuse;
    let expected;
    let actual;
    let mismatch = null;
    active = true;
    try {
      sourceControl.disableEligibleRestraintRetryReuse = true;
      expected = Reflect.apply(official, this, args);
      sourceControl.disableEligibleRestraintRetryReuse = false;
      actual = Reflect.apply(official, this, args);
      if (
        !Array.isArray(expected) ||
        !Array.isArray(actual) ||
        Object.getPrototypeOf(expected) !== Object.getPrototypeOf(actual)
      ) {
        mismatch = "one result is not an equivalent array";
      } else if (expected.length !== actual.length) {
        mismatch = `length ${expected.length} != ${actual.length}`;
      } else {
        for (let index = 0; index < expected.length; index += 1) {
          const left = expected[index];
          const right = actual[index];
          const leftKeys = Object.keys(left);
          const rightKeys = Object.keys(right);
          if (
            Object.getPrototypeOf(left) !== Object.getPrototypeOf(right) ||
            leftKeys.length !== rightKeys.length ||
            leftKeys.some((key, keyIndex) => key !== rightKeys[keyIndex])
          ) {
            mismatch = `entry ${index} has a different shape`;
            break;
          }
          for (const key of leftKeys) {
            if (!Object.is(left[key], right[key])) {
              mismatch = `entry ${index} differs at ${key}`;
              break;
            }
          }
          if (mismatch !== null) break;
        }
      }
    } catch (error) {
      mismatch =
        "comparison threw " +
        (error instanceof Error ? error.message : String(error));
    } finally {
      if (hadDisable) {
        sourceControl.disableEligibleRestraintRetryReuse = previousDisable;
      } else {
        delete sourceControl.disableEligibleRestraintRetryReuse;
      }
      active = false;
    }
    stats.comparedCalls += 1;
    if (mismatch !== null) {
      stats.mismatches += 1;
      if (stats.firstMismatch === null) {
        stats.firstMismatch = {
          call: stats.comparedCalls,
          mismatch,
          level: args[1],
          floorIndex: args[2],
          enemyTags: Array.isArray(args[0]?.tags) ? [...args[0].tags] : null,
          expectedLength: Array.isArray(expected) ? expected.length : null,
          actualLength: Array.isArray(actual) ? actual.length : null,
        };
      }
    }
    return expected;
  };
}

function createPathCacheSingleSliceCandidate(stats) {
  if (stats === null) {
    return function KDSetPathfindCacheSingleSlice(
      PathMap,
      newPath,
      endx,
      endy,
      Tiles,
      Finalindex,
    ) {
      for (let index = 0; index < newPath.length - 1; index += 1) {
        const point = newPath[index];
        const suffix = newPath.slice(index + 1);
        const cacheKey = `${point.x},${point.y},${endx},${endy},${Tiles}`;
        PathMap.set(cacheKey, suffix);
      }
      if (Finalindex) {
        PathMap.set(Finalindex, newPath.slice(0));
      }
    };
  }
  return function KDSetPathfindCacheSingleSlice(
    PathMap,
    newPath,
    endx,
    endy,
    Tiles,
    Finalindex,
  ) {
    if (stats !== null) {
      stats.calls += 1;
      stats.points += newPath.length;
    }
    for (let index = 0; index < newPath.length - 1; index += 1) {
      const point = newPath[index];
      const suffix = newPath.slice(index + 1);
      const cacheKey = `${point.x},${point.y},${endx},${endy},${Tiles}`;
      PathMap.set(cacheKey, suffix);
    }
    if (Finalindex) {
      PathMap.set(Finalindex, newPath.slice(0));
    }
  };
}

function createPathCachePrefixLimitCandidate(limit, stats) {
  return function KDSetPathfindCachePrefixLimit(
    PathMap,
    newPath,
    endx,
    endy,
    Tiles,
    Finalindex,
  ) {
    if (stats !== null) {
      stats.calls += 1;
      stats.points += newPath.length;
    }
    const suffixCount = Math.max(0, newPath.length - 1);
    const retainedCount = Math.min(suffixCount, limit);
    const cacheKeySuffix = `,${endx},${endy},${Tiles}`;
    for (let index = 0; index < retainedCount; index += 1) {
      const point = newPath[index];
      const cacheKey = `${point.x},${point.y}${cacheKeySuffix}`;
      PathMap.set(cacheKey, newPath.slice(index + 1));
    }
    stats.newEntries += retainedCount;
    stats.skippedEntries += suffixCount - retainedCount;
    if (Finalindex) {
      PathMap.set(Finalindex, newPath.slice(0));
      stats.newEntries += 1;
    }
  };
}

function createPathCacheHitDistributionProbe(official, stats) {
  if (typeof official !== "function") {
    throw new TypeError("The path-cache hit probe needs the official function");
  }
  const canonicalHas = Map.prototype.has;
  const trackedMaps = [];
  const states = new WeakMap();
  const increment = (record, key) => {
    const bucket = String(key);
    record[bucket] = (record[bucket] || 0) + 1;
  };
  const instrument = (pathMap) => {
    let state = states.get(pathMap);
    if (state !== undefined) return state;
    const metadata = new Map();
    const previousHasDescriptor = Object.getOwnPropertyDescriptor(
      pathMap,
      "has",
    );
    const probedHas = function KDHybridPathCacheDistributionHas(key) {
      stats.hasCalls += 1;
      const hit = Reflect.apply(canonicalHas, this, [key]);
      if (!hit || this !== pathMap) return hit;
      stats.hits += 1;
      const entry = metadata.get(key);
      if (entry === undefined) {
        stats.unknownHits += 1;
      } else if (entry.kind === "final") {
        stats.finalHits += 1;
      } else {
        stats.suffixHits += 1;
        increment(stats.suffixHitsByLength, entry.suffixLength);
        increment(stats.suffixHitsBySourceIndex, entry.sourceIndex);
        increment(stats.suffixHitsByPathLength, entry.pathLength);
      }
      return hit;
    };
    Object.defineProperty(pathMap, "has", {
      configurable: true,
      writable: true,
      value: probedHas,
    });
    state = {
      pathMap,
      metadata,
      previousHasDescriptor,
      probedHas,
    };
    states.set(pathMap, state);
    trackedMaps.push(state);
    return state;
  };
  const candidate = function KDSetPathfindCacheHitDistribution(
    PathMap,
    newPath,
    endx,
    endy,
    Tiles,
    Finalindex,
  ) {
    const state = instrument(PathMap);
    stats.calls += 1;
    stats.points += newPath.length;
    stats.pathPoints += newPath.length;
    increment(stats.writesByPathLength, newPath.length);
    const cacheKeySuffix = `,${endx},${endy},${Tiles}`;
    for (let index = 0; index < newPath.length - 1; index += 1) {
      const point = newPath[index];
      const suffixLength = newPath.length - index - 1;
      const cacheKey = `${point.x},${point.y}${cacheKeySuffix}`;
      state.metadata.set(cacheKey, {
        kind: "suffix",
        pathLength: newPath.length,
        sourceIndex: index,
        suffixLength,
      });
      stats.suffixEntries += 1;
      increment(stats.suffixWritesByLength, suffixLength);
    }
    if (Finalindex) {
      state.metadata.set(Finalindex, {
        kind: "final",
        pathLength: newPath.length,
      });
      stats.finalEntries += 1;
    }
    return Reflect.apply(official, this, arguments);
  };
  candidate.restore = () => {
    for (const state of trackedMaps) {
      if (state.pathMap.has === state.probedHas) {
        if (state.previousHasDescriptor === undefined) {
          delete state.pathMap.has;
        } else {
          Object.defineProperty(
            state.pathMap,
            "has",
            state.previousHasDescriptor,
          );
        }
      }
    }
  };
  return candidate;
}

function createPathCacheNoWriteCandidate(stats) {
  return function KDSetPathfindCacheNoWrite(
    _PathMap,
    newPath,
    _endx,
    _endy,
    _Tiles,
    Finalindex,
  ) {
    stats.calls += 1;
    stats.points += newPath.length;
    stats.skippedEntries += Math.max(
      0,
      newPath.length - 1 + (Finalindex ? 1 : 0),
    );
  };
}

function createPathCacheCallReuseProbe(official, stats, edgeStats) {
  if (typeof official !== "function") {
    throw new TypeError("KDSetPathfindCache is unavailable");
  }
  Object.assign(stats, {
    calls: 0,
    points: 0,
    suffixEntries: 0,
    distinctPaths: 0,
    repeatedPathCalls: 0,
    tupleFirstCalls: 0,
    tupleRepeatCalls: 0,
    tupleRepeatSuffixEntries: 0,
    tupleRepeatFullySkippedCalls: 0,
    tupleRepeatCallsWithWrites: 0,
    consecutiveTupleRepeatCalls: 0,
    consecutiveTupleRepeatSuffixEntries: 0,
    samePathDifferentTupleCalls: 0,
    finalIndexCalls: 0,
    tupleRepeatSameFinalIndexCalls: 0,
    tupleRepeatDifferentFinalIndexCalls: 0,
    sourceSkippedEntries: 0,
    sourceWrittenEntries: 0,
  });
  const pathRecords = new WeakMap();
  let previousCall = null;
  return function KDSetPathfindCacheCallReuseProbe(
    PathMap,
    newPath,
    endx,
    endy,
    Tiles,
    Finalindex,
  ) {
    stats.calls += 1;
    stats.points += newPath.length;
    const suffixEntries = Math.max(0, newPath.length - 1);
    stats.suffixEntries += suffixEntries;
    if (Finalindex) stats.finalIndexCalls += 1;

    let pathRecord = pathRecords.get(newPath);
    const repeatedPath = pathRecord !== undefined;
    if (pathRecord === undefined) {
      pathRecord = new WeakMap();
      pathRecords.set(newPath, pathRecord);
      stats.distinctPaths += 1;
    } else {
      stats.repeatedPathCalls += 1;
    }
    let tuples = pathRecord.get(PathMap);
    if (tuples === undefined) {
      tuples = [];
      pathRecord.set(PathMap, tuples);
    }
    let tuple = tuples.find(
      (candidate) =>
        Object.is(candidate.endx, endx) &&
        Object.is(candidate.endy, endy) &&
        Object.is(candidate.Tiles, Tiles),
    );
    const repeatedTuple = tuple !== undefined;
    if (tuple === undefined) {
      tuple = {
        endx,
        endy,
        Tiles,
        calls: 0,
        lastFinalindex: undefined,
      };
      tuples.push(tuple);
      stats.tupleFirstCalls += 1;
      if (repeatedPath) stats.samePathDifferentTupleCalls += 1;
    } else {
      stats.tupleRepeatCalls += 1;
      stats.tupleRepeatSuffixEntries += suffixEntries;
      if (Object.is(tuple.lastFinalindex, Finalindex)) {
        stats.tupleRepeatSameFinalIndexCalls += 1;
      } else {
        stats.tupleRepeatDifferentFinalIndexCalls += 1;
      }
    }
    const consecutiveTupleRepeat =
      previousCall !== null &&
      previousCall.PathMap === PathMap &&
      previousCall.newPath === newPath &&
      Object.is(previousCall.endx, endx) &&
      Object.is(previousCall.endy, endy) &&
      Object.is(previousCall.Tiles, Tiles);
    if (consecutiveTupleRepeat) {
      stats.consecutiveTupleRepeatCalls += 1;
      stats.consecutiveTupleRepeatSuffixEntries += suffixEntries;
    }

    const skippedBefore = Number(edgeStats?.skippedEntries ?? 0);
    const writtenBefore = Number(edgeStats?.writtenEntries ?? 0);
    const result = Reflect.apply(official, this, [
      PathMap,
      newPath,
      endx,
      endy,
      Tiles,
      Finalindex,
    ]);
    const skippedDelta =
      Number(edgeStats?.skippedEntries ?? skippedBefore) - skippedBefore;
    const writtenDelta =
      Number(edgeStats?.writtenEntries ?? writtenBefore) - writtenBefore;
    stats.sourceSkippedEntries += skippedDelta;
    stats.sourceWrittenEntries += writtenDelta;
    if (repeatedTuple && skippedDelta === suffixEntries) {
      stats.tupleRepeatFullySkippedCalls += 1;
    }
    if (repeatedTuple && writtenDelta > 0) {
      stats.tupleRepeatCallsWithWrites += 1;
    }
    tuple.calls += 1;
    tuple.lastFinalindex = Finalindex;
    previousCall = { PathMap, newPath, endx, endy, Tiles };
    return result;
  };
}

function createPathCacheSkipIdenticalExistingCandidate(stats) {
  return function KDSetPathfindCacheSkipIdenticalExisting(
    PathMap,
    newPath,
    endx,
    endy,
    Tiles,
    Finalindex,
  ) {
    if (stats !== null) {
      stats.calls += 1;
      stats.points += newPath.length;
    }
    const cacheKeySuffix = `,${endx},${endy},${Tiles}`;
    for (let index = 0; index < newPath.length - 1; index += 1) {
      const point = newPath[index];
      const cacheKey = `${point.x},${point.y}${cacheKeySuffix}`;
      const existing = PathMap.get(cacheKey);
      const expectedLength = newPath.length - index - 1;
      let identical =
        Array.isArray(existing) && existing.length === expectedLength;
      if (identical) {
        for (let pointIndex = 0; pointIndex < expectedLength; pointIndex += 1) {
          if (
            !Object.is(existing[pointIndex], newPath[index + pointIndex + 1])
          ) {
            identical = false;
            break;
          }
        }
      }
      if (!identical) {
        PathMap.set(cacheKey, newPath.slice(index + 1));
        if (stats !== null) stats.newEntries += 1;
      } else if (stats !== null) {
        stats.skippedEntries += 1;
      }
    }
    if (Finalindex) {
      PathMap.set(Finalindex, newPath.slice(0));
    }
  };
}

function createPathCacheEdgeIdentitySkipCandidate(stats) {
  return function KDSetPathfindCacheEdgeIdentitySkip(
    PathMap,
    newPath,
    endx,
    endy,
    Tiles,
    Finalindex,
  ) {
    if (stats !== null) {
      stats.calls += 1;
      stats.points += newPath.length;
    }
    const cacheKeySuffix = `,${endx},${endy},${Tiles}`;
    const finalPoint = newPath[newPath.length - 1];
    for (let index = 0; index < newPath.length - 1; index += 1) {
      const point = newPath[index];
      const cacheKey = `${point.x},${point.y}${cacheKeySuffix}`;
      const existing = PathMap.get(cacheKey);
      const expectedLength = newPath.length - index - 1;
      const edgeIdentical =
        Array.isArray(existing) &&
        existing.length === expectedLength &&
        Object.is(existing[0], newPath[index + 1]) &&
        Object.is(existing[expectedLength - 1], finalPoint);
      if (edgeIdentical) {
        if (stats !== null) {
          stats.edgeIdentityCandidates += 1;
          stats.skippedEntries += 1;
        }
      } else {
        if (stats !== null) {
          if (existing === undefined) {
            stats.newEntries += 1;
          } else {
            stats.differentExistingEntries += 1;
          }
        }
        PathMap.set(cacheKey, newPath.slice(index + 1));
      }
    }
    if (Finalindex) {
      PathMap.set(Finalindex, newPath.slice(0));
    }
  };
}

function createPathCacheEdgeIdentityEquivalenceProbe(official, stats) {
  if (typeof official !== "function") {
    throw new TypeError(
      "The path-cache equivalence probe needs the official function",
    );
  }
  return function KDSetPathfindCacheEdgeIdentityEquivalenceProbe(...args) {
    const [PathMap, newPath, endx, endy, Tiles] = args;
    let mismatch = null;
    stats.calls += 1;
    stats.points += Array.isArray(newPath) ? newPath.length : 0;
    try {
      const cacheKeySuffix = `,${endx},${endy},${Tiles}`;
      const finalPoint = newPath[newPath.length - 1];
      for (let index = 0; index < newPath.length - 1; index += 1) {
        const point = newPath[index];
        const cacheKey = `${point.x},${point.y}${cacheKeySuffix}`;
        const existing = PathMap.get(cacheKey);
        const expectedLength = newPath.length - index - 1;
        const edgeIdentical =
          Array.isArray(existing) &&
          existing.length === expectedLength &&
          Object.is(existing[0], newPath[index + 1]) &&
          Object.is(existing[expectedLength - 1], finalPoint);
        if (!edgeIdentical) continue;
        stats.edgeIdentityCandidates += 1;
        let identical = true;
        for (let pointIndex = 0; pointIndex < expectedLength; pointIndex += 1) {
          if (
            !Object.is(existing[pointIndex], newPath[index + pointIndex + 1])
          ) {
            identical = false;
            break;
          }
        }
        if (identical) {
          stats.identicalExistingEntries += 1;
        } else {
          stats.edgeIdentityFalsePositives += 1;
          mismatch ??= {
            cacheKey,
            pathLength: newPath.length,
            suffixLength: expectedLength,
            existingLength: existing.length,
          };
        }
      }
    } catch (error) {
      mismatch ??= {
        error: error instanceof Error ? error.message : String(error),
      };
    }
    stats.comparedCalls += 1;
    if (mismatch !== null) {
      stats.mismatches += 1;
      stats.firstMismatch ??= {
        call: stats.comparedCalls,
        ...mismatch,
      };
    }
    return Reflect.apply(official, this, args);
  };
}

function createPathCacheSkipExistingEquivalenceProbe(official, stats) {
  if (typeof official !== "function") {
    throw new TypeError(
      "The path-cache equivalence probe needs the official function",
    );
  }
  return function KDSetPathfindCacheSkipExistingEquivalenceProbe(...args) {
    const [PathMap, newPath, endx, endy, Tiles] = args;
    let mismatch = null;
    stats.calls += 1;
    stats.points += Array.isArray(newPath) ? newPath.length : 0;
    try {
      const cacheKeySuffix = `,${endx},${endy},${Tiles}`;
      for (let index = 0; index < newPath.length - 1; index += 1) {
        const point = newPath[index];
        const cacheKey = `${point.x},${point.y}${cacheKeySuffix}`;
        if (PathMap.has(cacheKey)) {
          stats.existingEntries += 1;
          const existing = PathMap.get(cacheKey);
          const expectedLength = newPath.length - index - 1;
          let identical =
            Array.isArray(existing) && existing.length === expectedLength;
          if (identical) {
            for (
              let pointIndex = 0;
              pointIndex < expectedLength;
              pointIndex += 1
            ) {
              if (
                !Object.is(
                  existing[pointIndex],
                  newPath[index + pointIndex + 1],
                )
              ) {
                identical = false;
                break;
              }
            }
          }
          if (identical) {
            stats.identicalExistingEntries += 1;
          } else {
            stats.differentExistingEntries += 1;
            mismatch ??= {
              cacheKey,
              pathLength: newPath.length,
              suffixLength: expectedLength,
              existingLength: Array.isArray(existing) ? existing.length : null,
            };
          }
        } else {
          stats.newEntries += 1;
        }
      }
    } catch (error) {
      mismatch ??= {
        error: error instanceof Error ? error.message : String(error),
      };
    }
    stats.comparedCalls += 1;
    if (mismatch !== null) {
      stats.mismatches += 1;
      stats.firstMismatch ??= {
        call: stats.comparedCalls,
        ...mismatch,
      };
    }
    return Reflect.apply(official, this, args);
  };
}

function createPathCacheEquivalenceCandidate(official, candidate, stats) {
  if (typeof official !== "function" || typeof candidate !== "function") {
    throw new TypeError("The path-cache equivalence probe needs two functions");
  }
  return function KDSetPathfindCacheEquivalenceProbe(...args) {
    const expected = Reflect.apply(official, this, args);
    const expectedMap = new Map();
    const actualMap = new Map();
    const expectedArgs = [...args];
    expectedArgs[0] = expectedMap;
    const actualArgs = [...args];
    actualArgs[0] = actualMap;
    let mismatch = null;
    try {
      Reflect.apply(official, this, expectedArgs);
      Reflect.apply(candidate, this, actualArgs);
      const expectedEntries = [...expectedMap.entries()];
      const actualEntries = [...actualMap.entries()];
      if (expectedEntries.length !== actualEntries.length) {
        mismatch = `map size ${expectedEntries.length} != ${actualEntries.length}`;
      } else {
        for (let index = 0; index < expectedEntries.length; index += 1) {
          const [expectedKey, expectedPath] = expectedEntries[index];
          const [actualKey, actualPath] = actualEntries[index];
          if (expectedKey !== actualKey) {
            mismatch = `entry ${index} has a different key`;
            break;
          }
          if (
            !Array.isArray(expectedPath) ||
            !Array.isArray(actualPath) ||
            expectedPath.length !== actualPath.length ||
            expectedPath.some(
              (point, pointIndex) => !Object.is(point, actualPath[pointIndex]),
            )
          ) {
            mismatch = `entry ${index} has a different path`;
            break;
          }
        }
      }
    } catch (error) {
      mismatch =
        "candidate threw " +
        (error instanceof Error ? error.message : String(error));
    }
    stats.comparedCalls += 1;
    if (mismatch !== null) {
      stats.mismatches += 1;
      if (stats.firstMismatch === null) {
        stats.firstMismatch = {
          call: stats.comparedCalls,
          mismatch,
          pathLength: Array.isArray(args[1]) ? args[1].length : null,
          finalIndex: args[5],
        };
      }
    }
    return expected;
  };
}

function runPathCacheModFallbackProbe(product, sourceControl) {
  if (typeof product !== "function") {
    throw new TypeError("KDSetPathfindCache is unavailable");
  }
  class ModPath extends Array {}
  const path = new ModPath(
    { x: 2, y: 3 },
    { x: 4, y: 5 },
    { x: 6, y: 7 },
    { x: 8, y: 9 },
  );
  const expectedMap = new Map();
  const actualMap = new Map();
  const stats = {
    calls: 0,
    optimizedCalls: 0,
    fallbackCalls: 0,
  };
  const edgeStats = {
    calls: 0,
    optimizedCalls: 0,
    fallbackCalls: 0,
    skippedEntries: 0,
    writtenEntries: 0,
  };
  const hadStats = Object.prototype.hasOwnProperty.call(
    sourceControl,
    "pathCacheSingleSliceStats",
  );
  const previousStats = sourceControl.pathCacheSingleSliceStats;
  const hadDisable = Object.prototype.hasOwnProperty.call(
    sourceControl,
    "disablePathCacheSingleSlice",
  );
  const previousDisable = sourceControl.disablePathCacheSingleSlice;
  const hadEdgeStats = Object.prototype.hasOwnProperty.call(
    sourceControl,
    "pathCacheEdgeIdentitySkipStats",
  );
  const previousEdgeStats = sourceControl.pathCacheEdgeIdentitySkipStats;
  const hadEdgeEnable = Object.prototype.hasOwnProperty.call(
    sourceControl,
    "enablePathCacheEdgeIdentitySkip",
  );
  const previousEdgeEnable = sourceControl.enablePathCacheEdgeIdentitySkip;
  const hadEdgeDisable = Object.prototype.hasOwnProperty.call(
    sourceControl,
    "disablePathCacheEdgeIdentitySkip",
  );
  const previousEdgeDisable = sourceControl.disablePathCacheEdgeIdentitySkip;
  const reference = (PathMap, newPath, endx, endy, Tiles, Finalindex) => {
    for (let index = 0; index < newPath.length - 1; index += 1) {
      const suffixWithPoint = newPath.slice(index);
      const cacheKey =
        `${suffixWithPoint[0].x},${suffixWithPoint[0].y},` +
        `${endx},${endy},${Tiles}`;
      PathMap.set(cacheKey, suffixWithPoint.slice(1));
    }
    if (Finalindex) {
      PathMap.set(Finalindex, newPath.slice(0));
    }
  };
  let mismatch = null;
  try {
    sourceControl.disablePathCacheSingleSlice = false;
    sourceControl.pathCacheSingleSliceStats = stats;
    sourceControl.enablePathCacheEdgeIdentitySkip = true;
    sourceControl.disablePathCacheEdgeIdentitySkip = false;
    sourceControl.pathCacheEdgeIdentitySkipStats = edgeStats;
    reference(expectedMap, path, 21, 34, "modded-tiles", "mod-final");
    Reflect.apply(product, globalThis, [
      actualMap,
      path,
      21,
      34,
      "modded-tiles",
      "mod-final",
    ]);
  } catch (error) {
    mismatch = error instanceof Error ? error.message : String(error);
  } finally {
    if (hadStats) {
      sourceControl.pathCacheSingleSliceStats = previousStats;
    } else {
      delete sourceControl.pathCacheSingleSliceStats;
    }
    if (hadDisable) {
      sourceControl.disablePathCacheSingleSlice = previousDisable;
    } else {
      delete sourceControl.disablePathCacheSingleSlice;
    }
    if (hadEdgeStats) {
      sourceControl.pathCacheEdgeIdentitySkipStats = previousEdgeStats;
    } else {
      delete sourceControl.pathCacheEdgeIdentitySkipStats;
    }
    if (hadEdgeEnable) {
      sourceControl.enablePathCacheEdgeIdentitySkip = previousEdgeEnable;
    } else {
      delete sourceControl.enablePathCacheEdgeIdentitySkip;
    }
    if (hadEdgeDisable) {
      sourceControl.disablePathCacheEdgeIdentitySkip = previousEdgeDisable;
    } else {
      delete sourceControl.disablePathCacheEdgeIdentitySkip;
    }
  }
  const expectedEntries = [...expectedMap.entries()];
  const actualEntries = [...actualMap.entries()];
  if (mismatch === null && expectedEntries.length !== actualEntries.length) {
    mismatch = `map size ${expectedEntries.length} != ${actualEntries.length}`;
  }
  if (mismatch === null) {
    for (let index = 0; index < expectedEntries.length; index += 1) {
      const [expectedKey, expectedPath] = expectedEntries[index];
      const [actualKey, actualPath] = actualEntries[index];
      if (expectedKey !== actualKey) {
        mismatch = `entry ${index} has a different key`;
        break;
      }
      if (
        Object.getPrototypeOf(expectedPath) !==
          Object.getPrototypeOf(actualPath) ||
        expectedPath.length !== actualPath.length ||
        expectedPath.some(
          (point, pointIndex) => !Object.is(point, actualPath[pointIndex]),
        )
      ) {
        mismatch = `entry ${index} has a different path`;
        break;
      }
    }
  }
  return {
    exact: mismatch === null,
    mismatch,
    inputConstructor: path.constructor.name,
    entries: actualEntries.length,
    stats,
    edgeStats,
  };
}

function createRestraintCatalogFastPathCeilingCandidate(official, stats) {
  if (typeof official !== "function") {
    throw new TypeError("KDGetRestraintsEligible is unavailable");
  }
  const source = Function.prototype.toString.call(official);
  const callAnchor = "let RestraintsList = [];";
  const guardBlock = `const sourceControl = globalThis.KDHybridSourcePatchControl;
                    const sourceStats = sourceControl?.eligibleRestraintEnemyKeyStats;
                    const sourceFastPath = KDHybridEligibleRestraintEnemyKeysCompatible(restraint, sourceControl);
                    if (sourceStats) {
                        sourceStats.restraints = (sourceStats.restraints || 0) + 1;
                        const key = sourceFastPath ? "optimizedRestraints" : "fallbackRestraints";
                        sourceStats[key] = (sourceStats[key] || 0) + 1;
                    }`;
  if (
    source.split(callAnchor).length - 1 !== 1 ||
    source.split(guardBlock).length - 1 !== 1
  ) {
    throw new Error(
      "KDGetRestraintsEligible no longer matches the 5.4.92 catalog-fast-path probe shape",
    );
  }
  const transformed = source
    .replace(
      callAnchor,
      `stats.calls += 1;
    ${callAnchor}`,
    )
    .replace(
      guardBlock,
      `stats.forcedFastPathRestraints += 1;
                    const sourceFastPath = true;`,
    );
  const candidate = eval(`(${transformed})`);
  if (typeof candidate !== "function") {
    throw new TypeError(
      "The restraint catalog fast-path ceiling probe did not compile",
    );
  }
  return candidate;
}

function createAccessibleFrontierSingleReadCandidate(official, stats, statKey) {
  if (typeof official !== "function") {
    throw new TypeError("KD accessibility function is unavailable");
  }
  const source = Function.prototype.toString.call(official);
  const callAnchor = "let tempGrid = {};";
  const frontierAnchor = `while (Object.entries(checkGrid).length > 0) {
        for (let g of Object.entries(checkGrid)) {`;
  if (
    source.split(callAnchor).length - 1 !== 1 ||
    source.split(frontierAnchor).length - 1 !== 1
  ) {
    throw new Error(
      "KD accessibility function no longer matches the 5.4.92 frontier probe shape",
    );
  }
  const transformed = source
    .replace(
      callAnchor,
      `stats[statKey] += 1;
    ${callAnchor}`,
    )
    .replace(
      frontierAnchor,
      `let kdHybridFrontierEntries;
    while ((kdHybridFrontierEntries = Object.entries(checkGrid)).length > 0) {
        for (let g of kdHybridFrontierEntries) {`,
    );
  const candidate = eval(`(${transformed})`);
  if (typeof candidate !== "function") {
    throw new TypeError(
      "The accessibility frontier single-read probe did not compile",
    );
  }
  return candidate;
}

function createAccessibleNeighborSingleReadCandidate(
  official,
  stats,
  statKey,
  room,
) {
  if (typeof official !== "function") {
    throw new TypeError("KD accessibility function is unavailable");
  }
  const source = Function.prototype.toString.call(official);
  const callAnchor = "let tempGrid = {};";
  const locationAnchor = room
    ? `let test = ((g[1].x + XX) + "," + (g[1].y + YY));`
    : `let testLoc = ((X + XX) + "," + (Y + YY));`;
  const firstMapRead = room
    ? "KDInteractableTiles.includes(KinkyDungeonMapGet(g[1].x + XX, g[1].y + YY))"
    : "KDInteractableTiles.includes(KinkyDungeonMapGet(X + XX, Y + YY))";
  const secondMapRead = room
    ? "MTiles.includes(KinkyDungeonMapGet(g[1].x + XX, g[1].y + YY))"
    : "KinkyDungeonMovableTilesSmartEnemy.includes(KinkyDungeonMapGet(X + XX, Y + YY))";
  const metadataRead =
    `(KinkyDungeonTilesGet("" + (X + XX) + "," + (Y + YY)) && ` +
    `KinkyDungeonTilesGet("" + (X + XX) + "," + (Y + YY)).Lock)`;
  if (
    source.split(callAnchor).length - 1 !== 1 ||
    source.split(locationAnchor).length - 1 !== 1 ||
    source.split(firstMapRead).length - 1 !== 1 ||
    source.split(secondMapRead).length - 1 !== 1 ||
    (!room && source.split(metadataRead).length - 1 !== 1)
  ) {
    throw new Error(
      "KD accessibility function no longer matches the 5.4.92 neighbor probe shape",
    );
  }
  let transformed = source
    .replace(
      callAnchor,
      `stats[statKey] += 1;
    ${callAnchor}`,
    )
    .replace(
      locationAnchor,
      `${locationAnchor}
                    let kdHybridMapTile;
                    ${room ? "" : "let kdHybridTileMetadata;"}`,
    )
    .replace(
      firstMapRead,
      room
        ? "KDInteractableTiles.includes((kdHybridMapTile = KinkyDungeonMapGet(g[1].x + XX, g[1].y + YY)))"
        : "KDInteractableTiles.includes((kdHybridMapTile = KinkyDungeonMapGet(X + XX, Y + YY)))",
    )
    .replace(
      secondMapRead,
      room
        ? "MTiles.includes(kdHybridMapTile)"
        : "KinkyDungeonMovableTilesSmartEnemy.includes(kdHybridMapTile)",
    );
  if (!room) {
    transformed = transformed.replace(
      metadataRead,
      `((kdHybridTileMetadata = KinkyDungeonTilesGet("" + (X + XX) + "," + (Y + YY))) && kdHybridTileMetadata.Lock)`,
    );
  }
  const candidate = eval(`(${transformed})`);
  if (typeof candidate !== "function") {
    throw new TypeError(
      "The accessibility neighbor single-read probe did not compile",
    );
  }
  return candidate;
}

function createPasteTileSerializedCacheCandidate(official, stats, verify) {
  if (typeof official !== "function") {
    throw new TypeError("KD_PasteTile is unavailable");
  }
  const source = Function.prototype.toString.call(official);
  const cloneAnchor = "tile = JSON.parse(JSON.stringify(tile));";
  if (source.split(cloneAnchor).length - 1 !== 1) {
    throw new Error(
      "KD_PasteTile no longer matches the 5.4.92 serialized-clone shape",
    );
  }
  let transformed = source.replace(
    cloneAnchor,
    `let serializedTile;
    if (cache.has(tile)) {
        serializedTile = cache.get(tile);
        stats.cacheHits += 1;
        if (verify) {
            const currentSerializedTile = JSON.stringify(tile);
            stats.verifiedHits += 1;
            if (currentSerializedTile !== serializedTile) {
                stats.mismatches += 1;
                if (stats.firstMismatch === null) {
                    stats.firstMismatch = {
                        tile: tile?.name ?? null,
                        cachedLength: serializedTile?.length ?? null,
                        currentLength: currentSerializedTile?.length ?? null,
                    };
                }
            }
        }
    }
    else {
        serializedTile = JSON.stringify(tile);
        cache.set(tile, serializedTile);
        stats.cacheMisses += 1;
    }
    tile = JSON.parse(serializedTile);`,
  );
  transformed = transformed.replace("{", "{" + "\n    stats.calls += 1;");
  return Function(
    "cache",
    "stats",
    "verify",
    `"use strict"; return (${transformed});`,
  )(new WeakMap(), stats, verify);
}

function createMapTileFillingCoordinateReuseCandidate(official, stats, verify) {
  if (typeof official !== "function") {
    throw new TypeError("KDCheckMapTileFilling is unavailable");
  }
  const source = Function.prototype.toString.call(official);
  const loopAnchor = "let fail = false;";
  const coordinateAnchor = "(xx + indX - 1) + ',' + (yy + indY - 1)";
  const coordinateOccurrences = source.split(coordinateAnchor).length - 1;
  if (
    source.split(loopAnchor).length - 1 !== 1 ||
    coordinateOccurrences !== 9
  ) {
    throw new Error(
      "KDCheckMapTileFilling no longer matches the 5.4.92 coordinate-reuse shape",
    );
  }
  let transformed = source.split(coordinateAnchor).join("location");
  const repeatedIndexAnchor = "indices[location]";
  const repeatedIndexReads = transformed.split(repeatedIndexAnchor).length - 1;
  if (repeatedIndexReads !== 7) {
    throw new Error(
      "KDCheckMapTileFilling index reads no longer match the 5.4.92 coordinate-reuse shape",
    );
  }
  transformed = transformed.split(repeatedIndexAnchor).join("indexAtLocation");
  transformed = transformed.replace(
    loopAnchor,
    `${loopAnchor}
            const location =
                (xx + indX - 1) + ',' + (yy + indY - 1);
            const indexAtLocation = indices[location];`,
  );
  transformed = transformed.replace("{", "{" + "\n    stats.calls += 1;");
  const candidate = Function(
    "stats",
    `"use strict"; return (${transformed});`,
  )(stats);
  stats.coordinateExpressionsPerCell = coordinateOccurrences;
  stats.indexReadsPerCell = repeatedIndexReads;
  if (!verify) {
    return candidate;
  }
  return function KDCheckMapTileFillingCoordinateReuseOracle(...args) {
    const actual = Reflect.apply(candidate, this, args);
    const expected = Reflect.apply(official, this, args);
    stats.comparedCalls += 1;
    if (!Object.is(actual, expected)) {
      stats.mismatches += 1;
      if (stats.firstMismatch === null) {
        stats.firstMismatch = {
          mapTile: args[0]?.name ?? null,
          indX: args[1],
          indY: args[2],
          expected,
          actual,
        };
      }
    }
    return actual;
  };
}

function createPlaceDoorsAccessibleReuseCandidate(
  officialPlaceDoors,
  officialGetAccessibleRoom,
  stats,
  verify,
) {
  return function KinkyDungeonPlaceDoorsAccessibleReuse(...args) {
    stats.calls += 1;
    const previousGetAccessibleRoom = globalThis.KinkyDungeonGetAccessibleRoom;
    let cachedArgs = null;
    let cachedThis;
    let cachedResult;
    const candidateGetAccessibleRoom = function (...roomArgs) {
      stats.roomCalls += 1;
      if (
        cachedArgs !== null &&
        cachedThis === this &&
        cachedArgs.length === roomArgs.length &&
        cachedArgs.every((value, index) => Object.is(value, roomArgs[index]))
      ) {
        cachedArgs = null;
        stats.cacheHits += 1;
        if (verify) {
          const officialResult = Reflect.apply(
            officialGetAccessibleRoom,
            this,
            roomArgs,
          );
          stats.officialCalls += 1;
          stats.comparedCalls += 1;
          const exact =
            Array.isArray(cachedResult) === Array.isArray(officialResult) &&
            cachedResult?.constructor === officialResult?.constructor &&
            cachedResult?.length === officialResult?.length &&
            cachedResult?.every((value, index) =>
              Object.is(value, officialResult[index]),
            );
          if (!exact) {
            stats.mismatches += 1;
            if (stats.firstMismatch === null) {
              stats.firstMismatch = {
                args: roomArgs,
                cachedLength: cachedResult?.length ?? null,
                officialLength: officialResult?.length ?? null,
              };
            }
          }
        }
        return cachedResult;
      }
      const result = Reflect.apply(officialGetAccessibleRoom, this, roomArgs);
      cachedArgs = roomArgs;
      cachedThis = this;
      cachedResult = result;
      stats.officialCalls += 1;
      return result;
    };
    globalThis.KinkyDungeonGetAccessibleRoom = candidateGetAccessibleRoom;
    try {
      return Reflect.apply(officialPlaceDoors, this, args);
    } finally {
      if (
        globalThis.KinkyDungeonGetAccessibleRoom === candidateGetAccessibleRoom
      ) {
        globalThis.KinkyDungeonGetAccessibleRoom = previousGetAccessibleRoom;
      }
    }
  };
}

function createAccessibleQueueCandidate(
  official,
  stats,
  statKey,
  room,
  verify,
  numericState,
) {
  if (typeof official !== "function") {
    throw new TypeError("KD accessibility function is unavailable");
  }
  const source = Function.prototype.toString.call(official);
  const frontierAnchor = "while (Object.entries(checkGrid).length > 0)";
  const returnAnchor = room
    ? "return Object.keys(tempGrid);"
    : "return tempGrid;";
  if (
    (!numericState && source.split(frontierAnchor).length - 1 !== 1) ||
    (!numericState && source.split(returnAnchor).length - 1 !== 1)
  ) {
    throw new Error(
      "KD accessibility function no longer matches the 5.4.92 queue probe shape",
    );
  }

  const candidate = numericState
    ? room
      ? function accessibleRoomNumericStateCandidate(startX, startY) {
          stats[statKey] += 1;
          const tempGrid = {};
          const width = KDMapData.GridWidth;
          const height = KDMapData.GridHeight;
          const state = new Uint8Array(width * height);
          const startIndex = startX + startY * width;
          state[startIndex] = 2;
          const queue = [startIndex];
          const MTiles = KinkyDungeonMovableTilesSmartEnemy.replace(
            "D",
            "",
          ).replace("d", "");
          for (let checkIndex = 0; checkIndex < queue.length; checkIndex += 1) {
            const pointIndex = queue[checkIndex];
            const X = pointIndex % width;
            const Y = (pointIndex - X) / width;
            for (let XX = -1; XX <= 1; XX += 1) {
              for (let YY = -1; YY <= 1; YY += 1) {
                const nextX = X + XX;
                const nextY = Y + YY;
                if (
                  nextX >= 0 &&
                  nextX < width &&
                  nextY >= 0 &&
                  nextY < height
                ) {
                  const nextIndex = nextX + nextY * width;
                  if (
                    state[nextIndex] === 0 &&
                    KDInteractableTiles.includes(
                      KinkyDungeonMapGet(nextX, nextY),
                    )
                  ) {
                    const test = nextX + "," + nextY;
                    if (MTiles.includes(KinkyDungeonMapGet(nextX, nextY))) {
                      state[nextIndex] = 3;
                      queue.push(nextIndex);
                    } else {
                      state[nextIndex] = 1;
                    }
                    tempGrid[test] = true;
                  }
                }
              }
            }
            state[pointIndex] &= 1;
          }
          return Object.keys(tempGrid);
        }
      : function accessibleNumericStateCandidate(startX, startY, testX, testY) {
          stats[statKey] += 1;
          const tempGrid = {};
          const width = KDMapData.GridWidth;
          const height = KDMapData.GridHeight;
          const state = new Uint8Array(width * height);
          const startIndex = startX + startY * width;
          state[startIndex] = 2;
          const queue = [startIndex];
          for (let checkIndex = 0; checkIndex < queue.length; checkIndex += 1) {
            const pointIndex = queue[checkIndex];
            const X = pointIndex % width;
            const Y = (pointIndex - X) / width;
            for (let XX = -1; XX <= 1; XX += 1) {
              for (let YY = -1; YY <= 1; YY += 1) {
                const nextX = X + XX;
                const nextY = Y + YY;
                if (
                  nextX > 0 &&
                  nextX < width - 1 &&
                  nextY > 0 &&
                  nextY < height - 1
                ) {
                  const nextIndex = nextX + nextY * width;
                  if (state[nextIndex] === 0) {
                    const testLoc = nextX + "," + nextY;
                    const tileMetadata = KinkyDungeonTilesGet(testLoc);
                    const locked =
                      (testX != undefined &&
                        testY != undefined &&
                        nextX == testX &&
                        nextY == testY) ||
                      (tileMetadata && tileMetadata.Lock);
                    if (
                      KDInteractableTiles.includes(
                        KinkyDungeonMapGet(nextX, nextY),
                      ) &&
                      !locked
                    ) {
                      if (
                        KinkyDungeonMovableTilesSmartEnemy.includes(
                          KinkyDungeonMapGet(nextX, nextY),
                        )
                      ) {
                        state[nextIndex] = 3;
                        queue.push(nextIndex);
                      } else {
                        state[nextIndex] = 1;
                      }
                      tempGrid[testLoc] = { x: nextX, y: nextY };
                    }
                  }
                }
              }
            }
            state[pointIndex] &= 1;
          }
          return tempGrid;
        }
    : room
      ? function accessibleRoomQueueCandidate(startX, startY) {
          stats[statKey] += 1;
          const tempGrid = {};
          const checkGrid = {};
          const startLocation = startX + "," + startY;
          const startPoint = { x: startX, y: startY };
          checkGrid[startLocation] = startPoint;
          const checkLocations = [startLocation];
          const checkPoints = [startPoint];
          const Tiles = KDInteractableTiles.replace("D", "").replace("d", "");
          const MTiles = KinkyDungeonMovableTilesSmartEnemy.replace(
            "D",
            "",
          ).replace("d", "");
          void Tiles;
          for (
            let checkIndex = 0;
            checkIndex < checkLocations.length;
            checkIndex += 1
          ) {
            const checkLocation = checkLocations[checkIndex];
            const point = checkPoints[checkIndex];
            for (let XX = -1; XX <= 1; XX += 1) {
              for (let YY = -1; YY <= 1; YY += 1) {
                const test = point.x + XX + "," + (point.y + YY);
                if (
                  !checkGrid[test] &&
                  !tempGrid[test] &&
                  KDInteractableTiles.includes(
                    KinkyDungeonMapGet(point.x + XX, point.y + YY),
                  )
                ) {
                  if (
                    MTiles.includes(
                      KinkyDungeonMapGet(point.x + XX, point.y + YY),
                    )
                  ) {
                    const nextPoint = {
                      x: point.x + XX,
                      y: point.y + YY,
                    };
                    checkGrid[test] = nextPoint;
                    checkLocations.push(test);
                    checkPoints.push(nextPoint);
                  }
                  tempGrid[test] = true;
                }
              }
            }
            delete checkGrid[checkLocation];
          }
          return Object.keys(tempGrid);
        }
      : function accessibleQueueCandidate(startX, startY, testX, testY) {
          stats[statKey] += 1;
          const tempGrid = {};
          const checkGrid = {};
          const startLocation = startX + "," + startY;
          const startPoint = { x: startX, y: startY };
          checkGrid[startLocation] = startPoint;
          const checkLocations = [startLocation];
          const checkPoints = [startPoint];
          for (
            let checkIndex = 0;
            checkIndex < checkLocations.length;
            checkIndex += 1
          ) {
            const checkLocation = checkLocations[checkIndex];
            const point = checkPoints[checkIndex];
            const X = point.x;
            const Y = point.y;
            for (let XX = -1; XX <= 1; XX += 1) {
              for (let YY = -1; YY <= 1; YY += 1) {
                const testLoc = X + XX + "," + (Y + YY);
                const locked =
                  (testX != undefined &&
                    testY != undefined &&
                    X + XX == testX &&
                    Y + YY == testY) ||
                  (KinkyDungeonTilesGet("" + (X + XX) + "," + (Y + YY)) &&
                    KinkyDungeonTilesGet("" + (X + XX) + "," + (Y + YY)).Lock);
                if (
                  !checkGrid[testLoc] &&
                  !tempGrid[testLoc] &&
                  X + XX > 0 &&
                  X + XX < KDMapData.GridWidth - 1 &&
                  Y + YY > 0 &&
                  Y + YY < KDMapData.GridHeight - 1 &&
                  KDInteractableTiles.includes(
                    KinkyDungeonMapGet(X + XX, Y + YY),
                  ) &&
                  !locked
                ) {
                  if (
                    KinkyDungeonMovableTilesSmartEnemy.includes(
                      KinkyDungeonMapGet(X + XX, Y + YY),
                    )
                  ) {
                    const nextPoint = { x: X + XX, y: Y + YY };
                    checkGrid[testLoc] = nextPoint;
                    checkLocations.push(testLoc);
                    checkPoints.push(nextPoint);
                  }
                  tempGrid[testLoc] = { x: X + XX, y: Y + YY };
                }
              }
            }
            delete checkGrid[checkLocation];
          }
          return tempGrid;
        };

  if (!verify) {
    return candidate;
  }
  return function accessibleQueueVerifier(...args) {
    const expected = Reflect.apply(official, this, args);
    const actual = Reflect.apply(candidate, this, args);
    stats.comparedCalls += 1;
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);
    let matches = expectedKeys.length === actualKeys.length;
    for (let index = 0; matches && index < expectedKeys.length; index += 1) {
      const expectedKey = expectedKeys[index];
      const actualKey = actualKeys[index];
      if (expectedKey !== actualKey) {
        matches = false;
      } else if (!room) {
        const expectedPoint = expected[expectedKey];
        const actualPoint = actual[actualKey];
        matches =
          expectedPoint?.x === actualPoint?.x &&
          expectedPoint?.y === actualPoint?.y;
      }
    }
    if (!matches) {
      stats.mismatches += 1;
      if (stats.firstMismatch === null) {
        stats.firstMismatch = {
          statKey,
          expectedLength: expectedKeys.length,
          actualLength: actualKeys.length,
          expectedPrefix: expectedKeys.slice(0, 12),
          actualPrefix: actualKeys.slice(0, 12),
        };
      }
    }
    return actual;
  };
}

function createRestraintEnemyKeysCandidate(official, stats) {
  if (typeof official !== "function") {
    throw new TypeError("KDGetRestraintsEligible is unavailable");
  }
  const source = Function.prototype.toString.call(official);
  const arousalAnchor =
    'let arousalMode = KinkyDungeonStatsChoice.get("arousalMode");';
  const additiveLoop =
    /for \(let t of tags\.keys\(\)\) \{\s*if \(restraint\.enemyTags\[t\] != undefined\) \{\s*weight \+= restraint\.enemyTags\[t\];\s*enabled = true;\s*\}\s*\}/;
  const multiplierLoop =
    /for \(let t of tags\.keys\(\)\) \{\s*if \(restraint\.enemyTagsMult\[t\] != undefined\) \{\s*weight \*= restraint\.enemyTagsMult\[t\];\s*\}\s*\}/;
  if (
    source.split(arousalAnchor).length - 1 !== 1 ||
    !additiveLoop.test(source) ||
    !multiplierLoop.test(source)
  ) {
    throw new Error(
      "KDGetRestraintsEligible no longer matches the 5.4.92 enemy-key probe shape",
    );
  }
  const transformed = source
    .replace(
      arousalAnchor,
      `stats.calls += 1;
    ${arousalAnchor}`,
    )
    .replace(
      additiveLoop,
      `for (let t in restraint.enemyTags) {
                        if (tags.has(t)) {
                            weight += restraint.enemyTags[t];
                            enabled = true;
                        }
                    }`,
    )
    .replace(
      multiplierLoop,
      `for (let t in restraint.enemyTagsMult) {
                            if (tags.has(t)) {
                                weight *= restraint.enemyTagsMult[t];
                            }
                        }`,
    );
  const candidate = eval(`(${transformed})`);
  if (typeof candidate !== "function") {
    throw new TypeError("The restraint enemy-key probe did not compile");
  }
  return candidate;
}

function createRestraintEquivalenceCandidate(official, candidate, stats) {
  if (typeof official !== "function" || typeof candidate !== "function") {
    throw new TypeError("The restraint equivalence probe needs two functions");
  }
  return function KDGetRestraintsEligibleEquivalenceProbe(...args) {
    const expected = Reflect.apply(official, this, args);
    let actual;
    let mismatch = null;
    try {
      actual = Reflect.apply(candidate, this, args);
      if (!Array.isArray(expected) || !Array.isArray(actual)) {
        mismatch = "one result is not an array";
      } else if (expected.length !== actual.length) {
        mismatch = `length ${expected.length} != ${actual.length}`;
      } else {
        for (let index = 0; index < expected.length; index += 1) {
          const left = expected[index];
          const right = actual[index];
          const leftKeys = Object.keys(left).sort();
          const rightKeys = Object.keys(right).sort();
          if (
            leftKeys.length !== rightKeys.length ||
            leftKeys.some((key, keyIndex) => key !== rightKeys[keyIndex])
          ) {
            mismatch = `entry ${index} has different keys`;
            break;
          }
          for (const key of leftKeys) {
            if (!Object.is(left[key], right[key])) {
              mismatch = `entry ${index} differs at ${key}`;
              break;
            }
          }
          if (mismatch !== null) break;
        }
      }
    } catch (error) {
      mismatch =
        "candidate threw " +
        (error instanceof Error ? error.message : String(error));
    }
    stats.comparedCalls += 1;
    if (mismatch !== null) {
      stats.mismatches += 1;
      if (stats.firstMismatch === null) {
        stats.firstMismatch = {
          call: stats.comparedCalls,
          mismatch,
          level: args[1],
          floorIndex: args[2],
          enemyTags: Array.isArray(args[0]?.tags) ? [...args[0].tags] : null,
          expectedLength: Array.isArray(expected) ? expected.length : null,
          actualLength: Array.isArray(actual) ? actual.length : null,
        };
      }
    }
    return expected;
  };
}

function createEnemySelectorHoistCandidate(
  official,
  stats,
  enableAngerCache = false,
  enableSingleTagCache = false,
  enableLongTagCache = false,
  enableWeightedQueryCache = false,
  enableWeightedSingleTagCache = false,
  enableWeightedFilterTagCache = false,
  restrictLongTagCacheToCanonical = false,
) {
  const expectedEnemies = KinkyDungeonEnemies;
  const expectedPerkToggleTags = KDPerkToggleTags;
  const expectedGroundTiles = KinkyDungeonGroundTiles;
  const expectedAvoidTiles = KDDefaultAvoidTiles;
  const expectedMapGet = Map.prototype.get;
  const expectedStringIncludes = String.prototype.includes;
  const expectedObjectEntries = Object.entries;
  const enemyTagKeyCounts = new WeakMap();
  const angerMatchCounts = new WeakMap();
  const singleTagMatchCounts = new Map();
  const longTagMatchCounts = new Map();
  const weightedQueryCache = new Map();
  const angerTagSequence = [
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
  ];
  const canonicalTrapTypes = new Set([
    "illusionTrap",
    "latexTrap",
    "leatherTrap",
    "metalTrap",
    "ropeTrap",
    "skeletonTrap",
  ]);
  const isCanonicalLongTagQuery = (tags) => {
    if (
      tags.length < 100 ||
      tags.length > 105 ||
      tags[0] !== "trap" ||
      !canonicalTrapTypes.has(tags[1]) ||
      tags[2] !== "EnemyEnemy" ||
      tags[99] !== "jailbreak"
    ) {
      return false;
    }
    let suffixIndex = 100;
    if (
      tags[100] === "slimeOptout" &&
      tags[101] === "bubbleOptout" &&
      tags[102] === "petOptout"
    ) {
      suffixIndex = 103;
    }
    if (tags.length === suffixIndex) return true;
    if (
      tags.length === suffixIndex + 1 &&
      ((tags[1] === "leatherTrap" && tags[suffixIndex] === "harness") ||
        (tags[1] === "metalTrap" && tags[suffixIndex] === "cuffs"))
    ) {
      return true;
    }
    return (
      tags.length === suffixIndex + 2 &&
      tags[1] === "leatherTrap" &&
      tags[suffixIndex] === "harness" &&
      tags[suffixIndex + 1] === "gag"
    );
  };

  return function KinkyDungeonGetEnemyHoistCandidate(
    enemytags,
    Level,
    Index,
    Tile,
    requireTags,
    alliances,
    bonusTags,
    filterTags,
    requireSingleTag,
    minWeight = 0.0,
    minWeightFallback = true,
    noOverrideFloor = false,
  ) {
    stats.calls += 1;
    let fallbackReason = null;
    if (!(KinkyDungeonStatsChoice instanceof Map)) {
      fallbackReason = "stats-not-map";
    } else if (KinkyDungeonStatsChoice.get !== expectedMapGet) {
      fallbackReason = "stats-get-changed";
    } else if (KinkyDungeonEnemies !== expectedEnemies) {
      fallbackReason = "enemy-catalog-replaced";
    } else if (KDPerkToggleTags !== expectedPerkToggleTags) {
      fallbackReason = "perk-tags-replaced";
    } else if (KinkyDungeonGroundTiles !== expectedGroundTiles) {
      fallbackReason = "ground-tiles-replaced";
    } else if (KDDefaultAvoidTiles !== expectedAvoidTiles) {
      fallbackReason = "avoid-tiles-replaced";
    } else if (KDDefaultAvoidTiles.includes !== expectedStringIncludes) {
      fallbackReason = "avoid-includes-changed";
    } else if (KinkyDungeonGroundTiles.includes !== expectedStringIncludes) {
      fallbackReason = "ground-includes-changed";
    } else if (Object.entries !== expectedObjectEntries) {
      fallbackReason = "object-entries-changed";
    } else if (!plainDataObject(bonusTags)) {
      fallbackReason = "dynamic-bonus-tags";
    }
    if (fallbackReason !== null) {
      stats.fallbackCalls += 1;
      stats.fallbackReasons[fallbackReason] =
        (stats.fallbackReasons[fallbackReason] || 0) + 1;
      return Reflect.apply(official, this, arguments);
    }

    stats.optimizedCalls += 1;
    let enemyWeightTotal = 0;
    const enemyWeights = [];
    const tags = Object.assign([], enemytags);
    for (const perkTag of KDPerkToggleTags) {
      if (KinkyDungeonStatsChoice.get(perkTag)) {
        tags.push(perkTag);
      }
    }

    const effectiveLevel = Level + 25 * KinkyDungeonNewGame;
    const arousalMode = KinkyDungeonStatsChoice.get("arousalMode");
    const hasGrateTag = tags.includes("grate");
    const groundTile = KinkyDungeonGroundTiles.includes(Tile);
    const avoidTile = KDDefaultAvoidTiles.includes(Tile);
    const noOverrideTags = new Array(tags.length);
    let noOverrideTagCount = 0;
    for (let tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
      const tag = tags[tagIndex];
      noOverrideTags[tagIndex] =
        tag === "boss" ||
        tag === "miniboss" ||
        tag === "elite" ||
        tag === "minor";
      if (noOverrideTags[tagIndex]) noOverrideTagCount += 1;
    }
    stats.tagLengthCounts[tags.length] =
      (stats.tagLengthCounts[tags.length] || 0) + 1;
    const tagSequence = tags.join("\u001f");
    stats.tagSequenceCounts[tagSequence] =
      (stats.tagSequenceCounts[tagSequence] || 0) + 1;
    stats.normalTagSlots += tags.length - noOverrideTagCount;
    stats.noOverrideTagSlots += noOverrideTagCount;
    let useAngerTagCache =
      enableAngerCache &&
      !noOverrideFloor &&
      noOverrideTagCount === 0 &&
      tags.length === angerTagSequence.length;
    if (useAngerTagCache) {
      for (let tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
        if (tags[tagIndex] !== angerTagSequence[tagIndex]) {
          useAngerTagCache = false;
          break;
        }
      }
    }
    if (useAngerTagCache) {
      stats.angerCacheCalls += 1;
      if (stats.angerCountVector === null) {
        stats.angerCountVector = KinkyDungeonEnemies.map((enemy) => {
          let matchCount = 0;
          for (
            let tagIndex = 0;
            tagIndex < angerTagSequence.length;
            tagIndex += 1
          ) {
            if (enemy.tags[angerTagSequence[tagIndex]]) matchCount += 1;
          }
          return matchCount;
        });
      }
    }
    const singleTag =
      enableSingleTagCache &&
      !noOverrideFloor &&
      noOverrideTagCount === 0 &&
      tags.length === 1 &&
      (tags[0] === "statue" || tags[0] === "obstacletile")
        ? tags[0]
        : null;
    let singleTagMatches = null;
    if (singleTag !== null) {
      stats.singleTagCacheCalls += 1;
      singleTagMatches = singleTagMatchCounts.get(singleTag);
      if (singleTagMatches === undefined) {
        singleTagMatches = new WeakMap();
        singleTagMatchCounts.set(singleTag, singleTagMatches);
      }
      if (stats.singleTagMatchVectors[singleTag] === undefined) {
        stats.singleTagMatchVectors[singleTag] = KinkyDungeonEnemies.map(
          (enemy) => Boolean(enemy.tags[singleTag]),
        );
      }
    }
    let longTagMatches = null;
    if (
      enableLongTagCache &&
      !noOverrideFloor &&
      noOverrideTagCount === 0 &&
      tags.length >= 100 &&
      (!restrictLongTagCacheToCanonical || isCanonicalLongTagQuery(tags))
    ) {
      stats.longTagCacheCalls += 1;
      longTagMatches = longTagMatchCounts.get(tagSequence);
      if (longTagMatches === undefined) {
        longTagMatches = new WeakMap();
        longTagMatchCounts.set(tagSequence, longTagMatches);
        stats.longTagSequences += 1;
      }
    }
    const weightedSingleTag =
      enableWeightedSingleTagCache &&
      !noOverrideFloor &&
      noOverrideTagCount === 0 &&
      tags.length === 1 &&
      (tags[0] === "mushroom" ||
        tags[0] === "obstacletile" ||
        tags[0] === "statue" ||
        tags[0] === "elemental" ||
        tags[0] === "human")
        ? tags[0]
        : null;
    const bonusEntries =
      bonusTags === undefined || bonusTags === null
        ? null
        : Object.entries(bonusTags);
    let weightedQueryKey = null;
    let weightedRequireTagsKey = "";
    let weightedAlliancesKey = "";
    let weightedFilterTagsKey = "";
    let weightedFilterTagQuery = false;
    if (
      enableWeightedQueryCache &&
      (useAngerTagCache ||
        longTagMatches !== null ||
        weightedSingleTag !== null)
    ) {
      stats.weightedQueryCacheCandidates += 1;
      let ineligibleReason = null;
      if (requireTags !== undefined && requireTags !== null) {
        weightedRequireTagsKey = encodeStringArray(requireTags);
        if (weightedRequireTagsKey === null) {
          ineligibleReason = "require-tags";
        }
      }
      if (
        ineligibleReason === null &&
        alliances !== undefined &&
        alliances !== null
      ) {
        weightedAlliancesKey = encodeAlliances(alliances);
        if (weightedAlliancesKey === null) {
          ineligibleReason = "alliances";
        }
      }
      if (ineligibleReason === null && bonusEntries !== null) {
        ineligibleReason = "bonus-tags";
      } else if (
        ineligibleReason === null &&
        filterTags !== undefined &&
        filterTags !== null
      ) {
        if (enableWeightedFilterTagCache) {
          weightedFilterTagsKey = encodeStringArray(filterTags);
          if (weightedFilterTagsKey === null) {
            ineligibleReason = "filter-tags";
          } else {
            weightedFilterTagQuery = true;
          }
        } else {
          ineligibleReason = "filter-tags";
        }
      } else if (
        ineligibleReason === null &&
        requireSingleTag !== undefined &&
        requireSingleTag !== null
      ) {
        ineligibleReason = "require-single-tag";
      } else if (ineligibleReason === null && minWeight !== 0) {
        ineligibleReason = "minimum-weight";
      } else if (ineligibleReason === null && !minWeightFallback) {
        ineligibleReason = "minimum-weight-fallback";
      } else if (ineligibleReason === null && noOverrideFloor) {
        ineligibleReason = "override-floor";
      }
      if (ineligibleReason === null) {
        stats.weightedQueryCacheCalls += 1;
        if (weightedSingleTag !== null) {
          stats.weightedSingleTagCacheCalls += 1;
        }
        if (weightedFilterTagQuery) {
          stats.weightedFilterTagCacheCalls += 1;
        }
        weightedQueryKey = [
          stats.weightedQueryEpoch,
          tagSequence,
          Level,
          Index,
          Tile,
          KinkyDungeonNewGame,
          arousalMode ? 1 : 0,
          weightedRequireTagsKey,
          weightedAlliancesKey,
          weightedFilterTagsKey,
        ].join("\u001d");
        const cachedQuery = weightedQueryCache.get(weightedQueryKey);
        if (cachedQuery !== undefined) {
          stats.weightedQueryCacheHits += 1;
          stats.weightedQueryEnemiesElided += KinkyDungeonEnemies.length;
          if (weightedSingleTag !== null) {
            stats.weightedSingleTagCacheHits += 1;
            stats.weightedSingleTagEnemiesElided += KinkyDungeonEnemies.length;
          }
          if (weightedFilterTagQuery) {
            stats.weightedFilterTagCacheHits += 1;
            stats.weightedFilterTagEnemiesElided += KinkyDungeonEnemies.length;
          }
          const selection = KDRandom() * cachedQuery.enemyWeightTotal;
          for (
            let index = cachedQuery.enemyWeights.length - 1;
            index >= 0;
            index -= 1
          ) {
            if (selection > cachedQuery.enemyWeights[index].weight) {
              if (cachedQuery.enemyWeights[index].enemy.name == "Mimic") {
                console.log("Mimic says boo");
              }
              stats.selections += 1;
              return cachedQuery.enemyWeights[index].enemy;
            }
          }
          return undefined;
        }
      } else {
        stats.weightedQueryIneligibleReasons[ineligibleReason] =
          (stats.weightedQueryIneligibleReasons[ineligibleReason] || 0) + 1;
      }
    }

    stats.enemiesScanned += KinkyDungeonEnemies.length;
    for (const enemy of KinkyDungeonEnemies) {
      let weightMulti = 1.0;
      let weightBonus = 0;
      if (!enableAngerCache) {
        let enemyTagKeyCount = enemyTagKeyCounts.get(enemy.tags);
        if (enemyTagKeyCount === undefined) {
          enemyTagKeyCount = Object.keys(enemy.tags).length;
          enemyTagKeyCounts.set(enemy.tags, enemyTagKeyCount);
          stats.uniqueEnemyTagObjects += 1;
          stats.uniqueEnemyTagKeys += enemyTagKeyCount;
        }
        stats.enemyTagKeyIterations += enemyTagKeyCount;
      }

      if (!arousalMode && enemy.arousalMode) continue;

      if (enemy.shrines) {
        for (const shrine of enemy.shrines) {
          if (KinkyDungeonGoddessRep[shrine]) {
            const rep = KinkyDungeonGoddessRep[shrine];
            if (rep > 0) {
              weightMulti *= Math.max(0, 1 - rep / 100);
            } else if (rep < 0) {
              weightMulti = Math.max(weightMulti, Math.max(1, 1 - rep / 100));
              weightBonus = Math.max(weightBonus, Math.min(10, -rep / 10));
            }
          }
        }
      }

      if (!enemy.terrainTags?.grate && hasGrateTag) continue;

      let overrideFloor = false;
      if (useAngerTagCache && !enemy.noOverrideFloor) {
        let encodedMatchCount = angerMatchCounts.get(enemy.tags);
        if (encodedMatchCount === undefined) {
          let matchCount = 0;
          for (
            let tagIndex = 0;
            tagIndex < angerTagSequence.length;
            tagIndex += 1
          ) {
            if (enemy.tags[angerTagSequence[tagIndex]]) matchCount += 1;
          }
          encodedMatchCount = matchCount + 1;
          angerMatchCounts.set(enemy.tags, encodedMatchCount);
          stats.angerCacheBuilds += 1;
        } else {
          stats.angerCacheHits += 1;
          stats.angerTagChecksElided += angerTagSequence.length;
        }
        const matchCount = encodedMatchCount - 1;
        overrideFloor = matchCount > 0;
        for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
          weightMulti *= 1.25;
        }
      } else if (singleTagMatches !== null && !enemy.noOverrideFloor) {
        let encodedMatch = singleTagMatches.get(enemy.tags);
        if (encodedMatch === undefined) {
          encodedMatch = enemy.tags[singleTag] ? 2 : 1;
          singleTagMatches.set(enemy.tags, encodedMatch);
          stats.singleTagCacheBuilds += 1;
        } else {
          stats.singleTagCacheHits += 1;
          stats.singleTagChecksElided += 1;
        }
        if (encodedMatch === 2) {
          overrideFloor = true;
          weightMulti *= 1.25;
        }
      } else if (longTagMatches !== null && !enemy.noOverrideFloor) {
        let encodedMatchCount = longTagMatches.get(enemy.tags);
        if (encodedMatchCount === undefined) {
          let matchCount = 0;
          for (let tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
            if (enemy.tags[tags[tagIndex]]) matchCount += 1;
          }
          encodedMatchCount = matchCount + 1;
          longTagMatches.set(enemy.tags, encodedMatchCount);
          stats.longTagCacheBuilds += 1;
        } else {
          stats.longTagCacheHits += 1;
          stats.longTagChecksElided += tags.length;
        }
        const matchCount = encodedMatchCount - 1;
        overrideFloor = matchCount > 0;
        for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
          weightMulti *= 1.25;
        }
      } else {
        if (!enableAngerCache && !noOverrideFloor && !enemy.noOverrideFloor) {
          stats.dynamicTagChecks += tags.length - noOverrideTagCount;
        }
        for (let tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
          const tag = tags[tagIndex];
          if (
            !noOverrideFloor &&
            !enemy.noOverrideFloor &&
            !noOverrideTags[tagIndex]
          ) {
            if (enemy.tags[tag]) {
              if (!enableAngerCache) stats.dynamicTagMatches += 1;
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
        enemy.floors[Index]
      )) {
        continue;
      }
      if (bonusEntries !== null) {
        for (const bonusEntry of bonusEntries) {
          if (enemy.tags[bonusEntry[0]]) {
            weightBonus += bonusEntry[1].bonus;
            weightMulti *= bonusEntry[1].mult;
          }
        }
      }

      if (weightMulti == 0) continue;

      if (
        effectiveLevel >= enemy.minLevel &&
        (!enemy.maxLevel || effectiveLevel < enemy.maxLevel) &&
        (!filterTags ||
          !filterTags.some((tag) => {
            return enemy.tags[tag];
          })) &&
        (!alliances?.requireHostile ||
          (alliances?.requireHostile == "Player" && !enemy.faction) ||
          (enemy.faction &&
            KDFactionRelation(alliances?.requireHostile, enemy.faction) <=
              -0.5)) &&
        (!alliances?.requireAllied ||
          (alliances?.requireAllied == "Player" && !enemy.faction) ||
          (enemy.faction &&
            KDFactionRelation(alliances?.requireAllied, enemy.faction) >
              0.2)) &&
        (!alliances?.requireNonHostile ||
          (alliances?.requireNonHostile == "Player" && !enemy.faction) ||
          (enemy.faction &&
            KDFactionRelation(alliances?.requireNonHostile, enemy.faction) >
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
              Math.floor(Level / KDLevelsPerCheckpoint);
          }
          for (const tag of tags) {
            if (enemy.terrainTags[tag]) {
              weight += enemy.terrainTags[tag];
            }
          }

          if (enemy.weightMult) {
            weightMulti *= enemy.weightMult;
          }

          if (weight > minWeight) {
            enemyWeights.push({
              enemy,
              weight: enemyWeightTotal,
            });
            enemyWeightTotal += Math.max(0, weight * weightMulti);
          }
        }
      }
    }

    if (weightedQueryKey !== null) {
      weightedQueryCache.set(weightedQueryKey, {
        enemyWeightTotal,
        enemyWeights,
      });
      stats.weightedQueryCacheBuilds += 1;
      stats.weightedQueryCacheEntries = weightedQueryCache.size;
      if (weightedSingleTag !== null) {
        stats.weightedSingleTagCacheBuilds += 1;
      }
      if (weightedFilterTagQuery) {
        stats.weightedFilterTagCacheBuilds += 1;
      }
    }
    const selection = KDRandom() * enemyWeightTotal;
    for (let index = enemyWeights.length - 1; index >= 0; index -= 1) {
      if (selection > enemyWeights[index].weight) {
        if (enemyWeights[index].enemy.name == "Mimic") {
          console.log("Mimic says boo");
        }
        stats.selections += 1;
        return enemyWeights[index].enemy;
      }
    }

    if (minWeight > 0 && minWeightFallback) {
      stats.recursiveFallbacks += 1;
      return KinkyDungeonGetEnemyHoistCandidate(
        enemytags,
        Level,
        Index,
        Tile,
        requireTags,
        alliances,
        bonusTags,
        filterTags,
        requireSingleTag,
        0,
        false,
      );
    }
    return undefined;
  };

  function plainDataObject(value) {
    if (value === undefined || value === null) return true;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor)) {
        return false;
      }
    }
    return true;
  }

  function encodeStringArray(value) {
    if (!Array.isArray(value)) return null;
    let encoded = value.length + ":";
    for (let index = 0; index < value.length; index += 1) {
      if (typeof value[index] !== "string") return null;
      encoded += value[index].length + ":" + value[index];
    }
    return encoded;
  }

  function encodeAlliances(value) {
    if (!plainDataObject(value)) return null;
    const fields = [
      value.requireHostile,
      value.requireAllied,
      value.requireNonHostile,
    ];
    let encoded = "";
    for (const field of fields) {
      if (field === undefined || field === null || field === "") {
        encoded += "0:";
      } else if (typeof field === "string") {
        encoded += field.length + ":" + field;
      } else {
        return null;
      }
    }
    return encoded;
  }
}

function percentile(sorted, quantile) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * quantile) - 1),
  );
  return sorted[index];
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
        15_000,
      );
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("Failed to connect to the KD renderer"));
        },
        { once: true },
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
      if (message.id === undefined) return;
      const pending = this.#pending.get(message.id);
      if (pending === undefined) return;
      this.#pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error !== undefined) {
        pending.reject(
          new Error(
            `CDP ${pending.method} failed: ${JSON.stringify(message.error)}`,
          ),
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
        timeout: timeoutMs,
      },
      timeoutMs + 5_000,
    );
    if (response.exceptionDetails !== undefined) {
      const details = response.exceptionDetails;
      const description =
        details.exception?.description ??
        details.text ??
        "unknown renderer error";
      throw new Error(description);
    }
    return response.result?.value;
  }

  close() {
    this.#socket.close();
  }
}

function summarizeProfile(profile) {
  const parents = new Map();
  const nodesById = new Map();
  for (const node of profile.nodes) {
    nodesById.set(node.id, node);
    for (const child of node.children ?? []) parents.set(child, node.id);
  }
  const selfById = new Map();
  const totalById = new Map();
  const callerEdges = new Map();
  for (let index = 0; index < (profile.samples?.length ?? 0); index += 1) {
    const id = profile.samples[index];
    const duration = profile.timeDeltas?.[index] ?? 0;
    selfById.set(id, (selfById.get(id) ?? 0) + duration);
    const calleeFrame = nodesById.get(id)?.callFrame;
    const callerFrame = nodesById.get(parents.get(id))?.callFrame;
    if (calleeFrame !== undefined && callerFrame !== undefined) {
      const calleeName = calleeFrame.functionName || "(anonymous)";
      const callerName = callerFrame.functionName || "(anonymous)";
      const edgeKey = [
        calleeName,
        calleeFrame.url || "(native)",
        calleeFrame.lineNumber,
        callerName,
        callerFrame.url || "(native)",
        callerFrame.lineNumber,
      ].join("\0");
      const edge = callerEdges.get(edgeKey) ?? {
        callee: calleeName,
        calleeUrl: calleeFrame.url || "(native)",
        calleeLine: calleeFrame.lineNumber + 1,
        caller: callerName,
        callerUrl: callerFrame.url || "(native)",
        callerLine: callerFrame.lineNumber + 1,
        selfMicroseconds: 0,
      };
      edge.selfMicroseconds += duration;
      callerEdges.set(edgeKey, edge);
    }
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
      frame.columnNumber,
    ].join("\0");
    const entry = merged.get(key) ?? {
      functionName: frame.functionName || "(anonymous)",
      url: frame.url || "(native)",
      line: frame.lineNumber + 1,
      column: frame.columnNumber + 1,
      selfMicroseconds: 0,
      totalMicroseconds: 0,
      samples: 0,
    };
    entry.selfMicroseconds += selfById.get(node.id) ?? 0;
    entry.totalMicroseconds += totalById.get(node.id) ?? 0;
    entry.samples += node.hitCount ?? 0;
    merged.set(key, entry);
    for (const position of node.positionTicks ?? []) {
      const lineKey = `${frame.url || "(native)"}\0${position.line}`;
      const line = lineTicks.get(lineKey) ?? {
        url: frame.url || "(native)",
        line: position.line,
        ticks: 0,
        functions: new Set(),
      };
      line.ticks += position.ticks;
      line.functions.add(frame.functionName || "(anonymous)");
      lineTicks.set(lineKey, line);
    }
  }
  const sampledMicroseconds = (profile.timeDeltas ?? []).reduce(
    (total, duration) => total + duration,
    0,
  );
  const finish = (entry) => ({
    ...entry,
    selfMilliseconds: round(entry.selfMicroseconds / 1_000),
    totalMilliseconds: round(entry.totalMicroseconds / 1_000),
    selfPercent: round(
      sampledMicroseconds === 0
        ? 0
        : (entry.selfMicroseconds / sampledMicroseconds) * 100,
    ),
    totalPercent: round(
      sampledMicroseconds === 0
        ? 0
        : (entry.totalMicroseconds / sampledMicroseconds) * 100,
    ),
  });
  const functions = [...merged.values()];
  return {
    startTime: profile.startTime,
    endTime: profile.endTime,
    sampledMicroseconds,
    sampleCount: profile.samples?.length ?? 0,
    topSelf: [...functions]
      .sort((left, right) => right.selfMicroseconds - left.selfMicroseconds)
      .slice(0, 50)
      .map(finish),
    topTotal: [...functions]
      .sort((left, right) => right.totalMicroseconds - left.totalMicroseconds)
      .slice(0, 50)
      .map(finish),
    topCallerEdges: [...callerEdges.values()]
      .sort((left, right) => right.selfMicroseconds - left.selfMicroseconds)
      .slice(0, 120)
      .map((entry) => ({
        ...entry,
        selfMilliseconds: round(entry.selfMicroseconds / 1_000),
        selfPercent: round(
          sampledMicroseconds === 0
            ? 0
            : (entry.selfMicroseconds / sampledMicroseconds) * 100,
        ),
      })),
    topLines: [...lineTicks.values()]
      .map((entry) => ({
        url: entry.url,
        line: entry.line,
        ticks: entry.ticks,
        functions: [...entry.functions].sort(),
      }))
      .sort((left, right) => right.ticks - left.ticks)
      .slice(0, 120),
  };
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

await main();
