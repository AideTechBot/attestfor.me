import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { routes } from "./routes";
import { SessionHintProvider } from "./lib/session-hint";

const router = createBrowserRouter(routes);
const hasSession = !!window.__HAS_SESSION__;

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

hydrateRoot(
  rootElement,
  <SessionHintProvider hasSession={hasSession}>
    <RouterProvider router={router} />
  </SessionHintProvider>,
);
