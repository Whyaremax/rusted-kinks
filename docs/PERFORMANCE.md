# Performance methodology

Performance claims require the same seed, room, save fixture, mod set, viewport,
quality tier, warm-up period, and action trace for both paths.

## Current verified microbenchmark

On 2026-07-26, the release WASM pathfinder was compared directly with
`KinkyDungeonFindPath` extracted from the installed KD 5.4.92 `main.js`.

- Fixture: deterministic 61 by 39 grid with a 24% interior wall rate.
- Sampling: 100 warm-up calls, then the median of seven 1,000-call samples.
- Upstream path caching: disabled so both sides performed the path search.
- JavaScript: 396.015 microseconds per call.
- Rust/WASM: 217.105 microseconds per call.
- Measured pathfinding speedup: 1.824x.
- Route parity: 100 of 100 deterministic start/goal fixtures matched exactly;
  the timed route was also identical at 60 steps.
- Native bridge failures: zero across the benchmark.
- Host: Intel Core i7-12700KF, Windows 11 build 28120, Node.js 24.15.0,
  Rust 1.88.0.

Reproduce it after a release build:

```powershell
node scripts/benchmark-native-pathfinding.mjs `
  ..\..\resources\app\out\main.js 1000
```

This is a focused pathfinding microbenchmark, not a claim that the whole game is
1.824x faster. End-to-end frame time, turn latency, startup, memory, real maps,
and mod-heavy traces still need measurement inside Electron. Unsupported call
shapes intentionally fall back to the official JavaScript function.

## Live 120-enemy stress result

On 2026-07-26, the optimized adapter was tested inside the isolated KD 5.4.92
Electron build on a fresh 31 by 19 map with 120 real `Maidforce` entities. Each
entity requested a path to the same player location. Every comparison used the
same queries and the same cache policy on both sides.

| Cache policy | Official JavaScript | KD Hybrid | KD Hybrid speedup |
| --- | ---: | ---: | ---: |
| Cleared before every query | 83.84 ms/batch | 40.92 ms/batch | 2.049x |
| Empty at each 120-enemy batch start | 3.46 ms/batch | 2.36 ms/batch | 1.466x |
| Warm shared cache | 0.073 ms/batch | 0.070 ms/batch | 1.043x |

The cache-cold hybrid series handled 1,200 facade calls with only 20 native
bridge operations: one snapshot load and one native seed search per batch.
Direct cache hits stayed in the facade, while cache-assisted misses used KD's
official suffix-splicing search. The warm series issued zero bridge calls.

Compatibility checks passed:

- 120 of 120 uncached results matched exactly;
- 120 of 120 cache-cold results matched exactly;
- every returned JavaScript and native path was valid;
- every timed series completed with zero native failure;
- all 19 `KinkyDungeonFindPath` parameters were exercised;
- unsupported enemy-aware, trimmed, custom-heuristic, passable-enemy, and leash
  calls fell back for one call and exactly matched the official function;
- every public `KDHybrid` method was exercised, including hooks, dispatch,
  direct binary query, diagnostics redaction, enable/disable, and plugin
  validation; and
- KD's built-in map-generation, full-runthrough, and jailer tests completed.

This replaces the earlier integration result where the adapter bypassed KD's
cache and rebuilt the grid for every enemy. The fix preserves KD's cache maps
and invalidation generation, reuses one immutable native grid, caches
unreachable results for that generation, and removes hook bookkeeping from the
no-hook fast path. Cache-assisted misses deliberately use the captured official
function because its partial suffix splice is faster than serializing a cache
frontier across WASM.

Host: Intel Core i7-12700KF, NVIDIA RTX 4070 Ti, 128 GiB RAM, Windows 11, and
Electron from KD 5.4.92. Reproduce the test with:

```powershell
npm run test:local:pathfinding
```

The complete local result is written to
`artifacts/pathfinding-stress-latest.json`.

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
