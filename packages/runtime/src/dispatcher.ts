import {
  matchFunctionSignature,
  type SignatureCandidate
} from "./signatures.js";
import type {
  HookCallback,
  HookContext,
  HookPhase,
  HookRegistration,
  SystemName,
  SystemStatus
} from "./types.js";

type AnyFunction = (...args: unknown[]) => unknown;

const NATIVE_FALLBACK = Symbol("kd-hybrid-native-fallback");

export interface NativeFallbackRequest {
  readonly [NATIVE_FALLBACK]: true;
}

/**
 * Requests the captured upstream JavaScript implementation for this call only.
 *
 * Native adapters use this for argument combinations they cannot reproduce
 * exactly. It does not trip or disable the native system for later calls.
 */
export function useJavaScriptFallback(): NativeFallbackRequest {
  return Object.freeze({ [NATIVE_FALLBACK]: true as const });
}

export function isNativeFallbackRequest(
  value: unknown
): value is NativeFallbackRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    NATIVE_FALLBACK in value &&
    (value as NativeFallbackRequest)[NATIVE_FALLBACK] === true
  );
}

interface MutableStatus {
  system: SystemName;
  globalName: string;
  mode: "native" | "js-fallback" | "disabled";
  signature: string | null;
  calls: number;
  nativeCalls: number;
  fallbackCalls: number;
  failures: number;
  reason: string | null;
}

interface SystemEntry {
  readonly system: SystemName;
  readonly globalName: string;
  readonly candidates: readonly SignatureCandidate[];
  readonly native: AnyFunction;
  official: AnyFunction;
  facade: AnyFunction;
  replacement: AnyFunction | null;
  signatureVerified: boolean;
  status: MutableStatus;
}

export interface RegisterSystemOptions {
  readonly system: SystemName;
  readonly globalName: string;
  readonly candidates: readonly SignatureCandidate[];
  readonly native: AnyFunction;
}

export class LegacySystemDispatcher {
  readonly #target: Record<string, unknown>;
  readonly #entries = new Map<SystemName, SystemEntry[]>();
  readonly #hooks = new Map<string, HookRegistration>();
  #nextHookId = 1;

  constructor(target: Record<string, unknown> = globalThis as Record<string, unknown>) {
    this.#target = target;
  }

  registerSystem(options: RegisterSystemOptions): SystemStatus {
    const current = this.#target[options.globalName];
    if (typeof current !== "function") {
      const status: MutableStatus = {
        system: options.system,
        globalName: options.globalName,
        mode: "js-fallback",
        signature: null,
        calls: 0,
        nativeCalls: 0,
        fallbackCalls: 0,
        failures: 0,
        reason: "missing-upstream-global"
      };
      return freezeStatus(status);
    }

    const official = current as AnyFunction;
    const match = matchFunctionSignature(
      official as (...args: never[]) => unknown,
      options.candidates
    );
    const status: MutableStatus = {
      system: options.system,
      globalName: options.globalName,
      mode: match.matched ? "native" : "js-fallback",
      signature: match.signature.normalizedHash,
      calls: 0,
      nativeCalls: 0,
      fallbackCalls: 0,
      failures: 0,
      reason: match.matched ? null : match.reason
    };
    const entry = {} as SystemEntry;
    const facade: AnyFunction = (...args: unknown[]) => this.#invoke(entry, args);
    Object.defineProperties(facade, {
      name: { value: options.globalName, configurable: true },
      __kdHybridFacade: { value: true }
    });
    Object.assign(entry, {
      system: options.system,
      globalName: options.globalName,
      candidates: options.candidates,
      native: options.native,
      official,
      facade,
      replacement: null,
      signatureVerified: match.matched,
      status
    } satisfies SystemEntry);

    const entries = this.#entries.get(options.system) ?? [];
    if (entries.some((existing) => existing.globalName === options.globalName)) {
      throw new Error(`KD Hybrid facade already registered for ${options.globalName}`);
    }
    entries.push(entry);
    this.#entries.set(options.system, entries);
    if (match.matched) {
      this.#target[options.globalName] = facade;
    }
    return freezeStatus(status);
  }

  reconcile(): readonly SystemStatus[] {
    for (const entries of this.#entries.values()) {
      for (const entry of entries) {
        const current = this.#target[entry.globalName];
        if (
          typeof current === "function" &&
          current !== entry.facade &&
          current !== entry.official
        ) {
          entry.replacement = current as AnyFunction;
          entry.status.mode = "js-fallback";
          entry.status.reason = "legacy-global-replaced";
        }
      }
    }
    return this.status();
  }

