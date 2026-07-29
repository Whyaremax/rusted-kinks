# Roadmap

The goal is not “rewrite every file in Rust because Rust is cool.” The goal is
to move work that is actually expensive, prove that the result behaves
correctly, and leave the JavaScript/mod boundary usable.

Each slice earns its way onto `main` with compatibility tests, fallback
coverage, and a before/after measurement.

## At a glance

| Area                          | Status                                                                                                                                                                                        | What moves it forward                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Bootstrap and patching        | Alpha, working on KD 5.4.92                                                                                                                                                                   | More install/upgrade coverage and public packages                                            |
| Pathfinding                   | First adapter enabled                                                                                                                                                                         | Longer real-map and mod-heavy sessions                                                       |
| Crowded-turn AI               | Seven local slices accepted across crowded and hostile-combat gates                                                                                                                           | More exact-state wins inside the remaining turn hotspots                                     |
| Movement, combat, and status  | First cache batch, combat fixture, helpless fast negative, and negative buff-event index accepted; damage-WASM and status-tick batches measured and rejected                                  | Remaining enemy-loop work, a genuinely coherent event/RNG batch, or another measured hotspot |
| Map generation and world work | Transient-path guard, selector hoists, restraint-tag scan, path-cache suffix writer, bounded restraint-query reuse, and a cross-session seed contract accepted; prison escort fixture working | The next measured world hotspot                                                              |
| Remote testing and cache      | Byte resume, reconnect-aware Cache Storage, storage guard, stable token, and real Chrome, Edge, and Firefox gates work locally                                                                | Mobile coverage and private-tunnel UX                                                        |
| Assets and startup            | Official mobile-atlas policy, texture-memory reporting, and startup/visual gates accepted locally                                                                                             | Persistent asset cache, audio policy, and safe room-scoped lazy loading                      |
| Mod SDK                       | ABI-1 contract, JavaScript/Rust examples, compatibility gate, and privacy-safe loaded-plugin diagnostics exist                                                                                | Host capability callbacks, packaging, and fallback attribution                               |
| Stable release                | Not there yet                                                                                                                                                                                 | Clean installs, long sessions, upgrades, and painless uninstall                              |

“Queued” does not mean forgotten. It means profiling has not earned that code a
trip across the JavaScript/WASM boundary yet.

## The route from alpha to stable

This is the working order. If the profiler finds a hotter bottleneck, it gets
to cut the line.

| Milestone              | Main result                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Foundation             | Reversible install, exact version gates, safe fallback, and isolated tests          |
| Crowded turns          | Movement and common AI queries stop repeating avoidable map-wide work               |
| Combat and status      | Damage, healing, buffs, events, and RNG cross the boundary in useful batches        |
| World                  | Map generation, capture, escort, prison, and long-run fixtures become repeatable    |
| Assets and remote play | Startup improves and slow clients keep what they already downloaded                 |
| Mod SDK                | JavaScript hooks and optional WASM plugins have a documented compatibility contract |
| Stable release         | Windows and Linux packages install, upgrade, diagnose, and uninstall cleanly        |

The point is to finish usable layers. A half-rewritten game is less interesting
than a hybrid build that can be installed today and improved one hot path at a
time.

## Now: foundation, pathfinding, and crowded turns

The foundation is in place:

- deterministic Rust core and WebAssembly bridge;
- versioned binary protocol and snapshot format;
- spatial index and reusable pathfinding workspace;
- signature-gated JavaScript adapter with per-call fallback;
- a generation-only pathfinding guard, guarded enemy-catalog selector hoists,
  eligible-restraint tag-loop inversion, and a guarded single-slice path-cache
  writer with exact same-process layout gates;
- generation-scoped dense nearby-enemy lookup;
- fused rank-first implicit-master lookup;
- guarded nearest-player lookup with a fused canonical hostility decision,
  now running directly in the exact KD source build instead of through a
  runtime facade;
- adaptive negative buff-event dispatch that skips repeated empty player and
  entity scans after a conservative same-tick warm-up;
- a packed-safe healthy-NPC fast negative in `KDHelpless`, with exact slow-path
  and helper-replacement fallbacks;
- batched enemy-movement position-cache maintenance with exact fallbacks;
- incremental dense-index cell patches from a bounded movement journal;
- reversible patchers and installation manifests;
- isolated save-safe Electron test installation; and
- automated real-game pathfinding, crowded-turn, hostile-combat, and
  prison-escort coverage.

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

