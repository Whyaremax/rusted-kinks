import { describe, expect, it } from "vitest";

import {
  createModCompatibilityDecisionStore,
  type ModCompatibilityCandidate,
  type ModCompatibilityStorage,
} from "./mod-compatibility-decisions.js";
import {
  MOD_COMPATIBILITY_FORGET_ALL_LABEL,
  createBrowserModCompatibilityPorts,
  createDialogModel,
  createModCompatibilityUiController,
  type ModCompatibilityDialogActions,
  type ModCompatibilityDialogModel,
  type ModCompatibilityDialogPort,
  type ModCompatibilityManagerActions,
  type ModCompatibilityManagerModel,
  type ModCompatibilityManagerPort,
} from "./mod-compatibility-ui.js";

const digestA = "a".repeat(64);
const digestB = "b".repeat(64);
const bundle = "c".repeat(64);

describe("mod compatibility decision UI controller", () => {
  it("queues concurrent decisions and presents exactly one mod at a time", async () => {
    const dialogs = dialogHarness();
    const controller = createModCompatibilityUiController({
      dialog: dialogs.port,
    });

    const first = controller.request(mod("First", digestA));
    const second = controller.request(mod("Second", digestB));

    expect(dialogs.presentations).toHaveLength(1);
    expect(dialogs.presentations[0]?.model.modName).toBe("First");
    expect(dialogs.openCount()).toBe(1);

    dialogs.presentations[0]?.actions.select("keep-optimizations", false);
    expect(await first).toMatchObject({
      choice: "keep-optimizations",
      source: "prompt",
      remembered: false,
    });
    await microtask();

    expect(dialogs.presentations).toHaveLength(2);
    expect(dialogs.presentations[1]?.model.modName).toBe("Second");
    expect(dialogs.openCount()).toBe(1);
    dialogs.presentations[1]?.actions.select("disable-mod", false);
    expect(await second).toMatchObject({
      choice: "disable-mod",
      source: "prompt",
    });
    expect(dialogs.maxOpen()).toBe(1);
  });

  it("remembers checked choices and persists explicit Change replacements", async () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    const dialogs = dialogHarness();
    const controller = createModCompatibilityUiController({
      decisionStore: store,
      dialog: dialogs.port,
    });

    const first = controller.request(mod("Alpha", digestA));
    dialogs.presentations[0]?.actions.select("compatibility", true);
    expect(await first).toMatchObject({
      choice: "compatibility",
      remembered: true,
    });
    expect(store.lookup(digestA)?.choice).toBe("compatibility");

    expect(await controller.request(mod("Alpha", digestA))).toMatchObject({
      choice: "compatibility",
      source: "remembered",
    });
    expect(dialogs.presentations).toHaveLength(1);

    const changed = controller.change(mod("Alpha", digestA));
    expect(dialogs.presentations).toHaveLength(2);
    dialogs.presentations[1]?.actions.select("keep-optimizations", false);
    expect(await changed).toMatchObject({
      choice: "keep-optimizations",
      source: "prompt",
      remembered: true,
    });
    expect(store.lookup(digestA)?.choice).toBe("keep-optimizations");

    expect(await controller.request(mod("Alpha", digestA))).toMatchObject({
      choice: "keep-optimizations",
      source: "remembered",
    });
    expect(dialogs.presentations).toHaveLength(2);
  });

  it("defaults close, headless, and presentation failure to compatibility", async () => {
    const dialogs = dialogHarness();
    const controller = createModCompatibilityUiController({
      dialog: dialogs.port,
    });
    const dismissed = controller.request(mod("Source reader", digestA, true));
    dialogs.presentations[0]?.actions.dismiss();
    expect(await dismissed).toEqual({
      choice: "compatibility",
      source: "dismissed",
      remembered: false,
      restartRequired: true,
    });

    const headless = createModCompatibilityUiController({
      dialog: dialogs.port,
      headless: true,
    });
    expect(await headless.request(mod("Headless", digestB))).toEqual({
      choice: "compatibility",
      source: "headless",
      remembered: false,
      restartRequired: false,
    });

    const broken = createModCompatibilityUiController({
      dialog: {
        show() {
          throw new Error("renderer failed");
        },
      },
    });
    expect(await broken.request(mod("Broken UI", digestB))).toEqual({
      choice: "compatibility",
      source: "presentation-error",
      remembered: false,
      restartRequired: false,
    });
  });

  it("resolves active and queued work safely when disposed", async () => {
    const dialogs = dialogHarness();
    const controller = createModCompatibilityUiController({
      dialog: dialogs.port,
    });
    const first = controller.request(mod("First", digestA));
    const second = controller.request(mod("Second", digestB));

    controller.dispose();

    expect(await first).toMatchObject({
      choice: "compatibility",
      source: "disposed",
    });
    expect(await second).toMatchObject({
      choice: "compatibility",
      source: "disposed",
    });
    expect(dialogs.openCount()).toBe(0);
    expect(controller.isDisposed()).toBe(true);
    expect(await controller.prompt(mod("Late", digestA))).toBe("compatibility");
  });

  it("does not prompt informational-only findings", async () => {
    const dialogs = dialogHarness();
    const candidate = mod("Read-only diagnostics", digestA);
    candidate.findings[0] = {
      ...candidate.findings[0]!,
      confidence: "informational",
    };
    const controller = createModCompatibilityUiController({
      dialog: dialogs.port,
    });

    expect(await controller.request(candidate)).toMatchObject({
      choice: "compatibility",
      source: "no-risk",
    });
    expect(dialogs.presentations).toEqual([]);
  });
});

