import "dotenv/config";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import { setupApp } from "./app-setup";

const app = Fastify();
const PORT = Number(process.env.PORT) || 3000;

// Register static file serving for dist/client
await app.register(fastifyStatic, {
  root: path.resolve("dist/client"),
  prefix: "/",
});

// Register shared OAuth/session routes
await setupApp(app);

await app.listen({ port: PORT });
console.log(`Production SSR server running at http://localhost:${PORT}`);
