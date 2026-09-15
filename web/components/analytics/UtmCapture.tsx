"use client";

import { useEffect } from "react";
import { captureUtm } from "@/lib/utm";

/** Invisible — reads utm_* params off the current URL into sessionStorage.
 * Mounted on every entry point a paid/shared link could land on. */
export function UtmCapture() {
  useEffect(() => {
    captureUtm(window.location.search);
  }, []);
  return null;
}
