import { getApiBase } from "@/lib/get-api-base";

/**
 * Create a fetch wrapper that routes HTTPS requests through the server-side
 * proxy at `/api/proxy?url=…`, working around browser CORS restrictions.
 *
 * Only the `Accept` header is forwarded (via `X-Proxy-Accept`).
 * All other custom headers are intentionally dropped — the server-side proxy
 * rejects them to prevent abuse.
 */
export function createProxiedFetch(): typeof globalThis.fetch {
  const originalFetch = globalThis.fetch.bind(globalThis);
  const apiBase = getApiBase();

  return async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);

    // Only proxy HTTPS URLs that are NOT our own server
    if (!url.startsWith("https://") || url.startsWith(window.location.origin)) {
      return originalFetch(input, init);
    }

    const proxyUrl = `${apiBase}/api/proxy?url=${encodeURIComponent(url)}`;

    // Extract Accept header if present
    const headers: Record<string, string> = {};

    if (init?.headers) {
      const h =
        init.headers instanceof Headers
          ? Object.fromEntries(init.headers.entries())
          : Array.isArray(init.headers)
            ? Object.fromEntries(init.headers)
            : (init.headers as Record<string, string>);

      const accept = h["Accept"] || h["accept"];
      if (accept) {
        headers["X-Proxy-Accept"] = accept;
      }
    }

    return originalFetch(proxyUrl, {
      method: "GET",
      headers,
      signal: init?.signal,
    });
  };
}
