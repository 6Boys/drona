"use client";

import { useCallback, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { MatchModal } from "@/components/dating/MatchModal";
import { SwipeDeck, type SwipeDecision } from "@/components/dating/SwipeDeck";
import { DatingBgWidgets } from "@/components/dating/DatingBgWidgets";
import { LikesYouGrid } from "@/components/dating/LikesYouGrid";
import { MatchesPanel } from "@/components/dating/MatchesPanel";
import { DatingProfileEditor } from "@/components/dating/DatingProfileEditor";
import { VerifyPhotoPanel } from "@/components/dating/VerifyPhotoPanel";
import { Atmosphere } from "@/components/fx/Backdrops";
import { Glow } from "@/components/fx/Glow";
import { FlipWords } from "@/components/fx/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { HeartIcon, LockIcon, SparkleIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { dating, useDatingProfile, useDeck, useLikes, useMatches } from "@/lib/dating-store";
import type { DatingCandidate, DatingMatch, MeResponse } from "@/lib/types";

type Tab = "deck" | "likes" | "matches" | "you";

/* -----------------------------------------------------------------------------
   Love Finder.

   Four surfaces behind one header: the deck, the likes you've received, the
   matches that came out of them, and your own card. All four read from
   /v1/dating/* — the counts in the tab strip are the server's counts, and a
   swipe is a row in Postgres before it is an animation.
   -------------------------------------------------------------------------- */

function Panel({
  title,
  body,
  action,
  icon: Icon = HeartIcon,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  icon?: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="glass glass-strong relative overflow-hidden rounded-[var(--r-2xl)] p-8 text-center">
        <Atmosphere tone="love" />
        <Glow color="var(--rose-400)" />
        <div className="relative z-10">
          <span className="glass glass-pill mx-auto flex size-14 items-center justify-center text-accent">
            <Icon size={24} />
          </span>
          <h2 className="display mt-5 text-[1.75rem] text-text">{title}</h2>
          <p className="mx-auto mt-3 max-w-sm text-[0.875rem] leading-relaxed text-muted">{body}</p>
          {action && <div className="mt-6 flex justify-center">{action}</div>}
        </div>
      </div>
    </div>
  );
}

/** The deck's own loading state: the card's silhouette, not a spinner in a
 * void — the shape that's coming is the most useful thing to show. */
function DeckSkeleton() {
  return (
    <div className="flex flex-col items-center">
      <Skeleton className="h-[clamp(24rem,calc(100dvh-22rem),38rem)] w-full max-w-[25rem] rounded-[var(--r-2xl)]" />
      <div className="mt-8 flex items-center gap-6">
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="size-14 rounded-full" />
      </div>
    </div>
  );
}

export default function DatingPage() {
  const router = useRouter();
  const { me, apply } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("deck");
  const [busy, setBusy] = useState(false);
  const [matched, setMatched] = useState<DatingMatch | null>(null);
  const [front, setFront] = useState<DatingCandidate | undefined>();

  const deck = useDeck();
  const likes = useLikes();
  const matches = useMatches();
  const card = useDatingProfile();

  const { setTwinklesLeft, advance } = deck;
  const reloadLikes = likes.reload;
  const reloadMatches = matches.reload;

  /** One place every swipe lands, wherever it came from: the deck's gesture,
   * the deck's buttons, or answering a like. The server decides; this only
   * reports what it decided. */
  const swipe = useCallback(
    async ({ action, candidate, target, note }: SwipeDecision) => {
      advance(candidate.handle);
      try {
        const result = await dating.swipe(candidate.handle, action, target, note);
        setTwinklesLeft(result.twinklesLeft);

        if (result.matched && result.match) {
          setMatched(result.match);
          void reloadMatches();
        } else if (action === "TWINKLE") {
          toast(`Twinkle sent to ${candidate.displayName}`, "success");
        } else if (note) {
          toast(`Comment sent to ${candidate.displayName}`, "success");
        }
        void reloadLikes();
      } catch (err) {
        toast(errorMessage(err, "that didn't go through"), "error");
        // Put them back: the swipe never happened as far as the server knows.
        void deck.reload();
      }
    },
    [advance, setTwinklesLeft, toast, reloadLikes, reloadMatches, deck],
  );

  if (!me) return null;

  const enable = async (enabled: boolean) => {
    setBusy(true);
    try {
      apply(await api.post<MeResponse>("/v1/me/love-finder", { enabled }));
      toast(enabled ? "You're in the deck" : "Your card is out of the deck", "success");
      if (enabled) void deck.reload();
    } catch (err) {
      toast(errorMessage(err, "could not change that"), "error");
    } finally {
      setBusy(false);
    }
  };

  const gated = !me.loveFinderAvailable;
  const off = !me.user.loveFinderEnabled;

  return (
    <div data-theme="dating">
      <TopBar
        title="Love Finder"
        subtitle="Campus only"
        tabs={
          !gated && !off ? (
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: "deck", label: "Discover", count: deck.items.length },
                { value: "likes", label: "Likes you", count: likes.items.length },
                { value: "matches", label: "Matches", count: matches.items.length },
                { value: "you", label: "Your card" },
              ]}
            />
          ) : null
        }
      />

      <PageBody width={tab === "you" || tab === "likes" ? "lg" : "md"}>
        {gated && me.user.isAdult !== false && !me.user.photoVerified ? (
          // The one real gate left once age is cleared: api/internal/domain's
          // CanUseDating requires a photo on file, and nothing else in this
          // app ever asks for one (every other identity is a gradient).
          <VerifyPhotoPanel />
        ) : gated ? (
          <Panel
            icon={LockIcon}
            title="Not open for you yet"
            body={
              me.loveFinderReason ||
              "This gates at the account level — age, photo verification and campus size all have to line up before your card can enter anyone's deck."
            }
          />
        ) : off ? (
          <Panel
            title="Your card isn't in the deck"
            body="Off by default. Turn it on and your card starts appearing for people who opted in too. Turn it off any time and it disappears again — no trace, no notification, nothing announced to anyone."
            action={
              <Button size="lg" loading={busy} onClick={() => enable(true)} icon={<HeartIcon size={16} />}>
                Put me in the deck
              </Button>
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === "deck" && (
                <>
                  <p className="display mb-6 text-center text-[1.75rem] text-text">
                    Tonight you might meet{" "}
                    <FlipWords
                      words={["someone from ECE", "your lab partner's friend", "the 6am runner", "a debater"]}
                      className="text-accent"
                    />
                  </p>

                  {deck.loading ? (
                    <DeckSkeleton />
                  ) : (
                    <SwipeDeck
                      candidates={deck.items}
                      twinklesLeft={deck.twinklesLeft}
                      onDecide={swipe}
                      onTopChange={setFront}
                      onRemove={(candidate) => advance(candidate.handle)}
                      onTwinkleBlocked={() =>
                        toast("No Twinkles left today. One a day, on purpose.", "info")
                      }
                      emptyState={
                        <Panel
                          title="That's everyone for now"
                          body="You've seen every card on campus that's opted in. The deck refills as more people join — a swipe is final, so nobody you've already answered comes back around."
                          action={
                            <Button variant="outline" onClick={() => void deck.reload()}>
                              Check again
                            </Button>
                          }
                        />
                      }
                    />
                  )}

                  <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-faint">
                    <SparkleIcon size={12} className="text-gold" />
                    {deck.twinklesLeft} {deck.twinklesLeft === 1 ? "Twinkle" : "Twinkles"} left today
                  </p>

                  <DatingBgWidgets candidate={front} />
                </>
              )}

              {tab === "likes" && (
                <>
                  <header className="mb-6">
                    <h2 className="display text-[2rem] text-text">
                      {likes.items.length === 0
                        ? "Likes you"
                        : likes.items.length === 1
                          ? "One person liked you"
                          : `${likes.items.length} people liked you`}
                    </h2>
                    <p className="mt-2 max-w-xl text-[0.875rem] leading-relaxed text-muted">
                      Everything visible, nothing blurred, nothing behind a paywall. Open one to read
                      what they said and answer it.
                    </p>
                  </header>

                  {likes.loading ? (
                    <div className="grid auto-rows-[13rem] grid-cols-1 gap-3 md:auto-rows-[15rem] md:grid-cols-3">
                      {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-full rounded-[var(--r-2xl)]" />
                      ))}
                    </div>
                  ) : (
                    <LikesYouGrid
                      likes={likes.items}
                      myPrompts={card.profile?.prompts ?? []}
                      onAnswer={(like, accept) =>
                        swipe({
                          action: accept ? "LIKE" : "PASS",
                          candidate: like.candidate,
                          target: like.target,
                        })
                      }
                    />
                  )}
                </>
              )}

              {tab === "matches" && (
                <>
                  <header className="mb-6">
                    <h2 className="display text-[2rem] text-text">Matches</h2>
                    <p className="mt-2 max-w-xl text-[0.875rem] leading-relaxed text-muted">
                      A week each. Say something and the clock stops.
                    </p>
                  </header>

                  {matches.loading ? (
                    <div className="space-y-3">
                      {[0, 1].map((i) => (
                        <Skeleton key={i} className="h-36 rounded-[var(--r-xl)]" />
                      ))}
                    </div>
                  ) : (
                    <MatchesPanel
                      matches={matches.items}
                      onSayHi={async (match, text) => {
                        try {
                          await dating.sayHi(match.threadId, text);
                          toast("Sent. It's a conversation now.", "success");
                          void matches.reload();
                        } catch (err) {
                          toast(errorMessage(err, "that didn't send"), "error");
                        }
                      }}
                      onUnmatch={async (handle) => {
                        try {
                          await dating.unmatch(handle);
                          toast("Unmatched. They aren't notified.", "info");
                          void matches.reload();
                        } catch (err) {
                          toast(errorMessage(err, "could not unmatch"), "error");
                        }
                      }}
                    />
                  )}
                </>
              )}

              {tab === "you" && (
                <>
                  <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 className="display text-[2rem] text-text">Your card</h2>
                      <p className="mt-2 max-w-xl text-[0.875rem] leading-relaxed text-muted">
                        Three answers, six interests, one line. People like the sentences, not the
                        summary — so write sentences.
                      </p>
                    </div>
                    <Button variant="ghost" loading={busy} onClick={() => enable(false)}>
                      Take me out of the deck
                    </Button>
                  </header>

                  {card.loading ? (
                    <Skeleton className="h-96 rounded-[var(--r-xl)]" />
                  ) : !card.profile ? (
                    <Panel
                      title="Couldn't load your card"
                      body={errorMessage(card.error, "Your card is saved — we just couldn't fetch it right now.")}
                      action={
                        <Button variant="outline" onClick={() => void card.reload()}>
                          Try again
                        </Button>
                      }
                    />
                  ) : (
                    <DatingProfileEditor
                      user={me.user}
                      profile={card.profile}
                      onSave={async (profile) => {
                        try {
                          card.setProfile(await dating.saveProfile(profile));
                          toast("Your card is updated", "success");
                        } catch (err) {
                          toast(errorMessage(err, "could not save your card"), "error");
                        }
                      }}
                    />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </PageBody>

      <MatchModal
        match={matched}
        viewerAvatar={me.user.avatar}
        viewerName={me.user.displayName}
        onClose={() => setMatched(null)}
        onSend={async (text) => {
          if (!matched) return;
          const match = matched;
          setMatched(null);
          try {
            await dating.sayHi(match.threadId, text);
            toast("Sent. It's a conversation now.", "success");
            router.push(`/chats/${match.threadId}`);
          } catch (err) {
            toast(errorMessage(err, "that didn't send"), "error");
          }
        }}
      />
    </div>
  );
}
