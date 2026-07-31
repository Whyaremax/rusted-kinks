// SPDX-License-Identifier: MIT

import { Parser } from "acorn";

import {
  analyzeOfficialModSource,
  type OfficialModWriteKind,
} from "./official-mod-analyzer.js";
import type {
  LegacyModArchive,
  LegacyModArchiveEntry,
  LegacyModArchiveReadLimits,
  LegacyModArchiveReader,
} from "./mod-api-translator.js";

export const MOD_PREFLIGHT_SUBSYSTEMS = Object.freeze([
  "buff-event-index",
  "enemy-position-cache",
  "pathfinding",
  "source-optimizations",
] as const);

export type ModPreflightSubsystem = (typeof MOD_PREFLIGHT_SUBSYSTEMS)[number];
export type ModPreflightRiskLevel =
  "safe" | "informational" | "compatibility-required";
export type ModPreflightEvidenceKind =
  | "analysis-uncertainty"
  | "archive-boundary"
  | "direct-write"
  | "explicit-invalidator"
  | "function-replacement"
  | "function-source-inspection"
  | "read-reference"
  | "supported-api"
  | "target-mutation";

export interface ModPreflightEvidence {
  readonly subsystem: ModPreflightSubsystem;
  readonly level: Exclude<ModPreflightRiskLevel, "safe">;
  readonly kind: ModPreflightEvidenceKind;
  readonly entry: string | null;
  readonly offset: number | null;
  readonly path: string | null;
  readonly reason: string;
}

export interface ModPreflightSubsystemRisk {
  readonly subsystem: ModPreflightSubsystem;
  readonly level: ModPreflightRiskLevel;
  readonly evidence: readonly ModPreflightEvidence[];
}

export interface ModPreflightInventoryEntry {
  readonly filename: string;
  readonly directory: boolean;
  readonly uncompressedBytes: number;
  readonly kind: "directory" | "script" | "declarative";
  readonly scriptType: "javascript" | "kscript" | null;
  readonly analysis: "not-executable" | "analyzed" | "compatibility-required";
  readonly reason: string | null;
}

export interface ModPreflightReport {
  readonly version: 1;
  readonly name: string;
  readonly digestSha256: string | null;
  readonly archiveBytes: number;
  readonly level: ModPreflightRiskLevel;
  readonly requiresCompatibilityDecision: boolean;
  readonly inventory: readonly ModPreflightInventoryEntry[];
  readonly risks: readonly ModPreflightSubsystemRisk[];
}

export interface ModPreflightLimits {
  readonly maxArchiveBytes: number;
  readonly maxEntries: number;
  readonly maxScriptFiles: number;
  readonly maxScriptBytes: number;
  readonly maxTotalScriptBytes: number;
  readonly maxAstNodesPerScript: number;
  readonly maxTotalAstNodes: number;
  readonly maxEvidencePerSubsystem: number;
  readonly maxEvidenceTotal: number;
}

export interface ModPreflightScannerOptions {
  readonly readArchive: LegacyModArchiveReader;
  readonly digest?: (blob: Blob) => Promise<string>;
  readonly limits?: Partial<ModPreflightLimits>;
}

export interface ModPreflightScanner {
  readonly limits: ModPreflightLimits;
  scan(archive: LegacyModArchive): Promise<ModPreflightReport>;
}

interface AstNode {
  readonly type: string;
  readonly start?: unknown;
  readonly [key: string]: unknown;
}

interface MutableInventoryEntry {
  filename: string;
  directory: boolean;
  uncompressedBytes: number;
  kind: "directory" | "script" | "declarative";
  scriptType: "javascript" | "kscript" | null;
  analysis: "not-executable" | "analyzed" | "compatibility-required";
  reason: string | null;
  source?: string;
  sourceBytes?: number;
}

interface EvidenceCollector {
  readonly values: ModPreflightEvidence[];
  readonly maxPerSubsystem: number;
  readonly maxTotal: number;
  readonly truncatedSubsystems: Set<ModPreflightSubsystem>;
  globalTruncated: boolean;
}

interface AstCollection {
  readonly nodes: readonly AstNode[];
  readonly truncated: boolean;
}

interface ScriptAnalysis {
  readonly reason: string | null;
  readonly astNodes: number;
}

const DEFAULT_LIMITS = Object.freeze({
  maxArchiveBytes: 128 * 1024 * 1024,
  maxEntries: 8_192,
  maxScriptFiles: 256,
  maxScriptBytes: 1 * 1024 * 1024,
  maxTotalScriptBytes: 8 * 1024 * 1024,
  maxAstNodesPerScript: 50_000,
  maxTotalAstNodes: 200_000,
  maxEvidencePerSubsystem: 128,
  maxEvidenceTotal: 256,
}) satisfies ModPreflightLimits;

