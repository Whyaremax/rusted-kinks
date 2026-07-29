import { KNOWN_UPSTREAM } from "@kd-hybrid/runtime";

const SUPPORTED_PIXI_VERSION = "7.2.1";
const DEFAULT_INSTALL_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 25;
const DEFAULT_ACTIVE_WINDOW_MS = 1_000;
const DEFAULT_IDLE_INTERVAL_MS = 1_000 / 60;
const DEFAULT_BACKGROUND_INTERVAL_MS = 1_000 / 30;
const DEFAULT_HIDDEN_INTERVAL_MS = 100;

type UnknownRecord = Record<string, unknown>;
type RenderFunction = (displayObject: unknown, ...args: unknown[]) => unknown;

export type KinkyDungeonFramePacingMode = "off" | "adaptive";
export type KinkyDungeonFramePacingProfile =
  | "off"
  | "active"
  | "idle"
  | "background"
  | "hidden";

export interface KinkyDungeonFramePacingStatus {
  readonly mode: KinkyDungeonFramePacingMode;
  readonly currentProfile: KinkyDungeonFramePacingProfile;
  readonly compatible: boolean;
  readonly compatibilityReason: string;
  readonly installed: boolean;
  readonly rendererReplaced: boolean;
  readonly stageCalls: number;
  readonly renderedStageCalls: number;
  readonly skippedStageCalls: number;
  readonly bypassedStageCalls: number;
  readonly otherRenderCalls: number;
  readonly currentIntervalMs: number;
  readonly currentRateCeilingFps: number | null;
  readonly lastActivityAtMs: number | null;
  readonly lastRenderAtMs: number | null;
  readonly nextRenderAtMs: number | null;
  readonly lastError: string | null;
}

export interface KinkyDungeonFramePacingOptions {
  readonly upstreamVersion?: string;
  readonly upstreamBundleSha256?: string;
  readonly mode?: KinkyDungeonFramePacingMode;
  readonly activeWindowMs?: number;
  readonly idleIntervalMs?: number;
  readonly backgroundIntervalMs?: number;
  readonly hiddenIntervalMs?: number;
  readonly installTimeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly now?: () => number;
  readonly isVisible?: () => boolean;
  readonly hasFocus?: () => boolean;
  readonly scheduleTimeout?: (callback: () => void, delayMs: number) => unknown;
  readonly cancelTimeout?: (handle: unknown) => void;
}

export interface KinkyDungeonFramePacingHandle {
  status(): KinkyDungeonFramePacingStatus;
  setMode(mode: KinkyDungeonFramePacingMode): void;
  notifyActivity(): void;
  dispose(): void;
}

interface FramePacingRenderer extends UnknownRecord {
  render?: unknown;
}

interface FramePacingApplication extends UnknownRecord {
  renderer?: FramePacingRenderer;
  stage?: unknown;
}

interface FramePacingRuntimeControl {
  disableGpuFramePacing?: boolean;
}

interface FramePacingTarget extends UnknownRecord {
  PIXI?: unknown;
  PIXIapp?: FramePacingApplication;
  KDHybridFramePacing?: KinkyDungeonFramePacingHandle;
  KDHybridRuntimeControl?: FramePacingRuntimeControl;
  addEventListener?: (
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions | boolean
  ) => void;
  removeEventListener?: (
    type: string,
    listener: EventListener,
    options?: EventListenerOptions | boolean
  ) => void;
}

interface MutableFramePacingStatus {
  mode: KinkyDungeonFramePacingMode;
  currentProfile: KinkyDungeonFramePacingProfile;
  compatible: boolean;
  compatibilityReason: string;
  installed: boolean;
  stageCalls: number;
  renderedStageCalls: number;
  skippedStageCalls: number;
  bypassedStageCalls: number;
  otherRenderCalls: number;
  currentIntervalMs: number;
  lastActivityAtMs: number | null;
  lastRenderAtMs: number | null;
  nextRenderAtMs: number | null;
  lastError: string | null;
}

