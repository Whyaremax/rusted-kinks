// SPDX-License-Identifier: MIT

import type {
  ModCompatibilityCandidate,
  ModCompatibilityChoice,
  ModCompatibilityDecisionStore,
  ModCompatibilitySubsystem,
  RememberedModCompatibilityDecision,
} from "./mod-compatibility-decisions.js";

export const MOD_COMPATIBILITY_FORGET_ALL_LABEL =
  "Regret it? Forget all remembered compatibility choices.";

export type ModCompatibilityRuntimeStatus =
  "forced-compatibility" | "forced-unstable" | "disabled";

export type ModCompatibilityDecisionSource =
  | "remembered"
  | "prompt"
  | "dismissed"
  | "headless"
  | "no-risk"
  | "presentation-error"
  | "disposed";

export interface ModCompatibilityChoiceView {
  readonly choice: ModCompatibilityChoice;
  readonly label: string;
  readonly description: string;
  readonly recommended: boolean;
}

export interface ModCompatibilitySubsystemView {
  readonly subsystem: ModCompatibilitySubsystem;
  readonly label: string;
}

export interface ModCompatibilityDialogModel {
  readonly title: string;
  readonly modName: string;
  readonly digest: string;
  readonly affectedSubsystems: readonly ModCompatibilitySubsystemView[];
  readonly evidenceReasons: readonly string[];
  readonly choices: readonly ModCompatibilityChoiceView[];
  readonly rememberLabel: string;
  readonly restartRequired: boolean;
  readonly restartMessage: string | null;
}

export interface ModCompatibilityDialogActions {
  select(choice: ModCompatibilityChoice, remember: boolean): void;
  dismiss(): void;
}

export interface ModCompatibilityViewHandle {
  dispose(): void;
}

export interface ModCompatibilityDialogPort {
  show(
    model: ModCompatibilityDialogModel,
    actions: ModCompatibilityDialogActions,
  ): ModCompatibilityViewHandle | void;
}

export interface ModCompatibilityDecisionResult {
  readonly choice: ModCompatibilityChoice;
  readonly source: ModCompatibilityDecisionSource;
  readonly remembered: boolean;
  readonly restartRequired: boolean;
}

export interface ModCompatibilityManagedMod {
  readonly candidate: ModCompatibilityCandidate;
  readonly status?: ModCompatibilityRuntimeStatus;
  /**
   * True only when this activation is paused until KD restarts with its
   * original source bundle. This is policy state, not a runtime-status badge.
   */
  readonly restartRequired?: boolean;
}

export interface ModCompatibilityManagerRow {
  readonly name: string;
  readonly digest: string;
  readonly choice: ModCompatibilityChoice | null;
  readonly choiceLabel: string | null;
  readonly status: ModCompatibilityRuntimeStatus | null;
  readonly statusLabel: string | null;
  readonly affectedSubsystems: readonly ModCompatibilitySubsystemView[];
  readonly rememberedAt: string | null;
  readonly canChange: boolean;
  readonly canForget: boolean;
}

export interface ModCompatibilityManagerModel {
  readonly title: string;
  readonly attentionMessage: string | null;
  readonly rows: readonly ModCompatibilityManagerRow[];
  readonly emptyMessage: string;
  readonly forgetAllLabel: typeof MOD_COMPATIBILITY_FORGET_ALL_LABEL;
  readonly canForgetAll: boolean;
}

export interface ModCompatibilityManagerActions {
  change(digest: string): Promise<void>;
  forget(digest: string): void;
  forgetAll(): void;
}

export interface ModCompatibilityManagerPort {
  show(
    model: ModCompatibilityManagerModel,
    actions: ModCompatibilityManagerActions,
  ): ModCompatibilityViewHandle | void;
}

export interface ModCompatibilityUiOptions {
  readonly decisionStore?: Pick<
    ModCompatibilityDecisionStore,
    "lookup" | "remember" | "forget" | "forgetAll" | "decisions"
  >;
  readonly dialog?: ModCompatibilityDialogPort;
  readonly manager?: ModCompatibilityManagerPort;
  readonly headless?: boolean;
}

