import { describe, expect, it } from "vitest";
import { hasGameplaySourceOptimizations } from "./source-compatibility.js";
const bundle = "e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25";
describe("source compatibility risk scope", () => {
  it("does not request a gameplay source rollback for the audited atlas/Pixi-only patch", () => {
    expect(hasGameplaySourceOptimizations({upstreamVersion:"5.5.6",upstreamBundleSha256:bundle,sourceOptimizations:true})).toBe(false);
  });
  it("keeps a bare version claim conservative", () => {
    expect(hasGameplaySourceOptimizations({upstreamVersion:"5.5.6"})).toBe(true);
  });
  it("keeps unknown bundles conservative", () => {
    expect(hasGameplaySourceOptimizations({upstreamVersion:"5.5.6",upstreamBundleSha256:"f".repeat(64)})).toBe(true);
  });
  it("keeps mismatched identities conservative", () => {
    expect(hasGameplaySourceOptimizations({upstreamVersion:"5.4.92",upstreamBundleSha256:bundle})).toBe(true);
  });
  it("keeps earlier gameplay source patches conservative", () => {
    expect(hasGameplaySourceOptimizations({upstreamVersion:"5.4.92",upstreamBundleSha256:"2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4"})).toBe(true);
  });
  it("does not protect source caches when original source was explicitly selected", () => {
    expect(hasGameplaySourceOptimizations({sourceOptimizations:false})).toBe(false);
  });
});
