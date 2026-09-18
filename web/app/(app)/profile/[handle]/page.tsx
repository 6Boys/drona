"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { OwlRankBadge } from "@/components/ui/OwlRankBadge";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { CoinIcon, LockIcon, MessageIcon } from "@/components/ui/Icons";
import { CopyButton } from "@/components/ui/CopyButton";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { CommunityRules } from "@/components/profile/CommunityRules";
import { Paywall } from "@/components/premium/Paywall";
import { isPremiumActive } from "@/lib/premium";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import type { FollowResult, Items, Thread, User } from "@/lib/types";

function PeopleList({ path }: { path: string }) {
  const { data, loading } = useApi<Items<User>>(path, { limit: 40 });

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 rounded-[var(--r-lg)]" />
        ))}
      </div>
    );
  }

  const people = data?.items ?? [];
  if (!people.length) return <EmptyState compact title="Nobody here yet" />;

  return (
    <ul className="space-y-2">
      {people.map((person) => (
        <li key={person.id}>
          <Link href={`/profile/${person.handle}`} className="card flex items-center gap-3 p-3 transition-colors hover:border-border-strong">
            <Avatar user={person} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-medium text-text">{person.displayName}</span>
              <span className="block truncate text-xs text-faint">
                @{person.handle}
                {person.branch ? ` · ${person.branch}` : ""}
              </span>
            </span>
            {person.isBuddy && (
              <Badge tone="accent" mono>
                buddy
              </Badge>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const router = useRouter();
  const toast = useToast();
  const { me, refresh } = useAuth();

  const profile = useApi<User>(`/v1/users/${handle}`);
  const [tab, setTab] = useState<"followers" | "following">("followers");
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const premium = isPremiumActive(me?.user);

  const user = profile.data;
  const isSelf = me?.user.handle === handle;

  const toggleFollow = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const result = user.viewerFollows
        ? await api.delete<FollowResult>(`/v1/users/${handle}/follow`)
        : await api.post<FollowResult>(`/v1/users/${handle}/follow`);
      profile.set((prev) =>
        prev
          ? { ...prev, viewerFollows: result.following, followerCount: result.followerCount, isBuddy: result.isBuddy }
          : prev,
      );
      refresh();
    } catch (err) {
      toast(errorMessage(err, "that didn't work"), "error");
    } finally {
      setBusy(false);
    }
  };

  const message = async () => {
    setBusy(true);
    try {
      const thread = await api.post<Thread>("/v1/threads/dm", { handle });
      router.push(`/chats/${thread.id}`);
    } catch (err) {
      toast(errorMessage(err, "could not open that chat"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar
        title={user?.displayName ?? `@${handle}`}
        subtitle={user ? `@${user.handle}` : undefined}
        back
        titleIsHeading={false}
      />

      <PageBody width="sm">
        {profile.loading ? (
          <Skeleton className="h-56 rounded-[var(--r-lg)]" />
        ) : !user ? (
          <EmptyState title="No account with that handle" body={profile.error ?? undefined} />
        ) : (
          <>
            <section className="card p-5">
              <div className="flex items-start gap-4">
                <Avatar user={user} size={72} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-medium tracking-[-0.015em] text-text">{user.displayName}</h1>
                    {user.isPrivate && (
                      <Badge tone="neutral" mono>
                        <LockIcon size={10} /> private
                      </Badge>
                    )}
                    {user.role !== "STUDENT" && (
                      <Badge tone="accent" mono>
                        {user.role.replace("_", " ").toLowerCase()}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="font-mono text-xs text-faint">@{user.handle}</p>
                    <CopyButton
                      text={typeof window !== "undefined" ? `${window.location.origin}/profile/${user.handle}` : ""}
                      label="Copy profile link"
                    />
                  </div>

                  {user.bio && <p className="mt-2 text-sm text-muted">{user.bio}</p>}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <OwlRankBadge rank={user.owlRank} label={user.owlRankLabel} />
                    {user.branch && (
                      <Badge tone="neutral">
                        {user.branch}
                        {user.year ? ` · Year ${user.year}` : ""}
                      </Badge>
                    )}
                    {user.batch && <Badge tone="neutral">{user.batch}</Badge>}
                    {isSelf && (
                      <Badge tone="gold">
                        <CoinIcon size={11} />
                        <span className="tabnum">{user.stardust.toLocaleString()}</span>
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-5 border-t border-border pt-3 text-sm">
                <span>
                  <span className="tabnum font-medium text-text">{user.followerCount}</span>{" "}
                  <span className="text-muted">followers</span>
                </span>
                <span>
                  <span className="tabnum font-medium text-text">{user.followingCount}</span>{" "}
                  <span className="text-muted">following</span>
                </span>
                {user.isBuddy && (
                  <Badge tone="accent" mono className="ml-auto">
                    buddies
                  </Badge>
                )}
              </div>

              {isSelf && (
                <button
                  type="button"
                  onClick={() => setRulesOpen(true)}
                  className="mt-2 flex cursor-pointer items-center gap-1.5 text-[0.75rem] text-muted hover:text-text"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  Read the rules
                </button>
              )}

              {!isSelf && (
                <div className="mt-3 flex gap-2">
                  <Button
                    fullWidth
                    variant={user.viewerFollows ? "secondary" : "primary"}
                    loading={busy}
                    onClick={toggleFollow}
                  >
                    {user.viewerFollows ? "Following" : user.followsViewer ? "Follow back" : "Follow"}
                  </Button>
                  <Button fullWidth variant="outline" icon={<MessageIcon size={15} />} onClick={message}>
                    Message
                  </Button>
                </div>
              )}

              {isSelf && (
                <div className="mt-3">
                  <Button fullWidth variant="outline" onClick={() => router.push("/settings")}>
                    Edit profile
                  </Button>
                </div>
              )}

              {isSelf && !premium && (
                <div className="card mt-4 p-5">
                  <Paywall />
                </div>
              )}

              {isSelf && (
                <Dialog
                  open={rulesOpen}
                  onClose={() => setRulesOpen(false)}
                  title="Community rules"
                  description="Worth reading once, especially the parts about Love Finder and reporting."
                  width="sm"
                >
                  <CommunityRules />
                </Dialog>
              )}
            </section>

            <div className="mt-4">
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: "followers", label: "Followers", count: user.followerCount },
                  { value: "following", label: "Following", count: user.followingCount },
                ]}
              />
            </div>

            <div className="mt-3">
              <PeopleList key={tab} path={`/v1/users/${handle}/${tab}`} />
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}
