export interface FunctionSignature {
  readonly name: string;
  readonly arity: number;
  readonly normalizedHash: string;
}

export interface SignatureCandidate {
  readonly id: string;
  readonly name: string;
  readonly arity: number;
  readonly normalizedHash?: string;
  readonly sentinels?: readonly string[];
  readonly probe?: (fn: (...args: never[]) => unknown) => boolean;
}

export interface SignatureMatch {
  readonly matched: boolean;
  readonly ambiguous: boolean;
  readonly candidate: SignatureCandidate | null;
  readonly signature: FunctionSignature;
  readonly reason: string;
}

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//gu;
const LINE_COMMENT = /(^|[^:\\])\/\/.*$/gmu;
const WHITESPACE = /\s+/gu;
const CAPTURED_REFLECT_APPLY = Reflect.apply;
const CAPTURED_FUNCTION_TO_STRING = Function.prototype.toString;
const CAPTURED_STRING_REPLACE = String.prototype.replace;
const CAPTURED_STRING_TRIM = String.prototype.trim;
const CAPTURED_STRING_CHAR_CODE_AT = String.prototype.charCodeAt;
const CAPTURED_STRING_INDEX_OF = String.prototype.indexOf;
const CAPTURED_STRING_PAD_START = String.prototype.padStart;
const CAPTURED_REGEXP_EXEC = RegExp.prototype.exec;
const CAPTURED_REGEXP_REPLACE = RegExp.prototype[Symbol.replace];
const CAPTURED_BIGINT = BigInt;
const CAPTURED_BIGINT_AS_UINT_N = BigInt.asUintN;
const CAPTURED_BIGINT_TO_STRING = BigInt.prototype.toString;
const CAPTURED_INTRINSICS_WERE_NATIVE = capturedIntrinsicsWereNative();

