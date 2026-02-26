import type { FastifyInstance } from "fastify";
import { Client } from "@atcute/client";
import type {} from "@atcute/atproto";
import { oauthClient, getSession } from "../oauth";
import { SESSION_COOKIE_NAME } from "../../src/lib/constants";

// Augment FastifyRequest with cookie support from @fastify/cookie
declare module "fastify" {
  interface FastifyRequest {
    cookies: Record<string, string | undefined>;
  }
}

// --- Validation helpers ---

const DID_RE = /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/;
const COLLECTION_RE = /^[a-zA-Z][a-zA-Z0-9-]*(?:\.[a-zA-Z][a-zA-Z0-9-]*){2,}$/;

function isDid(value: string): value is `did:${string}:${string}` {
  return DID_RE.test(value);
}

function isCollection(value: string): value is `${string}.${string}.${string}` {
  return COLLECTION_RE.test(value);
}

// JSON Schema for Fastify body validation
const createRecordSchema = {
  body: {
    type: "object" as const,
    required: ["collection", "record"],
    properties: {
      collection: { type: "string" },
      record: { type: "object" },
      rkey: { type: "string" },
    },
    additionalProperties: false,
  },
};

const deleteRecordSchema = {
  body: {
    type: "object" as const,
    required: ["collection", "rkey"],
    properties: {
      collection: { type: "string" },
      rkey: { type: "string" },
    },
    additionalProperties: false,
  },
};

const putRecordSchema = {
  body: {
    type: "object" as const,
    required: ["collection", "rkey", "record"],
    properties: {
      collection: { type: "string" },
      rkey: { type: "string" },
      record: { type: "object" },
    },
    additionalProperties: false,
  },
};

// --- Route types ---

interface CreateRecordBody {
  collection: string;
  record: Record<string, unknown>;
  rkey?: string;
}

interface DeleteRecordBody {
  collection: string;
  rkey: string;
}

interface PutRecordBody {
  collection: string;
  rkey: string;
  record: Record<string, unknown>;
}

export async function registerRepoProxy(app: FastifyInstance) {
  /**
   * POST /api/repo/createRecord
   * Create a record in the authenticated user's AT Proto repository.
   *
   * Body: { collection: string, record: object, rkey?: string }
   * Returns: { uri: string, cid: string }
   */
  app.post<{ Body: CreateRecordBody }>(
    "/api/repo/createRecord",
    { schema: createRecordSchema },
    async (req, res) => {
      const sessionId = req.cookies[SESSION_COOKIE_NAME];
      if (!sessionId) {
        return res.status(401).send({ error: "Not authenticated" });
      }

      const sessionData = await getSession(sessionId);
      if (!sessionData) {
        return res.status(401).send({ error: "Session expired" });
      }

      const { collection, record, rkey } = req.body;

      if (!isDid(sessionData.did)) {
        return res.status(500).send({ error: "Invalid session DID format" });
      }

      if (!isCollection(collection)) {
        return res
          .status(400)
          .send({ error: "Invalid collection format (expected a.b.c)" });
      }

      try {
        const session = await oauthClient.restore(sessionData.did);
        const client = new Client({ handler: session });

        const result = await client.post("com.atproto.repo.createRecord", {
          input: {
            repo: sessionData.did,
            collection,
            rkey,
            record,
          },
        });

        if ("error" in result.data) {
          throw new Error(result.data.message ?? result.data.error);
        }

        return res.send({
          uri: result.data.uri,
          cid: result.data.cid,
        });
      } catch (error: unknown) {
        console.error("[repo-proxy] createRecord error:", error);
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return res
          .status(500)
          .send({ error: "Failed to create record", message });
      }
    },
  );

  /**
   * POST /api/repo/deleteRecord
   * Delete a record from the authenticated user's AT Proto repository.
   *
   * Body: { collection: string, rkey: string }
   */
  app.post<{ Body: DeleteRecordBody }>(
    "/api/repo/deleteRecord",
    { schema: deleteRecordSchema },
    async (req, res) => {
      const sessionId = req.cookies[SESSION_COOKIE_NAME];
      if (!sessionId) {
        return res.status(401).send({ error: "Not authenticated" });
      }

      const sessionData = await getSession(sessionId);
      if (!sessionData) {
        return res.status(401).send({ error: "Session expired" });
      }

      const { collection, rkey } = req.body;

      if (!isDid(sessionData.did)) {
        return res.status(500).send({ error: "Invalid session DID format" });
      }

      if (!isCollection(collection)) {
        return res
          .status(400)
          .send({ error: "Invalid collection format (expected a.b.c)" });
      }

      try {
        const session = await oauthClient.restore(sessionData.did);
        const client = new Client({ handler: session });

        await client.post("com.atproto.repo.deleteRecord", {
          input: {
            repo: sessionData.did,
            collection,
            rkey,
          },
        });

        return res.send({ success: true });
      } catch (error: unknown) {
        console.error("[repo-proxy] deleteRecord error:", error);
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return res
          .status(500)
          .send({ error: "Failed to delete record", message });
      }
    },
  );

  /**
   * POST /api/repo/putRecord
   * Create or update a record at a specific rkey in the authenticated user's AT Proto repository.
   *
   * Body: { collection: string, rkey: string, record: object }
   * Returns: { uri: string, cid: string }
   */
  app.post<{ Body: PutRecordBody }>(
    "/api/repo/putRecord",
    { schema: putRecordSchema },
    async (req, res) => {
      const sessionId = req.cookies[SESSION_COOKIE_NAME];
      if (!sessionId) {
        return res.status(401).send({ error: "Not authenticated" });
      }

      const sessionData = await getSession(sessionId);
      if (!sessionData) {
        return res.status(401).send({ error: "Session expired" });
      }

      const { collection, rkey, record } = req.body;

      if (!isDid(sessionData.did)) {
        return res.status(500).send({ error: "Invalid session DID format" });
      }

      if (!isCollection(collection)) {
        return res
          .status(400)
          .send({ error: "Invalid collection format (expected a.b.c)" });
      }

      try {
        const session = await oauthClient.restore(sessionData.did);
        const client = new Client({ handler: session });

        const result = await client.post("com.atproto.repo.putRecord", {
          input: {
            repo: sessionData.did,
            collection,
            rkey,
            record,
          },
        });

        if ("error" in result.data) {
          throw new Error(result.data.message ?? result.data.error);
        }

        return res.send({
          uri: result.data.uri,
          cid: result.data.cid,
        });
      } catch (error: unknown) {
        console.error("[repo-proxy] putRecord error:", error);
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return res.status(500).send({ error: "Failed to put record", message });
      }
    },
  );
}
