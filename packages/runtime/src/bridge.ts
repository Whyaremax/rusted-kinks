import { ABI_VERSION } from "./codec.js";

export interface WasmEngine {
  loadSnapshot(bytes: Uint8Array): void;
  saveSnapshot(): Uint8Array;
  step(bytes: Uint8Array): Uint8Array;
  query(bytes: Uint8Array): Uint8Array;
  currentTurn(): bigint;
  lastError(): string | undefined;
  free?(): void;
}

export interface WasmBindings {
  default(input?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module): Promise<unknown>;
  HybridEngine: {
    new (width: number, height: number, seed: bigint): WasmEngine;
    abiVersion(): number;
  };
}

export interface BridgeStats {
  readonly calls: number;
  readonly failures: number;
  readonly inputBytes: number;
  readonly outputBytes: number;
  readonly disabled: boolean;
  readonly reason: string | null;
}

const MAX_BUFFER_BYTES = 64 * 1024 * 1024;

export class WasmBatchBridge {
  #engine: WasmEngine | null = null;
  #calls = 0;
  #failures = 0;
  #inputBytes = 0;
  #outputBytes = 0;
  #disabledReason: string | null = "not-initialized";

  async initialize(
    bindings: WasmBindings,
    wasmSource: RequestInfo | URL | Response | BufferSource | WebAssembly.Module,
    width = 1,
    height = 1,
    seed = 0n
  ): Promise<void> {
    await bindings.default(wasmSource);
    const abi = bindings.HybridEngine.abiVersion();
    if (abi !== ABI_VERSION) {
      throw new Error(`WASM ABI ${abi} does not match host ABI ${ABI_VERSION}`);
    }
    this.#engine?.free?.();
    this.#engine = new bindings.HybridEngine(width, height, seed);
    this.#disabledReason = null;
  }

  attachForTesting(engine: WasmEngine): void {
    this.#engine?.free?.();
    this.#engine = engine;
    this.#disabledReason = null;
  }

  loadSnapshot(bytes: Uint8Array): void {
    this.#invoke("loadSnapshot", bytes, (engine, input) => {
      engine.loadSnapshot(input);
      return new Uint8Array();
    });
  }

  saveSnapshot(): Uint8Array {
    const engine = this.#requireEngine();
    try {
      const output = normalizeOutput(engine.saveSnapshot());
      this.#record(0, output.byteLength);
      return output;
    } catch (error) {
      this.#trip(error);
    }
  }

  step(bytes: Uint8Array): Uint8Array {
    return this.#invoke("step", bytes, (engine, input) => engine.step(input));
  }

  query(bytes: Uint8Array): Uint8Array {
    return this.#invoke("query", bytes, (engine, input) => engine.query(input));
  }

  disable(reason: string): void {
    this.#disabledReason = reason;
  }

  stats(): BridgeStats {
    return Object.freeze({
      calls: this.#calls,
      failures: this.#failures,
      inputBytes: this.#inputBytes,
      outputBytes: this.#outputBytes,
      disabled: this.#disabledReason !== null,
      reason: this.#disabledReason
    });
  }

  dispose(): void {
    this.#engine?.free?.();
    this.#engine = null;
    this.#disabledReason = "disposed";
  }

  #invoke(
    operation: string,
    bytes: Uint8Array,
    invoke: (engine: WasmEngine, input: Uint8Array) => Uint8Array
  ): Uint8Array {
    if (bytes.byteLength > MAX_BUFFER_BYTES) {
      throw new RangeError(`${operation} input exceeds 64 MiB`);
    }
    const engine = this.#requireEngine();
    try {
      const output = normalizeOutput(invoke(engine, bytes));
      if (output.byteLength > MAX_BUFFER_BYTES) {
        throw new RangeError(`${operation} output exceeds 64 MiB`);
      }
      this.#record(bytes.byteLength, output.byteLength);
      return output;
    } catch (error) {
      this.#trip(error);
    }
  }

  #requireEngine(): WasmEngine {
    if (this.#engine === null || this.#disabledReason !== null) {
      throw new Error(`KD Hybrid native bridge unavailable: ${this.#disabledReason}`);
    }
    return this.#engine;
  }

  #record(input: number, output: number): void {
    this.#calls += 1;
    this.#inputBytes += input;
    this.#outputBytes += output;
  }

  #trip(error: unknown): never {
    this.#failures += 1;
    this.#disabledReason =
      error instanceof Error ? `native-failure:${error.message}` : "native-failure";
    throw error;
  }
}

function normalizeOutput(value: Uint8Array): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new TypeError("WASM operation did not return Uint8Array");
  }
  return value;
}
