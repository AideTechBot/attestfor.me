/**
 * Shared Bluesky public API module.
 * Works isomorphically on both server (SSR) and client (browser).
 */

// ── Constants ──────────────────────────────────────────────────────

const BSKY_PUBLIC_API = "https://public.api.bsky.app";

const XRPC = {
  getProfile: "app.bsky.actor.getProfile",
  searchActorsTypeahead: "app.bsky.actor.searchActorsTypeahead",
  resolveHandle: "com.atproto.identity.resolveHandle",
  getFollows: "app.bsky.graph.getFollows",
} as const;

// ── Types ──────────────────────────────────────────────────────────

export interface BskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followsCount?: number;
  followersCount?: number;
  postsCount?: number;
}

export interface BskyActor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function xrpcUrl(
  lexicon: (typeof XRPC)[keyof typeof XRPC],
  params: Record<string, string | number>,
): string {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  return `${BSKY_PUBLIC_API}/xrpc/${lexicon}?${qs}`;
}

// ── Profile ────────────────────────────────────────────────────────

export async function getProfile(actor: string): Promise<BskyProfile | null> {
  try {
    const res = await fetch(xrpcUrl(XRPC.getProfile, { actor }));
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as BskyProfile;
  } catch {
    return null;
  }
}

// ── Handle Resolution ──────────────────────────────────────────────

export async function resolveHandle(handle: string): Promise<string | null> {
  try {
    const res = await fetch(xrpcUrl(XRPC.resolveHandle, { handle }));
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { did: string };
    return data.did;
  } catch {
    return null;
  }
}

// ── Search ─────────────────────────────────────────────────────────

export async function searchActors(
  query: string,
  limit = 5,
  signal?: AbortSignal,
): Promise<BskyActor[]> {
  const res = await fetch(
    xrpcUrl(XRPC.searchActorsTypeahead, { q: query, limit }),
    { signal },
  );
  if (!res.ok) {
    throw new Error(`Search failed: ${res.status}`);
  }
  const data = (await res.json()) as { actors?: BskyActor[] };
  return data.actors ?? [];
}

// ── Follows ────────────────────────────────────────────────────────

export async function getFollows(
  actor: string,
  limit = 50,
  signal?: AbortSignal,
): Promise<BskyActor[]> {
  const res = await fetch(xrpcUrl(XRPC.getFollows, { actor, limit }), {
    signal,
  });
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as { follows?: BskyActor[] };
  return data.follows ?? [];
}

// ── Avatar Helpers ─────────────────────────────────────────────────

/**
 * Rewrite a Bluesky CDN avatar URL to use the thumbnail variant.
 * CDN URLs look like: https://cdn.bsky.app/img/avatar/plain/did:plc:xxx/cid@jpeg
 * Thumbnail variant:  https://cdn.bsky.app/img/avatar_thumbnail/plain/...
 */
export function thumbnailAvatar(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }
  return url.replace("/img/avatar/", "/img/avatar_thumbnail/");
}
