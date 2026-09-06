// SPDX-License-Identifier: MIT
// Caps existing Pixi tickers; never skips/replays gameplay calls or changes time.
export type LowPowerMode = "off" | "cool" | "economy";
export interface PowerTicker { maxFPS: number; minFPS: number }
export interface LowPowerEnvironment {
  gameVersion: string;
  pixiVersion: string;
  tickers(): readonly PowerTicker[];
  visible(): boolean;
  focused(): boolean;
}
interface OwnedTicker { ticker: PowerTicker; original: number; applied: number; yielded: boolean }
export function createLowPowerController(environment: LowPowerEnvironment) {
  const compatible = environment.gameVersion === "5.4.92" && environment.pixiVersion === "7.2.1";
  let mode: LowPowerMode = "off";
  let owned: OwnedTicker[] = [];
  let reason = compatible ? "ready" : "unsupported-game-or-pixi";
  let disposed = false;
  function restore() {
    for (const record of owned) {
      try {
        if (!record.yielded && record.ticker.maxFPS === record.applied) record.ticker.maxFPS = record.original;
      } catch { reason = "ticker-restore-failed"; }
    }
    owned = [];
  }
  function apply() {
    if (disposed || mode === "off" || !compatible) return;
    const current = [...new Set(environment.tickers())];
    if (!current.length || current.some(t => !Number.isFinite(t.maxFPS) || t.maxFPS < 0 || !Number.isFinite(t.minFPS) || t.minFPS < 0)) {
      restore(); reason = "unsupported-ticker"; return;
    }
    if (owned.length && (current.length !== owned.length || owned.some(r => !current.includes(r.ticker)))) {
      restore(); mode = "off"; reason = "ticker-replaced"; return;
    }
    if (!owned.length) owned = current.map(ticker => ({ticker, original: ticker.maxFPS, applied: ticker.maxFPS, yielded: false}));
    const desired = !environment.visible() || !environment.focused() ? 10 : mode === "economy" ? 20 : 30;
    for (const record of owned) {
      if (record.yielded) continue;
      if (record.ticker.maxFPS !== record.applied) { record.yielded = true; reason = "external-fps-change"; continue; }
      // Respect an existing lower ceiling and Pixi's minFPS contract. Never
      // change minFPS, speed, elapsed time, the listener list, or ticker owners.
      const maximum = record.original > 0 ? Math.min(record.original, desired) : desired;
      const fps = Math.max(record.ticker.minFPS, maximum);
      if (record.applied !== fps) { record.ticker.maxFPS = fps; record.applied = record.ticker.maxFPS; }
    }
  }
  function sync() {
    try { apply(); } catch { restore(); mode = "off"; reason = "ticker-access-failed"; }
  }
  return Object.freeze({
    sync,
    setMode(next: LowPowerMode) {
      if (disposed) return;
      if (!["off", "cool", "economy"].includes(next)) throw new Error("Unknown low-power mode");
      if (next === "off") restore();
      mode = next;
      sync();
    },
    status() { return {mode, compatible, reason, disposed, tickers: owned.map(r => ({original: r.original, current: r.ticker.maxFPS, yielded: r.yielded}))}; },
    dispose() { if (!disposed) { restore(); mode = "off"; disposed = true; } },
  });
}
