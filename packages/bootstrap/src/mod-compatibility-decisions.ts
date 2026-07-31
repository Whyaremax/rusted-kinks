// SPDX-License-Identifier: MIT

export const MOD_COMPATIBILITY_RULE_VERSION = 1;
export const MOD_COMPATIBILITY_STORAGE_KEY =
  "KDHybridModCompatibilityDecisions";

export type ModCompatibilityChoice =
  "compatibility" | "keep-optimizations" | "disable-mod";

export type ModCompatibilityConfidence = "high" | "informational";

export type ModCompatibilitySubsystem =
  | "buff-event-index"
  | "enemy-position-cache"
  | "pathfinding"
  | "source-optimizations";

export interface ModCompatibilityContext {
  readonly kdVersion: string;
  readonly bundleSha256: string;
  readonly hybridVersion: string;
  readonly ruleVersion?: number;
}

export interface ModCompatibilityFinding {
  readonly ruleId: string;
  readonly confidence: ModCompatibilityConfidence;
  readonly subsystem: ModCompatibilitySubsystem;
  readonly reason: string;
  readonly restartRequired?: boolean;
}

export interface ModCompatibilityCandidate {
  readonly name: string;
  readonly digest: string;
  readonly findings: readonly ModCompatibilityFinding[];
}

export interface RememberedModCompatibilityDecision {
  readonly digest: string;
  readonly choice: ModCompatibilityChoice;
  readonly context: Required<ModCompatibilityContext>;
  readonly rememberedAt: string;
}

export interface ModCompatibilityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ModCompatibilityDecisionStore {
  lookup(digest: string): RememberedModCompatibilityDecision | undefined;
  remember(
    digest: string,
    choice: ModCompatibilityChoice,
    rememberedAt?: string,
  ): RememberedModCompatibilityDecision;
  forget(digest: string): boolean;
  forgetAll(): number;
  decisions(): readonly RememberedModCompatibilityDecision[];
}

export interface ModCompatibilitySessionInput {
  readonly candidate: ModCompatibilityCandidate;
  readonly choice?: ModCompatibilityChoice;
}

export interface ModCompatibilitySessionStatus {
  readonly disabledMods: readonly string[];
  readonly forcedUnstableMods: readonly string[];
  readonly compatibilityMods: readonly string[];
  readonly disabledSubsystems: readonly ModCompatibilitySubsystem[];
  readonly restartRequired: boolean;
}