describe("mod compatibility decision content and browser adapter", () => {
  it("shows exact choices, plain evidence, and a restart warning", () => {
    const candidate = mod(
      "<img src=x onerror=alert(1)>",
      digestA,
      true,
      "Direct write: <script>bad()</script>",
    );
    const model = createDialogModel(candidate);

    expect(model.choices.map((choice) => choice.label)).toEqual([
      "Compatibility mode (recommended)",
      "Keep optimizations",
      "Disable this mod",
    ]);
    expect(model.modName).toBe("<img src=x onerror=alert(1)>");
    expect(model.evidenceReasons).toEqual([
      "Direct write: <script>bad()</script>",
    ]);
    expect(model.restartRequired).toBe(true);
    expect(model.restartMessage).toMatch(/restart is required/iu);
  });

  it("renders untrusted strings only as text and handles focus and Escape", async () => {
    const document = new FakeDocument();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const ports = createBrowserModCompatibilityPorts(
      document as unknown as Document,
      document.body as unknown as HTMLElement,
    );
    const controller = createModCompatibilityUiController({
      dialog: ports.dialog,
    });
    const pending = controller.request(
      mod(
        "<img src=x onerror=alert(1)>",
        digestA,
        false,
        "<script>steal()</script>",
      ),
    );
    const overlay = document.body.children.at(-1);
    const laterPixiCanvas = document.createElement("canvas");
    laterPixiCanvas.style.position = "absolute";
    document.body.append(laterPixiCanvas);
    const panel = findElement(
      overlay,
      (element) => element.attributes.get("role") === "dialog",
    );

    expect(panel?.attributes.get("aria-modal")).toBe("true");
    expect(overlay?.style.position).toBe("fixed");
    expect(overlay?.style.inset).toBe("0");
    expect(overlay?.style.zIndex).toBe("2147483647");
    expect(overlay?.style.pointerEvents).toBe("auto");
    expect(overlay?.style.overflow).toBe("auto");
    expect(overlay?.style.visibility).toBe("visible");
    expect(panel?.style.background).toBe("#1f242c");
    expect(panel?.style.color).toBe("#f5f7fa");
    expect(panel?.style.maxHeight).toBe("calc(100vh - 32px)");
    expect(panel?.style.overflowY).toBe("auto");
    expect(document.activeElement?.textContent).toBe(
      "Compatibility mode (recommended)",
    );
    expect(allElements(overlay).some((node) => node.tagName === "SCRIPT")).toBe(
      false,
    );
    expect(allText(overlay)).toContain("<img src=x onerror=alert(1)>");
    expect(allText(overlay)).toContain("<script>steal()</script>");

    let prevented = false;
    overlay?.dispatch("keydown", {
      key: "Escape",
      shiftKey: false,
      preventDefault: () => {
        prevented = true;
      },
    });
    expect(await pending).toMatchObject({
      choice: "compatibility",
      source: "dismissed",
    });
    expect(prevented).toBe(true);
    expect(document.activeElement).toBe(opener);
    expect(document.body.children).toEqual([opener, laterPixiCanvas]);
  });

  it("presents the manager above Pixi with an accessible close path and restored focus", () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    store.remember(digestA, "compatibility");
    store.remember(digestB, "keep-optimizations");
    const model = createModCompatibilityUiController({
      decisionStore: store,
    }).managerModel([
      {
        candidate: mod("Safe", digestA),
        status: "forced-compatibility",
      },
      {
        candidate: mod("Risky", digestB),
        status: "forced-unstable",
      },
    ]);
    const document = new FakeDocument();
    const opener = document.createElement("button");
    const pixiCanvas = document.createElement("canvas");
    pixiCanvas.style.position = "absolute";
    document.body.append(opener, pixiCanvas);
    opener.focus();
    const ports = createBrowserModCompatibilityPorts(
      document as unknown as Document,
      document.body as unknown as HTMLElement,
    );
    let changes = 0;
    let forgets = 0;
    let forgetAlls = 0;
    const actions: ModCompatibilityManagerActions = {
      change: async () => {
        changes += 1;
      },
      forget: () => {
        forgets += 1;
      },
      forgetAll: () => {
        forgetAlls += 1;
      },
    };

    ports.manager.show(model, actions);
    const overlay = document.body.children.at(-1);
    const panel = findElement(
      overlay,
      (element) => element.attributes.get("role") === "dialog",
    );
    const close = findElement(
      panel,
      (element) =>
        element.tagName === "BUTTON" && element.textContent === "Close",
    );
    const safeBadge = findElement(
      panel,
      (element) =>
        element.attributes.get("data-compatibility-status") ===
        "forced-compatibility",
    );
    const unstableBadge = findElement(
      panel,
      (element) =>
        element.attributes.get("data-compatibility-status") ===
        "forced-unstable",
    );

    expect(overlay?.style.position).toBe("fixed");
    expect(overlay?.style.zIndex).toBe("2147483647");
    expect(overlay?.style.pointerEvents).toBe("auto");
    expect(overlay?.style.visibility).toBe("visible");
    expect(panel?.style.maxHeight).toBe("calc(100vh - 32px)");
    expect(panel?.style.overflowY).toBe("auto");
    expect(panel?.attributes.get("aria-modal")).toBe("true");
    expect(close?.attributes.get("aria-label")).toBe(
      "Close compatibility choices",
    );
    expect(document.activeElement).toBe(close);
    expect(safeBadge?.style.background).not.toBe(
      unstableBadge?.style.background,
    );

    close?.dispatch("click", uiEvent());
    expect(document.body.children).toEqual([opener, pixiCanvas]);
    expect(document.activeElement).toBe(opener);
    expect({ changes, forgets, forgetAlls }).toEqual({
      changes: 0,
      forgets: 0,
      forgetAlls: 0,
    });

    ports.manager.show(model, actions);
    const reopened = document.body.children.at(-1);
    expect(document.activeElement?.textContent).toBe("Close");
    let prevented = false;
    reopened?.dispatch("keydown", {
      key: "Escape",
      shiftKey: false,
      preventDefault: () => {
        prevented = true;
      },
    });
    expect(prevented).toBe(true);
    expect(document.body.children).toEqual([opener, pixiCanvas]);
    expect(document.activeElement).toBe(opener);
  });

  it("contains rejected browser manager actions", async () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    store.remember(digestA, "compatibility");
    const model = createModCompatibilityUiController({
      decisionStore: store,
    }).managerModel([{ candidate: mod("Alpha", digestA) }]);
    const document = new FakeDocument();
    const ports = createBrowserModCompatibilityPorts(
      document as unknown as Document,
      document.body as unknown as HTMLElement,
    );
    ports.manager.show(model, {
      change: async () => {
        throw new Error("change failed");
      },
      forget: () => {
        throw new Error("forget failed");
      },
      forgetAll: () => {
        throw new Error("forget all failed");
      },
    });
    const overlay = document.body.children.at(-1);
    const change = findElement(
      overlay,
      (element) =>
        element.tagName === "BUTTON" && element.textContent === "Change",
    );
    const forget = findElement(
      overlay,
      (element) =>
        element.tagName === "BUTTON" && element.textContent === "Forget",
    );
    const forgetAll = findElement(
      overlay,
      (element) =>
        element.tagName === "BUTTON" &&
        element.textContent === MOD_COMPATIBILITY_FORGET_ALL_LABEL,
    );

    expect(() => change?.dispatch("click", uiEvent())).not.toThrow();
    expect(() => forget?.dispatch("click", uiEvent())).not.toThrow();
    expect(() => forgetAll?.dispatch("click", uiEvent())).not.toThrow();
    await microtask();
    await microtask();
    expect(document.body.children.at(-1)).toBe(overlay);
  });
});

