# Performance methodology

Performance claims require the same seed, room, save fixture, mod set, viewport,
quality tier, warm-up period, and action trace for both paths.

## Current verified microbenchmark

On 2026-07-26, each release WASM planner was compared directly with
`KinkyDungeonFindPath` extracted from the installed KD 5.4.92 `main.js`.

- Fixture: deterministic 61 by 39 grid with a 24% interior wall rate.
- Sampling: 100 warm-up calls, then the median of seven 1,000-call samples.
- Upstream path caching: disabled so both sides performed path queries.
- Compatibility fixtures: 100 deterministic start/goal pairs per mode, with
  zero reachability mismatch and zero invalid JavaScript or native paths.
- Native bridge failures: zero across the benchmark.
- Host: Intel Core i7-12700KF, Windows 11, Node.js 24.15.0, Rust 1.88.0.

| Planner                   |      JavaScript |       Rust/WASM | Speedup |
| ------------------------- | --------------: | --------------: | ------: |
| Optimized (`fast`)        | 408.092 us/call | 205.505 us/call |  1.986x |
| Route Quality (`quality`) | 408.318 us/call | 356.499 us/call |  1.145x |
| Human-like (`human`)      | 411.607 us/call | 209.370 us/call |  1.966x |

Reproduce it after a release build:

```powershell
node scripts/benchmark-native-pathfinding.mjs `
  ..\..\resources\app\out\main.js 1000 fast
```

This is a focused pathfinding microbenchmark, not a claim that the whole game is
that many times faster. Different exact routes are expected because the native
planners optimize weighted cost, latency, or turn count rather than copying
JavaScript heap tie-breaking. The validation gate requires equal reachability,
legal adjacent steps, a correct destination, and exact official behavior for
unsupported calls routed to fallback.

## Live 120-enemy stress result

On 2026-07-26, the optimized adapter was tested inside the isolated KD 5.4.92
Electron build on a fresh 31 by 19 map with 120 real `Maidforce` entities. Each
entity requested a path to the same player location. Every comparison used the
same queries and the same cache policy on both sides.

| Planner                   |          Uncached |        Cache cold |          Cache warm |
| ------------------------- | ----------------: | ----------------: | ------------------: |
| Official JavaScript       |          33.40 ms |          23.03 ms |           21.971 ms |
| Optimized (`fast`)        | 18.98 ms (1.760x) |  2.65 ms (8.691x) | 0.060 ms (366.183x) |
| Route Quality (`quality`) | 16.19 ms (2.063x) | 0.93 ms (24.763x) | 0.057 ms (385.456x) |
| Human-like (`human`)      | 19.85 ms (1.683x) |  2.97 ms (7.754x) | 0.064 ms (343.297x) |

Each cell is a 120-query batch. Warm native cache hits stayed in the facade and
issued zero bridge calls. Quality mode reuses destination fields across enemies
with the same target. Fast and Human reuse generation-stamped search storage.

Compatibility checks passed:

- all three modes had zero reachability mismatches across 120 uncached and 120
  cache-cold comparisons;
- every returned JavaScript and native path was valid;
- every timed series completed with zero native failure;
- all 19 `KinkyDungeonFindPath` parameters were exercised;
- unsupported enemy-aware, trimmed, custom-heuristic, passable-enemy, and leash
  calls fell back for one call and exactly matched the official function;
- every public `KDHybrid` method was exercised, including hooks, dispatch,
  direct binary query, diagnostics redaction, enable/disable, and plugin
  validation; and
- KD's built-in map-generation, full-runthrough, and jailer tests completed.

The adapter preserves KD's cache maps and invalidation generation, byte-checks
the effective grid before replacing the native snapshot, caches unreachable
results for that generation, and removes hook bookkeeping from the no-hook
fast path. Changing planner mode clears mode-dependent caches.

Host: Intel Core i7-12700KF, NVIDIA RTX 4070 Ti, 128 GiB RAM, Windows 11, and
Electron from KD 5.4.92. Reproduce the test with:

```powershell
npm run test:local:pathfinding
```

The complete local result is written to
`artifacts/pathfinding-stress-latest.json`.

## Map-generation pathfinding boundary

Full map generation is a different workload from gameplay pathfinding. KD
changes the grid repeatedly while placing tiles, chests, doors, and enemies.
The native adapter used to encode and load each transient grid before many of
those path queries. A three-map `grv`/`cat`/`jng` profile attributed 29.55
seconds to `encodeKinkyDungeonGrid` alone and took 68.65 seconds overall.

The bootstrap now signature-gates `KinkyDungeonCreateMap` and marks only the
duration of its exact official call as map generation. Nested path queries use
KD's JavaScript pathfinder during that interval; the guard is cleared in a
`finally` block. Normal gameplay queries still use the native adapter. A mod
that replaces the map generator takes ownership through the existing facade
fallback instead of being wrapped as though it were the known function.

The first live gate measured the same three seeded full maps:

| Path                                       | Three-map total |           Result |
| ------------------------------------------ | --------------: | ---------------: |
| Native pathfinding on every transient grid |     68,651.8 ms |     old behavior |
| Map-generation guard                       |     27,871.4 ms |    2.463x faster |
| Entire pathfinding system disabled         |     27,816.4 ms | official control |

The guarded and disabled controls made the same 757,702 path calls and
produced the same three map signatures, dimensions, entity counts, item
counts, and accessibility results. The guard routed all generation-time calls
to the official implementation with zero native failures. Its total was
within 0.2% of disabling the complete system. Repeating the official control
also produced identical signatures and call counts, while the old
always-native path changed one seeded map, so this boundary restores KD's
deterministic choice as well as removing the encoding regression.

A wider gate then generated 12 full maps across `grv`, `cat`, and `jng` at
floors 1, 7, 13, and 19. All 12 maps were accessible and had unique
signatures, the pre-run state restored exactly, and all 1,749,807 nested path
calls used the official implementation with zero failure. The run took
66,688.9 ms. Its report hash is
`D0C8ECA54C96998EEAEBB6158BF9BA3AC63FE1AE57306D8192154101C693F479`.

The 120-enemy stress suite then confirmed that the boundary clears after map
generation: 43,211 later gameplay queries used the native adapter with zero
failures, and the uncached fast-mode workload remained 1.811x faster than the
official uncached path.

Reproduce the focused gate with:

```powershell
npm run profile:local:mapgen -- `
  --maps 3 `
  --pathfinding native `
  --output artifacts/mapgen-profile-v2-3map-generation-guard-gate.json
```

Canonical report hashes:

- old native behavior:
  `B5E5C2DC1A76FD9F5CC8871F4F084E690E06D01CF5A43B0A27A73F08E233C9AE`;
- guarded path:
  `9C6B7063A61F29AF50E62D9C0B6E910AA40D9EB770CDA01BDFFE9E1B80F8F19B`;
- paired official control:
  `342F95F4F878FF56D71C87F50761C607D1291DDC20829775D3618B6D8DADA844`.

## Map-generation enemy-selector invariant hoists

Once transient pathfinding was removed, `KinkyDungeonGetEnemy` became the
largest self-time cost on the slowest generated maps. KD scans the complete
328-entry enemy catalog for each selection. The 12-map floor-band fixture made
13,328 selector calls, or 4,371,584 catalog visits.

The guarded JavaScript adapter keeps KD's catalog iteration, floating-point
weight accumulation, reverse threshold search, selected upstream object, and
single `KDRandom()` call in their original order. It only moves pure values
outside the catalog loop: effective level, arousal mode, grate presence,
ground/avoid tile membership, the four no-override tag classifications, and
plain-data bonus-tag entries.

The adapter is available only for the exact 5.4.92 selector signature. It uses
the official function when the catalog or perk-tag array is replaced, the
faction helper or relevant built-ins change, `KinkyDungeonStatsChoice.get` is
wrapped, bonus tags contain accessors or unusual prototypes, arguments are
outside KD's normal shapes, or a recursive minimum-weight retry may be needed.
No fallback decision consumes RNG.

Three alternating product/fallback pairs generated the same expensive `cat`
floor-1 map:

| Path                                           |      Median |                               Paired result |
| ---------------------------------------------- | ----------: | ------------------------------------------: |
| Official selector through the guarded fallback | 16,200.1 ms |                                    baseline |
| Packaged invariant-hoist adapter               | 15,751.3 ms | 1.025x paired-median speedup; 3 of 3 faster |

The median paired saving was 398.8 ms. All three pairs had identical map
signatures, entity/item counts, 492,779 nested path calls, and 2,929 selector
calls.

The wider same-process gate covered `grv`, `cat`, and `jng` at floors 1, 7,
13, and 19:

| Path                       | 12-map total |                 Result |
| -------------------------- | -----------: | ---------------------: |
| Packaged adapter           |  65,879.4 ms | 13,328 optimized calls |
| Official selector fallback |  66,563.5 ms |          1.010x slower |

All 12 maps matched exactly, including signatures, dimensions, entities,
items, accessibility, and all 1,749,802 nested path calls. Both runs restored
the pre-test state exactly. A separate live compatibility probe replaced
`KinkyDungeonStatsChoice.get`; all 707 selector calls then used the official
implementation with no failure.

KD retains some map-generation globals that are not part of its serialized
save. Archived runs from different process histories can therefore produce
different seeded layouts even when both use the official selector. Semantic
acceptance uses adjacent A/B runs in the same isolated renderer; old reports
are useful performance history, not a cross-session map oracle.

Reproduce the product and official legs with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --output artifacts/mapgen-profile-v4-12map-selector-product-gate.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-enemy-selector-hoists `
  --output artifacts/mapgen-profile-v4-12map-selector-javascript-gate.json
```

Canonical report hashes:

- packaged adapter:
  `DDA08BC2B19998E3DF75FF1D80AD36A50F892094690DAA616DC0042C38358CE1`;
- paired official fallback:
  `2C63D74DF757C17627FEACD914702CB3BB648499D27589350E3E21540AFC23BA`;
- live mod-fallback probe:
  `73185081244EF8BABA11748066700CD52FE9FF65B71717F3B97CB6C23BBEE534`.

## Eligible-restraint enemy-tag scan

The next map-generation profile put `KDGetRestraintsEligible` at 6.8 seconds
of self time. Its hottest loop visited every active enemy tag for every one of
KD's 726 restraint definitions. The canonical catalog declares only 1,344
additive enemy-tag entries and 144 multiplier entries, so walking the
restraint's short tag table is substantially cheaper.

Source patch v4 inverts those two inner loops while retaining the restraint
catalog order, eligibility filters, returned upstream objects, and output
order. It is deliberately guarded: only restraint definitions captured with
plain numeric tag tables use the short scan. Replaced tag tables, custom
restraints, changed prototypes, a replaced tag builder, altered Map helpers,
or `disableEligibleRestraintEnemyKeys` use the exact original tag-order loop.

Before promotion, a shadow oracle ran the official and inverted functions for
every top-level call in the 12-map fixture. It compared 7,874 top-level results
(10,463 candidate calls including recursive low-weight retries) entry by
entry, including keys, restraint/variant identity, inventory variant, order,
and `Object.is`-exact weights. It found zero mismatches.

The final adjacent same-process gate measured:

| Path                       | 12-map total | `KDGetRestraintsEligible` self time |
| -------------------------- | -----------: | ----------------------------------: |
| Original tag-order loop    |  71,986.4 ms |                          7,307.3 ms |
| Guarded restraint-key loop |  69,010.2 ms |                          2,521.8 ms |

The full workload improved by 1.043x and saved 2,976.2 ms. The function body
itself improved by 2.90x; including the compatibility helper's 672.3 ms of
self time, the complete guarded slice was 2.29x faster. All 12 signatures,
dimensions, accessibility results, entity/item counts, 1,749,802 path calls,
and 13,328 enemy selections matched exactly.

A separate mod probe replaced `Map.prototype.has` with a delegating wrapper.
All 843,249 eligible restraint scans then used the original loop, none used the
optimized loop, the generated map stayed exact, and the helper was restored.

Reproduce the product, official, and compatibility legs with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --output artifacts/mapgen-restraint-v4-12map-product-final.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-restraint-enemy-keys `
  --output artifacts/mapgen-restraint-v4-12map-javascript-final.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --start-index 1 `
  --probe-restraint-mod-fallback `
  --output artifacts/mapgen-restraint-v4-mod-fallback-gate.json
```

Canonical report hashes:

- product:
  `38CCF799C9B16C88DE3464899CF2A0D056E53F087CD83614F221C7BE38328D3C`;
- original-loop control:
  `160CD44CB18B6E8B33261C8ADD9FD9DCBCDE1FC46A02D489BB61BCA3EE6F77D3`;
- mod fallback:
  `E494859F40E4416737D68953A63352581B0A3D08473CE4BD70BF2A202DDE181E`;
- shadow equivalence:
  `44782A28BAAF73F5B90A4073317BA9C6536C4E81D0B302020D9D3C1F000569C2`.

## Path-cache suffix allocation

The next accepted map-generation slice is source patch v5. KD previously
created `newPath.slice(i)` and then immediately sliced that temporary again for
every cached point. The guarded path reads the point first and creates only the
suffix that is stored, cutting one array allocation per point.

The shortcut is limited to plain arrays using the captured canonical
`Array.prototype.slice`. Array subclasses, an instance-level `slice`
replacement, a replaced global `slice`, or
`disablePathCacheSingleSlice` take the exact original two-slice loop.

Before source integration, a shadow oracle compared the official and candidate
maps after every call on the slow `cat` floor-1 fixture. It covered 100,899
calls and 4,845,879 path points, comparing key order, path length, and every
stored point by identity. It found zero mismatches.

Three alternating product/original pairs on that slow map produced a
1.010x paired-median speedup, with two of three whole-map pairs faster. The
median whole-map saving was 170.3 ms. `KDSetPathfindCache` itself was faster in
all three pairs, with a median 85.2 ms self-time saving. All pairs had exact
signatures and call counts.

The final adjacent 12-map gate measured:

| Path                      | 12-map total | `KDSetPathfindCache` self time |
| ------------------------- | -----------: | -----------------------------: |
| Original two-slice loop   |  69,872.2 ms |                     6,706.5 ms |
| Guarded single-slice loop |  67,814.3 ms |                     5,924.8 ms |

The complete workload improved by 1.030x and saved 2,057.9 ms; the cache
writer saved 781.7 ms of sampled self time. All 12 signatures, dimensions,
accessibility results, entity/item counts, and restored-state identities
matched exactly.

A direct compatibility probe passed an `Array` subclass through the installed
product function. The result preserved key order, subclass path arrays, and
point identity; the source counters recorded zero optimized calls and one
fallback call.

Reproduce the product, original, and compatibility legs with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --output artifacts/mapgen-pathcache-v5-12map-product-final.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-path-cache-single-slice `
  --output artifacts/mapgen-pathcache-v5-12map-original-final.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --probe-path-cache-mod-fallback `
  --output artifacts/mapgen-pathcache-v5-mod-fallback.json
```

Canonical report hashes:

- product:
  `0A6232DECD045C29ADB46BDF322E3C834A9E15A1AD31FEC6D71323CC6895C5E0`;
- original-loop control:
  `9ED96C60A84F391FCB979062AB4CDE88021969E47413FAF8FA14BDBCF527D782`;
- mod fallback:
  `C685FC8F23DB4D405F6D1EB55CAC30B09FE6417BCD215DFF7C7D98CEA96896E9`;
- shadow equivalence:
  `8D2353391AC625633A649DC89A217E595E52AD43FB95D297F72E14DCD7ED466B`.

## Direct pathfinding successor insertion

The next accepted local source candidate removes a temporary `Map` allocated for
at most eight successors on every expanded pathfinding node. The optimized path
applies the same `open`/`closed` comparisons immediately in the same neighbor
order. It is enabled only while `Map`, `Map.prototype.get`,
`Map.prototype.set`, and `Map.prototype.forEach` still match their captured
dependencies. A replacement or `disablePathfindingDirectSuccessors` takes KD's
original temporary-map loop.

Three slow-map pairs matched exactly. The affected `KinkyDungeonFindPath` slice
improved in all three by a 361.9 ms median; whole-map totals improved in two of
three. The adjacent 12-map gate measured 64,892.8 ms for the candidate and
68,890.9 ms for the original loop, saving 3,998.1 ms (1.062x, 5.80%).
All signatures, dimensions, accessibility results, entity/item counts, and
restored-state identities matched.

A delegating `Map.prototype.forEach` replacement forced all 78,073 smoke-map
searches through the original loop. The 120-enemy stress suite also passed every
planner mode, API, developer-harness, path-validity, and expected-fallback
check with zero failures.

This candidate remains source-only during ongoing optimization work. Patcher
and redistribution integration is deliberately deferred to final cleanup.

Canonical report hashes:

- product:
  `781B1A4A9737AE081F1050424A2AB583E45458313E9011723D846B31CFBD5CC1`;
- original-loop control:
  `85983528CE6D3E2167CF37CBB209779FF5FC074046E1DC33DC0E2A9646EA8491`;
- mod fallback:
  `3061F2E1D9359D11B2A9DD2564716B2E0FB1EA8B935588171C2CD29682558E38`;
- 120-enemy stress:
  `4AA07E0DDE0176FCFA54E838D479560EF532D121D4D3DB0FD4A8D611F731CB23`.

## Direct pathfinding open-set iteration

The next accepted local source candidate replaces the per-search
`Map.prototype.forEach` callback used to select the lowest-cost open node with
a direct `for...of open.values()` loop. The comparisons, tie behavior, and
insertion order are unchanged. The direct loop is enabled only while `Map`,
`Map.prototype.forEach`, `Map.prototype.values`, and the captured map-iterator
methods still match their original dependencies. A replacement or
`disablePathfindingOpenValues` takes the exact original callback.

All three alternating slow-map pairs matched and improved by 306.9 ms,
404.1 ms, and 310.9 ms. The adjacent 12-map gate measured 62,543.1 ms for the
candidate and 63,716.3 ms for the original callback, saving 1,173.2 ms
(1.0188x, 1.84%). The sampled `KinkyDungeonFindPath` total fell by
1,192.5 ms, while the disabled control attributed 968.3 ms of self-time to the
removed callback. All signatures, dimensions, accessibility results,
entity/item counts, and restored-state identities matched.

A delegating `Map.prototype.values` replacement forced all 78,073 smoke-map
searches through the original callback. The 120-enemy stress suite then passed
every planner mode, argument route, API, developer-harness, and path-validity
check with zero failures. The source build, 111 JavaScript tests, 25 Rust tests,
and the 81-file save-integrity check also passed. The resulting local source
bundle SHA-256 is
`620E9F3038C844362FA93EE6C2A9D7C60E0503E792FFE2A4A777A084120A1901`.

This candidate remains source-only during ongoing optimization work. The proven
v5 patcher and redistribution bundle stay frozen; all accepted source changes
will be integrated together during final cleanup.

Reproduce the product, original, and compatibility legs with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --output artifacts/mapgen-pathfinding-open-values-v7-12map-product-final.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-pathfinding-open-values `
  --output artifacts/mapgen-pathfinding-open-values-v7-12map-original-final.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --probe-pathfinding-open-values-mod-fallback `
  --output artifacts/mapgen-pathfinding-open-values-v7-mod-fallback.json
```

Canonical report hashes:

- product:
  `69B8EF2B5E28756103161C5F5F10C451E02B7CBF97083BDB08EA54080038308B`;
- original-callback control:
  `B1AF9A03C2203AF12D3CCE3189C19BD516AE214EE5DDD64571C40C2324DFFD39`;
- mod fallback:
  `6606596531336C3B2F501AD8639990C36F73B8BA2B16838A24E5003F2E460F6C`;
- 120-enemy stress:
  `AC0F5CD35318F4A90FC8AD22B0A5AB28A714EF93102B9962B29AFDD11684CFE5`.

## Hoisted pathfinding cache index

The next accepted local source candidate moves the path-cache key
`lowLoc,endx,endy,tileShort` out of the eight-neighbor loop. The key is
constant for an expanded node, but KD rebuilt the same string before every
neighbor's cache check. The hoist is enabled only when both destination
coordinates are primitive numbers and the tile selector is a primitive string.
Non-primitive or mod-shaped arguments keep the original repeated conversion
path, and `disablePathfindingHoistedCacheIndex` forces that path explicitly.

All three alternating slow-map pairs matched and improved by 773.2 ms,
805.6 ms, and 764.3 ms. The adjacent 12-map gate measured 54,700.2 ms for the
candidate and 63,543.3 ms for the repeated-key control, saving 8,843.1 ms
(1.1617x, 13.92%). The sampled `KinkyDungeonFindPath` total fell by
5,956.9 ms. All signatures, dimensions, accessibility results, entity/item
counts, and restored-state identities matched.

Traced smoke runs sent all 78,073 searches through the requested branch: the
product recorded 78,073 optimized and zero fallback calls, while the disabled
control recorded zero optimized and 78,073 fallback calls. A boxed `Number`
destination produced the same valid path as the original source route and
recorded one source fallback with zero optimized calls. That case is now part
of the 120-enemy stress suite, which passed every planner mode, argument route,
API, developer-harness, and path-validity check with zero failures.

The source build, 111 JavaScript tests, 25 Rust tests, and the 81-file
save-integrity check also passed. The resulting local source bundle SHA-256 is
`DBF1C3B983DE1E16149131B3DB6C2B26A3564CD2DC449E3212F9027D2A82C34D`.

This candidate remains source-only during ongoing optimization work. The proven
v5 patcher and redistribution bundle stay frozen; all accepted source changes
will be integrated together during final cleanup.

Reproduce the product, repeated-key control, and traced branches with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --output artifacts/mapgen-pathfinding-hoisted-cache-index-v8-12map-product-final.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-pathfinding-hoisted-cache-index `
  --output artifacts/mapgen-pathfinding-hoisted-cache-index-v8-12map-original-final.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --trace-pathfinding-hoisted-cache-index `
  --output artifacts/mapgen-pathfinding-hoisted-cache-index-v8-traced-product-smoke.json
```

Canonical report hashes:

- product:
  `481BF75B581B18072C2723390595AF7775FF1E0C5D2D792B107D33DF223E8BC1`;
- repeated-key control:
  `E1EBA22F5BAC30DD51E10F9092931BD50B596D6F07248DDA36721BED50F5B422`;
- traced product smoke:
  `A4DB25EBB9F2FC705D4E83B027D5F8576CFBB164F40E95DCC75DB7E4B68C019B`;
- traced control smoke:
  `339288BC4FAD379456EC91AFC259F21A6BBE506F14920EC9FBEFD801A07E2198`;
- final 120-enemy stress and boxed-argument fallback:
  `949C785A5874EB447F30FDD84DD439E3D5EB8F30614E193457793B09B10F5987`.

## Hoisted path-cache key suffix

The next accepted local source candidate moves the constant
`,endx,endy,Tiles` part of every `KDSetPathfindCache` key out of its
per-path-point loop. The source still reads and converts each point coordinate
in the original order. The hoist is enabled only when both destination
coordinates are primitive numbers and the tile selector is a primitive string;
non-primitive or mod-shaped values keep KD's repeated conversion path.
`disablePathCacheHoistedKeySuffix` forces that path explicitly.

All three alternating slow-map pairs matched and improved by 383.4 ms,
318.3 ms, and 114.2 ms. The adjacent 12-map gate measured 51,531.6 ms for the
candidate and 52,841.9 ms for the repeated-suffix control, saving 1,310.3 ms
(1.0254x, 2.48%). Sampled `KDSetPathfindCache` self-time fell from
5,837.823 ms to 5,343.713 ms, a 494.110 ms reduction. All stable map fields,
including signatures, dimensions, accessibility, entity/item counts, and
restored-state identities, matched.

The traced product sent all 886,545 calls through the hoisted branch; the
disabled control sent the same 886,545 calls through the repeated-suffix
branch. The 120-enemy stress suite passed every planner mode, argument route,
API, developer-harness, and path-validity check. Its direct compatibility
check also produced identity-exact cache maps for both primitive and boxed
destination values. The boxed value took the original branch and performed
the same 22 conversions as the disabled control.

The source build, 111 JavaScript tests, 25 Rust tests, and the 81-file
save-integrity check also passed. The resulting local source bundle SHA-256 is
`EEA8B5B74B000D712EE24314609F18B34E8BF2B2644E814AB48ECA481F9DF635`.

This candidate remains source-only during ongoing optimization work. The proven
v5 patcher and redistribution bundle stay frozen; all accepted source changes
will be integrated together during final cleanup.

Reproduce the product and repeated-suffix control with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-path-cache-hoisted-key-suffix `
  --output artifacts/mapgen-path-cache-key-suffix-v10-12map-product-final.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-path-cache-hoisted-key-suffix `
  --trace-path-cache-hoisted-key-suffix `
  --output artifacts/mapgen-path-cache-key-suffix-v10-12map-control-final.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 `
  --enemies 120 `
  --output artifacts/pathfinding-stress-v10-path-cache-key-suffix-final.json
```

Canonical report hashes:

- product:
  `097A24339D536A9261EEDB5F23A08702396E0B9860E0C7181297CDD0B1E983A8`;
- repeated-suffix control:
  `0EABE4ECB4562639B3D5DA451B2228787B3E38FA1E7BA4035970DA15C44024EE`;
- final 120-enemy stress and compatibility checks:
  `A681F982736A36C8B91293091FB9DA3C51DB40909A612AA816FFA7BA1F58E736`.

## Closed-first pathfinding successor lookup

The next accepted local source candidate preserves KD's two successor
conditions but checks them in the cheaper order. A successor is inserted only
when its score improves both the open and closed entries. On the measured slow
map, the original open-first order performed about 10.46 million `Map.get`
calls. Checking the closed entry first reduces that estimate to 7.75 million
because most already-closed locations can reject the candidate without reading
the open set.

The reordering shares the existing direct-successor compatibility guard:
`Map`, `Map.prototype.get`, `set`, and `forEach` must still match the captured
built-ins. A changed helper takes the original temporary-map route, while
`disablePathfindingClosedFirstSuccessors` restores open-first ordering for an
isolated A/B control.

Three alternating slow-map pairs preserved the same signature and branch
counts. Two of three whole-map pairs and two of three sampled pathfinding
slices improved; the median savings were 34.3 ms overall and 38.0 ms inside
`KinkyDungeonFindPath`. The adjacent 12-map gate supplied the decisive result:

| Path                 | 12-map total | `KinkyDungeonFindPath` self time |
| -------------------- | -----------: | -------------------------------: |
| Closed-first product |  49,817.4 ms |                    12,471.450 ms |
| Open-first control   |  50,954.3 ms |                    12,868.398 ms |

The product saved 1,136.9 ms (1.0228x, 2.23%), including 396.948 ms of sampled
pathfinding self time. All 12 stable map records matched exactly, both runs
restored the pre-test state exactly, and each leg traced all 916,756 searches
through its requested branch.

The 120-enemy stress suite passed every planner mode, expected fallback,
dynamic argument route, public API, developer function, and path-validity
check. The source build, 111 JavaScript tests, 25 Rust tests, and the 81-file
save-integrity check also passed. The accepted local source bundle SHA-256 is
`18EC7F58F4F33975C1F313D60E49F0674B3DC2DD1CB0B319FFDA60E7360F5221`.

This remains source-only during ongoing optimization. The proven v5 patcher
and redistribution bundle stay frozen until final cleanup.

Reproduce the product, open-first control, and stress legs with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-pathfinding-closed-first-successors `
  --output artifacts/mapgen-pathfinding-closed-first-v13-12map-product-final.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-pathfinding-closed-first-successors `
  --trace-pathfinding-closed-first-successors `
  --output artifacts/mapgen-pathfinding-closed-first-v13-12map-control-final.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 `
  --enemies 120 `
  --output artifacts/pathfinding-stress-v13-closed-first-final.json
```

Canonical report hashes:

- product:
  `7E191E6C88C334DB9481594D17B3B4E8FA2C84C4B8EB25C90E0945E301427365`;
- open-first control:
  `9A5B24671A15A2CB693A201047F49C49631895534F306CB0D3EEFF2B324D2F4B`;
- final 120-enemy stress:
  `3D88D81839CFF7B500603BFF74B2B82D5DC571924FF3DB7CFB5FE0CE4C2882DE`.

## Single-read top-level path-cache hits

The next accepted local source candidate removes repeated reads on the
highest-hit cache path. KD first called `Map.has`, then fetched the same cached
array repeatedly to validate its first point and return a copy. The guarded
path reads the array once. A true miss performs the extra `has` needed to
preserve KD's behavior for a present key whose value is `undefined`.

The shortcut requires the captured `Map` constructor, prototype, `get`, `has`,
and `delete`, plus the same methods on the selected cache instance. Replacing
any dependency takes the exact repeated-read source branch. The developer
switch `disablePathfindingTopCacheSingleRead` provides the adjacent control.

The light smoke map was below the shortcut's break-even point, but the
cache-heavy slow fixture won two of three alternating pairs by 158.1 ms and
152.1 ms; the third was 8.6 ms slower. `KinkyDungeonFindPath` self-time
improved in all three by 44.9–70.0 ms. The mixed 12-map gate then measured:

| Path                  | 12-map total | `KinkyDungeonFindPath` self time |
| --------------------- | -----------: | -------------------------------: |
| Single-read product   |  50,398.1 ms |                    12,486.453 ms |
| Repeated-read control |  50,909.4 ms |                    12,522.290 ms |

The product saved 511.3 ms (1.0102x, 1.00%). All stable map fields matched,
both runs restored the pre-test state exactly, and each leg traced all
1,749,770 calls through its requested branch.

A delegating `Map.prototype.get` replacement forced all 115,645 smoke-map
calls through the original branch with the same map signature and exact
restore. The 120-enemy stress suite passed every planner mode, expected
fallback, dynamic argument route, public API, developer function, and
path-validity check. The source build, 111 JavaScript tests, 25 Rust tests, and
the 81-file save-integrity check also passed.

The accepted local source bundle SHA-256 is
`2407E2CE117557489B3DFD93E5C0D0D2472156C0B19E45E1FC23D1D13DDD06C7`.
The proven v5 patcher and redistribution bundle remain frozen until final
cleanup.

Reproduce the final gates with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-pathfinding-top-cache-single-read `
  --output artifacts/mapgen-pathfinding-top-cache-v15-12map-product-final.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-pathfinding-top-cache-single-read `
  --trace-pathfinding-top-cache-single-read `
  --output artifacts/mapgen-pathfinding-top-cache-v15-12map-control-final.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --probe-pathfinding-top-cache-mod-fallback `
  --output artifacts/mapgen-pathfinding-top-cache-v15-mod-fallback.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 `
  --enemies 120 `
  --output artifacts/pathfinding-stress-v15-top-cache-final.json
```

Canonical report hashes:

- product:
  `2F37E1E057710C0B349F3414130C553557668A73D561FA902FA4558FB126EEA6`;
- repeated-read control:
  `3CA35E80FDF5B94F936D55E369137B8656D5D443F5D938C88688AF6C1059681F`;
- delegating-`Map.get` fallback:
  `9BC48C4A26BFA2CDA6F40722E0A4ADCB8E683230766F820A8284B83F73EA3EAC`;
- final 120-enemy stress:
  `BC6AF2D27E71200AA756F04231312F570001A16828074C4C36FF48B58FD7206A`.

## Deferred pathfinding tile metadata

The next accepted local source candidate avoids looking up tile metadata for
neighbors that cannot use it. KD originally called `KinkyDungeonTilesGet`
before checking whether a neighbor was the endpoint, satisfied a cached path,
or was absent from the allowed terrain string. The guarded path performs those
short-circuits first and resolves metadata only before the unchanged lock and
weight logic that consumes it.

The reorder is enabled only for a primitive tile string, no light requirement,
the captured canonical `KinkyDungeonTilesGet`, and the captured
`String.prototype.includes`. A replaced helper or built-in, a light-sensitive
call, a non-primitive selector, or
`disablePathfindingDeferredTileMetadata` keeps KD's original eager order.

All three alternating slow-map pairs improved by 332.4 ms, 584.8 ms, and
58.8 ms. The median saving was 332.4 ms, or about 2.35% of the control. The
adjacent 12-map gate measured:

| Path                      | 12-map total | `KinkyDungeonFindPath` self time | `KinkyDungeonTilesGet` self time |
| ------------------------- | -----------: | -------------------------------: | -------------------------------: |
| Deferred-metadata product |  48,515.4 ms |                    11,954.516 ms |                     3,922.958 ms |
| Eager-metadata control    |  50,944.7 ms |                    12,495.976 ms |                     5,329.597 ms |

The product saved 2,429.3 ms (1.0501x, 4.77%), including 541.460 ms of
pathfinding self time and 1,406.639 ms of tile-helper self time. All 12 stable
map records matched exactly, including signatures, dimensions, accessibility,
entities, and items. Both legs made 1,749,802 pathfinding calls and 13,328 enemy
selector calls, exercised all 916,756 eligible searches through the requested
branch, and restored the pre-test state exactly.

