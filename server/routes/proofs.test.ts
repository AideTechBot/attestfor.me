import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockedFunction,
} from "vitest";

// Mock dependencies before importing
vi.mock("../atproto-repo", () => ({
  listRecords: vi.fn(),
  getRecord: vi.fn(),
  updateRecord: vi.fn(),
}));
vi.mock("../oauth", () => ({
  oauthClient: {},
  getSession: vi.fn(),
  setSession: vi.fn(),
  deleteSession: vi.fn(),
  initializeOAuthClient: vi.fn(),
}));
vi.mock("../challenge", () => ({
  generateNonce: vi.fn(),
  formatChallengeText: vi.fn(),
  validateNonce: vi.fn(),
  parseChallengeText: vi.fn(),
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { setupProofsRoutes } from "./proofs";
import * as atprotoRepo from "../atproto-repo";
import * as oauth from "../oauth";
import * as challenge from "../challenge";

const mockListRecords = atprotoRepo.listRecords as MockedFunction<
  typeof atprotoRepo.listRecords
>;
const mockGetRecord = atprotoRepo.getRecord as MockedFunction<
  typeof atprotoRepo.getRecord
>;
const mockUpdateRecord = atprotoRepo.updateRecord as MockedFunction<
  typeof atprotoRepo.updateRecord
>;
const mockGetSession = oauth.getSession as MockedFunction<
  typeof oauth.getSession
>;
const mockGenerateNonce = challenge.generateNonce as MockedFunction<
  typeof challenge.generateNonce
>;
const mockFormatChallengeText = challenge.formatChallengeText as MockedFunction<
  typeof challenge.formatChallengeText
>;

describe("Proofs API Routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();

    app = Fastify();
    await app.register(fastifyCookie, { secret: "test-secret" });
    await setupProofsRoutes(app);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/proofs/:did", () => {
    it("should list proofs for a DID", async () => {
      const mockProofs = {
        records: [
          {
            uri: "at://did:plc:test/me.attest.proof/abc123",
            cid: "bafyrei123",
            value: {
              service: "twitter",
              handle: "@alice",
              status: "active",
              nonce: "test123",
              proofUrl: "https://twitter.com/alice/status/123",
              createdAt: "2026-02-15T00:00:00Z",
            },
          },
        ],
        cursor: "next-cursor",
      };

      mockListRecords.mockResolvedValue(mockProofs);

      const response = await app.inject({
        method: "GET",
        url: "/api/proofs/did:plc:test",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.proofs).toHaveLength(1);
      expect(data.proofs[0].service).toBe("twitter");
      expect(data.cursor).toBe("next-cursor");
    });

    it("should handle pagination parameters", async () => {
      mockListRecords.mockResolvedValue({ records: [], cursor: undefined });

      await app.inject({
        method: "GET",
        url: "/api/proofs/did:plc:test?limit=50&cursor=test-cursor",
      });

      expect(mockListRecords).toHaveBeenCalledWith(
        "did:plc:test",
        "me.attest.proof",
        50,
        "test-cursor",
      );
    });

    it("should return 500 on error", async () => {
      mockListRecords.mockRejectedValue(new Error("Network error"));

      const response = await app.inject({
        method: "GET",
        url: "/api/proofs/did:plc:test",
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("Failed to list proofs");
    });
  });

  describe("POST /api/proofs/challenge", () => {
    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/proofs/challenge",
        payload: { service: "twitter", handle: "@alice" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 400 with missing fields", async () => {
      mockGetSession.mockResolvedValue({ did: "did:plc:test" });

      const response = await app.inject({
        method: "POST",
        url: "/api/proofs/challenge",
        payload: { service: "twitter" }, // missing handle
        cookies: { session: "valid-session" },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toContain("Missing required fields");
    });

    it("should return 400 with invalid service", async () => {
      mockGetSession.mockResolvedValue({ did: "did:plc:test" });

      const response = await app.inject({
        method: "POST",
        url: "/api/proofs/challenge",
        payload: { service: "invalid_service", handle: "@alice" },
        cookies: { session: "valid-session" },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toContain("Invalid service");
    });

    it("should generate challenge for valid request", async () => {
      mockGetSession.mockResolvedValue({ did: "did:plc:test123" });
      mockGenerateNonce.mockReturnValue("R4nD0mN0nc3");
      mockFormatChallengeText.mockReturnValue(
        "I am did:plc:test123 on AT Protocol.\nVerifying my twitter account @alice for attest.me.\nNonce: R4nD0mN0nc3",
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/proofs/challenge",
        payload: { service: "twitter", handle: "@alice" },
        cookies: { session: "valid-session" },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.nonce).toBe("R4nD0mN0nc3");
      expect(data.did).toBe("did:plc:test123");
      expect(data.service).toBe("twitter");
      expect(data.handle).toBe("@alice");
      expect(data.challengeText).toContain("twitter account");
      expect(data.expiresAt).toBeTruthy();
    });

    it("should accept all valid services", async () => {
      mockGetSession.mockResolvedValue({ did: "did:plc:test" });
      mockGenerateNonce.mockReturnValue("nonce");
      mockFormatChallengeText.mockReturnValue("challenge");

      const validServices = ["twitter", "github"];

      for (const service of validServices) {
        const response = await app.inject({
          method: "POST",
          url: "/api/proofs/challenge",
          payload: { service, handle: "test" },
          cookies: { session: "valid-session" },
        });

        expect(response.statusCode).toBe(200);
      }
    });
  });

  describe("DELETE /api/proofs/:rkey", () => {
    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/proofs/abc123",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should retract a proof", async () => {
      mockGetSession.mockResolvedValue({ did: "did:plc:test" });
      mockGetRecord.mockResolvedValue({
        uri: "at://did:plc:test/me.attest.proof/abc123",
        cid: "bafyrei123",
        value: {
          service: "twitter",
          handle: "@alice",
          status: "active",
          nonce: "test",
          proofUrl: "https://example.com",
          createdAt: "2026-02-15T00:00:00Z",
        },
      });
      mockUpdateRecord.mockResolvedValue({
        uri: "at://did:plc:test/me.attest.proof/abc123",
        cid: "bafyrei456",
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/proofs/abc123",
        cookies: { session: "valid-session" },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Proof retracted");

      // Verify the update was called with status: retracted
      expect(mockUpdateRecord).toHaveBeenCalledWith(
        { did: "did:plc:test" },
        "at://did:plc:test/me.attest.proof/abc123",
        expect.objectContaining({ status: "retracted" }),
      );
    });

    it("should return 500 on error", async () => {
      mockGetSession.mockResolvedValue({ did: "did:plc:test" });
      mockGetRecord.mockRejectedValue(new Error("Not found"));

      const response = await app.inject({
        method: "DELETE",
        url: "/api/proofs/abc123",
        cookies: { session: "valid-session" },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("Failed to retract proof");
    });
  });
});
