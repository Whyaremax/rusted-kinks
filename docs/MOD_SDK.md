# Mod SDK

KD Hybrid keeps ordinary Kinky Dungeon JavaScript mods as the primary
extension model. The SDK adds an optional, versioned boundary for mods that
want to observe optimized systems or host a small WebAssembly component.

The current SDK is alpha. JavaScript hooks and pure WebAssembly plugins are
working and covered by the local compatibility suite. Automatic event routing,
state handles, action proposals, path queries, and a public plugin packager are
still roadmap work.

## JavaScript API

After KD Hybrid initializes, `globalThis.KDHybrid` exposes the public API. A
mod should check both its presence and the capability it intends to use:

```js
const hybrid = globalThis.KDHybrid;
if (!hybrid || hybrid.abiVersion !== 1) {
  // Continue as an ordinary JavaScript mod.
  return;
}
```

The current fields and methods are:

| Member | Contract |
| --- | --- |
| `version` | KD Hybrid package version |
| `abiVersion` | Native protocol and plugin ABI; currently `1` |
| `capabilities` | Frozen host feature flags |
| `status()` | Frozen runtime snapshot including all registered facades |
| `systemStatus(system?)` | One system's primary facade status, or every facade when omitted |
| `registerHook(...)` | Adds a guarded `before`, `after`, or `error` hook |
| `unregisterHook(id)` | Removes a hook and returns whether it existed |
| `dispatch(system, ...args)` | Calls the system's primary registered facade |
| `query(bytes)` | Sends a raw ABI-1 binary query to the native bridge |
| `getPathfindingMode()` | Returns `fast`, `quality`, or `human` |
| `setPathfindingMode(mode)` | Changes the planner mode and returns it |
| `enableSystem(system)` | Re-enables facades whose signatures and ownership still match |
| `disableSystem(system, reason?)` | Disables native routing for the whole system |
| `registerWasmPlugin(manifest, bytes)` | Validates and loads a capability-scoped plugin |
| `exportDiagnostics(extra?)` | Returns privacy-scrubbed local diagnostic JSON, including loaded-plugin attribution |

Valid system names are `movement`, `pathfinding`, `ai`, `combat`, `buffs`,
`events`, `mapGeneration`, and `saves`.

`dispatch()` and `query()` are low-level tools. Prefer the game's normal
JavaScript functions unless a mod deliberately targets KD Hybrid's primary
facade or implements the binary protocol. A system can contain several
facades, so `systemStatus("mapGeneration")` is a convenient summary rather
than a complete list; use `systemStatus()` and filter by `system` for detailed
diagnostics.

## Audited legacy-mod translation

KD Hybrid does not compile arbitrary `.js` or `.ks` code into WebAssembly.
Legacy scripts still execute through KD's official loader, and their callbacks,
RNG calls, UI work, and gameplay writes remain JavaScript-authoritative.

The bootstrap can instead prove that an archive does not invalidate selected
source fast paths. Exact reviewed hashes retain their audited profiles. Other
archives are read through KD's own ZIP model and every `.js`/`.ks` entry is
parsed without being evaluated. The analyzer recognizes calls from a reviewed
API-effect table plus the exact build's KD global-function snapshot, tracks
standard event-table registrations, and verifies the exact ZIP-entry list
after KD's loader finishes:

- read-only and UI calls need no native state;
- `KDRandom` remains in JavaScript so RNG consumption and order stay exact;
- `KinkyDungeonMapSet` and related grid writes change `KDMapData.Grid`, which
  the native path adapter observes before reusing a snapshot;
- effect-tile, entity, and buff writes remain in JavaScript and are recaptured
  at the next relevant native boundary; and
- event dispatch and registered callbacks continue through KD's JavaScript
  event tables.

This proof is used by the reversible early/source-patched installation. The
portable normal-mod ZIP does not alter KD's source bundle, so it has no source
guard to unlock and continues using its ordinary runtime adapter gates.

