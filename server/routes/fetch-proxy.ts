import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { store } from "../storage";
import {
  checkRateLimit,
  getClientIp,
  validateProxyUrl,
  isPrivateHost,
} from "./proxy-utils";

const ALLOWED_HOSTS = new Set([
  "api.fxtwitter.com",
  "api.github.com",
  "public.api.bsky.app",
  "registry.npmjs.org",
  "tangled.org",
  "www.linkedin.com",
  "www.instagram.com",
]);

const ALLOWED_ACCEPT_VALUES = new Set([
  "application/json",
  "application/vnd.github.v3+json",
  'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
  "text/html",
]);

const RATE_LIMIT = { prefix: "proxy", max: 30, windowSeconds: 60 };
const CACHE_TTL_SECONDS = 60;
const MAX_RESPONSE_BYTES = 512 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

function isValidActivityPubRequest(
  url: URL,
  acceptHeader: string | undefined,
): boolean {
  if (!acceptHeader?.includes("activity+json")) {
    return false;
  }
  // Only allow Mastodon-style profile URLs
  const pathMatch = url.pathname.match(/^\/@[a-zA-Z0-9_]+\/?$/);
  return !!pathMatch && !isPrivateHost(url.hostname);
}

export function registerFetchProxy(app: FastifyInstance) {
  app.get(
    "/api/proxy",
    async (
      req: FastifyRequest<{ Querystring: { url?: string } }>,
      reply: FastifyReply,
    ) => {
      const clientIp = getClientIp(req);
      const rateCheck = await checkRateLimit(clientIp, RATE_LIMIT);

      if (!rateCheck.allowed) {
        return reply
          .status(429)
          .header("Retry-After", String(RATE_LIMIT.windowSeconds))
          .send({ error: "Too many requests" });
      }

      const targetUrl = req.query.url;
      if (!targetUrl || typeof targetUrl !== "string") {
        return reply.status(400).send({ error: "Missing URL parameter" });
      }

      const urlError = validateProxyUrl(targetUrl);
      if (urlError) {
        return reply.status(400).send({ error: urlError });
      }

      const parsed = new URL(targetUrl);
      const acceptHeader = req.headers["x-proxy-accept"] as string | undefined;

      const isAllowed =
        ALLOWED_HOSTS.has(parsed.hostname) ||
        isValidActivityPubRequest(parsed, acceptHeader);

      if (!isAllowed) {
        return reply.status(403).send({ error: "Host not allowed" });
      }

      const cacheKey = `proxy:${acceptHeader || "default"}:${targetUrl}`;
      const cached = await store.get(cacheKey);

      if (cached) {
        try {
          const data = JSON.parse(cached) as {
            status: number;
            contentType: string;
            body: string;
          };
          return reply
            .header("X-Proxy-Cache", "HIT")
            .header("Content-Type", data.contentType)
            .status(data.status)
            .send(data.body);
        } catch {
          // Cache corrupt, continue to fetch
        }
      }

      try {
        const headers: Record<string, string> = {
          "User-Agent": "keytrace-runner/1.0 (attestfor.me proxy)",
        };

        if (acceptHeader && ALLOWED_ACCEPT_VALUES.has(acceptHeader)) {
          headers["Accept"] = acceptHeader;
        }

        const response = await fetch(targetUrl, {
          headers,
          redirect: "follow",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        const contentLength = response.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
          return reply.status(502).send({ error: "Response too large" });
        }

        const body = await response.text();
        if (body.length > MAX_RESPONSE_BYTES) {
          return reply.status(502).send({ error: "Response too large" });
        }

        const contentType =
          response.headers.get("content-type") || "text/plain";

        if (response.ok) {
          await store.set(
            cacheKey,
            JSON.stringify({ status: response.status, contentType, body }),
            CACHE_TTL_SECONDS,
          );
        }

        return reply
          .header("X-Proxy-Cache", "MISS")
          .header("Content-Type", contentType)
          .status(response.status)
          .send(body);
      } catch (err) {
        const message =
          err instanceof Error && err.name === "TimeoutError"
            ? "Request timeout"
            : "Upstream request failed";
        return reply.status(502).send({ error: message });
      }
    },
  );
}
