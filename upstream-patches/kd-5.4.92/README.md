# KD 5.4.92 source and bundle patches

This directory holds the MPL-covered Rusted Kinks changes against Kinky
Dungeon 5.4.92. It does not contain the game, its assets, saves, or a copy of
the upstream source tree.

Upstream:

- repository: <https://github.com/Ada18980/KinkiestDungeon>
- exact commit: `5c96c4c1e67faf136ba2c167ed889a9e29005a18`
- branch name: `5.4.90`
- in-game version: `5.4.92`
- clean `out/main.js` SHA-256:
  `2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4`

Two patches are included:

- `source-optimizations-v6.patch` contains the human-readable TypeScript
  changes maintained in the exact upstream source checkout.
- `bundle-optimizations-v6.patch` is the authoritative, byte-exact and
  human-readable JavaScript delta used by the installers for the official
  `out/main.js`. It also contains later accepted slices developed and tested
  directly against that shipped bundle.

The accepted changes cover guarded map-generation pathfinding, enemy
selection, restraint selection, nearest-target, helpless-state, buff-event,
and path-cache hot paths. Every fast path is version- and dependency-gated;
unsupported inputs and changed mod-facing helpers return to the original KD
logic.

To inspect or build the TypeScript-maintained portion:

```powershell
git clone https://github.com/Ada18980/KinkiestDungeon.git
cd KinkiestDungeon
git checkout 5c96c4c1e67faf136ba2c167ed889a9e29005a18
git apply C:\path\to\rusted-kinks\upstream-patches\kd-5.4.92\source-optimizations-v6.patch
npm ci
npm run build
```

Compiler versions and line-ending policy can change the bytes emitted by the
TypeScript build. The installer therefore does not accept an arbitrary local
build. Applying the authoritative bundle patch to the official input produces
SHA-256:

`aa4c09e73de34b1ab6eea5328880049578963c7c3dcbaae07728ca408da59f92`

The normal Rusted Kinks installer applies `bundle-optimizations-v6.patch` only
when the input hash matches the official bundle above, verifies the output
hash, and keeps the original bundle in its private backup. Uninstall restores
the exact original bytes.

Kinky Dungeon is credited to Strait Laced Games LLC and its contributors.
These patches and the adapted files they modify are MPL-2.0-covered; the rest
of Rusted Kinks remains MIT unless a file says otherwise. The upstream
repository's own contribution and redistribution terms still apply to the
game and its source.
