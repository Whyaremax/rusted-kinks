# KD Hybrid notices

KD Hybrid is an independent, community-developed compatibility and performance
project for Kinky Dungeon. It is not an official Kinky Dungeon release and is
not endorsed by the game's authors.

## License boundary

- Unless a file says otherwise, KD Hybrid source code is copyright 2026 KD
  Hybrid contributors and is licensed under the MIT License in `LICENSE`.
- Files carrying `SPDX-License-Identifier: MPL-2.0` contain implementation
  adapted from or closely based on Kinky Dungeon behavior. Those files and
  modifications to them are licensed under the Mozilla Public License 2.0 in
  `LICENSES/MPL-2.0.txt`.
- Generated bundles can combine both categories. Their corresponding
  MPL-covered source files are included in the portable distribution under
  `source/MPL-2.0/`.
- Generated browser bundles include the Acorn JavaScript parser under its MIT
  license in `LICENSES/ACORN-MIT.txt`.
- The compatibility delta for the bundled `pixi-filters` 5.2.0 file and its
  generated embedded patch remain under the upstream MIT license in
  `LICENSES/PIXI-FILTERS-MIT.txt`. Their review source is distributed under
  `source/MIT/`.

## Kinky Dungeon attribution

The private KD 5.5.6 compatibility patch was derived from the official
`kinky-dungeon-win_64.zip`, with clean `out/main.js` SHA-256
`e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25`.
Its authoritative bundle diff is disclosed under
`source/MPL-2.0/upstream-patches/kd-5.5.6/`. It does not claim that a historical
TypeScript source patch reproduces the new bundle. Release information:
<https://ada18980.itch.io/kinky-dungeon/devlog/1740880/556-official>.

Kinky Dungeon is by Strait Laced Games LLC and its contributors. The exact
source revisions used for compatibility work are public at
<https://github.com/Ada18980/KinkiestDungeon>: KD 5.4.92 commit
`5c96c4c1e67faf136ba2c167ed889a9e29005a18` and KD 5.5.1 commit
`b37a3e91c5481310537dbfe6baa0302a2dcebbc6`.

The MPL treatment here follows the license metadata shipped in the inspected
Electron application and confirmation from a Kinky Dungeon developer. The
public source repository also carries its own contributor and redistribution
terms; those upstream terms remain authoritative for upstream code. KD Hybrid
does not claim authorship of upstream code or behavior adapted into
MPL-marked files, and it does not re-host the complete upstream source tree.
The redistributable TypeScript and installed-bundle deltas are small patches
under `upstream-patches/kd-5.4.92/` and
`upstream-patches/kd-5.5.1/`.

The Kinky Dungeon game, name, artwork, audio, writing, and other assets are not
included in this repository and are not licensed by KD Hybrid.

Compatibility metadata was validated against in-game Kinky Dungeon versions
5.4.92 and 5.5.1. Both inspected Electron
`resources/app/package.json` files report package version 5.1.12; package
metadata is recorded separately and is not treated as the game content
version. The inspected upstream bundles had SHA-256:

- KD 5.4.92:
  `2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4`
- KD 5.5.1:
  `60a85515783853653fd051936429494b8ef85024ff66b08134e68f9fe89248e0`

Upstream copyright, patent, warranty, limitation-of-liability, credit, and
redistribution notices must be preserved where they apply.
