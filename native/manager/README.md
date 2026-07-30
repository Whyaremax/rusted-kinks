# KD Hybrid Manager

KD Hybrid Manager is the native C++/Qt interface for installing, checking, and
removing the optional early bootstrap. It installs only its own small control
mod; Kinky Dungeon's existing mod workflow still handles every other mod.

The manager:

- accepts either the game root or `resources/app`;
- recognizes KD 5.4.92 by the exact `out/main.js` SHA-256;
- reads and writes the same `.kd-hybrid/installation.json` schema as the
  original TypeScript patcher;
- applies the exact hash-gated KD 5.4.92 source optimization;
- backs up and atomically updates both `index.html` and `out/main.js`;
- installs `Mods/KDHybridBridge.zip`, which KD recognizes through its normal
  mod list and uses to render Hybrid settings in the normal configuration UI;
- installs and changes the `quality`, `fast`, or `human` pathfinding mode and
  the `auto`, `original`, `full`, or `mobile` texture policy without replacing
  the original backup;
- verifies every copied payload file and refuses an unrelated or modified
  bridge ZIP;
- updates a verified earlier v0.1.1a installation in place;
- refuses unknown, incomplete, or user-modified states; and
- never opens Electron `userData`, saves, or profiles.

The source transformation is one exact, reviewed KD 5.4.92 patch set. The
manager refuses it unless the original and resulting SHA-256 hashes both match.
Uninstall verifies the stored bundle backup before restoring it and verifies
the owned control mod before removing it. The
corresponding TypeScript, C++, and conventional upstream patch sources ship
under `source/MPL-2.0/`.

The Windows build is marked `asInvoker`: it normally runs with the user's
existing permissions. If the selected game folder rejects a write test, the GUI
offers an explicit Windows administrator relaunch instead of requiring
administrator access every time.

## Build

Build the normal project payload first, then configure the manager:

```powershell
npm run build
cmake -S native/manager -B native/manager/build -DBUILD_TESTING=ON
cmake --build native/manager/build --config Release
ctest --test-dir native/manager/build -C Release --output-on-failure
```

Qt 6.2 or newer is required. Releases use shared Qt libraries for LGPL
compliance. Windows publishes a single-download self-extracting EXE; Linux
publishes x86_64 and ARM64 AppImages.

## Headless compatibility interface

The GUI executable also exposes the same native core for automation:

```text
KDHybridManager --headless status --app-root <path>
KDHybridManager --headless install --app-root <path> [--pathfinding-mode <quality|fast|human>] [--texture-mode <auto|original|full|mobile>]
KDHybridManager --headless configure --app-root <path> [--pathfinding-mode <quality|fast|human>] [--texture-mode <auto|original|full|mobile>]
KDHybridManager --headless uninstall --app-root <path>
```

Results are JSON. Exit code `2` represents a modified or incomplete state.

See `THIRD_PARTY.md` and the root project licenses before redistribution.
