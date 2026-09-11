// Wraps a navigation (or any DOM update) in the View Transitions API so
// entering/leaving Love Finder reads as a deliberate mode change — the
// cream-and-lavender feed cross-fading into blush-and-flame — rather than a
// hard cut. Progressive enhancement throughout: unsupported browsers and
// prefers-reduced-motion both just get the instant update.
//
// See the modern-web-guidance "same-document-transitions" and CSS
// accessibility guides this follows.

export function withViewTransition(update: () => void): void {
  const supportsVT = typeof document !== "undefined" && "startViewTransition" in document;
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!supportsVT || prefersReducedMotion) {
    update();
    return;
  }

  if ("startViewTransition" in document) {
    (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(() => update());
  } else {
    update();
  }
}

