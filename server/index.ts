import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.resolve("dist/client")));

// Read manifest once (if available) so we can inject built CSS files into HTML
let manifestData: Record<string, { css: string[] }> | null = null;
try {
  const manifestRaw = fs.readFileSync(
    path.resolve("dist/client/manifest.json"),
    "utf-8",
  );
  manifestData = JSON.parse(manifestRaw);
} catch {
  manifestData = null; // build might not have been run
}

// Runtime guard: ensure production build files exist before starting
const clientIndexPath = path.resolve("dist/client/index.html");
const serverEntryPath = path.resolve("dist/server/entry-server.js");
if (!fs.existsSync(clientIndexPath) || !fs.existsSync(serverEntryPath)) {
  console.error(
    "dist not found. Run `pnpm run build` before starting the server.",
  );
  process.exit(1);
}

app.get(/.*/, async (req: Request, res: Response) => {
  try {
    let template = fs.readFileSync(
      path.resolve("dist/client/index.html"),
      "utf-8",
    );

    // If we have manifest info, inject CSS link tags for the built CSS files
    if (manifestData) {
      const cssFiles = new Set<string>();
      for (const key of Object.keys(manifestData)) {
        const entry = manifestData[key];
        if (entry.css)
          entry.css.forEach((c: string) => cssFiles.add(`/dist/client/${c}`));
      }
      const cssLinks = Array.from(cssFiles)
        .map((href) => `<link rel="stylesheet" href="${href}" />`)
        .join("\n");
      template = template.replace("</head>", `${cssLinks}\n</head>`);
    }

    const serverEntryURL = pathToFileURL(
      path.resolve("dist/server/entry-server.js"),
    ).href;
    const mod = await import(serverEntryURL);
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

    res.status(200).send(htmlWithApp);
  } catch (e) {
    console.error(e);
    res.status(500).send((e as Error).stack);
  }
});

app.listen(PORT, () => {
  console.log(`Production SSR server running at http://localhost:${PORT}`);
});
