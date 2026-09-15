import { ImageResponse } from "next/og";
import { BrandIconAny } from "@/lib/brand-icon";

// File-convention route: Next serves this as the apple-touch-icon and wires
// the <link rel="apple-touch-icon"> tag automatically — same mechanism as
// opengraph-image.tsx, no public/ dir needed. 180x180 is Apple's standard
// touch-icon size.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandIconAny size={180} />, { ...size });
}