A delegating tile-helper replacement forced all 78,073 eligible smoke-map
searches through KD's eager branch with the same map result and exact restore.
The 120-enemy stress suite passed both planner modes, all 17 argument cases,
path validity and reachability checks, the public runtime API, and the developer
functions. The upstream build, 111 JavaScript tests, 25 Rust tests, and the
81-file save-integrity check also passed.

The accepted local source bundle SHA-256 is
`CA43B9236B3F2542701DBBC48A82E4B5ED0272E906D15E4E3EB22E66EF227A4F`.
The proven v5 patcher and redistribution bundle remain frozen until final
cleanup.

Reproduce the final gates with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-pathfinding-deferred-tile-metadata `
  --output artifacts/mapgen-pathfinding-deferred-tile-v16-12map-product-final.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-pathfinding-deferred-tile-metadata `
  --trace-pathfinding-deferred-tile-metadata `
  --output artifacts/mapgen-pathfinding-deferred-tile-v16-12map-control-final.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --probe-pathfinding-deferred-tile-mod-fallback `
  --output artifacts/mapgen-pathfinding-deferred-tile-v16-mod-fallback.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 `
  --enemies 120 `
  --output artifacts/pathfinding-stress-v16-deferred-tile-final.json
```

Canonical report hashes:

- product:
  `578EC4CF05353CB266DF399F221BA65899AF571E9BEE42961206B308A29A9D89`;
- eager-metadata control:
  `87C26C99D823289E578C0AD8729BF4BD03FD3CAF02CE6CD5D53A05C8635B02C4`;
- delegating tile-helper fallback:
  `D4CEF6339F3C26F4E123CE127A20283DF32306B7D4461216FD89513E43E6A8EB`;
- final 120-enemy stress:
  `1756610B12DDD620CCB761FF1D0D41825567CE4AC5CB19C9EEE632A8E53E1FD7`.

## Direct JavaScript pathfinding fallback during map generation

Map generation deliberately uses KD's official JavaScript pathfinder because
the grid changes while it is being built. Before this runtime refinement, every
nested path query still crossed the generic facade, entered the native adapter,
noticed the map-generation guard, requested a one-call fallback, and only then
called the captured official function.

The accepted runtime scope keeps the public facade installed but points it
straight at the captured official JavaScript function only while the captured
official map generator is running. Calls and fallback counters are accumulated
locally and flushed at scope exit or immediately when diagnostics read status.
The scope is refused when the facade is not the active verified function, the
system is disabled, a legacy mod replaced the global, or any public
pathfinding hook is registered. Cleanup is in `finally`, including exceptions
and nested scopes.

Three alternating slow-map pairs saved 289.2 ms, 481.0 ms, and 166.4 ms. The
median saving was 289.2 ms, or about 2.06% of the corresponding control. The
12-map mixed-floor gate measured:

| Path                            | 12-map total | Generic dispatch self time | Direct-facade self time |
| ------------------------------- | -----------: | -------------------------: | ----------------------: |
| Scoped direct official fallback |  47,917.1 ms |                       0 ms |            1,674.155 ms |
| Full dispatcher control         |  48,901.9 ms |               1,824.671 ms |               71.612 ms |

The product saved 984.8 ms (1.0206x, 2.01%). The control also spent
311.032 ms in the per-call fallback observer path. All 12 stable map records
matched exactly, both legs restored the pre-test state exactly, and both
recorded 1,749,802 pathfinding calls, 13,328 enemy-selector calls, and 916,756
deferred-metadata searches. All 12 product maps entered the direct scope; all
12 control maps used the full dispatcher.

A live public-hook probe registered a real pathfinding `before` hook. It fired
for all 115,645 smoke-map calls, forced the direct scope to decline the map,
was removed cleanly, and retained the exact result and restore. The final
120-enemy stress suite passed both planners, all 17 argument cases, path
validity, the public API and hooks, and every developer function. The upstream
source build, 118 JavaScript tests, 25 Rust tests, and unchanged 81-file save
aggregate also passed.

The accepted local bootstrap SHA-256 is
`AD82F3F8C360BC6415BB21163D6F36C3660C0DB78C9A7727D2D8BE839DEE3655`.
The accepted source bundle remains
`CA43B9236B3F2542701DBBC48A82E4B5ED0272E906D15E4E3EB22E66EF227A4F`.
The proven v5 patcher and redistribution bundle remain frozen until final
cleanup.

Reproduce the final gates with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-map-generation-pathfinding-direct-fallback `
  --output artifacts/mapgen-direct-pathfinding-fallback-v19-12map-product-final.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-map-generation-pathfinding-direct-fallback `
  --trace-map-generation-pathfinding-direct-fallback `
  --output artifacts/mapgen-direct-pathfinding-fallback-v19-12map-control-final.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --trace-map-generation-pathfinding-direct-fallback `
  --probe-map-generation-pathfinding-hook-fallback `
  --output artifacts/mapgen-direct-pathfinding-fallback-v19-hook-fallback.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 `
  --enemies 120 `
  --output artifacts/pathfinding-stress-v19-direct-fallback-final.json
```

Canonical report hashes:

- product:
  `CC5C59ECD46126EAE23C8E9C24B47A1B206CEDA57DB8C86CB73794C3E5565ADA`;
- full-dispatcher control:
  `34860F97BB6C9BA2443924CB4090E23A9171D2E295248EBD0FB0B715FDA7A1FD`;
- live public-hook fallback:
  `A7460D72411C53880A56B097913B9D3B29D167DDB6376B1EA86AE74E661F5410`;
- final 120-enemy stress:
  `BF91964EA2B02CAD78F0A6AD45BF6D78DA0DDDC98F1321A31AA26425A213D50F`.

## Hoisted continuation-cache lookup

The next accepted source refinement checks a pathfinding continuation-cache
entry once per expanded node instead of repeating the same `Map.has` and
`Map.get` work for each of that node's eligible neighbors. Cache contents,
suffix construction, validation, deletion, hit counting, and returned paths
remain unchanged.

The optimized branch requires the already verified hoisted cache index, the
canonical `Map` and cache methods, and the captured
`KinkyDungeonMapGet`/`KinkyDungeonTilesGet` helpers. It also retains KD's
original cacheability conditions. Disabling either source refinement, replacing
a relevant built-in or helper, using a non-primitive cache-index input, or
making an otherwise non-cacheable call selects KD's original per-neighbor
branch.

The adjacent 12-map mixed-floor gate measured:

| Path                         | 12-map total | `KinkyDungeonFindPath` self time |
| ---------------------------- | -----------: | -------------------------------: |
| One lookup per expanded node |  46,152.6 ms |                    10,402.482 ms |
| Per-neighbor lookup control  |  48,380.0 ms |                    12,072.495 ms |

The product saved 2,227.4 ms (1.0483x, 4.604%) overall and 1,670.013 ms
(13.833%) of pathfinding self time. Every stable result field matched exactly
across the two legs: all 12 map signatures, dimensions, accessibility results,
entity counts, and item counts. Both legs made 1,749,802 pathfinding calls and
13,328 enemy-selector calls, and both restored the pre-test state exactly. The
product used the new branch for 916,744 searches and the exact fallback for the
12 searches that did not satisfy its prerequisite guard.

Two live compatibility probes passed. Disabling the prerequisite hoisted-index
branch forced all 78,073 eligible smoke-map searches onto both original
branches. Replacing `Map.prototype.get` with a delegating mod wrapper also
forced all 78,073 continuation searches onto the original branch, preserved
the map result, and restored the wrapper cleanly. The final 120-enemy stress
suite passed both planners, every argument and routing case, path validity and
reachability checks, the public runtime API and hooks, and every developer
function. The upstream source build, 118 JavaScript tests, 25 Rust tests,
TypeScript check, and unchanged 81-file save aggregate also passed.

The accepted local source bundle SHA-256 is
`6C696687FB5D677BF999736C7F149CF6091E16E650BD1641124AE8CF004854AE`.
Its normalized pathfinding signature is `b664183c8f7de804`. The matching local
bootstrap SHA-256 is
`C1A2D6E26A4FF1494529E648B95B785AA17FF8DC8CCE3BEF90B1EA81D048045B`.
The proven v5 patcher and redistribution bundle remain frozen until final
cleanup.

Reproduce the final gates with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-pathfinding-continuation-cache-lookup `
  --output artifacts/mapgen-continuation-cache-lookup-v23-12map-product-final.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-pathfinding-continuation-cache-lookup `
  --trace-pathfinding-continuation-cache-lookup `
  --output artifacts/mapgen-continuation-cache-lookup-v23-12map-control-final.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --disable-pathfinding-hoisted-cache-index `
  --trace-pathfinding-hoisted-cache-index `
  --trace-pathfinding-continuation-cache-lookup `
  --output artifacts/mapgen-continuation-cache-lookup-v23-dependency-fallback.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --probe-pathfinding-top-cache-mod-fallback `
  --trace-pathfinding-continuation-cache-lookup `
  --output artifacts/mapgen-continuation-cache-lookup-v23-mod-fallback.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 `
  --enemies 120 `
  --output artifacts/pathfinding-stress-v23-continuation-cache-lookup.json
```

Canonical report hashes:

- product:
  `7FF142BA2684D39F5B785F460ACB17CA3FA32CA11587959F8AA75A151AAB92AE`;
- per-neighbor control:
  `44408DA54145B20F0CB5311350ABB5C1D1EE2FF853770D694C9B38F973D230A0`;
- prerequisite fallback:
  `F65B380294683269C8B91D1E983EEDCA48F1A34F984302F038C8D3C7CA75CD8B`;
- delegating-`Map.get` fallback:
  `1358861106466E89F1C8BE27274080D9410045BB9EA2834481617A97CF664C31`;
- final 120-enemy stress:
  `AE3C58B1BD3C9EED938E1FB85A98830901A7758A830E781789AC3D19D9F60562`.

## Map-scoped enemy anger-tag cache

The next accepted runtime refinement targets the dominant repeated lookup in
`KinkyDungeonGetEnemy`. During map generation, KD repeatedly asks the same
17-tag anger/rage question across the same enemy catalog. The adapter now
validates that exact query and catalog pattern once per outer map-generation
epoch, stores each ordinary enemy-tag object's match count in a `WeakMap`, and
replays the original number of `1.25` multiplications. Every other selector
query keeps the existing loop.

The cache is deliberately local and guarded. It is discarded after each map,
disabled when the public SDK has any `mapGeneration` hook, and disabled by
`KDHybridSourcePatchControl.disableEnemySelectorAngerCache`. A changed catalog
pattern, accessor tag, unusual tag-object prototype, or failed validation keeps
the official loop for the whole epoch. Replacing an individual enemy's tag
object after validation falls back for that enemy only. The optional
`enemySelectorAngerCacheStats` object is diagnostic and is resolved once per
selector call so tracing does not add a global lookup to every enemy.

The adjacent 12-map mixed-floor gate measured:

| Path                   | 12-map total | Eligible anger calls |
| ---------------------- | -----------: | -------------------: |
| Map-scoped match cache |  45,209.9 ms |      1,518 optimized |
| Original 17-tag loop   |  46,314.7 ms |       1,518 fallback |

The product saved 1,104.8 ms (1.0244x, 2.385%) overall and won 8 of 12
individual maps. The slow-map pair measured 13,022.3 ms versus 13,505.2 ms,
saving 482.9 ms (3.576%); sampled selector self time fell from 7,411.559 ms to
6,867.232 ms. Product tracing recorded 488,796 cache hits and 8,309,532 avoided
tag checks with zero validation failures. The four canonical
`noOverrideFloor` enemies continued through the exact per-enemy loop.

Every stable result field matched across the 12-map legs: all signatures,
dimensions, accessibility results, entity counts, and ground-item counts.
Both legs made 1,749,802 pathfinding calls and 13,328 selector calls, exercised
the accepted continuation-cache branch 916,744 times with its 12 intentional
fallbacks, routed all 12 maps through the accepted direct official pathfinder,
and restored the pre-test state exactly.

Two live compatibility probes passed on the same final bootstrap. A no-op
public `mapGeneration` hook was invoked 708 times, disabled all 303 eligible
cache calls, was removed cleanly, and preserved signature `e87fef77`. Replacing
enemy 20's `imprisonable` data property with an equivalent accessor caused one
catalog validation failure and 303 exact fallbacks; the original descriptor
was restored and the same signature was preserved.

The final 120-enemy stress suite passed every planner mode, argument-routing
case, path validity and reachability check, public runtime API and hook test,
and developer function. The final TypeScript build, 124 JavaScript tests,
25 Rust tests, and unchanged 81-file save aggregate also passed.

The accepted source bundle remains the v23 SHA-256
`6C696687FB5D677BF999736C7F149CF6091E16E650BD1641124AE8CF004854AE`
with normalized pathfinding signature `b664183c8f7de804`. The matching local
bootstrap SHA-256 is
`412AC749999EECD54F9F91681164AE3717A53FD3C92174C8A19250AD543A50D5`.
The proven v5 patcher and redistribution bundle remain frozen until final
cleanup.

Reproduce the final gates with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-enemy-selector-anger-cache `
  --output artifacts/mapgen-enemy-selector-anger-cache-v26-12map-product-final.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-enemy-selector-anger-cache `
  --trace-enemy-selector-anger-cache `
  --output artifacts/mapgen-enemy-selector-anger-cache-v26-12map-control-final.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --probe-enemy-selector-anger-hook-fallback `
  --output artifacts/mapgen-enemy-selector-anger-cache-v26-hook-fallback-final.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --probe-enemy-selector-anger-catalog-fallback `
  --output artifacts/mapgen-enemy-selector-anger-cache-v26-catalog-fallback-final.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 `
  --enemies 120 `
  --output artifacts/pathfinding-stress-v26-enemy-selector-anger-cache.json
```

Canonical report hashes:

- product:
  `B019AAD0D287E29B2B5E0C9874A8D12EF333F1041400CFA9281BD662F0F06179`;
- original-loop control:
  `7E372DEDF317C34161011B1049B4023E30B7AB01F32377EF8B590ED869B4B60E`;
- public-hook fallback:
  `DCBE8A5FEF270399E14BD443A251D7ADAA48B2635244A56486C6F97F24DBEAC4`;
- accessor-catalog fallback:
  `62D607936759C8ACD358E1DAB666BCAE5D772DFA0F67F142035BE5220D07B32F`;
- final 120-enemy stress:
  `32E0ACB38204830A16E572C7F49D80D46672E274DC20530D5BD48EADF0CC53CE`.

## Map-scoped canonical trap-query cache

The next accepted runtime refinement targets KD's longest repeated
enemy-selector queries. One slow map made 1,919 calls with one of nine
canonical 100-to-105-tag trap sequences. Scanning the complete enemy catalog
for every tag repeated more than 61 million ordinary property checks.

The adapter now recognizes only six exact trap families (`illusion`, `latex`,
`leather`, `metal`, `rope`, and `skeleton`) with the canonical shared tag
sequence and the observed `harness`, `cuffs`, and `harness`/`gag` suffixes. It
accepts both KD's direct sequence and the verified facade form, which omits the
exact `slimeOptout`/`bubbleOptout`/`petOptout` triplet. Other long or mod-owned
queries keep the original loop.

Each recognized sequence gets a separate map-epoch cache. The first call
validates ordinary data properties and plain or null tag-object prototypes,
then records each live tag object's exact match count in a `WeakMap`. Later
calls replay the original number of `1.25` multiplications. An accessor,
polluted prototype, unusual tag object, disabled control, or public
`mapGeneration` hook keeps the original loop. Replacing one enemy's tag object
after validation falls back for that enemy only. The four canonical
`noOverrideFloor` enemies also remain on the original per-enemy loop.

The adjacent 12-map mixed-floor gate measured:

| Path                       | 12-map total | Eligible long-query calls |
| -------------------------- | -----------: | ------------------------: |
| Map-scoped canonical cache |  39,057.1 ms |           1,928 optimized |
| Original per-tag loop      |  46,510.3 ms |            1,928 fallback |

The product saved 7,453.2 ms (1.1908x, 16.025%) and won 10 of 12 maps. The
slow-map pair measured 6,591.6 ms versus 13,357.8 ms, saving 6,766.2 ms
(50.654%). Sampled selector-loop self time fell from 7,138.001 ms to
807.071 ms. Product tracing recorded 620,816 cache hits, 64,074,136 avoided
tag checks, 11 map-local sequence builds across the wider run, and zero
validation failures.

Every stable result field matched exactly across both legs: all 12 signatures,
dimensions, accessibility results, entity counts, item counts, checkpoints,
and floors. Both made 1,749,802 pathfinding calls and 13,328 selector calls,
used the accepted continuation-cache branch 916,744 times with its 12 intended
fallbacks, routed all 12 maps through the accepted direct official pathfinder,
and restored the pre-test state exactly.

Two live compatibility probes passed. A public `mapGeneration` hook forced all
1,919 slow-map queries through the original loop and was removed cleanly.
Replacing one `EnemyEnemy` data slot with an equivalent accessor caused nine
validation failures, zero optimized calls, and 1,919 exact fallbacks; the
descriptor was restored cleanly. The final 120-enemy stress suite passed every
planner and argument route, path validity and reachability checks, public API
and hook test, and developer function.

The final TypeScript check, 128 JavaScript tests, 25 Rust tests, full
WASM/TypeScript/bundle build, and unchanged 81-file save aggregate all passed.
The source bundle remains the accepted v23 SHA-256
`6C696687FB5D677BF999736C7F149CF6091E16E650BD1641124AE8CF004854AE`
with normalized pathfinding signature `b664183c8f7de804`. The accepted local
bootstrap SHA-256 is
`4552B66142F23127E7F49B57C9880C1EE6C5075470FB16FA0DDCBCCDF3BB16C6`.
The proven v5 patcher and redistribution bundle remain frozen until final
cleanup.

Reproduce the final gates with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-enemy-selector-long-tag-cache `
  --output artifacts/mapgen-enemy-selector-long-tag-cache-v29-12map-product.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-enemy-selector-long-tag-cache `
  --trace-enemy-selector-long-tag-cache `
  --output artifacts/mapgen-enemy-selector-long-tag-cache-v29-12map-control.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --start-index 1 `
  --probe-enemy-selector-long-tag-hook-fallback `
  --output artifacts/mapgen-enemy-selector-long-tag-cache-v29-hook-fallback.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --start-index 1 `
  --probe-enemy-selector-long-tag-catalog-fallback `
  --output artifacts/mapgen-enemy-selector-long-tag-cache-v29-catalog-fallback.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 `
  --enemies 120 `
  --output artifacts/pathfinding-stress-v29-enemy-selector-long-tag-cache.json
```

Canonical report hashes:

- 12-map product:
  `0A1563CA1B0F13C086E03DF22D79D63AF35B6B63B3BA5ED968CADB8814990755`;
- 12-map original-loop control:
  `45AEDA44273220D6FBAF937F86521CA02F7C2A283EF7EF9BC165B9EDDA61D877`;
- slow-map product:
  `5D5D608BC2E70316852593BA479FED9F51A5DF5534882E198809EC32454C204A`;
- slow-map original-loop control:
  `4BB1D3FCA8CA96C972BA2DA64BBC9631A59E0AA17066CD355BD50553CA6D490C`;
- public-hook fallback:
  `27AEAA24A86F0D20D05685ACE0AAC0926CBE32604AF5AC4B5F891AA08727D4DD`;
- accessor-catalog fallback:
  `EF9004C24043BE70AAEFA09908AC504DFFF4E36FD9FA1A6FEC0E4447FAB04C23`;
- final 120-enemy stress:
  `42AD25BF74466C06C77D6E11388079BFBB7BF9CA045FE3867C916C73453572E8`.

## Map-epoch weighted enemy-selector table cache

The canonical anger and trap-query caches remove repeated tag checks, but KD
still rescanned all 328 enemy definitions and rebuilt the same cumulative
weight table for thousands of otherwise identical queries. The accepted v32
runtime refinement preserves the first official scan, then reuses its exact
table for the rest of that map-generation epoch.

The cache applies only to the already recognized anger and canonical long trap
families, with KD's default `minWeight`/fallback/override behavior and no bonus,
filter, or single-tag input. Plain string requirements and the three ordinary
alliance fields are encoded into the key along with level, floor, tile,
new-game level, arousal mode, and the relevant tile strings. The cached table
keeps KD's original enemy objects, cumulative weights, reverse search, strict
threshold comparison, and one random draw per call.

At each outer map boundary, the adapter validates the enemy catalog and nested
tag, terrain, floor, shrine, and goddess-reputation collections as ordinary
data. Cache hits then use constant-time identity, length, and edge checks
instead of rescanning the catalog. Replacing or resizing the catalog abandons
the cache, and the next map always rebuilds it. A public `mapGeneration` hook,
the existing dependency guards, unusual data accessors, or
`disableEnemySelectorWeightedQueryCache` keep the exact official scan. A mod
that privately mutates an existing enemy, reputation, or faction relation
during an unhooked map can use that same disable control.

The alternating slow-map pairs measured:

| Pair                         | Map-epoch table | Disabled control |              Saved |
| ---------------------------- | --------------: | ---------------: | -----------------: |
| Product, then control        |      5,723.6 ms |       6,503.5 ms | 779.9 ms / 11.992% |
| Product, then control repeat |      5,588.9 ms |       6,361.1 ms | 772.2 ms / 12.139% |

The wider product/control/product sequence measured:

| Path                   | 12-map total | Result versus the middle control |
| ---------------------- | -----------: | -------------------------------: |
| Map-epoch table, run A |  37,817.9 ms |         965.6 ms / 2.490% faster |
| Disabled control       |  38,783.5 ms |                         baseline |
| Map-epoch table, run B |  37,938.8 ms |         844.7 ms / 2.178% faster |

Both product legs generated all 12 accessible maps with the same 12 signatures
as the control. Checkpoint, floor, dimensions, entity count, ground-item count,
and every other stable result field also matched, and all three snapshots
restored exactly. Each product run built 19 tables, hit them 3,427 times, and
avoided 1,124,056 complete enemy-catalog visits with zero validation failure.
The slow map built 11 tables, hit them 2,514 times, and avoided 824,592 visits.

The sampled selector body fell from 4,735.989 ms in the 12-map control to
3,719.306 and 3,770.367 ms in the product legs. In the slow pairs it fell from
795.660/755.926 ms to 141.936/137.045 ms. The first attempted guard rescanned
all 328 definitions on every hit; its 1,010.106 ms of validation self time made
the slow map 590.9 ms slower than its disabled control. Moving that validation
to the map boundary retained the compatibility contract and recovered the
measured gain.

Live fallback checks passed on the final bundle. A no-op public map-generation
hook ran 2,930 times, forced all 2,525 weighted candidates through the official
loop, and was removed cleanly. Replacing one `EnemyEnemy` tag slot with an
equivalent accessor produced no weighted build or hit, recorded the expected
catalog rejection, restored the descriptor, and preserved the same map
signature. The explicit disable control likewise produced 2,525 official
fallbacks and no cache activity.

The final gate passed 131 JavaScript tests, 25 Rust tests, Rust formatting and
Clippy, both WASM targets, the TypeScript and bundle builds, and the complete
120-enemy stress suite. The real 81-file save aggregate remained unchanged at
`56ce90f953f9...`. The original installation's `main.js` remains the official
SHA-256
`2D3041A085CBE475A63227FF40709F6D9C1595C77A58545C69EDF359A57605A4`;
the isolated and private source trees remain accepted v23 SHA-256
`6C696687FB5D677BF999736C7F149CF6091E16E650BD1641124AE8CF004854AE`
with normalized pathfinding signature `b664183c8f7de804`. The accepted local
v32 bootstrap SHA-256 is
`479F1257261C80AF2AB668571832F49E6291AA99E39890B608106691D157E29B`.
The proven v5 patcher and redistribution bundle remain frozen until final
cleanup.

Reproduce the final gates with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-weighted-query-cache-v32-12map-product-epoch.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --disable-enemy-selector-weighted-query-cache `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-weighted-query-cache-v32-12map-control-epoch.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --start-index 1 `
  --probe-enemy-selector-long-tag-hook-fallback `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-weighted-query-cache-v32-hook-fallback-smoke.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --start-index 1 `
  --probe-enemy-selector-long-tag-catalog-fallback `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-weighted-query-cache-v32-catalog-fallback-smoke.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 `
  --enemies 120 `
  --output artifacts/pathfinding-stress-v32-enemy-selector-weighted-query-cache.json
```

Canonical report hashes:

- 12-map product A:
  `121E199B7B80C9AF172B7A576CF4A48032636130158781FD66382AD4CA0BABB4`;
- 12-map product B:
  `4572478CE20BAEB3AD880BDA204B486C8CA531C5F255581C153C28864A4F00A4`;
- 12-map disabled control:
  `D67115678DE2D17EEF6A3D5F4BE5CBEE70E88CD33CF2993C2EA2A95D87650532`;
- slow product/control pair A:
  `8A633EADEF8CAFC3B1F6A6FAD5B6157FC3C98FAD71FA4CCE8A426BB02C648AC9` /
  `E7C23195D9CEDF208F584ACBEE27FE751D5E430CC6D16767698442DCC9BEEDD6`;
- slow product/control pair B:
  `231B2BE695398567D8A5653D4C584ED4B451689A477252E81A3D432E7EF072DC` /
  `DEEDC0545B16DC617901EFC489C2B63A824741E8ADBEF479FB0174F322399A49`;
- public-hook fallback:
  `A397BF70903AF5B16F562BAF0E694404AC979EF8A5E91AAFE2D97B5B7A0A0030`;
- accessor-catalog fallback:
  `9178E00EADC6F4184562C5C8986F91CEEE6A16D1B73B5FDFBC059DB91667CFBD`;
- final 120-enemy stress:
  `45256CA57B5714E40D1C82B3128CE0806ED05B83284C1FA3F809E8BEB82FB228`.

## Extended weighted tables for canonical one-tag selectors

The post-v32 12-map trace still found 9,511 selector calls belonging to five
exact one-tag families:

| Tag            | Calls |
| -------------- | ----: |
| `mushroom`     | 4,747 |
| `obstacletile` | 1,927 |
| `statue`       | 1,625 |
| `elemental`    |   808 |
| `human`        |   404 |

The older rejected single-tag experiment cached only tag membership. It reduced
selector self time but was neutral or slower end to end. Accepted v33 instead
extends the complete v32 cumulative-weight table cache to these five observed
families. The first eligible call still executes KD's official scan and stores
the original enemy objects and cumulative weights; later calls replay the same
reverse search, strict threshold, and single random draw.

Eligibility remains deliberately narrow. The tag array must contain exactly
one of the five primitive strings, and the query must have KD's default
`minWeight`, fallback, and floor-override behavior, with no bonus, filter, or
single-tag requirement. The existing v32 encoder still includes level, map
index, tile, plain required tags, ordinary alliance fields, new-game level,
arousal mode, ground and avoid strings, and levels per checkpoint. Anything
outside that shape runs the official loop.

The extension shares v32's validated map epoch and constant-time catalog-scope
checks. Public map-generation hooks suppress the epoch; unusual accessors,
replaced or resized catalogs, changed built-ins, and failed dependency guards
fall back. `disableEnemySelectorWeightedSingleTagCache` disables only the five
new families, leaving the accepted v32 anger and long-query tables active. The
broader `disableEnemySelectorWeightedQueryCache` remains available to mods that
privately mutate catalog data during an unhooked map.

The direct profiler clone first established the ceiling on the adjacent
12-map fixture: 35,388.6 ms and 35,667.2 ms for the candidate around a
38,113.8 ms control, saving 7.150% and 6.419%. The guarded production bundle's
one-map smoke was intentionally treated as inconclusive: its first pair was
41.6 ms slower, while its repeat was 190.1 ms faster. The predeclared 12-map
product/control/product gate then measured:

| Path                             | 12-map total | Result versus the middle control |
| -------------------------------- | -----------: | -------------------------------: |
| Extended map-epoch tables, run A |  34,840.6 ms |       2,812.6 ms / 7.470% faster |
| v32-only control                 |  37,653.2 ms |                         baseline |
| Extended map-epoch tables, run B |  35,342.9 ms |       2,310.3 ms / 6.136% faster |

All three runs made 1,749,802 pathfinding calls and 13,328 selector calls. Every
stable result field matched exactly across all 12 maps, including signatures,
checkpoint, floor, dimensions, accessibility, entity count, and ground-item
count, and every snapshot restored exactly. Each product run built 42 tables,
hit them 11,703 times, avoided 3,838,584 enemy-catalog visits, and recorded zero
validation failures. Relative to the v32-only control, the extension added 23
table builds and 8,276 hits and avoided another 2,714,528 catalog visits.

At the 100-microsecond sampling interval, the weighted-selector adapter body's
self time fell from 3,648.932 ms in the control to 1,884.886 and 1,859.958 ms
in the two product legs. The consistent target reduction and two wider
wall-clock wins clear the acceptance threshold that the earlier tag-only cache
did not.

Both live fallback gates passed on the final bundle. A no-op public
map-generation hook ran 2,930 times, forced all 2,929 weighted candidates
through the official loop, produced no build or hit, and was removed cleanly.
Replacing one `EnemyEnemy` slot with an equivalent accessor likewise produced
2,929 fallbacks, no build or hit, the expected validation rejection, exact
`c7ebd034` map output, and a clean descriptor restore.

The final gate passed 133 JavaScript tests, 25 Rust tests, Rust formatting and
Clippy with warnings denied, both release WASM targets, the TypeScript and
bundle builds, and the complete 120-enemy stress suite. The real 81-file save
aggregate remained unchanged at `56ce90f953f9...`. The real installation's
`main.js` remains official SHA-256
`2D3041A085CBE475A63227FF40709F6D9C1595C77A58545C69EDF359A57605A4`;
the isolated and private source trees remain accepted v23 SHA-256
`6C696687FB5D677BF999736C7F149CF6091E16E650BD1641124AE8CF004854AE`
with normalized pathfinding signature `b664183c8f7de804`. The accepted local
v33 bootstrap SHA-256 is
`ACC5D8C8A76BEB02F5F848AED85E0BAEB8F4989583EF610BDCC7EA9CBD85C6B1`.
The proven v5 patcher and redistribution bundle remain frozen until final
cleanup.

Reproduce the final gates with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-weighted-single-tag-cache-v33-production-12map-product.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-enemy-selector-weighted-query-cache `
  --disable-enemy-selector-weighted-single-tag-cache `
  --output artifacts/mapgen-enemy-selector-weighted-single-tag-cache-v33-production-12map-control.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-weighted-single-tag-cache-v33-production-12map-product-pair2.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --start-index 1 `
  --probe-enemy-selector-long-tag-hook-fallback `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-weighted-single-tag-cache-v33-production-hook-fallback.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --start-index 1 `
  --probe-enemy-selector-long-tag-catalog-fallback `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-weighted-single-tag-cache-v33-production-catalog-fallback.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 `
  --enemies 120 `
  --output artifacts/pathfinding-stress-v33-enemy-selector-weighted-single-tag-cache.json
