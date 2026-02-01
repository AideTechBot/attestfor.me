import Fastify from "fastify";
import fastifyExpress from "@fastify/express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import type { ViteDevServer } from "vite";
import type { InitialState } from "../src/types";

const app = Fastify();
const PORT = Number(process.env.PORT) || 3000;

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

    // In dev mode, use Vite's module graph to discover CSS dependencies
    const entryModule = await vite.moduleGraph.getModuleByUrl(
      "/src/entry-client.tsx",
    );
    const cssUrls = new Set<string>();

    if (entryModule) {
      const visited = new Set<string>();
      const collectCss = async (mod: typeof entryModule) => {
        if (!mod || visited.has(mod.url)) return;
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
      render: (
        url?: string,
      ) => Promise<{ html: string; initState: InitialState }>;
    };
    const { html, initState } = await render(req.originalUrl);

    const htmlWithApp = template
      .replace("<!--app-html-->", html)
      .replace(
        "</body>",
        `<script>window.__INITIAL_STATE__=${JSON.stringify(initState)}</script></body>`,
      );

    res.type("text/html").send(htmlWithApp);
  } catch (e) {
    vite.ssrFixStacktrace(e as Error);
    console.error(e);
    res.status(500).send((e as Error).stack);
  }
});

await app.listen({ port: PORT });
console.log(`dev SSR server running: http://localhost:${PORT}`);
