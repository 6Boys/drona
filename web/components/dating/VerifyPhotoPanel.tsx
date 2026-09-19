"use client";

import { useState } from "react";
import { Atmosphere } from "@/components/fx/Backdrops";
import { Glow } from "@/components/fx/Glow";
import { Button } from "@/components/ui/Button";
import { MediaUpload } from "@/components/ui/MediaUpload";
import { ShieldIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { MeResponse } from "@/lib/types";

/**
 * The one gate Love Finder actually enforces server-side that the rest of the
 * app's gradient-avatar identity system quietly skips: a real photo, on file,
 * before your card can enter anyone's deck (api/internal/domain — CanUseDating).
 *
 * It is self-attested, not moderated — submitting is instant, and that's a
 * stated MVP trade-off for a small campus its operators know personally, not
 * a claim that the photo has been checked by anyone. Say that plainly rather
 * than dressing it up as verification it isn't.
 */
export function VerifyPhotoPanel() {
  const { apply } = useAuth();
  const toast = useToast();
  const [photoUrl, setPhotoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      apply(await api.post<MeResponse>("/v1/me/verify-photo", { photoUrl }));
      toast("Photo on file — you're through this gate", "success");
    } catch (err) {
      setError(errorMessage(err, "could not save that photo"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="glass glass-strong relative overflow-hidden rounded-[var(--r-2xl)] p-8 text-center">
        <Atmosphere tone="love" />
        <Glow color="var(--rose-400)" />
        <div className="relative z-10">
          <span className="glass glass-pill mx-auto flex size-14 items-center justify-center text-accent">
            <ShieldIcon size={22} />
          </span>
          <h2 className="display mt-5 text-[1.75rem] text-text">One photo to get in</h2>
          <p className="mx-auto mt-3 max-w-sm text-[0.875rem] leading-relaxed text-muted">
            Every other surface here is gradients and initials — Love Finder is the one place
            that asks for an actual photo of you, so the deck stays people, not placeholders.
          </p>

          <div className="mt-6 text-left">
            <MediaUpload
              value={photoUrl}
              onChange={setPhotoUrl}
              label="Your photo"
              hint="JPEG, PNG, WEBP or GIF · 5 MB max · no video"
            />
          </div>

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <p className="mt-4 text-[0.75rem] leading-relaxed text-faint">
            This is self-attested, not reviewed by a moderator — accepted the moment you submit
            it. Impersonating someone else is a bannable report, same as anywhere else here.
          </p>

          <div className="mt-5 flex justify-center">
            <Button loading={busy} disabled={!photoUrl} onClick={submit} icon={<ShieldIcon size={15} />}>
              Use this photo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
