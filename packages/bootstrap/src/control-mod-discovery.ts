import {
  installKDHybridControlMod,
  type KDHybridControlModHandle
} from "./control-mod.js";

const BRIDGE_FILE_NAME = "KDHybridBridge.zip";
const DISCOVERY_TIMEOUT_MS = 15_000;

interface PhysicalMod {
  readonly base?: unknown;
  readonly file?: unknown;
}

interface KinkyDungeonApi {
  getMods?(): Promise<readonly PhysicalMod[]>;
}

interface DiscoveryTarget {
  kdAPI?: KinkyDungeonApi;
}

interface ModLoadOrderEntry {
  readonly name?: unknown;
}

declare let KDLoading: boolean;
declare let KDModLoadOrder: ModLoadOrderEntry[];
declare let KDToggles: { readonly AutoLoadMods?: unknown };
declare function KDLoadMod(files: File[]): Promise<void>;

export interface KinkyDungeonControlModDiscoveryBindings {
  loadOrderNames(): readonly string[];
  getPhysicalMods(): Promise<readonly PhysicalMod[]>;
  loadMods(files: File[]): Promise<void>;
  installControlMod(): KDHybridControlModHandle;
}

export type KinkyDungeonControlModDiscoveryResult =
  | "ready"
  | "bridge-missing";

export interface KinkyDungeonControlModDiscoveryStatus {
  readonly state: "waiting" | "ready" | "bridge-missing" | "failed" | "disposed";
  readonly attempts: number;
  readonly lastError: string | null;
}

export interface KinkyDungeonControlModDiscoveryHandle {
  readonly ready: Promise<boolean>;
  status(): KinkyDungeonControlModDiscoveryStatus;
  dispose(): void;
}

export interface KinkyDungeonControlModDiscoveryOptions {
  readonly resolveBindings?: () =>
    | KinkyDungeonControlModDiscoveryBindings
    | null;
  readonly now?: () => number;
  readonly schedule?: (callback: () => void, delayMs: number) => unknown;
  readonly cancel?: (token: unknown) => void;
  readonly timeoutMs?: number;
}

export async function discoverKinkyDungeonControlModOnce(
  bindings: KinkyDungeonControlModDiscoveryBindings
): Promise<KinkyDungeonControlModDiscoveryResult> {
  if (bindings.loadOrderNames().includes(BRIDGE_FILE_NAME)) {
    bindings.installControlMod();
    return "ready";
  }

  const physicalMods = await bindings.getPhysicalMods();
  const bridge = physicalMods.find(
    (mod) => mod.base === BRIDGE_FILE_NAME && mod.file !== undefined
  );
  if (bridge === undefined) {
    return "bridge-missing";
  }

  const bytes = new Blob([bridge.file as BlobPart], {
    type: "application/octet-stream"
  });
  const file = new File([bytes], BRIDGE_FILE_NAME, {
    type: "application/zip"
  });
  await bindings.loadMods([file]);
  if (!bindings.loadOrderNames().includes(BRIDGE_FILE_NAME)) {
    throw new Error("KD did not register the Hybrid bridge mod");
  }
  bindings.installControlMod();
  return "ready";
}

export function installKinkyDungeonControlModDiscovery(
  options: KinkyDungeonControlModDiscoveryOptions = {}
): KinkyDungeonControlModDiscoveryHandle {
  const resolveBindings = options.resolveBindings ?? resolveGlobalBindings;
  const now = options.now ?? Date.now;
  const schedule =
    options.schedule ??
    ((callback: () => void, delayMs: number) =>
      globalThis.setTimeout(callback, delayMs));
  const cancel =
    options.cancel ??
    ((token: unknown) =>
      globalThis.clearTimeout(token as ReturnType<typeof setTimeout>));
  const deadline = now() + (options.timeoutMs ?? DISCOVERY_TIMEOUT_MS);
  let state: KinkyDungeonControlModDiscoveryStatus["state"] = "waiting";
  let attempts = 0;
  let lastError: string | null = null;
  let scheduled: unknown;
  let disposed = false;
  let resolveReady: ((ready: boolean) => void) | undefined;
  const ready = new Promise<boolean>((resolve) => {
    resolveReady = resolve;
  });

  const finish = (
    nextState: KinkyDungeonControlModDiscoveryStatus["state"],
    value: boolean
  ): void => {
    state = nextState;
    resolveReady?.(value);
    resolveReady = undefined;
  };

  const tryDiscovery = async (): Promise<void> => {
    if (disposed) {
      finish("disposed", false);
      return;
    }
    const bindings = resolveBindings();
    if (bindings === null) {
      if (now() >= deadline) {
        finish("failed", false);
        return;
      }
      attempts += 1;
      scheduled = schedule(() => {
        void tryDiscovery();
      }, attempts < 4 ? 0 : 25);
      return;
    }
    attempts += 1;
    try {
      const result = await discoverKinkyDungeonControlModOnce(bindings);
      finish(result, result === "ready");
    } catch (error) {
      lastError = errorMessage(error);
      if (now() >= deadline) {
        finish("failed", false);
        return;
      }
      scheduled = schedule(() => {
        void tryDiscovery();
      }, 25);
    }
  };

  const handle: KinkyDungeonControlModDiscoveryHandle = Object.freeze({
    ready,
    status: () =>
      Object.freeze({
        state,
        attempts,
        lastError
      }),
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      if (scheduled !== undefined) {
        cancel(scheduled);
        scheduled = undefined;
      }
      finish("disposed", false);
    }
  });

  void tryDiscovery();
  return handle;
}

function resolveGlobalBindings(): KinkyDungeonControlModDiscoveryBindings | null {
  try {
    const target = globalThis as DiscoveryTarget;
    if (
      typeof KDLoadMod !== "function" ||
      typeof KDLoading === "undefined" ||
      KDLoading ||
      typeof KDModLoadOrder === "undefined" ||
      typeof KDToggles === "undefined" ||
      KDToggles.AutoLoadMods !== false ||
      typeof target.kdAPI?.getMods !== "function"
    ) {
      return null;
    }
    return {
      loadOrderNames: () =>
        KDModLoadOrder.flatMap((entry) =>
          typeof entry.name === "string" ? [entry.name] : []
        ),
      getPhysicalMods: () => target.kdAPI!.getMods!(),
      loadMods: (files: File[]) => KDLoadMod(files),
      installControlMod: () => installKDHybridControlMod()
    };
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
