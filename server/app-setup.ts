import fastifyCookie from "@fastify/cookie";
import fs from "fs";
import path from "path";
import { oauthClient, getSession, setSession, deleteSession } from "./oauth";
import { store } from "./storage";
import { SESSION_PROFILE_TTL, FOLLOWERS_TTL, AVATAR_TTL } from "./cache-ttl";
import { SESSION_COOKIE_NAME } from "../src/lib/constants";
import {
  resolveDidDocument,
  getHandleFromDidDoc,
  getPdsEndpoint,
  resolveHandle,
  fetchProfileFromPds,
} from "./atproto-helpers";
import crypto from "crypto";

import type { FastifyInstance } from "fastify";

export async function setupApp(app: FastifyInstance) {
  // Register cookie support for OAuth
  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || "change-this-in-production",
  });

  // Serve OAuth metadata from public folder
  app.get("/oauth/client-metadata.json", async (_req, res) => {
    const filePath = path.join(
      process.cwd(),
      "public",
      "oauth",
      "client-metadata.json",
    );
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      res.header("Content-Type", "application/json");
      res.header("Access-Control-Allow-Origin", "*");
      res.send(content);
    } catch (error) {
      console.error("Error serving OAuth metadata:", error);
      res.status(404).send("Not found");
    }
  });

  // OAuth routes
  app.get("/api/auth/login", async (req, res) => {
    try {
      const handle = (req.query as { handle?: string }).handle;
      if (!handle) {
        return res.status(400).send({ error: "Handle is required" });
      }

      const authUrl = await oauthClient.authorize(handle, {
        scope: "atproto transition:generic",
      });

      res.redirect(authUrl.toString());
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).send({ error: "Failed to initiate login" });
    }
  });

  app.get("/api/auth/callback", async (req, res) => {
    try {
      const params = new URLSearchParams(req.url.split("?")[1]);
      const { session } = await oauthClient.callback(params);

      // Store session with cookie
      const sessionId = crypto.randomUUID();
      await setSession(sessionId, {
        did: session.sub,
      });

      res.setCookie(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: true, // HTTPS required
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });

      // Send a simple HTML page that redirects
      // This prevents hydration errors by skipping SSR entirely
      res.type("text/html").send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Redirecting...</title>
          </head>
          <body>
            <script>
              // Redirect to home page
              window.location.href = '/';
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Callback error:", error);
      res.redirect("/?error=auth_failed");
    }
  });

  app.get("/api/auth/logout", async (req, res) => {
    const sessionId = req.cookies[SESSION_COOKIE_NAME];
    if (sessionId) {
      await deleteSession(sessionId);
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    res.redirect("/");
  });

  app.get("/api/auth/session", async (req, res) => {
    const sessionId = req.cookies[SESSION_COOKIE_NAME];
    if (!sessionId) {
      return res.send({ authenticated: false });
    }

    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      res.clearCookie(SESSION_COOKIE_NAME);
      return res.send({ authenticated: false });
    }

    try {
      const oauthSession = await oauthClient.restore(sessionData.did);
      if (!oauthSession) {
        await deleteSession(sessionId);
        res.clearCookie(SESSION_COOKIE_NAME);
        return res.send({ authenticated: false });
      }

      // Check cache for session profile data
      const sessionCacheKey = `sessionProfile:${sessionData.did}`;
      const cachedSession = await store.get(sessionCacheKey);
      if (cachedSession) {
        return res.send(JSON.parse(cachedSession));
      }

      // Resolve the DID document to get handle and PDS endpoint
      const didDoc = await resolveDidDocument(sessionData.did);
      const handle = getHandleFromDidDoc(didDoc);
      const pdsUrl = getPdsEndpoint(didDoc);

      let displayName: string | undefined;
      let avatar: string | undefined;

      if (pdsUrl) {
        try {
          const profileRes = await fetch(
            `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(sessionData.did)}&collection=app.bsky.actor.profile&rkey=self`,
          );
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            const value = profileData.value as {
              displayName?: string;
              avatar?: { ref?: { $link?: string } };
            };
            displayName = value.displayName;
            if (value.avatar?.ref?.$link) {
              avatar = `/api/atproto/avatar?did=${encodeURIComponent(sessionData.did)}&cid=${encodeURIComponent(value.avatar.ref.$link)}`;
            }
          }
        } catch {
          // Profile fetch is best-effort
        }
      }

      const sessionResponse = {
        authenticated: true,
        did: sessionData.did,
        handle: handle || sessionData.did,
        displayName,
        avatar,
      };
      await store.set(
        sessionCacheKey,
        JSON.stringify(sessionResponse),
        SESSION_PROFILE_TTL,
      );

      res.send(sessionResponse);
    } catch (error) {
      console.error("Session error:", error);
      await deleteSession(sessionId);
      res.clearCookie(SESSION_COOKIE_NAME);
      res.send({ authenticated: false });
    }
  });

  // ── AT Protocol proxy routes ─────────────────────────────────────

  /**
   * Search for actors by handle prefix.
   * Resolves handles via AT Protocol identity, then fetches profile data from each user's PDS.
   */
  app.get("/api/atproto/search", async (req, res) => {
    try {
      const { q, limit: limitStr } = req.query as {
        q?: string;
        limit?: string;
      };
      if (!q) {
        return res
          .status(400)
          .send({ error: "Query parameter 'q' is required" });
      }

      const limit = Math.min(parseInt(limitStr || "5", 10), 25);
      const query = q.trim();

      const actors: Array<{
        handle: string;
        displayName?: string;
        avatar?: string;
      }> = [];

      // Build a list of candidate handles to try resolving
      const candidates: string[] = [];

      if (query.includes(".")) {
        // Already looks like a full handle
        candidates.push(query);
      } else {
        // Try common AT Protocol PDS suffixes
        const suffixes = (process.env.ATPROTO_HANDLE_SUFFIXES || "bsky.social")
          .split(",")
          .map((s) => s.trim());
        for (const suffix of suffixes) {
          candidates.push(`${query}.${suffix}`);
        }
      }

      // Resolve all candidates in parallel
      const resolvePromises = candidates
        .slice(0, limit)
        .map(async (candidate) => {
          try {
            const did = await resolveHandle(candidate);
            if (did) {
              const didDoc = await resolveDidDocument(did);
              const pdsUrl = getPdsEndpoint(didDoc);
              if (pdsUrl) {
                return fetchProfileFromPds(did, pdsUrl);
              }
            }
          } catch {
            // Skip candidates that fail
          }
          return null;
        });

      const results = await Promise.allSettled(resolvePromises);
      for (const result of results) {
        if (
          result.status === "fulfilled" &&
          result.value &&
          actors.length < limit
        ) {
          if (!actors.some((a) => a.handle === result.value!.handle)) {
            actors.push(result.value);
          }
        }
      }

      res.send({ actors });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).send({ error: "Search failed" });
    }
  });

  /**
   * Get followers for an actor via AT Protocol.
   * Resolves the actor's PDS and lists follow records.
   */
  app.get("/api/atproto/followers", async (req, res) => {
    try {
      const { actor, limit: limitStr } = req.query as {
        actor?: string;
        limit?: string;
      };
      if (!actor) {
        return res.status(400).send({ error: "Actor parameter is required" });
      }

      const limit = Math.min(parseInt(limitStr || "50", 10), 100);

      // Resolve the actor to a DID
      let did: string;
      if (actor.startsWith("did:")) {
        did = actor;
      } else {
        const resolved = await resolveHandle(actor);
        if (!resolved) {
          return res.send({ followers: [] });
        }
        did = resolved;
      }

      // Get the actor's DID document and PDS
      const didDoc = await resolveDidDocument(did);
      const pdsUrl = getPdsEndpoint(didDoc);
      if (!pdsUrl) {
        return res.send({ followers: [] });
      }

      // Check cache for followers
      const followersCacheKey = `followers:${did}:${limit}`;
      const cachedFollowers = await store.get(followersCacheKey);
      if (cachedFollowers) {
        return res.send(JSON.parse(cachedFollowers));
      }

      // List follow records from the actor's repo to find who follows them
      // Note: In AT Protocol, "followers" are people who have follow records pointing to this actor.
      // Since we can't easily enumerate all repos, we list the actor's own follows as suggestions.
      const followsRes = await fetch(
        `${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=app.bsky.graph.follow&limit=${limit}`,
      );

      if (!followsRes.ok) {
        return res.send({ followers: [] });
      }

      const followsData = (await followsRes.json()) as {
        records?: Array<{
          value: { subject: string };
        }>;
      };

      const followers: Array<{
        handle: string;
        displayName?: string;
        avatar?: string;
      }> = [];

      if (followsData.records) {
        // Resolve each followed DID to a profile
        const resolvePromises = followsData.records
          .slice(0, limit)
          .map(async (record) => {
            try {
              const followedDid = record.value.subject;
              const followedDoc = await resolveDidDocument(followedDid);
              const followedPds = getPdsEndpoint(followedDoc);
              if (followedPds) {
                return fetchProfileFromPds(followedDid, followedPds);
              }
            } catch {
              // Skip entries that fail to resolve
            }
            return null;
          });

        const results = await Promise.allSettled(resolvePromises);
        for (const result of results) {
          if (result.status === "fulfilled" && result.value) {
            followers.push(result.value);
          }
        }
      }

      const followersResponse = { followers };
      await store.set(
        followersCacheKey,
        JSON.stringify(followersResponse),
        FOLLOWERS_TTL,
      );
      res.send(followersResponse);
    } catch (error) {
      console.error("Followers error:", error);
      res.status(500).send({ error: "Failed to fetch followers" });
    }
  });

  /**
   * Resolve a handle to a DID via AT Protocol identity resolution.
   */
  app.get("/api/atproto/resolve-handle", async (req, res) => {
    try {
      const { handle } = req.query as { handle?: string };
      if (!handle) {
        return res.status(400).send({ error: "Handle parameter is required" });
      }

      const did = await resolveHandle(handle);
      if (!did) {
        return res.status(404).send({ error: "Handle not found" });
      }

      res.send({ did });
    } catch (error) {
      console.error("Resolve handle error:", error);
      res.status(500).send({ error: "Failed to resolve handle" });
    }
  });

  /**
   * Get a profile by DID or handle via AT Protocol.
   */
  // TODO: Replace this pass-through proxy with a proper caching layer.
  // Ideally, store resized blobs in a database or on-disk cache keyed by
  // (did, cid, size) so repeated requests don't hit the upstream CDN/PDS.
  // Consider using `sharp` for server-side resizing when the CDN is unavailable.

  /**
   * Proxy avatar images with size support.
   *
   * Sizes (maps to Bluesky CDN presets, with PDS blob fallback):
   *   - "thumbnail"  → 150×150   (search dropdowns, nav bar)
   *   - "avatar"     → 1000×1000 (profile page)
   *   - "fullsize"   → original blob from PDS
   *
   * The CDN (cdn.bsky.app) serves pre-resized images efficiently.
   * If the CDN is unavailable, falls back to the full blob from the PDS.
   */
  app.get("/api/atproto/avatar", async (req, res) => {
    try {
      const { did, cid, size } = req.query as {
        did?: string;
        cid?: string;
        size?: string;
      };
      if (!did || !cid) {
        return res.status(400).send({ error: "Missing did or cid" });
      }

      // Validate DID format: must be did:plc:<base32> or did:web:<hostname>
      if (!/^did:(plc:[a-z2-7]{24}|web:[a-zA-Z0-9._:%-]+)$/.test(did)) {
        return res.status(400).send({ error: "Invalid DID format" });
      }

      // Validate CID format: base32/base58 multihash, alphanumeric only
      if (!/^[a-zA-Z0-9]+$/.test(cid)) {
        return res.status(400).send({ error: "Invalid CID format" });
      }

      // Whitelist size parameter
      const allowedSizes = ["thumbnail", "avatar", "fullsize"] as const;
      const safeSize = allowedSizes.includes(
        size as (typeof allowedSizes)[number],
      )
        ? (size as (typeof allowedSizes)[number])
        : "avatar";

      // Map size param to CDN preset
      const cdnPreset =
        safeSize === "thumbnail"
          ? "avatar_thumbnail" // 150×150
          : safeSize === "avatar"
            ? "avatar" // 1000×1000 (default)
            : null; // "fullsize" → skip CDN, fetch raw blob

      // Check server-side cache for avatar blobs (CIDs are immutable)
      const avatarCacheKey = `avatar:${did}:${cid}:${safeSize}`;
      const cachedAvatar = await store.get(avatarCacheKey);
      if (cachedAvatar) {
        const { contentType: ct, data } = JSON.parse(cachedAvatar);
        res.header("Content-Type", ct);
        res.header("Cache-Control", `public, max-age=${AVATAR_TTL}, immutable`);
        return res.send(Buffer.from(data, "base64"));
      }

      let imageRes: Response | null = null;

      // Try CDN first for sized variants
      if (cdnPreset) {
        try {
          const cdnUrl = `https://cdn.bsky.app/img/${cdnPreset}/plain/${did}/${cid}@jpeg`;
          const cdnRes = await fetch(cdnUrl);
          if (cdnRes.ok && cdnRes.body) {
            imageRes = cdnRes;
          }
        } catch {
          // CDN unavailable, fall through to PDS blob
        }
      }

      // Fallback: resolve the DID to find their PDS, then fetch the blob
      if (!imageRes) {
        const didDoc = await resolveDidDocument(did);
        const pdsUrl = getPdsEndpoint(didDoc);
        if (!pdsUrl) {
          return res.status(404).send({ error: "PDS not found for DID" });
        }
        const blobUrl = `${pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
        const blobRes = await fetch(blobUrl);
        if (!blobRes.ok || !blobRes.body) {
          return res.status(404).send({ error: "Blob not found" });
        }
        imageRes = blobRes;
      }

      const contentType = imageRes.headers.get("content-type") || "image/jpeg";

      // Read the image buffer
      const reader = imageRes.body!.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        chunks.push(value);
      }
      const buffer = Buffer.concat(chunks);

      // Cache the blob server-side — CIDs are content-addressed (immutable)
      // Only cache if under 512KB to avoid bloating the cache
      if (buffer.length < 512 * 1024) {
        await store.set(
          avatarCacheKey,
          JSON.stringify({ contentType, data: buffer.toString("base64") }),
          AVATAR_TTL,
        );
      }

      res.header("Content-Type", contentType);
      res.header("Cache-Control", `public, max-age=${AVATAR_TTL}, immutable`);
      res.send(buffer);
    } catch (error) {
      console.error("Avatar proxy error:", error);
      res.status(500).send({ error: "Failed to fetch avatar" });
    }
  });

  app.get("/api/atproto/profile", async (req, res) => {
    try {
      const { actor } = req.query as { actor?: string };
      if (!actor) {
        return res.status(400).send({ error: "Actor parameter is required" });
      }

      // Resolve to DID if needed
      let did: string;
      if (actor.startsWith("did:")) {
        did = actor;
      } else {
        const resolved = await resolveHandle(actor);
        if (!resolved) {
          return res.status(404).send({ error: "Actor not found" });
        }
        did = resolved;
      }

      const didDoc = await resolveDidDocument(did);
      const pdsUrl = getPdsEndpoint(didDoc);
      if (!pdsUrl) {
        return res.status(404).send({ error: "PDS not found" });
      }

      const profile = await fetchProfileFromPds(did, pdsUrl);
      if (!profile) {
        return res.status(404).send({ error: "Profile not found" });
      }

      res.send({
        handle: profile.handle,
        displayName: profile.displayName,
        description: profile.description,
        avatar: profile.avatar,
      });
    } catch (error) {
      console.error("Profile error:", error);
      res.status(500).send({ error: "Failed to fetch profile" });
    }
  });
}