For a compatible set, only the broad "a mod is loaded" source guard is
translated during one official `KinkyDungeonCreateMap` transaction. The real
`KDModsLoaded` and `KDAllModFiles` bindings are restored in `finally`; mod
registries, handlers, assets, and scripts are never removed or rewritten.

Content inspection fails closed for a source-fast-path replacement, built-in
or prototype mutation, dynamic global write, `eval`/`Function`-style dynamic
code, unknown KD call, parse failure, unsafe path, or duplicate entry. This is
a compatibility proof, not a sandbox: accepted scripts still run as ordinary
JavaScript in the official loader. The exact-build API snapshot is captured
synchronously before the first selected mod can execute, so one mod cannot
teach the analyzer a new API for a later archive.

The current audited profiles are:

| Archive | Version | SHA-256 |
| --- | --- | --- |
| Useful Tooltips | 1.33 | `d529b818ce537c5989190957b3f97e2965c231186f65a67fc7afaab0b3136cfe` |
| Prisoner Revaluation | 1.14 | `43218198e3920546ab1bdb822f0aedc43560852a3fae22d5b0bcd34fc063c16d` |
| Breach Explosives | supplied as 1.04; manifest says 1.03 | `7f725792050d4f7457dbe2445abf3df2347c89ed61420b1b11a2d76052b42354` |

Renaming an otherwise byte-identical ZIP is harmless. Repacking, editing, or
updating it loses the exact profile but can still earn a `content-inspected`
profile if every executable entry passes the policy. Asset-only archives are
accepted without decompressing their assets. Inspection is bounded to 64
archives, 128 MiB per archive, 512 MiB total, 8,192 entries per archive,
32,768 entries total, 256 executable files per archive, 1,024 executable files
total, 4 MiB per executable, and 64 MiB of executable source total.

Duplicate archives, unexpected loaded entries, failed digests, malformed ZIPs,
and invalid or oversized input fail closed without blocking KD's loader. If
any archive in a selected set is unsafe, the whole set keeps normal JavaScript
fallback; it does not receive a partial source-fast-path proof.

`KDHybridRuntimeControl.disableTranslatedModSourceOptimizations = true` is the
isolated-test A/B switch. It is a developer control, not a stable mod API.

## Hooks

```js
const hookId = KDHybrid.registerHook(
  "pathfinding",
  "after",
  (context) => {
    console.debug(context.globalName, context.result);
  },
  { id: "my-mod.path-observer", priority: 0 },
);

// On unload:
KDHybrid.unregisterHook(hookId);
```

Hook ordering is deterministic: higher priority runs first, then hook ID in
lexical order. IDs must be unique across the runtime.

The context contains:

- `system` and the exact `globalName`;
- a mutable copy of `args`;
- `result` after a completed call;
- `error` for an error-phase hook; and
- `cancelled`.

A `before` hook may edit `args`. An `after` hook may replace `result`. Setting
`cancelled = true` in a `before` hook means "use KD's captured JavaScript
fallback for this call"; it does not skip the gameplay action.

Hooks surround native-routed calls. Calls already in disabled or JavaScript
fallback mode go directly through that path and do not emit SDK hooks. Adding
any hook to a system also turns off its direct-official batching shortcut until
the hook is removed, so observe only the systems you need and unregister on
unload. A hook should not throw: an exception is treated as a native-route
failure and can move the affected facade to JavaScript fallback.

The complete read-only example is
[`examples/mod-sdk/javascript-hooks.js`](../examples/mod-sdk/javascript-hooks.js).
Load it after KD Hybrid, call `KDHybridHookExample.install()`, inspect
`KDHybridHookExample.status()`, and call `.dispose()` when the mod unloads.

## WebAssembly plugin manifest

