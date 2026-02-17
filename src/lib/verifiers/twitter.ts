import { BaseProofVerifier, type VerificationResult } from "./base-verifier";

export class TwitterVerifier extends BaseProofVerifier {
  getServiceName(): string {
    return "twitter";
  }

  validateProofUrl(proofUrl: string): boolean {
    // Format: https://twitter.com/{username}/status/{tweet_id} or https://x.com/...
    const pattern =
      /^https:\/\/(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/\d+$/;
    return pattern.test(proofUrl);
  }

  normalizeHandle(handle: string): string {
    // Ensure @ prefix
    return handle.startsWith("@") ? handle : `@${handle}`;
  }

  async verify(
    proofUrl: string,
    expectedChallenge: string,
    handle: string,
  ): Promise<VerificationResult> {
    try {
      if (!this.validateProofUrl(proofUrl)) {
        return {
          success: false,
          error: "Invalid tweet URL format",
          errorCode: "INVALID_URL",
        };
      }

      const normalizedHandle = this.normalizeHandle(handle);

      // Extract username and tweet ID from URL
      const match = proofUrl.match(
        /\/(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/,
      );
      if (!match) {
        return {
          success: false,
          error: "Could not parse tweet URL",
          errorCode: "INVALID_URL",
        };
      }

      const [, , username, tweetId] = match;

      // Verify username matches handle
      if (`@${username.toLowerCase()}` !== normalizedHandle.toLowerCase()) {
        return {
          success: false,
          error: "Tweet author does not match handle",
          errorCode: "HANDLE_MISMATCH",
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout,
      );

      // Use our server proxy (handles guest token + GraphQL)
      const response = await fetch(`/api/twitter/tweet?tweetId=${tweetId}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `Twitter API error (HTTP ${response.status})`,
          errorCode: "API_ERROR",
        };
      }

      const data = await response.json();

      // Extract tweet data from GraphQL response
      const tweetData = this.extractTweetFromGraphQL(data);

      if (!tweetData) {
        return {
          success: false,
          error: "Tweet not found",
          errorCode: "TWEET_NOT_FOUND",
        };
      }

      const { text, screenName } = tweetData;

      // Verify tweet author matches
      if (screenName.toLowerCase() !== username.toLowerCase()) {
        return {
          success: false,
          error: "Tweet author does not match handle",
          errorCode: "HANDLE_MISMATCH",
        };
      }

      // Check if challenge text is in tweet
      if (!this.challengeMatchesTweet(text, expectedChallenge)) {
        return {
          success: false,
          error: "Challenge text not found in tweet",
          errorCode: "CHALLENGE_NOT_FOUND",
        };
      }

      return {
        success: true,
        details: {
          tweetId,
          username: screenName,
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: "Request timeout",
          errorCode: "TIMEOUT",
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "UNKNOWN_ERROR",
      };
    }
  }

  /**
   * Check if challenge text matches tweet, accounting for Twitter's URL shortening.
   * Twitter converts URLs like "example.com" to "https://t.co/xxx"
   */
  private challengeMatchesTweet(
    tweetText: string,
    challengeText: string,
  ): boolean {
    if (tweetText.includes(challengeText)) {
      return true;
    }

    // Build a regex that allows t.co URLs in place of any URL-like text
    let pattern = "";
    let lastIndex = 0;
    const urlRegex = /([a-z0-9-]+\.)+[a-z]{2,}/gi;
    let match;

    while ((match = urlRegex.exec(challengeText)) !== null) {
      const before = challengeText.slice(lastIndex, match.index);
      pattern += before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      pattern += "https?://t\\.co/[A-Za-z0-9]+";
      lastIndex = urlRegex.lastIndex;
    }
    const after = challengeText.slice(lastIndex);
    pattern += after.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return new RegExp(pattern, "i").test(tweetText);
  }

  private extractTweetFromGraphQL(
    data: Record<string, unknown>,
  ): { text: string; screenName: string } | null {
    try {
      // Navigate the TweetResultByRestId response structure
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (data as any).data?.tweetResult?.result;

      if (!result || result.__typename === "TweetUnavailable") {
        return null;
      }

      const text = result.legacy?.full_text;
      const screenName =
        result.core?.user_results?.result?.core?.screen_name ||
        result.core?.user_results?.result?.legacy?.screen_name;

      if (text && screenName) {
        return { text, screenName };
      }

      return null;
    } catch {
      return null;
    }
  }
}
