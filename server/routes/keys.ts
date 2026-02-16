import type { FastifyInstance } from "fastify";
import { listRecords, getRecord, updateRecord } from "../atproto-repo";
import { getSession } from "../oauth";
import { SESSION_COOKIE_NAME } from "../../src/lib/constants";

export async function setupKeysRoutes(app: FastifyInstance) {
  /**
   * GET /api/keys/:did
   * List all public keys for a DID
   */
  app.get<{
    Params: { did: string };
    Querystring: { limit?: string; cursor?: string };
  }>("/api/keys/:did", async (req, res) => {
    try {
      const { did } = req.params;
      const { limit = "100", cursor } = req.query;

      const result = await listRecords(
        did,
        "me.attest.key",
        parseInt(limit, 10),
        cursor,
      );

      res.send({
        keys: result.records.map((r) => ({
          uri: r.uri,
          cid: r.cid,
          ...r.value,
        })),
        cursor: result.cursor,
      });
    } catch (error) {
      console.error("Error listing keys:", error);
      res.status(500).send({
        error: "Failed to list keys",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * POST /api/keys
   * Publish a new public key
   * Full implementation in Phase 3
   */
  app.post("/api/keys", async (_req, res) => {
    res
      .status(501)
      .send({ error: "Not yet implemented - will be added in Phase 3" });
  });

  /**
   * DELETE /api/keys/:rkey
   * Revoke a key
   */
  app.delete<{
    Params: { rkey: string };
  }>("/api/keys/:rkey", async (req, res) => {
    try {
      const sessionId = (req.cookies as Record<string, string>)[
        SESSION_COOKIE_NAME
      ];
      if (!sessionId) {
        return res.status(401).send({ error: "Unauthorized" });
      }

      const sessionData = await getSession(sessionId);
      if (!sessionData) {
        return res.status(401).send({ error: "Unauthorized" });
      }

      const { rkey } = req.params;

      const uri = `at://${sessionData.did}/me.attest.key/${rkey}`;
      const current = await getRecord(sessionData.did, "me.attest.key", rkey);

      const updated = {
        ...current.value,
        status: "revoked",
      };

      await updateRecord({ did: sessionData.did }, uri, updated);

      res.send({ success: true, message: "Key revoked" });
    } catch (error) {
      console.error("Error revoking key:", error);
      res.status(500).send({
        error: "Failed to revoke key",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