interface StoredDecisionFile {
  readonly schema: 1;
  readonly decisions: readonly RememberedModCompatibilityDecision[];
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_REMEMBERED_DECISIONS = 512;
const CHOICES = new Set<ModCompatibilityChoice>([
  "compatibility",
  "keep-optimizations",
  "disable-mod",
]);
const SUBSYSTEM_ORDER = Object.freeze([
  "buff-event-index",
  "enemy-position-cache",
  "pathfinding",
  "source-optimizations",
] satisfies readonly ModCompatibilitySubsystem[]);

export function createModCompatibilityDecisionStore(
  storage: ModCompatibilityStorage,
  contextInput: ModCompatibilityContext,
  storageKey = MOD_COMPATIBILITY_STORAGE_KEY,
): ModCompatibilityDecisionStore {
  const context = normalizeContext(contextInput);
  let decisions = readDecisionFile(storage, storageKey);

  const persist = (): void => {
    if (decisions.length === 0) {
      storage.removeItem(storageKey);
      return;
    }
    const file: StoredDecisionFile = {
      schema: 1,
      decisions,
    };
    storage.setItem(storageKey, JSON.stringify(file));
  };

  const api: ModCompatibilityDecisionStore = {
    lookup(digestInput: string) {
      const digest = normalizeDigest(digestInput);
      return decisions.find(
        (decision) =>
          decision.digest === digest &&
          contextsEqual(decision.context, context),
      );
    },
    remember(
      digestInput: string,
      choice: ModCompatibilityChoice,
      rememberedAt = new Date().toISOString(),
    ) {
      const digest = normalizeDigest(digestInput);
      if (!CHOICES.has(choice)) {
        throw new RangeError(`Unknown mod compatibility choice: ${choice}`);
      }
      if (!isIsoTimestamp(rememberedAt)) {
        throw new RangeError("rememberedAt must be an ISO-8601 timestamp");
      }
      const decision = freezeDecision({
        digest,
        choice,
        context,
        rememberedAt,
      });
      decisions = Object.freeze(
        [
          ...decisions.filter(
            (candidate) =>
              candidate.digest !== digest ||
              !contextsEqual(candidate.context, context),
          ),
          decision,
        ].slice(-MAX_REMEMBERED_DECISIONS),
      );
      persist();
      return decision;
    },
    forget(digestInput: string) {
      const digest = normalizeDigest(digestInput);
      const retained = decisions.filter(
        (decision) => decision.digest !== digest,
      );
      if (retained.length === decisions.length) {
        return false;
      }
      decisions = Object.freeze(retained);
      persist();
      return true;
    },
    forgetAll() {
      const removed = decisions.length;
      decisions = Object.freeze([]);
      persist();
      return removed;
    },
    decisions: () => decisions,
  };
  return Object.freeze(api);
}

/**
 * Resolves one activation point without touching KD's save or mod archives.
 *
 * A missing decision deliberately means compatibility mode. A force-load
 * decision never overrides another loaded mod's compatibility requirement for
 * the same subsystem.
 */
export function resolveModCompatibilitySession(
  inputs: readonly ModCompatibilitySessionInput[],
): ModCompatibilitySessionStatus {
  const disabledMods = new Set<string>();
  const forcedUnstableMods = new Set<string>();
  const compatibilityMods = new Set<string>();
  const disabledSubsystems = new Set<ModCompatibilitySubsystem>();
  let restartRequired = false;

  for (const input of inputs) {
    validateCandidate(input.candidate);
    const highConfidence = input.candidate.findings.filter(
      (finding) => finding.confidence === "high",
    );
    if (highConfidence.length === 0) {
      continue;
    }
    const choice = input.choice ?? "compatibility";
    if (!CHOICES.has(choice)) {
      throw new RangeError(`Unknown mod compatibility choice: ${choice}`);
    }
    if (choice === "disable-mod") {
      disabledMods.add(input.candidate.digest);
      continue;
    }
    if (choice === "keep-optimizations") {
      forcedUnstableMods.add(input.candidate.digest);
      continue;
    }
    compatibilityMods.add(input.candidate.digest);
    for (const finding of highConfidence) {
      disabledSubsystems.add(finding.subsystem);
      restartRequired ||= finding.restartRequired === true;
    }
  }

  return Object.freeze({
    disabledMods: Object.freeze([...disabledMods].sort()),
    forcedUnstableMods: Object.freeze([...forcedUnstableMods].sort()),
    compatibilityMods: Object.freeze([...compatibilityMods].sort()),
    disabledSubsystems: Object.freeze(
      SUBSYSTEM_ORDER.filter((subsystem) => disabledSubsystems.has(subsystem)),
    ),
    restartRequired,
  });
}

function normalizeContext(
  value: ModCompatibilityContext,
): Required<ModCompatibilityContext> {
  if (value.kdVersion.trim().length === 0) {
    throw new RangeError("kdVersion is required");
  }
  if (value.hybridVersion.trim().length === 0) {
    throw new RangeError("hybridVersion is required");
  }
  const ruleVersion = value.ruleVersion ?? MOD_COMPATIBILITY_RULE_VERSION;
  if (!Number.isSafeInteger(ruleVersion) || ruleVersion < 1) {
    throw new RangeError("ruleVersion must be a positive integer");
  }
  return Object.freeze({
    kdVersion: value.kdVersion,
    bundleSha256: normalizeDigest(value.bundleSha256),
    hybridVersion: value.hybridVersion,
    ruleVersion,
  });
}

function validateCandidate(candidate: ModCompatibilityCandidate): void {
  if (candidate.name.trim().length === 0) {
    throw new RangeError("mod name is required");
  }
  normalizeDigest(candidate.digest);
  for (const finding of candidate.findings) {
    if (finding.ruleId.trim().length === 0) {
      throw new RangeError("compatibility finding ruleId is required");
    }
    if (finding.reason.trim().length === 0) {
      throw new RangeError("compatibility finding reason is required");
    }
    if (
      finding.confidence !== "high" &&
      finding.confidence !== "informational"
    ) {
      throw new RangeError(
        `Unknown compatibility confidence: ${finding.confidence}`,
      );
    }
    if (!SUBSYSTEM_ORDER.includes(finding.subsystem)) {
      throw new RangeError(
        `Unknown compatibility subsystem: ${finding.subsystem}`,
      );
    }
  }
}

function readDecisionFile(
  storage: ModCompatibilityStorage,
  storageKey: string,
): readonly RememberedModCompatibilityDecision[] {
  let parsed: unknown;
  try {
    const source = storage.getItem(storageKey);
    if (source === null) {
      return Object.freeze([]);
    }
    parsed = JSON.parse(source);
  } catch {
    return Object.freeze([]);
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { readonly schema?: unknown }).schema !== 1 ||
    !Array.isArray((parsed as { readonly decisions?: unknown }).decisions)
  ) {
    return Object.freeze([]);
  }
  const result = new Map<string, RememberedModCompatibilityDecision>();
  for (const candidate of (
    parsed as { readonly decisions: readonly unknown[] }
  ).decisions.slice(-MAX_REMEMBERED_DECISIONS)) {
    const decision = parseDecision(candidate);
    if (decision !== undefined) {
      result.set(decisionIdentity(decision), decision);
    }
  }
  return Object.freeze([...result.values()]);
}

