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
- a reusable pathfinding workspace with three deterministic, work-budgeted
  planners: lowest-cost destination fields, weighted A*, and direction-aware
  weighted A*;
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

## Native control-mod bridge

The installer places one genuine mod archive at
`Mods/KDHybridBridge.zip`. KD's own filesystem loader discovers its `mod.json`,
loads its script, lists it alongside other mods, and renders its entries through
the standard `KDModConfigs` and `KDModSettings` APIs. No bootstrap code wraps or
replaces the mod-list drawing function.

The early bootstrap publishes a deliberately small `KDHybridModBridge` host
before KD loads mods. The control mod may read status and submit only three
validated values: pathfinding mode, texture mode, and adaptive frame pacing.
Pathfinding and pacing apply immediately. Texture selection is a startup
decision, so a changed texture setting is persisted and reported as requiring a
restart. Invalid types or enum values are rejected at the boundary.

The patchers own this one archive by exact path, size, and SHA-256. Installation
refuses an unrelated file at that path; status detects later changes; uninstall
removes it only after verification. Other mod archives are never enumerated,
rewritten, or deleted.

## Pathfinding modes

Pathfinding mode is encoded in reserved query flag bits, so the binary ABI
remains version 1. All modes reuse generation-stamped score, parent, closed,
and heap storage instead of allocating a complete search workspace per query.

- `quality` incrementally builds a reverse Dijkstra field for a destination.
  Up to eight fields are retained with least-recently-used eviction.
- `fast` is weighted A* with a 1.35 heuristic weight and is the default.
- `human` uses one best arrival per tile plus its incoming direction. A turn
  penalty favors stable headings without multiplying the search space by all
  possible arrival directions.

The adapter invalidates caches when the mode changes. On KD cache-generation
changes it re-encodes the grid and byte-compares it with the loaded snapshot;
the WASM snapshot and destination fields survive when the effective grid did
not change.

## Map-generation boundary and enemy selection

`KinkyDungeonCreateMap` is an around-adapter, not a native map generator. It
marks the duration of the exact upstream call so nested path queries remain in
JavaScript while KD repeatedly mutates the grid. The marker is depth-counted
and cleared in `finally`; ordinary gameplay path queries resume using WASM as
soon as generation returns or throws.

`KinkyDungeonGetEnemy` also stays in JavaScript because callers need the
original enemy-definition object and the scan reads mod-visible tags,
reputation, factions, and RNG. Its exact-signature adapter preserves upstream
iteration and weight order while hoisting only catalog invariants. Catalog and
perk-array identity, built-ins, faction helper, argument shapes, and bonus-tag
descriptors are checked before the optimized body starts. Unsupported calls
request the captured official function before consuming random state.

## Nearby-enemy lookup

Not every optimized system belongs across the WASM boundary. KD calls
`KDNearbyEnemies` around a thousand times during a crowded turn, and each call
must return the original JavaScript entity objects for downstream game and mod
code. A per-call binary bridge would erase the available gain.

The signature-gated AI adapter therefore uses a JavaScript dense index:

- the index is scoped to the identity of KD's `KDGetEnemyCache()` generation;
- each cell refers to the original entity object and results preserve KD's
  entity iteration order;
- small-radius queries scan integer cells instead of constructing string keys;
- large-radius queries keep the official linear-scan order;
- Euclidean, Chebyshev, hostility, and non-hostility behavior match KD 5.4.92,
  including its observable cached-branch quirk; and
- invalid state requests the captured official function for that call only.

`KDHostile` remains the official JavaScript function. The dispatcher still
owns hooks, legacy replacement detection, counters, enable/disable behavior,
and the exact upstream signature gate. Its `nativeCalls` counter means
"optimized adapter calls" for this system; it does not imply a WASM crossing.

## Implicit-master selection

`KinkyDungeonFindMaster` normally builds a nearby-enemy result and then checks
faction, rank, leader state, and distance. Crowded turns repeat that small query
for most enemies.

The optimized adapter fuses the cached radius-four traversal with selection.
It checks static rank and leader state first, so candidates that cannot
possibly qualify never pay for faction or hostility work. Eligible candidates
still use KD's exact helpers, cached-coordinate ordering, original objects, and
strictly-less distance tie behavior.

Reordering helper calls is safe only for the exact upstream functions. The
adapter therefore gates the target hash and the complete direct/transitive
flag, faction, hostility, rank, and distance dependency chain. Any changed
function, explicit master rule, led follower, unsupported map, or invalid cache
generation requests the captured official JavaScript function for that call.

## Nearest-player target selection

`KinkyDungeonNearestPlayer` evaluates nearby decoys for most active enemies.
The official order runs helpless, imprisonment, faction, and silence
classifiers before discovering that an ordinary candidate is not hostile.
That repeats expensive work for candidates that cannot be selected.

The optimization has two delivery forms. A normal portable mod uses the
signature-gated runtime adapter. The early installer applies the faster direct
source form only to the exact known KD bundle. A source marker tells the
bootstrap not to stack the runtime facade on top.

