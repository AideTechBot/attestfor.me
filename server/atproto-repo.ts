import { Client, ok, simpleFetchHandler } from "@atcute/client";
import type {} from "@atcute/atproto";
import { oauthClient } from "./oauth";

// @atcute typed XRPC expects template literal types for identifiers.
// We cast plain strings at the boundary since our API accepts string params.
type AtId = `${string}.${string}`;
type Nsid = `${string}.${string}.${string}`;

const DEFAULT_PDS_SERVICE = "https://bsky.social";
const DEFAULT_LIST_LIMIT = 100;

export interface AtProtoRepoClient {
  did: string;
}

/**
 * Get an authenticated XRPC client for the user's DID.
 * The OAuthSession from @atcute implements FetchHandlerObject,
 * so it can be used directly as a Client handler.
 */
async function getAuthenticatedClient(did: string): Promise<Client> {
  const session = await oauthClient.restore(did as `did:${string}:${string}`);
  return new Client({ handler: session });
}

/**
 * Get an anonymous XRPC client for public reads
 */
function getAnonymousClient(): Client {
  return new Client({
    handler: simpleFetchHandler({ service: DEFAULT_PDS_SERVICE }),
  });
}

/**
 * Read a record from a user's AT Proto repository
 * @param repo The repo DID
 * @param collection The lexicon collection
 * @param rkey The record key
 * @returns The record data
 */
export async function getRecord<T = Record<string, unknown>>(
  repo: string,
  collection: string,
  rkey: string,
): Promise<{ uri: string; cid: string; value: T }> {
  const rpc = getAnonymousClient();

  const data = await ok(
    rpc.get("com.atproto.repo.getRecord", {
      params: {
        repo: repo as AtId,
        collection: collection as Nsid,
        rkey,
      },
    }),
  );

  return {
    uri: data.uri,
    cid: data.cid || "",
    value: data.value as T,
  };
}

/**
 * List records from a collection in a user's repository
 * @param repo The repo DID
 * @param collection The lexicon collection
 * @param limit Maximum number of records to return
 * @param cursor Pagination cursor
 * @returns Array of records
 */
export async function listRecords<T = Record<string, unknown>>(
  repo: string,
  collection: string,
  limit: number = DEFAULT_LIST_LIMIT,
  cursor?: string,
): Promise<{
  records: Array<{
    uri: string;
    cid: string;
    value: T;
  }>;
  cursor?: string;
}> {
  const rpc = getAnonymousClient();

  const data = await ok(
    rpc.get("com.atproto.repo.listRecords", {
      params: {
        repo: repo as AtId,
        collection: collection as Nsid,
        limit,
        cursor,
      },
    }),
  );

  return {
    records: data.records.map(
      (r: { uri: string; cid: string; value: unknown }) => ({
        uri: r.uri,
        cid: r.cid,
        value: r.value as T,
      }),
    ),
    cursor: data.cursor,
  };
}

/**
 * Update a record in the user's AT Proto repository
 * @param client Authenticated client info
 * @param uri The record URI (at://did/collection/rkey)
 * @param record The updated record data
 * @returns The updated record's URI and CID
 */
export async function updateRecord<T = Record<string, unknown>>(
  client: AtProtoRepoClient,
  uri: string,
  record: T,
): Promise<{ uri: string; cid: string }> {
  const { repo, collection, rkey } = parseAtUri(uri);
  const rpc = await getAuthenticatedClient(client.did);

  const data = await ok(
    rpc.post("com.atproto.repo.putRecord", {
      input: {
        repo: repo as AtId,
        collection: collection as Nsid,
        rkey: rkey as `${string}`,
        record: record as Record<string, unknown>,
      },
    }),
  );

  return {
    uri: data.uri,
    cid: data.cid,
  };
}

/**
 * Helper to parse AT URI into components
 * @param uri AT URI
 * @returns Parsed components
 */
export function parseAtUri(uri: string): {
  repo: string;
  collection: string;
  rkey: string;
} {
  // eslint-disable-next-line no-useless-escape
  const match = uri.match(/^at:\/\/([^\/]+)\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid AT URI: ${uri}`);
  }

  return {
    repo: match[1],
    collection: match[2],
    rkey: match[3],
  };
}
