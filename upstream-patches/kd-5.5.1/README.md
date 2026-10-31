# KD 5.5.1 source and bundle patches

This directory holds the MPL-covered Rusted Kinks changes against Kinky
Dungeon 5.5.1. It contains no game assets, saves, or full upstream source
tree.

Upstream identity:

- repository: <https://github.com/Ada18980/KinkiestDungeon>
- commit: `b37a3e91c5481310537dbfe6baa0302a2dcebbc6`
- branch: `5.5`
- in-game version: `5.5.1`
- clean `out/main.js` SHA-256:
  `60a85515783853653fd051936429494b8ef85024ff66b08134e68f9fe89248e0`

`source-optimizations-v1.patch` is the reviewable TypeScript delta.
`bundle-optimizations-v1.patch` is the byte-exact installed transformation and
produces `out/main.js` SHA-256:

`2a42cf93ea4d084988afdd37d5bd96c0f9fe4f7ef6b662b2ed1f8776a7443234`

The patch covers the accepted atlas-loading, first-use, Pixi 7, and
console-clean compatibility changes that remain useful on 5.5.1. The
installer also applies the shared MIT-covered pixi-filters 5.2.0 compatibility
patch to `Scripts/lib/pixi-filters.js`; distributable review source is under
`source/MIT/upstream-patches/`.

To inspect the source delta:

```powershell
git clone https://github.com/Ada18980/KinkiestDungeon.git
cd KinkiestDungeon
git checkout b37a3e91c5481310537dbfe6baa0302a2dcebbc6
git apply C:\path\to\rusted-kinks\upstream-patches\kd-5.5.1\source-optimizations-v1.patch
```

The installer accepts only the exact clean hashes, verifies every output, and
keeps byte-exact private backups for uninstall. Kinky Dungeon is credited to
Strait Laced Games LLC and its contributors. These KD patches are MPL-2.0;
upstream terms remain authoritative.
