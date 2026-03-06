/**
 * Tests that the @keytrace/runner patch correctly threads a custom `fetch`
 * function through `verifyClaim` → fetchers instead of using `globalThis.fetch`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClaim, verifyClaim, ClaimStatus } from "@keytrace/runner";

// A fake DID that passes the runner's did:plc validation (24 base32 chars)
const FAKE_DID = "did:plc:abcdefghijklmnopqrstuvwx";

// A GitHub Gist URI the runner's github provider will match
const GIST_URI = "https://gist.github.com/testuser/aabbccdd11223344";

// Gist API response containing the DID in a keytrace.json file
function gistApiResponse(did: string) {
  return {
    id: "aabbccdd11223344",
    description: "",
    owner: { login: "testuser", avatar_url: "https://example.com/avatar.png" },
    files: {
      "keytrace.json": {
        content: JSON.stringify({ did }),
      },
    },
  };
}

describe("@keytrace/runner patch – custom fetch injection", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  // Restore in case a test mutates it (it shouldn't after the patch!)
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls the injected fetch instead of globalThis.fetch", async () => {
    const mockFetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify(gistApiResponse(FAKE_DID)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    // Spy on globalThis.fetch to ensure it's NOT called
    const globalSpy = vi.spyOn(globalThis, "fetch");

    const claim = createClaim(GIST_URI, FAKE_DID);
    const result = await verifyClaim(claim, { fetch: mockFetch });

    expect(mockFetch).toHaveBeenCalled();
    expect(globalSpy).not.toHaveBeenCalled();
    expect(result.status).toBe(ClaimStatus.VERIFIED);

    globalSpy.mockRestore();
  });

  it("passes the correct URL to the injected fetch", async () => {
    const mockFetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify(gistApiResponse(FAKE_DID)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const claim = createClaim(GIST_URI, FAKE_DID);
    await verifyClaim(claim, { fetch: mockFetch });

    // The github provider rewrites gist.github.com → api.github.com/gists/{id}
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe("https://api.github.com/gists/aabbccdd11223344");
  });

  it("falls back to globalThis.fetch when no custom fetch is provided", async () => {
    const globalSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(gistApiResponse(FAKE_DID)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const claim = createClaim(GIST_URI, FAKE_DID);
    const result = await verifyClaim(claim, {});

    expect(globalSpy).toHaveBeenCalled();
    expect(result.status).toBe(ClaimStatus.VERIFIED);

    globalSpy.mockRestore();
  });

  it("reports FAILED when the DID is not in the proof content", async () => {
    const mockFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify(gistApiResponse("did:plc:zzzzzzzzzzzzzzzzzzzzzzzz")),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const claim = createClaim(GIST_URI, FAKE_DID);
    const result = await verifyClaim(claim, { fetch: mockFetch });

    expect(mockFetch).toHaveBeenCalled();
    expect(result.status).toBe(ClaimStatus.FAILED);
  });

  it("reports ERROR when the injected fetch throws", async () => {
    const mockFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new Error("Network failure"));

    const claim = createClaim(GIST_URI, FAKE_DID);
    const result = await verifyClaim(claim, { fetch: mockFetch });

    expect(mockFetch).toHaveBeenCalled();
    // Runner catches fetcher errors internally and returns FAILED status
    expect(result.status).toBe(ClaimStatus.FAILED);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
