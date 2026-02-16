import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routes } from "./routes";
import { SessionHintProvider } from "./lib/session-hint";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter(routes);
const hasSession = !!window.__HAS_SESSION__;

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

hydrateRoot(
  rootElement,
  <QueryClientProvider client={queryClient}>
    <SessionHintProvider hasSession={hasSession}>
      <RouterProvider router={router} />
    </SessionHintProvider>
  </QueryClientProvider>,
);
