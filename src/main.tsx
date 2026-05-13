import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global Asset Recover: Intercepts dynamic JS module import failures (typical after new app deployments)
// and seamlessly triggers an automatic page refresh to fetch the newest production assets.
window.addEventListener("error", (e) => {
  const msg = e.message?.toLowerCase() || "";
  if (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("expected a javascript-or-wasm module script")
  ) {
    const lastReload = localStorage.getItem("asset-failure-reload");
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload) > 15000) { // Debounce 15 seconds
      localStorage.setItem("asset-failure-reload", now.toString());
      window.location.reload();
    }
  }
}, true);

window.addEventListener("unhandledrejection", (e) => {
  const msg = e.reason?.message?.toLowerCase() || "";
  if (msg.includes("failed to fetch dynamically imported module")) {
    const lastReload = localStorage.getItem("asset-failure-reload");
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload) > 15000) {
      localStorage.setItem("asset-failure-reload", now.toString());
      window.location.reload();
    }
  }
});

createRoot(document.getElementById("root")!).render(<App />);