describe("remembered compatibility manager", () => {
  it("separates remembered policy from active runtime badges", () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    store.remember(digestA, "compatibility", "2026-07-31T01:00:00.000Z");
    store.remember(digestB, "keep-optimizations", "2026-07-31T01:00:01.000Z");
    const controller = createModCompatibilityUiController({
      decisionStore: store,
    });

    const inactiveModel = controller.managerModel([
      { candidate: mod("Safe", digestA) },
      { candidate: mod("Risky", digestB) },
    ]);

    expect(inactiveModel.forgetAllLabel).toBe(
      MOD_COMPATIBILITY_FORGET_ALL_LABEL,
    );
    expect(inactiveModel.forgetAllLabel).toBe(
      "Regret it? Forget all remembered compatibility choices.",
    );
    expect(
      inactiveModel.rows.map((row) => [row.name, row.statusLabel]),
    ).toEqual([
      ["Risky", null],
      ["Safe", null],
    ]);

    const activeModel = controller.managerModel([
      {
        candidate: mod("Safe", digestA),
        status: "forced-compatibility",
      },
      {
        candidate: mod("Risky", digestB),
        status: "forced-unstable",
      },
    ]);
    expect(activeModel.rows.map((row) => [row.name, row.statusLabel])).toEqual([
      ["Risky", "Forced unstable"],
      ["Safe", "Forced compatibility"],
    ]);
  });

  it("shows an actionable restart notice without inventing runtime status", () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    store.remember(digestA, "compatibility");
    const controller = createModCompatibilityUiController({
      decisionStore: store,
    });

    const model = controller.managerModel([
      {
        candidate: mod("Source reader", digestA, true),
        restartRequired: true,
      },
    ]);

    expect(model.attentionMessage).toMatch(/loading is paused/iu);
    expect(model.attentionMessage).toMatch(/change or forget/iu);
    expect(model.attentionMessage).toMatch(/SourceMode original/iu);
    expect(model.attentionMessage).toMatch(/restart/iu);
    expect(model.rows[0]?.status).toBeNull();
    expect(model.rows[0]?.canChange).toBe(true);
  });

  it("supports manager Change, per-mod Forget, and Forget all only in compatibility storage", async () => {
    const storage = memoryStorage();
    storage.setItem("KD-save", "unchanged");
    const store = createStore(storage);
    store.remember(digestA, "compatibility");
    store.remember(digestB, "keep-optimizations");
    const dialogs = dialogHarness();
    const managers = managerHarness();
    const controller = createModCompatibilityUiController({
      decisionStore: store,
      dialog: dialogs.port,
      manager: managers.port,
    });
    controller.showManager([
      { candidate: mod("Alpha", digestA) },
      { candidate: mod("Beta", digestB) },
    ]);
    const initialActions = managers.presentations[0]?.actions;

    const changing = initialActions?.change(digestA);
    expect(dialogs.presentations.at(-1)?.model.modName).toBe("Alpha");
    dialogs.presentations.at(-1)?.actions.select("disable-mod", false);
    await changing;
    expect(store.lookup(digestA)?.choice).toBe("disable-mod");
    expect(managers.presentations.length).toBeGreaterThan(1);

    managers.presentations.at(-1)?.actions.forget(digestA);
    expect(store.lookup(digestA)).toBeUndefined();
    expect(store.lookup(digestB)?.choice).toBe("keep-optimizations");

    managers.presentations.at(-1)?.actions.forgetAll();
    expect(store.decisions()).toEqual([]);
    expect(storage.getItem("KD-save")).toBe("unchanged");

    const nextActivation = controller.request(mod("Alpha", digestA));
    expect(dialogs.presentations.at(-1)?.model.modName).toBe("Alpha");
    dialogs.presentations.at(-1)?.actions.dismiss();
    await nextActivation;
  });

  it("contains manager refresh failures while preserving explicit choices", async () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    store.remember(digestA, "compatibility");
    const dialogs = dialogHarness();
    let managerActions: ModCompatibilityManagerActions | undefined;
    let presentations = 0;
    const controller = createModCompatibilityUiController({
      decisionStore: store,
      dialog: dialogs.port,
      manager: {
        show(_model, actions) {
          presentations += 1;
          if (presentations > 1) {
            throw new Error("manager refresh failed");
          }
          managerActions = actions;
        },
      },
    });

    expect(() =>
      controller.showManager([{ candidate: mod("Alpha", digestA) }]),
    ).not.toThrow();
    const changing = managerActions?.change(digestA);
    dialogs.presentations.at(-1)?.actions.select("keep-optimizations", false);
    await expect(changing).resolves.toBeUndefined();
    expect(store.lookup(digestA)?.choice).toBe("keep-optimizations");
    expect(() => managerActions?.forget(digestA)).not.toThrow();
    expect(store.lookup(digestA)).toBeUndefined();
    expect(() => managerActions?.forgetAll()).not.toThrow();

    const broken = createModCompatibilityUiController({
      manager: {
        show() {
          throw new Error("initial manager presentation failed");
        },
      },
    });
    expect(() => broken.showManager()).not.toThrow();
  });
});

