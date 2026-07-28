# Compatibility

## Upstream detection

Detection is structural and data-driven. A release catalog may include the
upstream bundle hash, function name, arity, normalized-source hash, sentinel
tokens, and a side-effect-free probe. Exactly one candidate must match.
Unknown or ambiguous candidates remain on official JavaScript.

The initial adapter catalog targets upstream game version 5.4.92 and records
metadata and hashes. The repository does not vendor the upstream tree; it
contains one small, reviewable source diff against the exact public commit.
Files implementing behavior adapted from the upstream game are separately
marked MPL-2.0.

`upstreamVersion` means the in-game `KDVersionStr` value. The inspected build
reports 5.4.92 there, while Electron's `resources/app/package.json` reports
package version 5.1.12. KD Hybrid records both values and uses the bundle hash
and function signature as the executable compatibility gates.

## Legacy JavaScript mods

The host supports existing `.js` and `.ks` mods. It does not replace the
upstream loader or evaluate mod code itself.

| Mod behavior | Result |
| --- | --- |
| Registers normal KD events | Events are applied through JS and remain visible |
| Reads globals after a turn | Host commits WASM results first |
| Replaces a migrated global | Only that native system falls back to JS |
| Uses unsupported arguments on a migrated global | That call alone falls back to JS |
| Replaces Pixi/DOM rendering | Simulation can remain native |
| Uses network or Electron APIs | Unchanged; governed by upstream Electron |
| Replaces `KinkyDungeonNearestPlayer` | The replacement wins; the source build does not stack a facade on top |
| Replaces `KDHelpless` | The replacement wins; callers continue to see the public global |
| Replaces `KDUnPackEnemy`, `KDPackEnemy`, or `KDNPCStruggleThreshMult` | The helpless shortcut uses the complete upstream body for that call |
| Applies eventful buffs through `KinkyDungeonApplyBuffToEntity` or `KDApplyBuff` | The source index sees the new trigger immediately |
| Writes directly to an existing `.buffs` object during a tick | Call `KDHybridInvalidateBuffEventIndex()` after the write for immediate visibility; the next tick also rebuilds automatically |
| Replaces either standard buff-application helper | Buff-event dispatch falls back to the complete upstream scan |
| Wraps `KinkyDungeonStatsChoice.get`, replaces selector dependencies, or supplies dynamic bonus tags | `KinkyDungeonGetEnemy` uses the complete official selector before consuming RNG |
| Replaces eligible-restraint tag tables, changes their prototype, adds custom restraints, or wraps Map helpers | `KDGetRestraintsEligible` keeps the original active-tag loop for those definitions or that call |
| Passes an array subclass to `KDSetPathfindCache`, overrides that array's `slice`, or replaces `Array.prototype.slice` | The source build uses KD's original two-slice cache loop for that call |
| Passes boxed or non-primitive destination/tile values to `KDSetPathfindCache` | The source build preserves KD's repeated per-suffix conversions for that call |
| Depends on exact function source text | Unsupported; use the portable mod or install with `-NoSourceOptimizations` |

The alpha currently relies on these runtime gates and the public buff
invalidator. The planned pre-load warnings, compatibility choices, remembered
decisions, and mod-options reset controls are a required stable-release cleanup
described in
[COMPATIBILITY_CLEANUP.md](COMPATIBILITY_CLEANUP.md).

Initial facade candidates from 5.4.92 include
`KinkyDungeonCreateMap`, `KinkyDungeonGetEnemy`,
`KinkyDungeonAdvanceTime`,
`KinkyDungeonEnemyLoop`, `KinkyDungeonEnemyTryMove`,
`KinkyDungeonEnemyTryAttack`, `KinkyDungeonMove`,
`KinkyDungeonMoveTo`, `KinkyDungeonUpdateEnemies`,
`KinkyDungeonFindPath`, `KinkyDungeonGetPath`,
`KinkyDungeonGetBuffedStat`, `KinkyDungeonDamageEnemy`,
`KinkyDungeonAttackEnemy`, and `KinkyDungeonSendEvent`.

## Current integrated adapters

Version 0.1 enables `KinkyDungeonFindPath`, `KinkyDungeonGetEnemy`,
`KDNearbyEnemies`,
`KDCommanderUpdateRoles`, and `KinkyDungeonFindMaster`, plus the enemy-update
position-cache adapter on `KinkyDungeonUpdateEnemies`, only when their exact
5.4.92 normalized source signatures match. `KinkyDungeonNearestPlayer` uses
the same runtime adapter in the portable mod, or a direct source form when the
early installer recognizes and patches the exact bundle.

