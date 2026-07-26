import { describe, expect, it } from "vitest";

import {
  BinaryWriter,
  decodeSnapshot,
  decodeStepResponse,
  encodeCommands,
  encodeQuery,
  encodeSnapshot,
  type Snapshot
} from "./codec.js";

describe("binary protocol", () => {
  it("round-trips deterministic snapshots", () => {
    const snapshot: Snapshot = {
      width: 3,
      height: 2,
      turn: 9n,
      seed: 123n,
      tiles: Uint8Array.of(0, 0, 1, 0, 0, 0),
      entities: [
        {
          id: 7,
          generation: 2,
          position: { x: 1, y: 1 },
          hp: 4,
          maxHp: 8,
          faction: 3,
          flags: 0
        }
      ],
      buffs: [
        {
          entity: 7,
          buff: {
            kind: 4,
            remaining: 2,
            stacks: 1,
            magnitude: 3,
            flags: 1
          }
        }
      ]
    };
    const encoded = encodeSnapshot(snapshot);
    const decoded = decodeSnapshot(encoded);
    expect(decoded).toEqual(snapshot);
    expect(encodeSnapshot(decoded)).toEqual(encoded);
  });

  it("encodes every command without JSON", () => {
    const encoded = encodeCommands({
      expectedTurn: 12n,
      commands: [
        { kind: "move", entity: 1, dx: -1, dy: 0 },
        { kind: "damage", actor: 1, target: 2, amount: 4 },
        { kind: "heal", actor: 1, target: 1, amount: 2 },
        {
          kind: "addBuff",
          actor: 1,
          target: 2,
          buff: { kind: 3, remaining: 4, stacks: 1, magnitude: 2, flags: 1 }
        },
        { kind: "wait", entity: 2 },
        { kind: "runAi", faction: 7 }
      ]
    });
    expect(new TextDecoder().decode(encoded.slice(0, 4))).toBe("KDC1");
    expect(encoded.byteLength).toBeLessThan(128);
  });

  it("encodes weighted grid path options in a distinct query tag", () => {
    const encoded = encodeQuery({
      kind: "gridPath",
      start: { x: 1, y: 2 },
      goal: { x: 9, y: 8 },
      maxVisited: 4_096,
      diagonal: true
    });
    expect(new TextDecoder().decode(encoded.slice(0, 4))).toBe("KDQ1");
    expect(encoded[6]).toBe(3);
    expect(encoded[7]).toBe(1);
  });

  it("rejects trailing bytes", () => {
    const writer = new BinaryWriter("KDR1");
    writer.u16(1);
    writer.u16(0);
    writer.u64(1n);
    writer.u32(0);
    writer.u32(0);
    writer.u8(99);
    expect(() => decodeStepResponse(writer.finish())).toThrow(/trailing bytes/u);
  });
});
