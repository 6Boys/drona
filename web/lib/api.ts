// Typed client for the Go API (api/internal/api/router.go). One fetch
// wrapper, one error shape, one place that knows about tokens — every screen
// calls through here instead of touching fetch() directly.

import type { ApiErrorBody } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

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

// deviceFingerprint is a stable, non-identifying per-browser id used only for
// the Owl Board's per-device dedupe and abuse detection (PRD 6.2, 10) — never
// for anything resembling authentication.
function deviceFingerprint(): string {
  if (typeof window === "undefined") return "";
  const KEY = "drona.device";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
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
  const url = new URL(BASE_URL + path);
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

export { BASE_URL as API_BASE_URL };
