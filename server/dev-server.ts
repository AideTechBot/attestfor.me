import "dotenv/config";
import Fastify from "fastify";
import fastifyExpress from "@fastify/express";
import { setupApp } from "./app-setup";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import type { ViteDevServer } from "vite";

const app = Fastify();
const PORT = Number(process.env.PORT) || 3000;
// Register shared OAuth/session routes
await setupApp(app);

const vite: ViteDevServer = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});

// Register Express middleware support for Vite
await app.register(fastifyExpress);
app.use(vite.middlewares);

app.get("/*", async (req, res) => {
  try {
    let template = fs.readFileSync(path.resolve("index.html"), "utf-8");
    template = await vite.transformIndexHtml(
      req.originalUrl ?? req.url,
      template,
    );

    // Use dev favicon in development
    template = template.replace("/favicon.svg", "/favicon-dev.svg");

    // In dev mode, use Vite's module graph to discover CSS dependencies
    const entryModule = await vite.moduleGraph.getModuleByUrl(
      "/src/entry-client.tsx",
    );
    const cssUrls = new Set<string>();

    if (entryModule) {
      const visited = new Set<string>();
      const collectCss = async (mod: typeof entryModule) => {
        if (!mod || visited.has(mod.url)) {
          return;
        }
        visited.add(mod.url);

        if (mod.url.endsWith(".css")) {
          cssUrls.add(mod.url);
        }

        // Recursively check imported modules
        if (mod.importedModules) {
          for (const imported of mod.importedModules) {
            await collectCss(imported);
          }
        }
      };

      await collectCss(entryModule);
    }

    // Inject CSS links into head
    const cssLinks = Array.from(cssUrls)
      .map((url) => `<link rel="stylesheet" href="${url}" />`)
      .join("\n");
    if (cssLinks) {
      template = template.replace("</head>", `${cssLinks}\n</head>`);
    }

    const mod = await vite.ssrLoadModule("/src/entry-server.tsx");
    const { render } = mod as {
      render: (request: Request) => Promise<{
        html: string;
        notFound: boolean;
        hasSession: boolean;
        redirect?: Response;
      }>;
    };

    // Create a Fetch Request from the incoming request
    const url = new URL(
      req.originalUrl ?? req.url,
      `http://${req.headers.host}`,
    );
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
    const htmlWithApp = template
      .replace("<!--app-html-->", html)
      .replace('<div id="root">', injectScript + '<div id="root">');

    if (notFound) {
      res.status(404);
    }
    res.type("text/html").send(htmlWithApp);
  } catch (e) {
    vite.ssrFixStacktrace(e as Error);
    console.error(e);
    res.status(500).send((e as Error).stack);
  }
});

await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(
  `dev SSR server running: http://localhost:${PORT} (or your tunnel URL)`,
);
