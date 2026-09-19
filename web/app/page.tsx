import Link from "next/link";
import type { Metadata } from "next";
import { AppPreview } from "@/components/marketing/AppPreview";
import { ProfileCard } from "@/components/dating/ProfileCard";
import type { DatingCandidate } from "@/lib/types";
import { ButtonLink } from "@/components/ui/Button";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { NavbarMenu } from "@/components/fx/NavbarMenu";
import { ContainerScroll } from "@/components/fx/ContainerScroll";
import { LayoutGrid, type LayoutGridCard } from "@/components/fx/LayoutGrid";
import { Timeline, type TimelineEntry } from "@/components/fx/Timeline";
import { Atmosphere, DotBackdrop, GridBackdrop } from "@/components/fx/Backdrops";
import { NightSky } from "@/components/fx/NightSky";
import { GeminiBeams } from "@/components/fx/GeminiBeams";
import { CometCard, DirectionAwareHover, TiltCard, TiltLayer, WobbleCard } from "@/components/fx/Cards";
import { Glow } from "@/components/fx/Glow";
import { FlipWords, LayoutTextFlip, TextGenerate } from "@/components/fx/Text";
import {
  ArrowRightIcon,
  BookIcon,
  HeartIcon,
  MessageIcon,
  MoonIcon,
  ShieldIcon,
  TimerIcon,
  HomeIcon,
} from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "DronaSphere — your whole campus, in one place",
};

const NAV = [
  {
    label: "Love Finder",
    href: "#love",
    panel: (
      <div>
        <p className="mono-label">campus-only · opt-in · 18+</p>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
          Like the sentence someone wrote, not their face. Everyone in the deck is a verified student
          at your college, and your card is out of it until you say otherwise.
        </p>
      </div>
    ),
  },
  {
    label: "Surfaces",
    href: "#surfaces",
    panel: (
      <div className="grid grid-cols-2 gap-3">
        {[
          ["The Nest", "Threaded campus feed"],
          ["Chats & Signals", "DMs, Dens, club broadcasts"],
          ["Note Locker", "PYQs and notes by subject"],
          ["Owl Board", "The night, scored honestly"],
        ].map(([name, line]) => (
          <div key={name}>
            <p className="text-[0.8125rem] font-medium text-text">{name}</p>
            <p className="text-[0.75rem] text-muted">{line}</p>
          </div>
        ))}
      </div>
    ),
  },
  { label: "The night", href: "#night" },
  { label: "Safety", href: "#safety" },
];

const SURFACES = [
  {
    id: "nest",
    icon: HomeIcon,
    name: "The Nest",
    line: "Reddit's structure, your real name on it.",
    body: "Spaces for placements, hostel food, your semester, your club. Threaded discussion, campus-scoped by default, ranked by time-decayed votes. Sticker reactions sit next to the votes so a lurker can react without taking a position.",
    ramp: "linear-gradient(140deg, #4f1f4a 0%, #9a5c90 100%)",
    span: "md:col-span-2 md:row-span-2",
  },
  {
    id: "chats",
    icon: MessageIcon,
    name: "Chats, Dens & Signals",
    line: "One-to-one, group, and broadcast.",
    body: "DMs from people you don't follow land in a request inbox instead of your face. Dens cap at 256. Clubs get Signals — one-to-many, comments optional — so notices stop living in a WhatsApp group nobody can find.",
    ramp: "linear-gradient(140deg, #4f6f52 0%, #9bb79b 100%)",
  },
  {
    id: "notes",
    icon: BookIcon,
    name: "Note Locker",
    line: "The reason to open this on a dead Tuesday.",
    body: "PYQs, notes and lab files sorted by subject and semester, upvoted by people who actually sat the paper. Uploading earns Stardust. It is the least social thing here and quietly the most useful.",
    ramp: "linear-gradient(140deg, #9a6b18 0%, #e3c489 100%)",
  },
  {
    id: "owl",
    icon: MoonIcon,
    name: "Owl Board",
    line: "A leaderboard that tells you to sleep.",
    body: "Scored on what you do between 10pm and 3am — posting, replying, minutes in a Study Burrow — then hard-stopped at the curfew. Go offline for seven hours and the Cocoon Bonus pays more than the whole night would have.",
    ramp: "linear-gradient(140deg, #3b3660 0%, #6b6392 100%)",
    span: "md:col-span-2",
  },
];

