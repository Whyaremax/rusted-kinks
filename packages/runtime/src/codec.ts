export const ABI_VERSION = 1;
const UTF8 = new TextEncoder();

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface NativeEntity {
  readonly id: number;
  readonly generation: number;
  readonly position: Position;
  readonly hp: number;
  readonly maxHp: number;
  readonly faction: number;
  readonly flags: number;
}

export interface NativeBuff {
  readonly kind: number;
  readonly remaining: number;
  readonly stacks: number;
  readonly magnitude: number;
  readonly flags: number;
}

export interface Snapshot {
  readonly width: number;
  readonly height: number;
  readonly turn: bigint;
  readonly seed: bigint;
  readonly tiles: Uint8Array;
  readonly entities: readonly NativeEntity[];
  readonly buffs: readonly { entity: number; buff: NativeBuff }[];
}

export type NativeCommand =
  | { readonly kind: "move"; readonly entity: number; readonly dx: number; readonly dy: number }
  | {
      readonly kind: "damage";
      readonly actor: number;
      readonly target: number;
      readonly amount: number;
    }
  | {
      readonly kind: "heal";
      readonly actor: number;
      readonly target: number;
      readonly amount: number;
    }
  | {
      readonly kind: "addBuff";
      readonly actor: number;
      readonly target: number;
      readonly buff: NativeBuff;
    }
  | { readonly kind: "wait"; readonly entity: number }
  | { readonly kind: "runAi"; readonly faction: number };

export interface CommandBatch {
  readonly expectedTurn: bigint;
  readonly commands: readonly NativeCommand[];
}

export const EVENT_KIND = {
  turnStarted: 1,
  moved: 2,
  damaged: 3,
  healed: 4,
  died: 5,
  buffAdded: 6,
  buffTicked: 7,
  waited: 8,
  blocked: 9,
  turnEnded: 10
} as const;

export interface NativeEvent {
  readonly kind: number;
  readonly actor: number;
  readonly target: number;
  readonly position: Position;
  readonly value: number;
  readonly detail: number;
}

export interface StepResponse {
  readonly turn: bigint;
  readonly droppedEvents: number;
  readonly events: readonly NativeEvent[];
}

export type NativeQuery =
  | {
      readonly kind: "path";
      readonly entity: number;
      readonly goal: Position;
      readonly maxVisited: number;
    }
  | {
      readonly kind: "gridPath";
      readonly start: Position;
      readonly goal: Position;
      readonly maxVisited: number;
      readonly diagonal: boolean;
    }
  | {
      readonly kind: "nearby";
      readonly origin: Position;
      readonly radius: number;
    };

export type QueryResponse =
  | {
      readonly kind: "path";
      readonly status: "found" | "unreachable" | "budget-exceeded";
      readonly visited: number;
      readonly positions: readonly Position[];
    }
  | { readonly kind: "entities"; readonly entities: readonly number[] };

export function encodeSnapshot(snapshot: Snapshot): Uint8Array {
  assertIntegerRange("width", snapshot.width, 1, 4_096);
  assertIntegerRange("height", snapshot.height, 1, 4_096);
  if (snapshot.tiles.length !== snapshot.width * snapshot.height) {
    throw new RangeError("Tile count does not match snapshot dimensions");
  }
  const writer = new BinaryWriter("KDH1");
  writer.u16(ABI_VERSION);
  writer.u16(snapshot.width);
  writer.u16(snapshot.height);
  writer.u16(0);
  writer.u64(snapshot.turn);
  writer.u64(snapshot.seed);
  writer.count(snapshot.tiles.length);
  writer.count(snapshot.entities.length);
  writer.count(snapshot.buffs.length);
  writer.bytes(snapshot.tiles);
  for (const entity of snapshot.entities) {
    writer.u32(entity.id);
    writer.u32(entity.generation);
    writer.position(entity.position);
    writer.i32(entity.hp);
    writer.i32(entity.maxHp);
    writer.u16(entity.faction);
    writer.u16(0);
    writer.u32(entity.flags);
  }
  for (const entry of snapshot.buffs) {
    writer.u32(entry.entity);
    writer.buff(entry.buff);
  }
  return writer.finish();
}

