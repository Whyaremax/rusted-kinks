import { ABI_VERSION } from "./codec.js";
import { SYSTEM_NAMES } from "./types.js";
import type {
  SystemName,
  WasmPluginCapability,
  WasmPluginHandle,
  WasmPluginManifest
} from "./types.js";

const ALLOWED_CAPABILITIES = new Set<WasmPluginCapability>([
  "read-state",
  "propose-actions",
  "receive-events",
  "path-query",
  "diagnostics",
  "deterministic-random"
]);
const ALLOWED_SYSTEMS = new Set<SystemName>(SYSTEM_NAMES);
const ALLOWED_FUNCTION_IMPORTS = new Set([
  "read_state",
  "propose_action",
  "emit_diagnostic",
  "deterministic_random"
]);
const MAX_PLUGIN_BYTES = 32 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;

type PluginExports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  kd_plugin_abi: () => number;
  kd_plugin_alloc: (length: number) => number;
  kd_plugin_dealloc: (pointer: number, length: number) => void;
  kd_plugin_invoke: (pointer: number, length: number) => bigint;
  kd_plugin_dispose?: () => void;
};

export interface PluginHostCallbacks {
  readonly readState?: (handle: number, offset: number, length: number) => number;
  readonly proposeAction?: (pointer: number, length: number) => number;
  readonly emitDiagnostic?: (pointer: number, length: number) => void;
  readonly deterministicRandom?: () => number;
}

export class CapabilityPluginHost {
  readonly #plugins = new Map<string, ManagedPlugin>();
  readonly #callbacks: PluginHostCallbacks;

  constructor(callbacks: PluginHostCallbacks = {}) {
    this.#callbacks = callbacks;
  }

