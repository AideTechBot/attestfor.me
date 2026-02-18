import "dotenv/config";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fs from "fs";
import path from "path";
import { setupApp } from "./app-setup";
import { initializeOAuthClient } from "./oauth";

// Initialize OAuth client
initializeOAuthClient();

const app = Fastify({
  trustProxy: true,
});
const PORT = Number(process.env.PORT) || 3000;

// Register static file serving for dist/client (assets, JS, CSS)
await app.register(fastifyStatic, {
  root: path.resolve("dist/client"),
  prefix: "/",
  wildcard: false, // don't let static handler catch the wildcard route
});

// Register shared OAuth/session routes
await setupApp(app);

// ── Production SSR catch-all ───────────────────────────────────────
// NOTE: Requires `pnpm build` to be run first to generate dist/

// Read the built HTML template once at startup
const rawTemplateHtml = fs.readFileSync(
  path.resolve("dist/client/index.html"),
  "utf-8",
);

// Inject Umami website ID at runtime, or strip the script tag if not set
const umamiId = process.env.UMAMI_WEBSITE_ID;
const templateHtml = umamiId
  ? rawTemplateHtml.replace("__UMAMI_WEBSITE_ID__", umamiId)
  : rawTemplateHtml.replace(
      /<script[^>]*data-website-id="__UMAMI_WEBSITE_ID__"[^>]*><\/script>\n?/,
      "",
    );

// Import the SSR render function built by `vite build --ssr`
const { render } = (await import(
  path.resolve("dist/server/entry-server.js")
)) as {
  render: (request: Request) => Promise<{
    html: string;
    notFound: boolean;
    hasSession: boolean;
    redirect?: Response;
  }>;
};

app.get("/*", async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.hostname}`);
    const fetchRequest = new Request(url.href, {
      method: req.method,
      headers: new Headers(req.headers as Record<string, string>),
    });

    const result = await render(fetchRequest);

    // Handle redirects
    if (result.redirect) {
      const location = result.redirect.headers.get("Location");
      if (location) {
        res.status(result.redirect.status).redirect(location);
        return;
      }
    }

    const { html, notFound, hasSession } = result;

    // Inject runtime data so client hydration has session hint immediately
    const injectScript = [
      `<script>`,
      `window.__HAS_SESSION__=${hasSession ? "true" : "false"};`,
      `</script>`,
    ].join("");
    const fullHtml = templateHtml
      .replace("<!--app-html-->", html)
      .replace('<div id="root">', injectScript + '<div id="root">');

    if (notFound) {
      res.status(404);
    }
    res.type("text/html").send(fullHtml);
  } catch (e) {
    console.error("SSR render error:", e);
    res.status(500).send("Internal Server Error");
  }
});

await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`Production SSR server running at http://0.0.0.0:${PORT}`);