function mod(
  name: string,
  digest: string,
  restartRequired = false,
  reason = "Writes KDPathCache directly",
): ModCompatibilityCandidate {
  return {
    name,
    digest,
    findings: [
      {
        ruleId: "path-cache-write",
        confidence: "high",
        subsystem: restartRequired ? "source-optimizations" : "pathfinding",
        reason,
        restartRequired,
      },
    ],
  };
}

function createStore(storage: ModCompatibilityStorage) {
  return createModCompatibilityDecisionStore(storage, {
    kdVersion: "5.4.92",
    bundleSha256: bundle,
    hybridVersion: "0.1.2",
    ruleVersion: 1,
  });
}

function memoryStorage(): ModCompatibilityStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

function dialogHarness(): {
  readonly port: ModCompatibilityDialogPort;
  readonly presentations: Array<{
    readonly model: ModCompatibilityDialogModel;
    readonly actions: ModCompatibilityDialogActions;
  }>;
  readonly openCount: () => number;
  readonly maxOpen: () => number;
} {
  const presentations: Array<{
    readonly model: ModCompatibilityDialogModel;
    readonly actions: ModCompatibilityDialogActions;
  }> = [];
  let open = 0;
  let peak = 0;
  return {
    port: {
      show(model, actions) {
        presentations.push({ model, actions });
        open += 1;
        peak = Math.max(peak, open);
        let disposed = false;
        return {
          dispose() {
            if (!disposed) {
              disposed = true;
              open -= 1;
            }
          },
        };
      },
    },
    presentations,
    openCount: () => open,
    maxOpen: () => peak,
  };
}