function capturedIntrinsicsWereNative(): boolean {
  const functions = [
    CAPTURED_REFLECT_APPLY,
    CAPTURED_FUNCTION_TO_STRING,
    CAPTURED_STRING_REPLACE,
    CAPTURED_STRING_TRIM,
    CAPTURED_STRING_CHAR_CODE_AT,
    CAPTURED_STRING_INDEX_OF,
    CAPTURED_STRING_PAD_START,
    CAPTURED_REGEXP_EXEC,
    CAPTURED_REGEXP_REPLACE,
    CAPTURED_BIGINT,
    CAPTURED_BIGINT_AS_UINT_N,
    CAPTURED_BIGINT_TO_STRING,
  ];
  try {
    for (let index = 0; index < functions.length; index += 1) {
      const functionValue = functions[index];
      if (typeof functionValue !== "function") return false;
      const source = CAPTURED_REFLECT_APPLY(
        CAPTURED_FUNCTION_TO_STRING,
        functionValue,
        [],
      ) as string;
      if (
        (CAPTURED_REFLECT_APPLY(CAPTURED_STRING_INDEX_OF, source, [
          "[native code]",
        ]) as number) < 0
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function signatureIntrinsicsIntact(): boolean {
  return (
    CAPTURED_INTRINSICS_WERE_NATIVE &&
    Reflect.apply === CAPTURED_REFLECT_APPLY &&
    Function.prototype.toString === CAPTURED_FUNCTION_TO_STRING &&
    String.prototype.replace === CAPTURED_STRING_REPLACE &&
    String.prototype.trim === CAPTURED_STRING_TRIM &&
    String.prototype.charCodeAt === CAPTURED_STRING_CHAR_CODE_AT &&
    String.prototype.indexOf === CAPTURED_STRING_INDEX_OF &&
    String.prototype.padStart === CAPTURED_STRING_PAD_START &&
    RegExp.prototype.exec === CAPTURED_REGEXP_EXEC &&
    RegExp.prototype[Symbol.replace] === CAPTURED_REGEXP_REPLACE &&
    BigInt === CAPTURED_BIGINT &&
    BigInt.asUintN === CAPTURED_BIGINT_AS_UINT_N &&
    BigInt.prototype.toString === CAPTURED_BIGINT_TO_STRING
  );
}

export function isNativeFunction(functionValue: Function): boolean {
  if (!signatureIntrinsicsIntact()) return false;
  try {
    const source = CAPTURED_REFLECT_APPLY(
      CAPTURED_FUNCTION_TO_STRING,
      functionValue,
      [],
    ) as string;
    return (
      (CAPTURED_REFLECT_APPLY(CAPTURED_STRING_INDEX_OF, source, [
        "[native code]",
      ]) as number) >= 0
    );
  } catch {
    return false;
  }
}

export function normalizeFunctionSource(fn: Function): string {
  if (!signatureIntrinsicsIntact()) {
    throw new TypeError("Function signature intrinsics changed");
  }
  let source = CAPTURED_REFLECT_APPLY(
    CAPTURED_FUNCTION_TO_STRING,
    fn,
    [],
  ) as string;
  source = CAPTURED_REFLECT_APPLY(CAPTURED_STRING_REPLACE, source, [
    BLOCK_COMMENT,
    "",
  ]) as string;
  source = CAPTURED_REFLECT_APPLY(CAPTURED_STRING_REPLACE, source, [
    LINE_COMMENT,
    "$1",
  ]) as string;
  source = CAPTURED_REFLECT_APPLY(CAPTURED_STRING_REPLACE, source, [
    WHITESPACE,
    "",
  ]) as string;
  return CAPTURED_REFLECT_APPLY(CAPTURED_STRING_TRIM, source, []) as string;
}

/** 64-bit FNV-1a represented as a fixed-width lowercase hex string. */
export function stableHash(text: string): string {
  if (!signatureIntrinsicsIntact()) {
    throw new TypeError("Function signature intrinsics changed");
  }
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= CAPTURED_BIGINT(
      CAPTURED_REFLECT_APPLY(CAPTURED_STRING_CHAR_CODE_AT, text, [
        index,
      ]) as number,
    );
    hash = CAPTURED_REFLECT_APPLY(CAPTURED_BIGINT_AS_UINT_N, CAPTURED_BIGINT, [
      64,
      hash * 0x100000001b3n,
    ]) as bigint;
  }
  const unpadded = CAPTURED_REFLECT_APPLY(CAPTURED_BIGINT_TO_STRING, hash, [
    16,
  ]) as string;
  return CAPTURED_REFLECT_APPLY(CAPTURED_STRING_PAD_START, unpadded, [
    16,
    "0",
  ]) as string;
}

export function functionSignature(fn: Function): FunctionSignature {
  const source = normalizeFunctionSource(fn);
  return {
    name: fn.name,
    arity: fn.length,
    normalizedHash: stableHash(source)
  };
}

export function matchFunctionSignature(
  fn: (...args: never[]) => unknown,
  candidates: readonly SignatureCandidate[]
): SignatureMatch {
  let source: string;
  let signature: FunctionSignature;
  try {
    source = normalizeFunctionSource(fn);
    signature = {
      name: fn.name,
      arity: fn.length,
      normalizedHash: stableHash(source),
    };
  } catch {
    return {
      matched: false,
      ambiguous: false,
      candidate: null,
      signature: {
        name: "",
        arity: -1,
        normalizedHash: "unavailable",
      },
      reason: "signature-intrinsics-changed",
    };
  }

  let matchedCandidate: SignatureCandidate | null = null;
  let matchCount = 0;
  for (
    let candidateIndex = 0;
    candidateIndex < candidates.length;
    candidateIndex += 1
  ) {
    const candidate = candidates[candidateIndex];
    if (candidate === undefined) continue;
    if (
      candidate.name !== signature.name ||
      candidate.arity !== signature.arity
    ) {
      continue;
    }
    if (
      candidate.normalizedHash !== undefined &&
      candidate.normalizedHash !== signature.normalizedHash
    ) {
      continue;
    }
    let sentinelsMatch = true;
    if (candidate.sentinels !== undefined) {
      for (
        let sentinelIndex = 0;
        sentinelIndex < candidate.sentinels.length;
        sentinelIndex += 1
      ) {
        const sentinel = candidate.sentinels[sentinelIndex];
        if (
          sentinel === undefined ||
          (CAPTURED_REFLECT_APPLY(CAPTURED_STRING_INDEX_OF, source, [
            sentinel,
          ]) as number) < 0
        ) {
          sentinelsMatch = false;
          break;
        }
      }
    }
    if (!sentinelsMatch) continue;
    if (candidate.probe !== undefined) {
      try {
        if (!candidate.probe(fn)) continue;
      } catch {
        continue;
      }
    }
    matchCount += 1;
    matchedCandidate = candidate;
  }

  if (matchCount === 1) {
    return {
      matched: true,
      ambiguous: false,
      candidate: matchedCandidate,
      signature,
      reason: "unique-signature-match"
    };
  }
  return {
    matched: false,
    ambiguous: matchCount > 1,
    candidate: null,
    signature,
    reason: matchCount > 1 ? "ambiguous-signature" : "unknown-signature"
  };
}
