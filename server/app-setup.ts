import fastifyCookie from "@fastify/cookie";
import { oauthClient, getSession, setSession, deleteSession } from "./oauth";
import { store } from "./storage";
import { SESSION_PROFILE_TTL } from "./cache-ttl";
import { SESSION_COOKIE_NAME } from "../src/lib/constants";
import { setupProofsRoutes } from "./routes/proofs";
import { setupKeysRoutes } from "./routes/keys";

import type { FastifyInstance } from "fastify";
import type { Handle } from "@atcute/lexicons";

// Classify authentication errors into user-friendly error codes
function classifyAuthError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "auth_failed";
  }

  const msg = error.message.toLowerCase();
  const causMsg = (
    error.cause instanceof Error ? error.cause.message : ""
  ).toLowerCase();

  // Invalid handle errors (from OAuth resolver)
  if (
    error.constructor?.name === "OAuthResolverError" ||
    msg.includes("resolve") ||
    msg.includes("not found") ||
    msg.includes("invalid handle") ||
    causMsg.includes("invalid handle")
  ) {
    return "invalid_handle";
  }

  // Network errors
  if (msg.includes("network") || msg.includes("fetch")) {
    return "network_error";
  }

  // Session/state errors
  if (msg.includes("expired")) {
    return "session_expired";
  }

  // Invalid OAuth response
  if (msg.includes("invalid")) {
    return "invalid_response";
  }

  return "auth_failed";
}

// Ensure returnTo is a safe relative path (prevents open redirect)
function sanitizeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

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
    const returnTo = sanitizeReturnTo(
      (req.query as { returnTo?: string }).returnTo,
    );

    try {
      const handle = (req.query as { handle?: Handle }).handle;

      if (!handle) {
        return res.redirect(`${returnTo}?auth_error=missing_handle`);
      }

      // Store returnTo URL to survive OAuth redirect
      const stateId = crypto.randomUUID();
      await store.set(`oauth:returnTo:${stateId}`, returnTo, 600); // 10 minutes

      const authUrl = await oauthClient.authorize({
        target: {
          type: "account",
          identifier: handle,
        },
        scope: "atproto transition:generic",
        state: stateId,
      });

      res.redirect(authUrl.url.toString());
    } catch (error) {
      console.error("Login error:", error);
      const errorCode = classifyAuthError(error);
      res.redirect(`${returnTo}?auth_error=${errorCode}`);
    }
  });

  app.get("/api/auth/callback", async (req, res) => {
    let returnTo = "/";

    try {
      const params = new URLSearchParams(req.url.split("?")[1]);

      // Handle OAuth errors from provider
      const error = params.get("error");
      if (error) {
        // Try to get returnTo from state before we lose it
        const stateId = params.get("state");
        if (stateId) {
          const storedReturnTo = await store.get(`oauth:returnTo:${stateId}`);
          if (storedReturnTo) {
            returnTo = sanitizeReturnTo(storedReturnTo);
            await store.del(`oauth:returnTo:${stateId}`);
          }
        }

        console.error("OAuth error:", error, params.get("error_description"));
        const errorCode =
          error === "access_denied" ? "access_denied" : "auth_failed";
        return res.redirect(`${returnTo}?auth_error=${errorCode}`);
      }

      const { session, state: userState } = await oauthClient.callback(params);

      // Retrieve returnTo from user state passed through OAuth flow
      if (userState && typeof userState === "string") {
        const storedReturnTo = await store.get(`oauth:returnTo:${userState}`);
        if (storedReturnTo) {
          returnTo = sanitizeReturnTo(storedReturnTo);
          await store.del(`oauth:returnTo:${userState}`);
        }
      }

      // Store session with cookie
      const sessionId = crypto.randomUUID();
      await setSession(sessionId, {
        did: session.did,
      });

      res.setCookie(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: true, // HTTPS required
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });

      console.log(`[Auth] User ${session.did} authenticated successfully`);

      // Redirect to original page with success indicator
      res.type("text/html").send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Redirecting...</title>
          </head>
          <body>
            <script>
              // Redirect to return URL with success flag
              window.location.href = '${returnTo}?auth_success=true';
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Callback error:", error);
      const errorCode = classifyAuthError(error);
      res.redirect(`${returnTo}?auth_error=${errorCode}`);
    }
  });

  app.get("/api/auth/logout", async (req, res) => {
    const sessionId = req.cookies[SESSION_COOKIE_NAME];
    if (sessionId) {
      await deleteSession(sessionId);
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    const returnTo = sanitizeReturnTo(
      (req.query as { returnTo?: string }).returnTo,
    );
    res.redirect(returnTo);
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
      // restore() throws if session is invalid/expired
      await oauthClient.restore(sessionData.did as `did:${string}:${string}`);

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

  // ── API routes ─────────────────────────────────────────────────

  await setupProofsRoutes(app);
  await setupKeysRoutes(app);
}