const TIMELINE: TimelineEntry[] = [
  {
    label: "step 01",
    title: "Verify your college email",
    body: (
      <p className="text-[0.9375rem] leading-relaxed text-muted">
        A code, not a password. Non-campus domains can submit an ID card for manual review, and we
        answer within a day. One verified account per college email — the whole product depends on
        that being true, so it is enforced in the API rather than in the form.
      </p>
    ),
  },
  {
    label: "step 02",
    title: "Pick your identity",
    body: (
      <p className="text-[0.9375rem] leading-relaxed text-muted">
        A gradient and your initials, generated on the spot. No selfie, no profile-photo anxiety, no
        blank grey circle — and no reason to delay joining until you find a good picture.
      </p>
    ),
  },
  {
    label: "step 03",
    title: "Follow eight accounts",
    body: (
      <p className="text-[0.9375rem] leading-relaxed text-muted">
        Your batch, your branch, the clubs you care about. A feed with fewer sources than that looks
        empty on day one, and an empty first session is the one nobody comes back from.
      </p>
    ),
  },
  {
    label: "step 04",
    title: "Decide about Love Finder",
    body: (
      <p className="text-[0.9375rem] leading-relaxed text-muted">
        Off until you turn it on. In the deck you like a specific photo or a specific answer and can
        say why, which is a much better first message than &ldquo;hey&rdquo;. Turn it off and your card
        leaves the deck immediately — nothing is announced to anyone, either way.
      </p>
    ),
  },
];

const SAFETY: [string, string][] = [
  [
    "Chat is not end-to-end encrypted.",
    "Encrypted in transit and at rest; staff access is logged and restricted. We say it here rather than implying encryption we haven't built.",
  ],
  [
    "Under-18 accounts are gated at the account level.",
    "Love Finder and Crush Jar are locked, and non-mutual DMs are blocked by default — in the API, not just in the UI.",
  ],
  [
    "Crisis routing is infrastructure, not a nice-to-have.",
    "Posts and messages matching self-harm patterns surface Indian helplines (Tele-MANAS 14416, iCall) and route to a human reviewer. The post still publishes.",
  ],
  [
    "Report and block on every surface.",
    "24-hour moderation target. One verified account per college email, with device fingerprinting for ban evasion.",
  ],
];

// The landing page is public, so it cannot fetch a real card from the deck —
// and it should not: showing a stranger's actual profile to the open internet
// would be the opposite of what campus-only means. This is an illustration,
// written for the page, rendered through the real ProfileCard so what a
// visitor sees is the component they would actually get.
const FEATURED: DatingCandidate = {
  id: "sample",
  campusId: "sample",
  handle: "meher",
  displayName: "Meher",
  avatar: { hat: "flower", eyes: "wink", colour: "peach", accessory: "none" },
  branch: "ECE",
  year: 2,
  batch: "2024-28",
  role: "STUDENT",
  status: "ACTIVE",
  isPrivate: false,
  onboardingStep: "DONE",
  followerCount: 0,
  followingCount: 0,
  stardust: 0,
  owlRank: "NIGHT_OWL",
  owlRankLabel: "Night Owl",
  loveFinderEnabled: true,
  photoVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  viewerFollows: false,
  followsViewer: false,
  isBuddy: false,
  vibe: "sings in the stairwell, unbothered",
  interests: ["stairwell singing", "thrifting", "bad horror films"],
  prompts: [
    {
      question: "The way to win me over is",
      answer: "argue with me about a song for forty minutes and then send it to me anyway.",
    },
    {
      question: "A shower thought I recently had",
      answer: "the ECE building echoes like a concert hall and I will not be taking questions.",
    },
  ],
};

