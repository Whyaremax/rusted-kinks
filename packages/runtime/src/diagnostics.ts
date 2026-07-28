import { stableHash } from "./signatures.js";

const BLOCKED_KEYS =
  /save|profile|player.?name|character|inventory|restraint|token|cookie|secret|password|authorization|source|asset.?content/iu;
const PATH =
  /(?:[A-Za-z]:\\(?:[^\\\s"']+\\)*[^\\\s"']+|\/(?:Users|home|var|tmp|opt|mnt)\/[^\s"']+)/gu;
const URL_PATTERN = /https?:\/\/[^\s"']+/gu;
const TOKEN =
  /\b(?:bearer\s+)?[A-Za-z0-9_-]{24,}(?:\.[A-Za-z0-9_-]{8,}){0,2}\b/giu;

export interface DiagnosticMod {
  readonly name?: string;
  readonly version?: string;
  readonly capabilities?: readonly string[];
  readonly systems?: readonly string[];
  readonly kind?: "javascript" | "wasm";
}

export interface DiagnosticInput {
  readonly runtime: Record<string, unknown>;
  readonly quality?: Record<string, unknown>;
  readonly bridge?: Record<string, unknown>;
  readonly mods?: readonly DiagnosticMod[];
  readonly extra?: Record<string, unknown>;
}

export interface DiagnosticDocument {
  readonly schema: 1;
  readonly generatedAt: string;
  readonly runtime: unknown;
  readonly quality?: unknown;
  readonly bridge?: unknown;
  readonly mods: readonly {
    readonly id: string;
    readonly kind: "javascript" | "wasm";
    readonly version: string | null;
    readonly capabilities: readonly string[];
    readonly systems: readonly string[];
  }[];
  readonly extra?: unknown;
}

export function createDiagnosticDocument(
  input: DiagnosticInput,
  now = new Date()
): DiagnosticDocument {
  const document: DiagnosticDocument = {
    schema: 1,
    generatedAt: now.toISOString(),
    runtime: scrubDiagnostics(input.runtime),
    mods: (input.mods ?? []).map((mod) => ({
      id: stableHash(`${mod.name ?? "unknown"}\u0000${mod.version ?? ""}`),
      kind: mod.kind ?? "javascript",
      version: mod.version === undefined ? null : scrubString(mod.version),
      capabilities: (mod.capabilities ?? []).map(scrubString),
      systems: (mod.systems ?? []).map(scrubString)
    }))
  };
  return Object.freeze({
    ...document,
    ...(input.quality === undefined
      ? {}
      : { quality: scrubDiagnostics(input.quality) }),
    ...(input.bridge === undefined ? {} : { bridge: scrubDiagnostics(input.bridge) }),
    ...(input.extra === undefined ? {} : { extra: scrubDiagnostics(input.extra) })
  });
}

export function exportDiagnosticJson(input: DiagnosticInput, now = new Date()): string {
  return JSON.stringify(createDiagnosticDocument(input, now), null, 2);
}

export function buildIssueUrl(
  repositoryUrl: string,
  diagnosticJson: string,
  title = "KD Hybrid compatibility report"
): string {
  const base = repositoryUrl.replace(/\/+$/u, "");
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/u.test(base)) {
    throw new TypeError("Issue target must be an HTTPS GitHub repository URL");
  }
  const body =
    "Please describe what happened. Preview and attach the local diagnostics JSON; " +
    "do not paste saves or game/mod source.\n\n" +
    `Diagnostic SHA: ${stableHash(diagnosticJson)}`;
  const url = new URL(`${base}/issues/new`);
  url.searchParams.set("title", title);
  url.searchParams.set("body", body);
  return url.toString();
}

export function scrubDiagnostics(value: unknown): unknown {
  return scrubValue(value, new WeakSet<object>(), 0);
}

function scrubValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (depth > 12) {
    return "<depth-limit>";
  }
  if (value === null || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return scrubString(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    return `<${typeof value}>`;
  }
  if (typeof value !== "object") {
    return String(value);
  }
  if (seen.has(value)) {
    return "<circular>";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 1_000).map((entry) => scrubValue(entry, seen, depth + 1));
  }
  const output: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 1_000);
  for (const [key, entry] of entries) {
    output[key] = BLOCKED_KEYS.test(key)
      ? "<redacted>"
      : scrubValue(entry, seen, depth + 1);
  }
  return output;
}

function scrubString(value: string): string {
  return value
    .slice(0, 8_192)
    .replace(PATH, "<path>")
    .replace(URL_PATTERN, "<url>")
    .replace(TOKEN, "<token>");
}