```

Canonical report hashes:

- 12-map product A:
  `379E6F52B72301510DCDAB03F4DC41B74E52E8576B1448B8086A9FC9E35789AD`;
- 12-map v32-only control:
  `2AB8A406B8353DC52608FB5500427015A4122194B595AB1C0D12C365D6197AE1`;
- 12-map product B:
  `34D65BB731EBDE20BBBAAEADAF34D90CFD393C18239A42008D8EED48CA5A7C43`;
- public-hook fallback:
  `5A29355E62062339BE96ED1DF183A9F73C3F0EB5207A828AE5D8DB2CA814E95E`;
- accessor-catalog fallback:
  `EFAF54F8C6053A68A1AFE884ED33E76A465F829016F302752875C260FDABF3F2`;
- final 120-enemy stress:
  `BFDE3017BB759E7D0571C286D4FEAB6DFA7CC81D4069A58D2A8EED1251CFC795`.

## Accepted local v37: filtered complete weighted-query tables

The accepted v32/v33 table cache still sent 1,222 otherwise eligible calls
through the full enemy-catalog scan because they supplied `filterTags`. A
profiler-only v37 ceiling added the exact filter sequence to the complete
cumulative-weight-table key. It cached 1,207 of those calls with 15 builds and
avoided 395,896 enemy scans.

The production extension deliberately keeps the existing eligibility boundary.
It applies only to the accepted anger, canonical long-tag, and five canonical
single-tag families. `bonusTags`, `requireSingleTag`, non-default weight
controls, and other dynamic shapes still take the exact loop. A filter must be
a plain array whose indexed properties are data descriptors containing strings.
Array subclasses, accessors, sparse slots, and other unusual mod-owned shapes
fall back. The key is rebuilt from the array's current contents on every call,
so an in-map mutation selects a different table instead of reusing stale data.

The extension shares the validated map epoch and catalog scope from v32.
Public map-generation hooks suppress that epoch, while replaced dependencies
and accessor-backed catalog data reject the scope. The narrow
`disableEnemySelectorWeightedFilterTagCache` control disables only v37; the
accepted v32/v33 anger, long-query, and single-tag tables remain active. The
broader `disableEnemySelectorWeightedQueryCache` remains the opt-out for mods
that privately mutate catalog data during an otherwise unhooked map.

The profiler-only ceiling used the 12-map `grv`/`cat`/`jng` fixture at floors
1, 7, 13, and 19 in product/control/product order:

| Path             | 12-map total | Filter calls | Filter builds | Filter hits | Enemy scans elided |
| ---------------- | -----------: | -----------: | ------------: | ----------: | -----------------: |
| v37 ceiling A    |  35,786.7 ms |        1,222 |            15 |       1,207 |            395,896 |
| v33-only control |  36,619.0 ms |            0 |             0 |           0 |                  0 |
| v37 ceiling B    |  35,996.7 ms |        1,222 |            15 |       1,207 |            395,896 |

The two ceiling legs saved 832.3 ms (2.273%) and 622.3 ms (1.699%). All
stable map fields matched the control exactly, all three runs made 1,749,808
pathfinding calls, and every run restored the same pre-profile state exactly.

The final production bundle then repeated the matched 12-map
product/control/product gate:

| Path             | 12-map total | Weighted builds | Weighted hits | Enemy scans elided |
| ---------------- | -----------: | --------------: | ------------: | -----------------: |
| v37 production A |  34,234.5 ms |              48 |        12,909 |          4,234,152 |
| v33-only control |  35,602.6 ms |              42 |        11,703 |          3,838,584 |
| v37 production B |  34,622.1 ms |              48 |        12,909 |          4,234,152 |

Production saved 1,368.1 ms (3.843%) and 980.5 ms (2.754%). Each leg
made 1,749,802 pathfinding calls and 13,328 native enemy-selector calls with
zero adapter failures. All 12 stable map records matched exactly, including
signatures, dimensions, accessibility, entity counts, and ground-item counts;
the pre-profile state restored exactly in every run. The v37 delta was 1,206
additional hits and 395,568 additional avoided scans with zero validation
failures.

Both compatibility gates passed. A no-op public map-generation hook ran 2,930
times, forced all 2,929 weighted calls through the exact selector loop,
produced no build or hit, and was removed cleanly. Replacing one
`EnemyEnemy` catalog slot with an equivalent accessor likewise produced 2,929
fallbacks, zero build or hit, 101 expected weighted-scope validation failures,
the exact `c7ebd034` map result, and a clean descriptor restore.

The final gate passed 137 JavaScript tests, 25 Rust tests, Rust formatting and
Clippy with warnings denied, both release WASM targets, TypeScript and bundle
builds, and the complete 120-enemy stress suite. Unit coverage includes filter
content mutation, the isolated v37 disable control, and accessor-backed array
fallback. The real 81-file save aggregate remained unchanged at
`56ce90f953f9...`.

The real installation's `main.js` remains official SHA-256
`2D3041A085CBE475A63227FF40709F6D9C1595C77A58545C69EDF359A57605A4`.
The isolated and private source trees remain accepted v23 SHA-256
`6C696687FB5D677BF999736C7F149CF6091E16E650BD1641124AE8CF004854AE`.
The accepted local v37 bootstrap SHA-256 is
`FECF9193198B5A5577FF1EC6252ECA5E07AE4DBCD9FE17C34E8E1F69A9C33E28`.
The proven v5 patcher and redistribution bundle remain frozen until final
cleanup.

Reproduce the final production gates with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-weighted-filter-tag-cache-v37-production-12map-product.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-enemy-selector-weighted-query-cache `
  --disable-enemy-selector-weighted-filter-tag-cache `
  --output artifacts/mapgen-enemy-selector-weighted-filter-tag-cache-v37-production-12map-control.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-weighted-filter-tag-cache-v37-production-12map-product-pair2.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --start-index 1 `
  --probe-enemy-selector-long-tag-hook-fallback `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-weighted-filter-tag-cache-v37-production-hook-fallback.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --start-index 1 `
  --probe-enemy-selector-long-tag-catalog-fallback `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-weighted-filter-tag-cache-v37-production-catalog-fallback.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 `
  --enemies 120 `
  --output artifacts/pathfinding-stress-v37-enemy-selector-weighted-filter-tag-cache.json
```

Canonical final report hashes:

- 12-map production A:
  `7115D9BD161D2EC270D4C4D9D4869B24D34D69C3E3EA8DB8EC4C579C8C1E5A2E`;
- 12-map v33-only control:
  `97A5C902270A165DD26CD8EBED6D118617444BD9B4A869502ECEEB9D8312DC35`;
- 12-map production B:
  `F2E0B7EC9A98DFB6185AC3F1F23E2C2AB02C0FCCE4FF1B74FD21F3B5F927FAB0`;
- public-hook fallback:
  `7A9FC4D7C8C8AC68E7D53D7469DA6335B1D90E82EAFC6E7DAB82153B5ABDAA14`;
- accessor-catalog fallback:
  `9B419F13A27F4BB9DDE6DF636F8E1A19E180C7F4330D5874BB3DC35C4ADD2319`;
- final 120-enemy stress:
  `E7A45213F7A864A3C1B311B28EB7EC8FA26E17084E07A33B598852C04879806C`.

The retained profiler-only ceiling reports are:

- ceiling product A:
  `B73E594A438C28F06132286BD449D64E3AD5E89F7AAEEF9001878654AB5343D3`;
- ceiling v33-only control:
  `A97ED28A893C4983F67116AD44E329D499F77FBE511E85563EC9BDAA603AFBA5`;
- ceiling product B:
  `CECC802EAE19E11256C282D5B49B52FF5352263584283A9214DB44A00C608CFB`.

## Accepted local v39: safe general long-query tables

The accepted v37 selector cache recognized KD's known canonical trap-tag
sequences. A residual trace found another 164 eligible long-query calls across
32 exact sequences in the same 12-map fixture. Most were shifted canonical
forms, such as trap sequences with `secondhalf` in a different prefix position,
or forms with additional rope opt-out tags. Another 207 calls across 83
sequences contained `miniboss`; those remain deliberately ineligible.

The v39 extension accepts any otherwise eligible tag query with at least 100
entries only when it is a plain, dense `Array` of string data properties. It
builds a length-delimited key from the complete current contents, so different
sequences cannot collide and mutating the array selects a different cache
entry. Sparse arrays, array subclasses, accessors, non-strings, and queries
containing KD's special `boss`, `miniboss`, `elite`, or `minor` floor tags take
the exact selector loop. The existing compact canonical keys remain unchanged.

The general keys share v32's map epoch, catalog identity checks, per-enemy
validation, and complete cumulative weighted tables. Public map-generation
hooks suppress the epoch; replaced selector dependencies or accessor-backed
catalog entries reject the cache scope. The narrow
`disableEnemySelectorGeneralLongTagCache` control returns to v37's
canonical-only behavior without disabling the previously accepted selector
caches.

A profiler-only direct-clone ceiling compared all safe long queries with the
canonical-only matcher in product/control/product order:

| Path                   | 12-map total | Long calls | Long sequences | Weighted builds | Weighted hits | Enemy scans elided |
| ---------------------- | -----------: | ---------: | -------------: | --------------: | ------------: | -----------------: |
| v39 ceiling A          |  33,874.5 ms |      2,092 |             41 |              80 |        13,041 |          4,277,448 |
| Canonical-only control |  34,790.1 ms |      1,928 |              9 |              48 |        12,909 |          4,234,152 |
| v39 ceiling B          |  34,404.9 ms |      2,092 |             41 |              80 |        13,041 |          4,277,448 |

The ceiling legs saved 915.6 ms (2.632%) and 385.2 ms (1.107%). The extension
added 164 eligible calls, 32 exact sequences, 132 complete-table hits, and
43,296 avoided enemy scans. All three legs made 1,749,802 pathfinding calls,
produced the same 12 stable map records, and restored the pre-profile state
exactly.

The final production bundle repeated the warmed 12-map
product/control/product gate:

| Path                   | 12-map total | Long builds | Long hits | Tag checks elided | Weighted hits | Enemy scans elided |
| ---------------------- | -----------: | ----------: | --------: | ----------------: | ------------: | -----------------: |
| v39 production A       |  34,157.2 ms |      14,104 |    13,846 |         1,468,642 |        13,041 |          4,277,448 |
| Canonical-only control |  35,192.3 ms |       3,608 |     3,542 |           366,114 |        12,909 |          4,234,152 |
| v39 production B       |  34,397.6 ms |      14,104 |    13,846 |         1,468,642 |        13,041 |          4,277,448 |

Production saved 1,035.1 ms (2.941%) and 794.7 ms (2.258%). The selector
adapter's sampled self time fell from 1,472.382 ms in the control to 900.756 ms
and 889.216 ms. Every leg made 1,749,802 pathfinding calls and 13,328 native
selector calls with zero adapter fallbacks or failures. The same 12 signatures,
dimensions, accessibility results, entity counts, and ground-item counts
matched exactly; each run restored signature `24a5fc88` exactly.

An important fixture detail was isolated before accepting the result. The first
map generated after launching a fresh Electron process produced signature
`3640b168`, 45 entities, and 6,315 path calls. The next identical request
produced the stable warmed signature `5f338976`, 46 entities, and 6,310 path
calls. Exact v37 rollback and an inert unknown control reproduced the same
cold-then-warm transition, proving that it was process fixture state rather
than v39 behavior. The production A/B therefore warmed the candidate process
with the canonical-only control before collecting any timed leg.

Both compatibility probes passed. A no-op public map-generation hook ran 143
times, forced all 65 long and 75 weighted calls through the exact selector
loop, built no cache entry, and was removed cleanly. Replacing one
`EnemyEnemy` catalog slot with an equivalent accessor forced the same 65 long
and 75 weighted fallbacks, recorded the expected 11 long-scope and one
weighted-scope validation failures, built no cache entry, and restored the
descriptor exactly. Both maps retained the warmed `5f338976` result and exact
state restore.

The final gate passed 140 JavaScript tests, 25 Rust tests, Rust formatting and
Clippy with warnings denied, both release WASM targets, TypeScript and bundle
builds, and the complete 120-enemy stress suite. The stress suite exercised all
planner modes, dynamic arguments, public APIs, and developer helpers with zero
reachability mismatches, invalid paths, or final native failures. The guarded
save verifier left all 81 real save files unchanged at aggregate
`56ce90f953f9...`.

The real installation's `main.js` remains official SHA-256
`2D3041A085CBE475A63227FF40709F6D9C1595C77A58545C69EDF359A57605A4`.
The isolated and private source trees remain accepted v23 SHA-256
`6C696687FB5D677BF999736C7F149CF6091E16E650BD1641124AE8CF004854AE`.
The accepted local v39 bootstrap SHA-256 is
`61798FB42314AE1F85864F3D5C1F53E61C3960CC99F1A677EB19DC4C0051E21D`;
the matching WASM SHA-256 is
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.
The isolated runtime on port 9223 contains those exact artifacts. The proven
v5 patcher and redistribution bundle remain frozen until final cleanup.

Reproduce the final production gates with:

```powershell
npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-enemy-selector-long-tag-cache `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-general-long-tag-cache-v39-production-12map-product-pair1.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-enemy-selector-long-tag-cache `
  --trace-enemy-selector-weighted-query-cache `
  --disable-enemy-selector-general-long-tag-cache `
  --output artifacts/mapgen-enemy-selector-general-long-tag-cache-v39-production-12map-control.json

npm run profile:local:mapgen -- `
  --maps 12 `
  --trace-enemy-selector-long-tag-cache `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-general-long-tag-cache-v39-production-12map-product-pair2.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --start-index 6 `
  --probe-enemy-selector-long-tag-hook-fallback `
  --trace-enemy-selector-long-tag-cache `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-general-long-tag-cache-v39-hook-fallback.json

npm run profile:local:mapgen -- `
  --maps 1 `
  --start-index 6 `
  --probe-enemy-selector-long-tag-catalog-fallback `
  --trace-enemy-selector-long-tag-cache `
  --trace-enemy-selector-weighted-query-cache `
  --output artifacts/mapgen-enemy-selector-general-long-tag-cache-v39-catalog-fallback.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 `
  --enemies 120 `
  --output artifacts/pathfinding-stress-v39-general-long-tag-cache.json

npm run verify:safety
```

Canonical final report hashes:

- warmed 12-map production A:
  `CEFEE860A3D68598D7B72E021C931A5FEA4A1ACC25AFC182E72175B93F0CEDEC`;
- canonical-only production control:
  `E362B6CF27D5BCBE564972EE2F6198BB5A461F9B546FEA74A6712B745CC0A6B5`;
- warmed 12-map production B:
  `CD5DC38ED64CC8DC25429C01C34A0D7E235D77281FFBD11476B6074B47148757`;
- public-hook fallback:
  `AECBBD2DD6020929F9B39889AA7BB016ED12507DA326F03300DA213B57360E05`;
- accessor-catalog fallback:
  `DA3F587BF0C8F23EEE51C59E336D93A213EA199669A11E118C91ECA77E1BBE88`;
- final 120-enemy stress:
  `7F3F164069A11C0F23421ECD439B71265650504205A15834A99BF828893473B6`.

The retained profiler-only ceiling hashes are:

- ceiling product A:
  `1CEF67D3D5C4B4A87FF5BADEB325B891DF0D8E0A063D4A22CC048B0E890492EF`;
- ceiling canonical-only control:
  `308E3892602EA904AF1F23AECDFC8E304D8906A3F041803E165ED9A401FDA2F7`;
- ceiling product B:
  `AF039B93380EF1D260D7252033BD9EE0D4793CDA81DA2B1B7800A5E1A9759662`.

Cold-process diagnosis is retained separately:

- exact v37 first-map rollback:
  `CBA10115C677C94E738FCC9FB681A9867463FCF0C9E770743D7233A1369B81F7`;
- inert-control warm repeat:
  `491D5F6686BFCD0DB3BFF37021D270E77189FD1CA5AE3A626B98301622BE8894`;
- production canonical-only warm-up:
  `577306FA94494E4E0333CCD4C72226FA8E9F156D510AF5286B362CE3C8D25FA4`.

## Accepted local v40: guarded path-cache edge-identity writes

The next retained map-generation hotspot was `KDSetPathfindCache`. A pathfinder
call can ask it to write the same suffix arrays repeatedly into KD's two
official path caches. v40 avoids a redundant allocation and `Map.set` only when
the existing value is a plain array with the expected length and its first and
last point objects are the same objects as the candidate suffix. KD returns
copies of cached paths, and the optimization is limited to KD's official cache
maps, canonical `Map` and `Array` helpers, the direct official pathfinder scope,
and a no-mod state. A public pathfinding or map-generation hook, loaded mod,
custom cache, array subclass, replaced collection helper, protected control, or
developer switch keeps the exact writer.

The constant-time identity check was tested before integration against a
full-element oracle. Across 100,899 writer calls, 4,845,879 path points, and
4,683,269 edge-identity candidates, the oracle found zero false positives and
zero output mismatches. The production trace on the canonical warm map then
optimized all 1,990 writer calls, skipped 67,813 redundant suffix writes, and
performed 8,438 writes. Its matched control took all 1,990 fallback calls,
skipped nothing, and performed 76,251 writes.

The uninstrumented production integration was measured on the same warmed
12-map fixture in product/control/product order:

| Run                    |       Total |  Difference from control |
| ---------------------- | ----------: | -----------------------: |
| v40 production A       | 33,194.9 ms | 585.2 ms faster (1.732%) |
| v39-compatible control | 33,780.1 ms |                 baseline |
| v40 production B       | 32,891.2 ms | 888.9 ms faster (2.631%) |

All three runs produced the same 12 signatures in the same order, made exactly
1,749,802 pathfinding calls and 13,328 enemy-selector calls, reported no
failures, and restored the canonical `24a5fc88` fixture exactly. The signature
sequence was:

`e87fef77`, `16e5f1fe`, `1276fef9`, `3d6cd11b`, `6fb46b85`,
`d223424c`, `5f338976`, `1f879c55`, `cc3df94e`, `4b548f11`,
`bf04036b`, `ba4b4693`.

Compatibility checks covered both layers of the guard. A public pathfinding
hook received all 6,310 calls and forced all 1,990 cache-writer calls through
the official branch; the hook was removed cleanly. A `ModPath` array subclass
and noncanonical cache produced the exact four reference entries and one
fallback call. Populating the live `KDAllModFiles` registry likewise produced
1,990 fallback calls, zero skips, and restored the registry exactly. The
map-level counter still reports that the safe source scope was opened in that
last test; the source counter is authoritative about whether the optimization
actually ran.

The final gate passed 142 JavaScript tests, 25 Rust tests, Rust formatting and
Clippy with warnings denied, both release WASM targets, TypeScript and bundle
builds, and the complete 120-enemy stress suite. The stress suite exercised all
planner modes, 17 argument routes, public APIs, and developer helpers with zero
reachability mismatches, invalid paths, or final native failures. The guarded
save verifier left all 81 real save files unchanged at aggregate
`56ce90f953f9...`.

The real installation remains official SHA-256
`2D3041A085CBE475A63227FF40709F6D9C1595C77A58545C69EDF359A57605A4`.
The accepted local v40 source SHA-256 is
`30BAF06EE062E5017D277CCF8C40EF31646CE46A71A1891B0548EC0FBBBE377C`;
the bootstrap SHA-256 is
`1D7327EE2FE4CE38EE7CA5CA847E913366424CEBDE300BAA9706587A11166DE2`;
and the unchanged WASM SHA-256 is
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.
The isolated runtime on port 9223 contains the exact source and bootstrap
artifacts. The proven v5 patcher and redistribution bundle remain frozen until
final cleanup.

Reproduce the production and fallback gates with:

```powershell
node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --output artifacts/mapgen-path-cache-edge-identity-v40-production-12map-product-pair1.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --disable-map-generation-path-cache-edge-identity-skip `
  --output artifacts/mapgen-path-cache-edge-identity-v40-production-12map-control.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --output artifacts/mapgen-path-cache-edge-identity-v40-production-12map-product-pair2.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --probe-map-generation-pathfinding-hook-fallback `
  --trace-map-generation-pathfinding-direct-fallback `
  --trace-map-generation-path-cache-edge-identity-skip `
  --output artifacts/mapgen-path-cache-edge-identity-v40-hook-fallback.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --probe-path-cache-mod-fallback `
  --output artifacts/mapgen-path-cache-edge-identity-v40-mod-fallback.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --probe-map-generation-path-cache-mod-fallback `
  --output artifacts/mapgen-path-cache-edge-identity-v40-loaded-mod-fallback-verified.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 --enemies 120 `
  --output artifacts/pathfinding-stress-v40-path-cache-edge-identity.json

npm run verify:safety
```

Canonical report hashes:

- full-element oracle:
  `9A60612B2C7F287DC3676D3812B4BF5180CBFC6626D3396790C4D77D70379B0D`;
- production trace:
  `238E72A183799B13D9CF7F223B593D7BFB3BEA96C2119FDE79FFE7A3C9D6527D`;
- official-writer trace control:
  `71A7752A14271AA32AF57736C59D2FADC790A98E3CC9B4B739459D92222FE905`;
- production A:
  `383F45F9D30F936C33AEFB3B2A1C1ECD53A0D3D7D732A7717372EDA1D1193DA9`;
- v39-compatible control:
  `2F91CDC48E55D31610FCDEC6AD4CA32DF291306129AD0E163BDDFAFD45DA86A7`;
- production B:
  `B2CDB63C3846E2694A1BBA917658DCFE4580033844708EA8585EF59A329B3D09`;
- public-hook fallback:
  `73C8DD972DEA86F3CBAB7F533127D7DB228048676620DA85A40A0BFE4D4FC2AC`;
- mod-owned input fallback:
  `B1BF0BF2A63B57A4E742628CD4DE4A60DB6AA723EBA757E9E087458EF70833BF`;
- loaded-mod registry fallback:
  `8BFFCED87633F2EADD9305911E7863E8C01C86E53B254C2232E7D65628EF767D`;
- final 120-enemy stress:
  `35BCAB4AFAF4C2F306202D8583E5F91AD3C82BCBE48FAA13C6F83B63E853A2F4`.

## Accepted local v41: verified continuation-tail cache writes

The v40 profile left `KDSetPathfindCache` at about 4.5 seconds of self time in
the canonical 12-map control. Most of that time was the `Map.get` performed for
every suffix candidate. Whole-call reuse was not available: a diagnostic
observed 100,899 distinct path arrays and no repeated path/endpoint/cache tuple.
The useful information instead already existed inside the official pathfinder.
When it joins a freshly searched prefix to a path-cache continuation, that
continuation is already present in the selected official cache.

v41 passes the known continuation boundary to the official writer without
changing its six-argument formal arity. The writer can then avoid re-reading,
allocating, and setting the known tail, while retaining v40 for the fresh
prefix. The hint is accepted only inside the guarded v40 map-generation scope,
with no loaded mods, canonical plain arrays and helpers, the original public
writer identity, and an internal eighth-argument identity token. That token
keeps an existing six- or seven-argument mod call from accidentally activating
the new behavior.

The first full-tail prototype was deliberately rejected by its oracle. It
examined 4,683,370 candidate entries and found 101 calls where a deeper suffix
had been overwritten after the continuation entry was created. The verifier
forced the complete writer on each mismatch, so the test output stayed exact.
The corrected form performs one constant-time sentinel read for the tail's
final edge. A failed sentinel retains the v40 per-entry loop for that call.

The final verification run covered 100,899 writer calls:

- 100,192 calls accepted the sentinel and 101 failed it;
- 4,682,966 tail entries were skipped and then checked element by element by
  the diagnostic oracle;
- all 4,682,966 checked entries were exact, with zero mismatches;
- 707 calls used the ordinary writer path; and
- the generated `c7ebd034` map and restored `24a5fc88` fixture were exact.

The final uninstrumented build was measured on the warmed canonical 12-map
fixture in product/control/product order:

| Run                    |       Total |    Difference from control |
| ---------------------- | ----------: | -------------------------: |
| v41 production A       | 28,666.5 ms | 3,838.9 ms faster (11.81%) |
| v40-compatible control | 32,505.4 ms |                   baseline |
| v41 production B       | 28,673.4 ms | 3,832.0 ms faster (11.79%) |

All three runs produced the same 12 signatures in the same order, made exactly
1,749,802 pathfinding calls and 13,328 enemy-selector calls, reported no
failures, and restored `24a5fc88` exactly. The signatures remained:

`e87fef77`, `16e5f1fe`, `1276fef9`, `3d6cd11b`, `6fb46b85`,
`d223424c`, `5f338976`, `1f879c55`, `cc3df94e`, `4b548f11`,
`bf04036b`, `ba4b4693`.

The writer's sampled self time fell from 4,512.308 ms in the control to
425.140 ms and 441.183 ms in the two production runs. The cold/warm restart
boundary also remained canonical: `3640b168`, 45 entities, and 6,315 path
calls cold; `5f338976`, 46 entities, and 6,310 calls warm. Both restored the
same `24a5fc88` fixture.

Compatibility was tested at each ownership boundary. A public pathfinding hook
received all 6,310 calls, forced all 1,990 v41 and v40 writer calls to their
official branches, and was removed cleanly. A live `KDAllModFiles` entry did
the same and restored the registry exactly. Replacing the public
`KDSetPathfindCache` function exercised a narrower dependency guard: all 1,990
v41 calls fell back, all 1,990 accepted v40 calls stayed optimized, and the
original writer identity was restored.

The final 120-enemy stress gate passed every planner mode, all 17 argument
routes, cache compatibility checks, public APIs, hooks, plugin validation, and
developer helpers with zero reachability mismatches, invalid paths, or final
failures. The repository gate passed 142 JavaScript tests, 25 Rust tests,
TypeScript, Rust formatting and Clippy with warnings denied, both release WASM
targets, and bundle builds. The save-safety verifier left all 81 real save
files unchanged at aggregate `56ce90f953f9...`.

The real installation remains official SHA-256
`2D3041A085CBE475A63227FF40709F6D9C1595C77A58545C69EDF359A57605A4`.
The accepted local v41 source SHA-256 is
`0432399ECC2AE4CFFAC66FD43E1419DCA6ABC5F9DFBC3C24AB268195A160E3E3`;
the bootstrap SHA-256 is
`5FFE3F9E55FE09A5C2FC4D36043EB84B4AE5AC6D57B947F1DC04C855286E0F2D`;
and the unchanged WASM SHA-256 is
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.
The source pathfinder signature is `ebdbae7b2fb5261b`. The isolated runtime on
port 9223 contains those exact source and bootstrap artifacts. The v5 patcher
and redistribution bundle remain frozen until final cleanup.

Reproduce the final oracle, production comparison, and fallbacks with:

```powershell
node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 1 --pathfinding native `
  --trace-path-cache-known-tail --verify-path-cache-known-tail `
  --output artifacts/mapgen-path-cache-known-tail-v41-token-equivalence-slow.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --output artifacts/mapgen-path-cache-known-tail-v41-token-production-12map-product-pair1.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --disable-path-cache-known-tail-skip `
  --output artifacts/mapgen-path-cache-known-tail-v41-token-production-12map-control.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --output artifacts/mapgen-path-cache-known-tail-v41-token-production-12map-product-pair2.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --probe-path-cache-known-tail-writer-fallback `
  --trace-map-generation-path-cache-edge-identity-skip `
  --output artifacts/mapgen-path-cache-known-tail-v41-token-writer-fallback.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --probe-map-generation-pathfinding-hook-fallback `
  --trace-map-generation-path-cache-edge-identity-skip `
  --trace-path-cache-known-tail `
  --output artifacts/mapgen-path-cache-known-tail-v41-token-hook-fallback.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --probe-map-generation-path-cache-mod-fallback `
  --trace-map-generation-path-cache-edge-identity-skip `
  --trace-path-cache-known-tail `
  --output artifacts/mapgen-path-cache-known-tail-v41-token-loaded-mod-fallback.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 --enemies 120 `
  --output artifacts/pathfinding-stress-v41-path-cache-known-tail.json

npm run verify:safety
```

Canonical report hashes:

- rejected unsentinelled oracle:
  `5EED5148892FB784DB36C88D000C38F96E687EAFC8F4B90DC6499B3F395C132B`;
- final element oracle:
  `589CA31389E2908B1FEFD34E1C4E856EB2CE7391F744D6BB52ACE05181085770`;
- cold restart control:
  `9149C35A59B952B6778FF79D20DCA3A3DD0C9B863966EE21549EB1CD9D244A2B`;
- warm restart control:
  `D85D026F8F9B3A76EE0154F7F2600BB15F53C6E6880985530D33CBD7EB3D9EB7`;
- production A:
  `B7ADD43E4D27D367A727036E81C7FC71DE7DAE51CEB0D8C9C889E5371D776DF8`;
- v40-compatible control:
  `B2788E9D73E926146DE7B75C1FA675A8E64E36767A8E3D348771BD214A85BAAC`;
- production B:
  `63744F885A77188457E52BA740B642A388D95A9670F8BBAC2EA1DE21879CCBC3`;
- writer-identity fallback:
  `7A895D040687942EE77132FF5FDA4B51AECFCC1AA6BDA290DA4732F46311BA6C`;
- public-hook fallback:
  `24DF0FB853F2A1D42DD66F8599509E41E727DDE54B63535936C64C3431D9D235`;
- loaded-mod registry fallback:
  `7EF767C9E723256DD74CB748BFEC1C6A98CA74DC700E89A64C8A26985D8E82E2`;
- final 120-enemy stress:
  `5353D4E08FB80C5FF7122847D37C024B21726729FC6A89C30B028D98321A958E`.

## Rejected local experiment v42: single-read continuation-cache lookup

The next pathfinding candidate replaced the accepted continuation cache's
`has`-then-`get` hit path with one `get`, treating `undefined` as a miss. It was
restricted to the official no-mod `Map` cache and the accepted direct
pathfinding scope.

The exhaustive slow-map verifier exercised 117,867 optimized searches and
1,252,905 continuation lookups. It found 100,394 hits and cross-checked all
1,152,511 `undefined` results with `has`; none was a stored-`undefined` entry.
The map remained `c7ebd034` after 492,779 pathfinding calls and restored
`24a5fc88` exactly.

Correctness passed, but the established 12-map product/control/product gate did
not show an end-to-end win:

| Run                  |       Total | Difference from v41 control |
| -------------------- | ----------: | --------------------------: |
| v42 candidate A      | 28,398.2 ms |       6.7 ms slower (0.02%) |
| accepted v41 control | 28,391.5 ms |                    baseline |
| v42 candidate B      | 28,760.6 ms |     369.1 ms slower (1.30%) |

Every run produced the same 12 signatures in the same order, made exactly
1,749,802 pathfinding calls and 13,328 enemy-selector calls, reported no
failures, and restored `24a5fc88`. Although sampled
`KinkyDungeonFindPath` self time moved in the expected direction, the complete
workload was neutral to slower. The candidate source, temporary signature, and
profiler controls were therefore removed.

Rollback restored the exact accepted v41 source SHA-256
`0432399ECC2AE4CFFAC66FD43E1419DCA6ABC5F9DFBC3C24AB268195A160E3E3`
and bootstrap SHA-256
`5FFE3F9E55FE09A5C2FC4D36043EB84B4AE5AC6D57B947F1DC04C855286E0F2D`.
Fresh cold and warm checks reproduced `3640b168` / 6,315 calls and
`5f338976` / 6,310 calls, with exact restore state.

Evidence hashes:

- exhaustive verifier:
  `DA789E62B0113DC243507C41D6C4516CF15207430B6C609B6905B8388DD2DE04`;
- candidate A:
  `CD72DD8FCDB45797FF1D2D6E5D205E3239AE4322DDB2E478DD595FF269FA486C`;
- v41 control:
  `6FCF3D88D82FDD0989F8A38724F734B10D2EC42BCB6D89B0FC6C159A59E1A12D`;
- candidate B:
  `164E2D3956252385268532193B9EA7C19F242A2FF492212433D9223A4E14356B`;
- rollback cold:
  `7182669A75B120D9694CBAB32FE190DDA2AE8D6F62F7D6666F10CBF97DF71D66`;
- rollback warm:
  `CFFE660619343BE456DF2C90A8DD57D6F70B449BD8C59CBE06DF8D3E24E0F993`.

## Accepted local v43: private numeric pathfinding coordinates

After restoring exact v41 from the rejected v42 experiment, the next profile
still showed `KinkyDungeonFindPath` spending substantial time allocating and
hashing `"x,y"` strings for its private `open` and `closed` maps. Those keys do
not escape the search. v43 represents only those private coordinates as
`x + y * KinkyDungeonGridWidth` and reconstructs the result through a matching
private helper. Game-visible locations, public arguments, returned path points,
official path-cache keys, and `Map` insertion order remain unchanged.

The numeric branch is deliberately narrower than the public pathfinding API. It
requires the accepted official no-mod direct-map-generation scope, positive
integer grid dimensions, integer in-bounds endpoints, the exact official
path-reconstruction helper, and the original relevant `Map`, `Array`, and
numeric dependency identities. A public pathfinding hook, a loaded mod, a
replaced path helper, a replaced `Map` operation, or an unsupported coordinate
shape sends the complete call through the existing string-key implementation.
The branch does not change native planner routing or the public mod API.

An instrumented slow-map oracle exercised 117,867 numeric searches and checked
all 5,898,804 generated numeric-key/location pairs. It found zero collisions
and no fallback calls. The generated map remained `c7ebd034` after exactly
492,779 pathfinding calls and the fixture restored to `24a5fc88`.

The final uninstrumented build was then measured on the warmed canonical
12-map fixture in product/control/product order:

| Run                  |       Total | Difference from v41 string-key control |
| -------------------- | ----------: | -------------------------------------: |
| v43 production A     | 27,095.6 ms |             1,873.1 ms faster (6.466%) |
| accepted v41 control | 28,968.7 ms |                               baseline |
| v43 production B     | 27,030.8 ms |             1,937.9 ms faster (6.690%) |

All three runs produced the same 12 signatures in the same order, made exactly
1,749,802 pathfinding calls and 13,328 enemy-selector calls, reported no
failures, and restored `24a5fc88` exactly. The signatures remained:

`e87fef77`, `16e5f1fe`, `1276fef9`, `3d6cd11b`, `6fb46b85`,
`d223424c`, `5f338976`, `1f879c55`, `cc3df94e`, `4b548f11`,
`bf04036b`, `ba4b4693`.

Sampled `KinkyDungeonFindPath` self time was 8,996.029 ms and 8,721.931 ms
for the two production runs versus 10,362.900 ms for the matched control, a
13.2% to 15.8% reduction in the target itself. A separate slow-map
product/control/product check measured 4,576.0 / 4,749.5 / 4,549.5 ms, so both
the focused and complete canonical gates agreed on the direction.

A clean isolated-process restart proved that the production branch, rather
than an old renderer or verifier-only path, was active. The cold run produced
`3640b168` with 6,315 path calls and 1,997 numeric searches; the warm run
produced `5f338976` with 6,310 path calls and 1,992 numeric searches. Both had
zero numeric fallbacks or collisions and restored `24a5fc88`.

Compatibility was exercised at every new ownership boundary. Replacing
`KinkyDungeonGetPath`, `Map.prototype.get`, `Map.prototype.values`, or
`Map.prototype.forEach` forced all 1,992 eligible searches back to the official
string-key branch while preserving `5f338976`, 6,310 path calls, and the restore
state. A public hook observed all 6,310 calls and was removed cleanly. A live
mod-registry entry changed the registry from zero to one entry, forced the same
complete fallback, and restored the registry exactly.

The final 120-enemy stress gate passed every planner mode, all 17 argument
routes, cache compatibility checks, public APIs, hooks, plugin validation, and
developer helpers with zero reachability mismatches or invalid paths. The
repository gate passed 142 JavaScript tests, 25 Rust tests, TypeScript, Rust
formatting and Clippy with warnings denied, both release WASM targets, and the
bundle build. The save-safety verifier left all 81 real save files unchanged at
aggregate `56ce90f953f9...`.

The real installation remains official SHA-256
`2D3041A085CBE475A63227FF40709F6D9C1595C77A58545C69EDF359A57605A4`.
The accepted local v43 source SHA-256 is
`00FD5E5D1C6A461C3DEC62356688E1243C80D77D690454C04A87E9F704CAA96D`;
the bootstrap SHA-256 is
`CCA366793B0DC135E80412EACAD47492F611C1A59D2EFF53C3B8C9EC7BC8B166`;
and the unchanged WASM SHA-256 is
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.
The source pathfinder signature is `4d4e0a875f2846cc`. The isolated runtime on
port 9223 contains those exact source and bootstrap artifacts. The v5 patcher
and redistribution bundle remain frozen until final cleanup.

Reproduce the oracle, canonical comparison, primary fallbacks, and stress gate
with:

```powershell
node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 1 --pathfinding native `
  --trace-pathfinding-numeric-coordinate-keys `
  --verify-pathfinding-numeric-coordinate-keys `
  --output artifacts/mapgen-numeric-coordinate-keys-v43-equivalence-slow.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --output artifacts/mapgen-numeric-coordinate-keys-v43-canonical-product-a.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --disable-pathfinding-numeric-coordinate-keys `
  --output artifacts/mapgen-numeric-coordinate-keys-v43-canonical-control.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --output artifacts/mapgen-numeric-coordinate-keys-v43-canonical-product-b.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --probe-pathfinding-numeric-get-path-fallback `
  --trace-pathfinding-numeric-coordinate-keys `
  --output artifacts/mapgen-numeric-coordinate-keys-v43-get-path-fallback.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --probe-map-generation-pathfinding-hook-fallback `
  --trace-pathfinding-numeric-coordinate-keys `
  --output artifacts/mapgen-numeric-coordinate-keys-v43-public-hook-fallback.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --probe-map-generation-path-cache-mod-fallback `
  --trace-pathfinding-numeric-coordinate-keys `
  --output artifacts/mapgen-numeric-coordinate-keys-v43-loaded-mod-fallback.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 --enemies 120 `
  --output artifacts/pathfinding-stress-v43-numeric-coordinate-keys.json

npm run verify:safety
```

