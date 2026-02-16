import fastifyCookie from "@fastify/cookie";
import { oauthClient, getSession, setSession, deleteSession } from "./oauth";
import { store } from "./storage";
import { SESSION_PROFILE_TTL } from "./cache-ttl";
import { SESSION_COOKIE_NAME } from "../src/lib/constants";

import type { FastifyInstance } from "fastify";

export async function setupApp(app: FastifyInstance) {
  // Register cookie support for OAuth
  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || "change-this-in-production",
  });

  // Add CORS header to OAuth metadata (served by Vite in dev / @fastify/static in prod)
  app.addHook("onSend", async (req, res) => {
    if (req.url === "/oauth/client-metadata.json") {
      res.header("Access-Control-Allow-Origin", "*");
    }
  });

  // ── OAuth routes ───────────────────────────────────────────────

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

      // Fetch profile from Bluesky public API
      const { getProfile } = await import("../src/lib/bsky");
      const profile = await getProfile(sessionData.did);

      const sessionResponse = {
        authenticated: true,
        did: sessionData.did,
        handle: profile?.handle || sessionData.did,
        displayName: profile?.displayName,
        avatar: profile?.avatar,
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
}
