import { store } from "./storage";
import { DID_DOC_TTL, HANDLE_TTL, PROFILE_TTL } from "./cache-ttl";

interface DidDocument {
  id: string;
  alsoKnownAs?: string[];
  service?: Array<{ id: string; type: string; serviceEndpoint: string }>;
}

/**
 * Resolve a DID to its DID document using the appropriate method.
 * Supports did:plc (via plc.directory) and did:web.
 */
export async function resolveDidDocument(did: string): Promise<DidDocument> {
  const cacheKey = `didDoc:${did}`;
  const cached = await store.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as DidDocument;
  }

  let url: string;
  if (did.startsWith("did:plc:")) {
    url = `https://plc.directory/${did}`;
  } else if (did.startsWith("did:web:")) {
    const host = did.replace("did:web:", "");
    url = `https://${host}/.well-known/did.json`;
  } else {
    throw new Error(`Unsupported DID method: ${did}`);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to resolve DID document for ${did}: ${res.status}`);
  }
  const doc = (await res.json()) as DidDocument;
  await store.set(cacheKey, JSON.stringify(doc), DID_DOC_TTL);
  return doc;
}

/**
 * Extract the handle from a DID document's alsoKnownAs field.
 */
export function getHandleFromDidDoc(didDoc: DidDocument): string | undefined {
  return didDoc.alsoKnownAs
    ?.find((aka) => aka.startsWith("at://"))
    ?.replace("at://", "");
}

/**
 * Extract the PDS service endpoint from a DID document.
 */
export function getPdsEndpoint(didDoc: DidDocument): string | undefined {
  const pdsService = didDoc.service?.find(
    (s) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer",
  );
  return pdsService?.serviceEndpoint;
}

/**
 * Resolve a handle to a DID using the handle's own server.
 * Falls back to a well-known endpoint if needed.
 */
export async function resolveHandle(handle: string): Promise<string | null> {
  const cacheKey = `handle:${handle.toLowerCase()}`;
  const cached = await store.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Method 1: DNS TXT record at _atproto.<handle>
  // Many custom domain handles (e.g. manoo.dev) only have a DNS TXT record
  try {
    const { promises: dns } = await import("dns");
    const records = await dns.resolveTxt(`_atproto.${handle}`);
    for (const record of records) {
      const joined = record.join("");
      const match = joined.match(/^did=(.+)$/);
      if (match && match[1].startsWith("did:")) {
        await store.set(cacheKey, match[1], HANDLE_TTL);
        return match[1];
      }
    }
  } catch {
    // No TXT record found, fall through
  }

  // Method 2: HTTP well-known on the handle's domain
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const dnsRes = await fetch(`https://${handle}/.well-known/atproto-did`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (dnsRes.ok) {
      const did = (await dnsRes.text()).trim();
      if (did.startsWith("did:")) {
        await store.set(cacheKey, did, HANDLE_TTL);
        return did;
      }
    }
  } catch {
    // Domain may not have a web server, fall through
  }

  // Method 3: XRPC resolution on the handle's domain (for PDS-hosted handles)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://${handle}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = (await res.json()) as { did: string };
      await store.set(cacheKey, data.did, HANDLE_TTL);
      return data.did;
    }
  } catch {
    // Fall through
  }

  return null;
}

/**
 * Fetch a profile record from a user's PDS.
 */
export async function fetchProfileFromPds(
  did: string,
  pdsUrl: string,
): Promise<{
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
} | null> {
  const cacheKey = `profile:${did}`;
  const cached = await store.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const didDoc = await resolveDidDocument(did);
    const handle = getHandleFromDidDoc(didDoc) || did;

    const profileRes = await fetch(
      `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=app.bsky.actor.profile&rkey=self`,
    );

    let displayName: string | undefined;
    let description: string | undefined;
    let avatar: string | undefined;

    if (profileRes.ok) {
      const profileData = await profileRes.json();
      const value = profileData.value as {
        displayName?: string;
        description?: string;
        avatar?: { ref?: { $link?: string } };
      };
      displayName = value.displayName;
      description = value.description;
      if (value.avatar?.ref?.$link) {
        avatar = `/api/atproto/avatar?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(value.avatar.ref.$link)}`;
      }
    }

    const profile = { handle, displayName, description, avatar };
    await store.set(cacheKey, JSON.stringify(profile), PROFILE_TTL);
    return profile;
  } catch {
    return null;
  }
}
