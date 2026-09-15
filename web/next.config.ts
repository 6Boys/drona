import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Emits .next/standalone: a self-contained server plus only the node_modules
  // it actually reached for — what web/Dockerfile ships instead of the whole
  // dependency tree, for the homelab deployment. Vercel has its own build
  // output format and does not expect this mode; forcing it there breaks the
  // build (its trace step looks for a .next/next-server.js.nft.json that
  // standalone mode doesn't produce the same way). Vercel sets VERCEL=1
  // during every build, so this only turns on for `docker build`/self-host.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),

  images: {
    // Uploaded pictures are served by this deployment's own API straight off
    // disk (api/internal/media), already capped at 5 MB and already cached
    // immutably — so there is nothing for Next's optimiser to earn here, and
    // on a small self-hosted box re-encoding every image on demand is a real
    // CPU cost for no benefit. Turning it off also means the media host never
    // has to be listed below: a homelab's hostname, LAN IP or tunnel domain
    // all work without a rebuild.
    unoptimized: true,
  },
};

export default nextConfig;
