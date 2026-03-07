/**
 * Client-side AT Proto repository utilities.
 * Uses the public Bluesky API for reads (no auth needed)
 * and the user's PDS for writes (via OAuth session).
 */

const FALLBACK_PDS = "https://bsky.social";
const PLC_DIRECTORY = "https://plc.directory";
const DEFAULT_LIST_LIMIT = 100;

// ── PDS resolution ─────────────────────────────────────────────────

/**
 * Simple in-memory cache for DID -> PDS endpoint mappings.
 * Avoids repeated DID document lookups for the same user.
 */
const pdsCache = new Map<string, { pds: string; expiresAt: number }>();
const PDS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Resolve the PDS endpoint for a given DID by fetching its DID document.
 * Supports did:plc (via plc.directory) and did:web (via .well-known).
 * Falls back to bsky.social if resolution fails.
 */
export async function resolvePds(did: string): Promise<string> {
  // Check cache first
  const cached = pdsCache.get(did);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.pds;
  }

  try {
    let url: string;
    if (did.startsWith("did:plc:")) {
      url = `${PLC_DIRECTORY}/${did}`;
    } else if (did.startsWith("did:web:")) {
      const host = did.slice("did:web:".length).replace(/%3A/g, ":");
      url = `https://${host}/.well-known/did.json`;
    } else {
      return FALLBACK_PDS;
    }

    const res = await fetch(url);
    if (!res.ok) {
      return FALLBACK_PDS;
    }

    const doc = await res.json();
    const pdsService = (doc.service ?? []).find(
      (s: { id: string; type: string }) =>
        s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer",
    );

    const pds = pdsService?.serviceEndpoint ?? FALLBACK_PDS;

    pdsCache.set(did, { pds, expiresAt: Date.now() + PDS_CACHE_TTL_MS });
    return pds;
  } catch {
    return FALLBACK_PDS;
  }
}

// ── Types ──────────────────────────────────────────────────────────

export interface AtProtoRecord<T = Record<string, unknown>> {
  uri: string;
  cid: string;
  value: T;
}

