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