const GLOBAL_ALIASES = new Set(["globalThis", "self", "window"]);
const COLLECTION_MUTATORS = new Set([
  "add",
  "clear",
  "delete",
  "pop",
  "push",
  "reverse",
  "set",
  "shift",
  "sort",
  "splice",
  "unshift",
]);
const REFLECTIVE_MUTATORS = new Set([
  "Object.assign",
  "Object.defineProperties",
  "Object.defineProperty",
  "Object.setPrototypeOf",
  "Reflect.defineProperty",
  "Reflect.deleteProperty",
  "Reflect.set",
  "Reflect.setPrototypeOf",
]);
const BUFF_SUPPORTED_APIS = new Set([
  "KDApplyBuff",
  "KinkyDungeonApplyBuffToEntity",
]);
const BUFF_INVALIDATOR = "KDHybridInvalidateBuffEventIndex";
const ENEMY_CACHE_ROOTS = new Set(["KDEnemyCache", "KDUpdateEnemyCache"]);
const ENEMY_CACHE_FUNCTIONS = new Set([
  "KDMoveEntity",
  "KDNearbyEnemies",
  "KinkyDungeonFindMaster",
  "KinkyDungeonUpdateEnemies",
]);
const ENTITY_RESULT_FUNCTIONS = new Set([
  "KDGetEnemyCache",
  "KinkyDungeonEnemyAt",
  "KinkyDungeonEntityAt",
  "KinkyDungeonFindMaster",
]);
const ENTITY_COLLECTION_PATHS = new Set([
  "KDMapData.Entities",
  "KinkyDungeonEntities",
]);
const PATH_CACHE_ROOTS = new Set(["KDPathCache", "KDPathCacheIgnoreLocks"]);
const PATH_FUNCTIONS = new Set([
  "KDSetPathfindCache",
  "KinkyDungeonFindPath",
  "KinkyDungeonGetPath",
]);
const SOURCE_PATCHED_FUNCTIONS = new Set([
  "KDCheckMapTileFilling",
  "KDCreateBoringness",
  "KDGetRestraintsEligible",
  "KDHelpless",
  "KD_PasteTile",
  "KinkyDungeonFindPath",
  "KinkyDungeonGetAccessible",
  "KinkyDungeonGetAccessibleRoom",
  "KinkyDungeonNearestPlayer",
  "KinkyDungeonPlaceDoors",
]);
const SOURCE_CONTROL_ROOTS = new Set([
  "KDHybridSourcePatchControl",
  "KDHybridSourcePatches",
]);
const GRID_ROOTS = new Set([
  "KDMapData",
  "KinkyDungeonGrid",
  "KinkyDungeonGridSize",
  "KinkyDungeonGridWidth",
  "KinkyDungeonGridHeight",
]);
const GRID_MEMBERS = new Set([
  "Grid",
  "GridHeight",
  "GridWidth",
  "Tiles",
  "Traffic",
]);

export function createModPreflightScanner(
  options: ModPreflightScannerOptions,
): ModPreflightScanner {
  if (typeof options?.readArchive !== "function") {
    throw new TypeError("A pre-evaluation archive reader is required");
  }
  const limits = freezeLimits(options.limits);
  const digest = options.digest ?? sha256Blob;
  const readLimits = Object.freeze({
    maxEntries: limits.maxEntries,
    maxExecutableFiles: limits.maxScriptFiles,
    maxExecutableBytes: limits.maxScriptBytes,
    maxTotalExecutableBytes: limits.maxTotalScriptBytes,
  }) satisfies LegacyModArchiveReadLimits;

  return Object.freeze({
    limits,
    async scan(archive: LegacyModArchive): Promise<ModPreflightReport> {
      const name = normalizeArchiveName(archive?.name);
      if (!isBlobLike(archive?.blob)) {
        return boundaryReport(name, 0, null, "invalid-archive-object");
      }
      const archiveBytes = archive.blob.size;
      if (
        !Number.isSafeInteger(archiveBytes) ||
        archiveBytes < 0 ||
        archiveBytes > limits.maxArchiveBytes
      ) {
        return boundaryReport(
          name,
          Number.isFinite(archiveBytes) ? archiveBytes : 0,
          null,
          "archive-size-limit",
        );
      }

      let digestSha256: string;
      try {
        digestSha256 = (await digest(archive.blob)).toLowerCase();
      } catch {
        return boundaryReport(name, archiveBytes, null, "archive-digest-error");
      }
      if (!/^[a-f0-9]{64}$/u.test(digestSha256)) {
        return boundaryReport(
          name,
          archiveBytes,
          null,
          "invalid-archive-digest",
        );
      }

      let entries: readonly LegacyModArchiveEntry[];
      try {
        entries = await options.readArchive(archive, readLimits);
      } catch {
        return boundaryReport(
          name,
          archiveBytes,
          digestSha256,
          "archive-read-error",
        );
      }
      return inspectArchiveEntries(
        name,
        archiveBytes,
        digestSha256,
        entries,
        limits,
      );
    },
  });
}

