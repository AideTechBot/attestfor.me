import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
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
