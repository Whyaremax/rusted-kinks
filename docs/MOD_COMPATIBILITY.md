# Mod compatibility preflight

KD Hybrid keeps Kinky Dungeon's official mod loader and evaluates mod files in
the same order as KD. Before that evaluation begins, the KD 5.4.92 integration
performs a bounded, read-only scan of each selected ZIP so an older mod cannot
silently invalidate an optimized subsystem.

The preflight reads archive names and bounded `.js` or `.ks` source text as
data. It computes a SHA-256 digest, checks conservative static rules, and does
not evaluate source while scanning. Unknown archive state, identity drift,
resource-limit failures, and loader-hook failures stop evaluation.

## Choices

For a high-confidence conflict, the dialog offers:

- **Compatibility mode (recommended):** load the mod while routing only the
  affected subsystem through KD's official JavaScript.
- **Keep optimizations:** load the mod without that fallback. This is an
  explicit unstable choice.
- **Disable this mod:** keep the archive installed and remembered by KD, but
  exclude it from this activation.

Closing the dialog, presentation failure, or a headless activation selects the
safe compatibility policy. Decisions are stored outside KD saves and are
scoped to the mod digest, KD version, upstream bundle hash, KD Hybrid version,
and scanner-rule version. A changed archive or game build therefore requires a
new decision.

The standard **KD Hybrid** mod settings include **Manage mod compatibility
choices**. The manager distinguishes a remembered policy from what actually
ran in the current activation and supports Change, per-mod Forget, and the
explicit Forget-all action.

## Source-sensitive mods

The exact-build source optimizations are installed before any mod executes, so
they cannot be removed safely in the middle of a running page. If
Compatibility mode is selected for a source-sensitive mod while optimized
source is active, mod evaluation pauses before every archive and shows an
actionable restart notice.

Close KD, then select the official source bundle with the unpacked setup kit:

```powershell
.\KDHybrid-Patcher.ps1 `
  -Action Configure `
  -GameRoot "C:\Path\To\Kinky Dungeon" `
  -SourceMode original
```

Fully restart KD afterward. Reapply the verified source optimizations later
with `-SourceMode optimized`.

The separately generated original-source manual ZIP omits `out/main.js`.
Applying that ZIP to a clean KD 5.4.92 install preserves the official source.
It cannot remove an optimized `out/main.js` that was copied previously; use
the patcher or restore the official file first.

## State and loader safety

- The preflight acquires KD's normal loading lock synchronously, before its
  first asynchronous scan or dialog.
- Concurrent and re-entrant `KDExecuteMods()` calls retain KD's no-op
  semantics; they cannot share or deadlock the active evaluation.
- When no mod is disabled, KD's registry and load-order objects are never
  replaced.
- When a mod is disabled, filtering is activation-local. The disabled archive,
  KD's persisted mod list, registry order, and enabled-mod mutations are
  restored after official evaluation.
- Runtime compatibility controls remain installed until an official mod load
  already in progress has drained, including delayed ZIP and FileReader work.
- Compatibility storage never reads or writes a KD save or profile name.

Static analysis is intentionally conservative. Dynamically constructed access
can require Compatibility mode even when a mod would happen to work with an
optimization. Use Keep optimizations only after testing that exact mod digest
and game build.
