// SPDX-License-Identifier: MIT

import { Parser } from "acorn";

export type OfficialModWriteKind =
  | "assignment"
  | "delete"
  | "mutation"
  | "update";

export interface OfficialModSourcePolicy {
  recognizeApi(api: string): boolean;
  isSensitiveWrite(path: string, kind: OfficialModWriteKind): boolean;
}

export interface OfficialModSourceAnalysis {
  readonly compatible: boolean;
  readonly reason: string | null;
  readonly recognizedApis: readonly string[];
  readonly javascriptEvents: readonly string[];
  readonly replacedGlobals: readonly string[];
  readonly directWrites: readonly string[];
}

interface AstNode {
  readonly type: string;
  readonly [key: string]: unknown;
}

const GLOBAL_ALIASES = new Set(["globalThis", "self", "window"]);
const BUILTIN_MUTATION_ROOTS = new Set([
  "Array",
  "BigInt",
  "Boolean",
  "Date",
  "Error",
  "Function",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Promise",
  "Reflect",
  "RegExp",
  "Set",
  "String",
  "Symbol",
  "Uint8Array",
  "WeakMap",
  "WeakSet",
]);
const DYNAMIC_CODE_CALLEES = new Set([
  "AsyncFunction",
  "eval",
  "Function",
  "GeneratorFunction",
  "require",
]);
const DYNAMIC_CODE_CONSTRUCTORS = new Set([
  "AsyncFunction",
  "Function",
  "GeneratorFunction",
  "Proxy",
]);
const DYNAMIC_INVOCATION_METHODS = new Set(["apply", "bind", "call"]);
const DYNAMIC_REFLECT_CALLEES = new Set([
  "Reflect.apply",
  "Reflect.construct",
]);
const COLLECTION_READ_METHODS = new Set([
  "apply",
  "at",
  "bind",
  "call",
  "entries",
  "every",
  "filter",
  "find",
  "findIndex",
  "forEach",
  "get",
  "has",
  "hasOwnProperty",
  "includes",
  "indexOf",
  "keys",
  "map",
  "reduce",
  "reduceRight",
  "slice",
  "some",
  "values",
]);
const COLLECTION_MUTATION_METHODS = new Set([
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
const REFLECTIVE_MUTATION_CALLEES = new Set([
  "Object.assign",
  "Object.defineProperties",
  "Object.defineProperty",
  "Object.setPrototypeOf",
  "Reflect.defineProperty",
  "Reflect.deleteProperty",
  "Reflect.set",
  "Reflect.setPrototypeOf",
]);
const EVENT_MAP_PREFIXES = Object.freeze({
  KDEventMapAlt: "alt",
  KDEventMapBuff: "buff",
  KDEventMapBullet: "bullet",
  KDEventMapFacility: "facility",
  KDEventMapGeneric: "generic",
  KDEventMapInventory: "inventory",
  KDEventMapInventoryIcon: "inventoryIcon",
  KDEventMapOutfit: "outfit",
  KDEventMapSpell: "spell",
  KDEventMapWeapon: "weapon",
} satisfies Readonly<Record<string, string>>);

/**
 * Parses an executable KD mod source file without evaluating it.
 *
 * This is intentionally a compatibility proof, not a security sandbox. The
 * mod still runs through KD's official JavaScript loader. We only prove that
 * the source does not replace assumptions used by KD Hybrid's map-generation
 * fast paths.
 */
export function analyzeOfficialModSource(
  source: string,
  policy: OfficialModSourcePolicy,
): OfficialModSourceAnalysis {
  let root: AstNode;
  try {
    root = Parser.parse(source, {
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      ecmaVersion: "latest",
      sourceType: "script",
    }) as unknown as AstNode;
  } catch {
    return incompatibleAnalysis("script-parse-error");
  }

  const nodes = collectNodes(root);
  const declared = collectDeclaredIdentifiers(nodes);
  const aliases = collectStaticAliases(nodes);
  const declaredEventCallbacks = collectDeclaredEventCallbacks(nodes, aliases);
  const recognizedApis = new Set<string>();
  const javascriptEvents = new Set<string>();
  const replacedGlobals = new Set<string>();
  const directWrites = new Set<string>();
  let reason: string | null = null;

  const reject = (nextReason: string): void => {
    reason ??= nextReason;
  };

  const analyzeWrite = (
    target: unknown,
    kind: OfficialModWriteKind,
    replacement = false,
  ): void => {
    if (reason !== null) {
      return;
    }
    for (const candidate of expandWriteTargets(target)) {
      const unresolvedPath = staticPath(candidate);
      if (unresolvedPath === null) {
        if (containsDynamicGlobalTarget(candidate, aliases)) {
          reject("dynamic-global-write");
        }
        continue;
      }
      const rawPath = unresolvedPath.includes(".")
        ? resolveStaticAlias(unresolvedPath, aliases)
        : unresolvedPath;
      const path = normalizeGlobalPath(rawPath);
      const rawRoot = pathRoot(rawPath);
      const rootName = pathRoot(path);
      const explicitlyGlobal = GLOBAL_ALIASES.has(rawRoot);
      if (explicitlyGlobal && rawPath === rawRoot) {
        reject("dynamic-global-write");
        return;
      }
      if (
        !explicitlyGlobal &&
        rawPath === unresolvedPath &&
        declared.has(rootName)
      ) {
        continue;
      }
      if (isBuiltinMutationPath(path)) {
        reject(`builtin-mutation:${path}`);
        return;
      }
      if (policy.isSensitiveWrite(path, kind)) {
        reject(`source-sensitive-write:${path}`);
        return;
      }
      if (!isKDGlobalName(rootName)) {
        continue;
      }
      if (replacement || (!path.includes(".") && kind === "assignment")) {
        replacedGlobals.add(path);
      } else {
        directWrites.add(path);
      }
      collectEvent(path, javascriptEvents);
    }
  };

  for (const node of nodes) {
    if (reason !== null) {
      break;
    }
    if (node.type === "AssignmentExpression") {
      const right = node.right;
      analyzeWrite(
        node.left,
        "assignment",
        isFunctionLikeNode(right),
      );
      continue;
    }
    if (node.type === "UpdateExpression") {
      analyzeWrite(node.argument, "update");
      continue;
    }
    if (node.type === "UnaryExpression" && node.operator === "delete") {
      analyzeWrite(node.argument, "delete");
      continue;
    }
    if (node.type === "CallExpression" || node.type === "OptionalCallExpression") {
      const unresolvedCalleePath = staticPath(node.callee);
      const calleePath =
        unresolvedCalleePath === null
          ? null
          : resolveStaticAlias(unresolvedCalleePath, aliases);
      const normalizedCallee =
        calleePath === null ? null : normalizeGlobalPath(calleePath);
      const calleeRoot =
        normalizedCallee === null ? "" : pathRoot(normalizedCallee);
      const locallyDeclared =
        normalizedCallee !== null &&
        calleePath !== null &&
        calleePath === unresolvedCalleePath &&
        !GLOBAL_ALIASES.has(pathRoot(calleePath)) &&
        declared.has(calleeRoot);

      if (
        normalizedCallee !== null &&
        isDynamicCodeInvocation(normalizedCallee) &&
        !locallyDeclared
      ) {
        reject(`dynamic-code:${pathRoot(normalizedCallee)}`);
        continue;
      }
      if (node.callee !== null && isAstNode(node.callee) && node.callee.type === "Import") {
        reject("dynamic-code:import");
        continue;
      }
      if (
        normalizedCallee !== null &&
        normalizedCallee.endsWith(".constructor") &&
        firstArgumentCanContainSource(node.arguments)
      ) {
        reject("dynamic-code:constructor");
        continue;
      }
      if (
        normalizedCallee === "setTimeout" ||
        normalizedCallee === "setInterval"
      ) {
        if (firstArgumentCanContainSource(node.arguments)) {
          reject(`dynamic-code:${normalizedCallee}`);
          continue;
        }
      }
      if (
        normalizedCallee !== null &&
        DYNAMIC_REFLECT_CALLEES.has(normalizedCallee)
      ) {
        const dynamicTarget = staticPath(firstArgument(node.arguments));
        const resolvedDynamicTarget =
          dynamicTarget === null
            ? null
            : normalizeGlobalPath(resolveStaticAlias(dynamicTarget, aliases));
        if (
          resolvedDynamicTarget !== null &&
          DYNAMIC_CODE_CONSTRUCTORS.has(resolvedDynamicTarget)
        ) {
          reject(`dynamic-code:${resolvedDynamicTarget}`);
          continue;
        }
      }

      if (
        normalizedCallee !== null &&
        REFLECTIVE_MUTATION_CALLEES.has(normalizedCallee)
      ) {
        const target = firstArgument(node.arguments);
        if (target === undefined) {
          reject(`unsafe-reflective-mutation:${normalizedCallee}`);
          continue;
        }
        analyzeWrite(
          target,
          normalizedCallee.includes("delete") ? "delete" : "mutation",
          normalizedCallee.includes("define"),
        );
        continue;
      }

      if (normalizedCallee === null || locallyDeclared) {
        continue;
      }
      if (policy.recognizeApi(normalizedCallee)) {
        recognizedApis.add(normalizedCallee);
        collectEvent(normalizedCallee, javascriptEvents);
        continue;
      }
      if (declaredEventCallbacks.has(normalizedCallee)) {
        collectEvent(normalizedCallee, javascriptEvents);
        continue;
      }

      const method = pathLeaf(normalizedCallee);
      const collectionTarget = pathParent(normalizedCallee);
      if (
        collectionTarget !== null &&
        COLLECTION_MUTATION_METHODS.has(method)
      ) {
        analyzeWrite(memberObject(node.callee), "mutation");
        collectEvent(collectionTarget, javascriptEvents);
        continue;
      }
      if (
        collectionTarget !== null &&
        COLLECTION_READ_METHODS.has(method) &&
        isKDGlobalName(pathRoot(normalizedCallee))
      ) {
        collectEvent(collectionTarget, javascriptEvents);
        continue;
      }
      if (isKDGlobalName(calleeRoot)) {
        reject(`unknown-official-api:${normalizedCallee}`);
        continue;
      }
      collectDomEvent(normalizedCallee, node.arguments, javascriptEvents);
      continue;
    }
    if (node.type === "NewExpression") {
      const unresolvedCalleePath = staticPath(node.callee);
      const calleePath =
        unresolvedCalleePath === null
          ? null
          : resolveStaticAlias(unresolvedCalleePath, aliases);
      const normalizedCallee =
        calleePath === null ? null : normalizeGlobalPath(calleePath);
      if (
        normalizedCallee !== null &&
        DYNAMIC_CODE_CONSTRUCTORS.has(normalizedCallee) &&
        !(
          calleePath === unresolvedCalleePath &&
          declared.has(pathRoot(normalizedCallee))
        )
      ) {
        reject(`dynamic-code:${normalizedCallee}`);
      }
      continue;
    }
    if (
      node.type === "ImportExpression" ||
      node.type === "TaggedTemplateExpression" &&
        staticPath(node.tag) === "eval"
    ) {
      reject("dynamic-code:import-or-eval");
    }
  }

  if (reason !== null) {
    return incompatibleAnalysis(reason, {
      directWrites,
      javascriptEvents,
      recognizedApis,
      replacedGlobals,
    });
  }
  return freezeAnalysis({
    compatible: true,
    reason: null,
    recognizedApis: [...recognizedApis].sort(),
    javascriptEvents: [...javascriptEvents].sort(),
    replacedGlobals: [...replacedGlobals].sort(),
    directWrites: [...directWrites].sort(),
  });
}

function collectNodes(root: AstNode): AstNode[] {
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
    result.push(value);
    const entries = Object.entries(value);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, child] = entries[index]!;
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
  return result;
}

function collectDeclaredIdentifiers(nodes: readonly AstNode[]): Set<string> {
  const result = new Set<string>();
  for (const node of nodes) {
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "ClassDeclaration"
    ) {
      collectPatternNames(node.id, result);
    } else if (node.type === "VariableDeclarator") {
      collectPatternNames(node.id, result);
    } else if (
      node.type === "ImportDefaultSpecifier" ||
      node.type === "ImportNamespaceSpecifier" ||
      node.type === "ImportSpecifier"
    ) {
      collectPatternNames(node.local, result);
    }
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression" ||
      node.type === "ObjectMethod" ||
      node.type === "ClassMethod"
    ) {
      const parameters = node.params;
      if (Array.isArray(parameters)) {
        for (const parameter of parameters) {
          collectPatternNames(parameter, result);
        }
      }
    }
    if (node.type === "CatchClause") {
      collectPatternNames(node.param, result);
    }
  }
  return result;
}

