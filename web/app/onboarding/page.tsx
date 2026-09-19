"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AvatarBuilder } from "@/components/profile/AvatarBuilder";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon, SpinnerIcon } from "@/components/ui/Icons";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Avatar as AvatarShape, FollowResult, MeResponse, OnboardingStep, SuggestionsResponse } from "@/lib/types";
import { cn } from "@/lib/cn";

const STEPS: { key: OnboardingStep; label: string }[] = [
  { key: "HANDLE", label: "Handle" },
  { key: "PROFILE", label: "Course" },
  { key: "AVATAR", label: "Avatar" },
  { key: "FOLLOWS", label: "Follows" },
];

const BRANCHES = ["CSE", "IT", "ECE", "EEE", "ME", "CE", "MBA", "MCA", "Other"];

function Rail({ current }: { current: OnboardingStep }) {
  const index = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mb-5 flex items-center gap-1.5">
      {STEPS.map((step, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <li key={step.key} className="flex flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "h-0.5 w-full rounded-full transition-colors",
                done ? "bg-accent" : active ? "bg-accent-hi" : "bg-border-strong",
              )}
            />
            <span
              className={cn(
                "mono-label",
                active ? "text-accent-hi" : done ? "text-muted" : "text-faint",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { me, loading, apply } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = me?.onboardingStep ?? "HANDLE";

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace("/login");
    else if (me.onboardingStep === "DONE") router.replace("/feed");
  }, [loading, me, router]);

  const save = useCallback(
    async (fn: () => Promise<MeResponse>) => {
      setBusy(true);
      setError(null);
      try {
        apply(await fn());
      } catch (err) {
        setError(errorMessage(err, "that didn't save"));
      } finally {
        setBusy(false);
      }
    },
    [apply],
  );

  if (loading || !me || me.onboardingStep === "DONE") {
    return (
      <AuthLayout>
        <div className="flex justify-center py-10">
          <SpinnerIcon className="text-faint" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="card rise p-6">
        <Rail current={step} />
        {step === "HANDLE" && <HandleStep me={me} busy={busy} error={error} save={save} />}
        {step === "PROFILE" && <ProfileStep busy={busy} error={error} save={save} />}
        {step === "AVATAR" && <AvatarStep me={me} busy={busy} error={error} save={save} />}
        {step === "FOLLOWS" && <FollowStep me={me} />}
      </div>
    </AuthLayout>
  );
}

type SaveFn = (fn: () => Promise<MeResponse>) => Promise<void>;

function HandleStep({
  me,
  busy,
  error,
  save,
}: {
  me: MeResponse;
  busy: boolean;
  error: string | null;
  save: SaveFn;
}) {
  const [handle, setHandle] = useState(me.user.handle ?? "");
  const [displayName, setDisplayName] = useState(me.user.displayName ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(() => api.patch<MeResponse>("/v1/me", { handle: handle.toLowerCase().trim(), displayName }));
      }}
    >
      <div>
        <h1 className="text-xl font-medium tracking-[-0.02em]">Pick your handle</h1>
        <p className="mt-1 text-sm text-muted">
          This is how people find you. You can change it once every 30 days.
        </p>
      </div>

      <Input
        label="Handle"
        prefix="@"
        required
        autoFocus
        value={handle}
        onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
        hint="3–20 characters · lowercase, numbers and underscores"
        maxLength={20}
      />
      <Input
        label="Display name"
        required
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="What your friends call you"
        maxLength={40}
      />

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button type="submit" fullWidth size="lg" loading={busy} disabled={handle.length < 3 || displayName.trim().length < 2}>
        Continue
      </Button>
    </form>
  );
}

function ProfileStep({ busy, error, save }: { busy: boolean; error: string | null; save: SaveFn }) {
  const [branch, setBranch] = useState("CSE");
  const [year, setYear] = useState("2");
  const [batch, setBatch] = useState("");
  const [dob, setDob] = useState("");
  const [bio, setBio] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(() =>
          api.patch<MeResponse>("/v1/me", {
            branch,
            year: Number(year),
            batch: batch.trim() || undefined,
            dob,
            bio: bio.trim() || undefined,
          }),
        );
      }}
    >
      <div>
        <h1 className="text-xl font-medium tracking-[-0.02em]">Where do you study?</h1>
        <p className="mt-1 text-sm text-muted">
          This seeds your feed with your batch and branch. Your date of birth is used only for age
          checks and is never shown on your profile.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)}>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
        <Select label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
          {[1, 2, 3, 4, 5].map((y) => (
            <option key={y} value={y}>
              Year {y}
            </option>
          ))}
        </Select>
      </div>

      <Input
        label="Batch"
        placeholder="2023-27"
        value={batch}
        onChange={(e) => setBatch(e.target.value)}
        maxLength={20}
      />
      <Input
        label="Date of birth"
        type="date"
        required
        value={dob}
        onChange={(e) => setDob(e.target.value)}
        hint="Stored for age verification. Never displayed."
      />
      <Textarea
        label="Bio"
        rows={2}
        placeholder="Optional. One line is plenty."
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={160}
      />

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button type="submit" fullWidth size="lg" loading={busy} disabled={!dob}>
        Continue
      </Button>
    </form>
  );
}