function inspectArchiveEntries(
  name: string,
  archiveBytes: number,
  digestSha256: string,
  entries: readonly LegacyModArchiveEntry[],
  limits: ModPreflightLimits,
): ModPreflightReport {
  const evidence = createEvidenceCollector(limits);
  if (!Array.isArray(entries)) {
    return boundaryReport(
      name,
      archiveBytes,
      digestSha256,
      "invalid-entry-list",
    );
  }
  if (entries.length > limits.maxEntries) {
    return boundaryReport(
      name,
      archiveBytes,
      digestSha256,
      "archive-entry-count-limit",
    );
  }

  const inventory: MutableInventoryEntry[] = [];
  const seenFilenames = new Set<string>();
  let scriptFiles = 0;
  let totalScriptBytes = 0;
  let totalAstNodes = 0;
  let globalScriptLimitExceeded = false;

  for (let index = 0; index < entries.length; index += 1) {
    const rawEntry = entries[index];
    if (!isArchiveEntry(rawEntry)) {
      const syntheticName = `<invalid-entry-${index
        .toString()
        .padStart(4, "0")}>`;
      inventory.push({
        filename: syntheticName,
        directory: false,
        uncompressedBytes: 0,
        kind: "declarative",
        scriptType: null,
        analysis: "compatibility-required",
        reason: "invalid-archive-entry",
      });
      addUncertainty(
        evidence,
        syntheticName,
        null,
        "invalid-archive-entry",
        "archive-boundary",
      );
      continue;
    }

    const filename = rawEntry.filename;
    const scriptType = executableScriptType(filename);
    const kind = rawEntry.directory
      ? "directory"
      : scriptType === null
        ? "declarative"
        : "script";
    const inventoryEntry: MutableInventoryEntry = {
      filename,
      directory: rawEntry.directory,
      uncompressedBytes: rawEntry.uncompressedBytes,
      kind,
      scriptType,
      analysis: kind === "script" ? "analyzed" : "not-executable",
      reason: null,
    };
    inventory.push(inventoryEntry);

    if (!isSafeArchiveFilename(filename)) {
      inventoryEntry.analysis = "compatibility-required";
      inventoryEntry.reason = "unsafe-archive-filename";
      addUncertainty(
        evidence,
        filename,
        null,
        "unsafe-archive-filename",
        "archive-boundary",
      );
    }
    const lookupKey = archiveLookupKey(filename);
    if (seenFilenames.has(lookupKey)) {
      inventoryEntry.analysis = "compatibility-required";
      inventoryEntry.reason ??= "duplicate-archive-entry";
      addUncertainty(
        evidence,
        filename,
        null,
        "duplicate-archive-entry",
        "archive-boundary",
      );
    }
    seenFilenames.add(lookupKey);

    if (kind !== "script") {
      continue;
    }
    scriptFiles += 1;
    if (typeof rawEntry.source !== "string") {
      inventoryEntry.analysis = "compatibility-required";
      inventoryEntry.reason ??= "missing-script-source";
      addUncertainty(
        evidence,
        filename,
        null,
        "missing-script-source",
        "analysis-uncertainty",
      );
      continue;
    }
    if (rawEntry.source.includes("\0")) {
      inventoryEntry.analysis = "compatibility-required";
      inventoryEntry.reason ??= "script-source-contains-null";
      addUncertainty(
        evidence,
        filename,
        null,
        "script-source-contains-null",
        "analysis-uncertainty",
      );
      continue;
    }

    const sourceBytes = utf8LengthUpTo(rawEntry.source, limits.maxScriptBytes);
    inventoryEntry.sourceBytes = sourceBytes;
    if (
      rawEntry.uncompressedBytes > limits.maxScriptBytes ||
      sourceBytes > limits.maxScriptBytes
    ) {
      inventoryEntry.analysis = "compatibility-required";
      inventoryEntry.reason ??= "script-size-limit";
      addUncertainty(
        evidence,
        filename,
        null,
        "script-size-limit",
        "archive-boundary",
      );
      continue;
    }
    totalScriptBytes += Math.max(rawEntry.uncompressedBytes, sourceBytes);
    inventoryEntry.source = rawEntry.source;
  }

  if (
    scriptFiles > limits.maxScriptFiles ||
    totalScriptBytes > limits.maxTotalScriptBytes
  ) {
    globalScriptLimitExceeded = true;
    addUncertainty(
      evidence,
      null,
      null,
      scriptFiles > limits.maxScriptFiles
        ? "script-file-count-limit"
        : "total-script-size-limit",
      "archive-boundary",
    );
  }

  const orderedInventory = inventory.sort((left, right) =>
    ordinalCompare(left.filename, right.filename),
  );
  if (!globalScriptLimitExceeded) {
    for (const entry of orderedInventory) {
      if (entry.kind !== "script" || entry.source === undefined) {
        continue;
      }
      const remainingAstNodes = limits.maxTotalAstNodes - totalAstNodes;
      if (remainingAstNodes <= 0) {
        addUncertainty(
          evidence,
          entry.filename,
          null,
          "archive-ast-node-limit",
          "analysis-uncertainty",
        );
        entry.analysis = "compatibility-required";
        entry.reason ??= "archive-ast-node-limit";
        continue;
      }
      const analysis = analyzeScript(
        entry.filename,
        entry.source,
        evidence,
        Math.min(limits.maxAstNodesPerScript, remainingAstNodes),
        remainingAstNodes < limits.maxAstNodesPerScript
          ? "archive-ast-node-limit"
          : "script-ast-node-limit",
      );
      totalAstNodes += analysis.astNodes;
      if (analysis.reason !== null) {
        entry.analysis = "compatibility-required";
        entry.reason ??= analysis.reason;
      }
    }
  } else {
    for (const entry of orderedInventory) {
      if (entry.kind === "script") {
        entry.analysis = "compatibility-required";
        entry.reason ??= "archive-script-limit";
      }
    }
  }

  return freezeReport({
    version: 1,
    name,
    digestSha256,
    archiveBytes,
    inventory: orderedInventory.map(stripInventorySource),
    risks: createRisks(evidence.values),
  });
}

function analyzeScript(
  filename: string,
  source: string,
  evidence: EvidenceCollector,
  maxAstNodes: number,
  astLimitReason: "script-ast-node-limit" | "archive-ast-node-limit",
): ScriptAnalysis {
  let root: AstNode;
  try {
    root = Parser.parse(source, {
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      ecmaVersion: "latest",
      locations: false,
      sourceType: "script",
    }) as unknown as AstNode;
  } catch {
    addUncertainty(
      evidence,
      filename,
      null,
      "script-parse-error",
      "analysis-uncertainty",
    );
    return { reason: "script-parse-error", astNodes: 0 };
  }

  const collection = collectNodes(root, maxAstNodes);
  if (collection.truncated) {
    addUncertainty(
      evidence,
      filename,
      null,
      astLimitReason,
      "analysis-uncertainty",
    );
    return { reason: astLimitReason, astNodes: maxAstNodes };
  }
  const nodes = collection.nodes;
  const aliases = collectAliases(nodes);
  const entityAliases = collectEntityAliases(nodes, aliases);
  const officialAnalysis = analyzeOfficialModSource(source, {
    recognizeApi: () => true,
    isSensitiveWrite: (path, kind) =>
      classifyWrite(path, kind, false, entityAliases).length > 0,
  });

  for (const node of nodes) {
    if (node.type === "AssignmentExpression") {
      const path = resolvedWritePath(node.left, aliases);
      if (path !== null) {
        recordWrite(
          evidence,
          filename,
          nodeOffset(node),
          path,
          "assignment",
          isFunctionLike(node.right) ||
            !normalizeGlobalPath(path).includes("."),
          entityAliases,
        );
      }
      continue;
    }
    if (node.type === "UpdateExpression") {
      const path = resolvedWritePath(node.argument, aliases);
      if (path !== null) {
        recordWrite(
          evidence,
          filename,
          nodeOffset(node),
          path,
          "update",
          false,
          entityAliases,
        );
      }
      continue;
    }
    if (node.type === "UnaryExpression" && node.operator === "delete") {
      const path = resolvedWritePath(node.argument, aliases);
      if (path !== null) {
        recordWrite(
          evidence,
          filename,
          nodeOffset(node),
          path,
          "delete",
          false,
          entityAliases,
        );
      }
      continue;
    }
    if (
      node.type === "CallExpression" ||
      node.type === "OptionalCallExpression"
    ) {
      analyzeCall(node, aliases, entityAliases, filename, evidence);
      continue;
    }
    if (node.type === "BinaryExpression" || node.type === "TemplateLiteral") {
      analyzeSourceCoercion(node, aliases, filename, evidence);
    }
    if (
      node.type === "MemberExpression" ||
      node.type === "OptionalMemberExpression"
    ) {
      const path = resolvedPath(node, aliases);
      if (path !== null) {
        recordReadReference(evidence, filename, nodeOffset(node), path);
        if (
          path.endsWith(".toString") &&
          SOURCE_PATCHED_FUNCTIONS.has(pathParent(path) ?? "")
        ) {
          addEvidence(evidence, {
            subsystem: "source-optimizations",
            level: "compatibility-required",
            kind: "function-source-inspection",
            entry: filename,
            offset: nodeOffset(node),
            path,
            reason: "patched-function-source-inspection",
          });
        }
      }
    }
  }

  if (!officialAnalysis.compatible) {
    const reason = officialAnalysis.reason ?? "official-analysis-incompatible";
    if (reason.startsWith("source-sensitive-write:")) {
      const path = reason.slice("source-sensitive-write:".length);
      recordWrite(
        evidence,
        filename,
        null,
        path,
        "mutation",
        !path.includes("."),
        entityAliases,
      );
    } else {
      addUncertainty(evidence, filename, null, reason, "analysis-uncertainty");
    }
    return { reason, astNodes: nodes.length };
  }
  return {
    reason: evidence.values.some(
      (entry) =>
        entry.entry === filename && entry.level === "compatibility-required",
    )
      ? "subsystem-compatibility-risk"
      : null,
    astNodes: nodes.length,
  };
}

