# Rusted Kinks (KD Hybrid)

Rusted Kinks started as one of those ideas you get while sitting on the toilet
and thinking about life: Kinky Dungeon is fun, but some of its JavaScript hot
paths could be much faster.

The idea is to move the expensive parts of KD into Rust/WebAssembly while
keeping the Electron/Pixi interface, the original JavaScript behavior, and the
modding scene intact. If Doom can run on a pregnancy test, KD can have a Rust
fast path.

This is a hybrid project, not a plan to throw the whole game away and rewrite
everything overnight. Native code handles work it understands; the original
JavaScript remains available as a fallback for unsupported calls, changed game
versions, and mods that replace a function.

## Where it is now

This is still an early alpha. It is useful, testable, and increasingly fast,
but it is not a magic “double the FPS” button yet.

What exists today:

- a deterministic Rust core compiled to WebAssembly;
- a binary protocol, snapshots, spatial indexing, and pathfinding;
- a signature-gated bootstrap that only activates on recognized game builds;
- reversible TypeScript, PowerShell, and native C++/Qt patchers;
- an isolated developer installation that does not share the normal save
  directory;
- compatibility fallbacks for calls the native path cannot safely handle; and
- stress tests against the real KD Electron build.

Pathfinding is the first live optimization target. Movement, AI, combat,
statuses, map generation, and asset handling are planned in later slices rather
than being claimed as finished already.

## Installing a release

The easy route is:

1. Download the latest setup archive or manager from
   [Releases](https://github.com/Whyaremax/rusted-kinks/releases).
2. Close Kinky Dungeon.
3. Run the manager and point it at the KD game folder (or `resources/app`).
4. Install the bootstrap and launch the game normally.

Voilà. The manager verifies the game build, backs up the file it changes, and
can uninstall the patch later. It does not include Kinky Dungeon itself, and it
does not install ordinary mods.

There may not be a polished release for every development snapshot. If the
Releases page is empty or older than the source, use the source instructions
below.

## Building and installing from source

You need:

- Node.js 22 or newer and npm 10 or newer;
- Rust 1.88 or newer;
- the `wasm32-unknown-unknown` Rust target; and
- `wasm-pack`.

On Windows PowerShell:

```powershell
git clone https://github.com/Whyaremax/rusted-kinks.git
cd rusted-kinks

rustup target add wasm32-unknown-unknown
cargo install wasm-pack
npm install

npm run check
npm run build
npm run package
```

The packaged bootstrap is written to `artifacts/kd-hybrid.zip`.

To build the transparent PowerShell installer kit:

```powershell
npm run redistribute
```

The result is placed under `redistribution/releases/`. Extract the generated
setup ZIP and run `KDHybrid-Patcher.ps1`. The patcher asks for the game path,
checks the installed KD signature, and refuses unknown builds instead of
blindly editing them.

The native graphical manager is under [`native/manager`](native/manager). It
requires CMake and Qt 6.2 or newer:

```powershell
cmake -S native/manager -B native/manager/build -DBUILD_TESTING=ON
cmake --build native/manager/build --config Release
ctest --test-dir native/manager/build -C Release --output-on-failure
```

## Quick answers

### Will normal KD mods still work?

That is one of the main reasons this stays hybrid. Existing mods can keep using
JavaScript. If a mod replaces a function or uses arguments the native adapter
does not support, that call stays on the original JavaScript path.

### Does this touch my saves?

The patcher works inside the selected `resources/app` directory and has no
reason to edit Electron's save/profile directory. Development tests use a
separate `user-data` folder. Back up saves anyway when testing any game mod;
that is simply a good habit.

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

Support is signature-based, not a hopeful version-string guess. The currently
tested integration targets KD 5.4.92. A new upstream build needs a matching
catalog entry and compatibility tests before its native adapters turn on.

## Roadmap

The short version:

1. make pathfinding genuinely faster and boringly reliable;
2. migrate movement, AI, combat, buffs, and event batching in useful slices;
3. improve map generation and asset loading;
4. make the mod SDK pleasant enough that other people can extend the native
   side without forking everything; and
5. ship a stable manager and release package that people can undo just as
   easily as they installed it.

The less hand-wavy version is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Contributing and bugs

Found something broken? Open an issue with the KD version, what you were doing,
and any useful logs. If you already know the fix, pull requests are welcome
too.

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