Static map searches reuse one encoded snapshot for a KD path-cache generation.
Exact suffix-cache hits return directly, the first full search uses the
weighted native query, and cache-assisted misses use KD's official
suffix-splicing search. Enemy-aware searches, custom heuristics, long-distance
trimming, pass-through-enemy rules, and leash-target rules use the captured
official JavaScript function for that call.

During the exact upstream `KinkyDungeonCreateMap` call, path queries stay on
KD's official JavaScript path. Generation mutates the grid repeatedly, so
encoding every transient version for WASM was both slower and capable of
changing KD's seeded tie choices. A `finally`-guarded depth marker confines
that fallback to map generation.

The enemy selector remains in JavaScript because it returns original catalog
objects and repeatedly consults mod-visible data. Its guarded adapter preserves
catalog iteration, weight accumulation, and RNG order while hoisting only
values invariant across the catalog scan. Exact selector and dependency
signatures, ordinary collection shapes, and untouched built-ins are required;
otherwise only that call uses the captured official selector.

The direct source patch also shortens the two enemy-tag loops inside
`KDGetRestraintsEligible`. Canonical plain numeric tag tables iterate their own
small key sets; replaced/custom tables, changed prototypes, a replaced tag
builder, altered Map helpers, or the public disable switch run the exact
original active-tag loop. Catalog order, result order, upstream object identity,
variant identity, and weights remain JavaScript-visible and unchanged.

The source path-cache writer removes a temporary prefix allocation only for
plain arrays using the captured canonical `Array.prototype.slice`. Array
subclasses and either instance-level or global `slice` replacements take the
original body. Both branches keep key insertion order, suffix point identity,
and the final-index copy unchanged. Primitive destination and tile values also
reuse one key suffix; boxed or custom values preserve the original conversion
order.

KD's JavaScript pathfinder uses guarded direct successor insertion, direct
`open.values()` iteration, a per-node cache key, and closed-first successor
lookups. Replacing the `Map` constructor or any captured method disables the
affected shortcut. The closed-first path is only an order change to the same
open/closed score conjunction; the open-first developer control remains
available for exact A/B checks. Top-level cache hits also reuse one fetched
array only while the constructor, prototype, `get`, `has`, `delete`, and cache
instance methods remain canonical; a delegating method replacement takes KD's
original repeated reads.

Tile metadata inside the search loop is deferred only for primitive tile
selectors with no light requirement while `KinkyDungeonTilesGet` and
`String.prototype.includes` retain their captured identities. Endpoint, cached,
and impassable neighbors do not consume metadata; every candidate reaching the
lock and weighting rules resolves it before those rules run. A helper or
built-in replacement, a light-sensitive call, a non-primitive selector, or the
developer disable switch keeps KD's original eager lookup order.

While the captured official map generator runs, its verified pathfinding
facade may call the captured official JavaScript pathfinder directly instead of
requesting the same fallback through the full dispatcher on every query. The
facade itself stays installed and all call/fallback counters remain exact.
Any legacy global replacement, disabled pathfinding system, or registered
public pathfinding hook selects the full dispatcher before the generator
starts. Registering a hook or disabling the system during the scope clears the
direct route immediately. The developer control
`KDHybridRuntimeControl.disableMapGenerationPathfindingDirectFallback` forces
the full dispatcher, while
`mapGenerationPathfindingDirectFallbackStats` records optimized versus fallback
maps for isolated A/B checks.

Nearby-enemy queries use a JavaScript dense index while retaining original
entity objects and official hostility calls. The commander adapter skips the
two rescue filters only after a conservative scan proves there is no possible
target. It additionally fingerprints the complete built-in order table and its
classifier dependencies. A replaced or added commander order falls back for
that call. Event handlers remain supported; events and known mutators
invalidate the proof before the next filter.

The implicit-master adapter fuses the cached radius-four lookup with rank
selection and rejects impossible rank/leader candidates before faction and
hostility work. Its complete direct and transitive dependency set is
signature-checked and identity-checked. Explicit master rules, led followers,
small maps, invalid cache generations, and changed dependencies use the
captured official function for that call.

The nearest-player optimization rejects canonical nonhostile candidates before
running KD's helpless, imprisonment, and silence classifiers. For that exact
canonical shape it fuses KD's hostility and faction-hostility decision,
including dynamic faction relations. It rechecks each entity's current
enemy-definition identity and keeps the exact upstream helper order for
packed, player-like, custom, or noncanonical entities.

