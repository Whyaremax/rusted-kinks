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

## Kinky Dungeon attribution

Kinky Dungeon is by Strait Laced Games LLC and its contributors. The exact
source revision used for compatibility work is public at
<https://github.com/Ada18980/KinkiestDungeon>, commit
`5c96c4c1e67faf136ba2c167ed889a9e29005a18`.

The MPL treatment here follows the license metadata shipped in the inspected
Electron application and confirmation from a Kinky Dungeon developer. The
public source repository also carries its own contributor and redistribution
terms; those upstream terms remain authoritative for upstream code. KD Hybrid
does not claim authorship of upstream code or behavior adapted into
MPL-marked files, and it does not re-host the complete upstream source tree.
The redistributable TypeScript and installed-bundle deltas are small patches under
`upstream-patches/kd-5.4.92/`.

The Kinky Dungeon game, name, artwork, audio, writing, and other assets are not
included in this repository and are not licensed by KD Hybrid.

Compatibility metadata was validated against the in-game Kinky Dungeon version
5.4.92. The same build's Electron `resources/app/package.json` reports package
version 5.1.12; package metadata is recorded separately and is not treated as
the game content version. The inspected upstream bundle had SHA-256:

`2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4`

Upstream copyright, patent, warranty, limitation-of-liability, credit, and
redistribution notices must be preserved where they apply.
