// Renders the same ring-and-dot mark as app/icon.svg, at arbitrary sizes, as
// plain flex/circle divs rather than an <svg> — the shape next/og's
// ImageResponse (Satori) renders most reliably. Used by apple-icon.tsx and
// the manifest icon route handlers so there is exactly one place the brand
// mark's proportions are defined.

const INK = "#4f1f4a";
const PAPER = "#faf9f6";

function circle(size: number, extra?: Record<string, string | number>) {
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...extra,
  } as const;
}

/** Matches icon.svg's proportions (rounded card) — for the manifest's "any"
 * icons and the Apple touch icon, where a self-contained rounded badge is
 * the intended look. */
export function BrandIconAny({ size }: { size: number }) {
  const ringR = size * (9.5 / 32);
  const strokeW = size * (1.8 / 32);
  const dotR = size * (2.8 / 32);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: PAPER,
        borderRadius: size * (7 / 32),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={circle(ringR * 2, { border: `${strokeW}px solid ${INK}` })}>
        <div style={circle(dotR * 2, { background: INK })} />
      </div>
    </div>
  );
}

/** Full-bleed, no corner rounding, and the mark shrunk to Android's ~66%
 * adaptive-icon safe zone — the OS applies its own mask on top of this. */
export function BrandIconMaskable({ size }: { size: number }) {
  const ringR = size * (106 / 512);
  const strokeW = size * (20 / 512);
  const dotR = size * (31 / 512);
  return (
    <div style={{ width: size, height: size, background: PAPER, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={circle(ringR * 2, { border: `${strokeW}px solid ${INK}` })}>
        <div style={circle(dotR * 2, { background: INK })} />
      </div>
    </div>
  );
}
