const DEFAULT_POLL_INTERVAL_MS = 50;

declare const CurrentLoading: unknown;
declare const KDLoadingDone: unknown;
declare const KDLoadingFinished: unknown;
declare const KDLoadingMax: unknown;
declare const KDMapData:
  | {
      readonly GridWidth?: unknown;
      readonly GridHeight?: unknown;
    }
  | null
  | undefined;
declare const KinkyDungeonPlayerEntity: unknown;
declare const KinkyDungeonState: unknown;

export interface KinkyDungeonStartupObservation {
  readonly documentReady: DocumentReadyState | null;
  readonly hasRenderer: boolean;
  readonly gameState: string | null;
  readonly loadingDone: number | null;
  readonly loadingFinished: boolean | null;
  readonly loadingMax: number | null;
  readonly currentLoading: string | null;
  readonly mapWidth: number | null;
  readonly mapHeight: number | null;
  readonly hasPlayer: boolean;
}

export interface KinkyDungeonStartupStatus
  extends KinkyDungeonStartupObservation {
  readonly navigationStartEpochMs: number;
  readonly bootstrapInstalledAtMs: number;
  readonly documentInteractiveAtMs: number | null;
  readonly windowLoadedAtMs: number | null;
  readonly rendererReadyAtMs: number | null;
  readonly assetsReadyAtMs: number | null;
  readonly firstInteractiveAtMs: number | null;
  readonly introReadyAtMs: number | null;
  readonly menuReadyAtMs: number | null;
  readonly firstRoomReadyAtMs: number | null;
  readonly lastObservedAtMs: number;
}

export interface KinkyDungeonStartupHandle {
  status(): KinkyDungeonStartupStatus;
  dispose(): void;
}

export interface KinkyDungeonStartupOptions {
  readonly now?: () => number;
  readonly navigationStartEpochMs?: number;
  readonly read?: () => KinkyDungeonStartupObservation;
  readonly pollIntervalMs?: number;
  readonly schedule?: (callback: () => void, intervalMs: number) => unknown;
  readonly cancel?: (handle: unknown) => void;
}

interface StartupTarget {
  KDHybridStartup?: KinkyDungeonStartupHandle;
  PIXIapp?: {
    readonly renderer?: unknown;
  };
}

interface MutableStartupStatus extends KinkyDungeonStartupObservation {
  navigationStartEpochMs: number;
  bootstrapInstalledAtMs: number;
  documentInteractiveAtMs: number | null;
  windowLoadedAtMs: number | null;
  rendererReadyAtMs: number | null;
  assetsReadyAtMs: number | null;
  firstInteractiveAtMs: number | null;
  introReadyAtMs: number | null;
  menuReadyAtMs: number | null;
  firstRoomReadyAtMs: number | null;
  lastObservedAtMs: number;
}

