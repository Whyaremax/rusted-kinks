# KD Hybrid redistribution

This directory builds the bootstrap patcher files intended for end users. It
does not install normal mods and does not contain Kinky Dungeon, game assets,
saves, profiles, or the upstream JavaScript bundle.

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

Run `KDHybrid-Patcher.ps1` to install the optional early bootstrap. The
patcher verifies the game bundle, backs up `index.html`, records hashes, and
supports status and uninstall operations. Normal mods remain the responsibility
of the game's existing mod manager.

The native C++/Qt replacement lives under `native/manager` and is the preferred
release interface. This PowerShell kit remains a transparent fallback.
Generated release contents are intentionally ignored by Git; source, templates,
licensing rules, and the builder remain tracked.
