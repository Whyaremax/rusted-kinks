// SPDX-License-Identifier: MIT
import { findKnownUpstreamRelease } from "@kd-hybrid/runtime";

interface SourceConfiguration {
  readonly upstreamVersion?: string;
  readonly upstreamBundleSha256?: string;
  readonly sourceOptimizations?: boolean;
}

/**
 * Audited 5.5.6 v1 changes startup atlases/Pixi. V2 additionally hoists only
 * primitive cache-key construction, preserving every gameplay read and write.
 * It adds no result cache or changed gameplay ordering. Compatibility mode
 * bypasses that slice with disablePathCacheHoistedKeySuffix before mod execution.
 * Other/unknown source sets retain the conservative restart policy. Revisit
 * this inventory before adding stateful gameplay source patches to 5.5.6.
 */
export function hasGameplaySourceOptimizations(
  config: SourceConfiguration | undefined,
): boolean {
  if (config?.sourceOptimizations === false) return false;
  const release = findKnownUpstreamRelease(config?.upstreamBundleSha256);
  return !(release?.gameVersion === "5.5.6" && config?.upstreamVersion === "5.5.6");
}
