# Rusted Kinks (KD Hybrid)

Rusted Kinks started as a toilet thought: Kinky Dungeon is fun, but some of its
JavaScript hot paths work much harder than they need to.

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
testing, and remote-play pipelines are alive; pathfinding is the first
optimization enabled on `main`.

What exists today:

- a deterministic Rust core compiled to WebAssembly;
- a binary protocol, snapshots, spatial indexing, and three pathfinding modes;
- a signature-gated bootstrap that only activates on recognized game builds;
- reversible TypeScript, PowerShell, and native C++/Qt patchers;
- an isolated developer installation that does not share the normal save
  directory;
- compatibility fallbacks for calls the native path cannot safely handle; and
- stress tests against the real KD Electron build;
- a private remote-browser test server with tokenized access and a
  download-once asset cache; and
- a capability-gated WASM plugin host ready for the mod SDK to grow into.

In a focused KD 5.4.92 benchmark, the pathfinding adapter ran the tested path
1.824x as fast as the original function and returned the same result. That
number covers the pathfinder. Broader turn and frame gains will grow as more
hot paths earn a place on `main`. The numbers and reproduction command are in
[docs/PERFORMANCE.md](docs/PERFORMANCE.md).

Movement, broader AI, combat, statuses, map generation, and asset handling come
later, one measured slice at a time.

## Installing a release

Want the shortest route? Check
[Releases](https://github.com/Whyaremax/rusted-kinks/releases). If there is a
manager or setup archive:

1. Download the latest setup archive or manager.
2. Close Kinky Dungeon.
3. Run the manager and point it at the KD game folder (or `resources/app`).
4. Install the bootstrap and launch the game normally.

Voilà. The manager checks the game build, backs up the file it changes, and can
remove the patch later. It does not include Kinky Dungeon itself or take over
ordinary mod management.

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
`wasm-pack --version` already works.

Here is what the useful commands make:

| Command | Result |
| --- | --- |
| `npm run check` | TypeScript tests, Rust tests, and type checking |
| `npm run build` | The Rust/WASM core and JavaScript bootstrap under `dist/` |
| `npm run package` | A portable bootstrap ZIP at `artifacts/kd-hybrid.zip` |
| `npm run redistribute` | An unpacked patcher kit, setup ZIP, and checksums under `redistribution/releases/` |

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
original file back.

If you only want the portable bootstrap payload for development, run
`npm run package`; it writes `artifacts/kd-hybrid.zip`.

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

No. Bring your own copy from the official game page. Rusted Kinks only ships
the performance layer, patcher, tests, and their source.

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

It depends on where a particular run spends its time. Today, `main` has a
measured pathfinding win. Crowded turns, frame time, startup, and memory are the
next places to collect gains. Each fast path is compared with the original
function, and slower ideas get left in the lab.

### Can I test it from another computer or phone?

Yes. The isolated test copy has a tokenized browser server and a persistent
asset cache, so a slow connection pays most of the download cost once. See
[Remote browser testing](docs/REMOTE_TESTING.md) for the launch command and
private-network setup.

### How do I remove it?

Use **Uninstall** in the manager, or run the generated PowerShell patcher with
`-Action Uninstall`. The installer keeps the original `index.html` and records
hashes for everything it adds.

## Roadmap

The short version:

1. keep pathfinding genuinely faster and boringly reliable;
2. migrate movement, AI, combat, buffs, and event batching in useful slices;
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
- [Performance results](docs/PERFORMANCE.md)
- [Local testing](docs/LOCAL_TESTING.md)
- [Remote browser testing](docs/REMOTE_TESTING.md)
- [Save and installation safety](docs/SAFETY.md)

## License and credit

Code adapted from the original Kinky Dungeon source stays under MPL-2.0 and is
marked as such. Original code written for this repository is MIT-licensed.

Kinky Dungeon, its assets, and its original source belong to their respective
authors and contributors. This repository is an independent community
performance/modding project and does not bundle the game.

See [NOTICE.md](NOTICE.md), [LICENSE](LICENSE), and
[LICENSES/MPL-2.0.txt](LICENSES/MPL-2.0.txt) for the exact split.
