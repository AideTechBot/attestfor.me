import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import type { ViteDevServer } from "vite";

const app = express();
const PORT = Number(process.env.PORT) || 5173;

const vite: ViteDevServer = await createViteServer({
  server: { middlewareMode: true }, // Changed from "ssr" to true
  appType: "custom",
});

// Vite's middleware is an express-compatible handler
app.use(vite.middlewares);

app.use(async (req: Request, res: Response) => {
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

    res.status(200).set({ "Content-Type": "text/html" }).end(htmlWithApp);
  } catch (e) {
    vite.ssrFixStacktrace(e as Error);
    console.error(e);
    res.status(500).end((e as Error).stack);
  }
});

app.listen(PORT, () => {
  console.log(`dev SSR server running: http://localhost:${PORT}`);
});