export interface ListRecordsResult<T = Record<string, unknown>> {
  records: AtProtoRecord<T>[];
  cursor?: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function xrpcUrl(
  pds: string,
  method: string,
  params: Record<string, string | number>,
): string {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  return `${pds}/xrpc/${method}?${qs}`;
}

export function parseAtUri(uri: string): {
  repo: string;
  collection: string;
  rkey: string;
} {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid AT URI: ${uri}`);
  }
  return { repo: match[1], collection: match[2], rkey: match[3] };
}

// ── Public reads (no auth) ─────────────────────────────────────────

/**
 * Get a single record from a user's repository (public, no auth)
 */
export async function getRecord<T = Record<string, unknown>>(
  repo: string,
  collection: string,
  rkey: string,
): Promise<AtProtoRecord<T>> {
  const pds = await resolvePds(repo);
  const url = xrpcUrl(pds, "com.atproto.repo.getRecord", {
    repo,
    collection,
    rkey,
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to get record: HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    uri: data.uri,
    cid: data.cid || "",
    value: data.value as T,
  };
}

/**
 * List records from a collection in a user's repository (public, no auth)
 */
export async function listRecords<T = Record<string, unknown>>(
  repo: string,
  collection: string,
  limit: number = DEFAULT_LIST_LIMIT,
  cursor?: string,
): Promise<ListRecordsResult<T>> {
  const params: Record<string, string | number> = { repo, collection, limit };
  if (cursor) {
    params.cursor = cursor;
  }

  const pds = await resolvePds(repo);
  const url = xrpcUrl(pds, "com.atproto.repo.listRecords", params);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to list records: HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    records: (data.records || []).map(
      (r: { uri: string; cid: string; value: unknown }) => ({
        uri: r.uri,
        cid: r.cid,
        value: r.value as T,
      }),
    ),
    cursor: data.cursor,
  };
}

// ── Claim & key helpers ────────────────────────────────────────────

import type {
  DevKeytraceClaim,
  DevKeytraceUserPublicKey,
} from "../../types/keytrace";
import { ids } from "../../types/keytrace";

// ── Authenticated writes (via server proxy) ────────────────────────

/**
 * Create a record in the authenticated user's repo.
 * Goes through the server proxy because OAuth tokens/DPoP keys are server-side.
 */
export async function createRecord(
  collection: string,
  record: Record<string, unknown>,
  rkey?: string,
): Promise<{ uri: string; cid: string }> {
  const response = await fetch("/api/repo/createRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ collection, record, rkey }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Delete a record from the authenticated user's repo.
 * Goes through the server proxy because OAuth tokens/DPoP keys are server-side.
 */
export async function deleteRecord(
  collection: string,
  rkey: string,
): Promise<void> {
  const response = await fetch("/api/repo/deleteRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ collection, rkey }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }
}

/**
 * Update an existing record in the authenticated user's repo.
 * Goes through the server proxy because OAuth tokens/DPoP keys are server-side.
 */
export async function putRecord(
  collection: string,
  rkey: string,
  record: Record<string, unknown>,
): Promise<{ uri: string; cid: string }> {
  const response = await fetch("/api/repo/putRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ collection, rkey, record }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * List all claims for a DID
 */
export async function listClaims(
  did: string,
): Promise<AtProtoRecord<DevKeytraceClaim.Main>[]> {
  const result = await listRecords<DevKeytraceClaim.Main>(
    did,
    ids.DevKeytraceClaim,
  );
  return result.records;
}

/**
 * Get a single claim by rkey
 */
export async function getClaim(
  did: string,
  rkey: string,
): Promise<AtProtoRecord<DevKeytraceClaim.Main>> {
  return getRecord<DevKeytraceClaim.Main>(did, ids.DevKeytraceClaim, rkey);
}

// ── Key-specific helpers ───────────────────────────────────────────

/**
 * List all keys for a DID (public, no auth)
 */
export async function listKeys(
  did: string,
): Promise<AtProtoRecord<DevKeytraceUserPublicKey.Main>[]> {
  const result = await listRecords<DevKeytraceUserPublicKey.Main>(
    did,
    ids.DevKeytraceUserPublicKey,
  );
  return result.records;
}

/**
 * Get a single key by rkey (public, no auth)
 */
export async function getKey(
  did: string,
  rkey: string,
): Promise<AtProtoRecord<DevKeytraceUserPublicKey.Main>> {
  return getRecord<DevKeytraceUserPublicKey.Main>(
    did,
    ids.DevKeytraceUserPublicKey,
    rkey,
  );
}

/**
 * Publish a key to the authenticated user's repo (via server proxy)
 */
export async function publishKey(
  record: DevKeytraceUserPublicKey.Main,
): Promise<{ uri: string; cid: string }> {
  return createRecord(
    ids.DevKeytraceUserPublicKey,
    record as unknown as Record<string, unknown>,
  );
}

/**
 * Delete a key from the authenticated user's repo (via server proxy)
 */
export async function deleteKey(rkey: string): Promise<void> {
  return deleteRecord(ids.DevKeytraceUserPublicKey, rkey);
}

/**
 * Retract a key by setting retractedAt (via server proxy).
 */
export async function retractKey(
  record: AtProtoRecord<DevKeytraceUserPublicKey.Main>,
): Promise<{ uri: string; cid: string }> {
  const { rkey } = parseAtUri(record.uri);
  const updated: DevKeytraceUserPublicKey.Main = {
    ...record.value,
    retractedAt: new Date().toISOString(),
  };
  return putRecord(
    ids.DevKeytraceUserPublicKey,
    rkey,
    updated as unknown as Record<string, unknown>,
  );
}

/**
 * Publish a claim to the authenticated user's repo (via server proxy).
 */
export async function publishClaim(
  record: DevKeytraceClaim.Main,
): Promise<{ uri: string; cid: string }> {
  return createRecord(
    ids.DevKeytraceClaim,
    record as unknown as Record<string, unknown>,
  );
}

/**
 * Delete a claim from the authenticated user's repo (via server proxy)
 */
export async function deleteClaim(rkey: string): Promise<void> {
  return deleteRecord(ids.DevKeytraceClaim, rkey);
}
