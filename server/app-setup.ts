import fastifyCookie from "@fastify/cookie";
import fs from "fs";
import path from "path";
import { oauthClient, getSession, setSession, deleteSession } from "./oauth";
import { AtpAgent } from "@atproto/api";
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

      res.setCookie("session", sessionId, {
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
    const sessionId = req.cookies.session;
    if (sessionId) {
      await deleteSession(sessionId);
    }
    res.clearCookie("session");
    res.redirect("/");
  });

  app.get("/api/auth/session", async (req, res) => {
    const sessionId = req.cookies.session;
    if (!sessionId) {
      return res.send({ authenticated: false });
    }

    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      res.clearCookie("session");
      return res.send({ authenticated: false });
    }

    try {
      const oauthSession = await oauthClient.restore(sessionData.did);
      if (!oauthSession) {
        await deleteSession(sessionId);
        res.clearCookie("session");
        return res.send({ authenticated: false });
      }

      // Fetch profile directly using the DID
      const agent = new AtpAgent({ service: "https://public.api.bsky.app" });
      const profile = await agent.getProfile({ actor: sessionData.did });

      res.send({
        authenticated: true,
        did: sessionData.did,
        handle: profile.data.handle,
        displayName: profile.data.displayName,
        avatar: profile.data.avatar,
      });
    } catch (error) {
      console.error("Session error:", error);
      await deleteSession(sessionId);
      res.clearCookie("session");
      res.send({ authenticated: false });
    }
  });
}