export function decodeSnapshot(bytes: Uint8Array): Snapshot {
  const reader = new BinaryReader(bytes, "KDH1");
  reader.version();
  const width = reader.u16();
  const height = reader.u16();
  reader.u16();
  const turn = reader.u64();
  const seed = reader.u64();
  const tileCount = reader.count(16_777_216, "tiles");
  const entityCount = reader.count(100_000, "entities");
  const buffCount = reader.count(1_000_000, "buffs");
  if (tileCount !== width * height) {
    throw new RangeError("Tile count does not match snapshot dimensions");
  }
  const tiles = reader.bytes(tileCount).slice();
  const entities: NativeEntity[] = [];
  for (let index = 0; index < entityCount; index += 1) {
    const id = reader.u32();
    const generation = reader.u32();
    const position = reader.position();
    const hp = reader.i32();
    const maxHp = reader.i32();
    const faction = reader.u16();
    reader.u16();
    const flags = reader.u32();
    entities.push({ id, generation, position, hp, maxHp, faction, flags });
  }
  const buffs: { entity: number; buff: NativeBuff }[] = [];
  for (let index = 0; index < buffCount; index += 1) {
    buffs.push({ entity: reader.u32(), buff: reader.buff() });
  }
  reader.finish();
  return { width, height, turn, seed, tiles, entities, buffs };
}

export function encodeCommands(batch: CommandBatch): Uint8Array {
  const writer = new BinaryWriter("KDC1");
  writer.u16(ABI_VERSION);
  writer.u16(0);
  writer.u64(batch.expectedTurn);
  writer.count(batch.commands.length);
  for (const command of batch.commands) {
    switch (command.kind) {
      case "move":
        writer.u8(1);
        writer.u8(0);
        writer.u16(0);
        writer.u32(command.entity);
        writer.i16(command.dx);
        writer.i16(command.dy);
        break;
      case "damage":
        writer.u8(2);
        writer.u8(0);
        writer.u16(0);
        writer.u32(command.actor);
        writer.u32(command.target);
        writer.i32(command.amount);
        break;
      case "heal":
        writer.u8(3);
        writer.u8(0);
        writer.u16(0);
        writer.u32(command.actor);
        writer.u32(command.target);
        writer.i32(command.amount);
        break;
      case "addBuff":
        writer.u8(4);
        writer.u8(0);
        writer.u16(0);
        writer.u32(command.actor);
        writer.u32(command.target);
        writer.buff(command.buff);
        break;
      case "wait":
        writer.u8(5);
        writer.u8(0);
        writer.u16(0);
        writer.u32(command.entity);
        break;
      case "runAi":
        writer.u8(6);
        writer.u8(0);
        writer.u16(command.faction);
        break;
      default:
        assertNever(command);
    }
  }
  return writer.finish();
}

export function decodeStepResponse(bytes: Uint8Array): StepResponse {
  const reader = new BinaryReader(bytes, "KDR1");
  reader.version();
  reader.u16();
  const turn = reader.u64();
  const droppedEvents = reader.u32();
  const count = reader.count(1_000_000, "events");
  const events: NativeEvent[] = [];
  for (let index = 0; index < count; index += 1) {
    const kind = reader.u8();
    reader.u8();
    reader.u16();
    events.push({
      kind,
      actor: reader.u32(),
      target: reader.u32(),
      position: reader.position(),
      value: reader.i32(),
      detail: reader.u32()
    });
  }
  reader.finish();
  return { turn, droppedEvents, events };
}

export function encodeQuery(query: NativeQuery): Uint8Array {
  const writer = new BinaryWriter("KDQ1");
  writer.u16(ABI_VERSION);
  if (query.kind === "path") {
    writer.u8(1);
    writer.u8(0);
    writer.u32(query.entity);
    writer.position(query.goal);
    writer.u32(query.maxVisited);
  } else if (query.kind === "gridPath") {
    writer.u8(3);
    writer.u8(Number(query.diagonal));
    writer.position(query.start);
    writer.position(query.goal);
    writer.u32(query.maxVisited);
  } else {
    writer.u8(2);
    writer.u8(0);
    writer.position(query.origin);
    writer.u16(query.radius);
  }
  return writer.finish();
}

export function decodeQueryResponse(bytes: Uint8Array): QueryResponse {
  const reader = new BinaryReader(bytes, "KDZ1");
  reader.version();
  const kind = reader.u8();
  const detail = reader.u8();
  if (kind === 1) {
    const status =
      detail === 0
        ? "found"
        : detail === 1
          ? "unreachable"
          : detail === 2
            ? "budget-exceeded"
            : null;
    if (status === null) {
      throw new RangeError(`Unknown path status ${detail}`);
    }
    const visited = reader.u32();
    const count = reader.count(1_000_000, "path");
    const positions: Position[] = [];
    for (let index = 0; index < count; index += 1) {
      positions.push(reader.position());
    }
    reader.finish();
    return { kind: "path", status, visited, positions };
  }
  if (kind === 2) {
    const count = reader.count(100_000, "entities");
    const entities: number[] = [];
    for (let index = 0; index < count; index += 1) {
      entities.push(reader.u32());
    }
    reader.finish();
    return { kind: "entities", entities };
  }
  throw new RangeError(`Unknown query response kind ${kind}`);
}

export class BinaryWriter {
  readonly #chunks: Uint8Array[] = [];
  #length = 0;

