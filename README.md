# KD Hybrid

KD Hybrid is an open-source performance and compatibility layer for Kinky
Dungeon. It keeps the Electron/Pixi user interface and the existing JavaScript
mod ecosystem, while moving batch-friendly simulation work into a deterministic
Rust core compiled to WebAssembly.

This repository does not redistribute Kinky Dungeon's original source, art,
audio, saves, or compiled bundles. A small set of clearly marked MPL-2.0 files
implements compatible behavior adapted from the upstream game; the remaining
integration and engine code is original MIT-licensed work. Users must obtain
the game separately from its official distribution.

## Design goals

- Preserve existing saves by never modifying the Electron `userData` directory.
- Preserve JavaScript mods through a versioned SDK and per-system fallback.
- Accelerate pathfinding, spatial queries, AI decisions, combat arithmetic,
  buffs, event batching, map generation, and snapshot encoding.
- Adapt texture quality to frame cadence and memory pressure.
- Refuse unknown or ambiguous game signatures instead of guessing.
- Install and uninstall reversibly, with hashes and backups for every changed
  game file.
- Keep diagnostics local, scrubbed, and previewable before a user shares them.

The performance targets are deliberately aggressive: 4K/120 Hz, p99 frame
cadence at or below 8.33 ms, p95 turn processing below 8 ms, renderer memory
below 900 MB, and startup below 5 seconds. These are targets, not guarantees;
hardware, enabled mods, and upstream changes remain important.

## Repository layout

```text
crates/kd-core       Pure Rust simulation core and binary protocol
crates/kd-wasm       Small wasm-bindgen boundary
packages/runtime     JavaScript SDK, dispatcher, bridge, assets, diagnostics
packages/bootstrap   Early and normal-mod bootstrap entrypoint
packages/tools       Patcher and distribution packager
scripts              Build and save-safety verification helpers
docs                 self explanatory
```

## Development

Requirements are Node.js 22+, npm 10+, Rust 1.88, the
`wasm32-unknown-unknown` target, and `wasm-pack`.

```powershell
npm install
npm run check
npm run build:wasm
npm run build
npm run package
```

No development command needs access to a live KD installation or save folder.
All patcher tests operate on generated fixtures.

## Installation model

The normal distribution is a portable mod ZIP. An optional bootstrap patcher
can inject the early asset controller for lower startup memory. The patcher:

1. verifies the target layout and installed bundle signature;
2. writes all KD Hybrid files under `resources/app/kd-hybrid`;
3. backs up the original `index.html`;
4. records SHA-256 hashes in `resources/app/.kd-hybrid/installation.json`; and
5. supports idempotent status and uninstall operations.

It never reads or writes the KD save/profile directory.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/COMPATIBILITY.md](docs/COMPATIBILITY.md),
[docs/LOCAL_TESTING.md](docs/LOCAL_TESTING.md),
[docs/PERFORMANCE.md](docs/PERFORMANCE.md), and
[docs/SAFETY.md](docs/SAFETY.md) for implementation and validation details.

## Licensing and upstream credit

KD Hybrid's independently written code is licensed under the MIT License.
Files that contain code adapted from Kinky Dungeon are marked
`SPDX-License-Identifier: MPL-2.0` and remain under the Mozilla Public License
2.0. The bootstrap package is therefore a file-level mixed-license work; the
MPL does not relicense the repository's separate MIT files.

Kinky Dungeon and its original source remain the work of their respective
authors and contributors. This project is an independent compatibility and
performance layer, is not an official Kinky Dungeon release, and does not
grant rights to the game's name, artwork, audio, or other assets.

See [NOTICE.md](NOTICE.md), [LICENSE](LICENSE), and
[LICENSES/MPL-2.0.txt](LICENSES/MPL-2.0.txt) for the exact boundary and
redistribution notices.
