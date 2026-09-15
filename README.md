# 🦉 DronaSphere (Drona)

> **Campus-Verified Social Network & Student Ecosystem**  
> Bridging verified campus identity, topic spaces, late-night academic culture, peer-to-peer note sharing, and student well-being.

---

[![Go API](https://img.shields.io/badge/Go-1.24+-00ADD8?style=flat&logo=go)](https://go.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.3-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis)](https://redis.io/)
[![Prisma](https://img.shields.io/badge/Prisma-7.10-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Core Feature Ecosystem](#-core-feature-ecosystem)
  - [1. Campus Verification & Identity](#1-campus-verification--identity)
  - [2. The Nest: Spaces & Feed](#2-the-nest-spaces--feed)
  - [3. Owl Board & Cocoon Bonus](#3-owl-board--cocoon-bonus)
  - [4. Love Finder & Crush Jar](#4-love-finder--crush-jar)
  - [5. Realtime Chats, Dens & Signals](#5-realtime-chats-dens--signals)
  - [6. Note Locker & Study Burrows](#6-note-locker--study-burrows)
  - [7. Safety, Crisis Routing & Moderation](#7-safety-crisis-routing--moderation)
- [System Architecture](#-system-architecture)
- [Directory Structure](#-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Option A: Full Docker Stack (Fastest)](#option-a-full-docker-stack-fastest)
  - [Option B: Hybrid Local Development (Recommended)](#option-b-hybrid-local-development-recommended)
  - [Option C: Instant Frontend Preview (Zero-Docker Mock API)](#option-c-instant-frontend-preview-zero-docker-mock-api)
- [Environment Variables (.env)](#-environment-variables-env)
- [Self-Hosting on a Homelab](#-self-hosting-on-a-homelab)
- [Database Management & Prisma](#-database-management--prisma)
- [Testing & Code Quality](#-testing--code-quality)
- [License](#-license)

---

## 🌟 Overview

**DronaSphere** is a modern, high-performance, campus-verified social application designed specifically for university students. It combines verified institutional trust with an engaging, vibrant student experience that respects sleep health, prevents toxicity, and fosters real campus utility.

### Key Philosophy & Design Principles:
- **Verified Campus Trust**: Institutional email auto-verification (`@dronacharya.info`, `@gcet.ac.in`) guarantees that every user belongs to the campus community.
- **Anti-Empty-Feed Rule**: New users follow at least 8 campus accounts during onboarding to guarantee a lively, populated feed from day one.
- **Healthy Late-Night Engagement**: Late-night sessions accrue points between 22:00 and a hard 03:00 curfew. Above all, **recovery outscores damage**—students are rewarded with a **Cocoon Bonus** for getting 7+ continuous hours of rest.
- **Zero-Pressure Socializing**: Reactions (🍪 ✨ 😭 🔥 🫶) never affect post rankings, enabling safe interaction for lurkers without vanity metrics anxiety.
- **Crisis Routing by Default**: Instant crisis pattern detection provides direct student helpline interventions (Tele-MANAS, Vandrevala, KIRAN, AASRA) with zero cutesy tone.

---

## 🚀 Core Feature Ecosystem

### 1. Campus Verification & Identity
- **Institutional Email Domain Check**: Automated OTP-based verification against approved campus email domains (configurable via `CAMPUS_EMAIL_DOMAINS`).
- **18+ Age Gate**: Date of birth is stored confidentially strictly for legal age-gating and is never displayed on user profiles.
- **Modular Dronu Avatar Builder**: Customizable SVG owl avatar builder featuring unique hats (beanies, headphones, grad caps), expressions (sparkle, wink, sleepy), colors, and accessories. Real photos remain optional.
- **Follow-8 Gate**: Users must follow at least 8 campus profiles during onboarding to eliminate cold-start empty feeds.

### 2. The Nest: Spaces & Feed
- **Campus Spaces**: Dedicated topic-based channels (e.g. *General*, *Placements*, *Coding Club*, *Memes*, *Lost & Found*).
- **Post Types**: Rich text, image uploads, interactive polls with real-time percentage tallies, links, and academic questions ("Asks").
- **Time-Decay Hot Ranking**: Reddit/Hacker News style logarithmic score decay over time (`hotRank = order + (sign * seconds)/45000`).
- **Sticker Reactions**: Cookie 🍪, Sparkle ✨, Sob 😭, Fire 🔥, and Heart Hands 🫶 for stress-free lurker participation.

### 3. Owl Board & Cocoon Bonus
- **Late-Night Window (22:00 – 03:00)**: Active participation during the night window earns night points and progresses students across 5 tiered Owl Ranks (*Sleepy Sparrow*, *Fledgling*, *Night Owl*, *Moon Moth*, *Comet*).
- **Anti-Cheat Enforcement**: Passive presence earns zero points. A minimum of 3 distinct actions is required before points count, capped at 120 points/hour and limited to a single account per device fingerprint each night.
- **Hard 03:00 Curfew**: After 03:00 wall-clock time (`Asia/Kolkata`), point accumulation shuts off completely.
- **Cocoon Recovery Bonus**: 7+ hours of consecutive overnight inactivity earns the **Cocoon Bonus** (+250 Stardust and a recovery badge).

### 4. Love Finder & Crush Jar
- **Campus Unlock Threshold**: Love Finder stays locked across the entire college until the campus registers at least 400 verified users.
- **Opt-In & Photo Verified**: Dating is disabled by default and strictly opt-in, requiring 18+ age verification and a photo on file (`POST /v1/me/verify-photo`, submitted through the app's own media store).
- **Your Card**: A dating profile separate from your public one — one line, up to six interests, up to three Hinge-style prompt answers (`dating_profiles`). A card with nothing written on it never enters anyone's deck.
- **Like the Sentence, Not the Face**: A swipe records *what* was liked — the picture or one specific answer — plus an optional comment, so the other person receives "someone liked this sentence I wrote" rather than "someone liked you".
- **Likes You, Unblurred**: Everyone who liked you is visible in full, for free. Answering a like *is* swiping on them, so the list clears itself — there is no separate state to get out of sync.
- **Matching**: A mutual LIKE/TWINKLE opens a **Nest** thread (`ThreadType.NEST`) that behaves like any other chat. Swipes are permanent: one decision per pair, forever.
- **Twinkles**: One a day, counted server-side from the `swipes` table against the campus's own timezone — clearing local storage cannot buy a second one.
- **Match Wilting**: Matches with no messages exchanged wilt quietly after 7 days. Speaking stops the clock; a wilted match simply stops being returned.
- **Crush Jar**: Secret crush list—identities are revealed **only when the interest is 100% mutual**. No hints, teasers, or paywalls. *(Schema present; not yet wired.)*
- **Campus Astrology**: Fun, optional Astro Profile (Sun/Moon signs) strictly for entertainment; never used by matchmaking algorithms. *(Schema present; not yet wired.)*

> Every Love Finder route re-checks the full gate (18+, photo on file, campus
> size, opted in) in `service.DatingService` — reaching the endpoint is not the
> same as reaching the deck.

### 5. Realtime Chats, Dens & Signals
- **1:1 Direct Messages**: Mutual follows can message directly. Messages from non-mutual users land in a dedicated **Request Inbox**.
- **Dens**: Campus group chats capped at 256 members with custom invite links and admin controls.
- **Signals**: Announcement broadcast channels with optional subscriber comments.
- **Realtime WebSocket Gateway**: Ephemeral presence, typing indicators, read receipts, and live message fanout via Redis pub/sub.
- **90-Day Media Retention**: Chat media expires from hot storage after 90 days to maintain lean data footprints.

### 6. Note Locker & Study Burrows
- **Note Locker**: Student-driven academic repository categorized by Subject, Semester, and Branch for lecture notes, Previous Year Questions (PYQs), and lab manuals. Upvoting and download tracking reward contributors with Stardust.
- **Study Burrows**: Virtual Pomodoro study rooms with synchronized focus/break timers (e.g. 25m focus / 5m break) to study alongside campus peers.

### 7. Safety, Crisis Routing & Moderation
- **Crisis Helpline Interventions**: Plain-copy, high-priority support cards surfaced automatically if distress signals are detected, routing students to Indian helplines:
  - **Tele-MANAS**: `14416` / `1800 891 4416`
  - **KIRAN**: `1800-599-0019`
  - **Vandrevala Foundation**: `+91 9999 666 555`
  - **AASRA**: `+91 98204 66726`
- **Anonymous Whispers**: Ephemeral campus confessions moderated by automated keyword filtering and human staff review before publishing.
- **Granular Moderation**: Moderator dashboard for review and resolution of reported posts, comments, messages, and whispers.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 16 Web Client                    │
│      (App Router, React 19, Tailwind CSS v4, Framer Motion) │
└──────────────┬───────────────────────────────▲──────────────┘
               │ HTTP REST                     │ WebSocket (SSE)
               ▼                               │
┌──────────────────────────────────────────────┴──────────────┐
│                        Go REST API                          │
│     (Chi Router, Token Issuer, Middleware, Safety Engine)   │
└──────────────┬───────────────────────────────▲──────────────┘
               │                               │
       pgx/v5  │ Queries               Pub/Sub │ Redis Client
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│       PostgreSQL 17         │ │           Redis 7           │
│   Prisma 7 Client & Schema  │ │  Sorted Sets, Presence,     │
│   Keyset-Paginated Data     │ │  Rate Limits & WS Fanout    │
└─────────────────────────────┘ └─────────────────────────────┘
```

- **Frontend**: Next.js 16 (Turbopack), React 19, Tailwind CSS v4, Framer Motion, GSAP, Radix UI primitives, Lucide Icons.
- **Backend**: Go 1.24+, Chi v5 router, `pgx/v5` PostgreSQL connection pooling, `log/slog` structured logging, gorilla/websocket.
- **Data Layer**: PostgreSQL 17 managed via Prisma 7 (providing schema definitions, migrations, and seed data) and queried efficiently in Go via hand-written SQL with keyset pagination.
- **Cache & Message Broker**: Redis 7 for presence tracking, rate limiting, live Owl Board leaderboards, and cross-node WebSocket event fanout.
- **Mock Service**: Zero-dependency Node.js HTTP mock API (`tools/mock-api/server.mjs`) enabling rapid UI iteration without database containers.

---

## 📁 Directory Structure

```text
drona/
├── api/                           # Go REST & WebSocket Backend
│   ├── cmd/api/                   # Application entry point (main.go)
│   ├── internal/
│   │   ├── api/                   # HTTP routing & controller handlers
│   │   ├── auth/                  # JWT tokens, authentication & middleware
│   │   ├── cache/                 # Redis client integration
│   │   ├── config/                # Environment configuration loader
│   │   ├── domain/                # Shared domain models & validation
│   │   ├── httpx/                 # HTTP utilities, rate limiters, responses
│   │   ├── logx/                  # Structured slog logger setup
│   │   ├── mailer/                # OTP mailer (dev log & SMTP)
│   │   ├── owl/                   # Owl Board window & anti-cheat engine
│   │   ├── realtime/              # WebSocket gateway & event hub
│   │   ├── safety/                # Crisis detection & helpline card
│   │   ├── service/               # Core business services
│   │   └── store/                 # PostgreSQL pgx persistence layer
│   ├── Dockerfile                 # Multi-stage production Go container
│   ├── go.mod                     # Go dependencies
│   └── go.sum
│
├── web/                           # Next.js 16 Frontend
│   ├── app/                       # Next.js App Router
│   │   ├── (app)/                 # Authenticated application shell routes
│   │   │   ├── feed/              # Campus feed & trending rail
│   │   │   ├── spaces/            # Community spaces ([slug])
│   │   │   ├── chats/             # DMs, Dens, Signals & Requests
│   │   │   ├── dating/            # Love Finder, Swipe Deck & Matches
│   │   │   ├── owl-board/         # Night leaderboard & Cocoon bonus
│   │   │   ├── notes/             # Academic Note Locker
│   │   │   ├── burrows/           # Study Burrows focus rooms
│   │   │   └── profile/           # Student profiles ([handle])
│   │   ├── login/                 # OTP authentication page
│   │   ├── onboarding/            # Profile setup, avatar builder & follow-8
│   │   └── page.tsx               # Landing page & feature showcase
│   ├── components/
│   │   ├── app-shell/             # Navigation, TopBar, Sidebar, CommandPalette
│   │   ├── auth/                  # Auth layouts & OTP inputs
│   │   ├── chat/                  # Real-time chat & thread UI
│   │   ├── dating/                # Swipe deck, match modals & cards
│   │   ├── feed/                  # Post cards, composer, polls, comments
│   │   ├── fx/                    # Modern dynamic visual effects & shaders
│   │   ├── owl/                   # Night window charts & trackers
│   │   ├── profile/               # Interactive Dronu Avatar builder
│   │   └── ui/                    # Reusable design system primitives
│   ├── lib/                       # API client, WebSocket, contexts & hooks
│   ├── package.json
│   └── tsconfig.json
│
├── prisma/                        # Database Schema & Migrations
│   ├── schema.prisma              # Single source of truth for schema & enums
│   ├── migrations/                # Version-controlled SQL migrations
│   └── seed.ts                    # Idempotent campus seed dataset
│
├── tools/
│   └── mock-api/
│       └── server.mjs             # Dependency-free Node.js mock backend
│
├── docker/                        # Container build files
├── docker-compose.yml             # Local multi-container orchestration
├── package.json                   # Root workspace scripts (npm)
└── .env.example                   # Environment configuration template
```

---

## ⚡ Getting Started

### Prerequisites
- **Node.js**: `v22+`
- **Go**: `v1.24+` (for running the Go API locally)
- **Docker & Docker Compose**: (for PostgreSQL & Redis)

---

### Option A: Full Docker Stack (Fastest)

Run the entire application (Postgres, Redis, Migrations, Seed, Go API, and Next.js Web) with a single command:

```bash
# 1. Clone repository
git clone https://github.com/6Boys/drona.git
cd drona

# 2. Copy environment template
cp .env.example .env

# 3. Spin up full stack
docker compose --profile full up --build
```

- Web Application: **`http://localhost:3000`**
- Go API: **`http://localhost:8080`**
- PostgreSQL: **`localhost:5432`**
- Redis: **`localhost:6379`**

---

### Option B: Hybrid Local Development (Recommended)

Run Postgres and Redis in Docker, but run the Go API and Next.js locally with hot reload:

```bash
# 1. Clone and install root dependencies
git clone https://github.com/6Boys/drona.git
cd drona
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start PostgreSQL and Redis
npm run infra:up

# 4. Apply database migrations and seed sample campus data
npm run db:deploy
npm run db:seed

# 5. Terminal 1: Start Go Backend
npm run dev:api

# 6. Terminal 2: Start Next.js Frontend
npm run dev:web
```

> **Tip (OTP in Dev)**: When logging in during development (`MAILER=log`), the 6-digit OTP is output directly to the Go API console logs.

---

### Option C: Instant Frontend Preview (Zero-Docker Mock API)

If you just want to develop or preview the Next.js frontend without Docker, Postgres, or Go installed:

```bash
# 1. Install dependencies
npm install

# 2. Terminal 1: Start standalone mock API (listens on :8080)
npm run mock:api

# 3. Terminal 2: Start Next.js frontend (listens on :3000)
npm run dev:web
```

- Sign in with any seeded campus email (e.g. `aniket@dronacharya.info`, `meher@dronacharya.info`) or enter a new email to test the onboarding walkthrough.
- **Any 6-digit OTP code** is accepted by the mock server!

---

## 🔧 Environment Variables (.env)

Key variables from `.env.example`:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection string |
| `API_PORT` | `8080` | Port for the Go backend |
| `WEB_PORT` | `3000` | Port for the Next.js web application |
| `JWT_SECRET` | *(random 48-byte secret)* | HMAC key for signing JWT tokens |
| `JWT_ACCESS_TTL` | `15m` | Access token lifespan |
| `JWT_REFRESH_TTL`| `720h` (30 days) | Refresh token lifespan |
| `CAMPUS_EMAIL_DOMAINS` | `dronacharya.info,gcet.ac.in` | Allowed institutional email domains |
| `MAILER` | `log` | `log` (print OTP to terminal) or `smtp` |
| `ONBOARDING_MIN_FOLLOWS` | `8` | Minimum follows before accessing the feed |
| `NIGHT_WINDOW_START` | `22:00` | Start of the Owl Board night window |
| `NIGHT_CURFEW` | `03:00` | Curfew when night point accrual stops |
| `NIGHT_TIMEZONE` | `Asia/Kolkata` | Timezone for the late-night window |
| `DATING_UNLOCK_MIN_USERS`| `400` | Verified campus users needed to unlock Love Finder |
| `MATCH_WILT_DAYS` | `7` | Days of inactivity before a match wilts |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Origins the API accepts browser calls from (CORS **and** the WebSocket origin check) |
| `MEDIA_DIR` | `./data/media` (Docker: `/data/media`) | Where uploaded pictures are written |
| `MEDIA_PUBLIC_BASE_URL` | *(empty)* | Only set if pictures must resolve somewhere other than the API's own origin |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | **Build-time.** Where the browser reaches the API |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8080/v1/ws` | **Build-time.** Where the browser opens the live socket |

---

## 🏡 Self-Hosting on a Homelab

This stack is designed to run on one modest box — the database, uploaded
pictures and all. Nothing is stored with a third party.

### What holds your data

| What | Where it lives | Back this up |
|---|---|---|
| Everything relational (accounts, posts, chats, matches) | Postgres → `dronasphere_pgdata` volume | **Yes** |
| Uploaded pictures | Disk → `dronasphere_media` volume | **Yes** — Postgres cannot regenerate these |
| Owl Board live counters, rate limits, socket fanout | Redis → `dronasphere_redisdata` volume | Optional — rebuilt from Postgres snapshots |

```bash
# Back up both halves of "the data"
docker run --rm -v dronasphere_pgdata:/src -v "$PWD":/out alpine \
  tar czf /out/pgdata-$(date +%F).tgz -C /src .
docker run --rm -v dronasphere_media:/src -v "$PWD":/out alpine \
  tar czf /out/media-$(date +%F).tgz -C /src .
```

### Pictures: 5 MB, images and GIFs, no video

Uploads go to the API's own disk-backed store (`api/internal/media`), served
back from `GET /media/<name>` with immutable caching.

- **5 MB ceiling** per file.
- **JPEG, PNG, WEBP and GIF only** — animated GIFs included. Every video
  format is refused no matter how small it is.
- The type is decided by **sniffing the actual bytes**, so renaming an `.mp4`
  to `.png` does not get it past the gate.
- Uploads require a signed-in account, and sit under the API's strictest rate
  limit — disk is finite on a small box.

These are constants in `api/internal/media`, deliberately **not** environment
variables: a storage budget that a typo in a `.env` could quietly multiply is
not a budget. To change them, edit that file and rebuild.

Next.js image optimisation is off (`next.config.ts`) — re-encoding every
upload on demand is real CPU on a small machine, for no gain over bytes that
are already capped and already cached.

### Pointing it at your box

The two `NEXT_PUBLIC_*` values are **compiled into the browser bundle**, so
they must be addresses a phone on your network can reach — not a Docker
service name. And `ALLOWED_ORIGINS` must list the web app's origin, or every
API call fails CORS with a blank-looking app and no obvious cause.

```bash
# .env — LAN example, homelab at 192.168.1.50
NEXT_PUBLIC_API_BASE_URL=http://192.168.1.50:8080
NEXT_PUBLIC_WS_URL=ws://192.168.1.50:8080/v1/ws
ALLOWED_ORIGINS=http://192.168.1.50:3000

# …or behind a reverse proxy with TLS
NEXT_PUBLIC_API_BASE_URL=https://api.drona.example.com
NEXT_PUBLIC_WS_URL=wss://api.drona.example.com/v1/ws
ALLOWED_ORIGINS=https://drona.example.com
```

```bash
docker compose --profile full up --build -d   # first run: builds and migrates
docker compose --profile migrate up           # after a schema change
docker compose build web && docker compose up -d web   # after changing a NEXT_PUBLIC_* value
```

> A changed `NEXT_PUBLIC_*` needs a **rebuild**, not a restart. That is how
> Next.js inlines public env vars; a restart alone silently keeps the old URL.

### Before you open it up

- `JWT_SECRET` — generate a real one (`openssl rand -base64 48`). The API
  refuses to boot in production with the placeholder.
- `MAILER=log` prints OTP codes to the container log instead of emailing
  them. Fine while testing on your own; set up SMTP before anyone else signs in.
- `DATING_UNLOCK_MIN_USERS` defaults to `400`. On a fresh instance Love Finder
  will correctly report itself locked until that many verified accounts exist —
  lower it if your campus is smaller, or it will look broken rather than gated.
- Love Finder also requires an 18+ date of birth and a photo on file per
  account. The photo step is self-attested, not moderated — see
  `UserService.VerifyPhoto`.
- Someone only enters the deck once they have written at least one prompt
  answer on their card, so a new instance's deck stays empty until people fill
  theirs in. That is deliberate, not a bug: a deck of blank gradients is worse
  than an empty one.

### Keeping it light

Postgres, Redis and both apps are Alpine-based and idle in well under 1 GB
combined. If the box is shared, cap them:

```yaml
# docker-compose.override.yml
services:
  postgres: { mem_limit: 512m }
  redis:    { mem_limit: 128m }
  api:      { mem_limit: 256m }
  web:      { mem_limit: 384m }
```

Redis is optional — the API logs a warning and degrades to in-process rate
limiting and fanout if it is unreachable. On a single-instance homelab that
costs you very little.

---

## 🗄️ Database Management & Prisma

Prisma manages schema definitions, migrations, and database seeding:

```bash
# Run migrations on local database
npm run db:migrate

# Apply migrations without prompt (CI / staging)
npm run db:deploy

# Seed sample campus data (idempotent)
npm run db:seed

# Reset and re-seed the database
npm run db:reset

# Open Prisma Studio visual inspector
npm run db:studio

# Validate Prisma schema
npm run db:validate
```

---

## 🧪 Testing & Code Quality

```bash
# Run all Go API unit tests
npm run test:api

# Run Go test coverage report
npm run test:api:cover

# Run frontend TypeScript typecheck
npm --workspace web run typecheck

# Build Go API binary
npm run build:api

# Build Next.js production bundle
npm run build:web
```

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

<div align="center">
  <sub>Built with 🦉 for campus communities by the DronaSphere Team.</sub>
</div>
