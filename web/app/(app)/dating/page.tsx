"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { MatchModal } from "@/components/dating/MatchModal";
import { SwipeDeck, type SwipeDecision } from "@/components/dating/SwipeDeck";
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
import { HeartIcon, LockIcon, SparkleIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  dating,
  deckFor,
  liveMatches,
  pendingLikes,
  twinklesLeft as twinklesLeftFor,
  useDating,
} from "@/lib/dating-store";
import type { DatingCandidate, MeResponse } from "@/lib/types";

type Tab = "deck" | "likes" | "matches" | "you";

/* -----------------------------------------------------------------------------
   Love Finder.

   Four surfaces behind one header: the deck, the likes you've received, the
   matches that came out of them, and your own card. They share one store, so
   the counts in the tab strip are always the counts on the screens.
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

export default function DatingPage() {
  const router = useRouter();
  const { me, apply } = useAuth();
  const toast = useToast();
  const state = useDating();

  const [tab, setTab] = useState<Tab>("deck");
  const [busy, setBusy] = useState(false);
  const [matched, setMatched] = useState<DatingCandidate | null>(null);

  const twinkles = twinklesLeftFor(state);
  const likes = useMemo(() => pendingLikes(state), [state]);
  const matches = useMemo(() => liveMatches(state), [state]);
  const deck = useMemo(() => deckFor(state, me?.user.handle), [state, me?.user.handle]);

  if (!me) return null;

  const enable = async (enabled: boolean) => {
    setBusy(true);
    try {
      apply(await api.post<MeResponse>("/v1/me/love-finder", { enabled }));
      toast(enabled ? "You're in the deck" : "Your card is out of the deck", "success");
    } catch (err) {
      toast(errorMessage(err, "could not change that"), "error");
    } finally {
      setBusy(false);
    }
  };

  const decide = ({ action, candidate, target, note, twinkle }: SwipeDecision) => {
    if (action === "PASS") {
      dating.pass(candidate.handle);
      return;
    }

    const match = dating.like(candidate, target, note, twinkle || action === "TWINKLE");

    if (twinkle || action === "TWINKLE") {
      toast(`Twinkle sent to ${candidate.displayName}`, "success");
    } else if (note) {
      toast(`Comment sent to ${candidate.displayName}`, "success");
    }

    if (match) setMatched(candidate);
  };

  const gated = !me.loveFinderAvailable;
  const off = !me.user.loveFinderEnabled;

  return (
    <div data-theme="dating">
      <TopBar
        title="Love Finder"
        subtitle="Campus-only, opt-in, 18+. Matches wilt quietly if nobody says anything."
        actions={
          me.user.loveFinderEnabled ? (
            <Badge tone="rose" mono>
              in the deck
            </Badge>
          ) : null
        }
        tabs={
          !gated && !off ? (
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: "deck", label: "Discover", count: deck.length },
                { value: "likes", label: "Likes you", count: likes.length },
                { value: "matches", label: "Matches", count: matches.length },
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

                  <SwipeDeck
                    candidates={deck}
                    twinklesLeft={twinkles}
                    onDecide={decide}
                    onTwinkleBlocked={() =>
                      toast("No Twinkles left today. One a day, on purpose.", "info")
                    }
                    emptyState={
                      <Panel
                        title="That's everyone for today"
                        body="The deck refills as more people opt in. Nothing you did is lost — the ones you liked stay liked, and anyone you passed on can be dealt back in."
                        action={
                          <Button variant="outline" onClick={() => dating.resetDeck()}>
                            Deal the passes back in
                          </Button>
                        }
                      />
                    }
                  />

                  <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-faint">
                    <SparkleIcon size={12} className="text-gold" />
                    {twinkles} {twinkles === 1 ? "Twinkle" : "Twinkles"} left today
                  </p>
                </>
              )}

              {tab === "likes" && (
                <>
                  <header className="mb-6">
                    <h2 className="display text-[2rem] text-text">
                      {likes.length ? `${likes.length} people liked you` : "Likes you"}
                    </h2>
                    <p className="mt-2 max-w-xl text-[0.875rem] leading-relaxed text-muted">
                      Everything visible, nothing blurred, nothing behind a paywall. Open one to read
                      what they said and answer it.
                    </p>
                  </header>

                  <LikesYouGrid
                    likes={likes}
                    myPrompts={state.profile.prompts}
                    onAnswer={(like, accept) => {
                      const match = dating.answerLike(like, accept);
                      if (match) setMatched(like.candidate);
                      else toast(`${like.candidate.displayName} won't be told.`, "info");
                      return match;
                    }}
                  />
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

                  <MatchesPanel
                    matches={matches}
                    onSayHi={(handle, text) => {
                      dating.sayHi(handle, text);
                      toast("Sent. It's a conversation now.", "success");
                    }}
                    onUnmatch={(handle) => {
                      dating.unmatch(handle);
                      toast("Unmatched. They aren't notified.", "info");
                    }}
                  />
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

                  <DatingProfileEditor
                    user={me.user}
                    profile={state.profile}
                    onSave={(profile) => {
                      dating.saveProfile(profile);
                      toast("Your card is updated", "success");
                    }}
                  />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </PageBody>

      <MatchModal
        candidate={matched}
        viewerAvatar={me.user.avatar}
        viewerName={me.user.displayName}
        onClose={() => setMatched(null)}
        onSend={(text) => {
          if (matched) dating.sayHi(matched.handle, text);
          setMatched(null);
          toast("Sent. It's a conversation now.", "success");
          router.push("/chats");
        }}
      />
    </div>
  );
}
