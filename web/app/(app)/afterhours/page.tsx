"use client";

import { useEffect, useMemo, useState } from "react";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { AnonComposer } from "@/components/afterhours/AnonComposer";
import { AnonPostCard } from "@/components/afterhours/AnonPostCard";
import { AfterHoursIntro } from "@/components/afterhours/AfterHoursIntro";
import { AmbiancePicker } from "@/components/afterhours/AmbiancePicker";
import { AfterHoursBackdrop, Flame } from "@/components/afterhours/Atmosphere";
import { MoodFilterChips } from "@/components/afterhours/MoodChips";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAfterHoursFeed, type AfterHoursSort, type MoodFilter } from "@/lib/afterhours-store";
import { MOODS, useAfterHoursAmbiance } from "@/lib/afterhours-theme";
import { clockTime } from "@/lib/format";
import type { AnonPost } from "@/lib/types";

/* -----------------------------------------------------------------------------
   The one campus surface with no name attached to it — and the one page that
   changes the room when you walk in (lib/afterhours-theme.ts). Everything
   here rides on a mask instead of a name, and every post burns out after 24
   hours, shown right on the post as a fuse rather than left to wonder about.
   -------------------------------------------------------------------------- */

type Headline = [string, string, string];
const FIRST_HEADLINE: Headline = ["Say the thing you'd ", "never", " say out loud."];
const HEADLINES: Headline[] = [
  FIRST_HEADLINE,
  ["Everyone here has a ", "secret", ". What's yours?"],
  ["It's late. Tell us ", "something", "."],
  ["No names. No faces. Just the ", "truth", "."],
];

// Engagement a post needs before it's worth a spotlight — below this the
// "top" post of a quiet night would just be whichever one got two upvotes.
const SPOTLIGHT_MIN = 20;
const heat = (p: AnonPost) => p.score + Object.values(p.reactions).reduce((a, b) => a + b, 0);

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return clockTime(now.toISOString());
}

export default function AfterHoursPage() {
  const { ambiance, setAmbiance } = useAfterHoursAmbiance();
  const [sort, setSort] = useState<AfterHoursSort>("hot");
  const [mood, setMood] = useState<MoodFilter>("all");
  const feed = useAfterHoursFeed(sort, mood);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [headline] = useState<Headline>(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)] ?? FIRST_HEADLINE);
  const clock = useClock();

  const spotlight = useMemo(() => {
    if (sort !== "hot" || mood !== "all" || feed.items.length < 3) return null;
    const top = feed.items.reduce((best, p) => (heat(p) > heat(best) ? p : best));
    return heat(top) >= SPOTLIGHT_MIN ? top : null;
  }, [feed.items, sort, mood]);

  const rest = spotlight ? feed.items.filter((p) => p.id !== spotlight.id) : feed.items;

  const update = (next: AnonPost) => feed.setItems((prev) => prev.map((p) => (p.id === next.id ? next : p)));

  return (
    <>
      <AfterHoursBackdrop />
      <AfterHoursIntro />

      <TopBar
        title="AfterHours"
        subtitle="Anonymous · campus-only · burns out in 24h"
        actions={
          <>
            {feed.newCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  feed.showPending();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="shrink-0 cursor-pointer rounded-full bg-accent px-3 py-1.5 text-[0.75rem] font-medium whitespace-nowrap text-on-accent shadow-[0_0_20px_-4px_var(--accent)]"
              >
                {feed.newCount === 1 ? "1 new" : `${feed.newCount} new`}
              </button>
            )}
            <AmbiancePicker value={ambiance} onChange={setAmbiance} />
          </>
        }
        tabs={
          <>
            <Segmented<AfterHoursSort>
              size="sm"
              // Its columns are minmax(0, 1fr): next to a long chip row it
              // would otherwise be squeezed down to nothing.
              className="shrink-0"
              value={sort}
              onChange={setSort}
              options={[
                { value: "hot", label: "Hot" },
                { value: "new", label: "New" },
              ]}
            />
            <span aria-hidden className="h-5 w-px shrink-0 bg-border-strong" />
            <MoodFilterChips value={mood} onChange={setMood} />
          </>
        }
      />

      <PageBody width="sm">
        <section className="rise mb-6 pt-1 text-center sm:pt-3">
          <p className="mono-label flex items-center justify-center gap-2">
            <Flame size={11} />
            <span className="tabnum">{clock}</span>
            <span aria-hidden>·</span>
            <span>
              <span className="tabnum text-text">{feed.liveCount}</span> burning tonight
            </span>
          </p>
          <p className="display mt-3 text-[2.35rem] leading-[1.05] text-text italic sm:text-[3.1rem]">
            {headline[0]}
            <span className="grad-text" style={{ ["--ramp" as string]: "linear-gradient(95deg, var(--ah-glow-a), var(--ah-glow-b))" }}>
              {headline[1]}
            </span>
            {headline[2]}
          </p>
          <p className="mx-auto mt-3 max-w-sm text-[0.875rem] text-muted">
            No names, just masks. Nothing on a post points back to who wrote it.
          </p>
        </section>

        <AnonComposer
          onPosted={(post) => {
            // A post in a mood the list isn't showing would just vanish —
            // switch to its mood so the person sees what they released.
            if (mood !== "all" && mood !== post.mood) setMood("all");
            feed.prepend(post);
            setFreshId(post.id);
          }}
        />

        <div className="mt-6 space-y-4">
          {feed.loading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-[var(--r-xl)]" />)
          ) : feed.error ? (
            <div className="ah-card flex flex-col items-center gap-3 px-6 py-10 text-center">
              <p className="text-sm text-muted">Couldn&apos;t reach AfterHours just now.</p>
              <Button size="sm" variant="outline" onClick={() => void feed.reload()}>
                Try again
              </Button>
            </div>
          ) : feed.items.length === 0 ? (
            <div className="ah-card flex flex-col items-center px-6 py-12 text-center" data-mood={mood === "all" ? undefined : mood}>
              <Flame size={26} />
              <p className="display mt-4 text-[1.6rem] text-text italic">
                {mood === "all" ? "Nothing burning right now." : `Nothing in ${MOODS[mood].label} tonight.`}
              </p>
              <p className="mt-2 max-w-xs text-[0.875rem] text-muted">
                Every post here lasts a day, then it&apos;s gone. Light the first one.
              </p>
            </div>
          ) : (
            <>
              {spotlight && (
                <AnonPostCard
                  key={spotlight.id}
                  post={spotlight}
                  featured
                  onChange={update}
                  onRemoved={() => feed.remove(spotlight.id)}
                />
              )}
              {rest.map((post, i) => (
                <div key={post.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                  <AnonPostCard post={post} fresh={post.id === freshId} onChange={update} onRemoved={() => feed.remove(post.id)} />
                </div>
              ))}
              <p className="py-6 text-center font-mono text-[0.6875rem] tracking-[0.12em] text-faint uppercase">
                that&apos;s everything still burning
              </p>
            </>
          )}
        </div>
      </PageBody>
    </>
  );
}
