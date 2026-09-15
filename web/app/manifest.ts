import type { MetadataRoute } from "next";

// Generates /manifest.webmanifest — Next auto-adds the <link rel="manifest">
// tag. This plus the icons below and sw.js (registered in app/layout.tsx) is
// what makes "Add to Home Screen" on iOS and Android's install prompt treat
// this as an actual app rather than a bookmark.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DronaSphere",
    short_name: "DronaSphere",
    description: "A campus-verified social platform: feed, chat, note locker, night-owl leaderboard, and a verified dating deck.",
    // A signed-in student opening this from a home-screen icon wants the
    // app, not the marketing page — AppShell already redirects to /login
    // for anyone who isn't.
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#100f14",
    theme_color: "#100f14",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
