import { ImageResponse } from "next/og";
import { BrandIconAny } from "@/lib/brand-icon";

// Served at /icon-512.png — see icon-192.png/route.ts.
export function GET() {
  return new ImageResponse(<BrandIconAny size={512} />, { width: 512, height: 512 });
}