In the runtime form, the target and every reordered or fused helper are
signature- and identity-gated; a changed dependency or unsupported argument
shape uses the captured official function for that call. In the source form,
every dependency identity is captured and rechecked inside the function; a
change selects the original filter order. A source marker prevents duplicate
runtime wrapping. The source transformation itself is accepted only between
the documented input and output SHA-256 hashes.

The direct `KDHelpless` shortcut applies only to healthy, unbound, unpacked
nonplayer entities. Low-health, bound, packed, and player entities use the
complete original body. The shortcut captures the unpack, pack, and struggle
threshold helpers and checks their identities before returning early. Setting
`KDHybridSourcePatchControl.disableHelplessFastNegative` also restores the
original body, while `helplessFastNegativeStats` can collect isolated-test
diagnostics.

The source build also keeps an adaptive set of active buff-event trigger names.
The first relevant dispatch in a tick uses the full upstream scan; if another
negative trigger arrives, the set is built and later negative dispatches can
return without walking the player and every entity. A positive trigger always
uses the full upstream order, so player handlers still run before entity
handlers. A new tick, player-buff-object change, entity-array change, entity
count change, public invalidation call, or eventful standard API application
invalidates or updates the set conservatively.

The buff-event shortcut captures the original `KinkyDungeonApplyBuffToEntity`
and `KDApplyBuff` helpers. Replacing either helper, setting
`KDHybridSourcePatchControl.disableBuffEventIndex`, or calling the public
invalidator selects the upstream scan until the index is safe again. The
optional `KDHybridSourcePatchControl.buffEventIndexStats` object is intended
for isolated diagnostics, not normal mod logic.

The enemy-update adapter keeps one working position map during a safe
`KinkyDungeonUpdateEnemies` call and advances an explicit generation after
each move. It still uses KD's official `KDMoveEntity`, retains entity iteration
and overlap semantics, and records a bounded journal of the affected cells.
Nearby and implicit-master dense indices apply that journal only when it covers
every generation since their last query; a gap, invalid coordinate, large
change set, replaced cache, or changed dimensions performs the normal full
index rebuild. The adapter arms KD's official full cache rebuild when the
batch ends. Its update function and movement/cache/event dependencies are
signature- and identity-gated. Active `enemyMove` events fall back for the
complete update. Bullets, destination effect callbacks, structural changes,
or cache replacement keep affected moves on the official dirty-cache path.
The adapter never replays a move or an update that already ran.

The remaining facade entries are compatibility metadata and roadmap targets;
they are not presented as completed KD migrations.

## Texture startup policy

Texture selection has its own stricter gate because it runs before KD's normal
loader has finished. The policy requires game version 5.4.92, the official
`out/main.js` SHA-256, and Pixi 7.2.1. Any mismatch keeps KD's original saved
selection and does not install a storage hook. Missing/inaccessible storage,
malformed `KDToggles`, an unavailable method descriptor, a timeout, or a
changed method owner also fails closed and records a diagnostic reason.

For a compatible explicit mode, the bootstrap returns a synthetic toggle only
for KD's two synchronous startup reads, restores the exact prior descriptor,
and leaves the stored bytes unchanged. A later wrapper is never overwritten.
The policy does not intercept Pixi's loader, unload resources, change atlas
aliases, or alter mod asset paths. `original` is the compatibility escape
hatch; `full` and `mobile` use KD's official atlas choices.

## Public SDK

The runtime publishes `globalThis.KDHybrid` with:

- `version` and `abiVersion`;
- `status()` and `systemStatus()`;
- `registerHook()` and `unregisterHook()`; hook contexts include the exact
  `globalName` when a system has multiple facades;
- `dispatch()` and `query()`;
- `enableSystem()` and `disableSystem()`;
- `registerWasmPlugin()`; and
- `exportDiagnostics()`.

SDK additions are backward compatible within a major version. Native protocol
or plugin ABI changes require an ABI bump.

The exact hook behavior, ABI-1 memory contract, manifest limits, current
capability boundary, and executable JavaScript/Rust examples are documented in
[Mod SDK](MOD_SDK.md).

## Capability WASM plugins

A plugin declares an ABI, systems, capabilities, and maximum memory pages.
Available capability names are read-state, propose-actions, receive-events,
path-query, diagnostics, and deterministic-random. Capability callbacks are
not wired into the public 0.1.0 runtime yet; unavailable imports are rejected.
Pure ABI-1 plugins work now. Plugins do not receive WASI, filesystem, network,
DOM, Pixi, Electron, or separate writable core memory.
