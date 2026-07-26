# Diagnostics and privacy

Diagnostics are generated only on an explicit user action and remain local.
The exporter removes save content, player names, absolute paths, URLs, tokens,
cookies, asset contents, and mod source. Mod entries contain only an optional
display name, version, capability summary, and a one-way identifier.

The UI must show the exact scrubbed JSON before offering to copy it or open a
pre-filled GitHub issue. KD Hybrid performs no telemetry and no automatic
uploads.
