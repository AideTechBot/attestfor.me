import { describe, it, expect } from "vitest";
import { getClaimStatusLabel } from "./claim-status-label";

describe("getClaimStatusLabel", () => {
  // ── Nothing attempted ────────────────────────────────────────────

  it("returns neutral when no proofs exist", () => {
    const result = getClaimStatusLabel(0, []);
    expect(result.colour).toBe("neutral");
  });

  it("returns neutral with singular 'account' when total is 1", () => {
    const result = getClaimStatusLabel(1, ["idle"]);
    expect(result.colour).toBe("neutral");
    expect(result.label).toBe("1 linked account");
  });

  it("returns neutral with plural 'accounts' when total > 1", () => {
    const result = getClaimStatusLabel(2, ["idle", "idle"]);
    expect(result.colour).toBe("neutral");
    expect(result.label).toBe("2 linked accounts");
  });

  it("returns neutral when all are still loading", () => {
    const result = getClaimStatusLabel(2, ["loading", "loading"]);
    expect(result.colour).toBe("neutral");
  });

  it("returns neutral when mix of idle and loading but none resolved", () => {
    const result = getClaimStatusLabel(3, ["idle", "loading", "idle"]);
    expect(result.colour).toBe("neutral");
  });

  // ── Green (only case: ALL verified) ─────────────────────────────

  it("returns green when the single proof is verified", () => {
    const result = getClaimStatusLabel(1, ["verified"]);
    expect(result.colour).toBe("green");
    expect(result.label).toBe("1 verified account");
  });

  it("returns green when all proofs are verified", () => {
    const result = getClaimStatusLabel(3, ["verified", "verified", "verified"]);
    expect(result.colour).toBe("green");
    expect(result.label).toBe("3 verified accounts");
  });

  it("green label has no unknown suffix", () => {
    const result = getClaimStatusLabel(2, ["verified", "verified"]);
    expect(result.label).not.toContain("unknown");
  });

  it("does NOT return green when some are verified but not all", () => {
    const result = getClaimStatusLabel(3, ["verified", "verified", "idle"]);
    expect(result.colour).not.toBe("green");
  });

  it("does NOT return green when verified + failed equals total", () => {
    const result = getClaimStatusLabel(2, ["verified", "failed"]);
    expect(result.colour).not.toBe("green");
  });

  // ── Red (at least one failed, zero verified) ─────────────────────

  it("returns red when single proof failed", () => {
    const result = getClaimStatusLabel(1, ["failed"]);
    expect(result.colour).toBe("red");
    expect(result.label).toBe("1 unverified account");
  });

  it("returns red when multiple proofs all failed", () => {
    const result = getClaimStatusLabel(3, ["failed", "failed", "failed"]);
    expect(result.colour).toBe("red");
    expect(result.label).toBe("3 unverified accounts");
  });

  it("returns red when one failed, others are idle (none verified)", () => {
    const result = getClaimStatusLabel(3, ["failed", "idle", "idle"]);
    expect(result.colour).toBe("red");
    expect(result.label).toBe("1 unverified account · 2 unknown");
  });

  it("returns red with unknown suffix when one failed, one loading", () => {
    const result = getClaimStatusLabel(2, ["failed", "loading"]);
    expect(result.colour).toBe("red");
    expect(result.label).toContain("1 unknown");
  });

  it("red label has no unknown suffix when all proofs have final results", () => {
    const result = getClaimStatusLabel(2, ["failed", "failed"]);
    expect(result.label).not.toContain("unknown");
  });

  // ── Yellow (some verified, rest don't matter) ────────────────────

  it("returns yellow when some verified and some failed", () => {
    const result = getClaimStatusLabel(2, ["verified", "failed"]);
    expect(result.colour).toBe("yellow");
    expect(result.label).toBe("1 verified · 1 failed");
  });

  it("yellow label has no unknown suffix when all proofs have final results", () => {
    const result = getClaimStatusLabel(2, ["verified", "failed"]);
    expect(result.label).not.toContain("unknown");
  });

  it("returns yellow with unknown suffix when some verified and some idle", () => {
    const result = getClaimStatusLabel(3, ["verified", "idle", "idle"]);
    expect(result.colour).toBe("yellow");
    expect(result.label).toBe("1 verified · 0 failed · 2 unknown");
  });

  it("returns yellow with unknown suffix when some verified and some loading", () => {
    const result = getClaimStatusLabel(2, ["verified", "loading"]);
    expect(result.colour).toBe("yellow");
    expect(result.label).toContain("1 unknown");
  });

  it("returns yellow with correct counts for mixed bag", () => {
    const result = getClaimStatusLabel(5, [
      "verified",
      "verified",
      "failed",
      "idle",
      "loading",
    ]);
    expect(result.colour).toBe("yellow");
    expect(result.label).toBe("2 verified · 1 failed · 2 unknown");
  });
});
