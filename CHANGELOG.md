# Changelog

## Unreleased

- Consolidated the final accepted KD 5.4.92 source work as patch v6. The
  release carries a human-readable TypeScript diff plus the exact,
  input/output-hash-gated bundle diff used by both patchers.
- Added the accepted four-entry raw restraint-query reuse. Its final
  fresh-process gate saved 736.65 ms (4.00%) across 12 maps with exact layouts,
  call counts, fallback behavior, and restoration.
- Added source patch v5 with a guarded single-slice `KDSetPathfindCache` loop.
  The matched 12-map gate was 1.030x faster end to end, saved 781.7 ms inside
  the cache writer, matched 100,899 shadowed calls exactly, and kept array
  subclasses or replaced `slice` methods on the original loop.
- Added source patch v4 with a guarded `KDGetRestraintsEligible` enemy-tag loop
  inversion. The 12-map product gate was 1.043x faster end to end, the hot
  function body fell from 7.31 s to 2.52 s, 7,874 shadowed top-level results
  matched exactly, and changed Map helpers forced the original loop.

- Added an exact-KD/Pixi-gated texture startup policy with automatic official
  mobile-atlas selection, explicit original/full/mobile modes, read-only
  decoded/GPU memory reporting, atomic patcher configuration, atlas coverage
  verification, and matched live startup/combat/lifecycle evidence.
- Created the isolated open-source workspace.
- Added the deterministic Rust core and versioned WASM boundary.
- Added the JavaScript compatibility SDK and per-system fallback dispatcher.
- Added adaptive quality, asset lifetime, capability plugin, and scrubbed
  diagnostics controllers.
- Added a reversible bootstrap patcher, portable packager, and synthetic tests.
- Added the first real 5.4.92 integration: a normalized-signature-gated,
  weighted native pathfinding adapter with per-call JavaScript fallback.
- Verified exact path parity on 100 deterministic fixtures and a 1.824x
  pathfinding microbenchmark speedup on the documented local host.
- Corrected release detection to distinguish the in-game 5.4.92 version from
  the Electron package metadata version 5.1.12 and verify both independently.
- Added a reproducible Windows test installation with a copied game runtime,
  dedicated Electron user data, live-file/save guards, and patcher status checks.
- Preserved KD's path and suffix caches, reused native grid snapshots, added
  generation-scoped negative caching, and optimized the no-hook facade path.
- Added matched uncached, cache-cold, and cache-warm 120-enemy live benchmarks;
  the optimized hybrid measured 2.049x, 1.466x, and 1.043x respectively with
  exact route parity and zero failure.
- Added dense generation-scoped nearby-enemy queries, a signature-gated
  commander rescue-target proof, a fused rank-first implicit-master query, and
  a guarded nearest-player query with a fused canonical hostility decision.
- Added a signature-gated enemy-update batch that maintains KD's position cache
  across safe ordinary moves, repairs transient overlaps, and advances an
  explicit cache generation for the dense nearby and master adapters.
- Added a bounded, generation-complete cell-change journal so the nearby and
  implicit-master dense indices patch changed coordinates instead of rebuilding
  over every entity after each accepted move. Missing, malformed, oversized,
  or noncontiguous journals retain the full-rebuild path.
- Added a seventh crowded-turn slice that skips
  `KinkyDungeonPlaceJailKeys`' redundant map scan only when the map already has
  its maximum keyrings. Missing keys and changed map-query dependencies keep
  the exact official path.
- The seven crowded-turn slices reduced the median three-turn 120-enemy
  fixture from 55.00 ms to 29.50 ms, with a 1.861x median paired speedup across
  20 pairs.
- Added a second 120-enemy fixture using KD's real Maidforce prison
  transition, jail guard, escort intent, and player tether. Its 20 paired
  three-turn samples measured 61.30 ms officially and 35.30 ms optimized, a
  1.783x median paired speedup with all states exact and all optimized pairs
  faster.
- Added a hostile-combat fixture with 120 clustered Maidforce entities split
  between `Enemy` and `Rage`, guaranteeing hostile neighbors plus real attack
  and damage work instead of measuring another peaceful crowd.