function collectStaticAliases(
  nodes: readonly AstNode[],
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const node of nodes) {
    if (node.type !== "VariableDeclarator" || !isAstNode(node.id)) {
      continue;
    }
    const target = staticPath(node.init);
    if (target === null) {
      continue;
    }
    if (
      node.id.type === "Identifier" &&
      typeof node.id.name === "string" &&
      target !== node.id.name
    ) {
      result.set(node.id.name, target);
    } else if (node.id.type === "ObjectPattern") {
      collectObjectPatternAliases(node.id, target, result);
    }
  }
  return result;
}

function collectObjectPatternAliases(
  pattern: AstNode,
  target: string,
  aliases: Map<string, string>,
): void {
  if (!Array.isArray(pattern.properties)) {
    return;
  }
  for (const property of pattern.properties) {
    if (
      !isAstNode(property) ||
      property.type === "RestElement" ||
      !isAstNode(property.value)
    ) {
      continue;
    }
    const key = staticPropertyName(property.key, property.computed === true);
    if (key === null) {
      continue;
    }
    const propertyTarget = `${target}.${key}`;
    if (
      property.value.type === "Identifier" &&
      typeof property.value.name === "string"
    ) {
      aliases.set(property.value.name, propertyTarget);
    } else if (property.value.type === "ObjectPattern") {
      collectObjectPatternAliases(property.value, propertyTarget, aliases);
    }
  }
}

