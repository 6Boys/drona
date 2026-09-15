import { ImageResponse } from "next/og";
import { BrandIconMaskable } from "@/lib/brand-icon";

// Served at /icon-512-maskable.png — the "maskable" purpose icon Android
// needs so adaptive-icon shapes (circle, squircle, ...) don't clip the ring.
export function GET() {
  return new ImageResponse(<BrandIconMaskable size={512} />, { width: 512, height: 512 });
}