function analyzeCall(
  node: AstNode,
  aliases: ReadonlyMap<string, string>,
  entityAliases: ReadonlySet<string>,
  filename: string,
  evidence: EvidenceCollector,
): void {
  const callee = resolvedPath(node.callee, aliases);
  if (callee === null) {
    return;
  }
  const offset = nodeOffset(node);
  const argumentsValue = Array.isArray(node.arguments) ? node.arguments : [];

  if (callee === BUFF_INVALIDATOR) {
    addEvidence(evidence, {
      subsystem: "buff-event-index",
      level: "informational",
      kind: "explicit-invalidator",
      entry: filename,
      offset,
      path: callee,
      reason: "explicit-buff-index-invalidator",
    });
  } else if (BUFF_SUPPORTED_APIS.has(callee)) {
    addEvidence(evidence, {
      subsystem: "buff-event-index",
      level: "informational",
      kind: "supported-api",
      entry: filename,
      offset,
      path: callee,
      reason: "supported-buff-api",
    });
  }

  if (REFLECTIVE_MUTATORS.has(callee)) {
    const target = reflectiveMutationTarget(callee, argumentsValue, aliases);
    if (target !== null) {
      recordWrite(
        evidence,
        filename,
        offset,
        target,
        callee.includes("delete") ? "delete" : "mutation",
        callee.includes("define"),
        entityAliases,
      );
    }
  } else {
    const method = pathLeaf(callee);
    if (COLLECTION_MUTATORS.has(method)) {
      const target = resolvedPath(memberObject(node.callee), aliases);
      if (target !== null) {
        recordWrite(
          evidence,
          filename,
          offset,
          target,
          "mutation",
          false,
          entityAliases,
        );
      }
    }
  }

  if (
    callee === "Function.prototype.toString.call" ||
    callee === "Function.prototype.toString.apply"
  ) {
    const target = resolvedPath(argumentsValue[0], aliases);
    if (target !== null && SOURCE_PATCHED_FUNCTIONS.has(target)) {
      addEvidence(evidence, {
        subsystem: "source-optimizations",
        level: "compatibility-required",
        kind: "function-source-inspection",
        entry: filename,
        offset,
        path: target,
        reason: "patched-function-source-inspection",
      });
    }
  } else if (
    callee === "Reflect.apply" &&
    resolvedPath(argumentsValue[0], aliases) === "Function.prototype.toString"
  ) {
    const target = resolvedPath(argumentsValue[1], aliases);
    if (target !== null && SOURCE_PATCHED_FUNCTIONS.has(target)) {
      addEvidence(evidence, {
        subsystem: "source-optimizations",
        level: "compatibility-required",
        kind: "function-source-inspection",
        entry: filename,
        offset,
        path: target,
        reason: "patched-function-reflective-source-inspection",
      });
    }
  } else if (callee === "String") {
    const target = resolvedPath(argumentsValue[0], aliases);
    if (target !== null && SOURCE_PATCHED_FUNCTIONS.has(target)) {
      addEvidence(evidence, {
        subsystem: "source-optimizations",
        level: "compatibility-required",
        kind: "function-source-inspection",
        entry: filename,
        offset,
        path: target,
        reason: "patched-function-source-coercion",
      });
    }
  } else if (callee.endsWith(".toString")) {
    const target = pathParent(callee);
    if (target !== null && SOURCE_PATCHED_FUNCTIONS.has(target)) {
      addEvidence(evidence, {
        subsystem: "source-optimizations",
        level: "compatibility-required",
        kind: "function-source-inspection",
        entry: filename,
        offset,
        path: target,
        reason: "patched-function-source-inspection",
      });
    }
  }

  recordReadReference(evidence, filename, offset, callee);
}

function analyzeSourceCoercion(
  node: AstNode,
  aliases: ReadonlyMap<string, string>,
  filename: string,
  evidence: EvidenceCollector,
): void {
  const expressions: unknown[] = [];
  if (node.type === "BinaryExpression" && node.operator === "+") {
    expressions.push(node.left, node.right);
  } else if (
    node.type === "TemplateLiteral" &&
    Array.isArray(node.expressions)
  ) {
    expressions.push(...node.expressions);
  }

  for (const expression of expressions) {
    const target = resolvedPath(expression, aliases);
    if (target !== null && SOURCE_PATCHED_FUNCTIONS.has(target)) {
      addEvidence(evidence, {
        subsystem: "source-optimizations",
        level: "compatibility-required",
        kind: "function-source-inspection",
        entry: filename,
        offset: nodeOffset(node),
        path: target,
        reason:
          node.type === "TemplateLiteral"
            ? "patched-function-template-source-coercion"
            : "patched-function-concatenated-source-coercion",
      });
    }
  }
}

