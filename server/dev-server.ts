import Fastify from "fastify";
import fastifyExpress from "@fastify/express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import type { ViteDevServer } from "vite";

const app = Fastify();
const PORT = Number(process.env.PORT) || 5173;

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

    const mod = await vite.ssrLoadModule("/src/entry-server.tsx");
    const { render } = mod as {
      render: (url?: string) => Promise<{ html: string; initState?: any }>;
    };
    const { html, initState } = await render(req.originalUrl);

    const htmlWithApp = template
      .replace("<!--app-html-->", html)
      .replace(
        "</body>",
        `<script>window.__INITIAL_DATA__=${JSON.stringify(initState)}</script></body>`,
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