export interface ModCompatibilityUiController {
  /**
   * Loader-compatible decision hook. Calls are serialized so only one mod is
   * ever presented at a time.
   */
  prompt(candidate: ModCompatibilityCandidate): Promise<ModCompatibilityChoice>;
  request(
    candidate: ModCompatibilityCandidate,
  ): Promise<ModCompatibilityDecisionResult>;
  /**
   * Prompts even when a remembered decision exists. An explicit replacement is
   * persisted when a decision store is available; dismissing leaves the old
   * choice alone.
   */
  change(
    candidate: ModCompatibilityCandidate,
  ): Promise<ModCompatibilityDecisionResult>;
  managerModel(
    mods?: readonly ModCompatibilityManagedMod[],
  ): ModCompatibilityManagerModel;
  showManager(mods?: readonly ModCompatibilityManagedMod[]): void;
  forget(digest: string): boolean;
  forgetAll(): number;
  dispose(): void;
  isDisposed(): boolean;
}

interface QueuedDecision {
  readonly candidate: ModCompatibilityCandidate;
  readonly change: boolean;
  readonly resolve: (value: ModCompatibilityDecisionResult) => void;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CHOICES = new Set<ModCompatibilityChoice>([
  "compatibility",
  "keep-optimizations",
  "disable-mod",
]);
const CHOICE_VIEWS = Object.freeze([
  Object.freeze({
    choice: "compatibility",
    label: "Compatibility mode (recommended)",
    description:
      "Load the mod and use KD's original JavaScript only for the affected optimization.",
    recommended: true,
  }),
  Object.freeze({
    choice: "keep-optimizations",
    label: "Keep optimizations",
    description:
      "Load the mod without the compatibility fallback. Gameplay may become unstable or behave differently.",
    recommended: false,
  }),
  Object.freeze({
    choice: "disable-mod",
    label: "Disable this mod",
    description:
      "Keep the mod installed, but exclude it from the next activation.",
    recommended: false,
  }),
] satisfies readonly ModCompatibilityChoiceView[]);
const SUBSYSTEM_LABELS: Readonly<Record<ModCompatibilitySubsystem, string>> =
  Object.freeze({
    "buff-event-index": "Buff event index",
    "enemy-position-cache": "Enemy position cache",
    pathfinding: "Pathfinding",
    "source-optimizations": "Source optimizations",
  });
const STATUS_LABELS: Readonly<Record<ModCompatibilityRuntimeStatus, string>> =
  Object.freeze({
    "forced-compatibility": "Forced compatibility",
    "forced-unstable": "Forced unstable",
    disabled: "Disabled for activation",
  });
const CHOICE_LABELS: Readonly<Record<ModCompatibilityChoice, string>> =
  Object.freeze({
    compatibility: "Compatibility mode",
    "keep-optimizations": "Keep optimizations",
    "disable-mod": "Disable this mod",
  });

/**
 * Creates the pre-evaluation dialog queue and remembered-choice manager.
 *
 * The controller has no network, archive, or KD-save dependency. Its only
 * optional write port is the dedicated compatibility decision store.
 */
export function createModCompatibilityUiController(
  options: ModCompatibilityUiOptions = {},
): ModCompatibilityUiController {
  const queue: QueuedDecision[] = [];
  let active: QueuedDecision | undefined;
  let activeHandle: ModCompatibilityViewHandle | undefined;
  let managerHandle: ModCompatibilityViewHandle | undefined;
  let managedMods: readonly ModCompatibilityManagedMod[] = Object.freeze([]);
  let disposed = false;

  const result = (
    candidate: ModCompatibilityCandidate,
    choice: ModCompatibilityChoice,
    source: ModCompatibilityDecisionSource,
    remembered = false,
  ): ModCompatibilityDecisionResult =>
    Object.freeze({
      choice,
      source,
      remembered,
      restartRequired:
        choice === "compatibility" &&
        candidate.findings.some(
          (finding) =>
            finding.confidence === "high" && finding.restartRequired === true,
        ),
    });

  const settle = (
    item: QueuedDecision,
    value: ModCompatibilityDecisionResult,
  ): void => {
    if (active !== item) {
      return;
    }
    active = undefined;
    const handle = activeHandle;
    activeHandle = undefined;
    safelyDispose(handle);
    item.resolve(value);
    queueMicrotask(pump);
  };

  const select = (
    item: QueuedDecision,
    choiceInput: ModCompatibilityChoice,
    remember: boolean,
  ): void => {
    const choice = CHOICES.has(choiceInput) ? choiceInput : "compatibility";
    let remembered = false;
    if (remember || item.change) {
      try {
        options.decisionStore?.remember(item.candidate.digest, choice);
        remembered = options.decisionStore !== undefined;
      } catch {
        remembered = false;
      }
    }
    settle(item, result(item.candidate, choice, "prompt", remembered));
  };

  function pump(): void {
    if (active !== undefined || queue.length === 0) {
      return;
    }
    const item = queue.shift();
    if (item === undefined) {
      return;
    }
    active = item;
    if (disposed) {
      settle(item, result(item.candidate, "compatibility", "disposed"));
      return;
    }
    if (
      !item.candidate.findings.some((finding) => finding.confidence === "high")
    ) {
      settle(item, result(item.candidate, "compatibility", "no-risk"));
      return;
    }
    if (options.headless === true || options.dialog === undefined) {
      settle(item, result(item.candidate, "compatibility", "headless"));
      return;
    }

    try {
      const handle = options.dialog.show(
        createDialogModel(item.candidate),
        Object.freeze({
          select: (choice: ModCompatibilityChoice, remember: boolean) => {
            select(item, choice, remember);
          },
          dismiss: () => {
            settle(item, result(item.candidate, "compatibility", "dismissed"));
          },
        }),
      );
      if (active === item) {
        activeHandle = handle ?? undefined;
      } else {
        safelyDispose(handle ?? undefined);
      }
    } catch {
      settle(
        item,
        result(item.candidate, "compatibility", "presentation-error"),
      );
    }
  }

  const enqueue = (
    candidateInput: ModCompatibilityCandidate,
    change: boolean,
  ): Promise<ModCompatibilityDecisionResult> => {
    let candidate: ModCompatibilityCandidate;
    try {
      candidate = snapshotCandidate(candidateInput);
    } catch {
      return Promise.resolve(
        result(candidateInput, "compatibility", "presentation-error"),
      );
    }
    if (disposed) {
      return Promise.resolve(result(candidate, "compatibility", "disposed"));
    }
    if (!change) {
      try {
        const remembered = options.decisionStore?.lookup(candidate.digest);
        if (remembered !== undefined) {
          return Promise.resolve(
            result(candidate, remembered.choice, "remembered", true),
          );
        }
      } catch {
        // Invalid or unavailable compatibility storage fails into the dialog.
      }
    }
    return new Promise((resolve) => {
      queue.push(Object.freeze({ candidate, change, resolve }));
      pump();
    });
  };

  const refreshManager = (): void => {
    if (options.manager === undefined || disposed) {
      return;
    }
    safelyDispose(managerHandle);
    managerHandle = undefined;
    const model = buildManagerModel(options.decisionStore, managedMods);
    try {
      const handle = options.manager.show(
        model,
        Object.freeze({
          change: async (digestInput: string) => {
            const digest = normalizeDigestOrNull(digestInput);
            const mod =
              digest === null
                ? undefined
                : managedMods.find(
                    (entry) => entry.candidate.digest.toLowerCase() === digest,
                  );
            if (mod !== undefined) {
              await enqueue(mod.candidate, true);
              refreshManager();
            }
          },
          forget: (digest: string) => {
            try {
              options.decisionStore?.forget(digest);
            } catch {
              // A malformed UI-supplied digest does not affect other choices.
            }
            refreshManager();
          },
          forgetAll: () => {
            try {
              options.decisionStore?.forgetAll();
            } catch {
              // An unavailable compatibility store leaves the view unchanged.
            }
            refreshManager();
          },
        }),
      );
      managerHandle = handle ?? undefined;
    } catch {
      // A manager presentation failure cannot alter execution policy.
      managerHandle = undefined;
    }
  };

  const controller: ModCompatibilityUiController = {
    prompt: async (candidate) => (await enqueue(candidate, false)).choice,
    request: (candidate) => enqueue(candidate, false),
    change: (candidate) => enqueue(candidate, true),
    managerModel: (mods = Object.freeze([])) =>
      buildManagerModel(options.decisionStore, snapshotManagedMods(mods)),
    showManager(mods = Object.freeze([])) {
      managedMods = snapshotManagedMods(mods);
      refreshManager();
    },
    forget(digest) {
      try {
        return options.decisionStore?.forget(digest) ?? false;
      } catch {
        return false;
      }
    },
    forgetAll() {
      try {
        return options.decisionStore?.forgetAll() ?? 0;
      } catch {
        return 0;
      }
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      const current = active;
      active = undefined;
      const handle = activeHandle;
      activeHandle = undefined;
      safelyDispose(handle);
      safelyDispose(managerHandle);
      managerHandle = undefined;
      if (current !== undefined) {
        current.resolve(result(current.candidate, "compatibility", "disposed"));
      }
      for (const pending of queue.splice(0)) {
        pending.resolve(result(pending.candidate, "compatibility", "disposed"));
      }
    },
    isDisposed: () => disposed,
  };
  return Object.freeze(controller);
}

export function createDialogModel(
  candidateInput: ModCompatibilityCandidate,
): ModCompatibilityDialogModel {
  const candidate = snapshotCandidate(candidateInput);
  const highConfidence = candidate.findings.filter(
    (finding) => finding.confidence === "high",
  );
  const subsystemSet = new Set(
    highConfidence.map((finding) => finding.subsystem),
  );
  const restartRequired = highConfidence.some(
    (finding) => finding.restartRequired === true,
  );
  return Object.freeze({
    title: "Mod compatibility check",
    modName: candidate.name,
    digest: candidate.digest,
    affectedSubsystems: Object.freeze(
      Object.keys(SUBSYSTEM_LABELS)
        .filter((subsystem): subsystem is ModCompatibilitySubsystem =>
          subsystemSet.has(subsystem as ModCompatibilitySubsystem),
        )
        .map((subsystem) =>
          Object.freeze({
            subsystem,
            label: SUBSYSTEM_LABELS[subsystem],
          }),
        ),
    ),
    evidenceReasons: Object.freeze(
      highConfidence.map((finding) => finding.reason),
    ),
    choices: CHOICE_VIEWS,
    rememberLabel: "Remember this choice",
    restartRequired,
    restartMessage: restartRequired
      ? "Compatibility mode must restore the original function source before this mod runs. A restart is required."
      : null,
  });
}

export function buildManagerModel(
  store: Pick<ModCompatibilityDecisionStore, "decisions"> | undefined,
  mods: readonly ModCompatibilityManagedMod[] = Object.freeze([]),
): ModCompatibilityManagerModel {
  const known = new Map(
    mods.map((entry) => [entry.candidate.digest.toLowerCase(), entry]),
  );
  let decisions: readonly RememberedModCompatibilityDecision[] = [];
  try {
    decisions = store?.decisions() ?? [];
  } catch {
    decisions = [];
  }
  const remembered = new Map(
    decisions.map((decision) => [decision.digest.toLowerCase(), decision]),
  );
  const restartRequired = mods.some((entry) => entry.restartRequired === true);
  const digests = new Set([...known.keys(), ...remembered.keys()]);
  const rows = [...digests].map((digest) => {
    const mod = known.get(digest);
    const decision = remembered.get(digest);
    const status = mod?.status ?? null;
    const affected = new Set(
      mod?.candidate.findings
        .filter((finding) => finding.confidence === "high")
        .map((finding) => finding.subsystem) ?? [],
    );
    return Object.freeze({
      name: mod?.candidate.name ?? "Unknown mod",
      digest,
      choice: decision?.choice ?? null,
      choiceLabel:
        decision === undefined ? null : CHOICE_LABELS[decision.choice],
      status,
      statusLabel: status === null ? null : STATUS_LABELS[status],
      affectedSubsystems: Object.freeze(
        Object.keys(SUBSYSTEM_LABELS)
          .filter((subsystem): subsystem is ModCompatibilitySubsystem =>
            affected.has(subsystem as ModCompatibilitySubsystem),
          )
          .map((subsystem) =>
            Object.freeze({
              subsystem,
              label: SUBSYSTEM_LABELS[subsystem],
            }),
          ),
      ),
      rememberedAt: decision?.rememberedAt ?? null,
      canChange: mod !== undefined && store !== undefined,
      canForget: decision !== undefined,
    } satisfies ModCompatibilityManagerRow);
  });
  rows.sort(
    (left, right) =>
      ordinalCompare(left.name, right.name) ||
      ordinalCompare(left.digest, right.digest),
  );
  return Object.freeze({
    title: "Remembered mod compatibility choices",
    attentionMessage: restartRequired
      ? "Mod loading is paused because compatibility mode requires KD's original source bundle. Close KD, use KDHybrid-Patcher with SourceMode original, and then fully restart; or choose Change or Forget below and retry mod loading with a different policy."
      : null,
    rows: Object.freeze(rows),
    emptyMessage: "No remembered compatibility choices.",
    forgetAllLabel: MOD_COMPATIBILITY_FORGET_ALL_LABEL,
    canForgetAll: decisions.length > 0,
  });
}

export interface BrowserModCompatibilityPorts {
  readonly dialog: ModCompatibilityDialogPort;
  readonly manager: ModCompatibilityManagerPort;
}

/**
 * Minimal browser adapter for the framework-independent ports above. Every
 * scanner-provided value is assigned through textContent; mod-controlled text
 * is never interpreted as markup.
 */
export function createBrowserModCompatibilityPorts(
  document: Document,
  mount: HTMLElement = document.body,
): BrowserModCompatibilityPorts {
  if (mount === null) {
    throw new TypeError("A compatibility UI mount element is required");
  }
  const dialog: ModCompatibilityDialogPort = Object.freeze({
    show(
      model: ModCompatibilityDialogModel,
      actions: ModCompatibilityDialogActions,
    ) {
      return showBrowserDialog(document, mount, model, actions);
    },
  });
  let managerHandle: ModCompatibilityViewHandle | undefined;
  const manager: ModCompatibilityManagerPort = Object.freeze({
    show(
      model: ModCompatibilityManagerModel,
      actions: ModCompatibilityManagerActions,
    ) {
      safelyDispose(managerHandle);
      managerHandle = showBrowserManager(document, mount, model, actions);
      return Object.freeze({
        dispose() {
          safelyDispose(managerHandle);
          managerHandle = undefined;
        },
      });
    },
  });
  return Object.freeze({ dialog, manager });
}

let browserViewSequence = 0;
const BROWSER_OVERLAY_Z_INDEX = "2147483647";

function showBrowserDialog(
  document: Document,
  mount: HTMLElement,
  model: ModCompatibilityDialogModel,
  actions: ModCompatibilityDialogActions,
): ModCompatibilityViewHandle {
  const sequence = ++browserViewSequence;
  const previousFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "kd-hybrid-compatibility-overlay";
  styleOverlay(overlay);
  const panel = document.createElement("div");
  panel.className = "kd-hybrid-compatibility-dialog";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  stylePanel(panel);
  overlay.append(panel);

  const title = textElement(document, "h2", model.title);
  title.id = `kd-hybrid-compatibility-title-${sequence}`;
  panel.setAttribute("aria-labelledby", title.id);
  styleTitle(title);
  panel.append(title);

  const summary = textElement(
    document,
    "p",
    `Rusted Kinks found a compatibility risk in ${model.modName}.`,
  );
  summary.id = `kd-hybrid-compatibility-summary-${sequence}`;
  panel.setAttribute("aria-describedby", summary.id);
  styleParagraph(summary);
  panel.append(summary);

  const close = textElement(document, "button", "Close");
  close.type = "button";
  close.setAttribute("aria-label", "Close compatibility dialog");
  styleButton(close, "secondary");
  Object.assign(close.style, {
    position: "absolute",
    right: "16px",
    top: "16px",
  });
  panel.append(close);

  const affectedHeading = textElement(document, "h3", "Affected optimizations");
  styleSubheading(affectedHeading);
  panel.append(affectedHeading);
  const subsystemList = document.createElement("ul");
  styleList(subsystemList);
  for (const subsystem of model.affectedSubsystems) {
    subsystemList.append(textElement(document, "li", subsystem.label));
  }
  panel.append(subsystemList);

  const evidenceHeading = textElement(document, "h3", "Why this was flagged");
  styleSubheading(evidenceHeading);
  panel.append(evidenceHeading);
  const evidenceList = document.createElement("ul");
  styleList(evidenceList);
  for (const reason of model.evidenceReasons) {
    evidenceList.append(textElement(document, "li", reason));
  }
  panel.append(evidenceList);

  if (model.restartMessage !== null) {
    const restart = textElement(document, "p", model.restartMessage);
    restart.setAttribute("role", "status");
    Object.assign(restart.style, {
      background: "#4b2e0b",
      border: "1px solid #d29922",
      borderRadius: "6px",
      color: "#fff3cd",
      margin: "16px 0",
      padding: "12px",
    });
    panel.append(restart);
  }

  const choices = document.createElement("fieldset");
  Object.assign(choices.style, {
    border: "1px solid #5b6573",
    borderRadius: "8px",
    margin: "16px 0",
    minWidth: "0",
    padding: "12px",
  });
  const legend = textElement(document, "legend", "Choose how to load this mod");
  Object.assign(legend.style, {
    color: "#ffffff",
    fontWeight: "700",
    padding: "0 6px",
  });
  choices.append(legend);
  const remember = document.createElement("input");
  remember.type = "checkbox";
  remember.id = `kd-hybrid-compatibility-remember-${sequence}`;
  Object.assign(remember.style, {
    accentColor: "#4f9cff",
    cursor: "pointer",
    height: "18px",
    margin: "0 8px 0 0",
    verticalAlign: "middle",
    width: "18px",
  });
  const rememberLabel = textElement(document, "label", model.rememberLabel);
  rememberLabel.htmlFor = remember.id;
  Object.assign(rememberLabel.style, {
    color: "#f5f7fa",
    cursor: "pointer",
    verticalAlign: "middle",
  });

  const choiceButtons: HTMLButtonElement[] = [];
  for (const choice of model.choices) {
    const group = document.createElement("div");
    Object.assign(group.style, {
      borderBottom: "1px solid #3d4652",
      padding: "10px 0",
    });
    const button = textElement(document, "button", choice.label);
    button.type = "button";
    button.setAttribute("data-choice", choice.choice);
    styleButton(button, choice.recommended ? "primary" : "secondary");
    button.addEventListener("click", () => {
      actions.select(choice.choice, remember.checked);
    });
    const description = textElement(document, "p", choice.description);
    styleParagraph(description);
    Object.assign(description.style, {
      marginBottom: "0",
      marginTop: "6px",
    });
    group.append(button, description);
    choices.append(group);
    choiceButtons.push(button);
  }
  panel.append(choices, remember, rememberLabel);

  let closed = false;
  const dismiss = (): void => {
    if (!closed) {
      actions.dismiss();
    }
  };
  close.addEventListener("click", dismiss);
  const focusable: HTMLElement[] = [close, ...choiceButtons, remember];
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const currentIndex = focusable.indexOf(
      document.activeElement as HTMLElement,
    );
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusable.length - 1
        : currentIndex - 1
      : currentIndex < 0 || currentIndex === focusable.length - 1
        ? 0
        : currentIndex + 1;
    event.preventDefault();
    focusable[nextIndex]?.focus();
  };
  overlay.addEventListener("keydown", onKeyDown);
  mount.append(overlay);
  const recommended =
    choiceButtons[model.choices.findIndex((choice) => choice.recommended)] ??
    choiceButtons[0] ??
    close;
  recommended.focus();

