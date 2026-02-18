import { BaseProofVerifier, type VerificationResult } from "./base-verifier";

export class GitHubVerifier extends BaseProofVerifier {
  getServiceName(): string {
    return "github";
  }

  validateProofUrl(proofUrl: string): boolean {
    // Format: https://gist.github.com/{username}/{gist_id}
    const pattern =
      /^https:\/\/gist\.github\.com\/[a-zA-Z0-9_-]+\/[a-fA-F0-9]{20,}$/;
    return pattern.test(proofUrl);
  }

  normalizeHandle(handle: string): string {
    // Remove @ prefix if present
    return handle.startsWith("@") ? handle.substring(1) : handle;
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
          error: "Invalid gist URL format",
          errorCode: "INVALID_URL",
        };
      }

      const normalizedHandle = this.normalizeHandle(handle);

      // Extract username and gist ID from URL
      // Format: https://gist.github.com/{username}/{gist_id}
      const match = proofUrl.match(
        /gist\.github\.com\/([a-zA-Z0-9_-]+)\/([a-fA-F0-9]{20,})/,
      );
      if (!match) {
        return {
          success: false,
          error: "Could not parse gist URL",
          errorCode: "INVALID_URL",
        };
      }

      const [, username, gistId] = match;

      // Verify username matches handle
      if (username.toLowerCase() !== normalizedHandle.toLowerCase()) {
        return {
          success: false,
          error: "Gist owner does not match handle",
          errorCode: "HANDLE_MISMATCH",
        };
      }

      // Try to fetch gist content directly from GitHub (test for CORS)
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout,
      );

      // Fetch the gist via GitHub API
      const apiUrl = `https://api.github.com/gists/${gistId}`;

      const response = await fetch(apiUrl, {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: "Gist not found",
            errorCode: "GIST_NOT_FOUND",
          };
        }
        return {
          success: false,
          error: `GitHub API error (HTTP ${response.status})`,
          errorCode: "API_ERROR",
        };
      }

      const data = (await response.json()) as {
        files: { content: string }[];
        owner?: { login: string };
      };

      // Verify the gist owner matches
      if (data.owner?.login?.toLowerCase() !== normalizedHandle.toLowerCase()) {
        return {
          success: false,
          error: "Gist owner does not match handle",
          errorCode: "HANDLE_MISMATCH",
        };
      }

      // Check all files for the challenge text — the file must contain
      // exactly the challenge text (ignoring surrounding whitespace).
      // We do not use includes() because that would allow extra content
      // around the challenge, making it trivial to forge.
      let foundChallenge = false;
      for (const file of Object.values(data.files || {})) {
        if (file.content && file.content.trim() === expectedChallenge.trim()) {
          foundChallenge = true;
          break;
        }
      }

      if (!foundChallenge) {
        return {
          success: false,
          error: "Challenge text not found in gist",
          errorCode: "CHALLENGE_NOT_FOUND",
        };
      }

      return {
        success: true,
        details: {
          username,
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
}
