# Phase 0: Result — Direct Bluesky API Architecture

**Status:** ✅ Complete

## What Changed from the Plan

The original Phase 0 spec proposed a flexible three-mode request architecture (server-proxy, client-direct, hybrid) with a configuration system, `UnifiedAtpClient` abstraction, server proxy routes, and per-operation toggles. After implementing and testing it, the complexity wasn't justified — Bluesky's public API works fine from both server and browser with no CORS issues, so there's no reason to proxy reads through our server.

**We scrapped the entire config/proxy system** and replaced it with a single isomorphic module that calls Bluesky's public API directly.

### Planned vs Actual

| Planned | Actual |
|---|---|
| `server/config.ts` — request mode config | **Deleted** — no modes needed |
| `types/config.ts` — config types | **Deleted** |
| `src/lib/client-config.ts` — client config reader | **Deleted** |
| `src/lib/atproto-client.ts` — `UnifiedAtpClient` abstraction | **Deleted** — replaced by `src/lib/bsky.ts` |
| `src/lib/get-api-base.ts` — API base URL helper | **Deleted** |
| `server/routes/atproto-proxy.ts` — proxy routes for search, profile, avatar, etc. | **Deleted** — no server proxy for reads |
| `server/lib/cache.ts` — generic cache helper | **Deleted** |
| `server/atproto-helpers.ts` — DID doc resolution, PDS endpoint finding | **Deleted** — `bsky.ts` uses the public API directly |
| `window.__CLIENT_CONFIG__` injection in SSR HTML | **Deleted** — no config to inject |
| `.env` variables for `REQUEST_MODE`, `CLIENT_*` toggles, `CACHE_TTL_*` | **Deleted** |
| Three request modes with per-operation config | One mode: call Bluesky public API directly |

---

## Architecture

```
Browser (client navigation)          Server (SSR)
        │                                │
        └──── fetch() ───────────────────┘
                    │
                    ▼
        https://public.api.bsky.app
            (Bluesky public API)
```

All public reads (profiles, search, follows, handle resolution) call `https://public.api.bsky.app` directly via `fetch()`. The same code runs on both server (during SSR) and client (during browser navigation). No proxy, no routing modes.

The server is only used for:
- **OAuth** (login, callback, logout, session)
- **Session profile caching** (cached in Redis/memory for 30 min)
- **Future:** custom lexicon writes, proof verification, signing

---

## Files Created / Modified

### New: `src/lib/bsky.ts`

Isomorphic Bluesky public API module. Single file, no dependencies beyond `fetch()`.

```
XRPC lexicons ─► getProfile()
               ─► resolveHandle()
               ─► searchActors()
               ─► getFollows()
               ─► thumbnailAvatar()
```

- **`XRPC` const** — all lexicon NSIDs in one place (`app.bsky.actor.getProfile`, etc.)
- **`xrpcUrl()`** — builds XRPC URLs from a lexicon + params via `URLSearchParams`
- **`getProfile(actor)`** — fetches a profile by handle or DID
- **`resolveHandle(handle)`** — resolves a handle to a DID
- **`searchActors(query, limit, signal)`** — typeahead actor search
- **`getFollows(actor, limit, signal)`** — lists accounts the actor follows
- **`thumbnailAvatar(url)`** — rewrites CDN avatar URLs from `/img/avatar/` to `/img/avatar_thumbnail/` for smaller images in search results and header

### Modified: `src/pages/ProfilePage.tsx`

- Loader calls `getProfile()` from `bsky.ts` directly — same code for SSR and client navigation
- No server proxy, no `getAtpClient()`, no `typeof window` branching

### Modified: `src/lib/hooks.ts`

- `useProfile()` and `useResolveHandle()` use React Query + `bsky.ts` functions
- Removed `useListRecords()` (unused)

### Modified: `src/lib/use-atproto-search.ts`

- Calls `searchActors()` from `bsky.ts` directly instead of `/api/atproto/search`
- Re-exports `BskyActor` as `AtprotoActor` for backward compatibility

### Modified: `src/lib/use-random-followers.ts`

- Calls `getFollows()` from `bsky.ts` directly instead of `/api/atproto/followers`

### Modified: `src/components/SearchPopup.tsx`

- Uses `thumbnailAvatar()` for smaller avatar images in suggestion lists
- Removed `getAtpClient()` import

### Modified: `src/components/PageLayout.tsx`

- Uses `thumbnailAvatar()` for the header session avatar
- Removed `getAtpClient()` import

### Modified: `server/app-setup.ts`

- **Removed** all `/api/atproto/*` proxy routes (search, profile, avatar, followers, resolve-handle)
- **Kept** OAuth routes (`/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`, `/api/auth/session`)
- Session endpoint uses `bsky.ts` `getProfile()` to fetch display info, cached in Redis for 30 min

### Modified: `server/dev-server.ts` & `server/index.ts`

- Removed `window.__CLIENT_CONFIG__` injection from SSR HTML
- Only `window.__HAS_SESSION__` is injected (boolean flag for session hint)

### Modified: `src/global.d.ts`

- Removed `__CLIENT_CONFIG__` and `__REACT_QUERY_STATE__` from Window interface
- Only `__HAS_SESSION__` remains

### Modified: `server/cache-ttl.ts`

- Removed `DID_DOC_TTL`, `HANDLE_TTL`, `PROFILE_TTL`, `FOLLOWERS_TTL`, `AVATAR_TTL`
- Only `SESSION_PROFILE_TTL` (30 min) remains — used by the session endpoint

### Modified: `.env.example`

- Removed `REQUEST_MODE`, `ATPROTO_SERVICE`, `BSKY_SERVICE`, `CACHE_TTL_*`, `CLIENT_*` variables
- Only `APP_URL`, `COOKIE_SECRET`, `REDIS_URL` remain

### Deleted

| File | Was |
|---|---|
| `server/config.ts` | Request mode config system |
| `types/config.ts` | Config type definitions |
| `src/lib/client-config.ts` | Client-side config reader from `window.__CLIENT_CONFIG__` |
| `src/lib/atproto-client.ts` | `UnifiedAtpClient` class with mode-switching |
| `src/lib/get-api-base.ts` | API base URL helper |
| `server/routes/atproto-proxy.ts` | All `/api/atproto/*` proxy routes |
| `server/lib/cache.ts` | Generic `getCachedOrFetch` helper |
| `server/atproto-helpers.ts` | DID doc resolution, PDS endpoint finding |

---

## Key Decisions

1. **No server proxy for public reads.** Bluesky's `public.api.bsky.app` has no CORS restrictions and works from both server and browser. Proxying adds latency, bandwidth costs, and code complexity for zero benefit.

2. **Isomorphic `bsky.ts`.** One module, same code path for SSR and client. The React Router loader calls `getProfile()` — on the server during SSR, in the browser during client navigation. No branching.

3. **Avatar thumbnails via CDN URL rewriting.** Bluesky CDN supports `avatar_thumbnail` as a path segment variant. `thumbnailAvatar()` rewrites the URL — no server involvement, no image processing.

4. **React Query for client-side caching.** Configured with 5-min stale time, 30-min GC time, single retry. Handles deduplication and background refetching automatically.

5. **Server session caching stays.** The `/api/auth/session` endpoint still caches profile data in Redis (30-min TTL) to avoid hitting Bluesky on every page load. This is the only server-side caching that remains.
