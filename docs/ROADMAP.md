# Roadmap

The goal is not “rewrite every file in Rust because Rust is cool.” The goal is
to move work that is actually expensive, prove that the result behaves
correctly, and leave the JavaScript/mod boundary usable.

Each slice earns its way onto `main` with compatibility tests, fallback
coverage, and a before/after measurement.

## At a glance

| Area | Status | What moves it forward |
| --- | --- | --- |
| Bootstrap and patching | Alpha, working on KD 5.4.92 | More install/upgrade coverage and public packages |
| Pathfinding | First adapter enabled | Longer real-map and mod-heavy sessions |
| Crowded-turn AI | Profiling and local prototypes | Exact-state paired wins that survive mod replacement |
| Movement, combat, and status | Queued | Stable state boundaries and deterministic fixtures |
| Map generation and world work | Queued | Seed contracts and gameplay-invariant tests |
| Assets and startup | Planned separately | Startup, memory, and visual measurements |
| Mod SDK | Skeleton exists | Examples, diagnostics, ABI docs, and a compatibility suite |
| Stable release | Not there yet | Clean installs, long sessions, upgrades, and painless uninstall |

“Queued” does not mean forgotten. It means profiling has not earned that code a
trip across the JavaScript/WASM boundary yet.

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

The first measured release path is already useful: a focused KD 5.4.92 fixture
ran 1.824x as fast as the original pathfinder and returned the same route. The
next job is making sure that win stays boring on real maps, long sessions, and
messy mod setups.

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

## Quality-of-life work

Speed is the headline, but the project should also be pleasant to live with:

- one-click install, status, repair, and uninstall;
- useful progress and error messages instead of a silent patcher window;
- a download-once asset cache for slow or remote connections;
- settings that explain what each optimization changes;
- easy export of scrubbed diagnostics and benchmark results; and
- developer switches that stay inside isolated test builds.

These features still follow the same rule as performance work: do not mangle
saves, do not quietly bundle the game, and make every patch reversible.

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

## How a change gets onto `main`

1. Profile the real game and name the expensive call.
2. Build the smallest useful fast path.
3. Compare it with the original JavaScript on the same inputs and final state.
4. Replace functions and arguments the way real mods do, then prove fallback
   still works.
5. Run save-safety, stress, type, Rust, and packaging checks.
6. Keep the result only if the improvement repeats. A clever idea that measures
   slower stays in the lab notes.

The order can change when profiling proves a different bottleneck matters more.
Maximum optimization is still the destination; measurement decides the route.