Canonical report hashes:

- exhaustive collision oracle:
  `29BF57D1DF74D9EBA0EC46C1F143499908E3FF67BC6BA3257258D6FDDA4B5F37`;
- production A:
  `7094BC2E81AF6C1DD391D4D4576285835464D49474921437D3CCD9A8BA160407`;
- v41-compatible control:
  `49EFC372B91EBEBF3F1C2A80B313924087EEF22E40CE77538EBE02ADA94C0746`;
- production B:
  `2FBC1AD5B141EBEA1B41869C727689F2DA744FBD7DFA324C71E2B0E1ABE75BFB`;
- fresh product cold:
  `C0B92EBC0FD761A0048D2384491E65B81A6F04D464470223D69FE8EEC95000E2`;
- fresh product warm:
  `E2F1AD080BF88B313D0257A850080525F2DB772CAB4A9ED7FC0E578074B28CD6`;
- path-helper fallback:
  `C341E65BFE1B588E09EBCB0B0847AFFD3A31CC000CDC248BB087460EA7E2FFC3`;
- `Map.get` fallback:
  `39C9BBE98DDB9015975B4ADD2BC1D60C68D6BD58B4DE1DCC93FF70372292F90C`;
- `Map.values` fallback:
  `2BAD534859108C619237F53BBA128157C8F94980A0E9FE631710BE39FAC90481`;
- `Map.forEach` fallback:
  `E0828C4AE05EAF79A643FBAA7D5258E2CE9B76FD2F6C70A6E81F6FB3DA07D589`;
- public-hook fallback:
  `206BA6DC8C422FAE8A3B182276E9752D3224813CCC4F8CB10D09FACC152FEDF5`;
- loaded-mod fallback:
  `59A47EFDC367D0B1694691E4C70F5E0FDC951868194A6F57015918EB3E5632CA`;
- final 120-enemy stress:
  `DCBFE64A622A4EAEC4370549DE32AD8547318438057B2FD2535FD3381AE7DABE`.

## Accepted local v44: canonical tile-membership tables

The v43 profile left the short `TilesTemp.includes(tile)` check on one of the
hottest pathfinding lines. KD's three official tile sets contain only 9, 29,
and 30 one-character entries. A live Electron microbenchmark measured a
precomputed `Uint8Array` membership table at 3.3x to 4.24x the throughput of
`String.includes` for those exact strings.

v44 builds the three private tables once and selects one only inside v43's
official no-mod numeric-coordinate scope. The continuation-cache and deferred
tile-metadata guards must also be active, the three global tile strings and
their captured values must still match, and the original `String.includes`,
`String.charCodeAt`, and `Uint8Array` identities must remain installed.
`noDoors`, a custom tile string, a non-single-character grid result, a changed
dependency, a public hook, or a loaded mod uses the original
`TilesTemp.includes(tile)` expression for the complete lookup.

The slow-map oracle exercised 117,867 optimized searches and compared
9,318,361 table decisions directly with the original `String.includes`.
Another 606 unsupported lookup shapes stayed on the original expression. There
were zero mismatches. The generated map remained `c7ebd034` after exactly
492,779 pathfinding calls and the fixture restored to `24a5fc88`.

The uninstrumented build was measured on the warmed canonical 12-map fixture in
product/control/product order:

| Run                  |       Total | Difference from v43 control |
| -------------------- | ----------: | --------------------------: |
| v44 production A     | 25,848.7 ms |  1,456.1 ms faster (5.333%) |
| accepted v43 control | 27,304.8 ms |                    baseline |
| v44 production B     | 26,364.2 ms |    940.6 ms faster (3.445%) |

All three runs produced the same 12 signatures in the same order, made exactly
1,749,802 pathfinding calls and 13,328 enemy-selector calls, reported no
failures, and restored `24a5fc88` exactly. The signatures remained:

`e87fef77`, `16e5f1fe`, `1276fef9`, `3d6cd11b`, `6fb46b85`,
`d223424c`, `5f338976`, `1f879c55`, `cc3df94e`, `4b548f11`,
`bf04036b`, `ba4b4693`.

Sampled `KinkyDungeonFindPath` self time was 7,979.476 ms and 8,424.601 ms
for the two production runs versus 8,686.109 ms for the control, a 3.0% to
8.1% reduction in the target itself. The separate slow-map
product/control/product gate measured 4,506.7 / 4,667.8 / 4,419.4 ms, so both
focused production runs and both canonical production runs improved.

A clean isolated-process restart proved production activation. The cold run
produced `3640b168` with 6,315 path calls, 1,990 optimized searches, and
200,823 optimized membership lookups. The warm run produced `5f338976` with
6,310 path calls and the same optimized-search and lookup counts. Seven cold
searches and two warm searches used the intentional full fallback. Both runs
had zero mismatches and restored `24a5fc88`.

Compatibility was checked at each new boundary. Replacing
`String.prototype.charCodeAt` with a transparent wrapper caused all 1,992
eligible searches and 201,626 lookups to use the original branch; the wrapper
was called 3,402 times and restored exactly. A public pathfinding hook observed
all 6,310 calls, forced the same complete fallback, and was removed cleanly. A
live mod-registry entry also forced all 1,992 searches to the original branch
and restored the registry from one entry to zero.

The final 120-enemy stress gate passed every planner mode, all 17 argument
routes, cache compatibility checks, public APIs, hooks, plugin validation, and
developer helpers with zero reachability mismatches or invalid paths. The
repository gate passed 142 JavaScript tests, 25 Rust tests, TypeScript, Rust
formatting and Clippy with warnings denied, both release WASM targets, and the
bundle build. The save-safety verifier left all 81 real save files unchanged at
aggregate `56ce90f953f9...`.

The real installation remains official SHA-256
`2D3041A085CBE475A63227FF40709F6D9C1595C77A58545C69EDF359A57605A4`.
The accepted local v44 source SHA-256 is
`932CE86012691A1E09078E84A2113979FE25639A8ED6D2AA7F1BAB8F68A5F895`;
the bootstrap SHA-256 is
`52B24B559FEB1D28BCCECA1CA131EA73562FC567DE3FD6B4ABB67EAB9FBC9004`;
and the unchanged WASM SHA-256 is
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.
The source pathfinder signature is `2a8a36170c5dde72`. The isolated runtime on
port 9223 contains those exact source and bootstrap artifacts. The v5 patcher
and redistribution bundle remain frozen until final cleanup.

Reproduce the oracle, canonical comparison, fallbacks, and stress gate with:

```powershell
node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 1 --pathfinding native `
  --trace-pathfinding-tile-membership-table `
  --verify-pathfinding-tile-membership-table `
  --output artifacts/mapgen-tile-membership-table-v44-equivalence-slow.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --output artifacts/mapgen-tile-membership-table-v44-canonical-product-a.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --disable-pathfinding-tile-membership-table `
  --output artifacts/mapgen-tile-membership-table-v44-canonical-control.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --output artifacts/mapgen-tile-membership-table-v44-canonical-product-b.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --probe-pathfinding-tile-membership-dependency-fallback `
  --trace-pathfinding-tile-membership-table `
  --output artifacts/mapgen-tile-membership-table-v44-dependency-fallback.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --probe-map-generation-pathfinding-hook-fallback `
  --trace-pathfinding-tile-membership-table `
  --output artifacts/mapgen-tile-membership-table-v44-public-hook-fallback.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --probe-map-generation-path-cache-mod-fallback `
  --trace-pathfinding-tile-membership-table `
  --output artifacts/mapgen-tile-membership-table-v44-loaded-mod-fallback.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 --enemies 120 `
  --output artifacts/pathfinding-stress-v44-tile-membership-table.json

npm run verify:safety
```

Canonical report hashes:

- exhaustive membership oracle:
  `BABA6595E0F3529DEDBDF33C966294BE8A417A168B9283CB814BB481C63DD2BF`;
- production A:
  `ACF6221675BAB0B6D4837C8103BE16EA66CEC2942E66C0DBB873CA46B43C2241`;
- v43-compatible control:
  `B069299802389C1E9E2BAF2A42AD4783FC6548A1AD61AC174FDD2B88685BBF67`;
- production B:
  `F09F53A203790404506351DB6ACFF94CBE45AAF3CBEC53D912EE42DB46D2DF3D`;
- dependency fallback:
  `0C2F7AAEE47D68DA08B6F4FD270E4C08925F46474E7ED398B108D1552D5422C1`;
- public-hook fallback:
  `E7C03E425C2DADEABE46C4EA856552AB2E0ED8ED43B74AC1DCD856498C41A298`;
- loaded-mod fallback:
  `ECC3127EC75D9FF4C61AC93C1FF4213C136239A33E2C6E19A2896E64E9EAA77E`;
- fresh product cold:
  `3DD304F0C8222D463D97A506B75353760FF670EAE2ADE3E8DBD48D2339B7B6B4`;
- fresh product warm:
  `66B73DC104130815AF9F18214833535F1FD80FC24C3DA56A6C0104D0BFF21BAF`;
- final 120-enemy stress:
  `031798CDB3DBEE580675D626E6CB1578CDB4EC3267ECEC5E556EFA8641295B83`.

## Accepted local v45: numeric continuation-cache index

The v44 residual profile showed that the expensive part of continuation-cache
lookup was not the second `Map.get`: v42 had already proved that replacing
`has` plus `get` with one guarded `get` was neutral to slower. The slow map
instead performed 1.25 million continuation probes, each rebuilding and
hashing the long `"x,y,endx,endy,tile"` string.

v45 keeps KD's official string-keyed cache as the public authority and adds a
private `WeakMap` shadow for the guarded map-generation scope. Each official
cache object owns destination-and-tile suffix maps keyed by v43's numeric
coordinate. The guarded writer stores the exact same path-array references in
both caches; reads can therefore avoid constructing the official string key
while retaining identity-level equivalence.

The shadow is created only while the official cache is empty. It requires the
accepted v44 tile-table scope, the map-generation edge-identity proof, no loaded
mods, canonical `Map`, `WeakMap`, and `Number.isInteger` identities, the
captured official writer, and exact official cache instances. Cache replacement
naturally selects a new shadow. An unowned writer, invalid coordinate, changed
dependency, loaded mod, or disabled control deletes the private record and
uses the complete official path. Official invalid-entry deletions are mirrored
into the shadow.

The slow-map oracle exercised:

- 117,867 optimized searches;
- 1,252,905 shadow lookups: 100,394 hits and 1,152,511 misses;
- 100,899 optimized official-writer calls and 162,610 indexed writes; and
- 4,683,269 exact writer-reference checks.

Every shadow hit/miss matched the official cache, every stored path was the
same array object as its official entry, and both read and writer mismatch
counts stayed zero. The generated map remained `c7ebd034` after exactly
492,779 pathfinding calls, and the fixture restored to `24a5fc88`.

The uninstrumented slow-map product/control/product gate measured:

| Run                  |      Total | Difference from v44 control |
| -------------------- | ---------: | --------------------------: |
| v45 production A     | 4,191.5 ms |    220.6 ms faster (5.000%) |
| accepted v44 control | 4,412.1 ms |                    baseline |
| v45 production B     | 4,206.8 ms |    205.3 ms faster (4.653%) |

The broader warmed 12-map gate then measured:

| Run                  |       Total | Difference from v44 control |
| -------------------- | ----------: | --------------------------: |
| v45 production A     | 24,876.6 ms |  1,774.1 ms faster (6.657%) |
| accepted v44 control | 26,650.7 ms |                    baseline |
| v45 production B     | 24,750.6 ms |  1,900.1 ms faster (7.130%) |

All three canonical runs produced the same 12 signatures in the same order,
made exactly 1,749,802 pathfinding calls and 13,328 enemy-selector calls,
reported no failure, and restored `24a5fc88` exactly. The signatures remained:

`e87fef77`, `16e5f1fe`, `1276fef9`, `3d6cd11b`, `6fb46b85`,
`d223424c`, `5f338976`, `1f879c55`, `cc3df94e`, `4b548f11`,
`bf04036b`, `ba4b4693`.

Sampled `KinkyDungeonFindPath` self time was 6,925.645 ms and 7,048.553 ms
for the two production runs versus 8,580.441 ms for the control, a 17.9% to
19.3% reduction in the target.

A clean isolated-process restart proved production activation. The cold run
produced `3640b168` with 6,315 path calls, 1,990 optimized searches, 41,483
numeric continuation lookups, and 10,428 indexed writes. The warm run produced
`5f338976` with 6,310 path calls and the same optimized-search, lookup, and
write counts. Seven cold searches and two warm searches used the intentional
full fallback.

Compatibility was checked at each new boundary. The explicit disable control,
a transparent `Map.prototype.has` replacement, the public
`KDSetPathfindCache` replacement, and a live mod-registry entry each forced all
1,992 eligible searches and all 1,990 writer calls onto the official cache.
The writer wrapper observed all 1,990 calls and restored exactly; the loaded
mod registry and collection dependency also restored cleanly.

The final 120-enemy stress gate passed every planner mode, all 17 argument
routes, cache compatibility checks, public APIs, hooks, plugin validation, and
developer helpers with zero reachability mismatch or invalid path. The
repository gate passed 142 JavaScript tests, 25 Rust tests, TypeScript, Rust
formatting and Clippy with warnings denied, both release WASM targets, and the
bundle build. The save-safety verifier left all 81 real save files unchanged at
aggregate `56ce90f953f9...`.

The real installation remains official SHA-256
`2D3041A085CBE475A63227FF40709F6D9C1595C77A58545C69EDF359A57605A4`.
The accepted local v45 source SHA-256 is
`0A6C5A32667F40ED8184DC5E0F07E0518D9F36393CD378C09A3DF27B9A6D984E`;
the bootstrap SHA-256 is
`03539CD3750F97C96D61F133652C72DAD1D778FC4A0AB9D454911A4369E8055A`;
and the unchanged WASM SHA-256 is
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.
The source pathfinder signature is `088c0f0251a35468`. The isolated runtime on
port 9223 contains those exact source and bootstrap artifacts. The v5 patcher
and redistribution bundle remain frozen until final cleanup.

Reproduce the oracle, canonical comparison, fallbacks, and stress gate with:

```powershell
node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 1 --pathfinding native `
  --trace-pathfinding-numeric-continuation-index `
  --verify-pathfinding-numeric-continuation-index `
  --output artifacts/mapgen-numeric-continuation-index-v45-equivalence-slow.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --output artifacts/mapgen-numeric-continuation-index-v45-canonical-product-a.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --disable-pathfinding-numeric-continuation-index `
  --output artifacts/mapgen-numeric-continuation-index-v45-canonical-control.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 12 --start-index 0 --pathfinding native `
  --output artifacts/mapgen-numeric-continuation-index-v45-canonical-product-b.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --trace-pathfinding-numeric-continuation-index `
  --disable-pathfinding-numeric-continuation-index `
  --output artifacts/mapgen-numeric-continuation-index-v45-disabled-fallback.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --trace-pathfinding-numeric-continuation-index `
  --probe-path-cache-known-tail-writer-fallback `
  --output artifacts/mapgen-numeric-continuation-index-v45-writer-hook-fallback.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --trace-pathfinding-numeric-continuation-index `
  --probe-map-generation-path-cache-mod-fallback `
  --output artifacts/mapgen-numeric-continuation-index-v45-loaded-mod-fallback.json

node scripts/profile-live-mapgen.mjs `
  --port 9223 --maps 1 --start-index 6 --pathfinding native `
  --trace-pathfinding-numeric-continuation-index `
  --probe-restraint-mod-fallback `
  --output artifacts/mapgen-numeric-continuation-index-v45-map-has-fallback.json

node scripts/stress-live-pathfinding.mjs `
  --port 9223 --enemies 120 `
  --output artifacts/pathfinding-stress-v45-numeric-continuation-index.json

npm run verify:safety
```

Canonical report hashes:

- exhaustive shadow oracle:
  `36BF24754911479F635E27D86F1F7C4F4215EA492ED9B1234B75B5E360DC7A8D`;
- slow production A / control / production B:
  `D74BD3897F31B2F80B1276FB2D27028D1D40F2ECB22A94A88EAEC95B9F3C02BF`,
  `A51F3AB720FD16D3741A673C5C3B173AFE146D631C5E91E9A0AA3A424006634F`,
  `9B8918A341514AE4B7DCB3E1F3CDC807565B386B9CB735BC9E8D43E187ACF35A`;
- canonical production A / control / production B:
  `4D77D229CF9566F60230FE9069B62DF213A21D547A964833629EDBC961101BEE`,
  `FC77A372957F1B94F9795B55305DBEC640767CDBF23F83009940C9B862289ACC`,
  `5E1DE0ECD4B976302476058B09BAA6C9ECD22057D2D84C973E0A24748FC27D79`;
- explicit-disable fallback:
  `0070C0B519C913064D5C728867173F3520837BFCE18FA7CB8EAEECECAEBCD36C`;
- writer-hook fallback:
  `A5EA334F1A102B6C986B3BA06FE72B8CA919D7F25AE1A84D81B876520DD4B1B9`;
- loaded-mod fallback:
  `96FBF60496F6B71E30CD90C2CC3E6062ADA8043FBE8B5D9CED6CCBCC9A855F4F`;
- `Map.has` dependency fallback:
  `50A5586CDB83FEBF77EFA446A0AE8E5E74E7249E7F1AAAD93A84C1497065D789`;
- fresh product cold:
  `D7062240B7CFF9FA580731B46CD660E8069D833FD49DE91FB4CAD81DEB068410`;
- fresh product warm:
  `0D7CF690306390417A91DD5648DA6BB93A42547BC2583E9B8CAE26FAF23555BE`;
- final 120-enemy stress:
  `C3F74571BF332045186179E722C5352FC3ECF36F248B3EAA881F6543F80DF71D`.

## Accepted local v47: fixed-arity direct official facade

The v45 canonical profile still attributed about 1.16 seconds to the generic
runtime facade around KD's official pathfinder. During the accepted v19 map
generation scope, all path calls are already known to target the captured
official `KinkyDungeonFindPath`, but the generic facade still collected a rest
array and used `Reflect.apply` for each call.

v47 registers only the exact 19-argument pathfinding facade with a fixed-arity
direct lane. It retains the same facade object and global-identity check,
increments the same deferred counters, preserves the global receiver, and
calls the captured official function with 19 explicit arguments. Calls with
more than 19 arguments, a replaced `Function.prototype.call`, a public hook,
a legacy global replacement, an inactive direct scope, or any other adapter
continue through the complete argument-copying dispatcher path. No upstream
source or WASM behavior changed.

The uninstrumented slow-map product/control/product gate measured:

| Run                       |      Total | Difference from exact v45 |
| ------------------------- | ---------: | ------------------------: |
| v47 fixed-arity product A | 4,325.8 ms |  148.0 ms faster (3.308%) |
| exact v45 control         | 4,473.8 ms |                  baseline |
| v47 fixed-arity product B | 4,346.9 ms |  126.9 ms faster (2.836%) |

The fresh-process 12-map gate then measured:

| Run                       |       Total | Difference from exact v45 |
| ------------------------- | ----------: | ------------------------: |
| v47 fixed-arity product A | 24,742.9 ms |  715.1 ms faster (2.809%) |
| exact v45 control         | 25,458.0 ms |                  baseline |
| v47 fixed-arity product B | 25,153.7 ms |  304.3 ms faster (1.195%) |

Facade self time fell reproducibly from 1,261.523 ms in the v45 control to
1,158.093 ms and 1,157.927 ms in the two v47 legs, an 8.2% reduction in the
target. Both product legs also lowered p95 map time, from 4,439.8 ms to
4,288.8 ms and 4,342.7 ms.

Every canonical leg made exactly 1,749,802 pathfinding calls and 13,328
enemy-selector calls, produced the same 12 signatures in the same order, and
restored `24a5fc88` exactly:

`e87fef77`, `16e5f1fe`, `1276fef9`, `3d6cd11b`, `6fb46b85`,
`d223424c`, `5f338976`, `1f879c55`, `cc3df94e`, `4b548f11`,
`bf04036b`, `ba4b4693`.

The fixed-lane unit test verifies the global receiver, all 19 arguments, a
20th extra argument through the complete fallback, counters, and return
values. A live public pathfinding hook forced all 6,310 smoke-map calls through
the full dispatcher, ran on every call, removed cleanly, and preserved
`5f338976`. The 120-enemy stress suite passed every planner, all 17 argument
routes, source compatibility checks, public APIs and hooks, plugin validation,
and developer helpers with zero reachability mismatch or invalid path.

The repository gate passed 143 JavaScript tests, 25 Rust tests, TypeScript,
Rust formatting, Clippy with warnings denied, the web-WASM smoke, normal-mod
smoke, and bundle build. The save verifier left all 81 real save files
unchanged at aggregate `56ce90f953f9...`.

The accepted v45 source remains
`0A6C5A32667F40ED8184DC5E0F07E0518D9F36393CD378C09A3DF27B9A6D984E`;
the accepted local v47 bootstrap SHA-256 is
`4E11350A8BAFA53E625A0DA43E7225C59E3022F06D02D3721B7B1F5F2B9882CD`;
and WASM remains
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.
The isolated runtime on port 9223 contains those exact artifacts. The v5
patcher and redistribution bundle remain frozen until final cleanup.

Canonical evidence:

- trace smoke:
  `73E0B43BB3C025325366FFD173DB51BCBC5DB8BD0A8B76A9686E4ECF8AC6D446`;
- slow product A / control / product B:
  `52190C38DB423E42811AFC47E9D21044911B89C51139877F85AA43997A91E34D`,
  `21EA2531E1D50B615BAB120A56DF839C8573F9D1D0D4A4E18D6E47EF677E4A00`,
  `10B311077CECFFBCEBCA7B40BC1042190D40E1B76A920E5F60573DB287CBF104`;
- canonical product A / control / product B:
  `EFAFFCEE0ED79FE6922A31F4BB06F1A4C02878F0AF12F8E2B6B7C242145307C3`,
  `724C4327A0D6D0627CD9CBBBAA44A0AC27A088D5AFE3D0C92280899241B0D6FB`,
  `22BA06B80E02408EF29DCF9B6ABAADFD6C811FF78E44CD1ACB50FA54F080C08D`;
- live-hook fallback:
  `767B64E85D8635C6DA210867F9545F972623BEDF59241E97BF51677F6F0DCA42`;
- final 120-enemy stress:
  `AC3CCBAEB7ACC7F567E7EE56380E112B787C66252FFD9D6FD0E8FB87DDFB7F15`.

## Accepted local v49: ordered accessibility queue

The v47 canonical profile attributed about 1.34 seconds of self time to
`KinkyDungeonGetAccessible` and `KinkyDungeonGetAccessibleRoom`. Both functions
represented their pending flood-fill frontier as an object, constructed
`Object.entries` snapshots to test and enumerate it, and repeated that work for
every breadth-first layer.

v49 keeps the returned object or key array exactly as KD builds it, but tracks
the pending frontier with parallel FIFO location and point arrays. New points
are appended in the same `XX`/`YY` order, existing points stay ahead of the next
layer, and each pending object property is deleted at the same processing
boundary. KD's original object-frontier implementation remains in the same
functions as the fallback.

The queue is enabled only without loaded JavaScript mods and while the captured
`Object`, `Array`, string, map-getter, and tile-getter dependencies retain their
original identities. `disableAccessibleQueue`, a loaded mod, or a replaced
dependency selects the original implementation for that call.

The slow-map source product/control/product gate exercised 507 accessible scans
and 1,212 room scans per leg:

| Run                       |      Total | Accessibility self time |  Difference from control |
| ------------------------- | ---------: | ----------------------: | -----------------------: |
| v49 queue source A        | 4,128.4 ms |              542.556 ms | 140.3 ms faster (3.287%) |
| original-frontier control | 4,268.7 ms |              794.604 ms |                 baseline |
| v49 queue source B        | 3,940.6 ms |              559.403 ms | 328.1 ms faster (7.686%) |

The adjacent 12-map product/control/product gate then measured:

| Run                       |       Total | Accessibility self time |  Difference from control |
| ------------------------- | ----------: | ----------------------: | -----------------------: |
| v49 queue source A        | 24,232.2 ms |              822.542 ms | 600.0 ms faster (2.416%) |
| original-frontier control | 24,832.2 ms |            1,339.268 ms |                 baseline |
| v49 queue source B        | 24,226.1 ms |              996.206 ms | 606.1 ms faster (2.441%) |

Both product legs lowered p95 map time, from 4,263.8 ms to 4,011.0 ms and
4,062.0 ms. Every leg made exactly 1,749,802 pathfinding calls and 13,328 enemy
selector calls, produced the same 12 map signatures, and restored the
`24a5fc88` fixture exactly.

An exhaustive shadow oracle on the unmodified v47 source compared all 1,450
`KinkyDungeonGetAccessible` results and all 1,224
`KinkyDungeonGetAccessibleRoom` results. All 2,674 calls matched key count, key
order, and coordinates with zero mismatch. A separate replaced-`Object.entries`
probe took the original branch for all 14 observed calls, invoked the
replacement 2,820 times, restored the built-in identity, and preserved the map
signature.

The 120-enemy stress suite passed every planner mode, all 19 pathfinding
arguments, public API routes, hooks, plugin validation, and developer helpers.
The developer-helper probe now restores both `KinkyDungeonState` and the
deferred `KDGenMapCallback` before returning. A fresh rerun passed both
lifecycle assertions and left the renderer with zero TypeErrors, avoiding the
synthetic post-map autosave that previously escaped the fixture.
The full safety gate passed 143 JavaScript tests and 25 Rust tests; Rust format,
Clippy with warnings denied, WASM smoke, normal-mod smoke, and the 81-file save
snapshot also passed. The real save aggregate remained
`56ce90f953f9...`.

The accepted local v49 source SHA-256 is
`6EDF6960A2C8C7CC675561E9D1B03EA9B33E4B90399CF05BFBED4B617F0A61A2`.
The v47 bootstrap remains
`4E11350A8BAFA53E625A0DA43E7225C59E3022F06D02D3721B7B1F5F2B9882CD`,
and WASM remains
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.
The v5 patcher and redistribution artifacts remain frozen; this candidate is
installed only in the isolated local test tree.

Evidence:

- slow-map source product A:
  `mapgen-accessible-queue-source-v49-slow-product-a.json`,
  `4699F9032618C3D2A6F92569798C9366D685D930DD84AF36DCC0A848A1F5B0C4`;
- slow-map source control:
  `mapgen-accessible-queue-source-v49-slow-control.json`,
  `0B66DC8641ED8E7850663B7C905051D9BB0A0081FF1CD3B8D0D2F6B20813CA0A`;
- slow-map source product B:
  `mapgen-accessible-queue-source-v49-slow-product-b.json`,
  `CFB47B9F68068D85E2E9D3778ACF5887E79ED53CE7BBAC49CE6B3EC5E1E70C01`;
- canonical source product A/control/product B:
  `mapgen-accessible-queue-source-v49-canonical-{product-a,control,product-b}.json`,
  `B303BF12C02BF36E6C68BCD8EB4AB293A6A32BF99D00646369CBFD3787FD89A3`,
  `C15E74B1EB1DBD995BCB9059587D42A485AB8CFE8AEE2851266A450B0731C93D`,
  and `3A7CC6B717973B330C0D1A3B79F84C08B74C8E7EA6CD815EB82F740BD752C9FB`;
- exhaustive output oracle:
  `mapgen-accessible-queue-v49-canonical-equivalence.json`,
  `4A55C2AE75420B652FF5DCF89B6CD3F797CCB0D7983A2362129060968F1CDDEB`;
- source mod fallback:
  `mapgen-accessible-queue-source-v49-mod-fallback.json`,
  `118FC374C8B70FA0EBC886B5C0B143EE7ACE44E3050AECE0E0CB7C763D3B7B7E`;
- final 120-enemy stress:
  `pathfinding-stress-v49-accessible-queue-callback-fixed.json`,
  `0F267C88D7A51A8E6F0DA6ABFECA0688184D6AD3BB92425EF16892A9A70FE28B`.

## Accepted normal-mod package: official loader and fresh-process parity

The runtime map-generation and enemy-selector adapters are also packaged as a
normal KD mod. This is deliberately narrower than the source-patched developer
build: KD's official loader records every ZIP entry in `KDAllModFiles`, so the
lexical source optimizations retain their conservative loaded-mod fallback.
The normal ZIP still installs the guarded runtime adapters and WASM bridge
without changing `index.html`, `out/main.js`, or save data.

The official loader test now has two explicit lifecycle modes. Its ordinary
mode seeds the smoke map deterministically and asserts that the deferred
`KDGenMapCallback` boundary is unchanged. Its load-only mode proves that the ZIP
can initialize all facades and WASM without generating a map first.

An earlier sequential product/control/product attempt was rejected because its
first product leg did not match the later legs. The profiler restored the same
serialized map signature, but KD also has non-serialized process globals that
the save does not reset. That made sequential legs after a separate loader map
an invalid equivalence fixture. Two fresh-process gates isolated the boundary:

| Fresh-process gate                    | Runtime selector | Official selector |  Difference |
| ------------------------------------- | ---------------: | ----------------: | ----------: |
| Load-only, then deterministic fixture |      56,515.3 ms |       68,212.8 ms | 17.15% less |
| Deterministically seeded loader smoke |      56,310.0 ms |       68,284.6 ms | 17.54% less |

The load-only pair matched all 12 signatures, 13,323 selector calls, 1,749,785
path calls, and the exact `24a5fc88` restore. The seeded-smoke pair matched all
12 signatures, 13,323 selector calls, 1,749,783 path calls, and the exact
`9e5e57db` restore. The latter is the package timing gate because it exercises
the same generated-map loader smoke before each fresh arm.

