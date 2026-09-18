import { ImageResponse } from "next/og";

// File-convention route: Next serves this at /opengraph-image and wires the
// og:image (and twitter:image) meta tags to it automatically — no static
// asset or public/ dir needed, consistent with how app/icon.svg covers the
// favicon.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#faf9f6",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#4f1f4a",
            }}
          />
          <div style={{ fontSize: 40, fontWeight: 600, color: "#1a1712" }}>DronaSphere</div>
        </div>
        <div style={{ fontSize: 56, fontWeight: 600, color: "#1a1712", lineHeight: 1.15, display: "flex" }}>
          Your whole campus,
        </div>
        <div style={{ fontSize: 56, fontWeight: 600, color: "#1a1712", lineHeight: 1.15, display: "flex" }}>
          in one place.
        </div>
        <div style={{ fontSize: 28, color: "#6b6459", marginTop: 28, display: "flex" }}>
          Feed · Chat · Note Locker · Night Shift · Love Finder
        </div>
      </div>
    ),
    { ...size },
  );
}
