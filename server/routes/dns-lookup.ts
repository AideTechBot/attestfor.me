import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import dns from "dns";
import { store } from "../storage";
import { checkRateLimit, getClientIp, isValidDomain } from "./proxy-utils";

const RATE_LIMIT = { prefix: "dns", max: 20, windowSeconds: 60 };
const CACHE_TTL_SECONDS = 60;
const DNS_TIMEOUT_MS = 10_000;

export function registerDnsLookup(app: FastifyInstance) {
  app.get(
    "/api/dns",
    async (
      req: FastifyRequest<{ Querystring: { domain?: string } }>,
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

      const domain = req.query.domain;
      if (!domain || typeof domain !== "string") {
        return reply.status(400).send({ error: "Missing domain parameter" });
      }

      if (!isValidDomain(domain)) {
        return reply.status(400).send({ error: "Invalid domain" });
      }

      const cacheKey = `dns:${domain}`;
      const cached = await store.get(cacheKey);

      if (cached) {
        try {
          return reply.header("X-DNS-Cache", "HIT").send(JSON.parse(cached));
        } catch {
          // Cache corrupt, continue to fetch
        }
      }

      const keytraceDomain = `_keytrace.${domain}`;

      try {
        const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
          Promise.race([
            promise,
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), DNS_TIMEOUT_MS),
            ),
          ]);

        const resolveTxt = (name: string): Promise<string[][]> =>
          new Promise((resolve) => {
            dns.resolveTxt(name, (err, records) => resolve(err ? [] : records));
          });

        const [rootRecords, keytraceRecords] = await withTimeout(
          Promise.all([resolveTxt(domain), resolveTxt(keytraceDomain)]),
        );

        const result = {
          domain,
          records: {
            txt: [...rootRecords.flat(), ...keytraceRecords.flat()],
          },
        };

        await store.set(cacheKey, JSON.stringify(result), CACHE_TTL_SECONDS);

        return reply.header("X-DNS-Cache", "MISS").send(result);
      } catch {
        return reply.status(502).send({ error: "DNS lookup failed" });
      }
    },
  );
}
