# Pre-stable mod compatibility cleanup

This is a required final compatibility pass before Rusted Kinks is called
stable or the repository is made public again. It describes intended behavior,
not functionality already present in the alpha.

The rule is simple: preserve the user's mod whenever the affected optimization
can fall back to official JavaScript. Never silently trade correctness for
speed, never delete a mod, and never pretend a heuristic source scan can detect
every possible JavaScript mutation.

## The user-facing decision

Mod inspection must happen before the mod executes. When a high-confidence
risk is found, show the mod name, affected subsystem, plain-language reason,
and these choices:

1. **Compatibility mode (recommended)** — load the mod and disable only the
   affected optimization. Use KD's original JavaScript for that subsystem.
2. **Keep optimizations** — load the mod anyway and accept possible instability
   or changed behavior.
3. **Disable this mod** — exclude it without deleting or altering its archive.

The dialog has an optional **Remember this choice** control. A remembered
decision is keyed by the mod's content digest, KD version and bundle digest,
Rusted Kinks version, and compatibility-rule version. Changing any of those
invalidates the decision and asks again.

The mod-options page must list remembered decisions and provide per-mod
**Change** and **Forget** actions. It must also have a friendly global button:
**Regret it? Forget all remembered compatibility choices.** Forgetting a choice
does not enable, disable, install, or delete a mod immediately; it makes the
manager ask again at the next safe activation point.

Decisions belong in Rusted Kinks configuration, never in the KD save. If
several mods affect one subsystem, the safest selected policy wins for that
session. Headless operation defaults to compatibility mode, not force-load.

## Buff writes

The current source optimization indexes buff-event trigger names so repeated
events with no possible handler do not rescan every entity.

Already safe:

- `KinkyDungeonApplyBuffToEntity` and `KDApplyBuff` update the index
  automatically.
- `KDHybridInvalidateBuffEventIndex()` forces an immediate safe rebuild.
- A new tick and the existing structural guards rebuild conservatively.

JavaScript cannot reliably observe every direct write to a plain `.buffs`
object without replacing objects with proxies, changing identity, or rescanning
all buffs at the same point the optimization is trying to avoid. Dynamic
`eval`, retained aliases, and code generated after preflight make perfect
detection impossible.

The cleanup implementation therefore needs layered behavior:

- statically flag high-confidence direct mutations such as assignments through
  `.buffs`, `delete` operations, `Object.assign`, or property-definition calls;
- automatically invalidate or refresh the index when a supported mutation
  boundary can be observed without rewriting arbitrary mod semantics;
- recognize an explicit mod manifest declaration or a call to
  `KDHybridInvalidateBuffEventIndex()` as compatibility-aware behavior;
- when a direct writer cannot be proven compatible, disable only the negative
  buff-event index and load the mod normally;
- keep the public invalidator documented for mod authors who require immediate
  same-tick visibility; and
- never claim that a source scan proves the absence of dynamic writes.

A future mutation API may accept a narrower entity or buff hint, but it must
remain correct when a mod calls the existing full invalidator.

## What `KDHelpless` means

`KDHelpless` is an NPC-state classifier, not a player setting. In stock KD it
can classify a nonplayer NPC as helpless when the NPC is at very low health or
bound beyond its struggle threshold and has enough binding effects to be
unable to act normally. Target selection and rescue logic consult it.

The accepted shortcut only proves the obvious negative case: a normal,
healthy, unbound, unpacked NPC cannot be helpless. Injured, bound, packed,
player-like, or unusual entities still run the complete KD body. Replacing
`KDHelpless`, `KDUnPackEnemy`, `KDPackEnemy`, or
`KDNPCStruggleThreshMult` already selects the original path.

Calling `KDHelpless` is not itself suspicious. Preflight should warn only when
a mod replaces one of those functions, depends on its exact source, or changes
the representation assumptions. Ordinary replacements should trigger
compatibility fallback without disabling the mod.

## Path and enemy-cache access

Pathfinding is the highest-risk optimization because a different first step can
change later movement, combat, capture, and RNG history even when both paths
are valid. Cache preflight and fallback are therefore required before stable.

Preflight should inspect JavaScript and KScript entries without executing them
and classify references to at least:

