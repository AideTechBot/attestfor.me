/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubVerifier } from "./github";

describe("GitHubVerifier", () => {
  let verifier: GitHubVerifier;

  beforeEach(() => {
    verifier = new GitHubVerifier();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getServiceName", () => {
    it("returns 'github'", () => {
      expect(verifier.getServiceName()).toBe("github");
    });
  });

  describe("validateProofUrl", () => {
    it("validates correct gist URLs", () => {
      expect(
        verifier.validateProofUrl(
          "https://gist.github.com/username/1234567890abcdef1234",
        ),
      ).toBe(true);
      expect(
        verifier.validateProofUrl(
          "https://gist.github.com/user_name/abcdef1234567890ABCDEF1234",
        ),
      ).toBe(true);
      expect(
        verifier.validateProofUrl(
          "https://gist.github.com/user-name/92ebba3b6279c60e867895079f0aeeac",
        ),
      ).toBe(true);
    });

    it("rejects invalid URLs", () => {
      expect(verifier.validateProofUrl("https://github.com/user/repo")).toBe(
        false,
      );
      expect(verifier.validateProofUrl("https://gist.github.com/user")).toBe(
        false,
      );
      expect(
        verifier.validateProofUrl("https://gist.github.com/user/short"),
      ).toBe(false);
      expect(verifier.validateProofUrl("http://gist.github.com/user/abc")).toBe(
        false,
      );
      expect(
        verifier.validateProofUrl(
          "https://gist.github.com/user/not-hex-chars!!!!",
        ),
      ).toBe(false);
    });
  });

  describe("normalizeHandle", () => {
    it("removes @ prefix", () => {
      expect(verifier.normalizeHandle("@username")).toBe("username");
    });

    it("leaves handle without @ unchanged", () => {
      expect(verifier.normalizeHandle("username")).toBe("username");
    });
  });

  describe("verify", () => {
    const mockGistResponse = {
      owner: { login: "testuser" },
      files: {
        "challenge.txt": {
          content: "attestfor.me challenge: abc123",
        },
      },
    };

    const CHALLENGE = "attestfor.me challenge: abc123";

    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    it("successfully verifies a valid gist with matching challenge", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockGistResponse,
      });

      const result = await verifier.verify(
        "https://gist.github.com/testuser/1234567890abcdef1234",
        CHALLENGE,
        "testuser",
      );

      expect(result.success).toBe(true);
      expect(result.details?.username).toBe("testuser");
    });

    it("rejects when gist content has extra text around the challenge", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          owner: { login: "testuser" },
          files: {
            "file.txt": { content: CHALLENGE + "\nextra line" },
          },
        }),
      });

      const result = await verifier.verify(
        "https://gist.github.com/testuser/1234567890abcdef1234",
        CHALLENGE,
        "testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("CHALLENGE_NOT_FOUND");
    });

    it("handles case-insensitive username matching", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          owner: { login: "TestUser" },
          files: {
            "file.txt": { content: "challenge text" },
          },
        }),
      });

      const result = await verifier.verify(
        "https://gist.github.com/TestUser/1234567890abcdef1234",
        "challenge text",
        "testuser",
      );

      expect(result.success).toBe(true);
    });

    it("searches all files and passes when one matches exactly", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          owner: { login: "testuser" },
          files: {
            "file1.txt": { content: "some other content" },
            "file2.md": { content: "challenge: abc123" },
            "file3.js": { content: "more content" },
          },
        }),
      });

      const result = await verifier.verify(
        "https://gist.github.com/testuser/1234567890abcdef1234",
        "challenge: abc123",
        "testuser",
      );

      expect(result.success).toBe(true);
    });

    it("handles @ prefix in handle", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          owner: { login: "testuser" },
          files: {
            "file.txt": { content: "challenge" },
          },
        }),
      });

      const result = await verifier.verify(
        "https://gist.github.com/testuser/1234567890abcdef1234",
        "challenge",
        "@testuser",
      );

      expect(result.success).toBe(true);
    });

    it("rejects invalid gist URL format", async () => {
      const result = await verifier.verify(
        "https://github.com/user/repo",
        "challenge",
        "user",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("INVALID_URL");
      expect(result.error).toBe("Invalid gist URL format");
    });

    it("rejects when URL username doesn't match handle", async () => {
      const result = await verifier.verify(
        "https://gist.github.com/wronguser/1234567890abcdef1234",
        "challenge",
        "testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("HANDLE_MISMATCH");
      expect(result.error).toBe("Gist owner does not match handle");
    });

    it("rejects when gist is not found (404)", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await verifier.verify(
        "https://gist.github.com/testuser/1234567890abcdef1234",
        "challenge",
        "testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("GIST_NOT_FOUND");
      expect(result.error).toBe("Gist not found");
    });

    it("rejects when API returns other error status", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await verifier.verify(
        "https://gist.github.com/testuser/1234567890abcdef1234",
        "challenge",
        "testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("API_ERROR");
      expect(result.error).toBe("GitHub API error (HTTP 500)");
    });

    it("rejects when gist owner doesn't match handle", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          owner: { login: "differentuser" },
          files: {
            "file.txt": { content: "challenge" },
          },
        }),
      });

      const result = await verifier.verify(
        "https://gist.github.com/differentuser/1234567890abcdef1234",
        "challenge",
        "testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("HANDLE_MISMATCH");
      expect(result.error).toBe("Gist owner does not match handle");
    });

    it("rejects when challenge text is not found in any file", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          owner: { login: "testuser" },
          files: {
            "file1.txt": { content: "some content" },
            "file2.md": { content: "other content" },
          },
        }),
      });

      const result = await verifier.verify(
        "https://gist.github.com/testuser/1234567890abcdef1234",
        "missing challenge",
        "testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("CHALLENGE_NOT_FOUND");
      expect(result.error).toBe("Challenge text not found in gist");
    });

    it("handles gist with no files", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          owner: { login: "testuser" },
          files: {},
        }),
      });

      const result = await verifier.verify(
        "https://gist.github.com/testuser/1234567890abcdef1234",
        "challenge",
        "testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("CHALLENGE_NOT_FOUND");
    });

    it("handles network errors", async () => {
      (globalThis.fetch as any).mockRejectedValueOnce(
        new Error("Network connection failed"),
      );

      const result = await verifier.verify(
        "https://gist.github.com/testuser/1234567890abcdef1234",
        "challenge",
        "testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("UNKNOWN_ERROR");
      expect(result.error).toBe("Network connection failed");
    });

    it("handles non-Error exceptions", async () => {
      (globalThis.fetch as any).mockRejectedValueOnce("String error");

      const result = await verifier.verify(
        "https://gist.github.com/testuser/1234567890abcdef1234",
        "challenge",
        "testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("UNKNOWN_ERROR");
      expect(result.error).toBe("Unknown error");
    });

    it("makes correct API request", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockGistResponse,
      });

      await verifier.verify(
        "https://gist.github.com/testuser/abc1234567890def1234",
        CHALLENGE,
        "testuser",
      );

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.github.com/gists/abc1234567890def1234",
        expect.objectContaining({
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });
});