The final ZIP then passed the real loader twice. The clean run routed all 408
enemy selections through the runtime adapter while all 4,325 transient
map-generation path queries stayed on KD's official direct fallback. A second
run loaded a legacy mod after KD Hybrid; the replacement remained the visible
global, all 408 selector calls routed to JavaScript fallback with
`legacy-global-replaced`, and the captured-facade compatibility path completed
without recursion or failures. The shared `mapGeneration` system label is only
a diagnostic grouping: status enumeration retains separate CreateMap and
GetEnemy facade records, while the single-system lookup intentionally returns
CreateMap as the primary record.

The frozen normal-mod artifact is
`rusted-kinks-kd-hybrid-0.1.0-kd-5.4.92.zip`, SHA-256
`EEE0E1A0547A86B3152A845357C827EE8768ECC46A0BA59213BFD551F6A555F4`.
It contains 15 expected entries, including both licenses, notices, and the
corresponding MPL-covered source. It contains no executable, DLL, save,
LevelDB, user-data, or token files. The bundled `KDHybrid.js` SHA-256 is
`7C78101289BF7C74F8EFC89036F2143E7F7FC9816CF4E670C376311FFBE8582D`;
WASM remains
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.

The final safety gate passed 144 JavaScript/TypeScript tests, 25 Rust tests,
Rust format, Clippy with warnings denied, a clean build/package, both official
loader runs, and the 81-file save snapshot. The real-save aggregate remained
`56ce90f953f9...`. After the package tests, the isolated source-testing build
was restored byte-for-byte to v49 source
`6EDF6960A2C8C7CC675561E9D1B03EA9B33E4B90399CF05BFBED4B617F0A61A2`,
v47 bootstrap
`4E11350A8BAFA53E625A0DA43E7225C59E3022F06D02D3721B7B1F5F2B9882CD`,
and the existing WASM hash above; its one-map relaunch smoke passed.

Evidence:

- load-only fresh product/control:
  `normal-mod-mapgen-cold-load-only-{product-a,control-a}.json`,
  `328296E51A19F0CD2B02BB8A4FAAED116B03B4CF00F93C8BBA2D27BDF1B28FA7`
  and
  `5A1B3144DCE38C25BD5DE41770C3CB1D8A0BB592528A63900B42A8B07077BCE0`;
- seeded-smoke fresh product/control:
  `normal-mod-mapgen-deterministic-smoke-{product-a,control-a}.json`,
  `3205F51F6F7F1E6CEA605F0F24C534AAF8B573EE53076465628A7A4AD01F517D`
  and
  `A17CD20E7D4B34173FF1B5F6F1ADB020D9A41E6E6B088CED72A4339EA619CEE7`;
- final clean and late-replacement loader reports:
  `normal-mod-loader-final-{clean,late-replacement}.json`,
  `D4C1F5AEA2AC0B9E7B6A21A45B8A2679B081A3DC650891B66BC2642C1A0A9A8E`
  and
  `ABA1C75B5B6ADFBA275723449EC5552F0C92F7F446C28FB81440D644B8C84452`;
- restored v49 one-map smoke:
  `mapgen-v49-restored-after-normal-mod-final.json`,
  `4D19CDBD018BF08BCD39F718C251338B2319AF092CDCD84BD4B76A1CA0EFE5E5`.

## Accepted local v50: reuse the door-placement room traversal

`KinkyDungeonPlaceDoors` computes the room reachable from a prospective door,
scans that returned array without changing the map, and then immediately asks
for the same room again with the same coordinates. v50 reuses the first array
for that second read. It does not change either accessibility function or the
array returned to any caller.

The source branch is enabled only when v49's full accessibility guard passes
and `KinkyDungeonGetAccessibleRoom` still has its captured identity. A loaded
mod, a replaced dependency, or
`disablePlaceDoorsAccessibleReuse` keeps the second official call. The patch
records `placeDoorsAccessibleReuse` as `5.4.92-source-v1`; it remains a local
source-testing change and is not in the frozen normal-mod ZIP, patcher, or
redistribution artifacts.

The CPU-sampled slow-map product/control/product gate removed 202 duplicate
room traversals per product leg. `KinkyDungeonGetAccessibleRoom` self time was
297.145 ms and 283.474 ms in the product runs, versus 359.204 ms in the
control. All three legs retained signature `c7ebd034`, 492,779 path calls,
2,929 selector calls, and the exact `24a5fc88` restore.

Because this slice is much smaller than normal profiler variance, its timing
gate used two inverse wall-only ABBA cycles over the canonical 12 seeds:

| Mode    | Four-run totals (ms)                   |  Mean total |
| ------- | -------------------------------------- | ----------: |
| v50     | 22,621.3; 22,840.2; 22,650.8; 22,678.1 | 22,697.6 ms |
| control | 22,996.4; 22,745.9; 22,562.5; 22,803.1 | 22,777.0 ms |

The combined saving was 79.4 ms per 12 maps, or 0.35%. Both ordering cycles
were positive in aggregate. Every one of the eight legs produced the same 12
signatures, exactly 1,749,802 path calls, exactly 13,328 selector calls, and an
exact save restore.

A separate 36-seed oracle recomputed the official second result at all 214
reuse sites and compared constructor, length, order, and every element. All
214 matched. The loaded-mod probe then took the fallback in all 101 observed
door-placement calls, made the expected 202 official room calls, performed
zero reuses, and restored `KDAllModFiles` exactly. The final gate passed 144
JavaScript/TypeScript tests, 25 Rust tests, TypeScript checking, and the
81-file save snapshot at the unchanged `56ce90f953f9...` aggregate.

The accepted local v50 source SHA-256 is
`878F59411B679386710159836E52053AD22F3982066B8F8558A8815C3BE763CC`.
The patched index remains
`8BF32473D0F12BD06EE46990C7645E029AFB073EC33CAB0A33CA4399C65D0FF9`,
the v47 bootstrap remains
`4E11350A8BAFA53E625A0DA43E7225C59E3022F06D02D3721B7B1F5F2B9882CD`,
and WASM remains
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.
The real installation still has official `main.js`
`2D3041A085CBE475A63227FF40709F6D9C1595C77A58545C69EDF359A57605A4`.

Evidence:

- wall-only ABBA cycle one:
  `mapgen-v50-place-doors-room-reuse-wall-12-{product-a,control-a,control-b,product-b}.json`,
  `D92228925A398D16A032305838083A0E9249FE0D69E9033285C0C0EB3F52C4A1`,
  `03827DC78CA0D9C2C55408C5F80F6A093662320F71F295383195465F4B8C6675`,
  `2E64D977CC6FEE41158B1F57033656D43AE3C043B2E441807E07280CCCDAF73A`,
  and
  `7A2DDC475CE1FEB07A7B641989EF81CDA1F16FE747B217E5491CD517392C03F7`;
- inverse ABBA cycle:
  `mapgen-v50-place-doors-room-reuse-wall-12-{control-c,product-c,product-d,control-d}.json`,
  `FE2080C1C02A072BBDC17D27A110306E01A56A5BB5D4501DCB2F97CED0EA0A9B`,
  `B5C65671B5A5FF5C8182EB4E0AF02C1C0DF40ED5EEF37F63F8EE943188AA8C93`,
  `C7A34163F641C01A1C2FD48180C09B449A8741270FE545CFBA114CF7FC1DBEAC`,
  and
  `91AB1C17AFBA855BF33726756C27427A022983BBDC4D8A9A789ECC44A547537F`;
- 36-seed result oracle:
  `mapgen-v50-place-doors-room-reuse-oracle-36.json`,
  `B99DFB0499A28A9782275234192CD74E68E2078E18B31BC06D2A4D14BD1ACE5C`;
- loaded-mod fallback:
  `mapgen-v50-place-doors-room-reuse-source-mod-fallback.json`,
  `0410536123680B59448ED81A29D9522314483ECB204EE21C532CBD96851A232C`;
- final fresh-process smoke:
  `mapgen-v50-final-fresh-smoke.json`,
  `85F15F45ACE7898C3A4098FD5319F19E9F283B571C68B17F9EBAF32D6776A638`.

## Accepted local v51: map-tile filling coordinate reuse

The canonical `KDCheckMapTileFilling` loop reconstructed the same coordinate
string up to nine times and reread the same `indices` property up to seven
times for each candidate cell. v51 adds an equivalent helper that constructs
that coordinate once and retains the first index value.

The public `KDCheckMapTileFilling` function remains byte-for-byte official.
Only canonical calls inside `KD_GetMapTile` select the optimized helper, and
only when no mod is loaded, the official filling and loose-index helpers keep
their captured identities, the relevant built-ins are unchanged, and all
three map-index arguments are plain objects. Otherwise the existing official
call runs. This keeps mod-visible helper replacement and direct helper calls
on KD's original implementation.

Two inverse four-leg wall-only cycles covered the canonical 12 seeds:

| Mode        | Four-run totals (ms)                   |  Mean total | Mean per-run median |
| ----------- | -------------------------------------- | ----------: | ------------------: |
| v51 source  | 22,213.9; 22,412.4; 22,390.1; 22,460.7 | 22,369.3 ms |          1,574.9 ms |
| v50 control | 22,552.3; 22,753.3; 22,584.7; 22,940.1 | 22,707.6 ms |          1,604.0 ms |

The aggregate saving was 338.3 ms per 12 maps, or 1.49%. Every product leg was
faster than the mean control, and both ordering cycles were positive. All
eight legs produced the same 12 signatures, exactly 1,749,802 path calls,
exactly 13,328 selector calls, and the exact `24a5fc88` restore.

The traced 12-map source run made 24,489 optimized `KD_GetMapTile` calls and
1,288,780 optimized fit checks. Its source oracle called the untouched
official helper beside every optimized fit check; all 1,288,780 Boolean
results matched, and the wrapper restored exactly. A loaded-mod probe forced
all 2,828 observed slow-map tile-selection calls to official fallback, made
zero optimized fit checks, and restored `KDAllModFiles`. Replacing
`KDCheckMapTileFilling` separately also forced all 2,828 calls to fallback,
exercised the replacement 144,430 times, and restored it.

The final safety gate passed TypeScript checking, all 144 JavaScript/TypeScript
tests, all 25 Rust tests, and the 81-file real-save snapshot at the unchanged
`56ce90f953f9...` aggregate. A fresh-process smoke then exercised 2,828
optimized tile-selection calls and 144,430 fit checks with signature
`c7ebd034` and an exact restore.

The accepted local v51 source SHA-256 is
`00623DBB6CDDC6BC8E732F2495C4755F4B11FDB976EEF6A278DFD43547914A34`.
The patched index remains
`8BF32473D0F12BD06EE46990C7645E029AFB073EC33CAB0A33CA4399C65D0FF9`,
the v47 bootstrap remains
`4E11350A8BAFA53E625A0DA43E7225C59E3022F06D02D3721B7B1F5F2B9882CD`,
and WASM remains
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.
This remains local source-testing work; the v5 patcher, redistribution
artifacts, and frozen normal-mod ZIP were not changed.

Evidence:

- first product/control/product/control cycle:
  `mapgen-v51-map-tile-filling-source-canonical-{product-a,control-a,product-b,control-b}.json`,
  `E0268A5DEB104744C4496E3718927417CEE8314769210118EFC31860F602051C`,
  `90C2F792ED4D26504A002C696008019239A4699C1C4D707FD21C762C289246D2`,
  `CD2CD298E7AEFE9EC3C71DFCE268D8EAC1133C7321F6303A11492550DF15264D`,
  and
  `97F843E57DDA9F8B2135619FE619FB1DAF91EBC32844A845DB9F967730780FD5`;
- inverse control/product/product/control cycle:
  `mapgen-v51-map-tile-filling-source-canonical-{control-c,product-c,product-d,control-d}.json`,
  `67F3F3493472172B510CB23977EA4A4EA871418405F2DA0E3F11E6A199D82A83`,
  `C9339D942934798D6CE46784E32CCAAFA26A2EFC69EFBC8D9CFF63E654C0A53D`,
  `46C949F2080A6C5397EF6E5193A45B6266976B17DDB4CD3D4189498F166FFF2C`,
  and
  `EBA9E8546FFE50D5220F560879E439C640A6A8019F3DDFBED8AC7F7120B5AE76`;
- 1,288,780-call source oracle:
  `mapgen-v51-map-tile-filling-source-canonical-oracle.json`,
  `2D4431862CBDBFB7EF673A3995115F06365E8E1EDCD028C2ECF1C851D1FED489`;
- loaded-mod fallback:
  `mapgen-v51-map-tile-filling-source-mod-fallback.json`,
  `2ED838968D78992BC7B10AC20FF5B051710B8345B718E32BB99E479B57E16DC2`;
- replaced-helper fallback:
  `mapgen-v51-map-tile-filling-source-helper-fallback.json`,
  `E85743A541A1F9565E29DC044EB680F5FE834DD799C01B45D90D35E055C48B58`;
- final fresh-process smoke:
  `mapgen-v51-final-fresh-smoke.json`,
  `A32FAC00BB804AB0CA64B7C2771598655B32E3461AEFDA6982A29E176B06D39C`.

## Accepted local v52: serialized map-tile template cache

`KD_PasteTile` needs a fresh, mutable clone for every placement, but KD made
that clone by both stringifying and parsing the same canonical template every
time. v52 retains the template's serialized JSON and still calls `JSON.parse`
for every placement. Callers therefore continue to receive distinct objects;
only repeated `JSON.stringify` work is removed.

The cache accepts only the exact tile object stored under its name in the
plain `KDMapTilesList` catalog. It is disabled while the tile editor is open,
for a tile-editor test tile, whenever a mod is registered, or if the captured
JSON, WeakMap, or Object built-ins change. The cache is replaced when the
catalog identity changes, which is also how the editor commits its working
catalog. Entering any fallback mode clears the retained catalog cache before
the exact official `JSON.parse(JSON.stringify(tile))` expression runs.

Four product and four disabled-control legs covered the canonical 12 seeds:

| Mode        | Four-run totals (ms)                   |  Mean total | Mean per-run median |
| ----------- | -------------------------------------- | ----------: | ------------------: |
| v52 source  | 22,837.7; 22,688.4; 22,498.0; 22,603.8 | 22,657.0 ms |          1,589.6 ms |
| v51 control | 23,312.5; 22,497.2; 22,942.6; 22,738.0 | 22,872.6 ms |          1,595.6 ms |

The balanced mean saving was 215.6 ms per 12 maps, or 0.943%. Three of four
paired comparisons favored v52. All eight legs produced the same 12
signatures, exactly 1,749,802 path calls, exactly 13,328 selector calls, and
the exact `24a5fc88` restore.

The source oracle exercised 24,489 optimized placements. It had 24,395 cache
hits and 94 misses, re-stringified every hit beside the cached value, and
found zero mismatches. Its disabled control retained every signature and call
count. A loaded-mod probe sent all 2,525 observed placements through official
cloning, used the cache zero times, and restored `KDAllModFiles` exactly.

CPU attribution also stayed in the intended slice. Disabled `KD_PasteTile`
self time was 506.335 ms. The two product profiles split cloning between
`KD_PasteTile` and the cache helper at 176.383 + 249.928 ms and
169.161 + 255.411 ms, saving roughly 80-82 ms of sampled self time per 12
maps. Whole-profile totals still moved with pathfinding variance, so the
uninstrumented eight-leg mean remains the acceptance score.

The final gate passed source syntax checking, TypeScript checking, all 144
JavaScript/TypeScript tests, all 25 Rust tests, and the 81-file real-save
snapshot at the unchanged `56ce90f953f9...` aggregate. A fresh-process smoke
then made 2,525 optimized placements, verified 2,509 cache hits with zero
mismatches, retained signature `e87fef77`, and restored exactly.

The accepted local v52 source SHA-256 is
`62C04FF3465C7E3A05954AACC2C38C5AC0F98F6AFA5AC09A05ABF3E9DA494844`.
The patched index remains
`8BF32473D0F12BD06EE46990C7645E029AFB073EC33CAB0A33CA4399C65D0FF9`,
the v47 bootstrap remains
`4E11350A8BAFA53E625A0DA43E7225C59E3022F06D02D3721B7B1F5F2B9882CD`,
and WASM remains
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.
The real installation still has official `main.js`
`2D3041A085CBE475A63227FF40709F6D9C1595C77A58545C69EDF359A57605A4`.
This is source-testing work only; the v5 patcher, redistribution artifacts,
and frozen normal-mod ZIP were not changed.

Evidence:

- first product/control/product/control cycle:
  `mapgen-v52-paste-tile-source-canonical-{product-a,control-a,product-b,control-b}.json`,
  `A7700995E473989048986ABDC5F209801095F39AB8270B96E19CE9530BDACE1D`,
  `0214666A14D7B3DA90DDC47BE5FCC2E4D1A50635F8A4FF2012A35D8824C3ABD9`,
  `419F88301748D5C0F941DB80DC202E60D1EDC0B58F5E56325369381CA1EFC362`,
  and
  `691AE8F1F2E419C6D6DA5518172D8017D03681D839CBABF5A6B08042E9784150`;
- reverse control/product/control/product cycle:
  `mapgen-v52-paste-tile-source-canonical-{control-c,product-c,control-d,product-d}.json`,
  `97AA1A320F037F24E00F90588D5FD488C1B0CACC5695B619719953761E60D2DB`,
  `6D678B6CAA10E1C380A4F1328F1850E2C039A43F90AA7508258A6DBE7077B9ED`,
  `D1EF9E6DE4A1E89370BEB0C5D5AB17E1A002CE693D38FEEA4BA7AE034D394D5D`,
  and
  `26A5322408AF5BEAE380B4878EDBFCDC15964392797F277C74A10CBEAF2CCDEB`;
- source oracle and its disabled control:
  `mapgen-v52-paste-tile-source-canonical-{oracle,control-oracle}.json`,
  `4E1104E4E3744056C6DB83F1545FFBC2CFAEC58073E516F18A4089736E2273E3`
  and
  `0B02B22B8E3011AF8B5F9439EC39D3E632F7BBC3379150FE933E2624F6142FEC`;
- loaded-mod fallback:
  `mapgen-v52-paste-tile-source-mod-fallback.json`,
  `ED9A1C8445118E12788C44D3862A9A61DF35A4DA7E732E80A82DBBFA5AC79154`;
- CPU product/control/product attribution:
  `mapgen-v52-paste-tile-source-profile-{product-a,control,product-b}.json`,
  `17E3569B24D9DC390E3DEF88BF062C4A19D09996A08C1D5869B35C9799B7110E`,
  `B488829DC67E778B8A30BB4E7D2B6173C5F77FEBB6B2029DF7D807217820070C`,
  and
  `41A50EA3537A9A32F80ED251D39BFC06C56F271A8EAB50E0584361901D82AA31`;
- final fresh-process smoke:
  `mapgen-v52-final-fresh-smoke.json`,
  `30DC1DAACB8317867879787BC39C6900D0650BF82FB8272F39FDF005E05012EE`.

## Accepted local v62: one proof for the canonical restraint catalog

The accepted enemy-tag loop still paid its complete compatibility proof for
every restraint that reached the weighted scan. The exact 5.4.92 catalog has
726 definitions, and all 726 were already captured with plain numeric tag
tables. v62 proves that unchanged catalog and its four helper dependencies once
per top-level query, then reuses the result across the loop. A loaded mod,
nonempty mod-file list, replaced catalog proof, changed `Map` helper, existing
disable switch, or failed oracle check keeps the v52 per-restraint route.

The 12-map shadow oracle checked 4,789,392 catalog-fast restraint visits against
the old helper and found zero mismatches. All 12 map signatures, 1,749,785
pathfinding calls, 13,323 selector calls, and the `24a5fc88` restore matched
the cold v52 fixture exactly. The final tightened source then shadowed another
738,916 visits in a fresh smoke map with zero mismatches.

Fresh Electron processes compared the final source directly with byte-exact
v52, avoiding the branch overhead that can distort an in-source disable
control:

| Source            | 12-map total |
| ----------------- | -----------: |
| v62 product C     |  21,376.2 ms |
| v62 product D     |  21,380.2 ms |
| exact v52 control |  21,825.5 ms |

The two v62 products differed by only 4.0 ms. Their 21,378.2 ms mean saved
447.3 ms, or 2.05%, against v52. Every report passed and restored exactly.

Fallback probes also retained `e87fef77`, 115,645 path calls, 707 selector
calls, and `24a5fc88` restore state:

- the explicit catalog disable routed 1,212 queries and 691,042 restraint
  visits through the prior per-restraint proof;
- loaded-mod state routed 1,215 queries and 692,635 visits through that same
  compatible path;
- a reversible catalog-proof identity mismatch routed all 1,212 queries
  through the prior proof; and
- a delegating `Map.prototype.get` replacement forced all 691,042 visits
  through the exact original tag-order loop.

The final gate passed source and profiler syntax checks, TypeScript checking,
all 144 JavaScript/TypeScript tests, all 25 Rust tests, and the 81-file
real-save snapshot at the unchanged `56ce90f953f9...` aggregate.

The accepted local v62 source SHA-256 is
`802D0E0D238132317C2BFABCF42270D196ED4AA9FCD08A2755055745FE76281E`.
The patched index remains
`8BF32473D0F12BD06EE46990C7645E029AFB073EC33CAB0A33CA4399C65D0FF9`,
the accepted v47 bootstrap remains
`4E11350A8BAFA53E625A0DA43E7225C59E3022F06D02D3721B7B1F5F2B9882CD`,
and WASM remains
`3291F779FC7582F2668D97A5EF1F868EB66880F49C94A88FFBD6CC312E2F55AD`.
This remains local source-testing work. The frozen normal-mod ZIP, v5 patcher,
redistribution artifacts, real game installation, and GitHub were not changed.

Evidence:

- final direct-source product/control/product reports:
  `mapgen-v62-final-source-swap-cold-product-{c,d}.json` and
  `mapgen-v62-source-swap-cold-control.json`,
  `166DD613EBEBA31E57DF843D0D1919B93A2A8AA2FA22A3C2D5DAFF7DA1E176F4`,
  `314473ADFBB11B7B732F1134F7476F2EF75A774449DA45DBB095F2F21DFA1CC0`,
  and
  `E4BCA36043CE8A502D01D5AB67FA18C242E80EA546E3FFC758550A3A3234FD44`;
- 12-map catalog oracle:
  `mapgen-v62-eligible-restraint-catalog-proof-oracle-12map.json`,
  `F4D612FF3D5B1EE2B2899B85E8FF7ABD4574540C41DEC76BC23036A9791A27A9`;
- final-source oracle smoke:
  `mapgen-v62-final-catalog-proof-oracle-smoke.json`,
  `0CAC7DA97068FBB3956ED8EEB3345FB06E6778F670347B1979D0026B9FFBB900`;
- disable, loaded-mod, catalog-proof, and dependency fallbacks:
  `mapgen-v62-eligible-restraint-catalog-proof-fallback-{disabled,mod-loaded,catalog-proof-mismatch,map-get-hook}.json`,
  `382D0F4F152EA591B4FB122400AEAAAF1A7BB047543EA905A5C0138DF3DFF009`,
  `499DD9FAD9414D1843158022E493FF5B9BB404E5D24146CFD7D08D5B2C6B7934`,
  `8D9C10ED4DE826F52913A907DD23725764EF76B2BFE997A8C6B96FD68CAB8AF2`,
  and
  `702648D8FE2D173A86381671DD27DE589EF350146FCF435F4615262993857214`.

## Accepted local v63: reuse the restraint scan only for private retries

`KDGetRestraintsEligible` lowers its weight threshold recursively when the
first pass finds no result. The slow canonical map made 1,515 calls: 1,313
top-level calls plus 202 retries. All 202 retries kept the same base arguments,
and 101 top-level queries made both the `0.09` and zero-threshold retries. That
repeated the 726-definition catalog scan even though only the threshold had
changed.

v63 keeps the first pass's private candidate list immutable and passes it to
the immediate recursive call with an unforgeable token. The retry still
recomputes player-state eligibility, variants, filters, and fresh result
objects. Reuse requires the accepted v62 catalog proof, the same catalog, tag
map, enemy, effective level, floor, filter, extra-tag object, arousal mode, and
new-game state. An explicit disable, loaded mod, nonempty mod-file list, failed
v62 proof, or `options.extraOptions` takes the original rescan route. The
canonical recursion audit saw zero retries with `extraOptions`.

On the slow trace, v63 reused 202 calls and reduced catalog-loop restraint
visits from 843,249 to 732,755. The final 12-map shadow gate compared 6,148
top-level result arrays entry by entry and found zero shape, restraint,
variant, inventory-variant, or `Object.is` weight mismatches. That diagnostic
deliberately invokes eligibility twice and therefore is not a timing report;
the direct source-swap gate below is the whole-map equivalence and performance
boundary.

Fresh Electron processes compared final v63 with byte-exact v62 in
product/control/product order:

| Source            | 12-map total | `KDGetRestraintsEligible` self time |
| ----------------- | -----------: | ----------------------------------: |
| v63 product A     |  22,977.1 ms |                        2,064.158 ms |
| exact v62 control |  23,317.9 ms |                        2,612.847 ms |
| v63 product B     |  23,167.1 ms |                        2,163.828 ms |

Both products improved. Their 23,072.1 ms mean saved 245.8 ms, or 1.05%,
against v62. Target self time averaged 2,113.993 ms, saving 498.854 ms or
19.1%. All three reports produced the same 12 signatures, exactly 1,749,785
path calls and 13,323 selector calls, and restored `24a5fc88`.

The explicit-disable gate rescanned all 1,515 calls, retained `c7ebd034`, and
restored exactly. The loaded-mod gate rescanned all 117 calls, retained
`5f338976`, restored the temporary mod-file entry, and restored the fixture
exactly. The final repository gate passed source and profiler syntax,
TypeScript checking, all 144 JavaScript/TypeScript tests, all 25 Rust tests,
and the unchanged 81-file real-save aggregate `56ce90f953f9...`.

The accepted local v63 source SHA-256 is
`75C07C4B8975471B8FAB65A49E646F40A42EB8B92BB71AC2293123FC06C35EAB`.
The patched index, v47 bootstrap, WASM, frozen normal-mod ZIP, v5 patcher,
redistribution artifacts, real game installation, and GitHub were not changed.

Evidence:

- final product/control/product reports:
  `mapgen-v63-final-source-swap-product-a.json`,
  `mapgen-v63-final-source-swap-v62-control.json`, and
  `mapgen-v63-final-source-swap-product-b.json`,
  `84101B0CCB7598048E694043848443B1C96C1F2279BC005B6C4E68C12FF77738`,
  `DBA2306002BE2A4E3A0413E52C5292D3DADC43E83221FFD7CB7FB643A4F76E92`,
  and
  `2E3CCAEFD2E4671C4344C960FF1B5317061BFFE1821431ED763D11A5F1F0EAB3`;
- final 12-map result oracle:
  `mapgen-v63-final-retry-reuse-equivalence-12map.json`,
  `0819D09129CE2A54A725AC939BF40D569A8861D803BD7DC914B7B7D2EA65CEE2`;
- recursion and `extraOptions` audit:
  `mapgen-v63-restraint-recursion-options-audit-slow.json`,
  `1B9881C6DF3497FA526B59CB8416FE8B992CBE63BE8BD0E84040E4171199EBD5`;
- final product trace:
  `mapgen-v63-final-retry-reuse-trace-smoke.json`,
  `9F6A345D41C489BCFC17043FD8DDEAF149753728AF12A6A3F26FCDFB7879703`;
- explicit-disable fallback:
  `mapgen-v63-final-retry-reuse-disabled-fallback.json`,
  `56A8EE05660F3C43402267C30CC93FFC6986D08D5B0D6D60446A602646065F0A`;
- loaded-mod fallback:
  `mapgen-v63-final-retry-reuse-loaded-mod-fallback.json`,
  `FBC635820A3E0328F00CBEE9FC3BFE92E94FF06DE96DE76070EBAAFB653C764A`.

## Accepted local v65: single-entry raw restraint-query reuse

After v63 removed recursive rescans, the slow-map audit found only four
distinct raw catalog queries across 1,313 top-level eligibility calls. Of
those calls, 1,309 repeated a prior query and 909 immediately repeated the
preceding query, in runs as long as six. All 909 consecutive final result
arrays differed, so caching full eligibility results would be wrong; player
state, variants, and final weights must still be recomputed.

v65 instead keeps one immutable pre-player-state candidate list. A hit requires
the same finite effective level, floor index, canonical string-tag `Map`,
dense plain-string `requireTags`, `filterGroups`, and `require` sequences,
arousal mode, and new-game state. It also requires the v62 catalog proof, no
loaded mod or mod files, plain options without `extraOptions`, and captured
`Array`, `JSON`, `Map`, `Number`, and `Object` helpers. The key preserves tag
and sequence order. A changed query replaces the one entry; an unsupported
shape, dependency change, explicit disable, mod, or catalog fallback clears it.
The v63 retry token remains a separate, narrower reuse path.

On the slow map, v65 scanned only 404 calls, reused 909 top-level calls, and
reused 202 private retries. Catalog-loop restraint visits fell from 732,755 to
221,998. Enabled and disabled runs then emitted the complete sequence of 1,313
top-level result fingerprints. Every index matched exactly, including
restraint and variant identity, inventory variant, and
`Object.is`-sensitive weights. Both retained `c7ebd034`, 492,779 path calls,
2,929 selector calls, and exact `24a5fc88` restore.

Fresh Electron processes compared final v65 with byte-exact v63 in
product/control/product order:

| Source            | 12-map total | `KDGetRestraintsEligible` self time |
| ----------------- | -----------: | ----------------------------------: |
| v65 product A     |  20,874.0 ms |                          565.077 ms |
| exact v63 control |  22,665.2 ms |                        2,060.089 ms |
| v65 product B     |  21,021.4 ms |                          573.632 ms |

Both products improved. Their 20,947.7 ms mean saved 1,717.5 ms, or 7.58%,
against v63. Target self time averaged 569.355 ms, saving 1,490.734 ms or
72.4%. All three reports produced the same 12 signatures, exactly 1,749,785
path calls and 13,323 selector calls, and restored `24a5fc88`.

Replacing `Map.prototype.has` forced all 117 smoke calls through the original
tag-order/catalog route with zero top-level or retry reuse. A loaded-mod entry
also forced all 117 calls to scan, then restored its registry entry exactly.
The final repository gate passed source and profiler syntax, TypeScript
checking, all 144 JavaScript/TypeScript tests, all 25 Rust tests, and the
unchanged 81-file real-save aggregate `56ce90f953f9...`.

The accepted local v65 source SHA-256 is
`6F4B05D037529E3F85F7339DD2B456F8AD957D21586E9A7643024DF54FCA5D9F`.
The patched index, v47 bootstrap, WASM, frozen normal-mod ZIP, v5 patcher,
redistribution artifacts, real game installation, and GitHub were not changed.

Evidence:

- final product/control/product reports:
  `mapgen-v65-final-source-swap-product-a.json`,
  `mapgen-v65-final-source-swap-v63-control.json`, and
  `mapgen-v65-final-source-swap-product-b.json`,
  `F97372DA3910497AFC2672C1BDB6C5EE896F0259C1D82D6D0C41648719B532C4`,
  `C5AB6C641E136332894B6444841C6C03A7F2FEF44D525408C81677481025124F`,
  and
  `B756B2FF20E3D2F2E15295F81DAD85C4C7B14675E8996356B83C833B8E073A10`;
- exact result-sequence product/control:
  `mapgen-v65-final-result-sequence-{product,control}.json`,
  `FBA2D90835717FB1680F33890834356F65E5E377EB24D1EDE28D2B591FAAE0C7`
  and
  `D7A252C36058359987EAD38A1A9193714ECDEDC74D815BD97A42D5062A7ECB0E`;
- guarded slow-map product/control/product:
  `mapgen-v65-final-top-level-cache-smoke-{product-a,control,product-b}.json`,
  `F14934A2593CE508D73423DCE1DB0754EC7EA841B81DE218486B845FB56F99A9`,
  `E5C13F56B8EC48201E63D215E117C78012017B71C0D078709E5DF4C9FADABED2`,
  and
  `7549E0C272B086D7A59767FF189AA2CF142314C595238462B3FB428E90275661`;
- content-level recurrence audit:
  `mapgen-v63-restraint-catalog-query-content-recurrence-audit-slow.json`,
  `419413D6BE7C49A6C699C67C571E9F664BF15F28E692F6D8A91167B61D0D1042`;
- dependency and loaded-mod fallbacks:
  `mapgen-v65-final-top-level-cache-map-has-fallback.json` and
  `mapgen-v65-final-top-level-cache-loaded-mod-fallback.json`,
  `829A12C1368FA0F15193B7FE0C039602AA4A66F80A8F2452DD4F83DFCA0E114B`
  and
  `3E7B5E832E307E3EAED9C62677C508F7AB521BCC0E7582D073CBD1A24C254A14`.