- `KDPathCache` and `KDPathCacheIgnoreLocks`;
- `KDEnemyCache` and `KDUpdateEnemyCache`;
- path-cache clearing, replacement, `set`, `delete`, and `clear` operations;
- direct grid, traffic, lock, or entity-position mutations that bypass normal
  KD invalidation; and
- replacement of migrated pathfinding or movement globals.

Token presence alone is not proof. Read-only diagnostics should normally
produce an informational notice; high-confidence mutation should select the
decision dialog. Runtime identity, generation, and cache-replacement checks
remain authoritative after load.

Compatibility mode should disable the smallest complete dependency group:

- path/grid mutation disables native pathfinding for the session;
- enemy-position-cache mutation disables the enemy-update cache batch and its
  dependent dense nearby/master indexes; and
- a replacement public function keeps that function's existing per-call or
  per-system official fallback.

The warning must say whether performance is lost, gameplay may become
unstable, or a restart is required. Choosing **Disable this mod** must only
exclude it from loading and remain reversible.

## Function-source inspection

Source-level patches change `Function.prototype.toString()` output even when
their gameplay result is equivalent. Preflight should look for
high-confidence source inspection involving migrated KD functions, including
direct `.toString()` calls, `Function.prototype.toString.call`, source hashes,
and sentinel-text comparisons.

Mere use of the word `toString` is too weak to block a mod. A high-confidence
match against affected KD functions blocks evaluation until the user chooses:

- **Compatibility mode:** restore or reinstall without source optimizations,
  restart if necessary, and then load the mod;
- **Keep optimizations:** force-load with a persistent unstable-status badge;
  or
- **Disable this mod:** keep it installed but excluded.

Runtime fallback cannot restore the original function source after
`out/main.js` has already been transformed. The safe source-text path therefore
belongs to the manager and may require byte-exact restoration plus restart.

## Preflight boundaries

The alpha currently leaves mod loading to KD. Delivering this UX requires a
small pre-evaluation integration point in the manager or early loader. It must:

- inspect archives as data and never execute a mod during scanning;
- enforce entry-count, decompressed-size, and path-traversal limits;
- identify findings by mod name, version when available, and content digest;
- keep filenames and source local unless the user explicitly exports scrubbed
  diagnostics;
- distinguish high-confidence mutation from low-confidence informational
  matches; and
- allow normal unknown mods to load under conservative subsystem fallback.

No scanner can make hostile or heavily obfuscated JavaScript safe. The purpose
is compatibility routing and understandable choices, not a security sandbox.

## Required tests

Before this cleanup gate is complete:

- standard buff APIs update the index immediately;
- direct buff-write fixtures are detected or safely disable the index;
- the public buff invalidator provides same-tick visibility;
- harmless `.buffs` reads and unrelated `toString()` calls do not block mods;
- path and enemy-cache writes select the correct dependency-group fallback;
- changed function identities still trigger runtime fallback;
- source-inspection compatibility mode restores original function source before
  the mod executes;
- force-load, compatibility, and disabled-mod choices all survive restart only
  when **Remember this choice** was selected;
- changing one byte of a mod invalidates its remembered decision;
- per-mod and global **Forget** actions work;
- disabled mods remain installed and recoverable;
- multiple conflicting mod decisions resolve conservatively;
- headless mode never silently chooses instability;
- no choice changes the normal KD save;
- uninstall removes the compatibility database and restores every patched game
  file; and
- pathfinding, crowded-turn, combat, prison, map-generation, long-session, and
  mod-replacement gates still pass.

## Completion checklist

- [ ] Pre-evaluation mod inventory and bounded archive scanner
- [ ] Confidence-ranked buff, cache, pathfinding, and source-text rules
- [ ] Per-subsystem compatibility routing
- [ ] Manager warning dialog with the three choices
- [ ] Content-digest-based remembered decisions
- [ ] Mod-options decision list and per-mod forget action
- [ ] **Regret it? Forget all remembered compatibility choices** action
- [ ] Safe no-source-optimization restore/restart flow
- [ ] Persistent forced-compatibility and forced-unstable status indicators
- [ ] Automated fixtures and isolated real-game validation
- [ ] Documentation for `KDHybridInvalidateBuffEventIndex()` and mod manifests
- [ ] Release report proving the checklist above

This checklist is part of the stable-release gate. It is not permission to
publish, push development work, or change repository visibility.
