import { describe, it, expect } from "vitest";
import { generateNonce, formatChallengeText } from "./challenge";

describe("challenge", () => {
  describe("generateNonce", () => {
    it("should generate a nonce of correct length", () => {
      const nonce = generateNonce();
      expect(nonce).toHaveLength(16);
    });

    it("should generate different nonces", () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });

    it("should only contain base62 characters", () => {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^[0-9A-Za-z]+$/);
    });
  });

  describe("formatChallengeText", () => {
    it("should format challenge text correctly", () => {
      const challenge = formatChallengeText(
        "did:plc:abc123",
        "@testuser",
        "twitter",
        "nonce123",
      );

      expect(challenge).toBe(
        "I am did:plc:abc123 on AT Protocol.\nVerifying my twitter account @testuser for attestforme.\nNonce: nonce123",
      );
    });

    it("should use attestforme to avoid URL linkification", () => {
      const challenge = formatChallengeText(
        "did:plc:test",
        "@user",
        "twitter",
        "xyz",
      );

      expect(challenge).toContain("attestforme");
      expect(challenge).not.toContain("attest.me");
    });
  });
});
