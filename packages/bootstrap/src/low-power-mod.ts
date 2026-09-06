// SPDX-License-Identifier: MIT
import { createLowPowerController, type PowerTicker } from "./low-power.js";
declare const PIXI: { VERSION: string; Ticker: { shared: PowerTicker } };
declare const PIXIapp: { ticker: PowerTicker };
declare const TextGet: (key: string) => string;
declare const addTextKey: (key: string, value: string) => void;
declare const KDAddEvent: (map: unknown, event: string, id: string, callback: () => void) => void;
declare const KDEventMapGeneric: unknown;
declare const KDModConfigs: Record<string, unknown[]>;
declare const KDModSettings: Record<string, Record<string, unknown>>;
const id = "RustedKinksLowPower";
const root = globalThis as typeof globalThis & { RustedKinksLowPower?: ReturnType<typeof createLowPowerController> & { shutdown(): void } };
root.RustedKinksLowPower?.shutdown();
const controller = createLowPowerController({
  gameVersion: TextGet("KDVersionStr"), pixiVersion: PIXI.VERSION,
  tickers: () => [PIXI.Ticker.shared, PIXIapp.ticker],
  visible: () => document.visibilityState !== "hidden",
  focused: () => document.hasFocus(),
});
let timer: ReturnType<typeof setInterval> | undefined;
function refresh() {
  const settings = KDModSettings[id];
  controller.setMode(settings?.RKLowPowerEnabled === false ? "off" : settings?.RKLowPowerEconomy === true ? "economy" : "cool");
}
function register() {
  addTextKey("KDModButton" + id, "Rusted Kinks: Low Power");
  addTextKey("KDModButtonRKLowPowerEnabled", "Enable low power (30 FPS)");
  addTextKey("KDModButtonRKLowPowerEconomy", "Extra cooling (20 FPS)");
  KDModConfigs[id] = [
    {name: "Low power: 30 FPS; 10 FPS in background", type: "boolean", refvar: "RKLowPowerEnabled", default: true},
    {name: "Extra cooling: 20 FPS while playing", type: "boolean", refvar: "RKLowPowerEconomy", default: false},
  ];
  refresh();
}
const sync = () => controller.sync();
for (const event of ["focus", "blur", "visibilitychange"]) window.addEventListener(event, sync, true);
function shutdown() {
  if (timer !== undefined) clearInterval(timer);
  for (const event of ["focus", "blur", "visibilitychange"]) window.removeEventListener(event, sync, true);
  controller.dispose();
}
root.RustedKinksLowPower = Object.assign({}, controller, {shutdown});
KDAddEvent(KDEventMapGeneric, "afterModSettingsLoad", id, register);
// KD's settings UI can update values without another mod-load event.
let lastSettings = "";
timer = setInterval(() => {
  const settings = KDModSettings[id];
  const signature = JSON.stringify([settings?.RKLowPowerEnabled, settings?.RKLowPowerEconomy]);
  if (signature !== lastSettings) { lastSettings = signature; refresh(); }
  else controller.sync();
}, 1000);
register();