Both forms move hostility rejection ahead of those classifiers only for fully
unpacked entities whose current enemy definition is the canonical KD
definition. Under that guard they evaluate the canonical `KDHostile` and
`KDFactionHostile` decision directly, including rage, ceasefire,
player/allied state, special faction pairs, and dynamic faction relations. The
opinion term is exactly zero for the guarded non-player target. A `WeakMap`
remembers a proven definition identity, but every call still compares the
entity's current reference. Packed, player-like, custom, modified, or
noncanonical entities retain the exact upstream helper order. Coordinate-only
calls with no decoy preserve KD's small return-player branch without requiring
a fabricated enemy definition.

The source form captures every helper identity before mods load. If one is
replaced, that invocation runs the original filter order inside the same
function. If a mod replaces `KinkyDungeonNearestPlayer` itself, the modded
global wins because no facade is installed. The runtime form retains its
target-signature and dependency gates and calls the captured official function
when unsupported.

Both forms return KD's original entity objects and keep its
later-candidate-wins distance ties, visibility checks, path checks, jail-guard
rules, and flag writes. The installer additionally requires the exact original
and patched bundle hashes and stores the original bytes for uninstall.

## Helpless fast negative

`KDHelpless` normally unpacks an enemy and evaluates struggle threshold plus
binding effects even when an ordinary healthy, unbound NPC cannot be helpless.
The direct source patch returns `false` before that work only when the entity is
nonplayer, unpacked, above the low-health threshold, and has no positive bound
level.

Packed definitions deliberately stay on the original unpack/repack body so
their observable representation is preserved. Low-health, bound, and player
entities also stay on that body. The patch captures `KDUnPackEnemy`,
`KDPackEnemy`, and `KDNPCStruggleThreshMult`; replacing any of them disables
the shortcut for the call. Replacing the public `KDHelpless` global still wins
normally.

## Eligible-restraint tag scan

`KDGetRestraintsEligible` retains KD's outer restraint-catalog loop and every
eligibility, inventory, player-tag, variant, and group-power decision. For
canonical plain numeric tag tables, only its two inner weight loops are
inverted: the function checks the few keys declared by a restraint against the
active tag Map instead of checking every active tag against every restraint.

Definitions are captured lazily after KD finishes initializing. A replaced
table, custom definition, changed prototype, non-data property, changed tag
builder, altered `Map.get`/`keys`/`has`, or the developer disable flag selects
the original loop. This keeps unusual mod objects and helper instrumentation
observable without giving up the canonical catalog win.

## Path-cache suffix writer

`KDSetPathfindCache` stores every suffix of a completed path. KD's original loop
first slices the path at the current point, reads that point, then slices the
temporary again to produce the stored suffix. The source fast path reads the
point from the original array and creates only the stored `slice(i + 1)`.
It also builds the constant destination/tile part of each cache key once per
call instead of once per stored suffix.

The guard captures `Array.prototype.slice` and accepts only plain arrays whose
instance method is still that captured function. Array subclasses, changed
instance methods, a changed prototype method, or the developer disable switch
run the original two-slice loop. The final-index copy remains outside the
branch and is unchanged. The key-suffix hoist has a separate primitive-only
guard: boxed or otherwise non-primitive destination/tile values keep KD's
original repeated conversion order even when the one-slice path is available.

## JavaScript pathfinding search loop

Map generation deliberately stays on KD's JavaScript pathfinder, but its hot
path has six guarded source optimizations. Top-level cache hits read the stored
path once. The search loop inserts each successor directly instead of
allocating a temporary eight-entry `Map`, scans `open.values()` without a
callback, builds the current-node cache key once outside the neighbor loop,
tests the closed successor entry before the open entry, and defers tile metadata
until after endpoint, cache, and impassable-terrain short-circuits. Metadata is
still resolved before the original lock and weight logic that consumes it.

These paths require the captured canonical `Map` constructor and relevant
`get`, `has`, `delete`, `set`, `forEach`, `values`, and iterator methods. A mod
replacement selects the corresponding original source route. Independent
developer switches restore repeated top-cache reads, the temporary successor
map, callback iteration, repeated cache key, open-first lookup, or eager tile
metadata for live compatibility and performance checks. The metadata reorder
also requires the captured tile helper and `String.prototype.includes`, a
primitive tile selector, and no light requirement.

## Map-generation pathfinding fallback scope

The map-generation adapter already runs the captured official generator inside
a completed-JavaScript transaction. During that exact call, the dispatcher can
route the verified `KinkyDungeonFindPath` facade directly to its captured
official JavaScript function. The global remains the same facade, so identity
checks and later reconciliation still see the installed runtime surface.

The scope activates only while the pathfinding entry is in native mode, has no
legacy replacement, still owns the global, and has no public hook for the
pathfinding system. A replacement, disable request, or hook registration clears
an active route immediately. Calls still count as JavaScript fallbacks; their
diagnostic counters are batched and flushed at scope exit or on any status
read. Nested scopes and exceptions restore the previous route in `finally`.
Outside official map generation, pathfinding follows the normal adapter and
native-planner decisions.

