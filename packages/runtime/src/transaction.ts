import {
  decodeQueryResponse,
  decodeStepResponse,
  encodeCommands,
  encodeQuery,
  encodeSnapshot,
  type CommandBatch,
  type NativeQuery,
  type QueryResponse,
  type Snapshot,
  type StepResponse
} from "./codec.js";
import type { WasmBatchBridge } from "./bridge.js";

/**
 * Native adapters are transactional: capture and compute may not mutate KD
 * state. Only `commit` can apply a validated result. This is what makes
 * exception fallback safe.
 */
export interface TransactionalAdapter<Arguments extends unknown[], Result, Captured = Snapshot> {
  capture(args: readonly [...Arguments]): Captured;
  snapshot(captured: Captured, args: readonly [...Arguments]): Snapshot;
  commands(captured: Captured, args: readonly [...Arguments]): CommandBatch;
  validate(
    response: StepResponse,
    captured: Captured,
    args: readonly [...Arguments]
  ): void;
  commit(
    response: StepResponse,
    captured: Captured,
    args: readonly [...Arguments]
  ): Result;
}

export function createTransactionalFacade<
  Arguments extends unknown[],
  Result,
  Captured = Snapshot
>(
  bridge: WasmBatchBridge,
  adapter: TransactionalAdapter<Arguments, Result, Captured>
): (...args: Arguments) => Result {
  return (...args: Arguments): Result => {
    const readonlyArgs = args as readonly [...Arguments];
    const captured = adapter.capture(readonlyArgs);
    const snapshot = adapter.snapshot(captured, readonlyArgs);
    const commands = adapter.commands(captured, readonlyArgs);
    if (commands.expectedTurn !== snapshot.turn) {
      throw new Error("Adapter command turn does not match its captured snapshot");
    }
    bridge.loadSnapshot(encodeSnapshot(snapshot));
    const response = decodeStepResponse(bridge.step(encodeCommands(commands)));
    if (response.turn !== snapshot.turn + 1n) {
      throw new Error("Native response did not advance exactly one turn");
    }
    adapter.validate(response, captured, readonlyArgs);
    return adapter.commit(response, captured, readonlyArgs);
  };
}

export interface QueryAdapter<Arguments extends unknown[], Result, Captured = unknown> {
  capture(args: readonly [...Arguments]): Captured;
  query(captured: Captured, args: readonly [...Arguments]): NativeQuery;
  validate(
    response: QueryResponse,
    captured: Captured,
    args: readonly [...Arguments]
  ): void;
  commit(
    response: QueryResponse,
    captured: Captured,
    args: readonly [...Arguments]
  ): Result;
}

export function createQueryFacade<
  Arguments extends unknown[],
  Result,
  Captured = unknown
>(
  bridge: WasmBatchBridge,
  adapter: QueryAdapter<Arguments, Result, Captured>
): (...args: Arguments) => Result {
  return (...args: Arguments): Result => {
    const readonlyArgs = args as readonly [...Arguments];
    const captured = adapter.capture(readonlyArgs);
    const response = decodeQueryResponse(
      bridge.query(encodeQuery(adapter.query(captured, readonlyArgs)))
    );
    adapter.validate(response, captured, readonlyArgs);
    return adapter.commit(response, captured, readonlyArgs);
  };
}
