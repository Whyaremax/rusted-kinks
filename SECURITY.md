# Security policy

Please report vulnerabilities privately to the project maintainers rather than
including exploit details in a public issue.

The optional WASM plugin host is capability-based. Plugins receive no WASI,
filesystem, network, DOM, Pixi, Electron, or raw core-memory access. Treat any
escape from those constraints, path traversal in the patcher, silent save
access, or unsigned modification of game files as a security issue.