function collectDeclaredEventCallbacks(
  nodes: readonly AstNode[],
  aliases: ReadonlyMap<string, string>,
): ReadonlySet<string> {
  const result = new Set<string>();
  for (const node of nodes) {
    if (node.type !== "AssignmentExpression") {
      continue;
    }
    const unresolved = staticPath(node.left);
    if (unresolved === null) {
      continue;
    }
    const path = normalizeGlobalPath(resolveStaticAlias(unresolved, aliases));
    if (isEventMapPath(path)) {
      result.add(path);
    }
  }
  return result;
}

function collectPatternNames(value: unknown, names: Set<string>): void {
  if (!isAstNode(value)) {
    return;
  }
  if (value.type === "Identifier" && typeof value.name === "string") {
    names.add(value.name);
    return;
  }
  if (value.type === "RestElement") {
    collectPatternNames(value.argument, names);
    return;
  }
  if (value.type === "AssignmentPattern") {
    collectPatternNames(value.left, names);
    return;
  }
  if (value.type === "ArrayPattern" && Array.isArray(value.elements)) {
    for (const element of value.elements) {
      collectPatternNames(element, names);
    }
    return;
  }
  if (value.type === "ObjectPattern" && Array.isArray(value.properties)) {
    for (const property of value.properties) {
      if (!isAstNode(property)) {
        continue;
      }
      if (property.type === "RestElement") {
        collectPatternNames(property.argument, names);
      } else {
        collectPatternNames(property.value, names);
      }
    }
  }
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
    value.type === "TSNonNullExpression" ||
    value.type === "ParenthesizedExpression" ||
    value.type === "ChainExpression"
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
  if (object === null) {
    return null;
  }
  const property = staticPropertyName(value.property, value.computed === true);
  return property === null ? null : `${object}.${property}`;
}

