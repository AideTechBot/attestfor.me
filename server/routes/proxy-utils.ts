import type { FastifyRequest } from "fastify";
import { store } from "../storage";

export interface RateLimitConfig {
  prefix: string;
  max: number;
  windowSeconds: number;
}

export async function checkRateLimit(
  ip: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; count: number }> {
  const key = `ratelimit:${config.prefix}:${ip}`;
  const current = await store.get(key);
  const count = current ? parseInt(current, 10) + 1 : 1;
  await store.set(key, String(count), config.windowSeconds);
  return { allowed: count <= config.max, count };
}

export function getClientIp(req: FastifyRequest): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    return xff.split(",")[0].trim();
  }
  return req.ip;
}

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /\.local$/i,
  /\.internal$/i,
  /\.localhost$/i,
];

export function isPrivateHost(hostname: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

export function validateProxyUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Invalid URL format";
  }

  if (parsed.protocol !== "https:") {
    return "Only HTTPS URLs are allowed";
  }

  if (isPrivateHost(parsed.hostname)) {
    return "Access to internal hosts is not allowed";
  }

  if (parsed.username || parsed.password) {
    return "URLs with credentials are not allowed";
  }

  if (parsed.port && parsed.port !== "443") {
    return "Non-standard ports are not allowed";
  }

  return null;
}

export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253 || domain.includes(" ")) {
    return false;
  }

  if (isPrivateHost(domain)) {
    return false;
  }

  const domainPattern =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
  return domainPattern.test(domain);
}
