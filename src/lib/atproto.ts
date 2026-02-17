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

import type { MeAttestProof } from "../../types/lexicons";

const PROOF_COLLECTION = "me.attest.proof";

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