## Accepted local v66: numeric accessibility state

v49 removed repeated `Object.entries` frontier snapshots, but each
`KinkyDungeonGetAccessible` and `KinkyDungeonGetAccessibleRoom` traversal still
kept string-keyed frontier and result-membership objects, parallel location and
point arrays, and one point object per queued tile. On the slow map those two
functions still accounted for roughly 544 ms of self time.

v66 keeps the public result object or key array unchanged, but represents the
private traversal state with one byte per map cell and a FIFO of numeric cell
indices. The state byte distinguishes unseen, returned, queued, and
returned-plus-queued cells. Clearing the queued bit at the original processing
boundary preserves KD's unusual behavior where the start cell can later enter
the result. Accepted cells are still inserted into the public result in the
same `XX`/`YY` order, and returned coordinate objects are newly allocated as
before.

The numeric branch requires v49's complete no-mod and dependency guard, captured
`Number.isInteger` and `Uint8Array` identities, integer in-bounds start
coordinates, optional integer lock coordinates, and a positive integer map no
larger than one million cells. An explicit disable or unsupported numeric shape
uses the accepted v49 ordered queue. A loaded mod or changed v49 dependency
continues to use KD's untouched original object-frontier implementation.

The 12-map shadow oracle compared every returned key and coordinate at all
1,450 accessible calls and all 1,224 room calls. All 2,674 results matched key
count, insertion order, and values with zero mismatch. The run also retained
all 12 signatures, 1,749,802 path calls, 13,328 selector calls, and exact
fixture restoration.

The guarded source product/control/product gate measured:

| Source            | 12-map total |  Source calls |
| ----------------- | -----------: | ------------: |
| v66 product A     |  19,220.9 ms | 2,470 numeric |
| v65 queue control |  19,844.7 ms |   2,470 queue |
| v66 product B     |  18,773.1 ms | 2,470 numeric |

The two-product mean was 18,997.0 ms, saving 847.7 ms or 4.27%. A clean Electron
source swap then compared byte-exact v65 with v66: 19,411.2 versus 18,291.4 ms,
a 1,119.8 ms or 5.77% saving. Those fresh-process reports matched every stable
result field, all 12 signatures, exactly 1,749,785 path calls and 13,323
selector calls, and restored `24a5fc88`.

The explicit-disable control exercised the v49 queue for all 2,470 observed
calls. A separate temporary loaded-mod entry forced all 1,719 slow-map calls
through KD's original frontier, preserved the map result, and restored the mod
registry exactly. The final repository gate passed source and profiler syntax,
TypeScript checking, all 144 JavaScript/TypeScript tests, all 25 Rust tests,
Rust format, Clippy with warnings denied, the full 120-enemy planner/API/developer
stress suite, and the unchanged 81-file real-save aggregate
`56ce90f953f9...`.

The accepted local v66 source and rollback copy both have SHA-256
`073F2B35520E859CA10AAC568C5946E1D39560393BEF7105B5E2BB58A2B97BAD`.
The patched index, v47 bootstrap, WASM, frozen normal-mod ZIP, v5 patcher,
redistribution artifacts, real game installation, and GitHub were not changed.

Evidence:

- exhaustive 12-map result oracle:
  `mapgen-v66-accessible-numeric-state-oracle-12map.json`,
  `E3C53F857D8A8BC937D2CA70F85C898A7004EA685F01540007BCA634D3A4C3CE`;
- guarded source product/control/product:
  `mapgen-v66-accessible-numeric-state-source-wall-{product-a,control,product-b}.json`,
  `8BE74218D21C52F8658DD7829B97FD1383A33874A4FA9EA724C35A17ACA20ED6`,
  `DD85C87D133C41B24EE659BA0A8E3CDC894D05B03DF3F171D085F3D83AA0ECC9`,
  and
  `7C6FA933D596FF8C692A7B05AF846A0151C6747FBA9E6B672D1DD9CD9A193D2F`;
- clean byte-exact v65 control and v66 product:
  `mapgen-v66-source-swap-{v65-control,product}.json`,
  `1B7ED0504303C22F13F530EFDDE8918A803D1EE831C1C63D3D75140E554F7F30`
  and
  `703C7C2E4167CDC7613BE52630873063F1F4351A96FAC1A1375483A7290C30CE`;
- loaded-mod fallback:
  `mapgen-v66-accessible-numeric-state-loaded-mod-fallback.json`,
  `F1D6348E7FB601F2012F3E36D2D5ABDAD4D28527BD109116A5A1E815E6EA2616`;
- final 120-enemy planner/API/developer stress:
  `pathfinding-stress-v66-accessible-numeric-state.json`,
  `35376FF1AAA47421F6134409D7AC198D91961DF9136AAAC93D825257EF047596`;
- post-stress slow-map smoke:
  `mapgen-v66-final-post-stress-smoke.json`,
  `41596AF7E7D84FB5445752D9424EB9738D6D3C7768B74D0A4DF6AF94A94933DE`.

## Accepted local v67: four-entry raw restraint-query reuse

v65 reused only the immediately preceding top-level restraint-catalog query.
The canonical 12-map trace observed 6,142 top-level queries across 56 query
shapes: 6,086 had appeared earlier, while only 4,760 were consecutive. A
capacity simulation found 4,760/4,763/6,067/6,077 hits for capacities
1/2/4/8. Four entries capture nearly the complete recurrence without turning
the private cache into long-lived game state.

v67 keeps v65's one-entry cache and private retry reuse, then adds a four-entry
FIFO keyed by the exact validated query key and the restraint-catalog identity.
Only the raw catalog candidate list is cached; every per-call lock, will,
stacking, variant, inventory, power, and fallback decision still runs in its
original order. The new branch requires the complete v65 catalog/key proof plus
the captured `Array`, `Array.prototype`, `push`, and `shift` identities. An
explicit disable uses v65's single-entry behavior. An unsupported query,
changed dependency, or incompatible catalog path clears the FIFO and resumes
the guarded scan.

Four fresh Electron processes compared byte-exact v66 and v67 in both orders:

| Arm           | 12-map total | Full scans | Four-entry hits |
| ------------- | -----------: | ---------: | --------------: |
| v66 control A |  18,268.9 ms |      1,388 |               0 |
| v67 product A |  17,653.2 ms |         82 |           6,067 |
| v67 product B |  17,676.0 ms |         82 |           6,067 |
| v66 control B |  18,533.6 ms |      1,388 |               0 |

The control mean was 18,401.25 ms and the product mean was 17,664.6 ms, a
736.65 ms or 4.00% saving. Every arm matched all 12 signatures, exactly
1,749,785 path calls and 13,323 selector calls, and the exact `24a5fc88`
restore. A separate full-sequence gate compared all 1,313 top-level raw result
fingerprints and found zero mismatch; it also matched 492,779 path calls, 2,929
selector calls, and restore state.

The explicit-disable gate recorded zero four-entry hits and 707 v65
single-entry hits. Replacing the captured `Map.has` dependency forced all
1,212 catalog calls and 691,042 restraint checks through the official fallback.
A temporary loaded-mod entry also bypassed both top-level caches for all 1,212
catalog calls and restored `KDAllModFiles` exactly. The final gate passed source
and profiler syntax, TypeScript checking, all 149 JavaScript/TypeScript tests,
all 25 Rust tests, Rust format, Clippy with warnings denied, the full 120-enemy
planner/API/developer stress suite, the post-stress map smoke, and the unchanged
81-file real-save aggregate `56ce90f953f9...`.

The accepted v67 source and rollback copy both have SHA-256
`AA4C09E73DE34B1AB6EEA5328880049578963C7C3DCBAAE07728CA408DA59F92`.
The frozen normal-mod ZIP remains byte-identical at
`EEE0E1A0547A86B3152A845357C827EE8768ECC46A0BA59213BFD551F6A555F4`;
at this acceptance checkpoint the patcher, redistribution artifacts, real
game installation, saves, and GitHub were not changed.

Evidence:

- four-entry capacity audit:
  `mapgen-v67-restraint-query-fifo-capacity-audit-12map.json`,
  `CAA8C4335FBBA1D705A64F90C0DE825227F79A39445F1C97608C3E88AE6BEFCB`;
- fresh v66/v67 source swaps:
  `mapgen-v67-fresh-source-swap-v66-control-a.json`,
  `mapgen-v67-fresh-source-swap-v67-product-a.json`,
  `mapgen-v67-fresh-source-swap-v67-product-b.json`, and
  `mapgen-v67-fresh-source-swap-v66-control-b.json`,
  `3ADCDEAC4E65F77C608F4023458B6AB4E34EE6D51B46B1B35DE7CED5A6CA779E`,
  `A3754C35E07A4305B8BA791A10A4DB2638C8703667B560062BC8A443F9BAF4CE`,
  `D7E88D696F861F1E8B13DEB9F37C0F0A0CC1108C3292B99CB99198079C73A1EB`,
  and
  `58E3022C90C9C7FEDB6F24E4228934A8F80EED06C43584346D2E777B2E1361CB`;
- full 1,313-result sequence product/control:
  `mapgen-v67-restraint-multi-entry-result-sequence-{product,control}.json`,
  `ECDC501DD65995C97E4D705DA6719E011362DDF1646A440BC4BE9C263F8FD21C`
  and
  `EB39DCA15AA2F713DA2E6A8F2BC7BF8616CD91D7BC0ACCE2CD600F31CD2962E4`;
- explicit-disable, dependency, and loaded-mod fallback:
  `mapgen-v67-restraint-multi-entry-explicit-disable.json`,
  `mapgen-v67-restraint-multi-entry-dependency-fallback.json`, and
  `mapgen-v67-restraint-multi-entry-loaded-mod-fallback.json`,
  `37D59EB8F77486D688F5B493BF1A92C6795950288EBB390EA0A38EA3EFFFAD83`,
  `2CC5488679B98119B49482A9D4BE8F3477D8610DB2AD559BB24A6BE3EC94A407`,
  and
  `22DF4A6B77146E8BDCD0DE7ED9B7BCF9639B60B0C5E0F4E59CB9C1B1418C0D92`;
- final 120-enemy planner/API/developer stress:
  `pathfinding-stress-v67-restraint-multi-entry-reuse.json`,
  `09FDFA395FFE535857755CF96E248220648E5E63B71D47E3083E733380A01653`;
- post-stress map smoke:
  `mapgen-v67-post-stress-smoke.json`,
  `73BB15A880A8B8A03F397C71C35867C17AFA9702E9543DC5DA09B505C9FC7E95`.

## Accepted local: audited legacy-mod source translation

KD's source fast paths deliberately treat any loaded ZIP as unknown and use
their original JavaScript branches. That is the right default, but it also
meant three reviewed mods that do not replace map-generation dependencies
disabled the affected accepted v49-v67 work.

The bootstrap now hashes selected archives through the official mod-loader
boundary and issues an immutable compatibility proof only for byte-exact
profiles. Useful Tooltips 1.33 is read/UI-only for this boundary. Prisoner
Revaluation 1.14 keeps its guard action, deterministic KD random call, and
reputation write in JavaScript. Breach Explosives keeps its bullet callback,
effect tiles, grid write, and light-grid invalidation in JavaScript. During one
proved official map-generation transaction, only the broad mod-registry guard
bindings are substituted; the exact original bindings are restored in
`finally`.

The first fresh-process product/control/product throughput gate used all three
archives and the canonical 12 seeds:

| Arm | 12-map total | Median | Accessible | Unique |
| --- | ---: | ---: | ---: | ---: |
| translated product A | 22,929.7 ms | 1,441.7 ms | 12/12 | 12 |
| explicit JS fallback control | 95,890.7 ms | 6,900.9 ms | 12/12 | 12 |
| translated product B | 21,088.1 ms | 1,405.1 ms | 12/12 | 12 |

Both product arms repeated all 12 signatures, 1,749,784 path calls, 13,323
selector calls, and the exact restore. The control ran 4.36x slower than the
22,008.9 ms product mean.

That large timing gap exposed a harness limitation: the profiler awaits a
digest between maps, allowing the live event loop to advance. Three later
control maps therefore began from different time-driven state and cannot serve
as a same-input equivalence claim; the control had one additional path call.
Those three indices were rerun as fresh product/control process pairs:

| Seed index | Product | Control | Speedup | Full map SHA-256 and call parity |
| ---: | ---: | ---: | ---: | --- |
| 2 | 2,250.8 ms | 3,984.3 ms | 1.770x | exact |
| 6 | 505.9 ms | 602.8 ms | 1.192x | exact |
| 10 | 774.1 ms | 870.2 ms | 1.124x | exact |

The three fresh pairs aggregate to 3,530.8 ms translated versus 5,457.3 ms
fallback, a 1.546x speedup or 35.3% less wall time. Each pair matched the full
map-content SHA-256, signature, path-call count, selector-call count,
accessibility result, and exact restore. Separate Useful-only,
Prisoner-only, and Breach-only seed-2 pairs were also exact and measured
1.76x-1.78x.

The real loader gate retained all six ZIP entries and every tested handler:
Useful Tooltips' tick/config/tooltip registrations, Prisoner Revaluation's
guard action and assignment wrapper, and Breach Explosives' settings and
bullet events. Firing the real Breach callback changed a breakable grid cell
from `1` to `0`, added Smoke and RubbleNoMend effects, marked the light grid
dirty, and the next path query completed natively with zero fallback or
failure. Unknown, changed, duplicate, oversized, malformed, spoofed, and
entry-mismatched proofs remain on JavaScript in focused tests.

Evidence:

- 12-map throughput product/control/product:
  `mapgen-mod-translator-v1-3mods-{product-a,control,product-b}-12map.json`,
  `FCBDA4832C2426C4135B2B28F1D855557B7EE10098EFEA6BBA0338D9D18984F4`,
  `950D2764B7DEE3AF567F15B7EACEBFDE27C69A906AAFD92ED15BD5F67F0AA23D`,
  and
  `EEA504A4774F09316637728182381C11FF4009FDECF5EDECB8FC8771B672788A`;
- fresh seed-2 product/control:
  `mapgen-mod-translator-v1-combined-seed2-{product,control}-fresh.json`,
  `3717B13DB5BCB3E9B9CB1243DF6E52CE1B76B7C00083634E7D8C0EC1EFE558EA`
  and
  `B0D05E9CE8EB4B1B3B1B1A33F8D7A7B65EF7C726A223F7BA32DD29E8945C00B1`;
- fresh seed-6 product/control:
  `mapgen-mod-translator-v1-combined-seed6-{product,control}-fresh.json`,
  `4C3FE78EE56268711E863FE369AD791B843D2970E9474635EE608788FC55DADD`
  and
  `3165D84E5036787CC335BA4E95FA7461A125891AC08397DC67A82DC82A19E992`;
- fresh seed-10 product/control:
  `mapgen-mod-translator-v1-combined-seed10-{product,control}-fresh.json`,
  `FE2339A0E0FCFAA5DA40DAFE4CD40AF1E86FD35AB7CA918274DE32F373A1FAFE`
  and
  `073456C8C259213FFB3754B9AD2A0CC0AB44A25C35E480E70912E9F74CB120BF`;
- official-loader registrations and real Breach mutation:
  `mod-translator-v1-3mods-live-functional.json`,
  `64306FBDE475239B4F8AD6BD94394F818A33DB5836C14164EA8203877597A59B`;
- final rebuilt bootstrap smoke:
  `mapgen-mod-translator-v1-final-bundle-smoke.json`,
  `47A56BAD094A2542EE1867250D766CEEC8DF82901B8BD2234F8BCBF32E058E33`.

### Content-recognized official API expansion

The exact-profile gate now has a conservative content path for normal KD mod
archives. It uses KD's ZIP reader, parses executable source with Acorn without
evaluating it, and recognizes calls from the reviewed effect table plus the
exact build's pre-mod KD function snapshot. Dynamic code, prototype mutation,
unknown KD calls, and writes that can invalidate any accepted source fast path
reject the complete selected set.

The final installed-build gate used exact bytes from the normal `Mods` folder.
Arcanox Cute Effects 2.8.12, EarPlugs Redux 0.4, and the Himiko female-voice
pack produced three `content-inspected` profiles, enabled all eight source
optimizations, loaded all 350 ZIP entries exactly, and recorded one optimized
map with zero translated fallback maps. Their model/text, restraint/event, and
voice/input hooks were present; a 51x37 map generated in 181.2 ms, three turns
completed, and a manual Pixi render passed with no executable-script or page
errors.

The complete 15-archive installed set loaded all 971 entries exactly. KD4K's
intentional `KDDraw` replacement rejected the set as
`content-source-sensitive-write:KDDraw`; observed source calls all used their
official JavaScript branches. The same process generated a 51x37 map, advanced
three turns, and rendered successfully with no executable-script or page
errors. A separate Logical District Mapgen control rejected
`KDMapTilesPopulate` and completed the same map/turn/render gate.

The supplied EarPlugs archive originally had an extra top-level directory, a
nonexistent file-order entry, and an atlas image path that could not resolve.
After repairing that archive layout, its final gate reported zero loader or
resource errors, registered all eleven restraints, cached the atlas texture,
and loaded the 2480x3508 Isolation Headphones model.

Evidence:

- compatible official-API set:
  `artifacts/live-mod-api-compatibility-earplugs-repaired.json`;
- complete installed mod set:
  `artifacts/live-mod-api-compatibility-full-normal-set.json`;
- source-replacement negative control:
  `artifacts/live-mod-api-compatibility-source-replacement-control.json`.

## Release packaging: source patch v6

Final release cleanup promotes the accepted v67 bundle into one immutable,
hash-gated source-patch version. The official KD 5.4.92 input remains
`2D3041A085CBE475A63227FF40709F6D9C1595C77A58545C69EDF359A57605A4`;
both the Node/PowerShell patcher and native C++ manager now produce the exact
accepted output
`AA4C09E73DE34B1AB6EEA5328880049578963C7C3DCBAAE07728CA408DA59F92`.
Each installer rejects unknown inputs, verifies the output, backs up the
official bundle, and restores the exact original bytes on uninstall.

The MPL source payload carries two complementary review forms:

- `source-optimizations-v6.patch`, the TypeScript changes maintained against
  upstream commit `5c96c4c1e67faf136ba2c167ed889a9e29005a18`; and
- `bundle-optimizations-v6.patch`, the authoritative readable JavaScript delta
  for the complete accepted installed bundle.

The generated TypeScript embedding and Qt resource are both derived from that
same bundle patch. Superseded v2/v5 draft patch files are not shipped.

## Cross-session map seed contract

The map-generation profiler now records the literal seed and a SHA-256 digest
of its canonical gameplay snapshot for every map. The snapshot includes the
checkpoint, floor, grid, start and end positions, enemy types and positions,
and ground items. The existing short signature remains in reports for
continuity, but the SHA-256 digest is the cross-session contract. Reports also
carry the renderer time origin, so the verifier rejects two legs from the same
renderer session unless a diagnostic-only override is explicit.

Two fresh Electron sessions ran the accepted v67 source over the same 12-map
`grv`/`cat`/`jng` floor-band sequence. Both legs generated 12 accessible maps,
made exactly 1,749,784 path calls and 13,323 native enemy-selector calls, and
restored their pre-run fixture exactly. The verifier compared 12 fields for
each map across the two processes: 144 comparisons passed with zero mismatch.
The two runs took 18,547.9 ms and 18,583.3 ms; timing is recorded but is not
part of the seed contract.

Reproduce the gate by launching two separate isolated KD renderer sessions,
running `profile:local:mapgen` once in each, and then comparing the reports:

```powershell
npm run verify:mapgen:seeds -- `
  --report artifacts/mapgen-seed-contract-v1-session-a.json `
  --report artifacts/mapgen-seed-contract-v1-session-b.json `
  --output artifacts/mapgen-seed-contract-v1.json
```

Evidence:

- session A:
  `artifacts/mapgen-seed-contract-v1-session-a.json`, SHA-256
  `FA8EEF29B62E5B8DDA7AA9F2F09A9040DF6D7D80082A16029F63FCE60FA2302A`;
- session B:
  `artifacts/mapgen-seed-contract-v1-session-b.json`, SHA-256
  `AB4649843A2E0A25A411CCEDC04FB2144C0A2E4301FA4E0BBECA4982986B88FE`;
- contract:
  `artifacts/mapgen-seed-contract-v1.json`, SHA-256
  `1500F4A2E12A3392F06B27FCAAA233F51D860B18E186A5B1E8E1C817E6230FA9`.

## Integrated crowded-turn result

Pathfinding stopped being the largest isolated cost once its native fast path
was enabled. CPU profiles of real 120-enemy turns then found seven useful
JavaScript-side optimization slices.

`KDNearbyEnemies` was called roughly 1,000 times per turn and rebuilt small
result arrays by repeatedly probing string-keyed positions. That boundary stays
in JavaScript: sending one WASM request per query costs more than the lookup.
The optimized host instead builds one dense position index for each
`KDGetEnemyCache()` generation, returns KD's original entity objects in
original order, and leaves `KDHostile` and mod-visible state in JavaScript.

The next profile showed that the built-in `helpStruggle` and `helpDanger`
commander filters both scanned the same crowded map even when no entity could
possibly need either kind of help. The new batch shortcut performs one
conservative target-only pass. It skips those two filters only when the pass
proves their result must be false. A possible target still runs the exact
upstream filter. Game events and known mutators invalidate the proof before the
next enemy is classified. A hostile combat fixture later exposed the other
side of that safety rule: heavy synchronous mutation could force hundreds of
fresh full-map proofs and make the shortcut slower than KD. The handler now
allows at most 16 refreshed proofs per commander batch. If churn reaches that
budget, every remaining rescue classification uses KD's exact filters for the
rest of the batch.

A later 50-turn combat profile found one avoidable cost inside that safeguard.
All 120 combat enemies were already aware, while the commander had fewer than
its maximum assaulters. KD's original `helpStruggle` and `helpDanger` filters
therefore had to return false before reaching their nearby-enemy searches, but
the adapter was refreshing its map-wide proof first. The adapter now evaluates
that exact shared prefix while the proof is dirty. An ineligible candidate
returns false immediately; an eligible candidate continues through the same
proof and exact-filter path as before. The new helper dependencies are
signature- and identity-gated, so replacing either one gives the mod the
official JavaScript path.

The third slice fuses `KinkyDungeonFindMaster`'s small nearby query with its
rank selection. It rejects candidates whose rank and leader state make them
impossible before paying for faction and hostility calls. This stays in
JavaScript because it returns original entity objects. The target and its full
flag/faction/hostility dependency chain are exact-signature gated; a changed
dependency falls back for that call.

The fourth slice keeps `KinkyDungeonNearestPlayer` in JavaScript but rejects
canonical nonhostile candidates before running helpless, imprisonment, and
silence classifiers. It now fuses the exact canonical `KDHostile` and
`KDFactionHostile` decision into the already-guarded scan, avoiding repeated
helper and facade calls. The omitted opinion term is provably zero for this
non-player canonical target shape. Packed, custom, player-like, and
noncanonical entities retain the exact upstream helper order. The target and
every reordered or fused dependency are exact-signature and identity gated, so
a mod replacement falls back for that call instead of observing reordered
work.

The fifth slice wraps `KinkyDungeonUpdateEnemies`. KD normally marks its
position, ID, and event caches dirty after an ordinary move, so the next lookup
rebuilds all three over every entity. The adapter starts an enemy-update call
with one fresh position-map generation, updates the old and new position keys
after each safe move, and advances an explicit generation token so the nearby
and master dense indices cannot reuse stale coordinates. A transient overlap
scans only the two affected keys. The batch arms KD's normal full rebuild at
the end, keeping the official ID and event maps authoritative outside the
update.

This path is deliberately narrow. Exact 5.4.92 dependency hashes and identities
must still match. Active `enemyMove` entity events or a mod-added non-enemy
event handler fall back for the complete update. A bullet or destination effect
callback keeps that individual move on KD's official dirty-cache path.
Structural changes, cache replacement, or a mod taking ownership of
`KDMoveEntity` also stop incremental maintenance instead of replaying a move.

The sixth slice removes the next cost exposed by that batch. Advancing the
position-cache generation used to make the nearby and implicit-master adapters
rebuild their complete dense indices after each accepted move. The movement
batch now records a bounded journal of the affected cells. A dense adapter
patches only those cells when the journal covers every generation since its
last query. Any gap, invalid coordinate, oversized change set, replaced cache,
or changed map size keeps the full rebuild. This removed
`buildDenseEnemyIndex` from the sampled hot profile without weakening the
generation guard.

The seventh slice removes a redundant full-map scan in
`KinkyDungeonPlaceJailKeys`. KD 5.4.92 enumerates every distant key location
before calculating that the map already contains `KDMaxKeys` keyrings and no
new key can be placed. The shortcut counts existing keyrings first and returns
only in that proven no-op case. Missing keys still call the exact official
function. The upstream function and its map-query dependencies are
signature- and identity-gated, so a mod replacement also routes to the
official function.

On 2026-07-27, 20 paired samples ran three real enemy turns apiece from the
same compressed save fixture. The fixture resets KD's non-serialized commander
role state before every sample and can now be exported and supplied explicitly
for cross-build controls:

| Path                                           | Median for three turns |                       Result |
| ---------------------------------------------- | ---------------------: | ---------------------------: |
| Official crowded-turn paths                    |               53.60 ms |                     baseline |
| Seven guarded crowded-turn optimization slices |               29.20 ms | 1.846x paired-median speedup |

All 20 optimized samples were faster. Their final gameplay-state signatures
matched the official path exactly, including ground-item names and positions.
The median of the 20 pairwise speedups was 1.846x, equivalent to about 45.8%
less time at that paired median. The separate ratio of the two displayed
medians was 1.836x, or about 45.5% less elapsed time. Pairwise speedups ranged
from 1.659x to 2.014x. This run used the same exported fixture as the previous
accepted bundle; its optimized median moved from 29.50 ms to 29.20 ms while
adding the combat-churn guard. The acceptance run also
produced:

- 840 of 840 exact static nearby-query matches over radii, distance modes, and
  hostility filters;
- 638 of 638 exact nearby comparisons captured from an actual enemy turn;
- 38,140 optimized nearby calls, 60 optimized commander batches, and 11,940
  optimized master queries during the timed samples;
- 7,320 optimized nearest-player queries during the timed samples, with no
  fallback calls or failures in any of the six crowded-turn adapters;
- 120 optimized enemy-update batches, containing 740 constant-time position
  updates and 320 exact two-key overlap repairs, with no movement fallback or
  failure;
- 60 of 60 jail-key calls that skipped a proven redundant full-map scan, with
  no fallback or failure in the timed fixture;
- exact role-map signatures for natural bound-target and dangerous disabled
  target scenarios, where the original rescue filters must run;
- exact entity identity and distance for natural higher-rank and leader master
  candidates;
- 122 of 122 exact nearest-player results captured from an actual enemy turn,
  plus exact packed and noncanonical entity scenarios;
- an exact per-call fallback when a test mod replaced a commander order;
- an exact per-call fallback when a test mod replaced a master-query
  dependency;
- an exact per-call fallback when a test mod replaced a nearest-player
  dependency;
- an exact fallback when a test mod replaced the captured nearby hostility
  function;
- an exact fallback when a test mod replaced the enemy-cache dependency, with
  all 3,866 replacement calls observed on both oracle paths;
- an exact full-update fallback for an active `enemyMove` event;
- an exact bullet-risk scenario in which all 64 observed moves stayed on KD's
  official cache-rebuild path;
- exact jail-key behavior when keys were missing, plus an exact per-call
  fallback when a test mod replaced the map getter; and
- zero adapter, pathfinding, or parity failures.

A separate five-pair longevity gate ran 20 turns per path. It measured
430.60 ms for the official path and 262.80 ms for the optimized path, a 1.641x
paired-median speedup. All five optimized samples were faster, gameplay state
matched through turn 20, and all 100 redundant key scans were skipped.

The commander-only structural probe measured 47.90 ms versus 44.50 ms over the
same seven-by-three design, a 1.079x paired-median speedup with all seven pairs
faster. The rank-first master probe measured a separate 1.085x paired-median
gain, with all seven probe pairs faster and 193 of 193 exact call-level
matches. The accepted minimal nearest-player reorder measured a separate
1.103x paired-median gain across 15 three-turn pairs, with all 15 faster. Its
canonical-definition guarded form then measured 1.073x across seven pairs
before integration. Fusing the canonical hostility decision into that guarded
handler then measured an incremental 1.063x across seven pairs, with all seven
faster and exact final states. The safe batched movement-cache probe then
measured 1.068x across seven pairs before production integration, with all
seven faster and 61 of 61 verification checks matching the full cache. The
integrated result above remains the release gate because it measures all seven
accepted slices together.

For the incremental dense-index slice itself, the previous bundle and the
journal bundle were each run for 20 pairs against the exact same exported
fixture (`7ce006c8`) after code-cache warm-up. The old bundle measured 31.90 ms
for the optimized path; the journal bundle measured 29.70 ms, a further 6.9%
reduction. Their JavaScript baselines were 53.90 ms and 54.80 ms respectively,
and both runs passed exact final-state and fallback acceptance.

The same cycle also removed avoidable dispatcher and dense-query overhead.
Over a 30-turn sampled profile, dispatcher self-time fell from 18.46 ms to
7.96 ms. This cleanup uses a shared fallback marker, a shorter normal facade
path, numeric offset-template keys, and linear cell offsets for interior
queries.

The harness deliberately calibrates both paths before timing, restores both
serialized and transient fixture state before every sample, uses the median of
paired speedups, and fails if either adapter silently falls back for every
call. Reproduce it against the isolated debug build:

```powershell
npm run profile:local:turn -- --ab-samples 20 --ab-turns 3 --interval 50
```

The complete profile and acceptance record is written to
`artifacts/crowded-turn-profile-commander-budget16-controlled-canonical.json`.
Its SHA-256 is
`F3814DACC2CEB9CB4FEF50EAF73E7937F1F0EFA6E5773D5E940017F05B483165`.

## Direct source optimizations

The runtime nearest-player handler proved the optimization, but its facade,
replacement checks, and extra JavaScript call remained visible in the profile.
The installed KD bundle was therefore matched back to the public
`Ada18980/KinkiestDungeon` source at commit
`5c96c4c1e67faf136ba2c167ed889a9e29005a18`. A clean upstream build produced
the installed `out/main.js` byte-for-byte:

- original SHA-256:
  `2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4`;
- combined source-patched SHA-256:
  `cbfb9cbfb6356c1a14e7986ff05f832621deb934740a43554d9ce5475fa3f600`.

The nearest-player part keeps the same narrow proof. It captures every relevant
helper identity, recognizes only canonical upstream enemy definitions, and
preserves the original helper order for packed, player-like, custom, and
noncanonical entities. A changed dependency disables the fast body for that
call. The bootstrap detects the source marker and does not install the older
runtime nearest-player wrapper on top.

Twenty paired samples of two enemy turns produced:

| Fixture        | Original source body | Direct optimized body |    Paired-median result |
| -------------- | -------------------: | --------------------: | ----------------------: |
| Hostile combat |             20.20 ms |              19.40 ms | 1.058x; 18 of 20 faster |
| Crowded room   |             27.80 ms |              24.00 ms | 1.156x; 20 of 20 faster |
| Prison escort  |             22.60 ms |              18.20 ms | 1.249x; 20 of 20 faster |

All 60 final-state comparisons matched. The live per-call oracle matched
120 of 120 combat calls, 120 of 120 crowded calls, and 122 of 122 prison calls.
Separate checks matched packed and noncanonical targets and proved exact
fallback when a dependency was replaced.

A same-fixture head-to-head then compared the direct source body with the
equivalent runtime handler. The source path measured 19.40 ms versus 22.30 ms
for the handler candidate; the handler won zero of 20 pairs. That candidate did
not include dispatcher cost, so the result is conservative in favor of the
runtime wrapper.

Reproduce the source A/B against the isolated patched build:

```powershell
npm run profile:local:turn -- `
  --scenario combat `
  --probe-source-nearest `
  --ab-samples 20 `
  --ab-turns 2 `
  --output artifacts/combat-turn-profile-source-nearest-canonical.json
```

The conventional source diff and exact build instructions live in
`upstream-patches/kd-5.4.92/`. The installer performs the equivalent
twelve-fragment transformation only for the known input hash, verifies the output
hash, and keeps the original bundle for uninstall.

Canonical report hashes:

- combat source A/B:
  `B784EE71FE051CE071D112647A14D7854421ED5510ADDA3B2224CFCEF7C997CC`;
- crowded source A/B:
  `3975D86EBFBDF0EE656105279223164E5C2D59E22F1B214058CC08A408F6C790`;
- prison source A/B:
  `554D8C20F49383AB1F8DD6C9EFCC9214C9983E97D14884EB4293C15A934AC02E`;
- source-versus-runtime head-to-head:
  `402FB7D6B5E97AF07929696F11F9E1EDA6E6B0A521A067F6FF64BE09F870B9E1`.

