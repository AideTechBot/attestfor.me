/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock openpgp
vi.mock("openpgp", () => ({
  readKey: vi.fn(),
}));

import * as openpgp from "openpgp";
import { parseSSHKey, parsePGPKey, parseKey } from "./key-parser";

// Mock Web Crypto API
const mockDigest = vi.fn();
const originalCrypto = globalThis.crypto;

beforeEach(() => {
  vi.clearAllMocks();
  // Mock crypto.subtle.digest to return a known hash
  const fakeHash = new Uint8Array(32).fill(42);
  mockDigest.mockResolvedValue(fakeHash.buffer);
  Object.defineProperty(globalThis, "crypto", {
    value: {
      ...originalCrypto,
      subtle: {
        digest: mockDigest,
      },
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: originalCrypto,
    writable: true,
    configurable: true,
  });
});

describe("key-parser", () => {
  describe("parseSSHKey", () => {
    it("parses an ed25519 key", async () => {
      const sshKey =
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl user@host";

      const result = await parseSSHKey(sshKey);

      expect(result.keyType).toBe("ssh-ed25519");
      expect(result.fingerprint).toMatch(/^SHA256:/);
      expect(result.publicKey).toBe(sshKey);
      expect(result.comment).toBe("user@host");
      expect(result.algorithm).toBe("ssh-ed25519");
      expect(mockDigest).toHaveBeenCalledWith(
        "SHA-256",
        expect.any(ArrayBuffer),
      );
    });

    it("parses a key without comment", async () => {
      const sshKey =
        "ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABB deploy@ci";

      const result = await parseSSHKey(sshKey);

      expect(result.keyType).toBe("ssh-ecdsa");
      expect(result.algorithm).toBe("ecdsa-sha2-nistp256");
    });

    it("parses a key without comment", async () => {
      const sshKey =
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl";

      const result = await parseSSHKey(sshKey);

      expect(result.keyType).toBe("ssh-ed25519");
      expect(result.comment).toBeUndefined();
    });

    it("throws on invalid format (single part)", async () => {
      await expect(parseSSHKey("not-a-key")).rejects.toThrow(
        "Invalid SSH key format",
      );
    });

    it("throws on unsupported algorithm", async () => {
      await expect(parseSSHKey("ssh-dss AAAA... user@host")).rejects.toThrow(
        "Unsupported SSH key algorithm: ssh-dss",
      );
    });
  });

  describe("parsePGPKey", () => {
    it("parses a PGP key and extracts fingerprint", async () => {
      const mockKey = {
        getFingerprint: () => "abcdef1234567890abcdef1234567890abcdef12",
        getExpirationTime: async () => new Date("2030-01-01T00:00:00Z"),
        getPrimaryUser: async () => ({
          user: {
            userID: {
              name: "Test User",
              email: "test@example.com",
            },
          },
        }),
        getAlgorithmInfo: () => ({ algorithm: "eddsa" }),
      };

      (openpgp.readKey as any).mockResolvedValueOnce(mockKey);

      const armoredKey =
        "-----BEGIN PGP PUBLIC KEY BLOCK-----\nfake\n-----END PGP PUBLIC KEY BLOCK-----";
      const result = await parsePGPKey(armoredKey);

      expect(result.keyType).toBe("pgp");
      expect(result.fingerprint).toBe(
        "ABCDEF1234567890ABCDEF1234567890ABCDEF12",
      );
      expect(result.comment).toBe("Test User");
      expect(result.expiresAt).toBe("2030-01-01T00:00:00.000Z");
      expect(result.algorithm).toBe("eddsa");
      expect(result.publicKey).toBe(armoredKey.trim());
    });

    it("handles keys without expiration", async () => {
      const mockKey = {
        getFingerprint: () => "1234567890abcdef1234567890abcdef12345678",
        getExpirationTime: async () => Infinity,
        getPrimaryUser: async () => ({
          user: { userID: { email: "user@test.com" } },
        }),
        getAlgorithmInfo: () => ({ algorithm: "rsa" }),
      };

      (openpgp.readKey as any).mockResolvedValueOnce(mockKey);

      const result = await parsePGPKey(
        "-----BEGIN PGP PUBLIC KEY BLOCK-----\nfake\n-----END PGP PUBLIC KEY BLOCK-----",
      );

      expect(result.expiresAt).toBeUndefined();
      expect(result.comment).toBe("user@test.com");
    });
  });

  describe("parseKey (auto-detection)", () => {
    it("detects PGP keys", async () => {
      const mockKey = {
        getFingerprint: () => "aaaa",
        getExpirationTime: async () => Infinity,
        getPrimaryUser: async () => ({ user: { userID: {} } }),
        getAlgorithmInfo: () => ({ algorithm: "rsa" }),
      };
      (openpgp.readKey as any).mockResolvedValueOnce(mockKey);

      const result = await parseKey(
        "-----BEGIN PGP PUBLIC KEY BLOCK-----\nstuff\n-----END PGP PUBLIC KEY BLOCK-----",
      );
      expect(result.keyType).toBe("pgp");
    });

    it("detects SSH ed25519 keys", async () => {
      const result = await parseKey(
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl user@host",
      );
      expect(result.keyType).toBe("ssh-ed25519");
    });

    it("detects ECDSA keys", async () => {
      const result = await parseKey(
        "ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABB test",
      );
      expect(result.keyType).toBe("ssh-ecdsa");
    });

    it("throws on unknown key format", async () => {
      await expect(parseKey("this is not a key")).rejects.toThrow(
        "Unknown key format",
      );
    });
  });
});
