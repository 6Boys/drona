"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { GlobeIcon, UploadIcon, PlusIcon } from "@/components/ui/Icons";

/* -----------------------------------------------------------------------------
   One door, not three: the platform in your pocket shouldn't decide whether
   you get an app-shaped experience. This link IS the real, live app at its
   real address — opening it on an iPhone, an iPad or an Android is already
   "the webapp," not a downgrade from some other "real" version. The optional
   step below is purely cosmetic (a home-screen icon, a status bar to match),
   never a second thing to install — Android and desktop Chrome already offer
   that on their own (components/pwa/InstallPrompt.tsx); iOS Safari never
   raises that prompt itself, so its steps are spelled out by hand here.
   -------------------------------------------------------------------------- */

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

export function GetTheApp() {
  const [showSteps, setShowSteps] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => setIos(isIosDevice()), []);

  return (
    <div className="glass glass-panel mx-auto max-w-xl p-6 text-center sm:p-8">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-accent-wash text-accent-hi">
        <GlobeIcon size={20} />
      </span>
      <h3 className="mt-4 text-[1.0625rem] font-medium text-text">One webapp. Every phone.</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-[0.8125rem] leading-relaxed text-muted">
        iPhone, iPad, or Android — it&apos;s the same app at the same address. No store, no separate
        download.
      </p>

      <div className="mt-5 flex flex-col items-center gap-3">
        <ButtonLink href="/login" size="lg" icon={<GlobeIcon size={15} />} className="w-full sm:w-auto">
          Open DronaSphere
        </ButtonLink>
        <button
          type="button"
          onClick={() => setShowSteps((s) => !s)}
          className="cursor-pointer text-[0.8125rem] font-medium text-accent-hi hover:underline"
        >
          {showSteps ? "Hide" : "Add it to your home screen"}
        </button>
      </div>

      {showSteps && (
        <ol className="mx-auto mt-4 max-w-xs space-y-2 text-left text-[0.8125rem] leading-relaxed text-muted">
          {ios ? (
            <>
              <li className="flex items-start gap-2">
                <span className="mono-label shrink-0 text-faint">1.</span>
                Tap <UploadIcon size={13} className="inline -translate-y-0.5" aria-label="Share" /> Share.
              </li>
              <li className="flex items-start gap-2">
                <span className="mono-label shrink-0 text-faint">2.</span>
                Tap <PlusIcon size={13} className="inline -translate-y-0.5" aria-label="Add" /> Add to Home
                Screen.
              </li>
            </>
          ) : (
            <li className="flex items-start gap-2">
              <span className="mono-label shrink-0 text-faint">·</span>
              Open your browser&apos;s menu and look for &quot;Add to Home screen&quot; or &quot;Install
              app&quot; — Chrome usually offers this on its own the first time.
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
