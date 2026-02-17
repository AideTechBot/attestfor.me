/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TwitterVerifier } from "./twitter";

// Helper to build a GraphQL response matching the TweetResultByRestId structure
function mockGraphQLResponse(
  text: string,
  screenName: string,
  typename = "Tweet",
) {
  return {
    data: {
      tweetResult: {
        result: {
          __typename: typename,
          legacy: { full_text: text },
          core: {
            user_results: {
              result: { core: { screen_name: screenName } },
            },
          },
        },
      },
    },
  };
}

describe("TwitterVerifier", () => {
  let verifier: TwitterVerifier;

  beforeEach(() => {
    verifier = new TwitterVerifier();
  });

  describe("validateProofUrl", () => {
    it("should accept valid twitter.com URLs", () => {
      expect(
        verifier.validateProofUrl(
          "https://twitter.com/username/status/1234567890",
        ),
      ).toBe(true);
    });

    it("should accept valid x.com URLs", () => {
      expect(
        verifier.validateProofUrl("https://x.com/username/status/1234567890"),
      ).toBe(true);
    });

    it("should reject invalid URLs", () => {
      expect(verifier.validateProofUrl("https://twitter.com/username")).toBe(
        false,
      );
      expect(verifier.validateProofUrl("https://example.com/tweet")).toBe(
        false,
      );
      expect(verifier.validateProofUrl("https://twitter.com/status/123")).toBe(
        false,
      );
    });
  });

  describe("normalizeHandle", () => {
    it("should add @ prefix if missing", () => {
      expect(verifier.normalizeHandle("username")).toBe("@username");
    });

    it("should keep @ prefix if present", () => {
      expect(verifier.normalizeHandle("@username")).toBe("@username");
    });
  });

  describe("verify", () => {
    const challengeText =
      "I am did:plc:test on AT Protocol.\nVerifying my twitter account @testuser for attestforme.\nNonce: abc123";

    it("should successfully verify a tweet via proxy", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(mockGraphQLResponse(challengeText, "testuser")),
      });

      const result = await verifier.verify(
        "https://twitter.com/testuser/status/123",
        challengeText,
        "@testuser",
      );

      expect(result.success).toBe(true);
      expect(result.details?.username).toBe("testuser");
      expect(result.details?.tweetId).toBe("123");
    });

    it("should pass tweetId to proxy endpoint", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(mockGraphQLResponse(challengeText, "testuser")),
      });

      await verifier.verify(
        "https://x.com/testuser/status/99887766",
        challengeText,
        "@testuser",
      );

      const fetchCall = (globalThis.fetch as any).mock.calls[0][0];
      expect(fetchCall).toContain("/api/twitter/tweet");
      expect(fetchCall).toContain("tweetId=99887766");
    });

    it("should fail if API response is not ok", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await verifier.verify(
        "https://twitter.com/testuser/status/123",
        challengeText,
        "@testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("API_ERROR");
    });

    it("should fail if handle mismatch in URL", async () => {
      const result = await verifier.verify(
        "https://twitter.com/user1/status/123",
        challengeText,
        "@user2",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("HANDLE_MISMATCH");
    });

    it("should fail if tweet author mismatch in API response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(mockGraphQLResponse(challengeText, "otheruser")),
      });

      const result = await verifier.verify(
        "https://twitter.com/testuser/status/123",
        challengeText,
        "@testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("HANDLE_MISMATCH");
    });

    it("should fail if challenge not found in tweet", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(
            mockGraphQLResponse("Some unrelated tweet", "testuser"),
          ),
      });

      const result = await verifier.verify(
        "https://twitter.com/testuser/status/123",
        "challenge text that doesn't exist",
        "@testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("CHALLENGE_NOT_FOUND");
    });

    it("should fail if tweet is unavailable", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              tweetResult: {
                result: { __typename: "TweetUnavailable" },
              },
            },
          }),
      });

      const result = await verifier.verify(
        "https://twitter.com/testuser/status/123",
        challengeText,
        "@testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("TWEET_NOT_FOUND");
    });

    it("should fail if GraphQL response has no tweet data", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      const result = await verifier.verify(
        "https://twitter.com/testuser/status/123",
        challengeText,
        "@testuser",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("TWEET_NOT_FOUND");
    });
  });

  describe("challengeMatchesTweet", () => {
    it("should match exact challenge text", () => {
      const challenge = "Verifying my twitter account @user for attestforme";
      const tweet = "Verifying my twitter account @user for attestforme";

      // @ts-expect-error - testing private method
      expect(verifier.challengeMatchesTweet(tweet, challenge)).toBe(true);
    });

    it("should match challenge with newlines", () => {
      const challenge =
        "Verifying my twitter account @user for attestforme.\nNonce: abc123";
      const tweet =
        "Verifying my twitter account @user for attestforme.\nNonce: abc123";

      // @ts-expect-error - testing private method
      expect(verifier.challengeMatchesTweet(tweet, challenge)).toBe(true);
    });

    it("should handle URL replacement by Twitter", () => {
      const challenge = "Check out example.com for more info";
      const tweet = "Check out https://t.co/abc123xyz for more info";

      // @ts-expect-error - testing private method
      expect(verifier.challengeMatchesTweet(tweet, challenge)).toBe(true);
    });

    it("should not match different text", () => {
      const challenge = "Original text";
      const tweet = "Different text";

      // @ts-expect-error - testing private method
      expect(verifier.challengeMatchesTweet(tweet, challenge)).toBe(false);
    });
  });

  describe("extractTweetFromGraphQL", () => {
    it("should extract tweet text and screen name from valid response", () => {
      const response = mockGraphQLResponse("Test tweet", "testuser");

      // @ts-expect-error - testing private method
      const result = verifier.extractTweetFromGraphQL(response);

      expect(result).toEqual({
        text: "Test tweet",
        screenName: "testuser",
      });
    });

    it("should fallback to legacy screen_name path", () => {
      const response = {
        data: {
          tweetResult: {
            result: {
              __typename: "Tweet",
              legacy: { full_text: "Test tweet" },
              core: {
                user_results: {
                  result: {
                    legacy: { screen_name: "testuser" },
                  },
                },
              },
            },
          },
        },
      };

      // @ts-expect-error - testing private method
      const result = verifier.extractTweetFromGraphQL(response);

      expect(result).toEqual({
        text: "Test tweet",
        screenName: "testuser",
      });
    });

    it("should return null for unavailable tweets", () => {
      const response = {
        data: {
          tweetResult: {
            result: { __typename: "TweetUnavailable" },
          },
        },
      };

      // @ts-expect-error - testing private method
      const result = verifier.extractTweetFromGraphQL(response);

      expect(result).toBeNull();
    });

    it("should return null for missing data", () => {
      const response = {
        data: {
          tweetResult: {
            result: { __typename: "Tweet" },
          },
        },
      };

      // @ts-expect-error - testing private method
      const result = verifier.extractTweetFromGraphQL(response);

      expect(result).toBeNull();
    });
  });

  describe("error handling", () => {
    it("should handle invalid URL format", async () => {
      const result = await verifier.verify(
        "https://invalid.com/tweet",
        "challenge",
        "@user",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("INVALID_URL");
    });

    it("should handle network timeouts", async () => {
      globalThis.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            const error = new Error("Timeout");
            error.name = "AbortError";
            reject(error);
          }),
      );

      const result = await verifier.verify(
        "https://twitter.com/user/status/123",
        "challenge",
        "@user",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("TIMEOUT");
    });

    it("should handle parse errors from URL", async () => {
      const result = await verifier.verify(
        "https://twitter.com/user/not-a-status/abc",
        "challenge",
        "@user",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("INVALID_URL");
    });

    it("should handle network errors", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await verifier.verify(
        "https://twitter.com/user/status/123",
        "challenge",
        "@user",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("UNKNOWN_ERROR");
      expect(result.error).toBe("Network error");
    });
  });
});
