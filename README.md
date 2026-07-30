# Rusted Kinks (KD Hybrid)

Rusted Kinks, rewrite of Kinky Dungeon by Ada in, well rust. I thought of this when I’m in middle of businesses.

## Where it is now

This is early alpha, but it is not scam. The build, patching, fallback,
and testing pipelines are alive. The current source includes the accepted
pathfinding, crowded-turn, map-generation, texture, and compatibility work
described below.

## Installing a release

Want the shortest route? Check
[Releases](https://github.com/Whyaremax/rusted-kinks/releases). If there is a
manager or setup archive:

1. Download the latest setup archive or manager.
2. Close Kinky Dungeon.
3. Run the manager and point it at the KD game folder (or `resources/app`).
4. Install the bootstrap and launch the game normally.

Voilà. The manager checks the exact game bundle, backs up `index.html` and
`out/main.js`, installs its own small `Mods/KDHybridBridge.zip` control mod, and
can restore all three later. It does not include Kinky Dungeon or manage any
other mod.

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

For a command-free manual override, run `npm run package:override` with a clean
KD 5.4.92 installation. The ZIP directly contains patched
`resources/app/index.html`, patched `resources/app/out/main.js`, and
`resources/app/kd-hybrid/...`, plus `Mods/KDHybridBridge.zip`; users can merge
its `resources` and `Mods` folders over an ordinary unmodified install. The ZIP
deliberately contains no clean backup or `RESTORE` tree.

The control ZIP is a normal KD mod. KD discovers it through its existing mod
loader and renders its pathfinding, texture, and frame-pacing options through
the standard mod configuration screen. Its script can call only the small
`KDHybridModBridge` settings API exposed by the early bootstrap; it does not
replace KD's mod menu. Texture changes take effect after restarting the game.

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

### Does this touch my saves?

No. The patcher changes its verified files under `resources/app` and owns one
exact `Mods/KDHybridBridge.zip` file beside the game. It does not open
Electron's save/profile directory. Development tests use a separate
`user-data` folder too.

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

### How do I remove it?

Use **Uninstall** in the manager, or run the generated PowerShell patcher with
`-Action Uninstall`. The installer keeps byte-exact backups of the original
`index.html` and any patched `out/main.js`, then verifies them before restoring
either file. It also verifies and removes its own control-mod ZIP. A changed or
replaced bridge ZIP is refused rather than deleted.


## Contributing and bugs

Found something broken? Open an issue with the KD version, what you were doing,
and any useful logs. If you already know the fix, PRs are cool too.

Useful project notes:

- [Architecture](docs/ARCHITECTURE.md)
- [Mod SDK and ABI-1 examples](docs/MOD_SDK.md)
- [Performance results](docs/PERFORMANCE.md)
- [Roadmap](docs/ROADMAP.md)
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
