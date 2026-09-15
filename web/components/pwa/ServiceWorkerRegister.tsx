"use client";

import { useEffect } from "react";

/** Registers sw.js — production only. A service worker fighting Fast
 * Refresh in dev is a special kind of confusing (stale JS served from a
 * cache while the terminal insists the file changed), and there's nothing
 * for it to do offline-wise until there's a real deployed origin anyway. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