function AvatarStep({
  me,
  busy,
  error,
  save,
}: {
  me: MeResponse;
  busy: boolean;
  error: string | null;
  save: SaveFn;
}) {
  const [avatar, setAvatar] = useState<AvatarShape>(
    me.user.avatar ?? { hat: "none", eyes: "sparkle", colour: "ube", accessory: "none" },
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-medium tracking-[-0.02em]">Pick your look</h1>
        <p className="mt-1 text-sm text-muted">
          Your initials on a gradient. Generated instantly, changeable any time, and nobody is
          blocked from posting because they lack a good photo.
        </p>
      </div>

      <AvatarBuilder value={avatar} onChange={setAvatar} name={me.user.displayName} />

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button
        fullWidth
        size="lg"
        loading={busy}
        onClick={() => save(() => api.put<MeResponse>("/v1/me/avatar", avatar))}
      >
        Use this
      </Button>
    </div>
  );
}

function FollowStep({ me }: { me: MeResponse }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [suggestions, setSuggestions] = useState<SuggestionsResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<SuggestionsResponse>("/v1/onboarding/suggestions", { limit: 16 })
      .then((data) => {
        setSuggestions(data);
        // Pre-select everything: the one-tap "follow all" path is the default,
        // and de-selecting is easier than picking eight from cold (PRD 6.1).
        setSelected(new Set(data.items.map((u) => u.handle)));
      })
      .catch((err) => setError(errorMessage(err, "could not load suggestions")));
  }, []);

  const minFollows = suggestions?.minFollows ?? 8;
  const remaining = Math.max(0, minFollows - selected.size - me.followingCount);
  const ready = remaining === 0 && selected.size > 0;

  const toggle = (handle: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post<FollowResult>("/v1/onboarding/follow-all", { handles: [...selected] });
      const account = await refresh();
      if (account?.onboardingStep === "DONE") router.replace("/feed");
    } catch (err) {
      setError(errorMessage(err, "could not follow those accounts"));
    } finally {
      setBusy(false);
    }
  };

  const items = useMemo(() => suggestions?.items ?? [], [suggestions]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-medium tracking-[-0.02em]">Follow at least {minFollows}</h1>
        <p className="mt-1 text-sm text-muted">
          A feed with fewer sources looks empty on day one. Pick your batch, your branch, the clubs
          you care about — you can unfollow any of them later.
        </p>
      </div>

      {!suggestions ? (
        <div className="flex justify-center py-8">
          <SpinnerIcon className="text-faint" />
        </div>
      ) : (
        <>
          <div className="max-h-[19rem] space-y-1 overflow-y-auto pr-1">
            {items.map((user) => {
              const on = selected.has(user.handle);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggle(user.handle)}
                  aria-pressed={on}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-[var(--r-md)] border px-3 py-2 text-left transition-colors",
                    on ? "border-accent bg-accent-wash" : "border-border hover:border-border-strong",
                  )}
                >
                  <Avatar user={user} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium text-text">
                      {user.displayName}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      @{user.handle}
                      {user.branch ? ` · ${user.branch}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      on ? "border-accent bg-accent text-on-accent" : "border-border-strong",
                    )}
                  >
                    {on && <CheckIcon size={12} />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <Badge tone={ready ? "positive" : "neutral"} mono>
              {selected.size} selected
            </Badge>
            {!ready && <span className="text-xs text-muted">{remaining} more to go</span>}
          </div>
        </>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button fullWidth size="lg" loading={busy} disabled={!ready} onClick={submit}>
        {ready ? "Follow and enter DronaSphere" : `Pick ${remaining} more`}
      </Button>
    </div>
  );
}