interface FramePacingDecision {
  readonly profile: Exclude<KinkyDungeonFramePacingProfile, "off">;
  readonly intervalMs: number;
}

const ACTIVITY_EVENTS = Object.freeze([
  "keydown",
  "pointerdown",
  "pointermove",
  "touchstart",
  "wheel",
  "focus"
]);

export function installKinkyDungeonFramePacing(
  options: KinkyDungeonFramePacingOptions,
  target: FramePacingTarget = globalThis as FramePacingTarget
): KinkyDungeonFramePacingHandle {
  const now = options.now ?? (() => performance.now());
  const isVisible =
    options.isVisible ??
    (() => typeof document === "undefined" || document.visibilityState !== "hidden");
  const hasFocus =
    options.hasFocus ??
    (() => typeof document === "undefined" || document.hasFocus());
  const scheduleTimeout =
    options.scheduleTimeout ??
    ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs));
  const cancelTimeout =
    options.cancelTimeout ??
    ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const mode = options.mode ?? "off";
  const activeWindowMs = finiteNonNegative(
    options.activeWindowMs,
    DEFAULT_ACTIVE_WINDOW_MS
  );
  const idleIntervalMs = finitePositive(
    options.idleIntervalMs,
    DEFAULT_IDLE_INTERVAL_MS
  );
  const backgroundIntervalMs = finitePositive(
    options.backgroundIntervalMs,
    DEFAULT_BACKGROUND_INTERVAL_MS
  );
  const hiddenIntervalMs = finitePositive(
    options.hiddenIntervalMs,
    DEFAULT_HIDDEN_INTERVAL_MS
  );
  const installTimeoutMs = finitePositive(
    options.installTimeoutMs,
    DEFAULT_INSTALL_TIMEOUT_MS
  );
  const pollIntervalMs = finitePositive(
    options.pollIntervalMs,
    DEFAULT_POLL_INTERVAL_MS
  );
  const installedAt = safelyNow(now);
  const deadline = installedAt + installTimeoutMs;
  const compatibility = compatibilityStatus(options, target);
  const state: MutableFramePacingStatus = {
    mode,
    currentProfile: "off",
    compatible: compatibility.compatible,
    compatibilityReason: compatibility.reason,
    installed: false,
    stageCalls: 0,
    renderedStageCalls: 0,
    skippedStageCalls: 0,
    bypassedStageCalls: 0,
    otherRenderCalls: 0,
    currentIntervalMs: 0,
    lastActivityAtMs: installedAt,
    lastRenderAtMs: null,
    nextRenderAtMs: null,
    lastError: null
  };
  const previousApi = target.KDHybridFramePacing;
  let timer: unknown = null;
  let disposed = false;
  let renderer: FramePacingRenderer | null = null;
  let stage: unknown;
  let wrapper: RenderFunction | null = null;
  let originalRender: RenderFunction | null = null;
  let originalOwnDescriptor: PropertyDescriptor | undefined;
  let listenersInstalled = false;

  const notifyActivity = (): void => {
    state.lastActivityAtMs = safelyNow(now);
  };
  const activityListener: EventListener = () => notifyActivity();

  const removeListeners = (): void => {
    if (!listenersInstalled || typeof target.removeEventListener !== "function") {
      return;
    }
    listenersInstalled = false;
    for (const event of ACTIVITY_EVENTS) {
      target.removeEventListener(event, activityListener, true);
    }
  };

  const restoreRenderer = (): void => {
    if (renderer === null || wrapper === null || renderer.render !== wrapper) {
      return;
    }
    try {
      if (originalOwnDescriptor === undefined) {
        delete renderer.render;
      } else {
        Object.defineProperty(renderer, "render", originalOwnDescriptor);
      }
    } catch (error) {
      state.lastError = `restore:${errorMessage(error)}`;
    }
  };

  const currentDecision = (sampledAt: number): FramePacingDecision => {
    if (!isVisible()) {
      return {
        profile: "hidden",
        intervalMs: hiddenIntervalMs
      };
    }
    if (!hasFocus()) {
      return {
        profile: "background",
        intervalMs: backgroundIntervalMs
      };
    }
    const lastActivity = state.lastActivityAtMs;
    if (
      activeWindowMs > 0 &&
      lastActivity !== null &&
      sampledAt - lastActivity < activeWindowMs
    ) {
      return {
        profile: "active",
        intervalMs: 0
      };
    }
    return {
      profile: "idle",
      intervalMs: idleIntervalMs
    };
  };

  const install = (): boolean => {
    const application = target.PIXIapp;
    const candidateRenderer = application?.renderer;
    const candidateStage = application?.stage;
    const candidateRender = candidateRenderer?.render;
    if (
      candidateRenderer === undefined ||
      candidateStage === undefined ||
      typeof candidateRender !== "function"
    ) {
      return false;
    }

    renderer = candidateRenderer;
    stage = candidateStage;
    originalRender = candidateRender as RenderFunction;
    originalOwnDescriptor = Object.getOwnPropertyDescriptor(
      candidateRenderer,
      "render"
    );
    const pacedRender: RenderFunction = function KDHybridFramePacedRender(
      this: unknown,
      displayObject: unknown,
      ...args: unknown[]
    ): unknown {
      const original = originalRender;
      if (original === null) {
        return undefined;
      }
      if (displayObject !== stage) {
        state.otherRenderCalls += 1;
        return Reflect.apply(original, this, [displayObject, ...args]);
      }

      state.stageCalls += 1;
      if (
        state.mode === "off" ||
        target.KDHybridRuntimeControl?.disableGpuFramePacing === true
      ) {
        const sampledAt = safelyNow(now);
        const result = Reflect.apply(original, this, [displayObject, ...args]);
        state.currentProfile = "off";
        state.currentIntervalMs = 0;
        state.nextRenderAtMs = null;
        state.lastRenderAtMs = sampledAt;
        state.bypassedStageCalls += 1;
        return result;
      }

      let sampledAt: number;
      let decision: FramePacingDecision;
      try {
        sampledAt = now();
        decision = currentDecision(sampledAt);
      } catch (error) {
        state.lastError = `decision:${errorMessage(error)}`;
        const fallbackSampledAt = safelyNow(now);
        const result = Reflect.apply(original, this, [displayObject, ...args]);
        state.currentProfile = "off";
        state.currentIntervalMs = 0;
        state.nextRenderAtMs = null;
        state.lastRenderAtMs = fallbackSampledAt;
        state.bypassedStageCalls += 1;
        return result;
      }
      if (state.currentProfile !== decision.profile) {
        state.currentProfile = decision.profile;
        state.nextRenderAtMs = null;
      }
      const interval = decision.intervalMs;
      state.currentIntervalMs = interval;
      if (
        interval > 0 &&
        state.nextRenderAtMs !== null &&
        sampledAt < state.nextRenderAtMs
      ) {
        state.skippedStageCalls += 1;
        return undefined;
      }

      let nextRenderAtMs: number | null = null;
      if (interval > 0) {
        if (state.nextRenderAtMs === null) {
          nextRenderAtMs = sampledAt + interval;
        } else {
          const elapsedIntervals =
            Math.floor((sampledAt - state.nextRenderAtMs) / interval) + 1;
          nextRenderAtMs =
            state.nextRenderAtMs + elapsedIntervals * interval;
        }
      }
      const result = Reflect.apply(original, this, [displayObject, ...args]);
      state.lastRenderAtMs = sampledAt;
      state.nextRenderAtMs = nextRenderAtMs;
      state.renderedStageCalls += 1;
      return result;
    };
    wrapper = pacedRender;

    try {
      candidateRenderer.render = pacedRender;
    } catch (error) {
      renderer = null;
      stage = undefined;
      wrapper = null;
      originalRender = null;
      originalOwnDescriptor = undefined;
      state.lastError = `install:${errorMessage(error)}`;
      state.compatibilityReason = "renderer-render-not-writable";
      return true;
    }
    if (candidateRenderer.render !== pacedRender) {
      renderer = null;
      stage = undefined;
      wrapper = null;
      originalRender = null;
      originalOwnDescriptor = undefined;
      state.lastError = "install:renderer render assignment was rejected";
      state.compatibilityReason = "renderer-render-not-writable";
      return true;
    }

    state.installed = true;
    state.compatibilityReason = "exact-kd-bundle-pixi-match";
    if (typeof target.addEventListener === "function") {
      listenersInstalled = true;
      for (const event of ACTIVITY_EVENTS) {
        target.addEventListener(event, activityListener, {
          capture: true,
          passive: true
        });
      }
    }
    return true;
  };

  const poll = (): void => {
    timer = null;
    if (disposed || !state.compatible || state.mode === "off") {
      return;
    }
    if (install()) {
      return;
    }
    const sampledAt = safelyNow(now);
    if (sampledAt >= deadline) {
      state.lastError = "install:renderer-timeout";
      state.compatibilityReason = "renderer-timeout";
      return;
    }
    timer = scheduleTimeout(poll, pollIntervalMs);
  };

  const handle: KinkyDungeonFramePacingHandle = Object.freeze({
    status: () => {
      const interval = state.currentIntervalMs;
      return Object.freeze({
        ...state,
        rendererReplaced:
          state.installed &&
          renderer !== null &&
          wrapper !== null &&
          renderer.render !== wrapper,
        currentRateCeilingFps:
          interval <= 0 ? null : Math.round(1_000 / interval)
      });
    },
    setMode: (nextMode: KinkyDungeonFramePacingMode) => {
      state.mode = nextMode;
      notifyActivity();
      if (
        nextMode === "adaptive" &&
        state.compatible &&
        !state.installed &&
        timer === null
      ) {
        poll();
      }
    },
    notifyActivity,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      if (timer !== null) {
        cancelTimeout(timer);
        timer = null;
      }
      removeListeners();
      restoreRenderer();
      state.installed = false;
      if (target.KDHybridFramePacing === handle) {
        if (previousApi === undefined) {
          delete target.KDHybridFramePacing;
        } else {
          target.KDHybridFramePacing = previousApi;
        }
      }
    }
  });
  target.KDHybridFramePacing = handle;
  if (state.compatible && mode === "adaptive") {
    poll();
  }
  return handle;
}