  constructor(magic: string) {
    const bytes = UTF8.encode(magic);
    if (bytes.length !== 4) {
      throw new TypeError("Protocol magic must be four bytes");
    }
    this.bytes(bytes);
  }

  u8(value: number): void {
    assertIntegerRange("u8", value, 0, 0xff);
    this.bytes(Uint8Array.of(value));
  }

  u16(value: number): void {
    assertIntegerRange("u16", value, 0, 0xffff);
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    this.bytes(bytes);
  }

  i16(value: number): void {
    assertIntegerRange("i16", value, -0x8000, 0x7fff);
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setInt16(0, value, true);
    this.bytes(bytes);
  }

  u32(value: number): void {
    assertIntegerRange("u32", value, 0, 0xffff_ffff);
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    this.bytes(bytes);
  }

  i32(value: number): void {
    assertIntegerRange("i32", value, -0x8000_0000, 0x7fff_ffff);
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setInt32(0, value, true);
    this.bytes(bytes);
  }

  u64(value: bigint): void {
    if (value < 0n || value > 0xffff_ffff_ffff_ffffn) {
      throw new RangeError(`u64 is outside range: ${value}`);
    }
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, value, true);
    this.bytes(bytes);
  }

  count(value: number): void {
    this.u32(value);
  }

  position(position: Position): void {
    this.i16(position.x);
    this.i16(position.y);
  }

  buff(buff: NativeBuff): void {
    this.u32(buff.kind);
    this.i16(buff.remaining);
    this.i16(buff.stacks);
    this.i32(buff.magnitude);
    this.u32(buff.flags);
  }

  bytes(value: Uint8Array): void {
    this.#chunks.push(value);
    this.#length += value.byteLength;
    if (this.#length > 128 * 1024 * 1024) {
      throw new RangeError("Protocol buffer exceeds 128 MiB");
    }
  }

  finish(): Uint8Array {
    const output = new Uint8Array(this.#length);
    let offset = 0;
    for (const chunk of this.#chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  }
}

export class BinaryReader {
  readonly #bytes: Uint8Array;
  readonly #view: DataView;
  #offset = 0;

  constructor(bytes: Uint8Array, expectedMagic: string) {
    if (bytes.byteLength > 128 * 1024 * 1024) {
      throw new RangeError("Protocol buffer exceeds 128 MiB");
    }
    this.#bytes = bytes;
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const actual = String.fromCharCode(...this.bytes(4));
    if (actual !== expectedMagic) {
      throw new TypeError(`Expected protocol magic ${expectedMagic}, received ${actual}`);
    }
  }

  u8(): number {
    this.#require(1);
    return this.#view.getUint8(this.#offset++);
  }

  u16(): number {
    this.#require(2);
    const value = this.#view.getUint16(this.#offset, true);
    this.#offset += 2;
    return value;
  }

  i16(): number {
    this.#require(2);
    const value = this.#view.getInt16(this.#offset, true);
    this.#offset += 2;
    return value;
  }

  u32(): number {
    this.#require(4);
    const value = this.#view.getUint32(this.#offset, true);
    this.#offset += 4;
    return value;
  }

  i32(): number {
    this.#require(4);
    const value = this.#view.getInt32(this.#offset, true);
    this.#offset += 4;
    return value;
  }

  u64(): bigint {
    this.#require(8);
    const value = this.#view.getBigUint64(this.#offset, true);
    this.#offset += 8;
    return value;
  }

  bytes(length: number): Uint8Array {
    this.#require(length);
    const result = this.#bytes.subarray(this.#offset, this.#offset + length);
    this.#offset += length;
    return result;
  }

  version(): void {
    const version = this.u16();
    if (version !== ABI_VERSION) {
      throw new RangeError(`Unsupported KD Hybrid ABI ${version}`);
    }
  }

  count(maximum: number, name: string): number {
    const count = this.u32();
    if (count > maximum) {
      throw new RangeError(`${name} count ${count} exceeds ${maximum}`);
    }
    return count;
  }

  position(): Position {
    return { x: this.i16(), y: this.i16() };
  }

  buff(): NativeBuff {
    return {
      kind: this.u32(),
      remaining: this.i16(),
      stacks: this.i16(),
      magnitude: this.i32(),
      flags: this.u32()
    };
  }

  finish(): void {
    if (this.#offset !== this.#bytes.byteLength) {
      throw new RangeError(
        `Protocol buffer has ${this.#bytes.byteLength - this.#offset} trailing bytes`
      );
    }
  }

  #require(length: number): void {
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      this.#offset + length > this.#bytes.byteLength
    ) {
      throw new RangeError("Truncated protocol buffer");
    }
  }
}

function assertIntegerRange(
  name: string,
  value: number,
  minimum: number,
  maximum: number
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} is outside ${minimum}..${maximum}: ${value}`);
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown command: ${String(value)}`);
}
