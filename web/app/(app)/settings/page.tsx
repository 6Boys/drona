"use client";

import { useState } from "react";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { AvatarBuilder } from "@/components/profile/AvatarBuilder";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Toggle } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import type { Avatar as AvatarShape, MeResponse } from "@/lib/types";

const BRANCHES = ["CSE", "IT", "ECE", "EEE", "ME", "CE", "MBA", "MCA", "Other"];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <header className="mb-4">
        <h2 className="text-[0.9375rem] font-medium text-text">{title}</h2>
        {description && <p className="mt-0.5 text-[0.8125rem] text-muted">{description}</p>}
      </header>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { me, apply, logout } = useAuth();
  const toast = useToast();
  const { theme, setTheme } = useTheme();

  const [profile, setProfile] = useState({
    displayName: me?.user.displayName ?? "",
    bio: me?.user.bio ?? "",
    branch: me?.user.branch ?? "CSE",
    year: String(me?.user.year ?? 2),
    batch: me?.user.batch ?? "",
  });
  const [avatar, setAvatar] = useState<AvatarShape>(
    me?.user.avatar ?? { hat: "none", eyes: "sparkle", colour: "ube", accessory: "none" },
  );
  const [busy, setBusy] = useState<string | null>(null);

  if (!me) return null;

  const run = async (key: string, fn: () => Promise<MeResponse>, success: string) => {
    setBusy(key);
    try {
      apply(await fn());
      toast(success, "success");
    } catch (err) {
      toast(errorMessage(err, "that didn't save"), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <TopBar title="Settings" subtitle={me.user.email} />

      <PageBody width="sm" className="space-y-4">
        <Section title="Profile" description="How the rest of campus sees you.">
          <div className="space-y-4">
            <Input
              label="Display name"
              value={profile.displayName}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              maxLength={40}
            />
            <Textarea
              label="Bio"
              rows={2}
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              maxLength={160}
              hint={`${profile.bio.length}/160`}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Branch"
                value={profile.branch}
                onChange={(e) => setProfile({ ...profile, branch: e.target.value })}
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
              <Select
                label="Year"
                value={profile.year}
                onChange={(e) => setProfile({ ...profile, year: e.target.value })}
              >
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              label="Batch"
              value={profile.batch}
              onChange={(e) => setProfile({ ...profile, batch: e.target.value })}
              maxLength={20}
            />

            <Button
              loading={busy === "profile"}
              onClick={() =>
                run(
                  "profile",
                  () =>
                    api.patch<MeResponse>("/v1/me", {
                      displayName: profile.displayName,
                      bio: profile.bio,
                      branch: profile.branch,
                      year: Number(profile.year),
                      batch: profile.batch,
                    }),
                  "Profile updated",
                )
              }
            >
              Save profile
            </Button>
          </div>
        </Section>

        <Section title="Identity" description="The gradient and initials that represent you across the app.">
          <AvatarBuilder value={avatar} onChange={setAvatar} name={me.user.displayName} size={88} />
          <Button
            className="mt-4"
            loading={busy === "avatar"}
            onClick={() => run("avatar", () => api.put<MeResponse>("/v1/me/avatar", avatar), "Identity updated")}
          >
            Save identity
          </Button>
        </Section>

        <Section title="Appearance">
          <Toggle
            label="Dark mode"
            description="Switches the whole app, not just this page."
            checked={theme === "dark"}
            onChange={(next) => setTheme(next ? "dark" : "light")}
          />
        </Section>

        <Section title="Privacy" description="Who can see and reach you.">
          <div className="space-y-4">
            <Toggle
              label="Private account"
              description="Only approved followers can see your posts."
              checked={me.user.isPrivate}
              onChange={(next) =>
                run("private", () => api.patch<MeResponse>("/v1/me", { isPrivate: next }), "Privacy updated")
              }
            />

            <div className="border-t border-border pt-4">
              <Toggle
                label="Love Finder"
                description={
                  me.loveFinderAvailable
                    ? "Opt in and your card enters the deck. Turn it off and it disappears again."
                    : me.loveFinderReason || "Not available on your account yet."
                }
                disabled={!me.loveFinderAvailable}
                checked={me.user.loveFinderEnabled}
                onChange={(next) =>
                  run(
                    "dating",
                    () => api.post<MeResponse>("/v1/me/love-finder", { enabled: next }),
                    next ? "Love Finder on" : "Love Finder off",
                  )
                }
              />
            </div>
          </div>
        </Section>

        <Section title="Account">
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Email</dt>
              <dd className="truncate font-mono text-xs text-text">{me.user.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Handle</dt>
              <dd className="font-mono text-xs text-text">@{me.user.handle}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Status</dt>
              <dd>
                <Badge tone={me.user.status === "ACTIVE" ? "positive" : "warning"} mono>
                  {me.user.status.toLowerCase().replace("_", " ")}
                </Badge>
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={logout}>
              Sign out
            </Button>
          </div>
        </Section>
      </PageBody>
    </>
  );
}
