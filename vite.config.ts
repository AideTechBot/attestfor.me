import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    // Inject Umami analytics script tag so it survives Vite's build
    // The placeholder is replaced at runtime by the server with the real website ID
    {
      name: "inject-umami",
      transformIndexHtml(html) {
        return html.replace(
          "</head>",
          `  <script defer src="/u/script.js" data-website-id="__UMAMI_WEBSITE_ID__"></script>\n  </head>`,
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Emit a manifest so the production server can discover built CSS files
    manifest: true,
    // Improve SSR build performance
    minify: true,
    sourcemap: false,
  },
  ssr: {
    target: "node",
  },
  optimizeDeps: {
    // Pre-bundle these dependencies in development for faster server startup
    include: ["react", "react-dom"],
  },
});
