import { hydrateRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

declare global {
  interface Window {
    __INITIAL_DATA__?: any;
  }
}

const initial = window.__INITIAL_DATA__ || {};
void initial; // reference to avoid unused variable error; pass to App if needed
// You can pass `initial` to your app via context or props if needed
hydrateRoot(document.getElementById("root")!, <App />);
