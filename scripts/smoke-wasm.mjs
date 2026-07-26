import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import init, {
  HybridEngine,
  initSync
} from "../dist/wasm-web/kd_hybrid_core.js";
import {
  decodeQueryResponse,
  decodeStepResponse,
  encodeCommands,
  encodeQuery,
  encodeSnapshot
} from "../packages/runtime/dist/codec.js";

void init;

const root = resolve(import.meta.dirname, "..");
const wasm = await readFile(resolve(root, "dist/wasm-web/kd_hybrid_core_bg.wasm"));
initSync({ module: wasm });

if (HybridEngine.abiVersion() !== 1) {
  throw new Error(`Unexpected WASM ABI ${HybridEngine.abiVersion()}`);
}

const engine = new HybridEngine(5, 5, 42n);
try {
  engine.loadSnapshot(
    encodeSnapshot({
      width: 5,
      height: 5,
      turn: 0n,
      seed: 42n,
      tiles: new Uint8Array(25),
      entities: [
        {
          id: 1,
          generation: 0,
          position: { x: 1, y: 1 },
          hp: 10,
          maxHp: 10,
          faction: 1,
          flags: 0
        },
        {
          id: 2,
          generation: 0,
          position: { x: 3, y: 1 },
          hp: 4,
          maxHp: 4,
          faction: 2,
          flags: 0
        }
      ],
      buffs: []
    })
  );
  const step = decodeStepResponse(
    engine.step(
      encodeCommands({
        expectedTurn: 0n,
        commands: [{ kind: "runAi", faction: 1 }]
      })
    )
  );
  if (step.turn !== 1n || step.events.length < 3) {
    throw new Error("WASM step did not return a valid event batch");
  }
  const query = decodeQueryResponse(
    engine.query(
      encodeQuery({
        kind: "nearby",
        origin: { x: 2, y: 1 },
        radius: 2
      })
    )
  );
  if (query.kind !== "entities" || query.entities.join(",") !== "1,2") {
    throw new Error("WASM spatial query returned an unexpected result");
  }
  process.stdout.write(
    `WASM smoke passed: ABI 1, turn ${step.turn}, ${step.events.length} events.\n`
  );
} finally {
  engine.free();
}
