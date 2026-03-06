import {
  OAuthClient,
  MemoryStore,
  type StoredState,
  type StoredSession,
  type OAuthSession,
  type Store,
} from "@atcute/oauth-node-client";
import {
  LocalActorResolver,
  CompositeHandleResolver,
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from "@atcute/identity-resolver";
import { NodeDnsHandleResolver } from "@atcute/identity-resolver-node";
import type { Did } from "@atcute/lexicons/syntax";
import { store } from "./storage";
import clientMetadataJson from "../public/oauth/client-metadata.json";

interface SessionData {
  did: Did;
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

/**
 * Create a Store<K,V> adapter backed by our Redis/in-memory store.
 * The @atcute Store interface uses: get, set, delete, clear
 */
function createStoreAdapter<K extends string, V>(
  prefix: string,
  ttlSeconds?: number,
): Store<K, V> {
  return {
    async get(key: K): Promise<V | undefined> {
      const data = await store.get(`${prefix}${key}`);
      return data ? JSON.parse(data) : undefined;
    },
    async set(key: K, value: V): Promise<void> {
      await store.set(`${prefix}${key}`, JSON.stringify(value), ttlSeconds);
    },
    async delete(key: K): Promise<void> {
      await store.del(`${prefix}${key}`);
    },
    async clear(): Promise<void> {
      // Not easily implementable with Redis key-prefix store,
      // but @atcute only calls this for cleanup on shutdown
    },
  };
}

let oauthClient: OAuthClient;

// Cache restored OAuth sessions to avoid repeated DID resolution
const sessionCache = new Map<string, { session: OAuthSession; expiresAt: number }>();
const SESSION_CACHE_TTL_MS = 60_000; // 1 minute

export async function restoreSession(did: Did): Promise<OAuthSession> {
  const cached = sessionCache.get(did);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.session;
  }

  const session = await oauthClient.restore(did);
  sessionCache.set(did, {
    session,
    expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
  });
  return session;
}

export function initializeOAuthClient(): OAuthClient {
  if (oauthClient) {
    return oauthClient;
  }

  oauthClient = new OAuthClient({
    metadata: {
      client_id: clientMetadataJson.client_id,
      redirect_uris: clientMetadataJson.redirect_uris as [string, ...string[]],
      scope: clientMetadataJson.scope,
    },
    // No keyset — this is a public client (token_endpoint_auth_method: "none")

    actorResolver: new LocalActorResolver({
      handleResolver: new CompositeHandleResolver({
        methods: {
          dns: new NodeDnsHandleResolver(),
          http: new WellKnownHandleResolver(),
        },
      }),
      didDocumentResolver: new CompositeDidDocumentResolver({
        methods: {
          plc: new PlcDidDocumentResolver(),
          web: new WebDidDocumentResolver(),
        },
      }),
    }),

    stores: {
      sessions: createStoreAdapter<Did, StoredSession>(
        "oauth:session:",
        60 * 60 * 24 * 30, // 30 days
      ),
      states: new MemoryStore<string, StoredState>({
        maxSize: 1000,
        ttl: 10 * 60 * 1000, // 10 minutes
        ttlAutopurge: true,
      }),
    },
  });

  return oauthClient;
}

export { oauthClient };
export type { OAuthSession };