```json
{
  "id": "my-author.my-plugin",
  "name": "My plugin",
  "version": "1.0.0",
  "abi": 1,
  "capabilities": [],
  "systems": ["events"],
  "maxMemoryPages": 64
}
```

The host enforces these rules before instantiation:

- `id` is 2-64 lowercase letters, digits, dots, underscores, or hyphens and
  starts with a letter or digit;
- `name` is 1-128 characters and `version` is 1-64 characters;
- `abi` equals `KDHybrid.abiVersion`;
- capabilities and systems contain no duplicates or unknown values;
- `maxMemoryPages` is 1-1024 WebAssembly pages;
- the module is at most 32 MiB; and
- one invocation payload or response is at most 8 MiB.

The allowed capability names are:

- `read-state`;
- `propose-actions`;
- `receive-events`;
- `path-query`;
- `diagnostics`; and
- `deterministic-random`.

In 0.1.1, capability callbacks are not wired into the public KD runtime yet.
The host rejects a module that imports an unavailable callback instead of
silently returning fake data. `receive-events` and `path-query` are reserved
manifest declarations and do not automatically subscribe or route calls.
Plugins with no host-function imports work now and are the supported example
boundary.

Loaded WebAssembly plugins are included in `exportDiagnostics()` without
exposing their raw IDs or display names. Each entry contains a stable hashed
identity plus its kind, version, declared capabilities, and systems. Disposed
plugins disappear from later exports. This makes compatibility reports useful
without turning a private mod list into public issue content.

## WebAssembly ABI 1

A plugin must import exactly one memory:

```text
env.memory
```

It must export that same memory and these functions:

```text
kd_plugin_abi() -> i32
kd_plugin_alloc(length: i32) -> i32
kd_plugin_dealloc(pointer: i32, length: i32)
kd_plugin_invoke(pointer: i32, length: i32) -> i64
```

It may also export:

```text
kd_plugin_dispose()
```

`kd_plugin_abi()` must return `1`. The host allocates and initializes the input
through `kd_plugin_alloc`, invokes the plugin, then releases the input through
`kd_plugin_dealloc`.

`kd_plugin_invoke` returns a packed unsigned value:

```text
(output_pointer << 32) | output_length
```

The output must be a separate live allocation in the imported memory. The host
copies it immediately, then returns it through `kd_plugin_dealloc`. Pointer and
length ranges are checked before every host-side read or write. The host owns
the memory object and enforces the manifest maximum; WASI, filesystem, network,
DOM, Pixi, Electron, and separate writable core memory imports are rejected.

The only recognized optional function imports are:

| Import | Required capability |
| --- | --- |
| `kd_host.read_state` | `read-state` |
| `kd_host.propose_action` | `propose-actions` |
| `kd_host.emit_diagnostic` | `diagnostics` |
| `kd_host.deterministic_random` | `deterministic-random` |

An import is accepted only when the manifest declares its capability and the
current host supplied the corresponding callback.

## Rust example and compatibility suite

[`examples/mod-sdk/rust-echo`](../examples/mod-sdk/rust-echo) is a
dependency-free Rust `cdylib`. It imports and re-exports host-owned memory,
implements every required ABI-1 export, and reverses the input bytes so the
test can verify a real round trip.

Run the complete SDK gate from the repository root:

```powershell
npm run test:mod-sdk
```

The runner locates Cargo, builds the example for `wasm32-unknown-unknown`, then
uses the real TypeScript plugin host to validate the manifest, instantiate the
module, invoke it, copy its response, dispose it, and confirm that later calls
are refused. It also verifies privacy-hashed attribution while the plugin is
active. A feature-built variant imports `kd_host.emit_diagnostic`; the gate
proves that an unavailable callback is rejected and that an explicitly
supplied callback receives the invocation. The same gate executes the
JavaScript hook example against a mocked public host and verifies clean
removal.

Build output remains under the example's ignored `target/` directory. It is a
developer fixture, not part of the frozen patcher or release ZIP.