  return Object.freeze({
    dispose() {
      if (closed) {
        return;
      }
      closed = true;
      overlay.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      if (isFocusable(previousFocus)) {
        previousFocus.focus();
      }
    },
  });
}

function showBrowserManager(
  document: Document,
  mount: HTMLElement,
  model: ModCompatibilityManagerModel,
  actions: ModCompatibilityManagerActions,
): ModCompatibilityViewHandle {
  const sequence = ++browserViewSequence;
  const previousFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "kd-hybrid-compatibility-overlay";
  styleOverlay(overlay);
  const panel = document.createElement("section");
  panel.className = "kd-hybrid-compatibility-manager";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  stylePanel(panel);
  overlay.append(panel);

  const title = textElement(document, "h2", model.title);
  title.id = `kd-hybrid-compatibility-manager-title-${sequence}`;
  panel.setAttribute("aria-labelledby", title.id);
  styleTitle(title);
  panel.append(title);
  const close = textElement(document, "button", "Close");
  close.type = "button";
  close.setAttribute("aria-label", "Close compatibility choices");
  styleButton(close, "secondary");
  Object.assign(close.style, {
    position: "absolute",
    right: "16px",
    top: "16px",
  });
  panel.append(close);

  const focusable: HTMLElement[] = [close];
  if (model.attentionMessage !== null) {
    const attention = textElement(document, "p", model.attentionMessage);
    attention.setAttribute("role", "alert");
    Object.assign(attention.style, {
      background: "#4a3418",
      border: "1px solid #d69e2e",
      borderRadius: "6px",
      color: "#fff3c4",
      margin: "12px 0",
      padding: "12px",
    });
    panel.append(attention);
  }
  if (model.rows.length === 0) {
    const empty = textElement(document, "p", model.emptyMessage);
    styleParagraph(empty);
    panel.append(empty);
  }
  for (const row of model.rows) {
    const item = document.createElement("article");
    Object.assign(item.style, {
      background: "#292f38",
      border: "1px solid #4a5563",
      borderRadius: "8px",
      margin: "12px 0",
      padding: "12px",
    });
    const name = textElement(document, "h3", row.name);
    styleSubheading(name);
    const digest = textElement(document, "code", row.digest);
    Object.assign(digest.style, {
      color: "#b8c2cf",
      display: "block",
      fontSize: "12px",
      overflowWrap: "anywhere",
    });
    item.append(name, digest);
    if (row.choiceLabel !== null) {
      const choice = textElement(
        document,
        "p",
        `Remembered choice: ${row.choiceLabel}`,
      );
      styleParagraph(choice);
      item.append(choice);
    }
    if (row.statusLabel !== null) {
      const badge = textElement(document, "span", row.statusLabel);
      badge.setAttribute("data-compatibility-status", row.status ?? "");
      styleStatusBadge(badge, row.status);
      item.append(badge);
    }
    if (row.affectedSubsystems.length > 0) {
      const affected = textElement(
        document,
        "p",
        `Affected: ${row.affectedSubsystems
          .map((entry) => entry.label)
          .join(", ")}`,
      );
      styleParagraph(affected);
      item.append(affected);
    }
    const change = textElement(document, "button", "Change");
    change.type = "button";
    change.disabled = !row.canChange;
    styleButton(change, "primary", change.disabled);
    change.addEventListener("click", () => {
      void Promise.resolve(actions.change(row.digest)).catch(() => {
        // A manager action/presentation failure cannot alter execution policy.
      });
    });
    if (!change.disabled) {
      focusable.push(change);
    }
    const forget = textElement(document, "button", "Forget");
    forget.type = "button";
    forget.disabled = !row.canForget;
    styleButton(forget, "danger", forget.disabled);
    Object.assign(forget.style, { marginLeft: "8px" });
    forget.addEventListener("click", () => {
      try {
        actions.forget(row.digest);
      } catch {
        // A manager action/presentation failure cannot alter execution policy.
      }
    });
    if (!forget.disabled) {
      focusable.push(forget);
    }
    item.append(change, forget);
    panel.append(item);
  }
  const forgetAll = textElement(document, "button", model.forgetAllLabel);
  forgetAll.type = "button";
  forgetAll.disabled = !model.canForgetAll;
  styleButton(forgetAll, "danger", forgetAll.disabled);
  Object.assign(forgetAll.style, { marginTop: "8px" });
  forgetAll.addEventListener("click", () => {
    try {
      actions.forgetAll();
    } catch {
      // A manager action/presentation failure cannot alter execution policy.
    }
  });
  if (!forgetAll.disabled) {
    focusable.push(forgetAll);
  }
  panel.append(forgetAll);

  let closed = false;
  const dispose = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    overlay.removeEventListener("keydown", onKeyDown);
    overlay.remove();
    if (isFocusable(previousFocus)) {
      previousFocus.focus();
    }
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      dispose();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const currentIndex = focusable.indexOf(
      document.activeElement as HTMLElement,
    );
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusable.length - 1
        : currentIndex - 1
      : currentIndex < 0 || currentIndex === focusable.length - 1
        ? 0
        : currentIndex + 1;
    event.preventDefault();
    focusable[nextIndex]?.focus();
  };
  close.addEventListener("click", dispose);
  overlay.addEventListener("keydown", onKeyDown);
  mount.append(overlay);
  close.focus();
  return Object.freeze({
    dispose,
  });
}

