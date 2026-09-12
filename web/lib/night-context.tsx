"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";
import type { HeartbeatStatus } from "./types";

// The Owl Board scores server-side session heartbeats, not app-open time
// (PRD 6.2 anti-cheat). One heartbeat per minute from the shell is what the
// endpoint is for, and its response doubles as the night status every surface
// reads: the sidebar pill, the board, the burrow timer.
const INTERVAL_MS = 60_000;

interface NightState {
  status: HeartbeatStatus | null;
  refresh: () => Promise<void>;
}

const NightContext = createContext<NightState>({ status: null, refresh: async () => {} });

export function NightProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [status, setStatus] = useState<HeartbeatStatus | null>(null);
  const onboarded = me?.onboardingStep === "DONE";

  const refresh = useCallback(async () => {
    if (!onboarded) return;
    try {
      setStatus(await api.post<HeartbeatStatus>("/v1/owl/heartbeat"));
    } catch {
      // A missed heartbeat is not worth surfacing — the next tick retries.
    }
  }, [onboarded]);

  useEffect(() => {
    if (!onboarded) {
      setStatus(null);
      return;
    }
    refresh();
    const id = setInterval(refresh, INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [onboarded, refresh]);

  const value = useMemo(() => ({ status, refresh }), [status, refresh]);
  return <NightContext.Provider value={value}>{children}</NightContext.Provider>;
}

export function useNight() {
  return useContext(NightContext);
}
