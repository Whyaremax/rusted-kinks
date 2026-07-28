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

All writes use a temporary sibling followed by an atomic rename. Before
activation, the patcher stores the original `index.html` and, when the
source-level optimization applies, the original `out/main.js`. Their paths,
sizes, and SHA-256 hashes are recorded in the installation manifest. The bundle
transformation is allowed only for the exact known input hash and must produce
the exact known output hash.

Uninstall first verifies the current installed files and both backups. It then
restores the byte-identical originals and removes only files listed in the
manifest. The Node/PowerShell patcher and native C++ manager use the same
manifest schema and can safely inspect or uninstall each other's installation.

## Save-safety verification

`scripts/verify-save-safety.mjs` snapshots file names, sizes, modification
times, and SHA-256 hashes for the selected save directory, runs the project
checks, then proves the snapshot is unchanged. It never prints file contents.
On Windows it defaults to `$env:APPDATA\Kinky Dungeon`; `--save-dir` or
`KD_SAVE_DIR` can select another profile.

Example:

```powershell
npm run verify:safety -- --save-dir "$env:APPDATA\Kinky Dungeon"
```

For the normal Windows profile, `npm run verify:safety` is enough.

Close the game before patch installation or removal. Ordinary mods remain
outside the patcher's scope.