function styleOverlay(element: HTMLElement): void {
  Object.assign(element.style, {
    alignItems: "center",
    background: "rgba(0, 0, 0, 0.84)",
    boxSizing: "border-box",
    colorScheme: "dark",
    contain: "layout style paint",
    display: "flex",
    inset: "0",
    isolation: "isolate",
    justifyContent: "center",
    overflow: "auto",
    overscrollBehavior: "contain",
    padding: "16px",
    pointerEvents: "auto",
    position: "fixed",
    touchAction: "manipulation",
    transform: "none",
    visibility: "visible",
    zIndex: BROWSER_OVERLAY_Z_INDEX,
  });
}

function stylePanel(element: HTMLElement): void {
  Object.assign(element.style, {
    background: "#1f242c",
    border: "1px solid #697586",
    borderRadius: "10px",
    boxShadow: "0 18px 60px rgba(0, 0, 0, 0.75)",
    boxSizing: "border-box",
    color: "#f5f7fa",
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: "16px",
    lineHeight: "1.45",
    margin: "auto",
    maxHeight: "calc(100vh - 32px)",
    maxWidth: "720px",
    overflowWrap: "anywhere",
    overflowY: "auto",
    padding: "24px",
    pointerEvents: "auto",
    position: "relative",
    textAlign: "left",
    transform: "none",
    visibility: "visible",
    whiteSpace: "normal",
    width: "calc(100vw - 32px)",
  });
}