export function installKinkyDungeonStartup(
  options: KinkyDungeonStartupOptions = {},
  target: StartupTarget = globalThis as StartupTarget
): KinkyDungeonStartupHandle {
  const now = options.now ?? (() => performance.now());
  const read =
    options.read ?? (() => readKinkyDungeonStartupObservation(target));
  const schedule =
    options.schedule ??
    ((callback: () => void, intervalMs: number) =>
      setInterval(callback, intervalMs));
  const cancel =
    options.cancel ??
    ((handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>));
  const installedAt = now();
  const initial = read();
  const state: MutableStartupStatus = {
    ...initial,
    navigationStartEpochMs:
      options.navigationStartEpochMs ?? performance.timeOrigin,
    bootstrapInstalledAtMs: installedAt,
    documentInteractiveAtMs: null,
    windowLoadedAtMs: null,
    rendererReadyAtMs: null,
    assetsReadyAtMs: null,
    firstInteractiveAtMs: null,
    introReadyAtMs: null,
    menuReadyAtMs: null,
    firstRoomReadyAtMs: null,
    lastObservedAtMs: installedAt
  };
  const previousApi = target.KDHybridStartup;
  let timer: unknown = null;
  let disposed = false;

  const poll = (): void => {
    if (disposed) {
      return;
    }
    const observedAt = now();
    const observation = read();
    Object.assign(state, observation);
    state.lastObservedAtMs = observedAt;

    if (
      state.documentInteractiveAtMs === null &&
      (observation.documentReady === "interactive" ||
        observation.documentReady === "complete")
    ) {
      state.documentInteractiveAtMs = observedAt;
    }
    if (
      state.windowLoadedAtMs === null &&
      observation.documentReady === "complete"
    ) {
      state.windowLoadedAtMs = observedAt;
    }
    if (state.rendererReadyAtMs === null && observation.hasRenderer) {
      state.rendererReadyAtMs = observedAt;
    }

    const assetsReady =
      observation.loadingFinished === true &&
      observation.loadingDone !== null &&
      observation.loadingMax !== null &&
      observation.loadingMax > 0 &&
      observation.loadingDone >= observation.loadingMax;
    if (state.assetsReadyAtMs === null && assetsReady) {
      state.assetsReadyAtMs = observedAt;
    }

    const interactiveReady =
      assetsReady &&
      observation.hasRenderer &&
      observation.gameState !== null &&
      ["Intro", "Menu", "Game"].includes(observation.gameState);
    if (state.firstInteractiveAtMs === null && interactiveReady) {
      state.firstInteractiveAtMs = observedAt;
    }
    if (
      state.introReadyAtMs === null &&
      interactiveReady &&
      observation.gameState === "Intro"
    ) {
      state.introReadyAtMs = observedAt;
    }
    if (
      state.menuReadyAtMs === null &&
      interactiveReady &&
      observation.gameState === "Menu"
    ) {
      state.menuReadyAtMs = observedAt;
    }

    const roomReady =
      interactiveReady &&
      observation.gameState === "Game" &&
      observation.hasPlayer &&
      observation.mapWidth !== null &&
      observation.mapWidth > 0 &&
      observation.mapHeight !== null &&
      observation.mapHeight > 0;
    if (state.firstRoomReadyAtMs === null && roomReady) {
      state.firstRoomReadyAtMs = observedAt;
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
    }
  };

  const handle: KinkyDungeonStartupHandle = Object.freeze({
    status: () => Object.freeze({ ...state }),
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
      if (target.KDHybridStartup === handle) {
        if (previousApi === undefined) {
          delete target.KDHybridStartup;
        } else {
          target.KDHybridStartup = previousApi;
        }
      }
    }
  });
  target.KDHybridStartup = handle;
  poll();
  if (state.firstRoomReadyAtMs === null) {
    timer = schedule(
      poll,
      Math.max(10, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
    );
  }
  return handle;
}

function readKinkyDungeonStartupObservation(
  target: StartupTarget
): KinkyDungeonStartupObservation {
  return {
    documentReady:
      typeof document === "undefined" ? null : document.readyState,
    hasRenderer: target.PIXIapp?.renderer !== undefined,
    gameState: safelyRead(
      () =>
        typeof KinkyDungeonState === "string" ? KinkyDungeonState : null,
      null
    ),
    loadingDone: safelyRead(
      () =>
        finiteNumber(
          typeof KDLoadingDone === "undefined" ? null : KDLoadingDone
        ),
      null
    ),
    loadingFinished: safelyRead(
      () =>
        typeof KDLoadingFinished === "boolean" ? KDLoadingFinished : null,
      null
    ),
    loadingMax: safelyRead(
      () =>
        finiteNumber(
          typeof KDLoadingMax === "undefined" ? null : KDLoadingMax
        ),
      null
    ),
    currentLoading: safelyRead(
      () => (typeof CurrentLoading === "string" ? CurrentLoading : null),
      null
    ),
    mapWidth: safelyRead(
      () =>
        finiteNumber(
          typeof KDMapData === "undefined" ? null : KDMapData?.GridWidth
        ),
      null
    ),
    mapHeight: safelyRead(
      () =>
        finiteNumber(
          typeof KDMapData === "undefined" ? null : KDMapData?.GridHeight
        ),
      null
    ),
    hasPlayer: safelyRead(
      () =>
        typeof KinkyDungeonPlayerEntity !== "undefined" &&
        KinkyDungeonPlayerEntity !== null,
      false
    ),
  };
}

function safelyRead<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

declare global {
  // Early-bootstrap page-relative startup and readiness milestones.
  // eslint-disable-next-line no-var
  var KDHybridStartup: KinkyDungeonStartupHandle | undefined;
}
