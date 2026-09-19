// Typed client for the Go API (api/internal/api/router.go). One fetch
// wrapper, one error shape, one place that knows about tokens — every screen
// calls through here instead of touching fetch() directly.

import type { ApiErrorBody } from "./types";

// Empty string means "this same origin" — the app's own /v1/* Route Handlers
// (app/v1/[...slug]/route.js) in every environment, dev or deployed, with no
// separate host and no CORS to configure. Set NEXT_PUBLIC_API_BASE_URL only to
// point at something else instead — e.g. the standalone mock server on
// localhost:8080 for realtime while developing, or a real deployed backend.
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? BASE_URL.replace(/^http/, "ws") + "/v1/ws";

export class ApiError extends Error {
  code: string;
  fields?: Record<string, string>;
  friendly?: string;
  status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.error.code;
    this.fields = body.error.fields;
    this.friendly = body.error.friendly;
  }
}

// Access tokens live in memory + localStorage (short-lived, PRD 6 has no
// mention of needing httpOnly cookies for a client this simple); refresh
// tokens live in localStorage only and are exchanged on a 401.
const ACCESS_KEY = "drona.access";
const REFRESH_KEY = "drona.refresh";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setSession(accessToken: string, refreshToken: string) {
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearSession() {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

// crypto.randomUUID() only exists in a secure context (HTTPS, or localhost) —
// on a homelab reached over plain http://, including over Tailscale, calling
// it throws "crypto.randomUUID is not a function" and takes the whole request
// down with it, since every call in this file routes through here. getRandomValues
// has no such restriction, so a hand-rolled RFC 4122 v4 string still gets
// real cryptographic randomness on http://; only the convenience wrapper is
// gated, not the underlying API.
export function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Only reachable with no Web Crypto at all — not cryptographically random,
  // but this id is a dedupe key, never a secret.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

// deviceFingerprint is a stable, non-identifying per-browser id used only for
// the Owl Board's per-device dedupe and abuse detection (PRD 6.2, 10) — never
// for anything resembling authentication.
function deviceFingerprint(): string {
  if (typeof window === "undefined") return "";
  const KEY = "drona.device";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = randomId();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          clearSession();
          return false;
        }
        const data = await res.json();
        setSession(data.accessToken, data.refreshToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  // Skip the automatic refresh-and-retry on 401 (used by the refresh call
  // itself, and by callers that want to handle "not signed in" inline).
  skipAuthRetry?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  // `new URL(path, base)` resolves `path` against `base` whether `base` is
  // absolute (a configured BASE_URL) or we fall back to the page's own
  // origin (BASE_URL === "", meaning "this same deployment") — unlike
  // `new URL(BASE_URL + path)`, which throws on a bare "/v1/..." string.
  const base = BASE_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const url = new URL(path, base);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const fp = deviceFingerprint();
    if (fp) headers["X-Device-Fingerprint"] = fp;

    return fetch(buildUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && !opts.skipAuthRetry && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await doFetch();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, data as ApiErrorBody);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown, query?: RequestOptions["query"]) =>
    request<T>(path, { method: "POST", body, query }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** What POST /v1/media/upload hands back — see api/internal/media. */
export interface MediaUploadResult {
  url: string;
  size: number;
  contentType: string;
}

/**
 * Uploads one file to this instance's own media store (a picture in, a URL
 * out — never a third-party bucket). Bypasses `request()`: this is the one
 * call in the app that sends `multipart/form-data`, not JSON, and it needs
 * the raw Response to read the server's real error message when the file is
 * rejected — the "5 MB, no video" policy is enforced server-side no matter
 * what a caller checked first, so its wording belongs to the server too.
 *
 * Deliberately does not go through the 401-refresh-and-retry dance the rest
 * of the client has: an upload has already sent the file bytes by the time a
 * 401 could come back, and retrying would mean uploading them twice. Callers
 * see the ApiError and can just ask the user to try again.
 */
export async function uploadMedia(file: File): Promise<MediaUploadResult> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const fp = deviceFingerprint();
  if (fp) headers["X-Device-Fingerprint"] = fp;

  const body = new FormData();
  body.append("file", file);

  const res = await fetch(buildUrl("/v1/media/upload"), { method: "POST", headers, body });

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, data as ApiErrorBody);
  return data as MediaUploadResult;
}

export { BASE_URL as API_BASE_URL, WS_URL as API_WS_URL };

/** Friendly-first error copy. The API writes the human sentence; the client
 * never invents one on top of it. */
export function errorMessage(err: unknown, fallback = "something went wrong"): string {
  if (err instanceof ApiError) return err.friendly || err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