### Healthy NPC helpless check

A longer accepted-build profile showed `KDHelpless` at 3.54 ms of self-time
and 5.73 ms total over ten hostile-combat turns. Most calls were healthy,
unbound NPCs, for which the answer is necessarily false. The direct source
shortcut now returns at that point without unpacking or evaluating binding
effects.

The gate is deliberately narrow: player entities, injured or bound NPCs, and
packed enemy definitions use KD's original body. Replacing `KDUnPackEnemy`,
`KDPackEnemy`, or `KDNPCStruggleThreshMult` also disables the shortcut for
that call. `KDHybridSourcePatchControl.disableHelplessFastNegative` provides
the developer escape hatch.

Twenty paired three-turn samples on the final packed-safe build produced:

| Fixture        | Original body | Fast negative |    Paired-median result |
| -------------- | ------------: | ------------: | ----------------------: |
| Hostile combat |      23.20 ms |      22.00 ms | 1.060x; 15 of 20 faster |
| Crowded room   |      34.90 ms |      33.90 ms | 1.026x; 14 of 20 faster |
| Prison escort  |      29.20 ms |      28.60 ms | 1.011x; 10 of 20 faster |

All 60 paired final states and all diagnostic verification states matched.
The compatibility gate separately covered healthy, low-health, actively
bound, packed, and player entities; verified all three dependency replacements;
preserved packed representation; and proved that a public `KDHelpless`
replacement still takes control.

Reproduce the source A/B against the isolated patched build:

```powershell
npm run profile:local:turn -- `
  --scenario combat `
  --probe-source-helpless-fast-negative `
  --ab-samples 20 `
  --ab-turns 3 `
  --output artifacts/combat-turn-profile-source-helpless-fast-negative-packed-gate.json
```

Canonical report hashes:

- combat:
  `552C38F3A938398DF8C0E41F33B939DB4AB92510BE422AA353316972B46FB685`;
- crowded:
  `8D3C9398D0F0F61A49FDC5716386143310ECE44BC224FAF9507075E3EE9AFB77`;
- prison:
  `FA9F2C55B61379AA76DBB4AABBC5731856CEA284126C943DD15A153E115D2365`.

### Adaptive negative buff-event index

The combat audit found 386,111 active buff slots scanned across 12 turns
without finding one handler for the requested triggers. A per-map lookup was
tried first and rejected: 21.6 million live lookups made that version about 6%
slower. The accepted source form instead waits for the second relevant
buff-event dispatch in a tick before building a set of active trigger names.
Later negative triggers can skip the complete player-plus-entity scan, while a
positive trigger still runs KD's original handler loop and order.

The index resets on a new tick or structural entity/buff changes, observes
eventful buffs applied through the standard helpers, and exposes
`KDHybridInvalidateBuffEventIndex()` for mods that directly mutate an existing
`.buffs` object and need same-tick visibility. Replacing either captured buff
application helper or setting
`KDHybridSourcePatchControl.disableBuffEventIndex` selects the original full
scan.

Twenty paired samples of two enemy turns produced:

| Fixture        | Original full scan | Adaptive index |    Paired-median result |
| -------------- | -----------------: | -------------: | ----------------------: |
| Hostile combat |           31.30 ms |       26.90 ms | 1.163x; 20 of 20 faster |
| Prison escort  |           28.10 ms |       27.80 ms | 1.013x; 11 of 20 faster |
| Crowded room   |           36.00 ms |       36.00 ms |         1.000x; neutral |

Every paired final-state comparison and both diagnostic verification legs
matched. The canonical combat verification rebuilt the index four times,
performed four warm-up scans, and skipped 692 known-negative scans. Separate
compatibility checks proved player-before-entity handler order, standard API
application visibility, explicit direct-write invalidation, next-tick
visibility, dependency fallback, and the disable control.

Reproduce the source A/B against the isolated patched build:

```powershell
npm run profile:local:turn -- `
  --scenario combat `
  --probe-source-buff-event-index `
  --ab-samples 20 `
  --ab-turns 2 `
  --output artifacts/combat-turn-profile-source-buff-event-index-canonical.json
```

Canonical report hashes:

- combat:
  `385E8438AC4249FC17A5180AE1F9CC3D3873C67A10DB13D8580D345DE211A266`;
- prison:
  `FF56B27B5F95FB03A89911E69BC1E25B61F17F769F6771BB38381C7AEF27E150`;
- crowded:
  `A5B6B14C2A0B73B70C63C9934F76AD269335455781C48EB9690AAD630EF5047D`;
- corrected compatibility smoke:
  `F6B168D576533CF401FA2B4D1B611112A4DAFFA14863D8215D219384C13E857D`.

## Hostile combat turn result

The crowded fixture stresses AI volume, but most enemies share a faction and
do not actually fight each other. The combat fixture replaces them with one
connected cluster of 120 real Maidforce entities split between the `Enemy` and
`Rage` factions. Every entity has at least one hostile neighbor, all begin at
least 30 tiles from the player, and their health is raised so the same
three-turn trace can be replayed. A three-turn audit observed 341 enemy attack
attempts and 155 enemy-damage calls, so this is a combat workload rather than
another movement-only crowd.

This fixture caught a genuine regression in the previously accepted bundle.
Heavy event and dialogue churn repeatedly invalidated the commander rescue
proof; repeated runs measured only 0.81x to 0.86x versus the official path.
System and per-adapter matrices isolated that loss to the commander shortcut.
The 16-refresh budget described above keeps its cheap crowded-room wins but
switches the remaining high-churn classifications to the exact upstream
filters.

On 2026-07-27, 20 paired samples ran three combat turns per path:

| Path                                            | Median for three turns |                       Result |
| ----------------------------------------------- | ---------------------: | ---------------------------: |
| Official combat-turn paths                      |               36.60 ms |                     baseline |
| Guarded hybrid paths with commander scan budget |               31.10 ms | 1.170x paired-median speedup |

Nineteen of 20 optimized samples were faster, all 20 final gameplay-state
signatures matched, and the acceptance suite passed. The ratio of the displayed
medians was 1.177x. The timed optimized legs exercised 53,680 nearby calls,
60 commander batches, 7,200 master queries, 7,200 nearest-player queries, and
120 movement batches with no adapter failure. The separate bullet-risk oracle
also kept every unsafe move on KD's official cache path and matched the full
state.

Reproduce the combat gate against the isolated debug build:

```powershell
npm run profile:local:turn -- `
  --scenario combat `
  --ab-samples 20 `
  --ab-turns 3 `
  --output artifacts/combat-turn-profile-commander-budget16-canonical.json
```

The canonical report's SHA-256 is
`DBF4CA2915279668890851B88A4ACB444C5772E5C63764B96A2EAD10E6242D74`.

### Rejected combat-arithmetic WASM boundary

The next audit tested whether the callback-delimited scalar window inside
`KDArmorFormula` and `KDDamageEnemy` was large enough to justify a native
transaction. The Rust implementation matched all 465 returned values across
the fixture's 155 damage records and rejected malformed lengths, non-finite
inputs, invalid resistances, and invalid flags.

The semantically valid boundary still lost decisively:

| Boundary                            | JavaScript median | WASM median |                         Result |
| ----------------------------------- | ----------------: | ----------: | -----------------------------: |
| One crossing per damage transaction |         10.248 ms |  111.266 ms | 0.092x; 0 of 11 samples faster |
| One crossing for all 155 records    |          9.709 ms |   14.168 ms | 0.685x; 0 of 11 samples faster |

The second row is only an upper bound: KD callbacks interleave those
transactions, so batching every record into one call is not integrable without
changing callback visibility. It loses even after removing nearly all boundary
crossings. The arithmetic is simply too small and already too cheap in
JavaScript to pay for marshalling and WASM dispatch. The unused native export
was removed; the next combat/status candidate must own a larger coherent
status-tick or event batch.

The rejection report is
`artifacts/combat-arithmetic-wasm-boundary-v1.json`, SHA-256
`D7EDE52AEDE96AAA1CEA8B31E76D98A9A61EF06CF6B9482FDD1AD5CE2C45BF6C`.

### Rejected status-tick batch

The follow-up moved to the larger status boundary instead of sending one
damage record at a time through WASM. Before timing it, the crowded-turn
profiler exposed a harness bug: a freshly launched or renderer-reset test page
can enter `Game` before `KDCurrentModels` contains the player. Calling KD's
save generator in that state dereferenced the missing model's `Poses`. The
profiler now yields to KD's own animation path until the player model exists
and reports a focused readiness error if it does not. The isolated 120-enemy
fixture then generated successfully with no stderr and passed the normal
acceptance block.

Three increasingly broad JavaScript candidates were measured:

| Candidate                                                               | Official median | Candidate median |                        Result |
| ----------------------------------------------------------------------- | --------------: | ---------------: | ----------------------------: |
| Skip a sole positive, infinite `Plug` buff whose tick is provably inert |        37.30 ms |         36.40 ms | 1.025x; 14 of 20 pairs faster |
| Replace single-entry `Object.entries` ticking with an own-key loop      |        63.80 ms |         64.70 ms |  0.986x; 6 of 20 pairs faster |
| Use an allocation-free `for...in` single-entry loop                     |        64.70 ms |         65.20 ms |  0.992x; 9 of 20 pairs faster |
| Inline all enemy ticks inside one `KinkyDungeonUpdateBuffs` transaction |        63.20 ms |         63.70 ms |  0.992x; 8 of 20 pairs faster |

Every paired gameplay-state signature matched. The focused gates also covered
empty, finite, expired, reset-duration, end-floor, custom-handler,
multiple-buff, null-prototype, and custom-container records. A replaced
`KinkyDungeonTickBuffs` remained authoritative, public function replacement
worked, and every candidate restored the exact official functions. The
transaction form exercised 120 inline enemy ticks per verification turn but
still lost: removing those calls did not beat V8's optimized official loop.

No status-tick candidate was installed or added to a package. Evidence:

- `artifacts/status-toy-buff-tick-noop-v1.json`, SHA-256
  `2E1D7674A4B4A370536DA53B553C419A7BB6B40C69F47D8922991626DDB42B84`;
- `artifacts/status-buff-tick-iteration-v2.json`, SHA-256
  `9C438E3ACC1DF038943F4CBDE5C54E9BE76F2A4D7FDA4A238D51A526EE1D067A`;
- `artifacts/status-buff-update-batch-v1.json`, SHA-256
  `49ECF2F45FED48F16A60E1F9FE758B1F2A66562446E23A45FA0690A6FA78511D`.

### Rejected enemy debug-timer shortcut

The next enclosing `KinkyDungeonUpdateEnemies` audit found two
`performance.now()` reads around every active `KinkyDungeonEnemyLoop` call.
Upstream only consumes the timestamps when `KDDebug` is true. A temporary
source candidate made both reads conditional while preserving the exact debug
log path.

The guarded in-page probe skipped 1,854 clock reads over ten combat turns,
matched the exact state, and matched the `KDDebug` path. It measured 81.8 ms
official versus 79.7 ms candidate, but its 1.013x paired median and 15 of 20
faster pairs were too small to accept. Removing the probe's control lookup and
testing clean Electron processes did not rescue it: candidate/control/candidate
medians were 90.7 / 85.9 / 84.4 ms. Their means were 90.96 / 87.81 / 86.28 ms,
so the two candidate means combined were 0.92% slower than the byte-exact
control.

All three source legs restored the same `a4142b5e` fixture, produced the same
`35576d0e` state in every sample, and passed the normal AI, movement, master,
jail-key, and source-nearest gates. The source candidate and its temporary
signature were removed; the isolated install is back on source SHA-256
`AA4C09E73DE34B1AB6EEA5328880049578963C7C3DCBAAE07728CA408DA59F92`.
No package or production source was changed. Evidence:

- `artifacts/status-enemy-debug-timer-toggle-v1.json`, SHA-256
  `0FEB70AD9C8C1CFE3D196FE99DD4121201EB176E35E20721953337F1AD0B435E`;
- `artifacts/status-enemy-debug-timer-source-v1-product-a.json`, SHA-256
  `9781A0BE3542245466C654492DC33B1D6F8A69021A1ED62EC43C1952664A0711`;
- `artifacts/status-enemy-debug-timer-source-v1-control.json`, SHA-256
  `4A7F0BA38239BFF8779BA233369C43CC74DE18200D2AD9795B222F145F2C9C3D`;
- `artifacts/status-enemy-debug-timer-source-v1-product-b.json`, SHA-256
  `317C3C732109CFF812B24396DD4B4B572350F76FE4AC29B495C1B893E308E5C0`.

### Rejected enemy-loop LOS path batch

A transaction audit then tested a larger piece of the enemy loop. Across 916
`KinkyDungeonEnemyLoop` calls, the four bars-permitting visibility checks made
4,441 path queries. Only 1,832 were unique: all 2,609 repeats were consecutive,
remained inside the same event/mutation segment, and returned the same result.

The source candidate evaluated that path once, derived the medium, close,
very-close, and shooting results from their original distance thresholds, and
kept the four official `KinkyDungeonCheckLOS` calls whenever either LOS or path
checking had been replaced. On the compact hostile-combat fixture, the guarded
candidate/control/candidate medians were 84.5 / 87.3 / 85.2 ms. The combined
candidate mean saved 1.19%, with exact state and every adapter gate passing.

The second 120-enemy fixture reversed the result. Its
candidate/control/candidate means were 73.59 / 69.54 / 71.51 ms, making the
candidate 4.32% slower overall. All three legs still restored `2156b059`,
produced `e9a361db`, and passed the normal gates. The workload reversal rejects
the batch; the candidate was removed and exact source v67 restored. Evidence:

- `artifacts/status-enemy-loop-los-batch-v1-audit.json`, SHA-256
  `20200AEF8AB7CF6739937BE658D70FF6AE69F2E88C688C553594FF91C5872DE8`;
- fast candidate/control/candidate reports:
  `status-enemy-loop-los-batch-v1-fast-product-a.json`
  (`D4E19B214974A02FCB96F0EDE2CCDEBB5480C24BBB8684E96C7776E6B08A4E2E`),
  `status-enemy-loop-los-batch-v1-fast-control.json`
  (`447D9CBA6975F324CDDCEE2B391AFD08D06A088D62E704E8BF4357410463A402`),
  and `status-enemy-loop-los-batch-v1-fast-product-b.json`
  (`C2144ABA906E5BCFF16A714E3CA4BCF88FAEC675B210F4F6FA8AEB17B0054D7C`);
- slow candidate/control/candidate reports:
  `status-enemy-loop-los-batch-v1-slow-product-a.json`
  (`D7E382E8D65BFE4F1D7096AC7BEFE330378A3C9FA50E0DA9B4D2618E2A3FC538`),
  `status-enemy-loop-los-batch-v1-slow-control.json`
  (`EBF313BDC6E8CD09BF5549CB12A6176A7E862FB12403AA173473B94E6DCE054E`),
  and `status-enemy-loop-los-batch-v1-slow-product-b.json`
  (`25D8AD4E5997100737C1C5A8F52FD670B233F8F57892CC8F9951C3F25C7AE39F`).

### Event/RNG boundary audit

The last plausible turn boundary was already covered by the event-family
dispatcher probe: it called only families whose event maps contained the
current event, guarded every public sender identity, and still measured 0.868x.
Removing all compatibility checks made the unsafe upper bound worse at 0.806x.
Inlining the family map checks in all 12 senders was also neutral/slower at
0.986x. A separate routing table would encode the same decisions while adding
cache invalidation around mod-owned event maps.

RNG was not a measured turn bottleneck. `KDRandom` had no sample in the current
hostile-turn CPU profile; in the heavy map-generation profile it accounted for
1.624 ms, or 0.102% of sampled time. Moving that tiny generator across a
JavaScript/WASM boundary would add cost and make seed compatibility harder.
No event or RNG product candidate was justified. The useful outcome is the
cross-session seed contract above; the current turn profile is saturated until
a new workload exposes a larger transaction.

## Prison escort turn result

The crowded room is useful, but it does not exercise KD's prison state. A
second deterministic fixture now enters the real Maidforce prison path through
`KinkyDungeonDefeat`, keeps the generated jail guard and escort intent,
attaches the player's leash to that guard, and fills the map with 120 real
Maidforce entities. It then restores the same compressed save before every
official/optimized pair.

On 2026-07-27, 20 paired samples again ran three enemy turns per path:

| Path                                           | Median for three turns |                       Result |
| ---------------------------------------------- | ---------------------: | ---------------------------: |
| Official prison-turn paths                     |               63.10 ms |                     baseline |
| Seven guarded crowded-turn optimization slices |               36.30 ms | 1.709x paired-median speedup |

All 20 optimized samples were faster and every final gameplay-state signature
matched. The ratio of the two displayed medians was 1.738x. Across the timed
optimized samples, 39,580 nearby calls, 14,020 master queries, 7,780
nearest-player queries, and 120 movement batches used their guarded paths with
zero failure. The fixture itself verified
`PrisonerState === "jail"`, the Maidforce jail faction, the guard's
`leashCell` intent, and the matching player/guard leash IDs.

KD does not serialize its short-lived blindness counters, and its zero-time
load pass can reroll temporary enemy flags. The profiler now carries both in
fixture-only game data and reapplies them after KD finishes loading. That
removed load-side randomness from the A/B reset without changing normal game
saves.

The timed prison turns do not call `KinkyDungeonPlaceJailKeys`, so the
acceptance pass tests that adapter separately. Its oracle now constructs three
honest states: enough keyrings for the no-op shortcut, missing keyrings for the
official path, and a replaced map getter for exact mod fallback. All three
matched.

The prison profile also exposed 2,077 `KDPointWanderable` calls for only 244
coordinate/map pairs. A generation-aware memo prototype produced 1,809 hits in
its verification turn and matched all 2,038 observed returns, but still slowed
the paired turn benchmark to 0.909x. The original helper is cheap enough that
the cache bookkeeping loses; the prototype remains profiler-only.

Reproduce the prison gate against the isolated debug build:

```powershell
npm run profile:local:turn -- `
  --scenario prison `
  --ab-samples 20 `
  --ab-turns 3 `
  --output artifacts/prison-turn-profile-commander-budget16-canonical.json
```

The canonical report's SHA-256 is
`9E456965B0725442A48E3A80916DE99B5A7DB2818C5F3C8700B79EA0E2D1163F`.

## Commander rescue-prefix refinement

The rescue-prefix change was measured against the already accepted commander
shortcut, not against an unoptimized game. Twenty paired samples ran three
turns from the same restored fixture in each scenario:

| Fixture        | Existing shortcut | Prefix first |    Paired-median result |
| -------------- | ----------------: | -----------: | ----------------------: |
| Hostile combat |          33.90 ms |     30.90 ms | 1.100x; 20 of 20 faster |
| Crowded room   |          49.10 ms |     47.40 ms | 1.045x; 15 of 20 faster |
| Prison escort  |          40.10 ms |     39.60 ms | 1.008x; 13 of 20 faster |

All 60 paired final states matched. Each report also compared all 240 rescue
filter results in a verification turn, for 720 exact results and no mismatch.
In the combat fixture the change removed all 48 full-map rescue-proof scans
from each timed three-turn leg. A separate compatibility run replaced
`KDIsHumanoid` and `KDIsImmobile` in turn; both replacements were called by the
official filter, while the adapter recorded one clean fallback and no failure.
The refreshed 50-turn CPU profile no longer lists `refreshPotentials` as a
self-time hotspot.

Reproduce the three gates with:

```powershell
npm run profile:local:turn -- `
  --scenario combat `
  --probe-commander-help-prefilter `
  --ab-samples 20 `
  --ab-turns 3 `
  --output artifacts/combat-turn-profile-v4-commander-aware-prefilter-gate.json