function staticPropertyName(
  value: unknown,
  computed: boolean,
): string | null {
  if (!isAstNode(value)) {
    return null;
  }
  if (!computed && value.type === "Identifier") {
    return typeof value.name === "string" ? value.name : null;
  }
  if (
    value.type === "StringLiteral" ||
    value.type === "NumericLiteral" ||
    value.type === "BooleanLiteral" ||
    value.type === "Literal"
  ) {
    return typeof value.value === "string" ||
      typeof value.value === "number" ||
      typeof value.value === "boolean"
      ? String(value.value)
      : null;
  }
  if (
    value.type === "TemplateLiteral" &&
    Array.isArray(value.expressions) &&
    value.expressions.length === 0 &&
    Array.isArray(value.quasis) &&
    value.quasis.length === 1
  ) {
    const quasi = value.quasis[0];
    if (isAstNode(quasi)) {
      const quasiValue = quasi.value;
      if (
        typeof quasiValue === "object" &&
        quasiValue !== null &&
        typeof (quasiValue as { readonly cooked?: unknown }).cooked ===
          "string"
      ) {
        return (quasiValue as { readonly cooked: string }).cooked;
      }
    }
  }
  return null;
}

function expandWriteTargets(value: unknown): unknown[] {
  if (!isAstNode(value)) {
    return [];
  }
  if (value.type === "AssignmentPattern") {
    return expandWriteTargets(value.left);
  }
  if (value.type === "RestElement") {
    return expandWriteTargets(value.argument);
  }
  if (value.type === "ArrayPattern" && Array.isArray(value.elements)) {
    return value.elements.flatMap((element) => expandWriteTargets(element));
  }
  if (value.type === "ObjectPattern" && Array.isArray(value.properties)) {
    return value.properties.flatMap((property) => {
      if (!isAstNode(property)) {
        return [];
      }
      return expandWriteTargets(
        property.type === "RestElement" ? property.argument : property.value,
      );
    });
  }
  return [value];
}

