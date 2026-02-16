import type { FastifyInstance } from "fastify";
import { listRecords, getRecord, updateRecord } from "../atproto-repo";
import { generateNonce, formatChallengeText } from "../challenge";
import { getSession } from "../oauth";
import { SESSION_COOKIE_NAME } from "../../src/lib/constants";
import type { MeAttestProof } from "../../types/lexicons";

/** All services defined in the me.attest.proof lexicon */
const VALID_SERVICES: MeAttestProof.Main["service"][] = ["twitter", "github"];

export async function setupProofsRoutes(app: FastifyInstance) {
  /**
   * GET /api/proofs/:did
   * List all proofs for a DID
   */
  app.get<{
    Params: { did: string };
    Querystring: { limit?: string; cursor?: string };
  }>("/api/proofs/:did", async (req, res) => {
    try {
      const { did } = req.params;
      const { limit = "100", cursor } = req.query;

      const result = await listRecords<MeAttestProof.Main>(
        did,
        "me.attest.proof",
        parseInt(limit, 10),
        cursor,
      );

      res.send({
        proofs: result.records.map((r) => ({
          uri: r.uri,
          cid: r.cid,
          ...r.value,
        })),
        cursor: result.cursor,
      });
    } catch (error) {
      console.error("Error listing proofs:", error);
      res.status(500).send({
        error: "Failed to list proofs",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * POST /api/proofs/challenge
   * Generate a new challenge for proof creation
   */
  app.post<{
    Body: { service: string; handle: string };
  }>("/api/proofs/challenge", async (req, res) => {
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

      const { service, handle } = req.body;

      if (!service || !handle) {
        return res
          .status(400)
          .send({ error: "Missing required fields: service, handle" });
      }

      if (!VALID_SERVICES.includes(service)) {
        return res.status(400).send({ error: `Invalid service: ${service}` });
      }

      const nonce = generateNonce(128);
      const challengeText = formatChallengeText(
        sessionData.did,
        service,
        handle,
        nonce,
      );

      res.send({
        nonce,
        challengeText,
        did: sessionData.did,
        service,
        handle,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      });
    } catch (error) {
      console.error("Error generating challenge:", error);
      res.status(500).send({
        error: "Failed to generate challenge",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * POST /api/proofs/verify
   * Verify a proof URL and write to repo
   * Implementation will be completed in Phase 2
   */
  app.post("/api/proofs/verify", async (_req, res) => {
    res
      .status(501)
      .send({ error: "Not yet implemented - will be added in Phase 2" });
  });

  /**
   * DELETE /api/proofs/:rkey
   * Revoke a proof
   */
  app.delete<{
    Params: { rkey: string };
  }>("/api/proofs/:rkey", async (req, res) => {
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

      const uri = `at://${sessionData.did}/me.attest.proof/${rkey}`;
      const current = await getRecord<MeAttestProof.Main>(
        sessionData.did,
        "me.attest.proof",
        rkey,
      );

      // Update status to retracted
      const updated: MeAttestProof.Main = {
        ...current.value,
        status: "retracted",
        retractedAt: new Date().toISOString(),
      };

      await updateRecord<MeAttestProof.Main>(
        { did: sessionData.did },
        uri,
        updated,
      );

      res.send({ success: true, message: "Proof retracted" });
    } catch (error) {
      console.error("Error retracting proof:", error);
      res.status(500).send({
        error: "Failed to retract proof",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
