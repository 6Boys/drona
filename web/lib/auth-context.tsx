"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, clearSession, getAccessToken } from "./api";
import type { MeResponse } from "./types";

interface AuthState {
  me: MeResponse | null;
  loading: boolean;
  /** Re-fetches /v1/me — call after anything that can move onboardingStep,
   * follower counts, Stardust, or the Love Finder toggle. */
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<MeResponse>("/v1/me");
      setMe(data);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setMe(null);
    router.push("/login");
  }, [router]);

  return <AuthContext.Provider value={{ me, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
