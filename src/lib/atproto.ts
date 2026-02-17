/**
 * Client-side AT Proto repository utilities.
 * Uses the public Bluesky API for reads (no auth needed)
 * and the user's PDS for writes (via OAuth session).
 */

const DEFAULT_PDS = "https://bsky.social";
const DEFAULT_LIST_LIMIT = 100;

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
  const url = xrpcUrl(DEFAULT_PDS, "com.atproto.repo.getRecord", {
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

  const url = xrpcUrl(DEFAULT_PDS, "com.atproto.repo.listRecords", params);

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

// ── Proof-specific helpers ─────────────────────────────────────────

import type { MeAttestProof, MeAttestKey } from "../../types/lexicons";

const PROOF_COLLECTION = "me.attest.proof";
const KEY_COLLECTION = "me.attest.key";

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
 * List all proofs for a DID
 */
export async function listProofs(
  did: string,
): Promise<AtProtoRecord<MeAttestProof.Main>[]> {
  const result = await listRecords<MeAttestProof.Main>(did, PROOF_COLLECTION);
  return result.records;
}

/**
 * Get a single proof by rkey
 */
export async function getProof(
  did: string,
  rkey: string,
): Promise<AtProtoRecord<MeAttestProof.Main>> {
  return getRecord<MeAttestProof.Main>(did, PROOF_COLLECTION, rkey);
}

// ── Key-specific helpers ───────────────────────────────────────────

/**
 * List all keys for a DID (public, no auth)
 */
export async function listKeys(
  did: string,
): Promise<AtProtoRecord<MeAttestKey.Main>[]> {
  const result = await listRecords<MeAttestKey.Main>(did, KEY_COLLECTION);
  return result.records;
}

/**
 * Get a single key by rkey (public, no auth)
 */
export async function getKey(
  did: string,
  rkey: string,
): Promise<AtProtoRecord<MeAttestKey.Main>> {
  return getRecord<MeAttestKey.Main>(did, KEY_COLLECTION, rkey);
}

/**
 * Publish a key to the authenticated user's repo (via server proxy)
 */
export async function publishKey(
  record: MeAttestKey.Main,
): Promise<{ uri: string; cid: string }> {
  return createRecord(
    KEY_COLLECTION,
    record as unknown as Record<string, unknown>,
  );
}

/**
 * Delete a key from the authenticated user's repo (via server proxy)
 */
export async function deleteKey(rkey: string): Promise<void> {
  return deleteRecord(KEY_COLLECTION, rkey);
}

/**
 * Publish a proof to the authenticated user's repo (via server proxy).
 * (Unblocks the Phase 2 gap — proof creation was not wired up)
 */
export async function publishProof(
  record: MeAttestProof.Main,
): Promise<{ uri: string; cid: string }> {
  return createRecord(
    PROOF_COLLECTION,
    record as unknown as Record<string, unknown>,
  );
}

/**
 * Delete a proof from the authenticated user's repo (via server proxy)
 */
export async function deleteProof(rkey: string): Promise<void> {
  return deleteRecord(PROOF_COLLECTION, rkey);
}