function managerHarness(): {
  readonly port: ModCompatibilityManagerPort;
  readonly presentations: Array<{
    readonly model: ModCompatibilityManagerModel;
    readonly actions: ModCompatibilityManagerActions;
  }>;
} {
  const presentations: Array<{
    readonly model: ModCompatibilityManagerModel;
    readonly actions: ModCompatibilityManagerActions;
  }> = [];
  return {
    port: {
      show(model, actions) {
        presentations.push({ model, actions });
      },
    },
    presentations,
  };
}

function microtask(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

interface FakeUiEvent {
  readonly key?: string;
  readonly shiftKey?: boolean;
  preventDefault(): void;
}

class FakeElement {
  readonly tagName: string;
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  textContent = "";
  id = "";
  type = "";
  className = "";
  htmlFor = "";
  checked = false;
  disabled = false;
  readonly style: Record<string, string> = {};
  private readonly listeners = new Map<
    string,
    Set<(event: FakeUiEvent) => void>
  >();
  private parent: FakeElement | undefined;

  constructor(
    tagName: string,
    private readonly document: FakeDocument,
  ) {
    this.tagName = tagName.toUpperCase();
  }

  set innerHTML(_value: string) {
    throw new Error("Untrusted HTML interpolation is forbidden");
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(name: string, listener: (event: FakeUiEvent) => void): void {
    const listeners = this.listeners.get(name) ?? new Set();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(
    name: string,
    listener: (event: FakeUiEvent) => void,
  ): void {
    this.listeners.get(name)?.delete(listener);
  }

  dispatch(name: string, event: FakeUiEvent): void {
    for (const listener of this.listeners.get(name) ?? []) {
      listener(event);
    }
  }

  focus(): void {
    this.document.activeElement = this;
  }

  remove(): void {
    if (this.parent === undefined) {
      return;
    }
    const index = this.parent.children.indexOf(this);
    if (index >= 0) {
      this.parent.children.splice(index, 1);
    }
    this.parent = undefined;
  }
}

class FakeDocument {
  readonly body = new FakeElement("body", this);
  activeElement: FakeElement | null = null;

  createElement(name: string): FakeElement {
    return new FakeElement(name, this);
  }
}

function allElements(root: FakeElement | undefined): readonly FakeElement[] {
  if (root === undefined) {
    return [];
  }
  return [root, ...root.children.flatMap((child) => allElements(child))];
}

function allText(root: FakeElement | undefined): string {
  return allElements(root)
    .map((element) => element.textContent)
    .join("\n");
}

function findElement(
  root: FakeElement | undefined,
  predicate: (element: FakeElement) => boolean,
): FakeElement | undefined {
  return allElements(root).find(predicate);
}

function uiEvent(): FakeUiEvent {
  return {
    preventDefault() {},
  };
}
