# Community mod compatibility repairs

For Kinky Dungeon **5.4.92 / Pixi 7.2.1**, alongside Rusted Kinks. These repairs target four exact original ZIP files. Modified or different versions are rejected by SHA-256 before unpacking.

## Use

Install Node.js 22 or newer, extract the repair tool ZIP, then run:

```sh
node repair-community-mod.mjs "original.zip" "repaired.zip"
```

The tool refuses to overwrite the input or an existing output. Keep the original outside the active mod folder, then load only the repaired ZIP. Do not leave backups whose names contain .zip in the active folder: the game's loader may load them too. This tool ZIP itself is a command-line utility, not a game mod.

For a source checkout, run npm ci and replace repair-community-mod.mjs above with scripts/prepare-community-mods.mjs. Validate your inputs using node scripts/verify-community-repairs.mjs followed by the original ZIP paths.

| Original archive | Repair |
| --- | --- |
| Chastity101 v1.1 | Defer assets until registration completes; preserve other afterLoadGame callbacks. |
| AppendixBondage v0.44 patched | Normalize archive paths and use registered texture URLs. |
| Rika's Custom Restraints G 1.7.1 | Load atlases and displacement textures through registered archive URLs. |
| Firearms Armory v1.0.0 | Separate audio from image loading; restore missing model folders from definitions. |

DollLia Spellblade v0.54 passed the tested fixture without changes. This is not a claim of exhaustive compatibility for every mod feature or future release.

## Accepted input SHA-256

```text
9bcbb7d901760ebd689d49a32d8aec84265488fc223678378109b9da89370239  Chastity101v1.1.zip
c9ef89670db17cbad2a205437d989168e7f539f0918047c03e12e597082ba2b3  AppendixBondagev0.44_patched.zip
8f3dec55654de0cc6f512ceb49ab8838fb20ad8e66e50cdf3c623435f7302331  RikasCustomRestraints_G_1.7.1.zip
da3625a17fd67f914bc23591986820c4becd8288f5b7a04ba88de87d264dd1a5  KDFirearmsArmory_v1.0.0.zip
```

Local validation covered deterministic repair output, preserved asset bytes, complete texture loading (109 Rika atlas frames and 31 displacement textures), maps, turns, selected perks, and disposable save reload with 17 mods in two load orders. The Low Power add-on also passed the packaged 18-mod fixture. No author archives, game assets, or player saves are included in this distribution.

The repair recipes are MIT-licensed Rusted Kinks tooling; original mods retain their authors' licenses. The bundled fflate dependency's MIT notice is included.
