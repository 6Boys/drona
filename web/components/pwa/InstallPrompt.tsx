"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DownloadIcon, PlusIcon, UploadIcon, XIcon } from "@/components/ui/Icons";

/* -----------------------------------------------------------------------------
   No platform tells anyone to install this on its own: Chrome only raises a
   small, easy-to-miss icon in the omnibox (desktop) or nothing proactive at
   all (Android needs the page to catch `beforeinstallprompt` and drive its
   own UI), and neither Safari variant ever fires that event — the only way
   onto an iPhone home screen or a Mac Dock is a hand-written nudge pointing
   at the right menu. This is that missing nudge for all three.

   Never shown inside the Capacitor shell (mobile/) — that WebView already
   *is* the installed app, so "install DronaSphere" would be nonsensical
   there — or once already running standalone (installed and launched from
   a home-screen icon), on any platform.
   -------------------------------------------------------------------------- */

const DISMISS_KEY = "drona.install-dismissed-at";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

function isStandaloneDisplay() {
  type NavigatorStandalone = Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as NavigatorStandalone).standalone === true
  );
}

function isCapacitorNative() {
  type CapacitorGlobal = { Capacitor?: { isNativePlatform?: () => boolean } };
  return !!(window as unknown as CapacitorGlobal).Capacitor?.isNativePlatform?.();
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

// macOS Safari is the other browser that never fires beforeinstallprompt —
// its own path onto the Dock ("Add to Dock") lives in a menu, not a banner
// it shows you, so it needs the same hand-written nudge as iOS.
function isMacSafari() {
  const ua = window.navigator.userAgent;
  return /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
}

type Kind = "android" | "ios" | "mac-safari";

export function InstallPrompt() {
  const [kind, setKind] = useState<Kind | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isCapacitorNative() || isStandaloneDisplay()) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < SNOOZE_MS) return;

    // Neither Safari variant ever fires beforeinstallprompt — the
    // manual-steps card is the only option there, so show it straight away.
    if (isIosSafari()) {
      setKind("ios");
      return;
    }
    if (isMacSafari()) {
      setKind("mac-safari");
      return;
    }

    const onBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      // Re-checked here, not just above: this is the same Chrome engine
      // Android's WebView uses, so it can still fire this event inside the
      // Capacitor shell even though the mount-time check above passed.
      if (isCapacitorNative()) return;
      setDeferred(e);
      setKind("android");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setKind(null);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    setKind(null);
    // Only snooze on a real decline — an accept will make isStandaloneDisplay()
    // true on the next load anyway, so nothing would show regardless.
    if (outcome !== "accepted") localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  return (
    <AnimatePresence>
      {kind && (
        <motion.div
          role="dialog"
          aria-label="Install DronaSphere"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          // Sits well above the floating MobileNav (~5.5rem clearance) *and*
          // above where a toast would land at that same clearance — this can
          // be on screen for a while (no auto-dismiss), so it needs its own
          // lane rather than fighting Toast for the same spot.
          className="glass glass-strong fixed inset-x-3 z-40 flex items-start gap-3 rounded-[var(--r-md)] p-3.5 shadow-[var(--sh-card)] bottom-[calc(9.5rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-5 sm:bottom-24 sm:max-w-sm"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-wash text-accent-hi">
            <DownloadIcon size={18} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">Install DronaSphere</p>
            {kind === "android" ? (
              <>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">
                  Add it to your home screen for a faster, full-screen app.
                </p>
                <button
                  type="button"
                  onClick={install}
                  className="mt-2.5 cursor-pointer rounded-full bg-accent px-3.5 py-1.5 text-[0.8125rem] font-medium text-on-accent"
                >
                  Install
                </button>
              </>
            ) : kind === "ios" ? (
              <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">
                Tap <UploadIcon size={13} className="inline -translate-y-0.5" aria-label="Share" />
                {" Share, then "}
                <PlusIcon size={13} className="inline -translate-y-0.5" aria-label="Add" />
                {" Add to Home Screen."}
              </p>
            ) : (
              <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">
                Open the Safari menu bar and choose <strong className="font-medium text-text">Add to Dock</strong>.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 cursor-pointer text-faint hover:text-text"
          >
            <XIcon size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
