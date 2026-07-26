# Save and installation safety

KD Hybrid has no reason to access the KD save directory. Runtime state enters
through adapter-owned in-memory snapshots. Build, unit test, packaging, patcher
test, and benchmark commands use only repository fixtures.

The patcher is constrained to a user-selected `resources/app` tree. It rejects:

- a target without `index.html` and `out/main.js`;
- path traversal or absolute paths in payload entries;
- an unknown bundle unless the user explicitly chooses normal-mod-only mode;
- a second install whose manifest does not match the current files; and
- uninstall when a patched file was modified after installation.

All writes use a temporary sibling followed by an atomic rename. The original
`index.html` and hashes of every installed file are recorded before activation.
Uninstall restores the byte-identical original and removes only files listed in
the installation manifest.

## Save-safety verification

`scripts/verify-save-safety.mjs` snapshots file names, sizes, modification
times, and SHA-256 hashes for an explicitly supplied save directory, runs the
project checks, then proves the snapshot is unchanged. It never prints file
contents.

Example:

```powershell
node scripts/verify-save-safety.mjs --save-dir "$env:APPDATA\Kinky Dungeon"
```

Close the game before patch installation or removal. A normal mod ZIP never
changes game files and is the preferred first test.
