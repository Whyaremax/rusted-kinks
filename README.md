# Rusted Kinks (KD Hybrid)

Rusted Kinks, rewrite of Kinky Dungeon by Ada in, well rust. I thought of this when I’m in middle of businesses.

The idea is simple: move expensive, repeatable work into Rust/WebAssembly while
keeping the Electron/Pixi interface, original JavaScript behavior, and modding
scene intact. Keep the original kink; just make it run better. If Doom can run
on a pregnancy test, KD can have a Rust fast path.

It stays hybrid on purpose. The fast path handles work it understands, and the
original JavaScript takes over when a mod replaces a function, KD updates, or a
call does not fit the native adapter. That keeps normal JavaScript mods useful
while letting the expensive parts move somewhere faster.

## Where it is now

This is early alpha, but it is not vaporware. The build, patching, fallback,
testing, and remote-play pipelines are alive. The current source includes the
accepted pathfinding, crowded-turn, map-generation, texture, and compatibility
work described below.

What exists today: (yaps)

- a deterministic Rust core compiled to WebAssembly;
- a binary protocol, snapshots, spatial indexing, and three pathfinding modes;
- dense nearby-enemy, rank-first master, and fused hostile-target lookups for
  crowded turns that keep original game objects in JavaScript;
- a batched enemy-movement position cache that avoids rebuilding the whole
  lookup map after every ordinary move;
- a bounded cell-change journal that patches the dense nearby/master indices
  after those moves instead of rebuilding either index;
- a conservative commander shortcut that skips empty rescue searches;
- a guarded jail-key shortcut that avoids rescanning the whole map when all
  keys are already placed;
- a map-generation boundary that avoids sending thousands of transient grids
  through WASM, plus a guarded enemy-selector scan that keeps KD's exact RNG
  and catalog order;
- a small, hash-gated source patch that removes wrapper overhead from the
  proven nearest-player optimization, short-circuits healthy unbound NPC
  helpless checks, skips repeated empty buff-event scans, and shortens eligible
  restraint tag scans and path-cache suffix writes;
- a signature-gated bootstrap that only activates on recognized game builds;
- reversible TypeScript, PowerShell, and native C++/Qt patchers that back up
  both files they may change;
- an isolated developer installation that does not share the normal save
  directory;
- an exact-build-gated texture policy that selects KD's official mobile atlas
  on the balanced tier, reports decoded texture memory, and preserves full and
  original escape hatches without changing Pixi's loader;
- compatibility fallbacks for calls the native path cannot safely handle; and
- pathfinding stress and paired crowded-turn tests against the real KD Electron
  build;
- a private remote-browser test server with tokenized access and a
  download-once asset cache; and
- a capability-gated WASM plugin host ready for the mod SDK to grow into.

In a focused KD 5.4.92 benchmark, the pathfinding adapter ran the tested path
1.824x as fast as the original function and returned the same result.

The integrated crowded-turn gate reduced the median three-turn fixture from
53.60 ms to 29.20 ms, a 1.846x median paired speedup across 20 pairs. The separate
Maidforce prison-escort fixture measured 63.10 ms versus 36.30 ms and a 1.709x
paired-median speedup, again with exact final state.

The nearest-player slice now also has a direct source form against the exact
public KD 5.4.92 revision. In its focused 20-pair gates it measured 1.058x in
combat, 1.156x in the crowded room, and 1.249x in prison, while preserving
packed/custom/mod fallback behavior. It also beat the equivalent runtime
wrapper in all 20 head-to-head pairs.

The source patch also gives `KDHelpless` a narrow fast negative for healthy,
unbound, unpacked NPCs. On final 20-pair gates it reduced the median by 5.45%
in hostile combat, 2.95% in the crowded room, and 2.10% in prison. Injured,
bound, packed, player, and helper-modified cases keep the original body.

The same source patch now includes an adaptive negative buff-event index. In
the hostile-combat gate it reduced a two-turn median from 31.30 ms to 26.90 ms,
a 1.163x paired-median speedup with all 20 pairs faster and exact final state.
It stayed neutral in the crowded fixture and slightly positive in prison. Mods
using the standard buff API are tracked automatically; direct same-tick writes
can call `KDHybridInvalidateBuffEventIndex()`, and each source optimization has
an independent compatibility switch.

