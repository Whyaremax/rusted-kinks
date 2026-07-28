import {
  matchFunctionSignature,
  type SignatureCandidate,
} from "./signatures.js";
import type {
  HookCallback,
  HookContext,
  HookPhase,
  HookRegistration,
  SystemName,
  SystemStatus,
} from "./types.js";

type AnyFunction = (...args: unknown[]) => unknown;
type DirectOfficialArity = 19;

const NATIVE_FALLBACK = Symbol("kd-hybrid-native-fallback");
const COMPLETED_JAVASCRIPT_CALL = Symbol("kd-hybrid-completed-javascript-call");
const FUNCTION_CALL = Function.prototype.call;
const NATIVE_FALLBACK_REQUEST = Object.freeze({
  [NATIVE_FALLBACK]: true as const,
});

function copyArguments(args: IArguments): unknown[] {
  const copied = new Array<unknown>(args.length);
  for (let index = 0; index < args.length; index += 1) {
    copied[index] = args[index];
  }
  return copied;
}

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
  return NATIVE_FALLBACK_REQUEST;
}

export function isNativeFallbackRequest(
  value: unknown,
): value is NativeFallbackRequest {
  return value === NATIVE_FALLBACK_REQUEST;
}

export type CompletedJavaScriptCall =
  | {
      readonly [COMPLETED_JAVASCRIPT_CALL]: true;
      readonly ok: true;
      readonly value: unknown;
    }
  | {
      readonly [COMPLETED_JAVASCRIPT_CALL]: true;
      readonly ok: false;
      readonly error: unknown;
    };

/**
 * Runs a captured upstream function from an around-adapter.
 *
 * The marker tells the dispatcher that JavaScript already ran, so an upstream
 * exception must be rethrown instead of invoking the same function a second
 * time as a fallback.
 */
export function completeJavaScriptCall(
  callback: () => unknown,
): CompletedJavaScriptCall {
  try {
    return Object.freeze({
      [COMPLETED_JAVASCRIPT_CALL]: true as const,
      ok: true as const,
      value: callback(),
    });
  } catch (error) {
    return Object.freeze({
      [COMPLETED_JAVASCRIPT_CALL]: true as const,
      ok: false as const,
      error,
    });
  }
}

export function isCompletedJavaScriptCall(
  value: unknown,
): value is CompletedJavaScriptCall {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as CompletedJavaScriptCall)[COMPLETED_JAVASCRIPT_CALL] === true
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
  readonly directOfficialArity: DirectOfficialArity | null;
  directOfficial: AnyFunction | null;
  pendingDirectOfficialCalls: number;
  replacement: AnyFunction | null;
  signatureVerified: boolean;
  status: MutableStatus;
}

export interface RegisterSystemOptions {
  readonly system: SystemName;
  readonly globalName: string;
  readonly candidates: readonly SignatureCandidate[];
  readonly native: AnyFunction;
  readonly directOfficialArity?: DirectOfficialArity;
}

export class LegacySystemDispatcher {
  readonly #target: Record<string, unknown>;
  readonly #entries = new Map<SystemName, SystemEntry[]>();
  readonly #hooks = new Map<string, HookRegistration>();
  #nextHookId = 1;

