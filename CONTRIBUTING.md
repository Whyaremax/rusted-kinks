# Contributing

Contributions must contain only code and fixtures that the contributor has the
right to redistribute. Do not commit Kinky Dungeon source, source maps, assets,
compiled bundles, saves, logs containing personal paths, or third-party mod
source without permission.

Every migrated system needs:

- an explicit JavaScript fallback;
- a documented state/command boundary;
- deterministic fixtures;
- compatibility tests for replacement and event-hook mods;
- a benchmark against the official JavaScript path; and
- an entry in `docs/COMPATIBILITY.md`.

Run `npm run check` and `npm run build` before opening a pull request.
