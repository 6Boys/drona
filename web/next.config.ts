import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Signed upload URLs point at R2/S3 in production; placehold.co is used
    // by the seed data only. Add the real bucket host when it exists.
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "storage.dronasphere.app" },
    ],
  },
};

export default nextConfig;
