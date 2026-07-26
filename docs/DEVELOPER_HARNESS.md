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

The active native rewrite currently covers `KinkyDungeonFindPath`. Map
generation, combat, capture decisions, and jail state remain upstream
JavaScript. This route is still an end-to-end integration test because those
systems repeatedly call the installed pathfinding adapter while the bootstrap,
signature gate, native bridge, validation, and per-call fallback remain active.
It is not evidence that every listed game subsystem has already been rewritten.

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
JavaScript implementation and the native adapter. It checks reachability and
path validity, exercises all 19 upstream `KinkyDungeonFindPath` arguments,
requires exact results for calls routed to JavaScript fallback, tests the
public `KDHybrid` API surface, and invokes the built-in map-generation,
full-runthrough, and jailer samplers. A machine-readable report is written to
`artifacts/pathfinding-stress-latest.json`.

The debugging endpoint is only needed for automation and should remain bound
to `127.0.0.1`. Normal test launches do not expose it.
