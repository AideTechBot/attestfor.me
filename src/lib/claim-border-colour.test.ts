import { describe, it, expect } from "vitest";
import { getClaimBorderColour } from "./claim-border-colour";

describe("getClaimBorderColour", () => {
  // ── Retracted — always red ────────────────────────────────────────

  it("returns red for retracted + idle", () => {
    expect(getClaimBorderColour("retracted", "idle")).toBe("border-l-red-500");
  });

  it("returns red for retracted + loading", () => {
    expect(getClaimBorderColour("retracted", "loading")).toBe(
      "border-l-red-500",
    );
  });

  it("returns red for retracted + verified", () => {
    expect(getClaimBorderColour("retracted", "verified")).toBe(
      "border-l-red-500",
    );
  });

  it("returns red for retracted + failed", () => {
    expect(getClaimBorderColour("retracted", "failed")).toBe(
      "border-l-red-500",
    );
  });

  it("returns red for retracted + null", () => {
    expect(getClaimBorderColour("retracted", null)).toBe("border-l-red-500");
  });

  // ── Active — verification state drives colour ─────────────────────

  it("returns light grey for active + null (unattempted)", () => {
    expect(getClaimBorderColour("active", null)).toBe("border-l-white/20");
  });

  it("returns light grey for active + idle (unattempted)", () => {
    expect(getClaimBorderColour("active", "idle")).toBe("border-l-white/20");
  });

  it("returns yellow for active + loading", () => {
    expect(getClaimBorderColour("active", "loading")).toBe(
      "border-l-yellow-500",
    );
  });

  it("returns green for active + verified", () => {
    expect(getClaimBorderColour("active", "verified")).toBe(
      "border-l-green-500",
    );
  });

  it("returns red for active + failed", () => {
    expect(getClaimBorderColour("active", "failed")).toBe("border-l-red-500");
  });
});