export default function LandingPage() {
  const surfaceCards: LayoutGridCard[] = SURFACES.map((surface) => ({
    id: surface.id,
    className: surface.span,
    thumbnail: (
      <div className="relative h-full w-full overflow-hidden" style={{ background: surface.ramp }}>
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, transparent 40%, rgba(22,21,15,0.5) 100%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-5">
          <span className="glass glass-pill flex size-9 items-center justify-center text-text">
            <surface.icon size={16} />
          </span>
          <div>
            <h3 className="display text-[1.75rem] text-white">{surface.name}</h3>
            <p className="mt-1 text-[0.8125rem] text-white/85">{surface.line}</p>
          </div>
        </div>
      </div>
    ),
    content: (
      <div className="glass glass-strong glass-panel p-5">
        <p className="text-[0.875rem] leading-relaxed text-muted">{surface.body}</p>
      </div>
    ),
  }));

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg text-text">
      <NavbarMenu
        items={NAV}
        brand={
          <Link href="/" aria-label="DronaSphere home">
            <Logo size={22} />
          </Link>
        }
        actions={
          <>
            <ButtonLink href="/login" variant="ghost" size="sm">
              Log in
            </ButtonLink>
            <ButtonLink href="/login" size="sm">
              Get started
            </ButtonLink>
          </>
        }
      />

      {/* --------------------------------------------------------- hero ---- */}
      <section className="grain relative overflow-hidden pt-36 pb-10 md:pt-44">
        <Atmosphere tone="brand" />
        <GridBackdrop size={56} />

        <div className="relative mx-auto max-w-6xl px-5">
          <div className="glass glass-pill inline-flex items-center gap-2 py-1 pr-3 pl-1 text-xs">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] text-muted">
              What&apos;s new
            </span>
            <span className="text-muted">Love Finder is open on campus</span>
          </div>

          <h1 className="display mt-7 max-w-4xl text-[clamp(2.75rem,7.5vw,5.25rem)]">
            Your whole campus,
            <br />
            in one place.
          </h1>

          <div className="mt-7 text-[clamp(1.125rem,2.4vw,1.5rem)] text-muted">
            <LayoutTextFlip
              text="Built for"
              words={["late nights", "your batch", "the group project", "meeting someone"]}
              wordClassName="text-accent"
            />
          </div>

          <TextGenerate
            className="mt-7 max-w-xl text-[0.9375rem] leading-relaxed text-muted"
            text="DronaSphere is a campus-verified social platform for one college at a time. A feed you post to as yourself, chats and club broadcasts, a night-owl leaderboard that knows when to tell you to sleep, a note locker that saves your semester, and a dating deck where everyone is who they say they are."
          />

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ButtonLink href="/login" size="lg" icon={<ArrowRightIcon size={16} />}>
              Create your account
            </ButtonLink>
            <ButtonLink href="#love" size="lg" variant="outline">
              See Love Finder
            </ButtonLink>
          </div>

          <p className="mono-label mt-6">
            verified students only · one account per college email · no ads
          </p>
        </div>
      </section>

      {/* ----------------------------------------- the product, tipped in -- */}
      <section className="relative h-[150vh]">
        <ContainerScroll
          title={
            <>
              <p className="mono-label">the whole thing, in one screen</p>
              <h2 className="display mt-3 text-[clamp(2.5rem,11vw,8.5rem)] leading-[0.88] tracking-[-0.04em]">
                DRONASPHERE
              </h2>
            </>
          }
        >
          <div className="surface-dark">
            <AppPreview />
          </div>
        </ContainerScroll>
      </section>

      {/* --------------------------------------------------- love finder -- */}
      <section id="love" className="relative overflow-hidden py-20 md:py-28" data-theme="dating">
        <Atmosphere tone="love" />
        <DotBackdrop size={24} />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-[1.05fr_25rem]">
          <div>
            <p className="mono-label">opt-in · campus-only · 18+</p>
            <h2 className="display mt-3 text-[clamp(2rem,5vw,3.5rem)]">
              Like the sentence,
              <br />
              not the face.
            </h2>

            <TextGenerate
              className="mt-6 max-w-xl text-[0.9375rem] leading-relaxed text-muted"
              text="Everyone in the deck is a verified student at your college, so the question stops being whether this person is real and starts being whether you'd get along. You like one specific photo or one specific answer, and you can say why — which is a much better opening than hey."
            />

            <ul className="mt-8 space-y-3">
              {[
                ["Nothing is blurred and nothing is sold.", "Who liked you is visible, free, in full, with whatever they wrote."],
                ["One Twinkle a day.", "Scarce on purpose. A signal only works when it costs something."],
                ["Matches wilt in a week.", "If neither of you speaks, it closes quietly and you both get the space back."],
                ["Off by default.", "Your card never enters the deck until you switch it on, and leaves the moment you switch it off."],
              ].map(([title, body]) => (
                <li key={title} className="glass glass-card relative p-4">
                  <Glow color="var(--rose-400)" />
                  <p className="relative text-[0.875rem] font-medium text-text">{title}</p>
                  <p className="relative mt-1 text-[0.8125rem] leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ul>

            <ButtonLink href="/login" size="lg" className="mt-8" icon={<HeartIcon size={16} />}>
              Get in the deck
            </ButtonLink>
          </div>

          {/* A real card from the real component — not a screenshot of one. */}
          <CometCard className="h-[34rem] rounded-[var(--r-2xl)]">
            <ProfileCard candidate={FEATURED} scrollable={false} />
          </CometCard>
        </div>
      </section>

      {/* ----------------------------------------------------- surfaces ---- */}
      <section id="surfaces" className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <div className="max-w-2xl">
          <p className="mono-label">four apps, one graph</p>
          <h2 className="display mt-3 text-[clamp(1.875rem,4.5vw,3rem)]">
            Campus life is currently split across four apps that don&apos;t know each other exists.
          </h2>
          <TextGenerate
            className="mt-5 text-[0.9375rem] leading-relaxed text-muted"
            text="WhatsApp has no discovery. Instagram is tuned for strangers, not your batch. Reddit doesn't know you sit in the same lab as the person you're replying to. Dating apps open the pool to the whole city and verify nobody. Follow someone once here and it powers all of it."
          />
          <p className="mono-label mt-6">tap a tile to open it</p>
        </div>

        <LayoutGrid cards={surfaceCards} className="mt-8" />
      </section>

      {/* -------------------------------------------------------- night ---- */}
      <section id="night" className="surface-dark relative isolate overflow-hidden bg-bg text-text">
        <NightSky className="-z-10" />
        <GeminiBeams>
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-2 md:py-28">
            <div>
              <p className="mono-label">10 pm → 3 am</p>
              <h2 className="display mt-3 text-[clamp(1.875rem,4.5vw,3rem)]">
                The app changes character after dark.
              </h2>
              <p className="mt-5 text-[0.9375rem] leading-relaxed text-muted">
                The Owl Board scores what you <em>do</em> in the night window — posting, replying,
                time in a Study Burrow — not how long you leave the app open. A script tapping the
                screen earns nothing.
              </p>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
                At 3 AM there is a hard curfew. Points stop, the board closes, and the app tells you
                to go to bed however long you stay up.
              </p>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-text">
                A leaderboard that rewarded you for sleeping less would be gameable in a week, and it
                would hurt people during exam season. So it doesn&apos;t.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: MoonIcon,
                  title: "Ranks that reset weekly",
                  body: "Sleepy Sparrow → Fledgling → Night Owl → Moon Moth → Comet. Season badges stay on your shelf forever.",
                },
                {
                  icon: TimerIcon,
                  title: "Study Burrows",
                  body: "Timed focus blocks with a break cycle. Completed minutes are credited server-side — the one way to score without posting.",
                },
                {
                  icon: ShieldIcon,
                  title: "Cocoon Bonus",
                  body: "Seven hours offline, claimed once a day. If nobody ever claims it, the curfew design has failed and we'd rather know.",
                },
              ].map((item) => (
                <TiltCard key={item.title} intensity={7}>
                  <article className="glass glass-card relative flex gap-4 p-5">
                    <Glow color="var(--plum-400)" />
                    <TiltLayer z={26} className="shrink-0">
                      <span className="glass glass-pill flex size-10 items-center justify-center text-accent-hi">
                        <item.icon size={17} />
                      </span>
                    </TiltLayer>
                    <TiltLayer z={16}>
                      <h3 className="text-[0.9375rem] font-medium">{item.title}</h3>
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{item.body}</p>
                    </TiltLayer>
                  </article>
                </TiltCard>
              ))}
            </div>
          </div>
        </GeminiBeams>
      </section>

      {/* ----------------------------------------------------- timeline ---- */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <Atmosphere tone="calm" className="opacity-60" />

        <div className="relative mx-auto max-w-5xl px-5">
          <p className="mono-label">day one</p>
          <h2 className="display mt-3 max-w-2xl text-[clamp(1.875rem,4.5vw,3rem)]">
            Four steps, and none of them ask you for a photo.
          </h2>

          <Timeline entries={TIMELINE} className="mt-6" />
        </div>
      </section>

      {/* ------------------------------------------------------- safety ---- */}
      <section id="safety" className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <div className="grid gap-10 md:grid-cols-[1fr_1.15fr]">
          <div>
            <p className="mono-label">trust & safety</p>
            <h2 className="display mt-3 text-[clamp(1.75rem,4vw,2.75rem)]">
              The boring copy stays boring.
            </h2>
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-muted">
              Everywhere else this product has some warmth to it. Consent, reporting, age gates and
              privacy are written plainly, because charm in those flows reads as manipulation and
              undermines the exact screens that have to be trusted.
            </p>
          </div>

          <ul className="space-y-2.5">
            {SAFETY.map(([title, body]) => (
              <li key={title}>
                {/* The overlay is a wash sweeping in from whichever edge the
                    pointer crossed — deliberately no text. It used to repeat
                    the body copy over the copy already sitting there, which
                    drew both at once through a near-transparent background.
                    Putting the text *only* in the overlay would fix that too,
                    but hover does not exist on a phone, and safety copy is the
                    last thing to hide behind an effect. So the words stay put
                    and the flourish stays decorative. */}
                <DirectionAwareHover
                  className="glass glass-card"
                  overlay={
                    <div
                      aria-hidden
                      className="h-full w-full bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]"
                    />
                  }
                >
                  <div className="relative z-10 p-4">
                    <p className="text-[0.875rem] font-medium">{title}</p>
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{body}</p>
                  </div>
                </DirectionAwareHover>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------------- start ---- */}
      <section id="start" className="relative overflow-hidden border-t border-border">
        <Atmosphere tone="brand" />
        <GridBackdrop size={56} />

        <div className="relative mx-auto max-w-4xl px-5 py-20 md:py-28">
          <WobbleCard containerClassName="rounded-[var(--r-2xl)]">
            <div className="glass glass-strong flex flex-col items-center gap-5 rounded-[var(--r-2xl)] p-10 text-center md:p-14">
              <span
                aria-hidden
                className="flex size-16 items-center justify-center rounded-[var(--r-lg)] text-white shadow-[var(--sh-card)]"
                style={{ background: "var(--grad-brand)" }}
              >
                <LogoMark size={34} />
              </span>

              <h2 className="display text-[clamp(1.875rem,4.5vw,3rem)]">
                Dronacharya first. Then NCR.
                <br />
                Then{" "}
                <FlipWords words={["anywhere", "your campus", "everywhere"]} className="text-accent" />.
              </h2>

              <p className="max-w-lg text-[0.9375rem] leading-relaxed text-muted">
                We don&apos;t open a second campus until the first one is genuinely alive. If that&apos;s
                your college, you&apos;re early.
              </p>

              <ButtonLink href="/login" size="lg" icon={<ArrowRightIcon size={16} />}>
                Create your account
              </ButtonLink>
            </div>
          </WobbleCard>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-10 text-xs text-faint">
        <Logo size={20} />
        <span>Built for Dronacharya College of Engineering.</span>
        <span className="ml-auto">Data export and deletion work from day one.</span>
      </footer>
    </div>
  );
}