## Enemy-update position cache

`KDMoveEntity` normally marks the complete enemy cache dirty after movement.
The next position lookup rebuilds KD's position, ID, and event maps over every
entity. Crowded updates can repeat that full pass many times even though an
ordinary move changed only two coordinate keys.

The movement around-adapter gives each `KinkyDungeonUpdateEnemies` invocation
one fresh position `Map`. Safe moves update their old and new keys in place.
Transient overlaps rebuild only those two keys from entity order, preserving
KD's last-entity-wins map semantics. Every accepted move advances
`__KDHybridEnemyCacheGeneration`; the nearby and implicit-master dense indices
therefore cannot reuse stale coordinates even though the working `Map`
identity stays stable.

The same generation transition records the two affected cells in a bounded
`WeakMap` journal. When a dense adapter still has the same cache and map
dimensions, and the journal contains every generation since its last query,
it rereads only those cells from the authoritative working cache. A missing
generation, malformed coordinate, oversized change set, replaced cache, or
changed map size uses the existing full dense-index rebuild. Transient overlap
repairs use the same two-cell path because the journal records final cache
contents rather than assuming which entity won the overlap.

The position map is only a transaction-local optimization. The adapter marks
KD's cache dirty after any optimized movement so the next lookup outside the
batch regenerates the official position, ID, and event maps together. It runs
the captured update through the completed-JavaScript marker, which prevents an
exception from replaying a partially executed enemy turn.

The batch is exact-signature and identity gated. Active `enemyMove` events,
mod-added handler tables, bullets, destination effect callbacks, structural
entity changes, cache replacement, nested updates, and a replaced
`KDMoveEntity` all take conservative paths. An unsafe individual move has
already run officially, so the adapter arms a full rebuild instead of trying
the move twice.

## Commander rescue proof

`KDCommanderUpdateRoles` asks every unassigned enemy to run every commander
order filter. In a crowded map, `helpStruggle` and `helpDanger` can traverse the
same entities even when no bound or endangered disabled target exists.

The commander adapter wraps the captured upstream role pass. A conservative
map-wide proof checks only target-side requirements. If a category is empty,
its filter is known to return false and can be skipped. If any possible target
exists, the original filter runs unchanged. Known mutators and
`KinkyDungeonSendEvent` mark the proof dirty, so a later enemy rescans after a
synchronous game or mod callback.

This around-adapter is gated by the role function hash, a composite fingerprint
of every built-in commander order, and exact classifier hashes. If a mod
changes that surface, the dispatcher calls the captured/modded JavaScript
implementation for that invocation. Around-adapters mark an upstream call as
already completed so an upstream exception is rethrown once rather than
accidentally replaying a partially completed role pass.

## Assets

The asset controller tracks logical assets separately from atlas pages. It
deduplicates concurrent page loads, reference-counts active pages, retains
last-use timestamps, and evicts only unreferenced pages. The adaptive controller
selects High, Balanced, or Performance quality from resolution, memory, and
measured frame cadence.

Normal-game texture integration is intentionally narrower. The bootstrap's
`texture-policy.ts` uses the exact KD/game-bundle/Pixi compatibility triple to
select KD's own full or mobile startup atlas, then restores the original
`Storage.getItem` descriptor after KD's two synchronous toggle reads. It never
writes the saved toggle, wraps `PIXI.Assets.load`, changes displacement links,
or evicts live Pixi resources. Its memory sampler walks the existing Pixi/KD
caches read-only and deduplicates by base-texture identity. `rendering.ts` is a
thin integration adapter for that policy and `frame-pacing.ts`.

The frame pacer is also deliberately TypeScript at the Pixi boundary. On the
exact KD 5.4.92 bundle and Pixi 7.2.1, it preserves the original renderer
property descriptor, then intercepts only calls whose display object is the
current `PIXIapp.stage`. Input/focus activity renders every request; idle,
unfocused, and hidden profiles use deadline-based 60, 30, and 10 FPS ceilings.
The deadline advances from its scheduled time rather than the last physical
render, so a 144 Hz request stream averages 60 FPS instead of quantizing down
to 48 FPS. Calls for render textures or any other display object bypass pacing
and retain the original receiver, arguments, return value, and exception
behavior.

The pacer fails closed on unknown game, bundle, or Pixi versions. It also
exposes a live disable switch and detects a later renderer replacement.
Disposal restores the exact prior property shape when the pacer still owns the
slot and never overwrites a later mod wrapper. Browser storage, Pixi
inspection, and frame submission stay in TypeScript because a WASM round trip
would only add overhead at those boundaries, while repeated compute stays a
Rust/WASM concern.

## Release gate

Public releases require parity fixtures for all systems marked migrated,
fallback coverage for legacy replacements, save import/export round trips, and
performance results on at least one integrated and one discrete GPU.
