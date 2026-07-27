# Rusted Kinks (KD Hybrid)

Rusted Kinks started as a toilet thought: Kinky Dungeon is fun, but some of its
JavaScript hot paths could be a whole lot faster.

The plan is to move the expensive parts into Rust/WebAssembly while keeping the
Electron/Pixi interface, original JavaScript behavior, and modding scene intact.
Keep the original kink; just make it run better. If Doom can run on a pregnancy
test, KD can have a Rust fast path.

This is a hybrid project, not an attempt to throw the whole game away and
rewrite everything overnight. The fast path handles work it understands. The
original JavaScript takes over whenever the game updates, a mod replaces a
function, or a call is outside the native adapter's comfort zone.

## Where it is now

This is still an early alpha. Most of it is a work in progress, so do not expect
a life-changing FPS boost just yet.

What exists today:

- a deterministic Rust core compiled to WebAssembly;
- a binary protocol, snapshots, spatial indexing, and three pathfinding modes;
- a signature-gated bootstrap that only activates on recognized game builds;
- reversible TypeScript, PowerShell, and native C++/Qt patchers;
- an isolated developer installation that does not share the normal save
  directory;
- compatibility fallbacks for calls the native path cannot safely handle; and
- stress tests against the real KD Electron build.

The current `main` branch only switches on the pathfinding adapter. In a focused
KD 5.4.92 benchmark, it ran the tested path 1.824x as fast as the original
function with the same result. That is a pathfinding result, not a promise that
the whole game is suddenly 1.824x faster. The numbers and reproduction command
are in [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

Movement, broader AI, combat, statuses, map generation, and asset handling come
later, one measured slice at a time.

## Installing a release

If the [Releases](https://github.com/Whyaremax/rusted-kinks/releases) page has a
manager or setup archive, that is the easy route:

1. Download the latest setup archive or manager.
2. Close Kinky Dungeon.
3. Run the manager and point it at the KD game folder (or `resources/app`).
4. Install the bootstrap and launch the game normally.

Voilà. The manager checks the game build, backs up the file it changes, and can
remove the patch later. It does not include Kinky Dungeon itself or manage
ordinary mods.

If Releases is empty or behind the source, build the installer kit yourself:

## Building and installing from source

You need:

- Git;
- Node.js 22 or newer and npm 10 or newer;
- Rust 1.88 or newer;
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

The build creates a setup ZIP and an unpacked kit under
`redistribution/releases/`. To install from the unpacked kit:

```powershell
$patcher = Get-ChildItem .\redistribution\releases `
  -Filter KDHybrid-Patcher.ps1 -Recurse |
  Select-Object -First 1

& $patcher.FullName -Action Install
```

The patcher asks for the game path, checks the installed KD signature, and
installs the bootstrap. Pass `-Action Status` to check it or `-Action Uninstall`
to put the original file back.

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

The Rust/WASM and JavaScript parts build on Windows and Linux. Ready-made Linux
manager packages are still on the roadmap, so Linux installation is currently
for people comfortable building the Qt manager from source.

## Quick answers

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

Right now, the honest answer is “it depends on how much time your game spends
pathfinding.” The project measures each migrated system against the original
function and keeps it only when it is both compatible and faster. Broader turn,
frame-time, startup, and memory improvements are roadmap work.

### How do I remove it?

Use **Uninstall** in the manager, or run the generated PowerShell patcher with
`-Action Uninstall`. The installer keeps the original `index.html` and records
hashes for everything it adds.

## Roadmap

The short version:

1. keep pathfinding genuinely faster and boringly reliable;
2. migrate movement, AI, combat, buffs, and event batching in useful slices;
3. improve map generation and asset loading;
4. make the mod SDK pleasant enough that other people can extend the native
   side without forking everything; and
5. ship a stable manager and release package that people can undo just as
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
- [Save and installation safety](docs/SAFETY.md)

## License and credit

Code adapted from the original Kinky Dungeon source stays under MPL-2.0 and is
marked as such. Original code written for this repository is MIT-licensed.

Kinky Dungeon, its assets, and its original source belong to their respective
authors and contributors. This repository is an independent community
performance/modding project and does not bundle the game.

See [NOTICE.md](NOTICE.md), [LICENSE](LICENSE), and
[LICENSES/MPL-2.0.txt](LICENSES/MPL-2.0.txt) for the exact split.