- Used that fixture to catch a 0.81x to 0.86x commander regression, isolated it
  with system and per-adapter matrices, and capped rescue-proof refreshes at
  16 per commander batch before returning to KD's exact filters.
- The corrected combat gate measured 36.60 ms officially and 31.10 ms
  optimized across 20 three-turn pairs, a 1.170x median paired speedup with
  20 exact final states. The same controlled crowded fixture measured
  53.60 ms officially and 29.20 ms optimized, with all 20 pairs faster.
- Made profiler fixtures restore KD's non-serialized blindness counters and
  temporary enemy flags changed by the zero-time load pass. The refreshed
  prison gate measured 63.10 ms officially and 36.30 ms optimized, with all
  20 pairs faster and exact.
- Corrected the jail-key compatibility oracle to seed a genuinely full-key
  state before testing the no-op shortcut, and added explicit fallback reasons
  to local diagnostics.
- Added exact commander potential-target and mod-replacement fallback checks,
  exact master and nearest-player candidate/dependency checks, per-facade hook
  context, and recovery when a legacy global wrapper is removed.
- Added exact enemy-update fallbacks for changed dependencies and active
  movement events, plus an exact bullet-risk run that kept 71 moves on KD's
  official cache-rebuild path.
- Reduced hot facade overhead with a shared fallback marker and shorter
  replacement checks; dense nearby queries now use numeric templates and
  interior linear offsets.
- Kept original KD Hybrid work under MIT while isolating KD-adapted files under
  MPL-2.0 and shipping attribution, licenses, and their exact source.
- Matched the installed KD 5.4.92 bundle byte-for-byte to public upstream
  commit `5c96c4c1e67faf136ba2c167ed889a9e29005a18` and added a small,
  reviewable source diff instead of vendoring the game.
- Moved the proven nearest-player hostile-first slice into that exact source
  build. Its 20-pair focused gates measured 1.058x in combat, 1.156x in the
  crowded fixture, and 1.249x in prison, with exact state and live-call parity.
- Added a packed-safe `KDHelpless` source fast negative for healthy, unbound
  NPCs. Final 20-pair gates measured 1.055x by medians in combat, 1.029x in the
  crowded room, and 1.021x in prison, with all final states exact.
- Kept injured, bound, packed, and player entities on the original body; added
  explicit fallbacks for replaced unpack, pack, and struggle-threshold helpers,
  plus an independent disable switch and diagnostic counters.
- Added an adaptive negative buff-event index to the same exact source build.
  It waits until a trigger repeats within a tick, then avoids rescanning every
  player and enemy buff when no active buff can handle that trigger.
- The source buff-event gate reduced the hostile-combat two-turn median from
  31.30 ms to 26.90 ms, a 1.163x paired-median speedup with all 20 pairs
  faster and exact. The crowded fixture remained neutral and prison was
  slightly positive.
- Added conservative tick/entity invalidation, standard buff-API tracking, a
  public invalidator for direct mod writes, dependency and disable fallbacks,
  and compatibility checks for handler order and same-tick visibility.
- Added hash-gated source transformation, bundle backup, status verification,
  and byte-exact restoration to both the Node/PowerShell patcher and native
  C++/Qt manager. Either tool can inspect or uninstall the other's manifest.
- Made crowded-turn fixture restoration replace the full transient global flag
  map, preventing `DangerFlag` and similar state from leaking between back-to-
  back scenario runs.
- Shipped the corresponding MPL-marked TypeScript, C++, and conventional patch
  source in portable and redistribution payloads, with explicit upstream credit.
- Added an exact-signature `KinkyDungeonCreateMap` boundary that keeps
  transient generation-time paths on KD's faster deterministic JavaScript
  implementation while normal gameplay still uses Rust/WASM pathfinding.
- Added a guarded JavaScript `KinkyDungeonGetEnemy` adapter that preserves
  catalog/RNG order while hoisting values invariant across all 328 enemy
  definitions.
- Three packaged slow-map pairs measured a 1.025x paired-median speedup; a
  same-process 12-map final gate saved 684 ms with every layout and call count
  exact.
- Verified clean selector fallback when a mod wraps
  `KinkyDungeonStatsChoice.get`, plus the 120-enemy API/developer stress,
  111 JavaScript tests, and 25 Rust tests.