  async register(
    manifest: WasmPluginManifest,
    source: BufferSource
  ): Promise<WasmPluginHandle> {
    validateManifest(manifest);
    if (this.#plugins.has(manifest.id)) {
      throw new Error(`WASM plugin ${manifest.id} is already registered`);
    }
    const bytes = copyBufferSource(source);
    if (bytes.byteLength > MAX_PLUGIN_BYTES) {
      throw new RangeError("WASM plugin exceeds 32 MiB");
    }
    const module = await WebAssembly.compile(bytes);
    validateImports(module, manifest.capabilities, this.#callbacks);
    const initialPages = Math.min(16, manifest.maxMemoryPages);
    const memory = new WebAssembly.Memory({
      initial: initialPages,
      maximum: manifest.maxMemoryPages
    });
    const imports: WebAssembly.Imports = {
      env: { memory },
      kd_host: {
        read_state: this.#callbacks.readState ?? (() => 0),
        propose_action: this.#callbacks.proposeAction ?? (() => 0),
        emit_diagnostic: this.#callbacks.emitDiagnostic ?? (() => undefined),
        deterministic_random: this.#callbacks.deterministicRandom ?? (() => 0)
      }
    };
    const instance = await WebAssembly.instantiate(module, imports);
    const exports = validateExports(instance.exports, memory);
    if (exports.kd_plugin_abi() !== ABI_VERSION) {
      throw new Error(
        `Plugin ${manifest.id} runtime ABI does not match host ABI ${ABI_VERSION}`
      );
    }
    const plugin = new ManagedPlugin(manifest, exports, () => {
      this.#plugins.delete(manifest.id);
    });
    this.#plugins.set(manifest.id, plugin);
    return plugin;
  }

  manifests(): readonly WasmPluginManifest[] {
    return [...this.#plugins.values()].map((plugin) => plugin.manifest);
  }

  dispose(): void {
    for (const plugin of [...this.#plugins.values()]) {
      plugin.dispose();
    }
  }
}

class ManagedPlugin implements WasmPluginHandle {
  readonly manifest: WasmPluginManifest;
  readonly #exports: PluginExports;
  readonly #onDispose: () => void;
  #active = true;

  constructor(
    manifest: WasmPluginManifest,
    exports: PluginExports,
    onDispose: () => void
  ) {
    this.manifest = Object.freeze({
      ...manifest,
      capabilities: Object.freeze([...manifest.capabilities]),
      systems: Object.freeze([...manifest.systems])
    });
    this.#exports = exports;
    this.#onDispose = onDispose;
  }

  get id(): string {
    return this.manifest.id;
  }

  get active(): boolean {
    return this.#active;
  }

  invoke(payload: Uint8Array): Uint8Array {
    if (!this.#active) {
      throw new Error(`Plugin ${this.id} is disposed`);
    }
    if (payload.byteLength > MAX_PAYLOAD_BYTES) {
      throw new RangeError("Plugin payload exceeds 8 MiB");
    }
    const inputPointer = this.#exports.kd_plugin_alloc(payload.byteLength);
    validateRange(this.#exports.memory, inputPointer, payload.byteLength);
    new Uint8Array(this.#exports.memory.buffer, inputPointer, payload.byteLength).set(payload);
    let packed: bigint;
    try {
      packed = this.#exports.kd_plugin_invoke(inputPointer, payload.byteLength);
    } finally {
      this.#exports.kd_plugin_dealloc(inputPointer, payload.byteLength);
    }
    const outputPointer = Number((packed >> 32n) & 0xffff_ffffn);
    const outputLength = Number(packed & 0xffff_ffffn);
    if (outputLength > MAX_PAYLOAD_BYTES) {
      throw new RangeError("Plugin response exceeds 8 MiB");
    }
    validateRange(this.#exports.memory, outputPointer, outputLength);
    const output = new Uint8Array(
      this.#exports.memory.buffer,
      outputPointer,
      outputLength
    ).slice();
    this.#exports.kd_plugin_dealloc(outputPointer, outputLength);
    return output;
  }

  dispose(): void {
    if (!this.#active) {
      return;
    }
    this.#active = false;
    this.#exports.kd_plugin_dispose?.();
    this.#onDispose();
  }
}

export function validateManifest(manifest: WasmPluginManifest): void {
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/u.test(manifest.id)) {
    throw new TypeError("Plugin id must be 2-64 lowercase safe characters");
  }
  if (
    typeof manifest.name !== "string" ||
    manifest.name.trim().length === 0 ||
    manifest.name.length > 128
  ) {
    throw new TypeError("Plugin name must contain 1-128 characters");
  }
  if (
    typeof manifest.version !== "string" ||
    manifest.version.trim().length === 0 ||
    manifest.version.length > 64
  ) {
    throw new TypeError("Plugin version must contain 1-64 characters");
  }
  if (manifest.abi !== ABI_VERSION) {
    throw new Error(
      `Plugin manifest ABI ${manifest.abi} does not match host ABI ${ABI_VERSION}`
    );
  }
  if (
    !Number.isSafeInteger(manifest.maxMemoryPages) ||
    manifest.maxMemoryPages < 1 ||
    manifest.maxMemoryPages > 1_024
  ) {
    throw new RangeError("Plugin maxMemoryPages must be within 1..1024");
  }
  if (new Set(manifest.capabilities).size !== manifest.capabilities.length) {
    throw new TypeError("Plugin capabilities contain duplicates");
  }
  for (const capability of manifest.capabilities) {
    if (!ALLOWED_CAPABILITIES.has(capability)) {
      throw new TypeError(`Unknown plugin capability ${capability}`);
    }
  }
  if (new Set(manifest.systems).size !== manifest.systems.length) {
    throw new TypeError("Plugin systems contain duplicates");
  }
  for (const system of manifest.systems) {
    if (!ALLOWED_SYSTEMS.has(system)) {
      throw new TypeError(`Unknown plugin system ${system}`);
    }
  }
}

function validateImports(
  module: WebAssembly.Module,
  capabilities: readonly WasmPluginCapability[],
  callbacks: PluginHostCallbacks
): void {
  const imports = WebAssembly.Module.imports(module);
  const memories = imports.filter((entry) => entry.kind === "memory");
  if (
    memories.length !== 1 ||
    memories[0]?.module !== "env" ||
    memories[0].name !== "memory"
  ) {
    throw new TypeError("Plugin must import exactly env.memory so its maximum is enforced");
  }
  for (const entry of imports) {
    if (entry.kind === "memory") {
      continue;
    }
    if (
      entry.kind !== "function" ||
      entry.module !== "kd_host" ||
      !ALLOWED_FUNCTION_IMPORTS.has(entry.name)
    ) {
      throw new TypeError(`Forbidden WASM import ${entry.module}.${entry.name}:${entry.kind}`);
    }
    const required = capabilityForImport(entry.name);
    if (required !== null && !capabilities.includes(required)) {
      throw new TypeError(`Import ${entry.name} requires capability ${required}`);
    }
    if (required !== null && !hasCapabilityCallback(required, callbacks)) {
      throw new Error(`Host capability ${required} is not available`);
    }
  }
}

function hasCapabilityCallback(
  capability: WasmPluginCapability,
  callbacks: PluginHostCallbacks
): boolean {
  switch (capability) {
    case "read-state":
      return callbacks.readState !== undefined;
    case "propose-actions":
      return callbacks.proposeAction !== undefined;
    case "diagnostics":
      return callbacks.emitDiagnostic !== undefined;
    case "deterministic-random":
      return callbacks.deterministicRandom !== undefined;
    case "receive-events":
    case "path-query":
      return false;
  }
}

function capabilityForImport(name: string): WasmPluginCapability | null {
  switch (name) {
    case "read_state":
      return "read-state";
    case "propose_action":
      return "propose-actions";
    case "emit_diagnostic":
      return "diagnostics";
    case "deterministic_random":
      return "deterministic-random";
    default:
      return null;
  }
}

function validateExports(
  raw: WebAssembly.Exports,
  expectedMemory: WebAssembly.Memory
): PluginExports {
  const exports = raw as Partial<PluginExports>;
  if (exports.memory !== expectedMemory) {
    throw new TypeError("Plugin must export its imported env.memory");
  }
  for (const name of [
    "kd_plugin_abi",
    "kd_plugin_alloc",
    "kd_plugin_dealloc",
    "kd_plugin_invoke"
  ] as const) {
    if (typeof exports[name] !== "function") {
      throw new TypeError(`Plugin is missing export ${name}`);
    }
  }
  return exports as PluginExports;
}

function validateRange(memory: WebAssembly.Memory, pointer: number, length: number): void {
  if (
    !Number.isSafeInteger(pointer) ||
    !Number.isSafeInteger(length) ||
    pointer < 0 ||
    length < 0 ||
    pointer + length > memory.buffer.byteLength
  ) {
    throw new RangeError("Plugin returned an out-of-range memory slice");
  }
}

function copyBufferSource(source: BufferSource): ArrayBuffer {
  const view = ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : new Uint8Array(source);
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(view);
  return copy;
}