function reflectiveMutationTarget(
  callee: string,
  argumentsValue: readonly unknown[],
  aliases: ReadonlyMap<string, string>,
): string | null {
  const target = resolvedWritePath(argumentsValue[0], aliases);
  if (target === null) {
    return null;
  }
  if (
    callee === "Object.defineProperty" ||
    callee === "Reflect.defineProperty" ||
    callee === "Reflect.deleteProperty" ||
    callee === "Reflect.set"
  ) {
    const property = literalProperty(argumentsValue[1]);
    return property === null ? `${target}.[dynamic]` : `${target}.${property}`;
  }
  return target;
}

function recordWrite(
  evidence: EvidenceCollector,
  filename: string,
  offset: number | null,
  path: string,
  kind: OfficialModWriteKind,
  replacement: boolean,
  entityAliases: ReadonlySet<string>,
): void {
  for (const subsystem of classifyWrite(
    path,
    kind,
    replacement,
    entityAliases,
  )) {
    addEvidence(evidence, {
      subsystem,
      level: "compatibility-required",
      kind: replacement ? "function-replacement" : writeEvidenceKind(kind),
      entry: filename,
      offset,
      path,
      reason: writeReason(subsystem, replacement),
    });
  }
}

function classifyWrite(
  rawPath: string,
  _kind: OfficialModWriteKind,
  replacement: boolean,
  entityAliases: ReadonlySet<string>,
): readonly ModPreflightSubsystem[] {
  const path = normalizeGlobalPath(rawPath);
  const root = pathRoot(path);
  const leaf = pathLeaf(path);
  const segments = path.split(".");
  const result = new Set<ModPreflightSubsystem>();

  if (segments.includes("buffs")) {
    result.add("buff-event-index");
  }
  if (
    ENEMY_CACHE_ROOTS.has(root) ||
    (ENEMY_CACHE_FUNCTIONS.has(root) && replacement) ||
    isLikelyEntityPositionWrite(path, entityAliases)
  ) {
    result.add("enemy-position-cache");
  }
  if (
    PATH_CACHE_ROOTS.has(root) ||
    (PATH_FUNCTIONS.has(root) && replacement) ||
    isGridMutation(path)
  ) {
    result.add("pathfinding");
  }
  if (
    SOURCE_CONTROL_ROOTS.has(root) ||
    (SOURCE_PATCHED_FUNCTIONS.has(root) && replacement) ||
    (root === "Function" && segments.includes("toString"))
  ) {
    result.add("source-optimizations");
  }
  if (
    (leaf === "x" || leaf === "y") &&
    (isLikelyEntityName(pathRoot(path)) || entityAliases.has(pathRoot(path)))
  ) {
    result.add("enemy-position-cache");
  }
  return MOD_PREFLIGHT_SUBSYSTEMS.filter((subsystem) => result.has(subsystem));
}

function recordReadReference(
  evidence: EvidenceCollector,
  filename: string,
  offset: number | null,
  rawPath: string,
): void {
  const path = normalizeGlobalPath(rawPath);
  const root = pathRoot(path);
  if (path.split(".").includes("buffs")) {
    addEvidence(evidence, {
      subsystem: "buff-event-index",
      level: "informational",
      kind: "read-reference",
      entry: filename,
      offset,
      path,
      reason: "buff-state-reference",
    });
  }
  if (ENEMY_CACHE_ROOTS.has(root) || ENEMY_CACHE_FUNCTIONS.has(root)) {
    addEvidence(evidence, {
      subsystem: "enemy-position-cache",
      level: "informational",
      kind: "read-reference",
      entry: filename,
      offset,
      path,
      reason: "enemy-cache-reference",
    });
  }
  if (PATH_CACHE_ROOTS.has(root) || PATH_FUNCTIONS.has(root)) {
    addEvidence(evidence, {
      subsystem: "pathfinding",
      level: "informational",
      kind: "read-reference",
      entry: filename,
      offset,
      path,
      reason: "pathfinding-reference",
    });
  }
}

function addUncertainty(
  evidence: EvidenceCollector,
  filename: string | null,
  offset: number | null,
  reason: string,
  kind: "analysis-uncertainty" | "archive-boundary",
): void {
  for (const subsystem of MOD_PREFLIGHT_SUBSYSTEMS) {
    addEvidence(evidence, {
      subsystem,
      level: "compatibility-required",
      kind,
      entry: filename,
      offset,
      path: null,
      reason,
    });
  }
}

function addEvidence(
  evidence: EvidenceCollector,
  value: ModPreflightEvidence,
): void {
  if (
    evidence.values.some(
      (existing) =>
        existing.subsystem === value.subsystem &&
        existing.level === value.level &&
        existing.kind === value.kind &&
        existing.entry === value.entry &&
        existing.offset === value.offset &&
        existing.path === value.path &&
        existing.reason === value.reason,
    )
  ) {
    return;
  }
  if (
    evidence.globalTruncated ||
    evidence.truncatedSubsystems.has(value.subsystem)
  ) {
    return;
  }
  const subsystemCount = evidence.values.filter(
    (entry) => entry.subsystem === value.subsystem,
  ).length;
  if (subsystemCount >= evidence.maxPerSubsystem) {
    evidence.truncatedSubsystems.add(value.subsystem);
    forceTruncationEvidence(
      evidence,
      value.subsystem,
      value.entry,
      "subsystem-evidence-limit",
    );
    return;
  }
  if (evidence.values.length >= evidence.maxTotal) {
    evidence.globalTruncated = true;
    for (const subsystem of MOD_PREFLIGHT_SUBSYSTEMS) {
      forceTruncationEvidence(
        evidence,
        subsystem,
        value.entry,
        "archive-evidence-limit",
      );
    }
    return;
  }
  evidence.values.push(Object.freeze({ ...value }));
}

