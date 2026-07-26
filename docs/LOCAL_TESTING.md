# Isolated local test installation

The Windows test harness creates a minimal copy of the installed game next to
the live game directory. For the default workspace layout:

```text
Live game:  H:\...\kinkydungen
Test game:  H:\...\kinkydungen-kd-hybrid-test
Test saves: H:\...\kinkydungen-kd-hybrid-test\user-data
```

The setup copies only the Electron runtime, `locales`, and `resources`. It does
not copy the live `Mods` directory, exported saves, update archives, development
tools, backups, or the KD Hybrid repository.

Create or refresh the installation:

```powershell
npm run test:local:setup
```

Inspect it without launching Electron:

```powershell
npm run test:local:status
```

Launch the isolated copy:

```powershell
npm run test:local:launch
```

Launch it with the loopback debugger used by the automated stress harness:

```powershell
npm run test:local:launch:debug
npm run test:local:pathfinding
```

The copied `resources/app/electron.js` is test-only and calls
`app.setPath("userData", ...)` before Electron becomes ready. The launcher also
passes `--user-data-dir` as a second isolation layer. Consequently, launching
the test executable directly still uses the test tree's `user-data` directory
instead of `%APPDATA%\Kinky Dungeon`.

Setup installs the signature-gated early bootstrap into the copied
`resources/app` directory. The patcher must recognize game version 5.4.92,
Electron package version 5.1.12, and the exact `out/main.js` hash. Unknown or
modified bundles are refused.

The isolated copy also loads `index.html?test=kd-hybrid`. This activates KD
5.4.92's built-in developer mode and opens detached renderer DevTools. It is
never applied to the live installation. On the in-game Restart screen, the
developer panel provides enemy/item spawning, bind/defeat targeting, keys,
vision, floor, stairs, parole, inventory, and restraint controls.

The renderer console also exposes KD's own test functions:

```javascript
KDTestMapGen(10, [0], ["grv"])
KDTestFullRunthrough(1, false, false)
KDTestjailer(10)
```

`KDTestMapGen` repeatedly generates maps. `KDTestFullRunthrough` advances
through floors and validates enemy/checkpoint state; start a disposable test
run before using it. `KDTestjailer` samples jail-guard spawning. These functions
mutate the current isolated session, so they must not be run in a normal save.
See [DEVELOPER_HARNESS.md](DEVELOPER_HARNESS.md) for the complete map-generation,
natural capture, prison escort, and native-adapter counter smoke route.

For a test copy created before developer mode was added, enable it without
recopying the game:

```powershell
npm run test:local:developer
```

Optional overrides are available when invoking the PowerShell script directly:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File scripts/local-test-install.ps1 `
  -Action Setup `
  -GameRoot "D:\Games\KinkyDungeon" `
  -TestRoot "D:\KD-Hybrid-Test"
```

The test root must be outside the live game tree. Existing nonempty directories
without a KD Hybrid test-install marker are refused.
