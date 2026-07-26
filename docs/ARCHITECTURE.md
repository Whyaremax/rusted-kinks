# Architecture

## Boundary rule

JavaScript owns the mod-visible state at action boundaries. Rust owns a compact
simulation snapshot only while a batch is executing. The host serializes one
snapshot or command batch, invokes WASM once, validates the response, and
applies the resulting events through official JavaScript functions.

No hot path performs one WASM call per entity, tile, buff, or event. Strings are
interned by the host and represented as numeric IDs. Entity references combine
an ID and generation so stale references are rejected.

```text
KD/Pixi UI and legacy mods
          |
          v
versioned JS SDK + system dispatcher
          |
          | one Uint8Array per boundary
          v
Rust/WASM deterministic core
          |
          v
validated event/result batch
          |
          v
official JS application path + mod hooks
```

## Core systems

The Rust workspace is dependency-light and does not use the browser, Electron,
Pixi, or filesystem APIs. `kd-core` provides:

- stable entity storage and generation checks;
- a grid and incrementally maintained spatial index;
- deterministic A* pathfinding with a work budget;
- movement, basic AI, damage/healing, and buff ticking;
- a bounded event queue;
- deterministic map generation;
- a versioned little-endian binary protocol; and
- capability validation for optional WASM plugins.

`kd-wasm` is intentionally small. It exposes batch load, step, and query
operations and reports errors without panicking across the ABI.

## Compatibility dispatcher

For each migrated KD global, the host records the official function reference
and a structural signature. A facade is installed only after a catalog match is
unique. If a mod replaces that global, the associated native system is disabled
and the modded JavaScript path wins. Other native systems remain enabled.

Unknown bundle, unknown function, ambiguous signature, failed probe, invalid
WASM response, or runtime exception all fail closed to JavaScript.

## Assets

The asset controller tracks logical assets separately from atlas pages. It
deduplicates concurrent page loads, reference-counts active pages, retains
last-use timestamps, and evicts only unreferenced pages. The adaptive controller
selects High, Balanced, or Performance quality from resolution, memory, and
measured frame cadence.

## Release gate

Public releases require parity fixtures for all systems marked migrated,
fallback coverage for legacy replacements, save import/export round trips, and
performance results on at least one integrated and one discrete GPU.