function parseDecision(
  value: unknown,
): RememberedModCompatibilityDecision | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const candidate = value as {
    readonly digest?: unknown;
    readonly choice?: unknown;
    readonly context?: unknown;
    readonly rememberedAt?: unknown;
  };
  if (
    typeof candidate.digest !== "string" ||
    typeof candidate.choice !== "string" ||
    !CHOICES.has(candidate.choice as ModCompatibilityChoice) ||
    typeof candidate.rememberedAt !== "string" ||
    !isIsoTimestamp(candidate.rememberedAt) ||
    typeof candidate.context !== "object" ||
    candidate.context === null
  ) {
    return undefined;
  }
  const rawContext = candidate.context as {
    readonly kdVersion?: unknown;
    readonly bundleSha256?: unknown;
    readonly hybridVersion?: unknown;
    readonly ruleVersion?: unknown;
  };
  if (
    typeof rawContext.kdVersion !== "string" ||
    typeof rawContext.bundleSha256 !== "string" ||
    typeof rawContext.hybridVersion !== "string" ||
    typeof rawContext.ruleVersion !== "number"
  ) {
    return undefined;
  }
  try {
    return freezeDecision({
      digest: normalizeDigest(candidate.digest),
      choice: candidate.choice as ModCompatibilityChoice,
      context: normalizeContext({
        kdVersion: rawContext.kdVersion,
        bundleSha256: rawContext.bundleSha256,
        hybridVersion: rawContext.hybridVersion,
        ruleVersion: rawContext.ruleVersion,
      }),
      rememberedAt: candidate.rememberedAt,
    });
  } catch {
    return undefined;
  }
}

function freezeDecision(
  value: RememberedModCompatibilityDecision,
): RememberedModCompatibilityDecision {
  return Object.freeze({
    ...value,
    context: Object.freeze({ ...value.context }),
  });
}

function contextsEqual(
  left: Required<ModCompatibilityContext>,
  right: Required<ModCompatibilityContext>,
): boolean {
  return (
    left.kdVersion === right.kdVersion &&
    left.bundleSha256 === right.bundleSha256 &&
    left.hybridVersion === right.hybridVersion &&
    left.ruleVersion === right.ruleVersion
  );
}

function decisionIdentity(
  decision: RememberedModCompatibilityDecision,
): string {
  return [
    decision.digest,
    decision.context.kdVersion,
    decision.context.bundleSha256,
    decision.context.hybridVersion,
    decision.context.ruleVersion,
  ].join("\u0000");
}

function normalizeDigest(value: string): string {
  const digest = value.toLowerCase();
  if (!SHA256_PATTERN.test(digest)) {
    throw new RangeError("digest must be a 64-character SHA-256 hex value");
  }
  return digest;
}

function isIsoTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}
