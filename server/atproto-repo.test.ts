import { describe, it, expect, vi } from "vitest";
import { parseAtUri } from "./atproto-repo";

// Mock the oauth client
vi.mock("./oauth", () => ({
  oauthClient: {
    restore: vi.fn(),
    createAnonymousAgent: vi.fn(),
  },
}));

describe("AT Proto Repo Library", () => {
  describe("parseAtUri", () => {
    it("should parse a valid AT URI", () => {
      const result = parseAtUri("at://did:plc:test123/me.attest.proof/abc123");
      expect(result).toEqual({
        repo: "did:plc:test123",
        collection: "me.attest.proof",
        rkey: "abc123",
      });
    });

    it("should handle different collections", () => {
      const result = parseAtUri("at://did:plc:xyz/me.attest.key/key789");
      expect(result).toEqual({
        repo: "did:plc:xyz",
        collection: "me.attest.key",
        rkey: "key789",
      });
    });

    it("should handle complex rkeys", () => {
      const result = parseAtUri(
        "at://did:plc:test/me.attest.proof/3jui7kd54zh2y",
      );
      expect(result.rkey).toBe("3jui7kd54zh2y");
    });

    it("should throw on invalid URI", () => {
      expect(() => parseAtUri("invalid://uri")).toThrow("Invalid AT URI");
    });

    it("should throw on missing parts", () => {
      expect(() => parseAtUri("at://did:plc:test")).toThrow("Invalid AT URI");
    });

    it("should throw on http URLs", () => {
      expect(() => parseAtUri("https://example.com/collection/rkey")).toThrow(
        "Invalid AT URI",
      );
    });
  });
});