  dispatch(system: SystemName, ...args: unknown[]): unknown {
    const entries = this.#entries.get(system);
    if (entries === undefined || entries.length === 0) {
      throw new Error(`No KD Hybrid adapter registered for ${system}`);
    }
    // The primary facade represents the system-level SDK dispatch. Individual
    // upstream globals still route through their own facades.
    return this.#invoke(entries[0]!, args);
  }

  enable(system: SystemName): boolean {
    const entries = this.#entries.get(system);
    if (entries === undefined) {
      return false;
    }
    let enabled = false;
    for (const entry of entries) {
      if (
        entry.signatureVerified &&
        entry.replacement === null &&
        this.#target[entry.globalName] === entry.facade
      ) {
        entry.status.mode = "native";
        entry.status.reason = null;
        enabled = true;
      }
    }
    return enabled;
  }

  disable(system: SystemName, reason = "disabled-by-user"): boolean {
    const entries = this.#entries.get(system);
    if (entries === undefined) {
      return false;
    }
    for (const entry of entries) {
      entry.status.mode = "disabled";
      entry.status.reason = reason;
    }
    return true;
  }

  registerHook(
    system: SystemName,
    phase: HookPhase,
    callback: HookCallback,
    options: { id?: string; priority?: number } = {}
  ): string {
    const id = options.id ?? `kd-hybrid-hook-${this.#nextHookId++}`;
    if (this.#hooks.has(id)) {
      throw new Error(`Hook id ${id} is already registered`);
    }
    this.#hooks.set(id, {
      id,
      system,
      phase,
      priority: options.priority ?? 0,
      callback
    });
    return id;
  }

  unregisterHook(id: string): boolean {
    return this.#hooks.delete(id);
  }

  status(system?: SystemName): readonly SystemStatus[] {
    const entries =
      system === undefined
        ? [...this.#entries.values()].flat()
        : (this.#entries.get(system) ?? []);
    return entries.map((entry) => freezeStatus(entry.status));
  }

  restore(): void {
    for (const entries of this.#entries.values()) {
      for (const entry of entries) {
        if (this.#target[entry.globalName] === entry.facade) {
          this.#target[entry.globalName] = entry.official;
        }
      }
    }
  }

  #invoke(entry: SystemEntry, args: unknown[]): unknown {
    entry.status.calls += 1;
    const current = this.#target[entry.globalName];
    if (
      typeof current === "function" &&
      current !== entry.facade &&
      current !== entry.official
    ) {
      entry.replacement = current as AnyFunction;
      entry.status.mode = "js-fallback";
      entry.status.reason = "legacy-global-replaced";
    }
    const fallback = entry.replacement ?? entry.official;
    if (entry.status.mode !== "native") {
      entry.status.fallbackCalls += 1;
      return Reflect.apply(fallback, this.#target, args);
    }

    const context: HookContext = {
      system: entry.system,
      args: [...args],
      cancelled: false
    };
    try {
      this.#runHooks(entry.system, "before", context);
      if (context.cancelled) {
        entry.status.fallbackCalls += 1;
        context.result = Reflect.apply(fallback, this.#target, context.args);
      } else {
        const nativeResult = Reflect.apply(
          entry.native,
          this.#target,
          context.args
        );
        if (isNativeFallbackRequest(nativeResult)) {
          entry.status.fallbackCalls += 1;
          context.result = Reflect.apply(fallback, this.#target, context.args);
        } else {
          entry.status.nativeCalls += 1;
          context.result = nativeResult;
        }
      }
      this.#runHooks(entry.system, "after", context);
      return context.result;
    } catch (error) {
      context.error = error;
      entry.status.failures += 1;
      entry.status.mode = "js-fallback";
      entry.status.reason = "native-exception";
      this.#runHooks(entry.system, "error", context);
      // Native adapters must be transaction-like and cannot mutate JS state
      // until they have a validated result. Falling back is safe under that
      // contract.
      entry.status.fallbackCalls += 1;
      return Reflect.apply(fallback, this.#target, args);
    }
  }

  #runHooks(system: SystemName, phase: HookPhase, context: HookContext): void {
    const hooks = [...this.#hooks.values()]
      .filter((hook) => hook.system === system && hook.phase === phase)
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
    for (const hook of hooks) {
      hook.callback(context);
    }
  }
}

function freezeStatus(status: MutableStatus): SystemStatus {
  return Object.freeze({ ...status });
}
