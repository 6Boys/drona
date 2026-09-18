"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, clearSession, getAccessToken, getRefreshToken, setSession } from "./api";
import type { MeResponse, OnboardingStep, SessionResponse } from "./types";

interface AuthState {
  me: MeResponse | null;
  loading: boolean;
  signedIn: boolean;
  /** Stores tokens from a verified OTP and loads the account behind them. */
  signIn: (session: SessionResponse) => Promise<MeResponse | null>;
  /** Re-fetches /v1/me — call after anything that moves onboarding, follows,
   * Sparks or the Love Finder toggle. */
  refresh: () => Promise<MeResponse | null>;
  /** Applies a MeResponse the caller already has, skipping a round trip. */
  apply: (me: MeResponse) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Where an account belongs given how far onboarding got. The API decides the
 * step; the client only maps it to a route. */
export function routeForStep(step: OnboardingStep): string {
  return step === "DONE" ? "/feed" : "/onboarding";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setMe(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await api.get<MeResponse>("/v1/me");
      setMe(data);
      return data;
    } catch {
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (session: SessionResponse) => {
      setSession(session.accessToken, session.refreshToken);
      return refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      // Best effort: the local session is cleared either way, so a failed
      // revoke must never strand someone in a half-signed-out state.
      await api.post("/v1/auth/logout", { refreshToken }).catch(() => {});
    }
    clearSession();
    setMe(null);
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({ me, loading, signedIn: !!me, signIn, refresh, apply: setMe, logout }),
    [me, loading, signIn, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
