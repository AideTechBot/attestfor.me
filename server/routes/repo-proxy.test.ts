/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the oauth module before importing
vi.mock("../oauth", () => ({
  oauthClient: {
    restore: vi.fn(),
  },
  getSession: vi.fn(),
}));

// Mock @atcute/client
const mockPost = vi.fn();
vi.mock("@atcute/client", () => ({
  Client: vi.fn().mockImplementation(function () {
    return { post: mockPost };
  }),
}));

import { oauthClient, getSession } from "../oauth";

// Minimal Fastify-like test harness
function createMockReqRes(options: {
  cookies?: Record<string, string>;
  body?: unknown;
}) {
  const req = {
    cookies: options.cookies || {},
    body: options.body || {},
  };

  let statusCode = 200;
  let responseBody: unknown = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    send(body: unknown) {
      responseBody = body;
      return res;
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getBody: () => responseBody,
  };
}

describe("repo-proxy", () => {
  let createRecordHandler: (req: any, res: any) => Promise<any>;
  let deleteRecordHandler: (req: any, res: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Capture route handlers registered by registerRepoProxy
    const handlers: Record<string, (req: any, res: any) => Promise<any>> = {};
    const mockApp = {
      post: (path: string, ...args: any[]) => {
        // Fastify: post(path, handler) or post(path, opts, handler)
        handlers[path] = args.length === 2 ? args[1] : args[0];
      },
    };

    const { registerRepoProxy } = await import("./repo-proxy");
    await registerRepoProxy(mockApp as any);

    createRecordHandler = handlers["/api/repo/createRecord"];
    deleteRecordHandler = handlers["/api/repo/deleteRecord"];
  });

  describe("POST /api/repo/createRecord", () => {
    it("returns 401 when no session cookie", async () => {
      const { req, res, getStatus, getBody } = createMockReqRes({
        cookies: {},
      });

      await createRecordHandler(req, res);

      expect(getStatus()).toBe(401);
      expect(getBody()).toEqual({ error: "Not authenticated" });
    });

    it("returns 401 when session expired", async () => {
      (getSession as any).mockResolvedValueOnce(undefined);

      const { req, res, getStatus, getBody } = createMockReqRes({
        cookies: { session: "expired-id" },
      });

      await createRecordHandler(req, res);

      expect(getStatus()).toBe(401);
      expect(getBody()).toEqual({ error: "Session expired" });
    });

    it("returns 400 when missing collection", async () => {
      (getSession as any).mockResolvedValueOnce({ did: "did:plc:test" });

      const { req, res, getStatus, getBody } = createMockReqRes({
        cookies: { session: "valid-id" },
        body: { record: { foo: "bar" } },
      });

      await createRecordHandler(req, res);

      expect(getStatus()).toBe(400);
      expect(getBody()).toEqual({
        error: "Invalid collection format (expected a.b.c)",
      });
    });

    it("returns 400 when collection has invalid format", async () => {
      (getSession as any).mockResolvedValueOnce({ did: "did:plc:test" });

      const { req, res, getStatus, getBody } = createMockReqRes({
        cookies: { session: "valid-id" },
        body: { collection: "bad-collection", record: { foo: "bar" } },
      });

      await createRecordHandler(req, res);

      expect(getStatus()).toBe(400);
      expect(getBody()).toEqual({
        error: "Invalid collection format (expected a.b.c)",
      });
    });

    it("proxies createRecord with correct params", async () => {
      mockPost.mockResolvedValueOnce({
        data: { uri: "at://did:plc:test/me.attest.key/abc", cid: "baf123" },
      });
      (getSession as any).mockResolvedValueOnce({ did: "did:plc:test" });
      (oauthClient.restore as any).mockResolvedValueOnce({});

      const record = {
        keyType: "pgp",
        publicKey: "...",
        createdAt: "2026-01-01T00:00:00Z",
      };
      const { req, res, getBody } = createMockReqRes({
        cookies: { session: "valid-id" },
        body: { collection: "me.attest.key", record, rkey: "custom-rkey" },
      });

      await createRecordHandler(req, res);

      expect(oauthClient.restore).toHaveBeenCalledWith("did:plc:test");
      expect(mockPost).toHaveBeenCalledWith("com.atproto.repo.createRecord", {
        input: {
          repo: "did:plc:test",
          collection: "me.attest.key",
          rkey: "custom-rkey",
          record,
        },
      });
      expect(getBody()).toEqual({
        uri: "at://did:plc:test/me.attest.key/abc",
        cid: "baf123",
      });
    });

    it("returns 500 on PDS failure", async () => {
      (getSession as any).mockResolvedValueOnce({ did: "did:plc:test" });
      (oauthClient.restore as any).mockRejectedValueOnce(
        new Error("Token expired"),
      );

      const { req, res, getStatus, getBody } = createMockReqRes({
        cookies: { session: "valid-id" },
        body: { collection: "me.attest.key", record: { foo: "bar" } },
      });

      await createRecordHandler(req, res);

      expect(getStatus()).toBe(500);
      expect((getBody() as any).error).toBe("Failed to create record");
      expect((getBody() as any).message).toBe("Token expired");
    });
  });

  describe("POST /api/repo/deleteRecord", () => {
    it("returns 401 when no session cookie", async () => {
      const { req, res, getStatus, getBody } = createMockReqRes({
        cookies: {},
      });

      await deleteRecordHandler(req, res);

      expect(getStatus()).toBe(401);
      expect(getBody()).toEqual({ error: "Not authenticated" });
    });

    it("returns 401 when session expired", async () => {
      (getSession as any).mockResolvedValueOnce(undefined);

      const { req, res, getStatus, getBody } = createMockReqRes({
        cookies: { session: "expired-id" },
      });

      await deleteRecordHandler(req, res);

      expect(getStatus()).toBe(401);
      expect(getBody()).toEqual({ error: "Session expired" });
    });

    it("returns 400 when missing collection", async () => {
      (getSession as any).mockResolvedValueOnce({ did: "did:plc:test" });

      const { req, res, getStatus, getBody } = createMockReqRes({
        cookies: { session: "valid-id" },
        body: { rkey: "abc" },
      });

      await deleteRecordHandler(req, res);

      expect(getStatus()).toBe(400);
      expect(getBody()).toEqual({
        error: "Invalid collection format (expected a.b.c)",
      });
    });

    it("returns 400 when collection has invalid format", async () => {
      (getSession as any).mockResolvedValueOnce({ did: "did:plc:test" });

      const { req, res, getStatus, getBody } = createMockReqRes({
        cookies: { session: "valid-id" },
        body: { collection: "not-valid", rkey: "abc" },
      });

      await deleteRecordHandler(req, res);

      expect(getStatus()).toBe(400);
      expect(getBody()).toEqual({
        error: "Invalid collection format (expected a.b.c)",
      });
    });

    it("proxies deleteRecord with correct params", async () => {
      mockPost.mockResolvedValueOnce({});
      (getSession as any).mockResolvedValueOnce({ did: "did:plc:test" });
      (oauthClient.restore as any).mockResolvedValueOnce({});

      const { req, res, getBody } = createMockReqRes({
        cookies: { session: "valid-id" },
        body: { collection: "me.attest.key", rkey: "delete-me" },
      });

      await deleteRecordHandler(req, res);

      expect(oauthClient.restore).toHaveBeenCalledWith("did:plc:test");
      expect(mockPost).toHaveBeenCalledWith("com.atproto.repo.deleteRecord", {
        input: {
          repo: "did:plc:test",
          collection: "me.attest.key",
          rkey: "delete-me",
        },
      });
      expect(getBody()).toEqual({ success: true });
    });

    it("returns 500 on PDS failure", async () => {
      mockPost.mockRejectedValueOnce(new Error("Record not found"));
      (getSession as any).mockResolvedValueOnce({ did: "did:plc:test" });
      (oauthClient.restore as any).mockResolvedValueOnce({});

      const { req, res, getStatus, getBody } = createMockReqRes({
        cookies: { session: "valid-id" },
        body: { collection: "me.attest.key", rkey: "bad-rkey" },
      });

      await deleteRecordHandler(req, res);

      expect(getStatus()).toBe(500);
      expect((getBody() as any).error).toBe("Failed to delete record");
      expect((getBody() as any).message).toBe("Record not found");
    });
  });
});
