"use client";

// Captures utm_* query params on first landing and keeps them around through
// signup, so "how did this student hear about us" survives the hop from a
// shared link to the login page to onboarding — without standing up an
// analytics pipeline for a single self-hosted deployment.
const KEY = "drona.utm";
const FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export function captureUtm(search: string) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(search);
  const found: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = params.get(field);
    if (value) found[field] = value;
  }
  // Only overwrite a previously-captured campaign if this visit is itself
  // tagged — an organic reload of /login shouldn't erase how they arrived.
  if (Object.keys(found).length) {
    window.sessionStorage.setItem(KEY, JSON.stringify({ ...found, capturedAt: new Date().toISOString() }));
  }
}

export function getStoredUtm(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
