# Rusted Kinks (KD Hybrid)

Rusted Kinks is an early Rust/WASM and JavaScript performance layer for Kinky
Dungeon. The game and its normal mod loader are still required.

This release branch targets **KD 5.5.6 / Pixi 7.2.1**. Download a manager or setup
archive from [Releases](https://github.com/Whyaremax/rusted-kinks/releases).

## Install

1. Close KD.
2. Run the Windows manager or matching Linux AppImage and select your game folder.
3. Install/update the bootstrap, then launch KD normally.

The setup ZIP is an alternative for PowerShell users. Follow its QUICKSTART.
Manual resources ZIPs are available for copying into the game folder. Use one
installation method. The managers/setup scripts keep verified backups and can
uninstall; manual copy packages require restoring a clean game to remove them.

## What changed for 5.5.6

- Updated exact-build detection, patching and atlas coverage.
- Kept startup fixes and optional mobile model textures. The active atlas total
  is 56% smaller in decoded bytes with mobile textures, with lower texture detail.
- Hoisted primitive path-cache key construction. Six matched graveyard-map pairs
  measured 4.01% less generation time, with exact maps and seeded RNG results.
- Kept the new official pathfinder and map generator. Older optimization results
  are not attributed to the updated game.
- Kept guarded nearby-enemy and jail-key shortcuts. Changed contracts fall back
  to the official JavaScript.
- Added migration from the earlier 5.5.6 source patch and byte-exact restoration.

Use **Compatibility** when a mod needs the original behavior. It can bypass the
new cache-key slice without forcing a source restart. Third-party combinations
beyond the tested fixtures are not claimed compatible.

## Build

Node 22+, Rust 1.88, wasm-pack, and the wasm32-unknown-unknown target are required.

```sh
npm ci
npm run build
npm run check
npm run redistribute
```

Native managers additionally need CMake and Qt 6.2+. See
[native manager instructions](native/manager/README.md). Production builds use
`BUILD_TESTING=OFF`; test builds are kept separate.

See [5.5.6 validation](docs/KD_5_5_6_RELEASE.md) for measured boundaries,
compatibility and rollback checks. Rusted Kinks code is MIT; adapted KD source
and conventional patches are MPL-2.0. License and source notices ship with the
packages. Original Kinky Dungeon belongs to Strait Laced Games LLC.
