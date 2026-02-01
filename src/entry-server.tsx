import { renderToString } from "react-dom/server";
import App from "./App";
import type { InitialState } from "./types";

export async function render(
  _url?: string,
): Promise<{ html: string; initState: InitialState }> {
  // Example server-side data fetching could go here based on the `_url`.
  void _url; // reference to avoid unused parameter error
  const appHtml = renderToString(<App />);
  const initState: InitialState = {}; // fill with server-provided initial state as needed
  return { html: appHtml, initState };
}
