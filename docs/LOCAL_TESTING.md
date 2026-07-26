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

The copied `resources/app/electron.js` is test-only and calls
`app.setPath("userData", ...)` before Electron becomes ready. The launcher also
passes `--user-data-dir` as a second isolation layer. Consequently, launching
the test executable directly still uses the test tree's `user-data` directory
instead of `%APPDATA%\Kinky Dungeon`.

Setup installs the signature-gated early bootstrap into the copied
`resources/app` directory. The patcher must recognize game version 5.4.92,
Electron package version 5.1.12, and the exact `out/main.js` hash. Unknown or
modified bundles are refused.

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
