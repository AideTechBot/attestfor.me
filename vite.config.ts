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
      apply: "build",
      transformIndexHtml: {
        order: "post",
        handler(html) {
          return html.replace(
            "</head>",
            `  <script defer src="/u/script.js" data-website-id="__UMAMI_WEBSITE_ID__"></script>\n  </head>`,
          );
        },
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          // openpgp is ~384 KB — split into its own chunk so it only loads
          // on pages that actually use it (KeyUpload)
          if (id.includes("node_modules/openpgp")) {
            return "openpgp";
          }
          // Stable React core chunk — long-lived cache
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react";
          }
          // React Router
          if (id.includes("node_modules/react-router")) {
            return "router";
          }
          // TanStack Query
          if (id.includes("node_modules/@tanstack")) {
            return "query";
          }
        },
      },
    },
  },
  ssr: {
    target: "node",
  },
  optimizeDeps: {
    // Pre-bundle these dependencies in development for faster server startup
    include: ["react", "react-dom"],
  },
});