The seven crowded-turn slices now optimize `KDNearbyEnemies`, the
commander's empty rescue searches, implicit master selection, and
`KinkyDungeonNearestPlayer`, then keep KD's position cache live across safe
ordinary moves inside `KinkyDungeonUpdateEnemies`. The sixth slice applies
those moves to the nearby/master dense indices through an exact cell journal,
removing another repeated map-wide rebuild. The seventh avoids the jail-key
location scan when the map already has its maximum keyrings. They keep original
entity objects, use exact JavaScript fallbacks for changed dependencies, and
preserve upstream helper order for packed or custom entities. The commander
proof now has a 16-refresh ceiling: high mutation churn switches the rest of
that batch to KD's exact rescue filters. On the same exported crowded fixture
used by the previous bundle, the integrated gate reduced the median three-turn
trace from 53.60 ms to 29.20 ms. All 20 paired samples favored the optimized
path; their median paired speedup was 1.846x.

The nearest-player slice has now crossed the source boundary without becoming
a fork of the game. A conventional source diff targets the exact public KD
commit, while the installers consume a generated, byte-exact bundle diff only
between known input and output hashes. Packed/custom/modded calls keep the
original helper order. Its focused 20-pair gates
measured 1.058x in combat, 1.156x in the crowded room, and 1.249x in prison,
with every final state exact. The direct source form also beat the older
runtime-handler candidate in all 20 head-to-head pairs. Both installers back up
and restore the original bundle, and the small conventional diff ships with
the MPL-marked source instead of re-hosting KD.

The second source slice targets repeated buff-event misses. It waits until the
second relevant event in a tick, builds a set of active trigger names, and
keeps positive events on KD's original player-before-entity handler path. Its
20-pair hostile-combat gate measured 31.30 ms officially and 26.90 ms with the
index, a 1.163x paired-median speedup with every pair faster and exact. Prison
was slightly positive and the crowded fixture was neutral. Standard buff API
calls are tracked, direct same-tick mod writes have a public invalidator, and
changed dependencies or the explicit control switch restore the full scan.

The third source slice targets the global `KDHelpless` body after a longer
profile showed 3.54 ms of self-time over ten hostile-combat turns. Healthy,
unbound, unpacked NPCs return false before unpacking and binding-effect work;
injured, bound, packed, player, or helper-modified inputs retain the original
body. Final 20-pair gates improved the ratio of medians by 5.45% in combat,
2.95% in the crowded room, and 2.10% in prison. Every paired state matched,
and the compatibility gate exercised packed representation, all three captured
helper replacements, the disable switch, and a public function replacement.

The hostile-combat gate clusters 120 real Maidforce entities split between the
`Enemy` and `Rage` factions, guaranteeing hostile neighbors and actual attack
and damage calls. It caught a 0.81x to 0.86x regression in the unbounded
commander proof. With the refresh ceiling, 20 three-turn pairs measured
36.60 ms officially and 31.10 ms optimized, a 1.170x paired-median speedup
with 20 exact final states and 19 optimized pairs faster.

The same seven slices now have a second gate in KD's real prison state. It
enters the Maidforce prison transition, keeps the jail guard's escort intent
and player tether, and runs 120 enemies from a restorable save. Across 20
three-turn pairs, the official path measured 63.10 ms and the optimized path
36.30 ms. All 20 pairs favored the optimized path, their median paired speedup
was 1.709x, and every final state matched. The fixture also restores KD's
non-serialized blindness counters and load-mutated temporary enemy flags, so
save/load noise cannot fake a result. A prison-only
`KDPointWanderable` memo looked attractive after 1,833 repeated calls appeared
in one profile, but its paired probe measured 0.909x and stays out.

Several tempting follow-ups have already failed the same gate. Simple
per-call master caches, an unfused rank-neutral master scan, a cache-heavy
nearest-player rewrite, hostility-cache, hostility-inline, and
dynamic-occupancy prototypes were exact on the fixture but either noisy or
slower. They stay out of the runtime. The accepted nearest-player slice instead
changes only the order of proven-pure rejection checks for canonical active
entities and fuses the canonical hostility decision under the same dependency
gate. A commander-scoped faction/hostility map also measured 0.941x despite
thousands of hits. Dense occupancy, direct flag inlining, top-level event
skipping, and per-turn inventory snapshots measured 0.848x, 0.786x, 0.868x,
and 0.992x respectively. Later jail-guard, faction, direct-hostility, commander
key-list, and fused movement-occupancy micro-optimizations measured 0.989x,
0.959x, 0.976x, 0.994x, and 0.974x. Fusing
`KinkyDungeonEnemyCanMove` measured 0.988x, while cloning the entire cache
after each move managed only 1.005x and improved four of seven pairs. The
broader one-map-per-update batch did clear the gate, which is the useful lesson:
this hot loop is saturated for helper inlining, but removing repeated map-wide
work still pays. Extending that batch with a complete cell-change journal then
removed about 6.9% from the already-optimized turn on a matched 20-pair control.
The probes and results remain available so a later design has to beat them
instead of rediscovering them.