function createEvidenceCollector(
  limits: Pick<
    ModPreflightLimits,
    "maxEvidencePerSubsystem" | "maxEvidenceTotal"
  >,
): EvidenceCollector {
  return {
    values: [],
    maxPerSubsystem: limits.maxEvidencePerSubsystem,
    maxTotal: limits.maxEvidenceTotal,
    truncatedSubsystems: new Set(),
    globalTruncated: false,
  };
}

function forceTruncationEvidence(
  evidence: EvidenceCollector,
  subsystem: ModPreflightSubsystem,
  entry: string | null,
  reason: "subsystem-evidence-limit" | "archive-evidence-limit",
): void {
  if (
    evidence.values.some(
      (value) => value.subsystem === subsystem && value.reason === reason,
    )
  ) {
    return;
  }

  while (
    evidence.values.filter((value) => value.subsystem === subsystem).length >=
    evidence.maxPerSubsystem
  ) {
    removeLastEvidence(evidence.values, subsystem);
  }
  while (evidence.values.length >= evidence.maxTotal) {
    removeLastEvidence(evidence.values);
  }
  evidence.values.push(
    Object.freeze({
      subsystem,
      level: "compatibility-required",
      kind: "analysis-uncertainty",
      entry,
      offset: null,
      path: null,
      reason,
    }),
  );
}

function removeLastEvidence(
  evidence: ModPreflightEvidence[],
  subsystem?: ModPreflightSubsystem,
): void {
  let fallback = -1;
  for (let index = evidence.length - 1; index >= 0; index -= 1) {
    const value = evidence[index];
    if (value === undefined) {
      continue;
    }
    if (subsystem !== undefined && value.subsystem !== subsystem) {
      continue;
    }
    fallback = index;
    if (
      value.reason !== "archive-evidence-limit" &&
      value.reason !== "subsystem-evidence-limit"
    ) {
      evidence.splice(index, 1);
      return;
    }
  }
  if (fallback >= 0) {
    evidence.splice(fallback, 1);
  }
}

function createRisks(
  evidence: readonly ModPreflightEvidence[],
): readonly ModPreflightSubsystemRisk[] {
  return Object.freeze(
    MOD_PREFLIGHT_SUBSYSTEMS.map((subsystem) => {
      const subsystemEvidence = evidence
        .filter((entry) => entry.subsystem === subsystem)
        .sort(compareEvidence);
      const level = subsystemEvidence.some(
        (entry) => entry.level === "compatibility-required",
      )
        ? "compatibility-required"
        : subsystemEvidence.length > 0
          ? "informational"
          : "safe";
      return Object.freeze({
        subsystem,
        level,
        evidence: Object.freeze(subsystemEvidence),
      });
    }),
  );
}

function compareEvidence(
  left: ModPreflightEvidence,
  right: ModPreflightEvidence,
): number {
  return (
    ordinalCompare(left.entry ?? "", right.entry ?? "") ||
    (left.offset ?? -1) - (right.offset ?? -1) ||
    ordinalCompare(left.kind, right.kind) ||
    ordinalCompare(left.path ?? "", right.path ?? "") ||
    ordinalCompare(left.reason, right.reason)
  );
}

function collectNodes(root: AstNode, maxNodes: number): AstCollection {
  const result: AstNode[] = [];
  const pending: unknown[] = [root];
  const seen = new WeakSet<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        pending.push(value[index]);
      }
      continue;
    }
    if (!isAstNode(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    if (result.length >= maxNodes) {
      return { nodes: [], truncated: true };
    }
    result.push(value);
    for (const [key, child] of Object.entries(value).reverse()) {
      if (
        key !== "loc" &&
        key !== "start" &&
        key !== "end" &&
        key !== "extra" &&
        key !== "errors"
      ) {
        pending.push(child);
      }
    }
  }
  return {
    nodes: result.sort(
      (left, right) =>
        nodeOffset(left) - nodeOffset(right) ||
        ordinalCompare(left.type, right.type),
    ),
    truncated: false,
  };
}

function collectAliases(
  nodes: readonly AstNode[],
): ReadonlyMap<string, string> {
  const aliases = new Map<string, string>();
  for (const node of nodes) {
    if (
      node.type !== "VariableDeclarator" ||
      !isAstNode(node.id) ||
      node.id.type !== "Identifier" ||
      typeof node.id.name !== "string"
    ) {
      continue;
    }
    const target = staticPath(node.init);
    if (target !== null && target !== node.id.name) {
      aliases.set(node.id.name, normalizeGlobalPath(target));
    }
  }
  return aliases;
}

/**
 * Tracks only aliases with a direct, statically visible entity provenance.
 * Retained aliases hidden in containers, dynamic properties, or later
 * generated code remain intentionally unproven and must be handled by
 * conservative runtime fallback rather than by pretending this scan is exact.
 */
function collectEntityAliases(
  nodes: readonly AstNode[],
  aliases: ReadonlyMap<string, string>,
): ReadonlySet<string> {
  const result = new Set<string>();
  let changed = true;
  for (let pass = 0; pass < 8 && changed; pass += 1) {
    changed = false;
    for (const node of nodes) {
      if (
        node.type === "VariableDeclarator" &&
        isAstNode(node.id) &&
        node.id.type === "Identifier" &&
        typeof node.id.name === "string" &&
        isEntityExpression(node.init, aliases, result)
      ) {
        changed = addSetValue(result, node.id.name) || changed;
        continue;
      }
      if (
        node.type === "AssignmentExpression" &&
        node.operator === "=" &&
        isAstNode(node.left) &&
        node.left.type === "Identifier" &&
        typeof node.left.name === "string" &&
        isEntityExpression(node.right, aliases, result)
      ) {
        changed = addSetValue(result, node.left.name) || changed;
        continue;
      }
      if (node.type === "ForOfStatement") {
        const collection = resolvedPath(node.right, aliases);
        if (collection !== null && isEntityCollectionPath(collection)) {
          for (const name of boundIdentifierNames(node.left)) {
            changed = addSetValue(result, name) || changed;
          }
        }
        continue;
      }
      if (
        node.type === "CallExpression" ||
        node.type === "OptionalCallExpression"
      ) {
        const callee = resolvedPath(node.callee, aliases);
        if (
          callee === null ||
          pathLeaf(callee) !== "forEach" ||
          !isEntityCollectionPath(pathParent(callee) ?? "")
        ) {
          continue;
        }
        const callback = Array.isArray(node.arguments)
          ? node.arguments[0]
          : undefined;
        if (
          isAstNode(callback) &&
          (callback.type === "ArrowFunctionExpression" ||
            callback.type === "FunctionExpression") &&
          Array.isArray(callback.params)
        ) {
          for (const name of boundIdentifierNames(callback.params[0])) {
            changed = addSetValue(result, name) || changed;
          }
        }
      }
    }
  }
  return result;
}