function styleButton(
  element: HTMLButtonElement,
  tone: "primary" | "secondary" | "danger",
  disabled = false,
): void {
  const colors =
    tone === "primary"
      ? { background: "#1769c2", border: "#5ba7ff", color: "#ffffff" }
      : tone === "danger"
        ? {
            background: "#7d2430",
            border: "#e06c75",
            color: "#ffffff",
          }
        : {
            background: "#343c47",
            border: "#7d8998",
            color: "#ffffff",
          };
  Object.assign(element.style, {
    appearance: "none",
    background: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: "6px",
    boxSizing: "border-box",
    color: colors.color,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-block",
    font: "inherit",
    fontWeight: "600",
    minHeight: "36px",
    opacity: disabled ? "0.55" : "1",
    padding: "7px 12px",
  });
}

function styleTitle(element: HTMLElement): void {
  Object.assign(element.style, {
    color: "#ffffff",
    fontSize: "22px",
    lineHeight: "1.25",
    margin: "0 88px 16px 0",
  });
}

function styleSubheading(element: HTMLElement): void {
  Object.assign(element.style, {
    color: "#ffffff",
    fontSize: "17px",
    lineHeight: "1.3",
    margin: "16px 0 8px",
  });
}

function styleParagraph(element: HTMLElement): void {
  Object.assign(element.style, {
    color: "#d8dee7",
    margin: "8px 0",
  });
}

