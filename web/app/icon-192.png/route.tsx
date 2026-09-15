import { ImageResponse } from "next/og";
import { BrandIconAny } from "@/lib/brand-icon";

// Served at /icon-192.png (the folder name is the literal route segment) —
// referenced by app/manifest.ts. Generated rather than a public/ file, same
// reasoning as llms.txt/route.ts: this app deliberately ships no public/ dir.
export function GET() {
  return new ImageResponse(<BrandIconAny size={192} />, { width: 192, height: 192 });
}
