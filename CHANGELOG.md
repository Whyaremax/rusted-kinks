# Changelog

## Unreleased

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
- Kept original KD Hybrid work under MIT while isolating KD-adapted files under
  MPL-2.0 and shipping attribution, licenses, and their exact source.
