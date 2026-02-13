/**
 * Determine the base URL for server API calls.
 * During SSR (Node.js), we need an absolute URL pointing to our own server.
 * During client-side navigation (browser), relative URLs work fine.
 */
export function getApiBase(request?: Request): string {
  // Client-side: use relative URLs
  if (typeof window !== "undefined") {
    return "";
  }
  // SSR: derive from the incoming request or use env/fallback
  if (request) {
    const url = new URL(request.url);
    return url.origin;
  }
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}
