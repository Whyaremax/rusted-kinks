# KD 5.4.92 source and bundle patches

This directory holds the MPL-covered Rusted Kinks changes against Kinky
Dungeon 5.4.92. It contains no game assets, saves, or full upstream source
tree.

Upstream identity:

- repository: <https://github.com/Ada18980/KinkiestDungeon>
- commit: `5c96c4c1e67faf136ba2c167ed889a9e29005a18`
- branch: `5.4.90`
- in-game version: `5.4.92`
- clean `out/main.js` SHA-256:
  `2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4`

The active release uses `source-optimizations-v7.patch` for review and
`bundle-optimizations-v7.patch` for the byte-exact installed transformation.
It produces `out/main.js` SHA-256:

`aa92bb52a07a553086525704f3b1ee8f3a7f2fe6e008cd507f74c9cde9c57b3d`

Version 7 retains the guarded hot-path work from version 6 and adds the
accepted atlas-loading, first-use, Pixi 7, and console-clean compatibility
changes. The installer also applies the shared MIT-covered pixi-filters 5.2.0
compatibility patch to `Scripts/lib/pixi-filters.js`; distributable review
source is under `source/MIT/upstream-patches/`.

The version 6 source and bundle patches remain here only so installed legacy
manifests stay reviewable and migratable. New installs select version 7.

To inspect the source delta:

```powershell
git clone https://github.com/Ada18980/KinkiestDungeon.git
cd KinkiestDungeon
git checkout 5c96c4c1e67faf136ba2c167ed889a9e29005a18
git apply C:\path\to\rusted-kinks\upstream-patches\kd-5.4.92\source-optimizations-v7.patch
```

The installer accepts only the exact clean hashes, verifies every output, and
keeps byte-exact private backups for uninstall. Kinky Dungeon is credited to
Strait Laced Games LLC and its contributors. These KD patches are MPL-2.0;
upstream terms remain authoritative.