  constructor(
    target: Record<string, unknown> = globalThis as Record<string, unknown>,
  ) {
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
        reason: "missing-upstream-global",
      };
      return freezeStatus(status);
    }

    const official = current as AnyFunction;
    const match = matchFunctionSignature(
      official as (...args: never[]) => unknown,
      options.candidates,
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
      reason: match.matched ? null : match.reason,
    };
    const entry = {} as SystemEntry;
    const facade = this.#createFacade(entry, options.directOfficialArity);
    Object.defineProperties(facade, {
      name: { value: options.globalName, configurable: true },
      __kdHybridFacade: { value: true },
    });
    Object.assign(entry, {
      system: options.system,
      globalName: options.globalName,
      candidates: options.candidates,
      native: options.native,
      official,
      facade,
      directOfficialArity: options.directOfficialArity ?? null,
      directOfficial: null,
      pendingDirectOfficialCalls: 0,
      replacement: null,
      signatureVerified: match.matched,
      status,
    } satisfies SystemEntry);

    const entries = this.#entries.get(options.system) ?? [];
    if (
      entries.some((existing) => existing.globalName === options.globalName)
    ) {
      throw new Error(
        `KD Hybrid facade already registered for ${options.globalName}`,
      );
    }
    entries.push(entry);
    this.#entries.set(options.system, entries);
    if (match.matched) {
      this.#target[options.globalName] = facade;
    }
    return freezeStatus(status);
  }

  #createFacade(
    entry: SystemEntry,
    directOfficialArity: DirectOfficialArity | undefined,
  ): AnyFunction {
    if (directOfficialArity === 19) {
      const dispatcher = this;
      return function directOfficialArity19Facade(
        arg0: unknown,
        arg1: unknown,
        arg2: unknown,
        arg3: unknown,
        arg4: unknown,
        arg5: unknown,
        arg6: unknown,
        arg7: unknown,
        arg8: unknown,
        arg9: unknown,
        arg10: unknown,
        arg11: unknown,
        arg12: unknown,
        arg13: unknown,
        arg14: unknown,
        arg15: unknown,
        arg16: unknown,
        arg17: unknown,
        arg18: unknown,
      ): unknown {
        const directOfficial = entry.directOfficial;
        if (
          directOfficial !== null &&
          dispatcher.#target[entry.globalName] === entry.facade
        ) {
          entry.pendingDirectOfficialCalls += 1;
          if (
            arguments.length <= 19 &&
            Function.prototype.call === FUNCTION_CALL
          ) {
            return directOfficial.call(
              dispatcher.#target,
              arg0,
              arg1,
              arg2,
              arg3,
              arg4,
              arg5,
              arg6,
              arg7,
              arg8,
              arg9,
              arg10,
              arg11,
              arg12,
              arg13,
              arg14,
              arg15,
              arg16,
              arg17,
              arg18,
            );
          }
          return Reflect.apply(
            directOfficial,
            dispatcher.#target,
            copyArguments(arguments),
          );
        }
        return dispatcher.#invoke(entry, copyArguments(arguments), true);
      };
    }

    return (...args: unknown[]) => {
      const directOfficial = entry.directOfficial;
      if (
        directOfficial !== null &&
        this.#target[entry.globalName] === entry.facade
      ) {
        entry.pendingDirectOfficialCalls += 1;
        return Reflect.apply(directOfficial, this.#target, args);
      }
      return this.#invoke(entry, args, true);
    };
  }

  reconcile(): readonly SystemStatus[] {
    for (const entries of this.#entries.values()) {
      for (const entry of entries) {
        flushDirectOfficialCalls(entry);
        const current = this.#target[entry.globalName];
        if (
          typeof current === "function" &&
          current !== entry.facade &&
          current !== entry.official
        ) {
          entry.directOfficial = null;
          entry.replacement = current as AnyFunction;
          entry.status.mode = "js-fallback";
          entry.status.reason = "legacy-global-replaced";
        } else if (current === entry.facade && entry.replacement !== null) {
          entry.replacement = null;
          if (
            entry.signatureVerified &&
            entry.status.reason === "legacy-global-replaced"
          ) {
            entry.status.mode = "native";
            entry.status.reason = null;
          }
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
    return this.#invoke(entries[0]!, args, false);
  }

  /**
   * Temporarily routes one verified facade straight to its captured official
   * JavaScript implementation.
   *
   * This is intentionally internal to trusted around-adapters. It preserves
   * the facade identity and fallback counters, and refuses the shortcut when a
   * legacy replacement, disabled system, or SDK hook needs the full dispatcher.
   */
  withDirectOfficial<T>(
    globalName: string,
    callback: () => T,
    recordActivation?: (active: boolean) => void,
  ): T {
    let entry: SystemEntry | undefined;
    for (const entries of this.#entries.values()) {
      entry = entries.find((candidate) => candidate.globalName === globalName);
      if (entry !== undefined) {
        break;
      }
    }
    const active =
      entry !== undefined &&
      entry.status.mode === "native" &&
      entry.replacement === null &&
      this.#target[globalName] === entry.facade &&
      ![...this.#hooks.values()].some((hook) => hook.system === entry!.system);
    recordActivation?.(active);
    if (!active || entry === undefined) {
      return callback();
    }

    const previous = entry.directOfficial;
    entry.directOfficial = entry.official;
    try {
      return callback();
    } finally {
      flushDirectOfficialCalls(entry);
      if (entry.directOfficial === entry.official) {
        entry.directOfficial = previous;
      }
    }
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
      flushDirectOfficialCalls(entry);
      entry.directOfficial = null;
      entry.status.mode = "disabled";
      entry.status.reason = reason;
    }
    return true;
  }

  registerHook(
    system: SystemName,
    phase: HookPhase,
    callback: HookCallback,
    options: { id?: string; priority?: number } = {},
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
      callback,
    });
    for (const entry of this.#entries.get(system) ?? []) {
      flushDirectOfficialCalls(entry);
      entry.directOfficial = null;
    }
    return id;
  }

  unregisterHook(id: string): boolean {
    return this.#hooks.delete(id);
  }

  hasHooks(system?: SystemName): boolean {
    if (system === undefined) {
      return this.#hooks.size > 0;
    }
    return [...this.#hooks.values()].some((hook) => hook.system === system);
  }

  status(system?: SystemName): readonly SystemStatus[] {
    const entries =
      system === undefined
        ? [...this.#entries.values()].flat()
        : (this.#entries.get(system) ?? []);
    return entries.map((entry) => {
      flushDirectOfficialCalls(entry);
      return freezeStatus(entry.status);
    });
  }

  restore(): void {
    for (const entries of this.#entries.values()) {
      for (const entry of entries) {
        flushDirectOfficialCalls(entry);
        entry.directOfficial = null;
        if (this.#target[entry.globalName] === entry.facade) {
          this.#target[entry.globalName] = entry.official;
        }
      }
    }
  }

  #invoke(
    entry: SystemEntry,
    args: unknown[],
    invokedThroughFacade: boolean,
  ): unknown {
    entry.status.calls += 1;
    const current = this.#target[entry.globalName];
    if (current !== entry.facade) {
      if (typeof current === "function" && current !== entry.official) {
        entry.directOfficial = null;
        entry.replacement = current as AnyFunction;
        entry.status.mode = "js-fallback";
        entry.status.reason = "legacy-global-replaced";
      }
    } else if (entry.replacement !== null) {
      entry.replacement = null;
      if (
        entry.signatureVerified &&
        entry.status.reason === "legacy-global-replaced"
      ) {
        entry.status.mode = "native";
        entry.status.reason = null;
      }
    }
    if (entry.status.mode !== "native") {
      entry.status.fallbackCalls += 1;
      return this.#invokeFallback(entry, args, invokedThroughFacade);
    }

    if (this.#hooks.size === 0) {
      try {
        const nativeResult = Reflect.apply(entry.native, this.#target, args);
        if (isNativeFallbackRequest(nativeResult)) {
          entry.status.fallbackCalls += 1;
          return this.#invokeFallback(entry, args, invokedThroughFacade);
        }
        if (isCompletedJavaScriptCall(nativeResult)) {
          entry.status.nativeCalls += 1;
          if (nativeResult.ok) {
            return nativeResult.value;
          }
          throw new CompletedJavaScriptCallError(nativeResult.error);
        }
        entry.status.nativeCalls += 1;
        return nativeResult;
      } catch (error) {
        if (error instanceof CompletedJavaScriptCallError) {
          entry.status.failures += 1;
          throw error.upstreamError;
        }
        entry.status.failures += 1;
        entry.status.mode = "js-fallback";
        entry.status.reason = nativeExceptionReason(error);
        entry.status.fallbackCalls += 1;
        return this.#invokeFallback(entry, args, invokedThroughFacade);
      }
    }

    const context: HookContext = {
      system: entry.system,
      globalName: entry.globalName,
      args: [...args],
      cancelled: false,
    };
    try {
      this.#runHooks(entry.system, "before", context);
      if (context.cancelled) {
        entry.status.fallbackCalls += 1;
        context.result = this.#invokeFallback(
          entry,
          context.args,
          invokedThroughFacade,
        );
      } else {
        const nativeResult = Reflect.apply(
          entry.native,
          this.#target,
          context.args,
        );
        if (isNativeFallbackRequest(nativeResult)) {
          entry.status.fallbackCalls += 1;
          context.result = this.#invokeFallback(
            entry,
            context.args,
            invokedThroughFacade,
          );
        } else if (isCompletedJavaScriptCall(nativeResult)) {
          entry.status.nativeCalls += 1;
          if (!nativeResult.ok) {
            throw new CompletedJavaScriptCallError(nativeResult.error);
          }
          context.result = nativeResult.value;
        } else {
          entry.status.nativeCalls += 1;
          context.result = nativeResult;
        }
      }
      this.#runHooks(entry.system, "after", context);
      return context.result;
    } catch (error) {
      if (error instanceof CompletedJavaScriptCallError) {
        context.error = error.upstreamError;
        entry.status.failures += 1;
        this.#runHooks(entry.system, "error", context);
        throw error.upstreamError;
      }
      context.error = error;
      entry.status.failures += 1;
      entry.status.mode = "js-fallback";
      entry.status.reason = nativeExceptionReason(error);
      this.#runHooks(entry.system, "error", context);
      // Native adapters must be transaction-like and cannot mutate JS state
      // until they have a validated result. Falling back is safe under that
      // contract.
      entry.status.fallbackCalls += 1;
      return this.#invokeFallback(entry, args, invokedThroughFacade);
    }
  }

  #invokeFallback(
    entry: SystemEntry,
    args: unknown[],
    invokedThroughFacade: boolean,
  ): unknown {
    // A common legacy wrapper captures the previous global, installs itself,
    // and calls that captured function. If the captured value is our facade,
    // routing it back to the detected replacement would recurse forever.
    // Calls entering through that detached facade therefore continue the
    // wrapper chain at KD's captured official function. Explicit SDK dispatch
    // still enters the replacement first.
    const fallback =
      invokedThroughFacade && this.#target[entry.globalName] !== entry.facade
        ? entry.official
        : (entry.replacement ?? entry.official);
    return Reflect.apply(fallback, this.#target, args);
  }

  #runHooks(system: SystemName, phase: HookPhase, context: HookContext): void {
    const hooks = [...this.#hooks.values()]
      .filter((hook) => hook.system === system && hook.phase === phase)
      .sort(
        (left, right) =>
          right.priority - left.priority || left.id.localeCompare(right.id),
      );
    for (const hook of hooks) {
      hook.callback(context);
    }
  }
}

class CompletedJavaScriptCallError {
  constructor(readonly upstreamError: unknown) {}
}

function nativeExceptionReason(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown-error";
  return `native-exception:${message.slice(0, 160)}`;
}

function flushDirectOfficialCalls(entry: SystemEntry): void {
  const calls = entry.pendingDirectOfficialCalls;
  if (calls === 0) {
    return;
  }
  entry.pendingDirectOfficialCalls = 0;
  entry.status.calls += calls;
  entry.status.fallbackCalls += calls;
}

function freezeStatus(status: MutableStatus): SystemStatus {
  return Object.freeze({ ...status });
}
