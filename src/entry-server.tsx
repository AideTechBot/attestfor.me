import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routes } from "./routes";
import { SessionHintProvider } from "./lib/session-hint";
import { SESSION_COOKIE_NAME } from "./lib/constants";

// Create static handler once
const handler = createStaticHandler(routes);

export async function render(request: Request) {
  const context = await handler.query(request);

  // Handle redirects
  if (context instanceof Response) {
    return { redirect: context };
  }

  // Check if the request has a session cookie (httpOnly, only visible server-side)
  const cookieHeader = request.headers.get("cookie") || "";
  const hasSession = cookieHeader
    .split(";")
    .some((c) => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`));

  // Create a fresh QueryClient per request to avoid sharing state between requests
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });

  const router = createStaticRouter(handler.dataRoutes, context);
  const html = renderToString(
    <QueryClientProvider client={queryClient}>
      <SessionHintProvider hasSession={hasSession}>
        <StaticRouterProvider router={router} context={context} />
      </SessionHintProvider>
    </QueryClientProvider>,
  );

  // Check if this is a 404 page
  const isNotFound =
    context.matches.length === 0 ||
    context.matches.some((m) => m.route.path === "*") ||
    context.matches.some((m) => {
      const data = context.loaderData?.[m.route.id] as
        | { isValid?: boolean }
        | undefined;
      return data?.isValid === false;
    });

  // Build per-page meta tags from loader data
  let metaDescription: string | undefined;
  let metaTitle: string | undefined;

  for (const match of context.matches) {
    const data = context.loaderData?.[match.route.id] as
      | {
          handle?: string;
          displayName?: string;
          description?: string;
          claims?: unknown[];
          keys?: unknown[];
          isValid?: boolean;
        }
      | undefined;

    if (data?.isValid && data.handle) {
      const name = data.displayName || `@${data.handle}`;
      const claimCount = data.claims?.length ?? 0;
      const keyCount = data.keys?.length ?? 0;

      metaTitle = `${name} (@${data.handle}) — ATtestfor.me`;

      if (data.description) {
        metaDescription = `${data.description} · ${claimCount} verified account${claimCount !== 1 ? "s" : ""} on ATtestfor.me.`;
      } else {
        metaDescription = `${name} has ${claimCount} linked account${claimCount !== 1 ? "s" : ""} and ${keyCount} public key${keyCount !== 1 ? "s" : ""} on ATtestfor.me.`;
      }
      break;
    }
  }

  return { html, notFound: isNotFound, hasSession, metaDescription, metaTitle };
}
