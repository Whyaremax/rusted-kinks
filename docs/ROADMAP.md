# Roadmap

The goal is not “rewrite every file in Rust because Rust is cool.” The goal is
to move work that is actually expensive, prove that the result behaves
correctly, and leave the JavaScript/mod boundary usable.

Each slice earns its way onto `main` with compatibility tests, fallback
coverage, and a before/after measurement.

## Now: foundation and pathfinding

The foundation is in place:

- deterministic Rust core and WebAssembly bridge;
- versioned binary protocol and snapshot format;
- spatial index and reusable pathfinding workspace;
- signature-gated JavaScript adapter with per-call fallback;
- reversible patchers and installation manifests;
- isolated save-safe Electron test installation; and
- automated real-game pathfinding stress coverage.

Current pathfinding work focuses on three useful choices:

- **Optimized** for the default low-latency route;
- **Route Quality** for the lowest weighted map cost and shared-destination
  workloads; and
- **Human-like** for fewer pointless direction changes.

Before this slice is treated as boring and finished, it still needs more real
maps, more mod combinations, longer play sessions, and coverage for new KD
updates.

## Next: turns that cost real time

The next native candidates are the parts repeatedly exercised during crowded
turns:

- movement validation and occupancy updates;
- common AI target and decision queries;
- combat arithmetic and batched damage/healing results;
- buff lookup, ticking, and expiration;
- event batching across the WASM boundary; and
- deterministic RNG streams that can be compared with fixtures.

These should land one system at a time. A partially migrated turn with a clean
fallback is more useful than a giant rewrite nobody can debug.

## After that: world work

- map-generation helpers and room queries;
- navigation fields shared by groups of NPCs;
- prison/capture route stress fixtures;
- seed-based generation comparisons;
- snapshot deltas instead of full-state re-encoding; and
- profiling tools that show whether time was spent in JavaScript, WASM, the
  bridge, rendering, or mods.

Exact byte-for-byte parity is not required when two algorithms may choose
different valid routes or layouts, but gameplay rules, reachability, costs, and
seed contracts need explicit tests.

## Assets and startup

Rendering is not automatically fixed by rewriting simulation code. The asset
track is separate:

- deduplicate concurrent downloads;
- cache assets locally after the first successful fetch;
- lazy-load large atlases and audio;
- track decoded texture memory;
- use frame cadence and memory pressure to select a quality tier; and
- measure startup-to-menu and first-room readiness.

Visual changes need screenshot/reference testing so “optimized” does not quietly
mean “blurry or missing.”

## Modding

The long-term native side should be extendable without asking every mod author
to become a Rust expert:

- stable JavaScript hooks before and after migrated systems;
- documented capability manifests for optional WASM plugins;
- ABI/version checks with useful error messages;
- example JavaScript and Rust plugins;
- diagnostics that identify which mod caused a fallback; and
- a small compatibility suite mod authors can run locally.

Normal JavaScript mods remain first-class. Native plugins are an extra option,
not a replacement for the existing community.

## Release and distribution

A stable release needs:

- a signed or checksum-verifiable Windows manager;
- Linux x86_64 and ARM64 packages;
- install, status, configure, and uninstall flows tested on clean copies;
- no game binaries, assets, or saves in the repository or release;
- MPL source and notices shipped beside adapted files;
- an upgrade path between KD Hybrid versions; and
- a clear compatibility table for supported Kinky Dungeon builds.

## Release gates

| Slice | What must be true before it is enabled by default |
| --- | --- |
| Pathfinding | Valid paths, equal reachability, argument/fallback coverage, and a repeatable speedup |
| Movement and AI | Event and function-replacement mods pass; no turn-order drift |
| Combat and status | Deterministic fixtures and save round trips pass |
| World | Seed contracts and room/gameplay invariants pass |
| Assets | Visual references pass and memory/startup measurements improve |
| Stable | Known builds pass long-session tests and every installed change can be cleanly removed |

The order can change when profiling proves a different bottleneck matters more.
Maximum optimization is still the destination; measurement decides the route.