function isEntityExpression(
  value: unknown,
  aliases: ReadonlyMap<string, string>,
  entityAliases: ReadonlySet<string>,
): boolean {
  const path = resolvedPath(value, aliases);
  if (path !== null) {
    const root = pathRoot(path);
    if (
      isLikelyEntityName(root) ||
      entityAliases.has(root) ||
      ENTITY_COLLECTION_PATHS.has(pathParent(path) ?? "")
    ) {
      return true;
    }
  }
  if (
    !isAstNode(value) ||
    (value.type !== "CallExpression" && value.type !== "OptionalCallExpression")
  ) {
    return false;
  }
  const callee = resolvedPath(value.callee, aliases);
  if (callee === null) {
    return false;
  }
  if (ENTITY_RESULT_FUNCTIONS.has(callee)) {
    return true;
  }
  const method = pathLeaf(callee);
  return (
    (method === "at" || method === "find") &&
    isEntityCollectionPath(pathParent(callee) ?? "")
  );
}

function isEntityCollectionPath(path: string): boolean {
  return (
    ENTITY_COLLECTION_PATHS.has(path) ||
    [...ENTITY_COLLECTION_PATHS].some((collection) =>
      path.startsWith(`${collection}.`),
    )
  );
}

function boundIdentifierNames(value: unknown): readonly string[] {
  if (!isAstNode(value)) {
    return [];
  }
  if (value.type === "Identifier" && typeof value.name === "string") {
    return [value.name];
  }
  if (
    value.type === "VariableDeclaration" &&
    Array.isArray(value.declarations)
  ) {
    return value.declarations.flatMap((declaration) =>
      isAstNode(declaration) ? boundIdentifierNames(declaration.id) : [],
    );
  }
  return [];
}

function addSetValue(values: Set<string>, value: string): boolean {
  if (values.has(value)) {
    return false;
  }
  values.add(value);
  return true;
}

function resolvedPath(
  value: unknown,
  aliases: ReadonlyMap<string, string>,
): string | null {
  const path = staticPath(value);
  return path === null
    ? null
    : normalizeGlobalPath(resolveAlias(path, aliases));
}

function resolvedWritePath(
  value: unknown,
  aliases: ReadonlyMap<string, string>,
): string | null {
  const exact = resolvedPath(value, aliases);
  if (exact !== null) {
    return exact;
  }
  if (
    isAstNode(value) &&
    (value.type === "MemberExpression" ||
      value.type === "OptionalMemberExpression")
  ) {
    const object = resolvedPath(value.object, aliases);
    if (object !== null) {
      return `${object}.[dynamic]`;
    }
  }
  return null;
}

function staticPath(value: unknown): string | null {
  if (!isAstNode(value)) {
    return null;
  }
  if (value.type === "Identifier") {
    return typeof value.name === "string" ? value.name : null;
  }
  if (value.type === "ThisExpression") {
    return "this";
  }
  if (
    value.type === "ChainExpression" ||
    value.type === "ParenthesizedExpression"
  ) {
    return staticPath(value.expression);
  }
  if (
    value.type !== "MemberExpression" &&
    value.type !== "OptionalMemberExpression"
  ) {
    return null;
  }
  const object = staticPath(value.object);
  const property = literalProperty(value.property, value.computed !== true);
  return object === null || property === null ? null : `${object}.${property}`;
}

function literalProperty(
  value: unknown,
  identifierAllowed = false,
): string | null {
  if (!isAstNode(value)) {
    return null;
  }
  if (
    identifierAllowed &&
    value.type === "Identifier" &&
    typeof value.name === "string"
  ) {
    return value.name;
  }
  if (
    value.type === "Literal" &&
    (typeof value.value === "string" ||
      typeof value.value === "number" ||
      typeof value.value === "boolean")
  ) {
    return String(value.value);
  }
  if (
    value.type === "TemplateLiteral" &&
    Array.isArray(value.expressions) &&
    value.expressions.length === 0 &&
    Array.isArray(value.quasis) &&
    value.quasis.length === 1
  ) {
    const quasi = value.quasis[0];
    if (isAstNode(quasi) && typeof quasi.value === "object" && quasi.value) {
      const cooked = (quasi.value as { readonly cooked?: unknown }).cooked;
      return typeof cooked === "string" ? cooked : null;
    }
  }
  return null;
}

function resolveAlias(
  path: string,
  aliases: ReadonlyMap<string, string>,
): string {
  let result = path;
  const seen = new Set<string>();
  for (let depth = 0; depth < 16; depth += 1) {
    const root = pathRoot(result);
    const replacement = aliases.get(root);
    if (replacement === undefined || seen.has(root)) {
      break;
    }
    seen.add(root);
    result = `${replacement}${result.slice(root.length)}`;
  }
  return result;
}

function normalizeGlobalPath(path: string): string {
  const root = pathRoot(path);
  if (!GLOBAL_ALIASES.has(root)) {
    return path;
  }
  const separator = path.indexOf(".");
  return separator < 0 ? path : path.slice(separator + 1);
}

function pathRoot(path: string): string {
  const separator = path.indexOf(".");
  return separator < 0 ? path : path.slice(0, separator);
}

function pathLeaf(path: string): string {
  const separator = path.lastIndexOf(".");
  return separator < 0 ? path : path.slice(separator + 1);
}

function pathParent(path: string): string | null {
  const separator = path.lastIndexOf(".");
  return separator < 0 ? null : path.slice(0, separator);
}

