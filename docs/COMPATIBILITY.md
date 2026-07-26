# Compatibility

## Upstream detection

Detection is structural and data-driven. A release catalog may include the
upstream bundle hash, function name, arity, normalized-source hash, sentinel
tokens, and a side-effect-free probe. Exactly one candidate must match.
Unknown or ambiguous candidates remain on official JavaScript.

The initial adapter catalog targets upstream 5.1.12 and records metadata and
hashes, never upstream source. Files implementing behavior adapted from the
upstream game are separately marked MPL-2.0.

## Legacy JavaScript mods

The host supports existing `.js` and `.ks` mods. It does not replace the
upstream loader or evaluate mod code itself.

| Mod behavior | Result |
| --- | --- |
| Registers normal KD events | Events are applied through JS and remain visible |
| Reads globals after a turn | Host commits WASM results first |
| Replaces a migrated global | Only that native system falls back to JS |
| Uses unsupported arguments on a migrated global | That call alone falls back to JS |
| Replaces Pixi/DOM rendering | Simulation can remain native |
| Uses network or Electron APIs | Unchanged; governed by upstream Electron |
| Depends on exact function source text | Unsupported; system falls back |

Initial facade candidates from 5.1.12 include
`KinkyDungeonCreateMap`, `KinkyDungeonAdvanceTime`,
`KinkyDungeonEnemyLoop`, `KinkyDungeonEnemyTryMove`,
`KinkyDungeonEnemyTryAttack`, `KinkyDungeonMove`,
`KinkyDungeonMoveTo`, `KinkyDungeonFindPath`, `KinkyDungeonGetPath`,
`KinkyDungeonGetBuffedStat`, `KinkyDungeonDamageEnemy`,
`KinkyDungeonAttackEnemy`, and `KinkyDungeonSendEvent`.

## Current integrated adapter

Version 0.1 enables only `KinkyDungeonFindPath`, and only when the exact
5.1.12 normalized source signature matches. Static map searches are encoded as
one snapshot plus one weighted grid query. Enemy-aware searches, custom
heuristics, long-distance trimming, pass-through-enemy rules, and leash-target
rules use the captured official JavaScript function for that call.

The remaining facade entries are compatibility metadata and roadmap targets;
they are not presented as completed KD migrations.

## Public SDK

The runtime publishes `globalThis.KDHybrid` with:

- `version` and `abiVersion`;
- `status()` and `systemStatus()`;
- `registerHook()` and `unregisterHook()`;
- `dispatch()` and `query()`;
- `enableSystem()` and `disableSystem()`;
- `registerWasmPlugin()`; and
- `exportDiagnostics()`.

SDK additions are backward compatible within a major version. Native protocol
or plugin ABI changes require an ABI bump.

## Capability WASM plugins

A plugin declares an ABI, systems, capabilities, and maximum memory pages.
Available capabilities are read-state, propose-actions, receive-events,
path-query, diagnostics, and deterministic-random. Plugins do not receive WASI,
filesystem, network, DOM, Pixi, Electron, or writable core memory.