The latest source probes rejected several smaller ideas while accepting the
global helpless boundary. The earlier nearest-player-only helpless inline
measured 0.990x; moving the shortcut into the direct global source body removed
enough repeated work to clear all three fixtures. Safe `KDBoundEffects`,
opinion-ID, one-lookup entity ID, faction-reuse, and LOS-distance prototypes
were exact but neutral or slower, so they remain profiler-only evidence rather
than production complexity.

## Next: more turn work that costs real time

The next native candidates are the parts repeatedly exercised during crowded
and hostile-combat turns:

- deeper movement decisions beyond the accepted position-cache batch;
- the remaining work inside `KinkyDungeonUpdateEnemies` and
  `KinkyDungeonEnemyLoop`;
- the remaining commander order-maintenance work, using the same explicit
  mutation boundary as the accepted rescue-target proof;
- combat arithmetic and batched damage/healing results;
- positive buff dispatch, buff ticking, and expiration;
- event batching across the WASM boundary; and
- deterministic RNG streams that can be compared with fixtures.

These should land one system at a time. A partially migrated turn with a clean
fallback is more useful than a giant rewrite nobody can debug.

The combat fixture gives that list a useful order. Its three-turn audit
observed 341 enemy attack attempts, 155 damage calls, 12,666 buffed-stat reads,
and 363 enemy buff applications. A pure damage-arithmetic WASM probe matched
all 465 outputs, but the honest per-transaction boundary ran at 0.092x and even
an unintegrable single-call upper bound managed only 0.685x. That boundary is
rejected and removed.

The larger status-tick follow-up is now measured too. A sole inert-buff
shortcut reached only 1.025x with 14 of 20 pairs faster; two general
single-entry loops and a transaction-scoped `KinkyDungeonUpdateBuffs` batch
were slightly slower. All state, mod-handler, dynamic replacement, and restore
gates passed, so this is a performance rejection rather than a correctness
failure. The next turn candidate should come from the remaining
`KinkyDungeonUpdateEnemies`/`KinkyDungeonEnemyLoop` self time or a truly
coherent event/RNG transaction, not another per-buff rewrite. A whole-turn
stat cache would be faster to write but much harder to make honest around mod
callbacks.

The first remaining enemy-update source shortcut was also rejected. Making
KD's per-enemy debug timestamps conditional skipped 1,854 clock reads in the
ten-turn fixture, but the guarded paired median was only 1.013x and a clean
candidate/control/candidate source swap was mixed, with the candidate means
0.92% slower overall. The exact upstream source is restored. The next attempt
should remove a coherent branch or scan from `KinkyDungeonEnemyLoop`, or own a
whole event/RNG transaction; another one-line helper or timer rewrite is too
small for this function.

The first coherent enemy-loop scan also failed the cross-workload gate. Reusing
one LOS path result removed 2,609 repeated traversals in ten turns and saved
1.19% on the compact combat fixture, but it made the second 120-enemy fixture
4.32% slower. Exact behavior and replacement fallback both held; the workload
reversal, not correctness, rejected it. The remaining event/RNG boundary did
not justify another product candidate: family-aware dispatch had already
measured 0.868x guarded and 0.806x unchecked, while `KDRandom` was absent from
the current hostile-turn CPU sample and only 0.102% of the heavy map-generation
sample. This turn profile is saturated until a new workload identifies a
larger transaction.

## After that: more world work

- remaining map-generation helpers and room queries beyond the accepted
  transient-path and enemy-selector slices;
- navigation fields shared by groups of NPCs;
- more prison/capture routes beyond the accepted Maidforce escort fixture;
- extend the accepted cross-session SHA-256 seed contract to more rooms,
  floors, and mod sets;
- snapshot deltas instead of full-state re-encoding; and
- profiling tools that show whether time was spent in JavaScript, WASM, the
  bridge, rendering, or mods.

Exact byte-for-byte parity is not required when two algorithms may choose
different valid routes or layouts, but gameplay rules, reachability, costs, and
seed contracts need explicit tests. The first strict gate now compares 12
seeded maps across separate Electron renderer sessions, checks 144 contract
fields with zero mismatch, and refuses same-session reports by default.

## Assets and startup

Rendering is not automatically fixed by rewriting simulation code. The asset
track is separate. The repository already has an adaptive asset-manager
skeleton, and the isolated remote server already fingerprints the test build,
warms its browser assets, and gives unchanged files long-lived cache rules.
The normal game still needs the deeper work:

- deduplicate concurrent downloads;
- cache assets locally after the first successful fetch;
- lazy-load large atlases and audio;
- track decoded texture memory;
- use frame cadence and memory pressure to select a quality tier; and
- measure startup-to-menu and first-room readiness.

The first normal-game texture slice is now accepted locally. On the exact
KD 5.4.92 bundle and Pixi 7.2.1, the balanced/automatic tier selects KD's own
mobile atlases for startup while `full` and `original` remain explicit escape
hatches. The policy only changes the two startup reads of `KDToggles`, restores
the original storage descriptor immediately, never writes the saved toggle,
and fails closed on an unknown bundle, game version, Pixi version, malformed
toggle JSON, or unavailable storage descriptor. It does not replace
`PIXI.Assets.load`, synthesize loader results, unload live textures, or
partially load the displacement atlas.

The official-atlas verifier matched all 6,634 frame names across the six
full/mobile families and found every linked page. The mobile pages reduce the
atlas-only decoded estimate from 1,118,932,192 to 289,009,516 bytes. In the
matched live Intro scene, total decoded texture memory fell from 1,403,273,064
to 573,350,388 bytes and game-renderer private memory fell from 1,700,519,936
to 847,880,192 bytes. Warm first-interactive time improved from 6,019.9 to
4,988.1 ms; both modes retained 120 FPS, 8.5 ms p99, zero frames over 16.7 ms,
and the same frozen-frame PNG hash. A deterministic eight-enemy combat room
retained exact paired state parity; a separate 100-turn lifecycle run
completed with the same paired checks exact and no texture-policy error.

This closes official atlas selection, decoded-memory reporting, and the first
startup/visual gate. Concurrent download deduplication, a persistent asset
cache, audio policy, and safe room-scoped lazy loading remain future slices.

Visual changes need screenshot/reference testing so “optimized” does not quietly
mean “blurry or missing.”

## Remote testing

Remote testing is useful now, not just a future checkbox:

- the server listens on a chosen interface and port;
- `--lan` provides the common all-IPv4 bind, and `--token-file` creates or
  reloads a stable private access token;
- tokenized entry becomes an HTTP-only browser cookie;
- normal Electron saves are never served;
- the first visit warms the browser-useful asset set;
- versioned ETags revalidate changed files without redownloading everything;
- interrupted byte-range transfers are reconstructed exactly, stale validators
  force a complete response, and secure Cache Storage warms continue from files
  already committed to the current version;
- secure Cache Storage warms check the browser's advisory free-space estimate
  before downloading missing files and keep partial progress on a low-space
  stop; and
- trusted HTTPS origins can use Cache Storage and a cache-first service worker;
  and
- disposable-profile Chrome, Edge, and Firefox gates prove real service-worker
  registration, a complete Cache Storage warm, and an all-files resume.

Next comes the mobile-browser matrix. It is a personal test tool, not a mirror
for redistributing the game.

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

The ABI-1 memory contract, strict manifest validation, read-only JavaScript
hook example, dependency-free Rust plugin, and `npm run test:mod-sdk` gate now
cover the manifest, ABI, example, and compatibility-suite foundations. Loaded
WASM plugins also appear in diagnostic exports under a privacy-hashed identity
with their version, declared capabilities, and systems; disposal removes that
entry. The next SDK slice is wiring explicit host callbacks without granting
filesystem, network, DOM, Electron, or mutable core-memory access, then
attributing individual fallbacks to the responsible mod.

## Release and distribution

A stable release needs:

- a signed or checksum-verifiable Windows manager;
- Linux x86_64 and ARM64 packages;
- install, status, configure, and uninstall flows tested on clean copies;
- the user-facing mod preflight, fallback choices, and remembered-decision
  controls;
- no game binaries, assets, or saves in the repository or release;
- MPL source and notices shipped beside adapted files;
- an upgrade path between KD Hybrid versions; and
- a clear compatibility table for supported Kinky Dungeon builds.

## Release gates

| Slice             | What must be true before it is enabled by default                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Pathfinding       | Valid paths, equal reachability, argument/fallback coverage, and a repeatable speedup                                          |
| Movement and AI   | Event and function-replacement mods pass; no turn-order drift                                                                  |
| Combat and status | Deterministic fixtures and save round trips pass                                                                               |
| World             | Seed contracts and room/gameplay invariants pass                                                                               |
| Assets            | Visual references pass and memory/startup measurements improve                                                                 |
| Mod preflight     | Risky buff/cache/source access is detected conservatively; compatibility, force-load, disable, remember, and forget flows pass |
| Stable            | Known builds pass long-session tests and every installed change can be cleanly removed                                         |

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
