import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router";
import { routes } from "./routes";

// Create static handler once
const handler = createStaticHandler(routes);

export async function render(request: Request) {
  const context = await handler.query(request);

  // Handle redirects
  if (context instanceof Response) {
    return { redirect: context };
  }

  const router = createStaticRouter(handler.dataRoutes, context);
  const html = renderToString(
    <StaticRouterProvider router={router} context={context} />,
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

  return { html, notFound: isNotFound };
}
