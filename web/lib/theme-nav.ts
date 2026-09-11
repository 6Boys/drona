import type { MouseEvent } from "react";
import { withViewTransition } from "./view-transition";

export function navigateThemed(e: MouseEvent<HTMLAnchorElement>, href: string) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  withViewTransition(() => {
    window.location.href = href;
  });
}