function compatibilityStatus(
  options: KinkyDungeonFramePacingOptions,
  target: FramePacingTarget
): { readonly compatible: boolean; readonly reason: string } {
  if (options.upstreamVersion !== KNOWN_UPSTREAM.gameVersion) {
    return {
      compatible: false,
      reason: `unsupported-kd-version:${options.upstreamVersion ?? "unknown"}`
    };
  }
  const bundleSha256 = options.upstreamBundleSha256?.toLowerCase();
  if (bundleSha256 !== KNOWN_UPSTREAM.bundleSha256) {
    return {
      compatible: false,
      reason: `unsupported-kd-bundle:${bundleSha256 ?? "unknown"}`
    };
  }
  const pixi = record(target.PIXI);
  const pixiVersion =
    typeof pixi?.VERSION === "string" ? pixi.VERSION : "unknown";
  if (pixiVersion !== SUPPORTED_PIXI_VERSION) {
    return {
      compatible: false,
      reason: `unsupported-pixi-version:${pixiVersion}`
    };
  }
  return {
    compatible: true,
    reason: "waiting-for-renderer"
  };
}

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : null;
}

function finitePositive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function finiteNonNegative(
  value: number | undefined,
  fallback: number
): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function safelyNow(now: () => number): number {
  try {
    const value = now();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

declare global {
  // Early-bootstrap, exact-build-gated GPU pacing diagnostics and escape hatch.
  // eslint-disable-next-line no-var
  var KDHybridFramePacing: KinkyDungeonFramePacingHandle | undefined;
}
