// Served at /sw.js (registered from app/layout.tsx). Deliberately does
// almost nothing: this app is real-time (websockets, live chat, auth) —
// caching API responses would show stale feeds or stale auth state, which is
// worse than no offline support at all. The only jobs here are (1) satisfy
// the "has a service worker" installability requirement for iOS/Android
// Add-to-Home-Screen, and (2) show a real offline page instead of the
// browser's own dinosaur when navigation fails with no connection.
const SW = `
const OFFLINE_URL = "/offline";
const CACHE = "dronasphere-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Only ever intercepts full-page navigations, and only to add an offline
  // fallback — API calls, websockets, images, and every other request pass
  // straight through untouched.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // A stale cached service-worker script is the classic PWA footgun
      // (users stuck on a months-old version forever) — never let a CDN or
      // the browser cache this file itself.
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
