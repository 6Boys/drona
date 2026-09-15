import type { CapacitorConfig } from "@capacitor/cli";

// This app is real-time (websockets, live chat, auth) and highly dynamic —
// bundling a static copy of the web build into the APK would mean shipping
// a snapshot that immediately drifts from the real backend. So this is a
// thin native shell: the WebView is pointed straight at the real deployed
// site (server.url), the same way the browser is. `webDir` still has to
// point at something (www/) — Capacitor's tooling requires it to exist —
// but it's never actually shown while server.url is set.
//
// server.url is baked into the app at `npx cap sync` time, not read at
// runtime — same as this repo's NEXT_PUBLIC_* Docker build args. Point it at
// wherever the stack is actually reachable before building, e.g.:
//
//   CAPACITOR_SERVER_URL=http://192.168.1.50:8099 npx cap sync android
//
// (on your homelab, that's the box's Tailscale or LAN address — the same
// one already used for NEXT_PUBLIC_API_BASE_URL in .env). The fallback below
// is a placeholder, not a real address.
const SERVER_URL = process.env.CAPACITOR_SERVER_URL || "http://localhost:8099";

const config: CapacitorConfig = {
  appId: "com.dronasphere.app",
  appName: "DronaSphere",
  webDir: "www",
  server: {
    url: SERVER_URL,
    // Required because anton is plain http:// over Tailscale, not https —
    // Android blocks cleartext traffic by default from API 28 onward. Drop
    // this once the deployment is behind real TLS.
    cleartext: SERVER_URL.startsWith("http://"),
  },
};

export default config;