function memberObject(value: unknown): unknown {
  if (
    isAstNode(value) &&
    (value.type === "MemberExpression" ||
      value.type === "OptionalMemberExpression")
  ) {
    return value.object;
  }
  return undefined;
}

function nodeOffset(node: AstNode): number {
  return typeof node.start === "number" &&
    Number.isSafeInteger(node.start) &&
    node.start >= 0
    ? node.start
    : 0;
}

function isFunctionLike(value: unknown): boolean {
  return (
    isAstNode(value) &&
    (value.type === "ArrowFunctionExpression" ||
      value.type === "ClassExpression" ||
      value.type === "FunctionExpression")
  );
}

function isAstNode(value: unknown): value is AstNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { readonly type?: unknown }).type === "string"
  );
}

function isGridMutation(path: string): boolean {
  const root = pathRoot(path);
  if (!GRID_ROOTS.has(root)) {
    return false;
  }
  if (root !== "KDMapData") {
    return true;
  }
  return GRID_MEMBERS.has(path.split(".")[1] ?? "");
}

function isLikelyEntityPositionWrite(
  path: string,
  entityAliases: ReadonlySet<string>,
): boolean {
  const parts = path.split(".");
  const leaf = parts.at(-1);
  if (leaf !== "x" && leaf !== "y" && leaf !== "[dynamic]") {
    return false;
  }
  return (
    parts.some((part) => isLikelyEntityName(part) || entityAliases.has(part)) ||
    path.startsWith("KDMapData.Entities.")
  );
}

function isLikelyEntityName(value: string): boolean {
  return /^(?:enemy|entity|targetEnemy|playerEntity)$/iu.test(value);
}

function writeEvidenceKind(
  kind: OfficialModWriteKind,
): "direct-write" | "target-mutation" {
  return kind === "mutation" ? "target-mutation" : "direct-write";
}

function writeReason(
  subsystem: ModPreflightSubsystem,
  replacement: boolean,
): string {
  if (replacement) {
    return "optimized-dependency-function-replacement";
  }
  switch (subsystem) {
    case "buff-event-index":
      return "direct-buff-state-mutation";
    case "enemy-position-cache":
      return "enemy-position-cache-mutation";
    case "pathfinding":
      return "pathfinding-state-mutation";
    case "source-optimizations":
      return "source-optimization-assumption-mutation";
  }
}

function executableScriptType(
  filename: string,
): "javascript" | "kscript" | null {
  if (filename.endsWith(".js")) {
    return "javascript";
  }
  if (filename.endsWith(".ks")) {
    return "kscript";
  }
  return null;
}

function isSafeArchiveFilename(filename: string): boolean {
  return (
    filename.length > 0 &&
    filename.length <= 2_048 &&
    !filename.includes("\0") &&
    !filename.startsWith("/") &&
    !filename.startsWith("\\") &&
    !/^[A-Za-z]:/u.test(filename) &&
    !filename.split(/[\\/]/u).some((part) => part === "..")
  );
}

function archiveLookupKey(filename: string): string {
  return filename.replace(/\\/gu, "/").toLowerCase();
}

function isArchiveEntry(value: unknown): value is LegacyModArchiveEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as {
    readonly filename?: unknown;
    readonly directory?: unknown;
    readonly uncompressedBytes?: unknown;
    readonly source?: unknown;
  };
  return (
    typeof entry.filename === "string" &&
    typeof entry.directory === "boolean" &&
    Number.isSafeInteger(entry.uncompressedBytes) &&
    (entry.uncompressedBytes as number) >= 0 &&
    (entry.source === undefined || typeof entry.source === "string")
  );
}

function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { readonly size?: unknown }).size === "number" &&
    typeof (value as { readonly arrayBuffer?: unknown }).arrayBuffer ===
      "function"
  );
}

function normalizeArchiveName(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "Unknown mod";
}

function utf8LengthUpTo(value: string, limit: number): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
    if (bytes > limit) {
      return limit + 1;
    }
  }
  return bytes;
}

function freezeLimits(
  overrides: Partial<ModPreflightLimits> | undefined,
): ModPreflightLimits {
  const limits = { ...DEFAULT_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive safe integer`);
    }
  }
  if (limits.maxTotalScriptBytes < limits.maxScriptBytes) {
    throw new RangeError("maxTotalScriptBytes must be at least maxScriptBytes");
  }
  if (limits.maxTotalAstNodes < limits.maxAstNodesPerScript) {
    throw new RangeError(
      "maxTotalAstNodes must be at least maxAstNodesPerScript",
    );
  }
  if (limits.maxEvidenceTotal < MOD_PREFLIGHT_SUBSYSTEMS.length) {
    throw new RangeError(
      "maxEvidenceTotal must retain one marker per subsystem",
    );
  }
  return Object.freeze(limits);
}

async function sha256Blob(blob: Blob): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function boundaryReport(
  name: string,
  archiveBytes: number,
  digestSha256: string | null,
  reason: string,
): ModPreflightReport {
  const evidence = createEvidenceCollector(DEFAULT_LIMITS);
  addUncertainty(evidence, null, null, reason, "archive-boundary");
  return freezeReport({
    version: 1,
    name,
    digestSha256,
    archiveBytes,
    inventory: [],
    risks: createRisks(evidence.values),
  });
}

function stripInventorySource(
  value: MutableInventoryEntry,
): ModPreflightInventoryEntry {
  return Object.freeze({
    filename: value.filename,
    directory: value.directory,
    uncompressedBytes: value.uncompressedBytes,
    kind: value.kind,
    scriptType: value.scriptType,
    analysis: value.analysis,
    reason: value.reason,
  });
}

function freezeReport(
  value: Omit<ModPreflightReport, "level" | "requiresCompatibilityDecision">,
): ModPreflightReport {
  const risks = Object.freeze([...value.risks]);
  const level = risks.some((risk) => risk.level === "compatibility-required")
    ? "compatibility-required"
    : risks.some((risk) => risk.level === "informational")
      ? "informational"
      : "safe";
  return Object.freeze({
    ...value,
    level,
    requiresCompatibilityDecision: level === "compatibility-required",
    inventory: Object.freeze([...value.inventory]),
    risks,
  });
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