```

Use `crowded` or `prison` for the other fixtures. Canonical report hashes:

- combat:
  `549B2E09A4434783DA9BA74C50B67EA5F690035FC7A37886BDDB7D64C29E9C4E`;
- crowded:
  `EC021934F5AE1B45C1CE3E21C85D1256ED527C8AE4E8229FDA292B2C4431A8F1`;
- prison:
  `18EB352EFE206F1B4A878A6E584AFBB45608EDC7AFF1C40B46A6433B194D155E`;
- dependency compatibility:
  `5D147C56A434D600C04E70297AEDE2767565B84CFBF4739D27105D9F7A235716`.

## Accepted official mobile-atlas startup policy

The first accepted texture slice selects between Kinky Dungeon's own full and
mobile TexturePacker atlases before the official startup loader reads
`KDToggles`. It is deliberately a TypeScript browser-boundary policy rather
than a WASM call: the operation consists of two `Storage.getItem` reads and
Pixi cache inspection, so crossing the JS/WASM boundary would add work without
moving repeated computation into Rust. Rust/WASM remains the preferred home
for compute-heavy batches.

The policy is isolated in `packages/bootstrap/src/texture-policy.ts`. It:

- activates only for KD 5.4.92, the official bundle SHA-256
  `2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4`,
  and Pixi 7.2.1;
- transiently supplies the selected `Mobile` toggle for exactly the two
  official startup reads, restores the original storage descriptor, and never
  writes or deletes the user's saved `KDToggles`;
- exposes `auto`, `original`, `full`, and `mobile` through the patcher
  configuration surface;
- deduplicates Pixi base textures while reporting decoded and estimated GPU
  bytes, without changing their lifetime; and
- leaves `PIXI.Assets.load`, all official atlas links, displacement pages,
  mod assets, and later storage wrappers untouched.

An earlier prototype that wrapped `PIXI.Assets.load`, returned a synthetic
object for duplicate requests, or loaded only one displacement page was
rejected. Those substitutions did not preserve the loader's return contract
or the game's complete displacement namespace.

The external atlas verifier inspected all six official families. Every linked
JSON and image exists; full and mobile variants have the same 6,634 frame keys
and TexturePacker source fingerprints; logical source geometry stayed within
two pixels. The 69 full pages decode to 1,118,932,192 bytes, while the 21
mobile pages decode to 289,009,516 bytes, saving 829,922,676 bytes (74.17%) in
the atlas set. Trim rectangles are not required to match because scaling
changes which near-transparent edge pixels TexturePacker retains; the verifier
instead checks page bounds, source bounds (including KD's 3x3 transparent
placeholder convention), rotation, logical source size, and exact frame-key
coverage. Sampled large trim deltas retained the same visible sprite content.

Matched live Intro captures on the isolated 9224 texture installation measured:

| Mode                 | Decoded texture bytes | Game-renderer private bytes | First interactive | Average FPS |    p99 | Frames over 16.7 ms |
| -------------------- | --------------------: | --------------------------: | ----------------: | ----------: | -----: | ------------------: |
| Full, warm           |         1,403,273,064 |               1,700,519,936 |        6,019.9 ms |     120.002 | 8.5 ms |                   0 |
| Mobile, warm         |           573,350,388 |                 847,880,192 |        4,988.1 ms |     120.003 | 8.5 ms |                   0 |
| Mobile, cold profile |           573,350,388 |                 798,842,880 |        7,199.7 ms |     120.002 | 8.5 ms |                   0 |

The warm comparison saves 829,922,676 decoded bytes and 852,639,744 renderer
private bytes, and reaches first interactive 1,031.8 ms sooner. Cold startup
is reported separately because it includes a pristine Chromium cache and is
not a valid A/B against the warm full run.

The three frozen Intro screenshots are byte-identical:
`c42cfa1ed3d8908776e7f3ad0b2f9efcf19c6586d1fd58d6614648f5a7637a37`.
A deterministic 51x37 Bandit combat fixture also matched its map signature,
eight-enemy faction composition, initial state, and 104/104 paired turn checks
in both texture modes. Its aligned full/mobile captures had a mean absolute
pixel difference of 9.4/255, consistent with the official atlas resolution and
animation timing, with no missing sprites or transparent blocks. A separate
100-turn mobile combat lifecycle completed in 160.1 ms, retained exact paired
state checks, restored the startup storage hook, reported no texture-policy
error, and ended at 572,121,068 decoded bytes. Renderer private memory was
909,606,912 bytes after that DevTools/CPU-profile workload.

Reproduction:

```powershell
npm run verify:textures -- --app-root "C:\Path\To\Kinky Dungeon\resources\app"
npm test -- --run texture-policy.test.ts rendering.test.ts startup.test.ts patcher.test.ts
node scripts/profile-live-rendering.mjs --port 9224 --duration 10000 --output artifacts/texture-mobile-warm-v2.json
node scripts/profile-live-turn.mjs --port 9224 --scenario combat --enemies 8 --turns 100 --ab-samples 1 --ab-turns 1 --output artifacts/texture-mobile-lifecycle-100turn-v1.json
```

The last command is a texture lifecycle fixture, not an AI-optimization
acceptance run. With one A/B sample it can exit nonzero on the independent
master-adapter speed threshold even when its state, texture, and lifecycle
checks pass; the JSON report records those checks separately.

## Accepted adaptive GPU frame pacing

The first accepted GPU slice reduces redundant scene submissions without
changing textures, simulation, or Pixi's offscreen rendering. A stage audit
first ruled out blanket viewport culling: the Intro contained 38 display
objects and the deterministic crowded room contained 382, with zero objects
outside the rendered viewport in either scene. KD already avoids constructing
most offscreen display objects, so another culling layer would add bounds work
without removing draws.

`packages/bootstrap/src/frame-pacing.ts` instead installs a deadline-based
stage pacer. It:

- activates only on KD 5.4.92, official `out/main.js` SHA-256
  `2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4`,
  and Pixi 7.2.1;
- wraps only `renderer.render(PIXIapp.stage)` and sends every other display
  object or render-texture call directly to the captured Pixi implementation;
- renders every stage request for one second after keyboard, pointer, touch,
  wheel, or focus activity;
- uses 60 FPS while focused and idle, 30 FPS while unfocused, and 10 FPS while
  hidden, without changing KD's `requestAnimationFrame` or update cadence;
- advances its deadline from the scheduled deadline, avoiding a 60 FPS target
  quantizing down to 48 FPS on a 144 Hz display;
- fails open on a decision error, preserves later renderer wrappers during
  disposal, and exposes
  `KDHybridRuntimeControl.disableGpuFramePacing` as a live control.

The final gate loaded the rebuilt bootstrap
`e142f4e615b7fdb182214b4419f0b2739bb7ffa08398fb05a38d9ea436cffd74`
in an isolated real Electron process and restored the same 51x37,
120-enemy room for both phases. The control was the production escape hatch,
so it exercised the same wrapper, renderer, process, scene, and textures:

| Five-second phase        | Stage requests | Real stage renders | `drawElements` | Clears | Flushes | rAF FPS |    p99 | Frames over 16.7 ms |
| ------------------------ | -------------: | -----------------: | -------------: | -----: | ------: | ------: | -----: | ------------------: |
| Full-render control      |            601 |                601 |          4,808 |  3,005 |     601 | 120.000 | 8.5 ms |                   0 |
| Adaptive focused-idle    |            600 |                300 |          2,400 |  1,500 |     300 | 120.002 | 8.5 ms |                   0 |

The adaptive phase therefore removed 50.08% of all three measured WebGL
command classes while leaving the game/update request cadence unchanged. This
is a direct GPU-submission workload result rather than an inference from the
wrapper's own counters.

The same live gate also proved the lifecycle boundary:

- a real `pointermove` event changed 36/72 idle renders to 72/72 active
  renders, then returned to 36/72 after the one-second activity window;
- two fixed control renders and the adaptive render matched all
  8,000,000 RGBA bytes exactly, with verifier identifier `b603ae3d`;
- an immediate second idle stage request was skipped; and
- a non-stage 16x16 render texture bypassed pacing exactly once and returned
  1,024 populated bytes.

Windows' aggregate 3D-engine utilization counter did not repeatably move with
the command count because compositor work, clock scaling, window focus, and
one-second sampling dominated this already-light scene. It is not an
acceptance metric. The accepted claim is precise: KD's idle stage draw, clear,
and flush submissions are halved. This does not claim that total GPU busy time
or wall power falls by exactly 50% on every machine.

Reproduction:

```powershell
npm test -- --run packages/bootstrap/src/frame-pacing.test.ts packages/bootstrap/src/rendering.test.ts
npm run verify:frame-pacing -- --port 9227 --duration 5 --output artifacts/gpu-frame-pacing-crowded-final-v1.json
```

After packaging and reinstalling from the final manifest, a separate Intro
smoke repeated 361 versus 180 draw/clear/flush commands, 120.000 FPS, an
8.5 ms p99, exact 8,000,000-byte pixels, and every acceptance check passing.
The canonical crowded and packaged-Intro report SHA-256 values are
`94B73F3CAEB2F07F4171286BF1A0C573711EA394DEDF26864E40AF3C01C5755E`
and
`53561E64AE537878A23D8F1A4E4F827E930A9229291284706544E93BE28C8F5B`.

## Candidates that measurement rejected

The profiler also keeps optional probes so attractive-looking ideas do not get
reimplemented from memory. On the same fixture:

The v64 revisit of direct pathfinding metadata access deliberately reused the
already-proven numeric-coordinate/no-mod scope, removing the older standalone
accessor guard. Product/control/product still measured 3,870.8 / 3,709.5 /
3,686.9 ms: the product mean was 1.87% slower. All three retained `c7ebd034`,
492,779 path calls, 2,929 selector calls, and exact restore. The helper samples
simply moved into `KinkyDungeonFindPath`; combined target time was neutral.
Reports `mapgen-v64-direct-tile-metadata-smoke-{product-a,control,product-b}.json`
hash to
`063EAA01109C9287234EE41CA30DA3271A14F9FBEE34AE4E1688E7597F18BB24`,
`A490DDF7748E449A455BC4D595B396A2E69B6B06837AE1FA4A044869E6EA9EC2`,
and
`58A30121E90DF1536BB64B9E52798269BCC6D5EB10B6EC4D2F3FD86772AB1DC6`.
The exact v63/v47 rollback smoke is
`mapgen-v64-rejected-rollback-v63-smoke.json`,
`A6317BBA6BB6D6F58DC6C3247A5E68C80373DCF7D50D9E73D3B4B15F4B61A6F5`.

| Candidate                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                      Live result | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cache faction/rank work inside `KinkyDungeonFindMaster`                                                       |                                                                                                                                                                                                                                                                                                                                                                                                 1.019x paired median, but 3 of 7 pairs regressed | too small and noisy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Fuse the master scan without rank-first rejection                                                             |                                                                                                                                                                                                                                                                                                                                                                                                                          0.953x ratio of medians | slower; superseded by the accepted rank-first design                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Rewrite `KinkyDungeonNearestPlayer` with guarded local caches                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                           0.952x | slower; superseded by the minimal hostile-first reorder                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| State-stamped `KDHostile` pair cache                                                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                           0.748x | much slower; 2,372 entries went stale in one turn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Inline guarded enemy-vs-enemy hostility arithmetic                                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                           0.928x | slower                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Commander-scoped hostility/faction maps                                                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                           0.941x | slower despite 11,359 faction and 2,866 hostility hits over two turns                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Encode dynamic enemy occupancy for non-trim native paths                                                      |                                                                                                                                                                                                                                                                                                                                                                                 32.50 ms versus the accepted 29.70 ms; state diverged by turn 20 | slower, non-equivalent, and removed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Replace direct enemy-position lookups with a dense occupancy index                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                           0.848x | slower despite exact final states                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Inline the direct enemy-flag lookup                                                                           |                                                                                                                                                                                                                                                                                                                                                                                                                                           0.786x | slower despite exact final states                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Skip top-level event dispatch when no handler exists                                                          |                                                                                                                                                                                                                                                                                                                                                                                                                             0.868x paired median | slower despite skipping 17,138 calls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Skip event dispatch with every per-call compatibility check removed                                           |                                                                                                                                                                                                                                                                                                                                                                                                       0.806x paired median; 0 of 15 pairs faster | even the unsafe upper bound was much slower                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Snapshot weapon and consumable inventory lists for a turn                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                             0.992x paired median | neutral/slower; only 4 of 7 pairs improved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Return one shared restraint array for the whole turn                                                          |                                                                                                                                                                                                                                                                                                                                                                                                        0.978x paired median; 2 of 5 pairs faster | unsafe upper bound was already slower                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Capture `KDMapData.Tiles` inside `KinkyDungeonTilesGet`                                                       |                                                                                                                                                                                                                                                                                                                                                                                                       0.986x paired median; 6 of 15 pairs faster | unsafe upper bound did not survive the larger gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Cache `KDMapData.Tiles` inside each full `KinkyDungeonFindPath` search                                        |                                                                                                                                                                                                                                                                                                                                                      Earlier 0.998x final gate; cheaper v64 no-mod-scope revisit had a product mean 1.87% slower | exact in both forms; removing the extra guard only moved helper samples into the caller, so the source and temporary signature were reverted                                                                                                                                                                                                                                                                                                                                                                                               |
| Hoist the jail-guard lookup out of `KinkyDungeonNearestPlayer`                                                |                                                                                                                                                                                                                                                                                                                                                                                                                             0.989x paired median | neutral/slower; only 3 of 7 pairs improved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Inline canonical faction resolution in `KinkyDungeonNearestPlayer`                                            |                                                                                                                                                                                                                                                                                                                                                                                                                             0.959x paired median | slower in all 7 pairs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Inline the fused hostility helper body directly into the nearest-player scan                                  |                                                                                                                                                                                                                                                                                                                                                                                                                             0.976x paired median | slower; only 3 of 7 pairs improved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Reuse the nearest-player route decision                                                                       |                                                                                                                                                                                                                                                                                                                                                                                                                             0.977x paired median | slower                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Reuse a fixed commander order-key list                                                                        |                                                                                                                                                                                                                                                                                                                                                                                                                             0.994x paired median | neutral/slower; only 3 of 7 pairs improved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Fuse `KinkyDungeonNoEnemyExceptSub` with its occupancy lookup                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                             0.974x paired median | slower; only 3 of 7 pairs improved despite all 1,166 calls taking the fused path                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Fuse `KinkyDungeonEnemyCanMove` with its occupancy checks                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                             0.988x paired median | neutral/slower; only 3 of 7 pairs improved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Clone and patch the complete enemy cache after every move                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                             1.005x paired median | too small and noisy; only 4 of 7 pairs improved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Verify the batched cache against a full rebuild after every move                                              |                                                                                                                                                                                                                                                                                                                                                                                                                             1.000x paired median | exact, but the oracle erased the entire gain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Tight-loop rewrite of `KinkyDungeonGetBuffedStat`                                                             |                                                                                                                                                                                                                                                                                                                                                                                                                             0.986x paired median | exact but slower                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Post-callback enemy-damage arithmetic through WASM                                                            |                                                                                                                                                                                                                                                                                           0.092x at the legal per-transaction boundary; 0.685x even for the non-integrable 155-record upper bound; exact 465/465, 0 of 11 candidate wins in both | boundary cost dominates; export removed, evidence retained in `combat-arithmetic-wasm-boundary-v1.json`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Rewrite `KinkyDungeonCheckPathCount` around a prebuilt mask                                                   |                                                                                                                                                                                                                                                                                                                                                                                                                             0.962x paired median | slower                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Reuse a dynamic JavaScript path array                                                                         |                                                                                                                                                                                                                                                                                                                                                                                                                             0.992x paired median | neutral/slower                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Memoize `KDPointWanderable` by coordinate and cache generation                                                |                                                                                                                                                                                                                                                                                                                                                                                                       0.909x paired median in the prison fixture | slower despite 1,809 hits and exact return/state parity                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Cache `KinkyDungeonLeashingEnemy` for the prison turn                                                         |                                                                                                                                                                                                                                                                                                                                                         unsafe upper bound reached 1.070x, but guarded forms measured 0.960x, 0.927x, and 0.989x | the winning version skipped live tether-condition checks; every compatible version was neutral or slower                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Cache the prison jail-guard lookup inside official AI                                                         |                                                                                                                                                                                                                                                                                                                                                                                            0.988x unsafe upper bound and 0.976x identity-guarded | both isolated forms were slower with 2,802 of 2,802 exact results                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Specialize the no-hook runtime dispatcher path                                                                |                                                                                                                                                                                                                                                                                                                                                                                              1.009x paired median, but a 0.994x ratio of medians | exact but noise-sized; reverted rather than adding a second dispatch path                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Replace `KDIsSmartMovable`'s `Map.has` plus `Map.get` with one lookup                                         |                                                                                                                                                                                                                                                                                                                                                                                               0.997x, with zero calls in the timed prison window | the CPU sample came from work outside the measured turn; nothing useful to optimize here                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Construct the repeated enemy `KDToySecret` buff directly                                                      |                                                                                                                                                                                                                                                                                                                                                                                                       0.990x paired median; 3 of 10 pairs faster | 120 of 121 calls used the exact fresh-object specialization, so generic cloning was not the bottleneck                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Skip value-identical `KDToySecret` reapplication                                                              |                                                                                                                                                                                                                                                                                                                                                                                                       0.984x paired median; 1 of 10 pairs faster | even the object-identity-changing upper bound was slower with 121 of 121 value-exact results                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Remove commander mutation observers immediately after the scan budget                                         |                                                                                                                                                                                                                                                                                                                                                                                    1.121x overall combat speedup versus 1.122x before the change | semantically safe but no repeatable incremental gain; reverted                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Lower the commander refresh ceiling from 16 scans to 8                                                        |                                                                                                                                                                                                                                                                                                                                                                        1.167x combat and 1.728x controlled crowded speedup in 10-pair smoke runs | no combat gain over 16, while crowded fell from 1.846x; rejected                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Source-clone the enemy update to remove debug clocks                                                          |                                                                                                                                                                                                                                                                                                                                                                                                            30.40 ms versus the accepted 29.70 ms | exact, but cloning the large function regressed the accepted build                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Add a commander-wide capture-target pre-scan                                                                  |                                                                                                                                                                                                                                                                                                                                                                                                            31.30 ms versus the accepted 29.70 ms | exact, but the extra scan cost more than it removed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Share rendered text textures                                                                                  |                                                                                                                                                                                                                                                                                                                                                                  6.19x microbenchmark, but 0.980x live turn-frame ratio and 1 of 9 frames faster | rendering lifecycle was exact, real frames were slower                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Inline the immunity helper                                                                                    |                                                                                                                                                                                                                                                                                                                                                                                        1.004x paired median, but zero calls in the timed fixture | no exercised workload, so there is no evidence of a gain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Rewrite enemy-flag ticking around one restraint lookup                                                        |                                                                                                                                                                                                                                                                                                                                                                                               1.024x paired median but a 0.990x ratio of medians | mixed/noisy and slightly slower by displayed medians                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Snapshot enemy-flag keys before ticking                                                                       |                                                                                                                                                                                                                                                                                                                                                                                               0.993x paired median and a 0.969x ratio of medians | slower despite exact state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Inline a helpless fast negative only inside the nearest-player scan                                           |                                                                                                                                                                                                                                                                                                                                                                                                                             0.990x paired median | slower in that wrapper shape despite 3,740 fast negatives; the later direct global source form removed more work and passed all three gates                                                                                                                                                                                                                                                                                                                                                                                                |
| Add a safe unbound fast negative to `KDBoundEffects`                                                          |                                                                                                                                                                                                                                                                                                                                                                                                   18.50 ms versus 19.40 ms; 3 of 10 pairs faster | slower despite 3,324 audited calls and exact compatibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Index positive owner buff events                                                                              |                                                                                                                                                                                                                                                                                                                                                                                                                          neutral across 20 pairs | no repeatable gain; kept the simpler negative-only index                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Add another magic-event cache guard                                                                           |                                                                                                                                                                                                                                                                                                                                                                                                                                neutral to slower | extra guard work did not remove enough scanning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Collapse `KDGetModifiedOpinionID` to one guarded ID lookup                                                    |                                                                                                                                                                                                                                                                                                                                                                                                         17.40 ms versus 18.10 ms; 4 of 10 faster | slower; even the unsafe upper-bound form was only noise                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Collapse `KinkyDungeonFindID` to one `Map.get`                                                                |                                                                                                                                                                                                                                                                                                                                                                                                         17.80 ms versus 18.80 ms; 4 of 10 faster | corrected the missing sentinel to `null`, then rejected the still-slower version                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Reuse every candidate faction inside nearest-player                                                           |                                                                                                                                                                                                                                                                                                                                                                                                          17.70 ms versus 18.00 ms; 1 of 5 faster | 9,930 reused resolutions did not repay the added bookkeeping                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Check LOS distance before the remaining LOS work                                                              |                                                                                                                                                                                                                                                                                                                                                                                                         17.60 ms versus 17.70 ms; 6 of 10 faster | only 802 of 7,403 calls were out of range; exact but neutral                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Inline the helpless negative again inside nearest-player                                                      |                                                                                                                                                                                                                                                                                                                                                                                                     1.012x in combat, but 0.964x in crowded play | the crowded fixture had no eligible fast negatives and regressed, so the global source shortcut remains the only accepted form                                                                                                                                                                                                                                                                                                                                                                                                             |
| Cache the commander order list locally                                                                        |                                                                                                                                                                                                                                                                                                                                                                                                             0.993x paired median; 7 of 20 faster | exact but slower                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Unroll all canonical commander orders                                                                         |                                                                                                                                                                                                                                                                                                                                                                                promising 1.037x smoke, then 0.978x paired median over 20 samples | the larger gate rejected the apparent smoke-run win                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Cache a batch-wide unrolled commander dispatch                                                                |                                                                                                                                                                                                                                                                                                                                                                                                              0.989x paired median; 3 of 7 faster | exact outputs, but cache and compatibility bookkeeping cost more than dispatch                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Remove the duplicate `KDEnemyCache.set` during rebuild                                                        |                                                                                                                                                                                                                                                                                                                                                                                     0.776x in the active-turn probe, with zero rebuilds observed | the timed workload never exercised the duplicate write; the probe only added wrapper cost                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Skip time-immunity work when the enemy delta is unchanged                                                     |                                                                                                                                                                                                                                                                                                                                                                                                      0.970x paired median in the split-loop form | skipped 480 checks and writes but still slowed the live turn                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Inline `KDMapHasEvent` into all 12 event-family senders                                                       |                                                                                                                                                                                                                                                                                                                                                                               0.986x paired median for the unchecked lean ceiling; 2 of 7 faster | V8 already optimized the tiny helper, and both guarded and unsafe forms lost                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Inline `KDEnemyHasFlag` inside `KDEntityHasFlag` with dependency guards                                       |                                                                                                                                                                                                                                                                                                                                                                                                           0.907x ratio of medians; 0 of 7 faster | all 21,012 diagnostic calls were exact and both dependency replacements fell back correctly, but the guards cost more than the removed call                                                                                                                                                                                                                                                                                                                                                                                                |
| Read an enemy's local flag value once before the collection fallback                                          |                                                                                                                                                                                                                                                                                                                                                                                                          0.968x ratio of medians; 4 of 10 faster | all 10,697 verification calls were exact, but the simpler source-shaped lookup was still slower                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Drop the unreachable `KDPackEnemy` identity check from the healthy-NPC shortcut                               |                                                                                                                                                                                                                                                                                                                                                                                                          0.977x ratio of medians; 3 of 10 faster | all 14,128 verification calls used the exact fast return, but removing one comparison did not repay the extra candidate layer                                                                                                                                                                                                                                                                                                                                                                                                              |
| Build `KinkyDungeonEnemyLoop` AI data with an equal-shape object literal                                      |                                                                                                                                                                                                                                                                                                                                                                                                          0.983x ratio of medians; 5 of 10 faster | exact state and AI-data shape, but neutral/slower                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Cache `KDFactionRelation` results inside each enemy-selector call                                             |                                                                                                                                                                                                                                                                                                                                                                                        28,491.3 ms versus 27,684.7 ms for invariant hoists alone | 107,464 cache hits did not repay per-call map allocation and lookup overhead                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Materialize `tags.keys()` once inside `KDGetRestraintsEligible`                                               |                                                                                                                                                                                                                                                                                                                                                                                              15,930.2 ms versus 15,899.7 ms on the same slow map | array creation was neutral/slower; the accepted loop inversion removes the nested scan instead                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Move the accepted enemy-selector invariant hoists directly into source and remove its runtime facade          |                                                                                                                                                                                                                                                                                                           52,275.3 ms versus 52,421.6 ms for the adjacent v8-adapter control (1.003x); only 146.3 ms / 0.28%, with 142 of 142 shadow calls exact | too small for a duplicated roughly 225-line source path; reverted                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Inline `KinkyDungeonFindPath`'s default heuristic expression                                                  |                                                                                                                                                                                                                                                                                                                                                         3,225.9 ms versus 3,100.1 ms in smoke and 14,311.1 ms versus 14,112.9 ms on the slow map | slower in both gates; V8 already handled the small local helper well, so the candidate and temporary signature were reverted                                                                                                                                                                                                                                                                                                                                                                                                               |
| Reuse the already-built `loc` string as the pathfinding successor key                                         |                                                                                                                                                                                                                                                                                                                                                         3,089.7 ms versus 3,027.2 ms in smoke and 14,380.6 ms versus 14,268.0 ms on the slow map | slower in both gates; the string-allocation change did not repay its branch and compatibility guard, so it was reverted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Skip path-cache suffix overwrites                                                                             |                                                                                                                                                                                                                                                202 of 4,683,471 existing suffixes had a different point sequence; the refined identical-only form measured 14,181.6 ms versus 14,140.6 ms and 853.0 ms versus 789.4 ms of cache-writer self time | the blanket form changed cache semantics, while proving identity cost more than the allocation it avoided; rejected                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Select the active path-cache `Map` once per search                                                            |                                                                                                                                                                                                                                                                                                      `KinkyDungeonFindPath` self-time improved by 28.7–72.7 ms across three slow pairs, but full-map time regressed by 5.0–187.6 ms in all three | the retained reference/control branch shifted more cost outside the sampled function than it removed; reverted                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Hoist the path-cacheability flag once per search                                                              |                                                                                                                                                                                                                                                       smoke measured 2,976.8 ms versus 2,898.0 ms and added 24.3 ms of `KinkyDungeonFindPath` self time; the slow map saved only 32.2 ms overall while adding 21.9 ms inside the target function | mixed/noisy and slower where the change applied; reverted to the exact v16 bundle                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Store enemy-selector candidates in parallel enemy/weight arrays                                               |                                                                                                                                                                                                                                                                                                                                             smoke measured 2,999.8 ms versus 2,923.3 ms and the slow map measured 14,172.7 ms versus 13,867.8 ms | slower in both gates despite exactly exercising 707 selector calls and 10,908 weighted entries; reverted                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Swap the verified pathfinding global to a thin direct wrapper during map generation                           |                                                                                                                                                                                                                                                            smoke measured 2,865.0 ms versus 2,826.1 ms for the retained facade route; a warm repeat measured 2,889.0 ms, while wrapper self time was 83.5–105.9 ms versus 73.5 ms for the facade | slower twice; rebinding the hot global likely deoptimized KD's call site, so the candidate was reverted to v19                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Hoist restraint-loop dependency checks once per `KDGetRestraintsEligible` call                                |                                                                                                                                                                                                                                                                            first smoke measured 2,902.5 ms versus 2,823.9 ms; the warm reversal was 2,842.7 ms versus 2,848.2 ms, while target self time regressed by 14.9–25.7 ms in both pairs | mixed wall time and consistently slower inside the target; the split guard likely defeated V8's better inlining, so it was reverted                                                                                                                                                                                                                                                                                                                                                                                                        |
| Disable path-cache writes during map generation                                                               |                                                                                                                                                                                                                                                                                                     19,636.2 ms versus 2,878.4 ms for the accepted cache writer; the probe skipped 3,575,703 would-be entries and eliminated 1,103 observed hits | catastrophically slower; the relatively rare continuation hits avoid enough repeated A* work to repay the write and allocation cost                                                                                                                                                                                                                                                                                                                                                                                                        |
| Limit path-cache suffix writes to the first 8 or 16 source positions                                          |                                                                                                                                                                                                              smoke retained the signature and prefix 8 kept 80.75% of observed hits for 22.67% of suffix writes, but the slow map changed from `16e5f1fe` to `840b7318` or `d9ebef9c`; live hits reached source index 76 on paths up to 96 steps | the fixed cutoff changed deterministic generation even though it was faster; rejected                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Cache the two repeated single-tag enemy-selector queries                                                      |                                                                                                                                                                                                                                                                                 smoke was neutral at 2,561.3 ms versus 2,561.4 ms; the slow map regressed to 13,191.6 ms versus 13,185.8 ms even though selector self time improved by 50.916 ms | the target-only saving did not improve the full workload; rejected before adding production guards                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Skip inert tag scans for cached queries on `noOverrideFloor` enemies                                          |                                                                              the profiler-only one-map `cat`/floor-1 pair retained signature `16e5f1fe` and passed restore/parity acceptance; 10,100 loop skips saved 56.9 ms overall (6,693.5 ms versus 6,750.4 ms) and 15.184 ms of selector self time in `mapgen-enemy-selector-no-override-skip-v30-slow-product.json` versus `mapgen-enemy-selector-no-override-skip-v30-slow-control.json` | only a 0.843% wall-clock ceiling on the pathological map, too close to profiler variance to justify production controls or a separate fallback surface; the candidate was removed                                                                                                                                                                                                                                                                                                                                                          |
| Defer pathfinding successor-object allocation until canonical `Map` checks accept it                          |                                           traced one-map smoke `mapgen-deferred-successor-allocation-v31-trace-smoke.json` avoided 1,269,974 of 2,088,074 allocations and used the candidate in all 78,073 eligible searches; however, alternating smoke pairs were +51.9 ms then -27.7 ms, and alternating slow-map pairs were +4.1 ms then -91.9 ms (`mapgen-deferred-successor-allocation-v31-{smoke,slow}-{product,control}-pair{1,2}.json`) | every paired stable field and signatures `e87fef77`/`c7ebd034` matched and all restore gates passed, but wall time and `KinkyDungeonFindPath` self time were mixed; the source, temporary signature, and control were reverted to exact v23                                                                                                                                                                                                                                                                                                |
| Revalidate every enemy definition on every weighted-selector table hit                                        |                                                                                                                                                                                                                                                                       the first guarded v32 form spent 1,010.106 ms in `enemySelectorWeightedQueryCacheEntryMatches` and measured 6,934.7 ms versus 6,343.8 ms for its disabled slow-map control | 590.9 ms slower; replaced by the accepted once-per-map validation and constant-time scope checks                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Treat the accepted restraint enemy-key loop as if its complete catalog had already been validated for the map |               the unsafe ceiling exercised 1,212 calls / 691,042 definitions in each smoke and 1,515 calls / 843,249 definitions on the slow map; smoke measured 2,396.9 versus 2,402.1 ms and 2,349.1 versus 2,440.1 ms, while the slow map measured 5,736.7 versus 5,680.6 ms (`mapgen-restraint-catalog-fast-path-v34-smoke-{product,control}-pair{1,2}.json` and `mapgen-restraint-catalog-fast-path-v34-slow-{product,control}-pair1.json`) | all `ea803e2d`/`541275cb` outputs and restores were exact, and the target slice saved roughly 27-49 ms, but whole-map results were mixed before adding any production guard; retained only as a profiler ceiling                                                                                                                                                                                                                                                                                                                           |
| Enumerate each accessibility frontier once per layer                                                          |                                                                    the profiler-only transform preserved the original snapshot order and exercised 103 `KinkyDungeonGetAccessible` calls; its first smoke was 2,596.9 versus 2,426.9 ms, and the warm repeat was 2,496.8 versus 2,426.9 ms (`mapgen-accessible-frontier-single-read-v35-smoke-product-pair{1,2}.json` and `mapgen-accessible-frontier-single-read-v35-smoke-control-pair1.json`) | exact `ea803e2d` output and restore, but 170.0 and 69.9 ms slower; transformed-function self time also rose from 68.687 to 81.553 ms, so the candidate stopped before the slow gate                                                                                                                                                                                                                                                                                                                                                        |
| Reuse each accessibility neighbor's tile metadata and grid character                                          |                                                                                                                                                                                                                  the canonical-helper-only ceiling exercised 103 `KinkyDungeonGetAccessible` calls and measured 2,475.2 ms versus 2,426.9 ms (`mapgen-accessible-neighbor-single-read-v36-smoke-product-pair1.json` and the v35 matched control) | exact `ea803e2d` output and restore, but 48.3 ms slower; transformed-function self time rose from 68.687 to 77.270 ms, so no production identity guard was attempted                                                                                                                                                                                                                                                                                                                                                                       |
| Defer enemy-selector scan-only setup until a complete weighted-table miss                                     |                                                                                                                                                                                                                                         alternating `cat`/floor-1 smoke pairs measured 5,490.4 versus 5,530.7 ms and 5,504.8 versus 5,421.5 ms (`mapgen-enemy-selector-weighted-scan-setup-deferral-v38-smoke-{product,control}-pair{1,2}.json`) | all `c7ebd034` outputs, 2,929 selector routes, cache counters, and restores were exact; sampled adapter-body median improved by only 8.8 ms while whole-map timing reversed from 40.3 ms faster to 83.3 ms slower, so the control, bundle, and source were reverted byte-for-byte to v37                                                                                                                                                                                                                                                   |
| Replace continuation-cache `has` plus `get` hits with one guarded `get`                                       |                                                                                                                                                                                                                                                an exhaustive verifier cross-checked 1,152,511 misses with zero stored-`undefined` entries; the canonical 12-map gate measured 28,398.2 / 28,391.5 / 28,760.6 ms in product/control/product order | exact outputs and restore state, but neutral to 1.30% slower end to end; v42 was removed and exact v41 restored                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Defer neighbor `"x,y"` construction until a tile is consumed                                                  | the exact slow-map verifier observed 9,318,967 eligible neighbors, built 5,899,511 location strings, avoided 3,419,456 (36.7%), and completed 5,899,511 comparisons with zero mismatches; uninstrumented product/control/product measured 4,459.2 / 4,332.1 / 4,246.6 ms, while target self-time was 919.482 / 900.090 / 876.402 ms (`mapgen-deferred-neighbor-location-v46-{equivalence-slow,lean-product-a,lean-control,lean-product-b}.json`) | exact `c7ebd034` output and restore state, but the paired result reversed from 2.93% slower to 1.97% faster and target self-time reversed with it; mixed/noisy, so v46 was removed and exact v45 restored                                                                                                                                                                                                                                                                                                                                  |
| Capture the dispatcher target once in the fixed-arity direct-official facade                                  |                                                                                                                                                                                                             product/control/product measured 4,353.3 / 4,257.1 / 4,320.1 ms on the 492,779-call slow map; facade self-time measured 163.349 / 138.445 / 133.852 ms (`mapgen-captured-facade-target-v48-slow-{product-a,control,product-b}.json`) | all `c7ebd034` outputs, call counts, and `24a5fc88` restores were exact, but both candidate wall times were slower and facade self-time reversed across the pair; v48 was rejected and exact v47 restored                                                                                                                                                                                                                                                                                                                                  |
| Replace the numeric-coordinate pathfinding closed `Map` with a holey array                                    |                                         product/control/product measured 1,628.0 / 1,515.3 / 1,543.6 ms while all 78,073 eligible searches used the array (`mapgen-v53-dense-closed-smoke-{product-a,control-a,product-b}.json`, `501D47FA6BDA1E74E81B5DD4B7579C256D2E06F7C1CF31DD214C35B92D7691A9`, `C352D17185F3F59610CC7DC5454054D52CCFAE40E60FF4B69FE47AA2E5AE1C06`, and `F82DEA740BA1DE15BA03FBB177DC0724A371869F0C27629EE6BC9E0BBB911456`) | all `e87fef77` outputs, 115,645 path calls, 707 selector calls, and `24a5fc88` restores were exact, but product was 7.44% then 1.87% slower; v53 and its temporary signature/control were removed, and exact v52 plus the v47 bootstrap passed rollback smoke `1ED36160F5A30881D18ED8BCAD49E4CF0056F24F9DEBA64B6008FCC84969258A`                                                                                                                                                                                                           |
| Reuse the three-term successor path cost behind a guarded hot-loop branch                                     |                                                                                                                                              four uninstrumented 12-map legs measured 31,415.8 / 31,443.9 / 31,641.8 / 32,949.9 ms in product/control/control/product order; the traced smoke exercised 78,073 searches and 2,088,074 successor constructions (`mapgen-v54-successor-cost-reuse-{product-a,control-a,control-b,product-b}.json`) | all 12 signatures, 1,749,802 path calls, 13,328 selector calls, and `24a5fc88` restores matched, but the product mean was 32,182.9 ms versus 31,542.9 ms control (2.03% slower); the v54 branch, signature, and profiler control were removed                                                                                                                                                                                                                                                                                              |
| Reuse the successor path cost directly without a hot-loop branch                                              |                                                                     clean-process product/control/product measured 22,026.8 / 22,099.5 / 22,256.2 ms (`mapgen-v55-successor-cost-reuse-cold-{product-a,control,product-b}.json`, `381533A120B0486B2AF92FA81A5F15AABCDB8D07136C4DADCC7D4AEEF8386D93`, `F0BCB427F3BC4C4999BA5D3F906CDBE52EA67DE33CFF62A6318F3F8D2326B7A9`, and `A53C849D3306AF117D4DEF963CDCF71C7BD89E635186C854BF13B71645E92D47`) | all 12 signatures, 1,749,785 path calls, 13,323 selector calls, and `24a5fc88` restores matched across fresh Electron processes; the two-product mean was 22,141.5 ms, 0.19% slower than the 22,099.5 ms control, so v55 and its temporary signature were removed and exact v52 passed rollback smoke `mapgen-v55-rollback-v52-smoke.json` (`6C90B772DC0B5FAAED1FBC118EBB5864B633537327CB4E65AC23578BD16AF79B`)                                                                                                                            |
| Iterate `KinkyDungeonGenNavMap` by keys, reuse tile metadata, and remove the impossible duplicate-key lookup  |                                                                                                                                       the v56 CPU P/C/P reduced target self-time from 310.223 ms to 250.278/263.044 ms, but the tighter v57 eight-leg wall gate measured products 23,391.0 / 23,492.5 / 23,375.9 / 23,848.4 ms and controls 23,738.7 / 23,435.6 / 23,221.7 / 23,913.9 ms (`mapgen-v57-gen-nav-{product,control}-{a,b,c,d}.json`) | the oracle covered 107 calls and 62,527 unique locations with zero duplicates (`mapgen-v57-gen-nav-unique-key-stats.json`, `0B2682E32777A172B98A6E9A929A4628708AF76C015BD46443F9F1EC639E4AAD`); all signatures, 1,749,802 path calls, 13,328 selectors, and `24a5fc88` restores matched, but only two of four pairs improved and the 23,527.0 ms product mean saved just 50.5 ms (0.21%); v56/v57 were rejected and exact v52 passed rollback smoke `939D2E8E225E967D40FE72D169F0BA776F97D0726DB90E9748266F138EE84DCE`                     |
| Replace the canonical accessibility-list scan in `KinkyDungeonIsReachable` with a direct `"x,y"` lookup       |                                                        the 12-map oracle routed 307 of 307 eligible calls through the direct lookup and shadowed every result with zero mismatches (`mapgen-v58-is-reachable-direct-key-{oracle-12map,stats}.json`, `B5A315549784CF3B065F1799ECCF7950456433CAC2D867242F5FA54C0EC6C531`, and `5041D3DCC327E5C5DA0A9EC273F8CC258452D0BC1B7E9FCDF72FA6B2F6FFCF20`); sampled self-time fell from 67.357 to 28.405 ms | paired wall timing was neutral then 418.9 ms slower: 22,980.6 / 22,983.3 ms and 23,974.2 / 23,555.3 ms in product/control order, while the sampled whole run was also 366.6 ms slower; v58 was rejected, and exact v52 plus the v47 bootstrap passed rollback smoke `mapgen-v58-rollback-v52-smoke.json` (`367271ADFECC13651D4AAA5AE73DF76030C61210C86174108615BAD3F2039B48`)                                                                                                                                                              |
| Skip canonical `KinkyDungeonMapSet` writes when the destination already contains the same one-character value |                                                                                                  the 12-map oracle observed 604,648 eligible calls and shadow-reconstructed all 251,917 skipped writes with zero mismatches (`mapgen-v59-map-set-noop-write-oracle-12map.json`, `09B293157040F0ABEDDE2ABD2DE070B93B6B8D464CDFC3C5C454C0BC53EED4DC`); disable, loaded-mod, and replaced-`replaceAt` probes all used the exact official write path | product/control/product measured 22,698.9 / 22,771.5 / 22,803.4 ms with exact signatures, calls, and restores; the product mean saved only 20.4 ms (0.09%) and one leg was slower, so the broad guard was rejected and exact v52 passed rollback smoke `mapgen-v59-rollback-v52-smoke.json` (`94364A2FBA6F0157B5E95F92571263BB78634DA7C4644B715026D48D70123162`)                                                                                                                                                                           |
| Skip only repeated cave-wall writes inside the canonical doodad random walk                                   |                                              the 12-map oracle executed all 218,723 proposed skips through the official setter and found zero grid mismatches (`mapgen-v60-replace-doodads-cave-write-oracle-12map.json`, `810E134CB2EDFF57F4D2275E8AF2DE242B7EA0D746F9727005E123CE335E5079`); explicit-disable, replaced-setter, and loaded-mod gates each routed all 101 one-map calls through the original loop with exact output and restore | the candidate-control eight-leg gate appeared 0.84% faster, but clean source swaps exposed control-branch overhead: v60/v52/v60 measured 21,769.0 / 21,764.4 / 21,812.4 ms, making the product mean 26.3 ms (0.12%) slower than byte-exact v52; v60 was rejected and exact v52 passed rollback smoke `mapgen-v60-rollback-v52-smoke.json` (`BFE2D851056163EBFDEE670D8CF3FE4BC2C1D122DDC4CF93E1E91FA15F2F6AB5`)                                                                                                                             |
| Replace the exact pathfinding open-set scan with a heap plus an insertion-order prefix scan                   |                                                                                                                                                                                                     the one-map audit counted 531,967 expansions, 4,158,473 scanned entries, an average open size of 7.817, and a maximum of 53 (`mapgen-v61-open-set-scan-stats-1map.json`, `F57D9F6A7DD5D9808BABD4CD784E633539E026164E0A9F6D55106CA4DEAE58D1`) | the exact `lowest_old` tie behavior would still require scanning through 3,596,812 entries, or 86.49% of the original work, while also maintaining the heap on every insertion/update (`mapgen-v61-open-set-selected-position-stats-1map.json`, `37351E8AF809CF96F899CE89647E8040465E4877A2CB5CD86C2F152A96D9A083`); no product candidate was justified, the temporary signature was removed, and exact v52 passed rollback smoke `EB4015D78DFAB491204A43612539DB4D5FD645CA64A0DDD389CA673F288948B7`                                       |
| Read `KDMapData.Tiles[testLoc]` directly inside the guarded numeric accessibility loop                        |                                                                                                                                                                                          the 12-map shadow oracle compared all 3,648,378 direct reads with `KinkyDungeonTilesGet` and found zero mismatches (`mapgen-v68-accessible-direct-tile-metadata-oracle-12map.json`, `2E8C07B5A49EA98BBB97BB72E6DFE313AC4E49D2019C725152B16AD8B377DA7B`) | fresh-process product/control and product/control pairs measured 18,003.0 / 17,698.8 ms and 17,588.5 / 17,781.5 ms; the result reversed direction and the product mean was 0.31% slower. All four retained the same 12 signatures, 1,749,785 path calls, 13,323 selector calls, and exact `24a5fc88` restore; v68 and its temporary profiler controls were rejected, and exact v67 remained active through the final control (`D27F992CB802A634CD4D1FC844ADEBA853C45C45E77452E629C7E2692755533D`)                                          |
| Snapshot `Object.entries(maxTagFlags)` once per canonical `KDMapTilesPopulate` call                           |                                                                                                                                                                 the 12-map oracle reused the snapshot across 105,720 loop iterations and re-enumerated beside every use, finding zero mutations or mismatches (`mapgen-v69-map-tiles-max-tag-entries-reuse-oracle-12map.json`, `1C6FBA83B16B6C371ED97BB2688357B18D93D0B631859007DD20911FC62D85`) | the first fresh-process product/control pair measured 18,104.7 / 18,119.3 ms, only 14.6 ms (0.08%) faster; the reverse candidate then spiked to 23,064.6 ms while exact v67 measured 18,300.7 ms. All four retained the same 12 signatures, 1,749,785 path calls, 13,323 selector calls, and exact `24a5fc88` restore, but the candidate was neither material nor repeatable; v69 and its temporary profiler controls were rejected, and the final exact-v67 control is `1A3CB914D783F3617DC2C34B4E04684FDF50EE31B26CE1090C73405FB18E71C0` |

The pathfinding fallback audit showed why the non-trim native occupancy idea
had little room to win: the observed unsupported calls combined `blockEnemy`, an enemy
context, and KD's `trimLongDistance` behavior. Those calls remain on the exact
official JavaScript fallback. The fallback tracer and paired pathfinding A/B
remain in the harness for a future batch design.

## End-to-end methodology

Report:

- frame-time p50, p95, and p99 rather than only FPS;
- turn-time p50, p95, p99, and maximum;
- renderer private memory and decoded texture estimate;
- startup to interactive;
- fallback count and reason per system; and
- browser/Electron, CPU, GPU, resolution, and operating system.

The target envelope is p99 frame time no greater than 8.33 ms, p95 turn time
below 8 ms, renderer memory below 900 MB, and startup below 5 seconds at 4K.
When a target cannot be met, the adaptive controller may lower texture quality
but must not alter simulation rules.
