# KD 5.5.6 release validation

This release ports the verified source patch and compatibility layer to the
official 5.5.6 desktop bundle. It uses source patch v2.

- Official bundle: `e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25`.
- Patched bundle: `4303a9a102d7596e8c4a62793d6e76c3003c8e2abbea185c642c260a0e07c00b`.
- Earlier v1 remains recognized for migration and restoration.

The accepted cache-key change keeps one writing loop and preserves slices,
coordinate/coercion order, point identity and every cache write. Nonprimitive
arguments use the original key construction. The existing
`KDHybridSourcePatchControl.disablePathCacheHoistedKeySuffix` flag bypasses it.
Its regression test imports the actual runtime control name and evaluates the
writer from the disclosed bundle patch, including custom collection behavior.

Six alternating matched graveyard pairs measured 23,729.2 ms official versus
22,778.7 ms optimized: 4.01% less generation time, with all six pairs faster.
Every full map and eight subsequent seeded RNG values matched. A shadow oracle
checked 139,166 real writer calls and 5,742,524 entries with zero identity/order
mismatches. These are workload-specific CPU measurements, not FPS or battery
claims. Other-area experiments were roughly neutral. Mixed intermediate
implementations were not selected.

The original 5.5.6 port passed 411 TypeScript tests (one skipped), 25 Rust tests,
seven focused writer tests, the native patcher suite, standalone packaging and
real-file install/configure/uninstall interoperability. Both patchers upgraded
a real earlier v1 install and restored original main/Pixi files byte-for-byte.
Unknown edits were rejected; 86 original player save files remained unchanged.
Publication builds additionally validate the release version and source snapshot.

Isolated official-Electron checks covered startup, mobile/adaptive rendering,
texture readback, generated dungeons, turns and ten locally authored mods. The
combined mod fixture uses Compatibility and verifies that its bypass flag is
active without a source restart. No universal compatibility claim is made;
external companion events were mocked rather than a live DCS mission.

The official map generator and updated pathfinder remain intact. No old
restraint-result cache, forced sprite refresh or experimental gameplay event
skipping is introduced. Mobile atlas totals are manifest-derived decoded bytes:
1,677,721,600 full versus 738,197,504 mobile (56% lower), not total process RAM.

Source patch diffs and both patcher implementations are disclosed in this tag
and included in manager/setup payloads. Private profiles, game artwork, saves,
raw local traces and personal mod configurations are excluded.
