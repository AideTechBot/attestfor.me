import { describe, it, expect } from "vitest";
import { getProofBorderColour } from "./proof-border-colour";

describe("getProofBorderColour", () => {
  // ── Retracted — always red ────────────────────────────────────────

  it("returns red for retracted + idle", () => {
    expect(getProofBorderColour("retracted", "idle")).toBe("border-l-red-500");
  });

  it("returns red for retracted + loading", () => {
    expect(getProofBorderColour("retracted", "loading")).toBe(
      "border-l-red-500",
    );
  });

  it("returns red for retracted + verified", () => {
    expect(getProofBorderColour("retracted", "verified")).toBe(
      "border-l-red-500",
    );
  });

  it("returns red for retracted + failed", () => {
    expect(getProofBorderColour("retracted", "failed")).toBe(
      "border-l-red-500",
    );
  });

  it("returns red for retracted + null", () => {
    expect(getProofBorderColour("retracted", null)).toBe("border-l-red-500");
  });

  // ── Active — verification state drives colour ─────────────────────

  it("returns light grey for active + null (unattempted)", () => {
    expect(getProofBorderColour("active", null)).toBe("border-l-white/20");
  });

  it("returns light grey for active + idle (unattempted)", () => {
    expect(getProofBorderColour("active", "idle")).toBe("border-l-white/20");
  });

  it("returns yellow for active + loading", () => {
    expect(getProofBorderColour("active", "loading")).toBe(
      "border-l-yellow-500",
    );
  });

  it("returns green for active + verified", () => {
    expect(getProofBorderColour("active", "verified")).toBe(
      "border-l-green-500",
    );
  });

  it("returns red for active + failed", () => {
    expect(getProofBorderColour("active", "failed")).toBe("border-l-red-500");
  });
});
