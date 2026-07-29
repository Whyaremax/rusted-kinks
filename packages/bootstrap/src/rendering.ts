import type { QualityTier } from "@kd-hybrid/runtime";

import {
  installKinkyDungeonFramePacing,
  type KinkyDungeonFramePacingHandle,
  type KinkyDungeonFramePacingMode,
  type KinkyDungeonFramePacingStatus
} from "./frame-pacing.js";
import {
  installKinkyDungeonTexturePolicy,
  type KinkyDungeonTextureMode,
  type KinkyDungeonTexturePolicyHandle,
  type KinkyDungeonTexturePolicyStatus
} from "./texture-policy.js";

type UnknownRecord = Record<string, unknown>;

export type { KinkyDungeonTextureMode } from "./texture-policy.js";
export type { KinkyDungeonFramePacingMode } from "./frame-pacing.js";

export interface KinkyDungeonRenderingStatus
  extends KinkyDungeonTexturePolicyStatus {
  readonly tier: QualityTier;
  readonly framePacing: KinkyDungeonFramePacingStatus;
}

export interface KinkyDungeonRenderingOptions {
  readonly tier: QualityTier;
  readonly upstreamVersion?: string;
  readonly upstreamBundleSha256?: string;
  readonly textureMode?: KinkyDungeonTextureMode;
  readonly framePacingMode?: KinkyDungeonFramePacingMode;
  readonly textureSampleIntervalMs?: number;
  readonly now?: () => number;
}

export interface KinkyDungeonRenderingHandle {
  status(): KinkyDungeonRenderingStatus;
  sampleTextureMemory(): number | undefined;
  setTier(tier: QualityTier): void;
  setFramePacingMode(mode: KinkyDungeonFramePacingMode): void;
  dispose(): void;
}

interface RenderingTarget extends UnknownRecord {
  KDHybridRendering?: KinkyDungeonRenderingHandle;
}

export function installKinkyDungeonRendering(
  options: KinkyDungeonRenderingOptions,
  target: RenderingTarget = globalThis as RenderingTarget
): KinkyDungeonRenderingHandle {
  let tier = options.tier;
  const textures: KinkyDungeonTexturePolicyHandle =
    installKinkyDungeonTexturePolicy(
      {
        ...(options.upstreamVersion === undefined
          ? {}
          : { upstreamVersion: options.upstreamVersion }),
        ...(options.upstreamBundleSha256 === undefined
          ? {}
          : { upstreamBundleSha256: options.upstreamBundleSha256 }),
        ...(options.textureMode === undefined
          ? {}
          : { textureMode: options.textureMode }),
        ...(options.textureSampleIntervalMs === undefined
          ? {}
          : { textureSampleIntervalMs: options.textureSampleIntervalMs }),
        ...(options.now === undefined ? {} : { now: options.now })
      },
      target
    );
  const framePacing: KinkyDungeonFramePacingHandle =
    installKinkyDungeonFramePacing(
      {
        ...(options.upstreamVersion === undefined
          ? {}
          : { upstreamVersion: options.upstreamVersion }),
        ...(options.upstreamBundleSha256 === undefined
          ? {}
          : { upstreamBundleSha256: options.upstreamBundleSha256 }),
        mode: options.framePacingMode ?? "off",
        ...(options.now === undefined ? {} : { now: options.now })
      },
      target
    );
  const previousApi = target.KDHybridRendering;
  let disposed = false;

  const handle: KinkyDungeonRenderingHandle = Object.freeze({
    status: () =>
      Object.freeze({
        tier,
        ...textures.status(),
        framePacing: framePacing.status()
      }),
    sampleTextureMemory: () => textures.sampleTextureMemory(),
    setTier: (nextTier: QualityTier) => {
      tier = nextTier;
    },
    setFramePacingMode: (mode: KinkyDungeonFramePacingMode) => {
      framePacing.setMode(mode);
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      framePacing.dispose();
      textures.dispose();
      if (target.KDHybridRendering === handle) {
        if (previousApi === undefined) {
          delete target.KDHybridRendering;
        } else {
          target.KDHybridRendering = previousApi;
        }
      }
    }
  });
  target.KDHybridRendering = handle;
  return handle;
}
