# KD Hybrid redistribution

This directory builds the bootstrap patcher files intended for end users. It
installs only KD Hybrid's own control mod and does not contain Kinky Dungeon,
game assets, saves, profiles, or the upstream JavaScript bundle.

Run from the repository root:

```powershell
npm run redistribute
```

Generated kits are written under `redistribution/releases/`:

```text
KD-Hybrid-<version>/
  QUICKSTART.txt
  KDHybrid-Patcher.ps1
  tools/kd-hybrid-tool.mjs
  bootstrap/
  LICENSES/
  NOTICE.txt
  release-manifest.json
KD-Hybrid-<version>-setup.zip
SHA256SUMS.txt
```

Run `KDHybrid-Patcher.ps1` to install the optional early bootstrap and verified
source optimization. The patcher checks the exact game bundle, backs up
`index.html` and `out/main.js`, installs the owned
`Mods/KDHybridBridge.zip`, records hashes, and supports status and byte-exact
uninstall. KD discovers that ZIP through its normal mod loader and renders the
Hybrid options in its normal configuration screen. Other mods remain the
responsibility of the game's existing mod manager.

The native C++/Qt replacement lives under `native/manager` and is the preferred
release interface. This PowerShell kit remains a transparent fallback.
Generated release contents are intentionally ignored by Git; source, templates,
licensing rules, and the builder remain tracked.

## Ready-to-copy override

To create a command-free folder override for an ordinary unmodified KD 5.4.92
installation:

```powershell
npm run package:override -- --app-root "C:\Path\To\Kinky Dungeon"
```

The ZIP directly mirrors the destination paths:
`resources/app/index.html`, `resources/app/out/main.js`, and
`resources/app/kd-hybrid/`, plus `Mods/KDHybridBridge.zip`. Users close the
game and merge the included `resources` and `Mods` folders onto the folder
containing `KinkyDungeon.exe`.

The builder stages the verified source transformation, checks the exact
resulting hash, and verifies that the source installation remains unchanged.
It excludes `.kd-hybrid`, backups, and any `RESTORE` tree, so the clean
upstream `index.html` and `out/main.js` are never included.