function containsDynamicGlobalTarget(
  value: unknown,
  aliases: ReadonlyMap<string, string>,
): boolean {
  if (!isAstNode(value)) {
    return false;
  }
  if (
    value.type === "MemberExpression" ||
    value.type === "OptionalMemberExpression"
  ) {
    const objectPath = staticPath(value.object);
    const resolvedObjectPath =
      objectPath === null ? null : resolveStaticAlias(objectPath, aliases);
    if (
      resolvedObjectPath !== null &&
      GLOBAL_ALIASES.has(pathRoot(resolvedObjectPath)) &&
      staticPropertyName(value.property, value.computed === true) === null
    ) {
      return true;
    }
    return containsDynamicGlobalTarget(value.object, aliases);
  }
  return false;
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

function firstArgument(argumentsValue: unknown): unknown {
  return Array.isArray(argumentsValue) ? argumentsValue[0] : undefined;
}

function firstArgumentCanContainSource(argumentsValue: unknown): boolean {
  const argument = firstArgument(argumentsValue);
  if (!isAstNode(argument)) {
    return false;
  }
  return (
    argument.type === "StringLiteral" ||
    argument.type === "Literal" && typeof argument.value === "string" ||
    argument.type === "TemplateLiteral" ||
    argument.type === "BinaryExpression"
  );
}

function isFunctionLikeNode(value: unknown): boolean {
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

function normalizeGlobalPath(path: string): string {
  const root = pathRoot(path);
  if (!GLOBAL_ALIASES.has(root)) {
    return path;
  }
  const separator = path.indexOf(".");
  return separator < 0 ? path : path.slice(separator + 1);
}

function resolveStaticAlias(
  path: string,
  aliases: ReadonlyMap<string, string>,
): string {
  let result = path;
  const visited = new Set<string>();
  for (let depth = 0; depth < 16; depth += 1) {
    const root = pathRoot(result);
    const replacement = aliases.get(root);
    if (replacement === undefined || visited.has(root)) {
      break;
    }
    visited.add(root);
    result = `${replacement}${result.slice(root.length)}`;
  }
  return result;
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

function isKDGlobalName(name: string): boolean {
  return name.startsWith("KD") || name.startsWith("KinkyDungeon");
}

function isDynamicCodeInvocation(path: string): boolean {
  const root = pathRoot(path);
  return (
    DYNAMIC_CODE_CALLEES.has(path) ||
    DYNAMIC_CODE_CALLEES.has(root) &&
      DYNAMIC_INVOCATION_METHODS.has(pathLeaf(path))
  );
}

function isBuiltinMutationPath(path: string): boolean {
  return BUILTIN_MUTATION_ROOTS.has(pathRoot(path));
}

function collectEvent(path: string, events: Set<string>): void {
  const [root, ...parts] = path.split(".");
  if (root === undefined) {
    return;
  }
  const family =
    EVENT_MAP_PREFIXES[root as keyof typeof EVENT_MAP_PREFIXES];
  if (family === undefined || parts.length === 0) {
    return;
  }
  if (COLLECTION_MUTATION_METHODS.has(parts.at(-1) ?? "")) {
    parts.pop();
  }
  if (parts.length > 0) {
    events.add(`${family}.${parts.join(".")}`);
  }
}

function isEventMapPath(path: string): boolean {
  return Object.hasOwn(EVENT_MAP_PREFIXES, pathRoot(path));
}

function collectDomEvent(
  callee: string,
  argumentsValue: unknown,
  events: Set<string>,
): void {
  if (
    callee !== "document.addEventListener" &&
    callee !== "globalThis.addEventListener" &&
    callee !== "self.addEventListener" &&
    callee !== "window.addEventListener"
  ) {
    return;
  }
  const argument = firstArgument(argumentsValue);
  if (
    isAstNode(argument) &&
    (argument.type === "StringLiteral" ||
      argument.type === "Literal") &&
    typeof argument.value === "string"
  ) {
    events.add(`dom.${argument.value}`);
  }
}

function incompatibleAnalysis(
  reason: string,
  partial?: {
    readonly recognizedApis: ReadonlySet<string>;
    readonly javascriptEvents: ReadonlySet<string>;
    readonly replacedGlobals: ReadonlySet<string>;
    readonly directWrites: ReadonlySet<string>;
  },
): OfficialModSourceAnalysis {
  return freezeAnalysis({
    compatible: false,
    reason,
    recognizedApis: [...(partial?.recognizedApis ?? [])].sort(),
    javascriptEvents: [...(partial?.javascriptEvents ?? [])].sort(),
    replacedGlobals: [...(partial?.replacedGlobals ?? [])].sort(),
    directWrites: [...(partial?.directWrites ?? [])].sort(),
  });
}

function freezeAnalysis(
  value: OfficialModSourceAnalysis,
): OfficialModSourceAnalysis {
  return Object.freeze({
    ...value,
    recognizedApis: Object.freeze([...value.recognizedApis]),
    javascriptEvents: Object.freeze([...value.javascriptEvents]),
    replacedGlobals: Object.freeze([...value.replacedGlobals]),
    directWrites: Object.freeze([...value.directWrites]),
  });
}
