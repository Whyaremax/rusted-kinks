# pixi-filters 5.2.0 compatibility patch

This directory contains the MIT-covered compatibility delta applied to the
`Scripts/lib/pixi-filters.js` file shipped by the supported KD builds.

- clean file SHA-256:
  `23aa3d8d53e0755bf39bf6d7d2b409788b502a46f35cde53564ed7230af7a507`
- patched file SHA-256:
  `4cfc4145e5950a17df19642fcc6cc378b2b3abef4276e7f56e39628739ae6b95`
- patch: `compatibility-v1.patch`

The patch replaces removed Pixi utility and filter-resolution APIs with their
Pixi 7 equivalents. It preserves the upstream banner and is installed only
when the exact input bytes match. See
`LICENSES/PIXI-FILTERS-MIT.txt` for the upstream license.
