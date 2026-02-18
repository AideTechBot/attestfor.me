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

  return { html, notFound: isNotFound, hasSession };
}
