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

On 2026-07-26, the isolated KD 5.4.92 Electron build generated a fresh 31 by 19
graveyard map and placed 120 real `Maidforce` entities on distinct valid tiles.
Each entity requested a path to the same player location.

| Path | Mean 120-enemy batch | Queries/second | Relative to native |
| --- | ---: | ---: | ---: |
| Official JavaScript, cache cleared before every query | 19.55 ms | 6,138 | JavaScript was 1.240x faster |
| Official JavaScript, empty cache at batch start | 1.19 ms | 100,840 | JavaScript was 20.370x faster |
| Official JavaScript, warm shared cache | 0.036 ms | 3,333,333 | JavaScript was 673.333x faster |
| Rust/WASM native, first series | 24.24 ms | 4,950 | Baseline |
| Rust/WASM native, repeated series | 24.66 ms | 4,866 | 1.017x slower than first native series |

Compatibility checks passed:

- 120 of 120 JavaScript/native results matched exactly;
- every returned JavaScript and native path was valid;
- the timed native series handled all 1,200 calls natively with zero fallback
  and zero failure;
- all 19 `KinkyDungeonFindPath` parameters were exercised;
- unsupported enemy-aware, trimmed, custom-heuristic, passable-enemy, and leash
  calls fell back for one call and exactly matched the official function;
- every public `KDHybrid` method was exercised, including hooks, dispatch,
  direct binary query, diagnostics redaction, enable/disable, and plugin
  validation; and
- KD's built-in map-generation, full-runthrough, and jailer tests completed.

The result exposes an important integration bottleneck: native search is about
24% slower than uncached upstream JavaScript on this real map, while the
current facade also bypasses KD's very effective shared path cache.
Consequently, the current native adapter is a substantial performance
regression for the common many-enemies-to-one-target pattern. A production
optimization should preserve or replace upstream suffix caching and avoid
rebuilding/loading the whole grid snapshot for every query.

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
