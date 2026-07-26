# KD Hybrid Manager

KD Hybrid Manager is the native C++/Qt interface for installing, checking, and
removing the optional early bootstrap. It deliberately does not install normal
mods; Kinky Dungeon's existing mod workflow already handles those.

The manager:

- accepts either the game root or `resources/app`;
- recognizes KD 5.4.92 by the exact `out/main.js` SHA-256;
- reads and writes the same `.kd-hybrid/installation.json` schema as the
  original TypeScript patcher;
- backs up and atomically updates `index.html`;
- verifies every copied payload file;
- refuses unknown, incomplete, or user-modified states; and
- never opens Electron `userData`, saves, or profiles.

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
KDHybridManager --headless install --app-root <path>
KDHybridManager --headless uninstall --app-root <path>
```

Results are JSON. Exit code `2` represents a modified or incomplete state.

See `THIRD_PARTY.md` and the root project licenses before redistribution.