function styleList(element: HTMLElement): void {
  Object.assign(element.style, {
    color: "#d8dee7",
    margin: "8px 0 12px",
    paddingLeft: "24px",
  });
}

function styleStatusBadge(
  element: HTMLElement,
  status: ModCompatibilityRuntimeStatus | null,
): void {
  const colors =
    status === "forced-compatibility"
      ? {
          background: "#173f2a",
          border: "#4fc17b",
          color: "#c7f5d7",
        }
      : status === "forced-unstable"
        ? {
            background: "#522d0b",
            border: "#e3a645",
            color: "#ffedbd",
          }
        : {
            background: "#442129",
            border: "#db6d7c",
            color: "#ffd7dc",
          };
  Object.assign(element.style, {
    background: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: "999px",
    color: colors.color,
    display: "inline-block",
    fontSize: "13px",
    fontWeight: "700",
    margin: "4px 0",
    padding: "3px 8px",
  });
}

function textElement<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  name: K,
  text: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(name);
  element.textContent = text;
  return element;
}

function snapshotCandidate(
  candidate: ModCompatibilityCandidate,
): ModCompatibilityCandidate {
  const digest = candidate.digest.toLowerCase();
  if (
    candidate.name.trim().length === 0 ||
    !SHA256_PATTERN.test(digest) ||
    !Array.isArray(candidate.findings)
  ) {
    throw new RangeError("Invalid mod compatibility candidate");
  }
  return Object.freeze({
    name: candidate.name,
    digest,
    findings: Object.freeze(
      candidate.findings.map((finding) => Object.freeze({ ...finding })),
    ),
  });
}

function snapshotManagedMods(
  mods: readonly ModCompatibilityManagedMod[],
): readonly ModCompatibilityManagedMod[] {
  return Object.freeze(
    mods.map((entry) =>
      Object.freeze({
        candidate: snapshotCandidate(entry.candidate),
        ...(entry.status === undefined ? {} : { status: entry.status }),
        ...(entry.restartRequired === true ? { restartRequired: true } : {}),
      }),
    ),
  );
}

function normalizeDigestOrNull(value: string): string | null {
  const digest = value.toLowerCase();
  return SHA256_PATTERN.test(digest) ? digest : null;
}

function safelyDispose(handle: ModCompatibilityViewHandle | undefined): void {
  try {
    handle?.dispose();
  } catch {
    // UI cleanup must never change a compatibility decision.
  }
}

function isFocusable(value: Element | null): value is HTMLElement {
  return (
    value !== null &&
    typeof (value as { readonly focus?: unknown }).focus === "function"
  );
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
