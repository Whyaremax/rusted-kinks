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

export function normalizeFunctionSource(fn: Function): string {
  return Function.prototype.toString
    .call(fn)
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "$1")
    .replace(WHITESPACE, "")
    .trim();
}

/** 64-bit FNV-1a represented as a fixed-width lowercase hex string. */
export function stableHash(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
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
  const source = normalizeFunctionSource(fn);
  const signature = functionSignature(fn);
  const matches = candidates.filter((candidate) => {
    if (candidate.name !== signature.name || candidate.arity !== signature.arity) {
      return false;
    }
    if (
      candidate.normalizedHash !== undefined &&
      candidate.normalizedHash !== signature.normalizedHash
    ) {
      return false;
    }
    if (
      candidate.sentinels !== undefined &&
      !candidate.sentinels.every((sentinel) => source.includes(sentinel))
    ) {
      return false;
    }
    if (candidate.probe !== undefined) {
      try {
        return candidate.probe(fn);
      } catch {
        return false;
      }
    }
    return true;
  });

  if (matches.length === 1) {
    return {
      matched: true,
      ambiguous: false,
      candidate: matches[0] ?? null,
      signature,
      reason: "unique-signature-match"
    };
  }
  return {
    matched: false,
    ambiguous: matches.length > 1,
    candidate: null,
    signature,
    reason: matches.length > 1 ? "ambiguous-signature" : "unknown-signature"
  };
}
