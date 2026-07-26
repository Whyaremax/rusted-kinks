export type QualityTier = "high" | "balanced" | "performance";
export type QualityMode = QualityTier | "auto";

export interface QualityEnvironment {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
  readonly deviceMemoryGiB?: number;
}

export interface QualityOptions {
  readonly targetP99Ms: number;
  readonly memoryLimitBytes: number;
  readonly windowMs: number;
  readonly badWindowsBeforeDegrade: number;
  readonly stableMsBeforeUpgrade: number;
  readonly cooldownMs: number;
}

export interface QualityStatus {
  readonly mode: QualityMode;
  readonly tier: QualityTier;
  readonly p99Ms: number | null;
  readonly ewmaP99Ms: number | null;
  readonly rendererMemoryBytes: number | null;
  readonly badWindows: number;
  readonly stableForMs: number;
  readonly lastChangeReason: string;
}

const DEFAULTS: QualityOptions = {
  targetP99Ms: 8.33,
  memoryLimitBytes: 900 * 1024 * 1024,
  windowMs: 5_000,
  badWindowsBeforeDegrade: 3,
  stableMsBeforeUpgrade: 60_000,
  cooldownMs: 30_000
};

const TIERS: readonly QualityTier[] = ["high", "balanced", "performance"];

export class AdaptiveQualityController {
  readonly #options: QualityOptions;
  readonly #listeners = new Set<(status: QualityStatus) => void>();
  #mode: QualityMode;
  #tier: QualityTier;
  #samples: number[] = [];
  #windowStart: number | null = null;
  #windowMemory: number | null = null;
  #p99: number | null = null;
  #ewma: number | null = null;
  #badWindows = 0;
  #stableSince: number | null = null;
  #lastChangeAt = Number.NEGATIVE_INFINITY;
  #lastNow = 0;
  #lastChangeReason = "initial-selection";

  constructor(
    environment: QualityEnvironment,
    mode: QualityMode = "auto",
    options: Partial<QualityOptions> = {}
  ) {
    this.#options = { ...DEFAULTS, ...options };
    this.#mode = mode;
    this.#tier = mode === "auto" ? selectInitialTier(environment) : mode;
  }

  recordFrame(frameTimeMs: number, nowMs: number, rendererMemoryBytes?: number): void {
    if (!Number.isFinite(frameTimeMs) || frameTimeMs <= 0) {
      return;
    }
    this.#lastNow = nowMs;
    this.#windowStart ??= nowMs;
    this.#samples.push(frameTimeMs);
    if (rendererMemoryBytes !== undefined && Number.isFinite(rendererMemoryBytes)) {
      this.#windowMemory = Math.max(this.#windowMemory ?? 0, rendererMemoryBytes);
    }
    if (nowMs - this.#windowStart >= this.#options.windowMs) {
      this.#finishWindow(nowMs);
    }
  }

  setMode(mode: QualityMode, nowMs = this.#lastNow): void {
    this.#mode = mode;
    if (mode !== "auto") {
      this.#setTier(mode, "manual-override", nowMs);
    } else {
      this.#badWindows = 0;
      this.#stableSince = nowMs;
      this.#lastChangeReason = "automatic-mode";
      this.#emit();
    }
  }

  onChange(listener: (status: QualityStatus) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  status(nowMs = this.#lastNow): QualityStatus {
    return Object.freeze({
      mode: this.#mode,
      tier: this.#tier,
      p99Ms: this.#p99,
      ewmaP99Ms: this.#ewma,
      rendererMemoryBytes: this.#windowMemory,
      badWindows: this.#badWindows,
      stableForMs:
        this.#stableSince === null ? 0 : Math.max(0, nowMs - this.#stableSince),
      lastChangeReason: this.#lastChangeReason
    });
  }

  #finishWindow(nowMs: number): void {
    if (this.#samples.length === 0) {
      this.#windowStart = nowMs;
      return;
    }
    const sorted = [...this.#samples].sort((left, right) => left - right);
    const index = Math.max(0, Math.ceil(sorted.length * 0.99) - 1);
    this.#p99 = sorted[index] ?? null;
    this.#ewma =
      this.#ewma === null || this.#p99 === null
        ? this.#p99
        : this.#ewma * 0.75 + this.#p99 * 0.25;

    const overFrameBudget =
      this.#p99 !== null && this.#p99 > this.#options.targetP99Ms * 1.05;
    const overMemory =
      this.#windowMemory !== null &&
      this.#windowMemory > this.#options.memoryLimitBytes;
    const bad = overFrameBudget || overMemory;

    if (this.#mode === "auto") {
      if (bad) {
        this.#badWindows += 1;
        this.#stableSince = null;
        if (
          this.#badWindows >= this.#options.badWindowsBeforeDegrade &&
          nowMs - this.#lastChangeAt >= this.#options.cooldownMs
        ) {
          this.#changeBy(1, overMemory ? "memory-pressure" : "frame-pressure", nowMs);
          this.#badWindows = 0;
        }
      } else {
        this.#badWindows = 0;
        this.#stableSince ??= nowMs;
        if (
          nowMs - this.#stableSince >= this.#options.stableMsBeforeUpgrade &&
          nowMs - this.#lastChangeAt >= this.#options.cooldownMs
        ) {
          this.#changeBy(-1, "sustained-headroom", nowMs);
          this.#stableSince = nowMs;
        }
      }
    }

    this.#samples = [];
    this.#windowStart = nowMs;
    this.#windowMemory = null;
    this.#emit();
  }

  #changeBy(offset: number, reason: string, nowMs: number): void {
    const current = TIERS.indexOf(this.#tier);
    const next = Math.max(0, Math.min(TIERS.length - 1, current + offset));
    const tier = TIERS[next];
    if (tier !== undefined && tier !== this.#tier) {
      this.#setTier(tier, reason, nowMs);
    }
  }

  #setTier(tier: QualityTier, reason: string, nowMs: number): void {
    const changed = tier !== this.#tier;
    this.#tier = tier;
    this.#lastChangeReason = reason;
    if (changed) {
      this.#lastChangeAt = nowMs;
      this.#emit();
    }
  }

  #emit(): void {
    const status = this.status();
    for (const listener of this.#listeners) {
      listener(status);
    }
  }
}

export function selectInitialTier(environment: QualityEnvironment): QualityTier {
  const physicalPixels =
    environment.width * environment.height * environment.devicePixelRatio ** 2;
  const memory = environment.deviceMemoryGiB ?? 8;
  if (memory <= 4 || physicalPixels >= 18_000_000) {
    return "performance";
  }
  if (memory <= 8 || physicalPixels >= 9_000_000) {
    return "balanced";
  }
  return "high";
}

export function currentQualityEnvironment(): QualityEnvironment {
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  const result: QualityEnvironment = {
    width: window.screen?.width ?? window.innerWidth,
    height: window.screen?.height ?? window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1
  };
  return navigatorWithMemory.deviceMemory === undefined
    ? result
    : { ...result, deviceMemoryGiB: navigatorWithMemory.deviceMemory };
}
