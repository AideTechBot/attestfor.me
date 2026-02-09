import type { OAuthClientMetadata } from "@atproto/oauth-client-node";
import { NodeOAuthClient } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import { store } from "./storage";
import clientMetadataJson from "../public/oauth/client-metadata.json";

interface SessionData {
  did: string;
}

export async function getSession(
  sessionId: string,
): Promise<SessionData | undefined> {
  const data = await store.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : undefined;
}

export async function setSession(
  sessionId: string,
  data: SessionData,
): Promise<void> {
  await store.set(
    `session:${sessionId}`,
    JSON.stringify(data),
    60 * 60 * 24 * 30, // 30 days
  );
}

export async function deleteSession(sessionId: string): Promise<void> {
  await store.del(`session:${sessionId}`);
}

const privateKey = await JoseKey.generate();
const clientMetadata = clientMetadataJson as unknown as OAuthClientMetadata;

export const oauthClient = new NodeOAuthClient({
  clientMetadata,
  keyset: [privateKey],
  handleResolver: "https://bsky.social",
  stateStore: {
    async set(key, internalState) {
      // OAuth state (PKCE verifiers, etc.) - short TTL
      await store.set(`oauth:state:${key}`, JSON.stringify(internalState), 600); // 10 minutes
    },
    async get(key) {
      const data = await store.get(`oauth:state:${key}`);
      return data ? JSON.parse(data) : undefined;
    },
    async del(key) {
      await store.del(`oauth:state:${key}`);
    },
  },
  sessionStore: {
    async set(sub, session) {
      // OAuth session (tokens, DPoP keys, etc.)
      await store.set(
        `oauth:session:${sub}`,
        JSON.stringify(session),
        60 * 60 * 24 * 30,
      ); // 30 days
    },
    async get(sub) {
      const data = await store.get(`oauth:session:${sub}`);
      return data ? JSON.parse(data) : undefined;
    },
    async del(sub) {
      await store.del(`oauth:session:${sub}`);
    },
  },
});
