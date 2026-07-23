import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// V4 media service worker disabled — media loads directly from CDN.
// Unregister any previously-installed worker so old caches don't intercept.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations?.().then((regs) => {
    regs.forEach((r) => {
      if (r.active?.scriptURL.includes('v4-media-sw.js')) r.unregister();
    });
  }).catch(() => {});
}

// Global error handlers for pre-React crashes
window.onerror = function (msg, source, lineno, colno, error) {
  try {
    const root = document.getElementById("root");
    if (root && !root.dataset.reactMounted) {
      root.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;">
        <div style="max-width:400px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
          <h1 style="font-size:20px;font-weight:bold;margin-bottom:8px;">Page failed to load</h1>
          <p style="color:#666;margin-bottom:16px;font-size:14px;">An error occurred before the app could start.</p>
          <p style="color:#999;font-size:11px;word-break:break-all;margin-bottom:16px;">${String(msg)}</p>
          <button onclick="location.reload()" style="padding:10px 24px;background:#7c3aed;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;">Reload</button>
        </div>
      </div>`;
    }
  } catch (_) {}
};

window.onunhandledrejection = function (event) {
  console.error("Unhandled rejection:", event.reason);
};

try {
  const root = createRoot(document.getElementById("root")!);
  root.render(<App />);
  document.getElementById("root")!.dataset.reactMounted = "true";
} catch (err) {
  console.error("React mount failed:", err);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;">
      <div style="max-width:400px;text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
        <h1 style="font-size:20px;font-weight:bold;margin-bottom:8px;">Page failed to load</h1>
        <p style="color:#666;font-size:14px;margin-bottom:16px;">${err instanceof Error ? err.message : String(err)}</p>
        <button onclick="location.reload()" style="padding:10px 24px;background:#7c3aed;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;">Reload</button>
      </div>
    </div>`;
  }
}
