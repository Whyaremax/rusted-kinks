# KD 5.4.92 developer harness

KD 5.4.92 already contains a developer harness. It is enabled when the game
page receives a `test` URL parameter, so the isolated KD Hybrid installation
loads:

```text
index.html?test=kd-hybrid
```

The live installation is not changed. The test executable uses its own
`user-data` directory and opens detached renderer DevTools automatically.

## Built-in controls

Start or load a disposable run, open the in-game Restart screen, and leave
`Debug Mode` enabled. The developer panel can:

- spawn an enemy, ally, or shop NPC by internal name;
- add items and restraints;
- bind or defeat a selected enemy;
- add keys, spell points, or all restraints;
- clear worn or loose restraints;
- toggle full vision and unlimited gold;
- move to the stairs, increment the floor, or enter parole.

`Maidforce` is a useful capture test enemy because KD 5.4.92 marks it as
`leashing`, `jail`, and `jailer`.

## End-to-end smoke route

Run this first in the renderer console:

```javascript
KDHybrid.status()
globalThis.kdHybridPathBefore = { ...KDHybrid.systemStatus("pathfinding") }
```

The runtime should be initialized, `nativeAvailable` should be `true`, and the
pathfinding system should be in `native` mode.

The planner defaults to `fast`. During a disposable test it can be changed
through `KDHybrid.setPathfindingMode("quality" | "fast" | "human")`; use
`KDHybrid.getPathfindingMode()` to inspect the current choice.

Exercise map generation, floor progression, and jail-guard selection:

```javascript
KDTestMapGen(2, [0], ["grv"])
KDTestFullRunthrough(1, false, false)
KDTestjailer(10)
```

`KDTestMapGen` should return `true`. `KDTestFullRunthrough` should return
`true`; it advances and replaces the current disposable run. `KDTestjailer`
prints the sampled guard names.

For a natural capture test:

1. Return to the in-game Restart screen.
2. Enter `Maidforce` in the enemy field and select `Enemy`.
3. Return to the game.
4. In the console, make the spawned maid hostile and exhaust player will:

   ```javascript
   const captor = [...KDMapData.Entities].reverse().find(
     (entity) => entity.Enemy.name === "Maidforce"
   )
   KDMakeHostile(captor, 9999)
   captor.aware = true
   KDChangeWill("", "", "", -100)
   ```

5. Let the maid bind, leash, and capture the player. Follow the sequence until
   the prison map is generated and the guard finishes escorting the player.

If testing time is limited, the same prison-generation and escort pipeline can
be entered deterministically after spawning the maid:

```javascript
KinkyDungeonDefeat(true, captor)
```

This shortcut deliberately skips the combat that causes defeat. It still runs
KD's prison-map generation, installs the captor as the jail guard, attaches the
player leash, and starts the guard's escort-to-cell intent.

After the route, compare the KD Hybrid adapter counters:

```javascript
const after = KDHybrid.systemStatus("pathfinding")
console.table({
  before: kdHybridPathBefore,
  after,
  delta: {
    calls: after.calls - kdHybridPathBefore.calls,
    nativeCalls: after.nativeCalls - kdHybridPathBefore.nativeCalls,
    fallbackCalls: after.fallbackCalls - kdHybridPathBefore.fallbackCalls,
    failures: after.failures - kdHybridPathBefore.failures,
  },
})
```

`nativeCalls` should increase and the failure delta should remain zero. Some
queries may intentionally use JavaScript fallback when their argument shape is
outside the native adapter's supported contract.

## Scope

The active build covers native pathfinding plus guarded JavaScript-side nearby,
master, commander, nearest-player, movement-cache, and jail-key slices. The
early installer runs the nearest-player slice directly in the exact source
bundle; the portable mod uses its runtime form. Map generation, combat,
capture decisions, and jail state still remain mostly upstream JavaScript.
This route is an end-to-end integration test because those systems repeatedly
exercise the installed adapters, source gate, native bridge, validation, and
fallback paths. It is not evidence that every listed game subsystem has already
been rewritten.

## Automated 120-enemy pathfinding stress test

Launch the isolated executable with a loopback-only Chromium debugging endpoint:

```powershell
npm run test:local:launch:debug
```

Then run:

```powershell
npm run test:local:pathfinding
```

The harness creates a fresh isolated run, places 120 real `Maidforce` entities
on valid map tiles, and measures the same 120 paths with the upstream
JavaScript implementation and all three native planners. It checks
reachability and path validity, exercises all 19 upstream
`KinkyDungeonFindPath` arguments,
requires exact results for calls routed to JavaScript fallback, tests the
public `KDHybrid` API surface, and invokes the built-in map-generation,
full-runthrough, and jailer samplers. A machine-readable report is written to
`artifacts/pathfinding-stress-latest.json`.

## Automated 120-enemy prison-turn stress test

With the same isolated debug build running, execute:

```powershell
npm run profile:local:turn -- `
  --scenario prison `
  --ab-samples 20 `
  --ab-turns 3 `
  --output artifacts/prison-turn-profile-canonical.json
```

This fixture calls KD's real `KinkyDungeonDefeat` prison transition, keeps the
generated Maidforce guard, attaches the player leash to it, and adds enough
nonhostile Maidforce entities to reach 120. Before timing, it verifies the jail
state, prison faction, guard escort intent, and leash IDs. Each timing pair
restores the same compressed save, alternates official/optimized order, and
compares the final gameplay-state signature.

The acceptance pass also runs the static and live AI oracles, movement-cache
risk cases, and jail-key full/missing/mod-replacement scenarios. It fails on a
parity mismatch, unexpected fallback, adapter failure, or a median slowdown.
The canonical local result is documented in
[`PERFORMANCE.md`](./PERFORMANCE.md#prison-escort-turn-result).

To A/B the direct nearest-player source body against its exact original branch,
add `--probe-source-nearest`. The profiler toggles only the patch's isolated
developer control, verifies the fallback and canonical counters, and compares
every observed live call:

```powershell
npm run profile:local:turn -- `
  --scenario combat `
  --probe-source-nearest `
  --ab-samples 20 `
  --ab-turns 2 `
  --output artifacts/combat-turn-profile-source-nearest-canonical.json
```

To A/B the adaptive source buff-event index, add
`--probe-source-buff-event-index`. The probe alternates the complete upstream
scan and optimized path, restores the same fixture before every leg, compares
final state, and runs compatibility checks for standard API applications,
direct-write invalidation, next-tick rebuilding, helper replacement, handler
order, and the explicit disable control:

```powershell
npm run profile:local:turn -- `
  --scenario combat `
  --probe-source-buff-event-index `
  --ab-samples 20 `
  --ab-turns 2 `
  --output artifacts/combat-turn-profile-source-buff-event-index-canonical.json
```

To A/B the packed-safe healthy-NPC `KDHelpless` shortcut, add
`--probe-source-helpless-fast-negative`. Besides paired final-state checks, the
probe covers injured, bound, packed, and player inputs; helper replacements;
the explicit disable switch; and public function replacement:

```powershell
npm run profile:local:turn -- `
  --scenario combat `
  --probe-source-helpless-fast-negative `
  --ab-samples 20 `
  --ab-turns 3 `
  --output artifacts/combat-turn-profile-source-helpless-fast-negative-packed-gate.json
```

Fixture restoration carries the complete transient `KinkyDungeonFlags` map,
so flags created by one A/B leg or scenario cannot leak into the next.

The debugging endpoint is only needed for automation and should remain bound
to `127.0.0.1`. Normal test launches do not expose it.