Map generation has its first three measured fixes too. Generation-time path
queries now stay on KD's faster official JavaScript implementation while the
grid is changing. The final packaged enemy-selector adapter reduced a matched
12-map run from 66.56 seconds to 65.88 seconds, with all 12 layouts and
1,749,802 path calls exact. If a mod changes the selector's dependencies, that
call goes straight back to the official function before RNG is consumed.
An earlier source slice reduced an adjacent 12-map restraint-selection run
from 71.99 seconds to 69.01 seconds. Its hot function fell from 7.31 seconds
to 2.52 seconds, while replaced tag tables and Map helpers kept the original
loop. Another slice removes one throwaway array allocation per cached path
point. Its matched 12-map gate fell from 69.87 seconds to 67.81 seconds, with
every layout exact; array subclasses and changed `slice` methods keep KD's
original loop.

The full optimization history, rejected candidates, report hashes, and
reproduction commands are in [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

Deeper movement and AI work, positive buff dispatch, combat arithmetic,
additional world generation, persistent asset caching, and audio handling come
later, one measured slice at a time.

## Installing a release

Want the shortest route? Check
[Releases](https://github.com/Whyaremax/rusted-kinks/releases). If there is a
manager or setup archive:

1. Download the latest setup archive or manager.
2. Close Kinky Dungeon.
3. Run the manager and point it at the KD game folder (or `resources/app`).
4. Install the bootstrap and launch the game normally.

Voilà. The manager checks the exact game bundle, backs up `index.html` and
`out/main.js`, and can restore both later. It does not include Kinky Dungeon
itself or take over ordinary mod management.

If the Releases page is empty or behind the source, build the installer kit
yourself.

## Building and installing from source

You need:

- Git;
- Node.js 22 or newer and npm 10 or newer;
- [rustup](https://rustup.rs/) (the repository selects Rust 1.88);
- the `wasm32-unknown-unknown` Rust target; and
- `wasm-pack`.

On Windows PowerShell:

```powershell
git clone https://github.com/Whyaremax/rusted-kinks.git
cd rusted-kinks

rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
npm ci

npm run check
npm run redistribute
```

`cargo install wasm-pack --locked` is a one-time setup step; skip it if
`wasm-pack --version` already works. If Cargo installs it successfully but the
command is still missing, reopen PowerShell or add
`$env:USERPROFILE\.cargo\bin` to that shell's `PATH`.

Here is what the useful commands make:

| Command | Result |
| --- | --- |
| `npm run check` | TypeScript tests, Rust tests, and type checking |
| `npm run build` | The Rust/WASM core and JavaScript bootstrap under `dist/` |
| `npm run package` | A portable bootstrap ZIP at `artifacts/kd-hybrid.zip` |
| `npm run redistribute` | An unpacked patcher kit, setup ZIP, and checksums under `redistribution/releases/` |
| `npm run verify:textures -- --app-root <resources/app>` | Official full/mobile atlas coverage, geometry, and decoded-byte report |

To install from the unpacked kit:

```powershell
$patcher = Get-ChildItem .\redistribution\releases `
  -Filter KDHybrid-Patcher.ps1 -Recurse |
  Select-Object -First 1

& $patcher.FullName `
  -Action Install `
  -GameRoot "C:\Path\To\Kinky Dungeon"
```

`GameRoot` can be either the folder containing the game executable or its
`resources/app` folder. Leave it out if you would rather have the patcher ask.
Use `-Action Status` to check the installation or `-Action Uninstall` to put the
original files back. The verified source optimization is enabled by default.
Pass `-NoSourceOptimizations` during installation if you only want the early
bootstrap.

If you only want the portable bootstrap payload for development, run
`npm run package`; it writes `artifacts/kd-hybrid.zip`.

The source patcher CLI accepts `--texture-mode auto|original|full|mobile` on
`install` and `configure`. `auto` uses the memory-safe official mobile atlas
for the balanced tier. `original` respects KD's stored toggle; `full` and
`mobile` are explicit overrides. The override is startup-only and does not
rewrite the saved KD setting.

Prefer a GUI? The native manager lives under
[`native/manager`](native/manager) and needs CMake plus Qt 6.2 or newer:

```powershell
npm run build
cmake -S native/manager -B native/manager/build -DBUILD_TESTING=ON
cmake --build native/manager/build --config Release
ctest --test-dir native/manager/build -C Release --output-on-failure
```

The Rust/WASM and JavaScript parts build on Windows and Linux. On
Debian/Ubuntu, the GUI manager can be built with:

```bash
sudo apt install cmake ninja-build qt6-base-dev qt6-base-dev-tools libgl1-mesa-dev
npm ci
npm run build
cmake -S native/manager -B native/manager/build \
  -G Ninja -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON
cmake --build native/manager/build
ctest --test-dir native/manager/build --output-on-failure
```

The executable lands at `native/manager/build/KDHybridManager`. Ready-made
Linux packages will appear on Releases once tagged builds begin.

## Quick answers

### Does this include Kinky Dungeon?

No. Bring your own copy from the official game page. Rusted Kinks ships the
performance layer, patcher, tests, and a small reviewable source diff against
the [public KD source](https://github.com/Ada18980/KinkiestDungeon). It does not
ship the complete upstream source tree, game executable, art, audio, or saves.

### Will normal KD mods still work?

That is one of the main reasons this stays hybrid. Existing mods can keep using
JavaScript. If a mod replaces a function or uses arguments the native adapter
does not support, that call stays on the original JavaScript path.

### Does this touch my saves?

No. The patcher works inside the selected `resources/app` directory; it does
not open Electron's save/profile directory. Development tests use a separate
`user-data` folder too.

### Is this a full native rewrite?

No. Rust/WASM is used where it earns its keep. The UI, renderer, mod-facing
state, and plenty of game logic remain JavaScript unless moving them provides a
measurable benefit without breaking compatibility.

### Why Rust and WebAssembly?

Rust gives the hot code predictable performance and strong memory safety, while
WASM fits directly into Electron and still leaves JavaScript in charge of the
mod-facing boundary. A native C++ manager is used for patching and deployment,
where a normal desktop executable is more convenient.

### Which KD versions are supported?

The currently tested integration targets KD 5.4.92. Support is tied to the
actual game bundle signature, not just whatever the menu says. When KD updates,
the catalog and compatibility tests need an update before the adapter switches
back on.

### What kind of speedup should I expect?

It depends on where a particular run spends its time. The published `main`
branch has a measured pathfinding win, and this development tree also has
measured crowded-turn and map-generation wins. Frame time, startup, and memory
are the next places to collect gains. Each fast path is compared with the
original function, and slower ideas get left in the lab.

### Can I test it from another computer or phone?

Yes. The isolated test copy has a tokenized browser server and a persistent
asset cache, so a slow connection pays most of the download cost once. See
[Remote browser testing](docs/REMOTE_TESTING.md) for the launch command and
private-network setup.

### How do I remove it?

Use **Uninstall** in the manager, or run the generated PowerShell patcher with
`-Action Uninstall`. The installer keeps byte-exact backups of the original
`index.html` and any patched `out/main.js`, then verifies them before restoring
either file.

## Roadmap

The short version:

1. keep pathfinding and crowded-turn lookups genuinely faster and boringly
   reliable;
2. migrate deeper movement, broader AI, combat, buffs, and event batching in
   useful slices;
3. build capture, prison, map-generation, and long-run fixtures;
4. improve startup, asset loading, and remote-play caching;
5. make the mod SDK pleasant enough that other people can extend the native
   side without forking everything; and
6. ship a stable manager and release package that people can undo just as
   easily as they installed it.

The less hand-wavy version is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Contributing and bugs

Found something broken? Open an issue with the KD version, what you were doing,
and any useful logs. If you already know the fix, PRs are cool too.

Useful project notes:

- [Architecture](docs/ARCHITECTURE.md)
- [Compatibility model](docs/COMPATIBILITY.md)
- [Mod SDK and ABI-1 examples](docs/MOD_SDK.md)
- [Pre-stable mod compatibility cleanup](docs/COMPATIBILITY_CLEANUP.md)
- [Performance results](docs/PERFORMANCE.md)
- [Local testing](docs/LOCAL_TESTING.md)
- [Remote browser testing](docs/REMOTE_TESTING.md)
- [Save and installation safety](docs/SAFETY.md)

## License and credit

Files adapted from Kinky Dungeon are marked MPL-2.0 and travel with their
corresponding source. Original code written for this repository is
MIT-licensed.

Kinky Dungeon is by Strait Laced Games LLC and its contributors. Its assets
and upstream source remain under their own terms. This is an independent
community performance/modding project and does not bundle the game.

See [NOTICE.md](NOTICE.md), [LICENSE](LICENSE), and
[LICENSES/MPL-2.0.txt](LICENSES/MPL-2.0.txt) for the exact split.
