import { describe, it, expect } from "vitest";
import {
  generateNonce,
  formatChallengeText,
  validateNonce,
  parseChallengeText,
} from "./challenge";

describe("Challenge Generation", () => {
  describe("generateNonce", () => {
    it("should generate a nonce with default 128 bits", () => {
      const nonce = generateNonce();
      expect(nonce).toBeTruthy();
      expect(nonce.length).toBeGreaterThanOrEqual(22); // ceil(128/5.954) = 22
      expect(/^[0-9A-Za-z]+$/.test(nonce)).toBe(true);
    });

    it("should generate unique nonces", () => {
      const nonces = new Set();
      for (let i = 0; i < 1000; i++) {
        nonces.add(generateNonce());
      }
      expect(nonces.size).toBe(1000);
    });

    it("should generate nonce with custom bit length", () => {
      const nonce = generateNonce(256);
      expect(nonce.length).toBeGreaterThanOrEqual(43); // ceil(256/5.954) = 43
    });

    it("should only contain base62 characters", () => {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^[0-9A-Za-z]+$/);
    });
  });

  describe("formatChallengeText", () => {
    it("should format challenge text correctly", () => {
      const result = formatChallengeText(
        "did:plc:abc123",
        "twitter",
        "@alice",
        "R4nD0mN0nc3",
      );
      expect(result).toBe(
        "I am did:plc:abc123 on AT Protocol.\n" +
          "Verifying my twitter account @alice for attest.me.\n" +
          "Nonce: R4nD0mN0nc3",
      );
    });

    it("should work with different services", () => {
      const result = formatChallengeText(
        "did:plc:xyz789",
        "github",
        "bob",
        "N0nc3",
      );
      expect(result).toContain("github account bob");
    });
  });

  describe("validateNonce", () => {
    it("should validate a good nonce", () => {
      expect(validateNonce("a".repeat(22))).toBe(true);
    });

    it("should validate actual generated nonces", () => {
      const nonce = generateNonce();
      expect(validateNonce(nonce)).toBe(true);
    });

    it("should reject short nonce", () => {
      expect(validateNonce("short")).toBe(false);
    });

    it("should reject non-base62 characters", () => {
      expect(validateNonce("a".repeat(20) + "!@")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(validateNonce("")).toBe(false);
    });

    it("should reject non-string input", () => {
      expect(validateNonce(null as unknown as string)).toBe(false);
      expect(validateNonce(undefined as unknown as string)).toBe(false);
      expect(validateNonce(123 as unknown as string)).toBe(false);
    });

    it("should accept longer nonces", () => {
      expect(validateNonce("a".repeat(50))).toBe(true);
    });

    it("should enforce minimum entropy with custom minBits", () => {
      expect(validateNonce("abc", 256)).toBe(false);
      expect(validateNonce("a".repeat(50), 256)).toBe(true);
    });
  });

  describe("parseChallengeText", () => {
    it("should parse valid challenge text", () => {
      const text =
        "I am did:plc:abc123 on AT Protocol.\n" +
        "Verifying my twitter account @alice for attest.me.\n" +
        "Nonce: R4nD0mN0nc3";

      const result = parseChallengeText(text);
      expect(result).toEqual({
        did: "did:plc:abc123",
        service: "twitter",
        handle: "@alice",
        nonce: "R4nD0mN0nc3",
      });
    });

    it("should handle handles with special characters", () => {
      const text =
        "I am did:plc:xyz on AT Protocol.\n" +
        "Verifying my github account alice_123-test for attest.me.\n" +
        "Nonce: ABC";

      const result = parseChallengeText(text);
      expect(result?.handle).toBe("alice_123-test");
    });

    it("should return null for invalid text", () => {
      expect(parseChallengeText("invalid text")).toBeNull();
    });

    it("should return null for malformed DID", () => {
      const text =
        "I am invalid-did on AT Protocol.\n" +
        "Verifying my twitter account @alice for attest.me.\n" +
        "Nonce: R4nD0mN0nc3";

      expect(parseChallengeText(text)).toBeNull();
    });

    it("should return null for missing nonce", () => {
      const text =
        "I am did:plc:abc123 on AT Protocol.\n" +
        "Verifying my twitter account @alice for attest.me.";

      expect(parseChallengeText(text)).toBeNull();
    });

    it("should parse generated challenge text", () => {
      const did = "did:plc:test123";
      const service = "github";
      const handle = "testuser";
      const nonce = generateNonce();

      const challengeText = formatChallengeText(did, service, handle, nonce);
      const parsed = parseChallengeText(challengeText);

      expect(parsed).toEqual({ did, service, handle, nonce });
    });
  });
});
