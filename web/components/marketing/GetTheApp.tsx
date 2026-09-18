"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DownloadIcon, UploadIcon, PlusIcon, GlobeIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   Three doors, because "the app" means something different depending on what's
   in your pocket. Android gets a real file — a debug APK installs with no
   Play Store, no developer account, same as any side-loaded app. iOS gets the
   thing that actually exists there: Safari's own "Add to Home Screen", which
   there is no way to trigger from a web page — a screenshot of doing it by
   hand is the honest version of an "install" button on that platform. Everyone
   else gets what the other two are shortcuts to anyway: the site itself.
   -------------------------------------------------------------------------- */

function Card({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass glass-panel flex flex-col p-6">
      <span className="flex size-10 items-center justify-center rounded-full bg-accent-wash text-accent-hi">
        {icon}
      </span>
      <h3 className="mt-4 text-[1.0625rem] font-medium text-text">{title}</h3>
      <p className="mt-1.5 flex-1 text-[0.8125rem] leading-relaxed text-muted">{body}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export function GetTheApp() {
  const [showIosSteps, setShowIosSteps] = useState(false);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card
        icon={<DownloadIcon size={18} />}
        title="Android"
        body="A direct install — no Play Store, no developer account. Same app either way, this is just the file."
      >
        <Button
          fullWidth
          icon={<DownloadIcon size={15} />}
          onClick={() => {
            const a = document.createElement("a");
            a.href = "/downloads/dronasphere-debug.apk";
            a.download = "DronaSphere.apk";
            a.click();
          }}
        >
          Download the APK
        </Button>
      </Card>

      <Card
        icon={<UploadIcon size={18} />}
        title="iPhone & iPad"
        body="Safari turns this into a real home-screen app — full screen, its own icon, no App Store step."
      >
        <Button fullWidth variant="outline" onClick={() => setShowIosSteps((s) => !s)}>
          {showIosSteps ? "Hide the steps" : "Show me how"}
        </Button>
        {showIosSteps && (
          <ol className="mt-3 space-y-2 text-[0.8125rem] leading-relaxed text-muted">
            <li className="flex items-start gap-2">
              <span className="mono-label shrink-0 text-faint">1.</span>
              Open this site in Safari, then tap{" "}
              <UploadIcon size={13} className="inline -translate-y-0.5" aria-label="Share" /> Share.
            </li>
            <li className="flex items-start gap-2">
              <span className="mono-label shrink-0 text-faint">2.</span>
              Tap <PlusIcon size={13} className="inline -translate-y-0.5" aria-label="Add" /> Add to
              Home Screen.
            </li>
          </ol>
        )}
      </Card>

      <Card
        icon={<GlobeIcon size={18} />}
        title="Everyone else"
        body="No install at all — the whole thing already runs in a browser tab, on desktop or mobile."
      >
        <ButtonLink fullWidth href="/login" icon={<GlobeIcon size={15} />}>
          Open the website
        </ButtonLink>
      </Card>
    </div>
  );
}
