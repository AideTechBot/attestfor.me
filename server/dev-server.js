import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 5173;

const vite = await createViteServer({
  server: { middlewareMode: "ssr" },
  appType: "custom",
});

app.use(vite.middlewares);

app.use(async (req, res) => {
  try {
    let template = fs.readFileSync(path.resolve("index.html"), "utf-8");
    template = await vite.transformIndexHtml(req.originalUrl, template);

    const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
    const { html, initState } = await render(req.originalUrl);

    const htmlWithApp = template
      .replace("<!--app-html-->", html)
      .replace(
        "</body>",
        `<script>window.__INITIAL_DATA__=${JSON.stringify(initState)}</script></body>`,
      );

    res.status(200).set({ "Content-Type": "text/html" }).end(htmlWithApp);
  } catch (e) {
    vite.ssrFixStacktrace(e);
    console.error(e);
    res.status(500).end(e.stack);
  }
});

app.listen(PORT, () => {
  console.log(`dev SSR server running: http://localhost:${PORT}`);
});
