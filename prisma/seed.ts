/**
 * DronaSphere seed.
 *
 * PRD 14 (risks): "An empty feed kills campus apps in week one." So the seed
 * builds a small but *alive* campus — spaces with real posts, a pre-loaded Note
 * Locker, a running Owl Board week — and it is idempotent, so you can re-run it
 * as often as you like.
 *
 *   npm run db:seed
 *
 * Every demo account signs in with the OTP flow like a real user: request a
 * code for the email, then read it out of the API logs (MAILER=log).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env first");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Keep ids fixed so tests and manual pokes can rely on them.
const CAMPUS_ID = "11111111-1111-4111-8111-111111111111";
const uid = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
const sid = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`;
const pid = (n: number) => `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`;
const tid = (n: number) => `55555555-5555-4555-8555-${String(n).padStart(12, "0")}`;

const EMAIL_DOMAIN = (process.env.CAMPUS_EMAIL_DOMAINS ?? "dronacharya.info").split(",")[0].trim();

/** Same formula as api/internal/service/feed.go — keep the two in step. */
const EPOCH = Date.UTC(2026, 0, 1) / 1000;
function hotRank(score: number, createdAt: Date): number {
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const seconds = createdAt.getTime() / 1000 - EPOCH;
  return Number((order + (sign * seconds) / 45000).toFixed(7));
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

/** ISO year-week, matches owl.WeekKey() in Go. */
function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// -------------------------------------------------------------------- data ---

const DEMO_USERS = [
  { n: 1,  handle: "dronu",      name: "Dronu",            branch: "CSE", year: 2, batch: "2024-28", rank: "COMET",          role: "CAMPUS_ADMIN", bio: "your resident owl. i live here 🦉" },
  { n: 2,  handle: "aniket",     name: "Aniket Rathour",   branch: "CSE", year: 3, batch: "2023-27", rank: "MOON_MOTH",      role: "SUPERADMIN",   bio: "building this thing. say hi." },
  { n: 3,  handle: "meher",      name: "Meher Kaur",       branch: "ECE", year: 2, batch: "2024-28", rank: "NIGHT_OWL",      role: "STUDENT",      bio: "ece // sings in the stairwell" },
  { n: 4,  handle: "rishab",     name: "Rishab Jain",      branch: "CSE", year: 4, batch: "2022-26", rank: "MOON_MOTH",      role: "SPACE_MOD",    bio: "placements gyaan, ask me anything" },
  { n: 5,  handle: "tanya",      name: "Tanya Bose",       branch: "IT",  year: 2, batch: "2024-28", rank: "FLEDGLING",      role: "STUDENT",      bio: "sem 3 survivor 🫠" },
  { n: 6,  handle: "kabir",      name: "Kabir Sethi",      branch: "ME",  year: 3, batch: "2023-27", rank: "NIGHT_OWL",      role: "STUDENT",      bio: "workshop till 2am" },
  { n: 7,  handle: "ira",        name: "Ira Menon",        branch: "CSE", year: 3, batch: "2023-27", rank: "SLEEPY_SPARROW", role: "STUDENT",      bio: "8 hours of sleep gang. cocoon bonus enjoyer" },
  { n: 8,  handle: "devansh",    name: "Devansh Rao",      branch: "ECE", year: 4, batch: "2022-26", rank: "NIGHT_OWL",      role: "STUDENT",      bio: "robotics club" },
  { n: 9,  handle: "zoya",       name: "Zoya Ahmed",       branch: "CSE", year: 2, batch: "2024-28", rank: "FLEDGLING",      role: "STUDENT",      bio: "notes hoarder, will share" },
  { n: 10, handle: "arnav",      name: "Arnav Gupta",      branch: "IT",  year: 3, batch: "2023-27", rank: "SLEEPY_SPARROW", role: "STUDENT",      bio: "lurker. do not perceive me" },
  { n: 11, handle: "codingclub", name: "Coding Club DCE",  branch: "CSE", year: 3, batch: "2023-27", rank: "NIGHT_OWL",      role: "SPACE_MOD",    bio: "official coding club 💻 weekly contests" },
  { n: 12, handle: "lostfound",  name: "Lost & Found DCE", branch: "CSE", year: 2, batch: "2024-28", rank: "SLEEPY_SPARROW", role: "SPACE_MOD",    bio: "lost your id card again? post here." },
  // 13–30: no posts or threads reference these — they exist to make the
  // campus (and Love Finder's deck, see DATING_PROFILES below) look like more
  // than twelve people. All real students; none of the club/bot accounts
  // above ever gets a dating card, on purpose.
  { n: 13, handle: "karan",      name: "Karan Mehta",      branch: "CSE", year: 2, batch: "2024-28", rank: "NIGHT_OWL",      role: "STUDENT",      bio: "vim, not emacs. this is not up for debate" },
  { n: 14, handle: "priya",      name: "Priya Nair",       branch: "IT",  year: 3, batch: "2023-27", rank: "FLEDGLING",      role: "STUDENT",      bio: "plans every trip. goes on none of them" },
  { n: 15, handle: "rohan",      name: "Rohan Verma",      branch: "ME",  year: 1, batch: "2025-29", rank: "SLEEPY_SPARROW", role: "STUDENT",      bio: "first sem, still finding the ME block" },
  { n: 16, handle: "sanya",      name: "Sanya Kapoor",     branch: "ECE", year: 3, batch: "2023-27", rank: "MOON_MOTH",      role: "STUDENT",      bio: "debate society, reformed argumentative" },
  { n: 17, handle: "aditya",     name: "Aditya Singh",     branch: "CSE", year: 4, batch: "2022-26", rank: "NIGHT_OWL",      role: "STUDENT",      bio: "placement season survivor, has opinions on DP" },
  { n: 18, handle: "neha",       name: "Neha Reddy",       branch: "EEE", year: 2, batch: "2024-28", rank: "FLEDGLING",      role: "STUDENT",      bio: "circuit lab survivor, chronically caffeinated" },
  { n: 19, handle: "varun",      name: "Varun Chawla",     branch: "CIVIL", year: 2, batch: "2024-28", rank: "SLEEPY_SPARROW", role: "STUDENT",    bio: "site visits, sketchbook, strong opinions on bridges" },
  { n: 20, handle: "pooja",      name: "Pooja Iyer",       branch: "IT",  year: 1, batch: "2025-29", rank: "SLEEPY_SPARROW", role: "STUDENT",      bio: "orientation week broke me a little" },
  { n: 21, handle: "yash",       name: "Yash Malhotra",    branch: "ME",  year: 3, batch: "2023-27", rank: "NIGHT_OWL",      role: "STUDENT",      bio: "gym at 6, workshop by 9, tired by noon" },
  { n: 22, handle: "ananya",     name: "Ananya Joshi",     branch: "CSE", year: 2, batch: "2024-28", rank: "FLEDGLING",      role: "STUDENT",      bio: "colour-codes everything, judges those who don't" },
  { n: 23, handle: "dhruv",      name: "Dhruv Khanna",     branch: "ECE", year: 4, batch: "2022-26", rank: "MOON_MOTH",      role: "STUDENT",      bio: "four years in, still can't use the oscilloscope" },
  { n: 24, handle: "riya",       name: "Riya Chatterjee",  branch: "CSE", year: 1, batch: "2025-29", rank: "SLEEPY_SPARROW", role: "STUDENT",      bio: "still figuring out which building is which" },
  { n: 25, handle: "nikhil",     name: "Nikhil Bhatt",     branch: "ME",  year: 2, batch: "2024-28", rank: "FLEDGLING",      role: "STUDENT",      bio: "plays bass badly, loudly, happily" },
  { n: 26, handle: "simran",     name: "Simran Dutta",     branch: "ME",  year: 2, batch: "2024-28", rank: "NIGHT_OWL",      role: "STUDENT",      bio: "better with a wrench than with words" },
  { n: 27, handle: "arjun",      name: "Arjun Rao",        branch: "EEE", year: 3, batch: "2023-27", rank: "MOON_MOTH",      role: "STUDENT",      bio: "permanently smells like solder" },
  { n: 28, handle: "tara",       name: "Tara Sharma",      branch: "CSE", year: 3, batch: "2023-27", rank: "NIGHT_OWL",      role: "STUDENT",      bio: "runs the 6am club, alone, most days" },
  { n: 29, handle: "vihaan",     name: "Vihaan Kumar",     branch: "ECE", year: 3, batch: "2023-27", rank: "FLEDGLING",      role: "STUDENT",      bio: "fixes everyone's laptop, fixes nothing else" },
  { n: 30, handle: "aisha",      name: "Aisha Siddiqui",   branch: "IT",  year: 4, batch: "2022-26", rank: "MOON_MOTH",      role: "STUDENT",      bio: "quiet in groups, unbearable one-on-one" },
] as const;

// Love Finder cards (PRD 6.3) — a Hinge-style profile is separate from the
// account itself (dating_profiles), and the deck only shows someone who has
// written at least one prompt answer (see api/internal/store/dating.go's
// Deck query) — a card with nothing on it is a gradient and a name, not a
// person to swipe on. Not every student gets one: a few (rohan, pooja,
// dhruv) exist as ordinary accounts who just haven't filled theirs in yet,
// same as a real campus on day one.
const DATING_PROFILES = [
  { n: 3, vibe: "sings in the stairwell, unbothered", interests: ["stairwell singing", "thrifting", "bad horror films"], prompts: [
    { question: "The way to win me over is", answer: "argue with me about a song for forty minutes and then send it to me anyway." },
    { question: "A shower thought I recently had", answer: "the ECE building echoes like a concert hall and I will not be taking questions." },
    { question: "Green flag I look for", answer: "shows up on time to the group project. bonus points for bringing snacks." },
  ] },
  { n: 5, vibe: "sem 3 survivor, professionally tired", interests: ["naps between classes", "stationery shopping", "reality tv"], prompts: [
    { question: "My love language is", answer: "free food. specifically someone else's tiffin." },
    { question: "I will not shut up about", answer: "the group project member who did zero work and still presented first." },
  ] },
  { n: 6, vibe: "workshop till 2am, chai after", interests: ["workshop till 2am", "cycling", "filter coffee"], prompts: [
    { question: "My most useless skill", answer: "I can identify any lathe by sound. This has helped me zero times socially." },
    { question: "First date, my choice", answer: "the canteen at 11pm when it's basically empty and the chai guy knows both our orders." },
  ] },
  { n: 7, vibe: "eight hours of sleep, non-negotiable", interests: ["crosswords", "long walks", "gym at 6am"], prompts: [
    { question: "An unpopular opinion I hold", answer: "the Owl Board is a trap and the Cocoon Bonus is the only correct strategy." },
    { question: "Dating me is like", answer: "being gently but firmly told to go to sleep. I will not be negotiating this." },
  ] },
  { n: 8, vibe: "robotics club, roof access", interests: ["film photography", "biryani rankings", "robotics club"], prompts: [
    { question: "Best campus discovery", answer: "the roof of the ECE block at 6am. don't tell the guard I told you." },
    { question: "Together we could", answer: "finally settle the biryani debate. I have a ranked list. I will defend it." },
  ] },
  { n: 9, vibe: "note hoarder, chronically caffeinated", interests: ["note hoarding", "kdramas", "chai at 3am"], prompts: [
    { question: "Two truths and a lie", answer: "I have every PYQ since 2019. I've never been to the canteen. I own four identical hoodies." },
    { question: "I'll fall for you if", answer: "you actually return the notes you borrow. set the bar low, I know." },
  ] },
  { n: 10, vibe: "lurker, professionally quiet", interests: ["overthinking texts", "street food tours", "late night walks"], prompts: [
    { question: "I'm weirdly good at", answer: "noticing when someone's changed their profile picture. don't ask how." },
    { question: "Together we could", answer: "finally finish the Gurugram food crawl I've been planning alone for a year." },
  ] },
  { n: 13, vibe: "argues about vim vs emacs, unprompted", interests: ["competitive programming", "chess", "late night debugging"], prompts: [
    { question: "Unpopular opinion", answer: "tabs are objectively correct and I will die on this hill." },
    { question: "First date, my choice", answer: "a 24-hour café so we can keep arguing past closing time." },
  ] },
  { n: 14, vibe: "plans everyone's trip, goes on none of them", interests: ["trip planning", "spotify wrapped analysis", "street shopping"], prompts: [
    { question: "I'm the friend who", answer: "has a spreadsheet for a two-day trip. yes, with tabs." },
    { question: "Green flag I look for", answer: "actually reads the itinerary before asking questions the itinerary already answers." },
  ] },
  { n: 16, vibe: "debate society, reformed argumentative", interests: ["debate society", "second-hand bookshops", "badminton"], prompts: [
    { question: "I'm convinced that", answer: "every good idea on this campus started as a complaint in the auto queue." },
    { question: "A perfect Sunday", answer: "Daryaganj book market, then paratha, then regretting how many books I bought." },
  ] },
  { n: 17, vibe: "placement season survivor, has opinions on DP", interests: ["leetcode", "badminton", "filter coffee"], prompts: [
    { question: "Ask me about", answer: "the 47 companies I applied to. I have a spreadsheet. it has colours." },
    { question: "My most useless skill", answer: "reciting the time complexity of every sorting algorithm at 2am, unprompted." },
  ] },
  { n: 18, vibe: "circuit lab survivor, chronically caffeinated", interests: ["baking", "true crime podcasts", "hostel gossip"], prompts: [
    { question: "Two truths and a lie", answer: "I've soldered my own earphones. I've never watched a full cricket match. I bake better than the mess cooks." },
    { question: "The way to win me over is", answer: "bring snacks to a group study session and not mention you brought them." },
  ] },
  { n: 19, vibe: "site visits, sketchbook, strong opinions on bridges", interests: ["sketching buildings", "metro trivia", "filter coffee"], prompts: [
    { question: "My most controversial take", answer: "the Yellow Line is objectively the best line and the Blue Line is chaos with a schedule." },
    { question: "Give me a Sunday and I'll", answer: "walk you around Mehrauli explaining arches until you visibly regret asking." },
  ] },
  { n: 21, vibe: "gym at 6, workshop by 9, tired by noon", interests: ["gym", "cycling", "cricket on the ground floor"], prompts: [
    { question: "Don't hate me if I", answer: "talk about my deadlift PR for longer than is socially acceptable." },
    { question: "First date, my choice", answer: "the ground floor cricket match — you keep score, I'll explain the rules wrong on purpose." },
  ] },
  { n: 22, vibe: "colour-codes everything, judges those who don't", interests: ["stationery", "kdramas", "note hoarding"], prompts: [
    { question: "I'll fall for you if", answer: "you return my highlighters. all four colours. I'm not asking twice." },
    { question: "My simple pleasures", answer: "a fresh notebook, a finished assignment, and being right about a plot twist." },
  ] },
  { n: 24, vibe: "still figuring out which building is which", interests: ["thrifting", "bad horror films", "stairwell singing"], prompts: [
    { question: "An unpopular opinion I hold", answer: "orientation week should just be a campus scavenger hunt — I'm still lost." },
    { question: "The way to win me over is", answer: "help me find the CSE block without laughing at me first." },
  ] },
  { n: 25, vibe: "plays bass badly, loudly, happily", interests: ["bass", "open mics", "long bus rides"], prompts: [
    { question: "Two truths and a lie", answer: "I've played three open mics. I own two basses. I can read sheet music." },
    { question: "The hill I will die on", answer: "the auditorium sound system is fine, people just don't know where to stand." },
  ] },
  { n: 26, vibe: "better with a wrench than with words", interests: ["cycling", "repair café", "cricket on the ground floor"], prompts: [
    { question: "My most useless skill", answer: "I can fix a bike chain blindfolded. I still can't parallel park." },
    { question: "Together we could", answer: "actually finish the go-kart project instead of just talking about it for a semester." },
  ] },
  { n: 27, vibe: "permanently smells like solder", interests: ["robotics club", "chess", "late night debugging"], prompts: [
    { question: "I'm looking for", answer: "someone who won't judge me for naming my soldering iron." },
    { question: "Best campus discovery", answer: "the EEE lab has the best AC on campus. don't tell facilities." },
  ] },
  { n: 28, vibe: "runs the 6am club, alone, most days", interests: ["running", "film photography", "biryani rankings"], prompts: [
    { question: "My ranked list of campus food", answer: "gate 2 momos, then the ECE canteen chai, then everything else, then the library sandwich." },
    { question: "I'm looking for", answer: "someone who'll come to the 6am run once, hate it, and still show up the next week." },
    { question: "Best advice I've been given", answer: "finish the bad first draft. it applies to essays, labs and apparently texting people." },
  ] },
  { n: 29, vibe: "fixes everyone's laptop, fixes nothing else", interests: ["repair café", "synths", "badminton"], prompts: [
    { question: "The way to win me over is", answer: "bring me something broken. I will fix it and then talk about it for a week." },
    { question: "A life goal of mine", answer: "build a synth from scratch that doesn't hum. currently 0 for 3." },
  ] },
  { n: 30, vibe: "quiet in groups, unbearable one-on-one", interests: ["chess", "crosswords", "ghazals"], prompts: [
    { question: "You should leave a comment if", answer: "you have a strong opinion about the Sunday crossword. correct opinions preferred." },
    { question: "I'm weirdly attracted to", answer: "people who finish their sentences. it's a low bar and the campus keeps limbo-ing under it." },
    { question: "Typical Friday night", answer: "three chess games, one loss I'm still thinking about, and dinner at an unreasonable hour." },
  ] },
] as const;

const HATS = ["beanie", "grad-cap", "flower", "none", "headphones"] as const;
const COLOURS = ["ube", "peach", "mint", "butter", "cocoa"] as const;

const SPACES = [
  { n: 1, slug: "placements",  name: "Placements",   icon: "💼", desc: "CTCs, interview experiences, off-campus links. No fake offers.", isDefault: true },
  { n: 2, slug: "hostel-food", name: "Hostel Food",  icon: "🍜", desc: "Today's mess menu, reviewed brutally.",                        isDefault: true },
  { n: 3, slug: "cse-sem3",    name: "CSE Sem 3",    icon: "📚", desc: "DSA, DBMS, COA. Doubts welcome, no gatekeeping.",              isDefault: true },
  { n: 4, slug: "memes",       name: "Memes",        icon: "😹", desc: "The only space with no rules except don't punch down.",        isDefault: true },
  { n: 5, slug: "lost-found",  name: "Lost & Found", icon: "🔍", desc: "ID cards, water bottles, dignity.",                            isDefault: true },
  { n: 6, slug: "clubs",       name: "Clubs",        icon: "🎪", desc: "Auditions, events, practice sessions.",                        isDefault: false },
  { n: 7, slug: "night-shift", name: "Night Shift",  icon: "🌙", desc: "For the 2 AM crowd. Say what you're working on.",              isDefault: true },
] as const;

const BADGES = [
  { code: "SEASON_2026_W37",   name: "Season 37 Owl",   emoji: "🏅", description: "Placed on the Owl Board in week 37 of 2026.", season: "2026-W37" },
  { code: "COCOON",            name: "Cocooned",        emoji: "🛏️", description: "Slept 7+ hours in a day. Recovery outscores damage." },
  { code: "FIRST_POST",        name: "First Words",     emoji: "🌱", description: "Posted for the first time." },
  { code: "NOTE_KEEPER",       name: "Note Keeper",     emoji: "📒", description: "Uploaded 5 files to the Note Locker." },
  { code: "BURROW_REGULAR",    name: "Burrow Regular",  emoji: "⏳", description: "Ten focus sessions in a Study Burrow." },
  { code: "FOUNDING_STUDENT",  name: "Founding Student",emoji: "✨", description: "Was here before the campus filled up." },
] as const;

const POSTS = [
  { n: 1,  space: 1, author: 4,  type: "TEXT",  title: "Wrote my Deloitte interview experience — 3 rounds, full questions inside", body: "Round 1 was aptitude + 2 coding (both easy DSA — sliding window, one string thing).\nRound 2 was tech: DBMS normalisation, one SQL join query, projects grilled hard. Know your own resume.\nRound 3 HR: relocation, bond, why Deloitte. 25 mins.\nAsk me anything below, I'll answer till midnight.", score: 47, hours: 5, comments: ["did they ask DP?", "how many got shortlisted from our branch?", "bro thank you, saving this"] },
  { n: 2,  space: 2, author: 5,  type: "TEXT",  title: "mess gave us paneer today and I need everyone to know",             body: "actual paneer. cubes and everything. i am emotional", score: 88, hours: 2, comments: ["it was rubber but i'll allow it", "the rajma yesterday was a war crime though"] },
  { n: 3,  space: 3, author: 9,  type: "ASK",   title: "Can someone explain why we normalise to 3NF but stop there?",       body: "Sir said BCNF exists but 3NF is 'enough in practice' and moved on. Enough for what?? Exam is Tuesday.", score: 31, hours: 8, comments: ["3NF keeps dependency preservation, BCNF can lose it. that's the actual answer", "for the exam: just know the definitions + one example each"] },
  { n: 4,  space: 7, author: 6,  type: "TEXT",  title: "2:14 AM. workshop assignment. who else is up",                     body: "third coffee. the lathe drawing is fighting back.", score: 64, hours: 26, comments: ["up. debugging a segfault that only happens on tuesdays", "logging off at 3, curfew hits and dronu starts yawning at me"] },
  { n: 5,  space: 4, author: 3,  type: "IMAGE", title: "the library at 8:59 AM vs 9:01 AM",                                 body: "", score: 156, hours: 12, comments: ["accurate and i hate it"] },
  { n: 6,  space: 5, author: 12, type: "TEXT",  title: "FOUND: blue water bottle, CSE block stairs, has a bhagavad gita sticker", body: "It's with the guard at gate 2. Come get it before it becomes mine.", score: 22, hours: 3, comments: ["MINE. omw"] },
  { n: 7,  space: 6, author: 11, type: "TEXT",  title: "Weekly contest Sat 7 PM — 4 problems, beginners bracket separate",  body: "Two brackets so first-years aren't fighting final-years. Top 3 in each get Stardust + a frame.", score: 41, hours: 20, comments: ["is it rated 🤡", "beginner bracket is such a good idea actually"] },
  { n: 8,  space: 1, author: 8,  type: "LINK",  title: "Off-campus drive: Zoho hiring 2026 batch, apply by Friday",         body: "", score: 73, hours: 30, comments: ["applied, thanks", "does anyone know if they take ECE"] },
  { n: 9,  space: 3, author: 5,  type: "POLL",  title: "COA mid-sem: how cooked are we",                                    body: "", score: 19, hours: 6, comments: [] },
  { n: 10, space: 7, author: 7,  type: "TEXT",  title: "PSA from someone who tried to top the Owl Board for a week",        body: "I did. I also got sick and missed two labs. The Cocoon Bonus is worth more than a whole night of grinding and I wish someone had just told me that on day one, so: told you.", score: 203, hours: 40, comments: ["needed this", "cocoon gang 🛏️", "the app literally tells you to sleep and we ignore it"] },
] as const;

async function main() {
  console.log("🌱 seeding DronaSphere…\n");

  // ---------------------------------------------------------------- campus ---
  const campus = await prisma.campus.upsert({
    where: { id: CAMPUS_ID },
    update: { verifiedUserCount: DEMO_USERS.length },
    create: {
      id: CAMPUS_ID,
      name: "Dronacharya College of Engineering",
      slug: "dce-gurgaon",
      emailDomain: EMAIL_DOMAIN,
      city: "Gurugram",
      verifiedUserCount: DEMO_USERS.length,
    },
  });
  console.log(`  campus  ${campus.name} (@${EMAIL_DOMAIN})`);

  // ---------------------------------------------------------------- badges ---
  for (const b of BADGES) {
    await prisma.badge.upsert({
      where: { code: b.code },
      update: { name: b.name, description: b.description, emoji: b.emoji },
      create: { code: b.code, name: b.name, description: b.description, emoji: b.emoji, season: b.season ?? null },
    });
  }
  console.log(`  badges  ${BADGES.length}`);

  // ----------------------------------------------------------------- users ---
  for (const u of DEMO_USERS) {
    // Everyone seeded is 18+ so the Love Finder gate (PRD 6.3) is exercisable.
    const dob = new Date(Date.UTC(2005 - (u.year - 2), (u.n % 12), 1 + (u.n % 27)));
    await prisma.user.upsert({
      where: { id: uid(u.n) },
      update: { displayName: u.name, bio: u.bio, owlRank: u.rank as never },
      create: {
        id: uid(u.n),
        campusId: CAMPUS_ID,
        email: `${u.handle}@${EMAIL_DOMAIN}`,
        handle: u.handle,
        displayName: u.name,
        bio: u.bio,
        avatar: {
          hat: HATS[u.n % HATS.length],
          colour: COLOURS[u.n % COLOURS.length],
          eyes: u.n % 2 === 0 ? "sleepy" : "sparkle",
          accessory: u.n % 3 === 0 ? "scarf" : "none",
        },
        dob,
        batch: u.batch,
        branch: u.branch,
        year: u.year,
        role: u.role as never,
        status: "ACTIVE",
        verificationMethod: "EMAIL_DOMAIN",
        emailVerifiedAt: new Date(),
        onboardingStep: "DONE",
        owlRank: u.rank as never,
        // Love Finder eligibility is set below, per DATING_PROFILES — never
        // here. Everyone starts opted out and unverified for it, same as a
        // real signup; a club or bot account (dronu, codingclub, lostfound)
        // is never in DATING_PROFILES, so it never becomes eligible at all.
        stardust: 100 + u.n * 37,
        lastSeenAt: hoursAgo(u.n % 6),
      },
    });
  }
  console.log(`  users   ${DEMO_USERS.length}`);

  // -------------------------------------------------------- love finder -----
  // Opts each card-holder into the deck and writes their card in one step —
  // photoVerifiedAt is what api/internal/domain's CanUseDating actually
  // checks, and the deck additionally requires at least one written prompt
  // (see api/internal/store/dating.go's Deck query), so both have to be true
  // together for anyone to actually appear as a swipeable candidate.
  for (const dp of DATING_PROFILES) {
    await prisma.user.update({
      where: { id: uid(dp.n) },
      data: { loveFinderEnabled: true, photoVerifiedAt: new Date() },
    });
    await prisma.datingProfile.upsert({
      where: { userId: uid(dp.n) },
      update: { vibe: dp.vibe, interests: [...dp.interests], prompts: dp.prompts.map((p) => ({ ...p })) },
      create: {
        userId: uid(dp.n),
        vibe: dp.vibe,
        interests: [...dp.interests],
        prompts: dp.prompts.map((p) => ({ ...p })),
      },
    });
  }
  console.log(`  dating  ${DATING_PROFILES.length} cards in the deck`);

  // --------------------------------------------------------------- follows ---
  // PRD 6.1: a feed with fewer than ~8 sources looks empty, and onboarding is
  // not complete below ONBOARDING_MIN_FOLLOWS. The seed set has 10 accounts so
  // that even a member of the set (who cannot follow themselves) still clears
  // the follow-8 gate and lands on a live home screen rather than the gate.
  const seedSet = [1, 2, 3, 4, 5, 6, 8, 9, 11, 12];
  let follows = 0;
  for (const u of DEMO_USERS) {
    for (const target of seedSet) {
      if (target === u.n) continue;
      await prisma.follow.upsert({
        where: { followerId_followeeId: { followerId: uid(u.n), followeeId: uid(target) } },
        update: {},
        create: { followerId: uid(u.n), followeeId: uid(target) },
      });
      follows++;
    }
  }
  // Denormalised counters the API keeps in step on every follow/unfollow.
  for (const u of DEMO_USERS) {
    const [followerCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followeeId: uid(u.n) } }),
      prisma.follow.count({ where: { followerId: uid(u.n) } }),
    ]);
    await prisma.user.update({ where: { id: uid(u.n) }, data: { followerCount, followingCount } });
  }
  console.log(`  follows ${follows}`);

  // ---------------------------------------------------------------- spaces ---
  for (const s of SPACES) {
    await prisma.space.upsert({
      where: { id: sid(s.n) },
      update: { name: s.name, description: s.desc, icon: s.icon },
      create: {
        id: sid(s.n),
        campusId: CAMPUS_ID,
        slug: s.slug,
        name: s.name,
        description: s.desc,
        icon: s.icon,
        isDefault: s.isDefault,
        createdById: uid(1),
      },
    });
  }
  await prisma.spaceModerator.upsert({
    where: { spaceId_userId: { spaceId: sid(1), userId: uid(4) } },
    update: {},
    create: { spaceId: sid(1), userId: uid(4) },
  });
  await prisma.spaceModerator.upsert({
    where: { spaceId_userId: { spaceId: sid(6), userId: uid(11) } },
    update: {},
    create: { spaceId: sid(6), userId: uid(11) },
  });
  console.log(`  spaces  ${SPACES.length}`);

  // ----------------------------------------------------------------- posts ---
  let commentCount = 0;
  for (const p of POSTS) {
    const createdAt = hoursAgo(p.hours);
    await prisma.post.upsert({
      where: { id: pid(p.n) },
      update: { score: p.score, hotRank: hotRank(p.score, createdAt) },
      create: {
        id: pid(p.n),
        spaceId: sid(p.space),
        authorId: uid(p.author),
        type: p.type as never,
        title: p.title,
        body: p.body || null,
        imageUrl: p.type === "IMAGE" ? "https://placehold.co/600x400/A78BFA/FFF9F2?text=library+at+9am" : null,
        linkUrl: p.type === "LINK" ? "https://careers.zohocorp.com" : null,
        score: p.score,
        hotRank: hotRank(p.score, createdAt),
        commentCount: p.comments.length,
        createdAt,
      },
    });

    for (let i = 0; i < p.comments.length; i++) {
      const author = ((p.author + i + 3) % DEMO_USERS.length) + 1;
      await prisma.comment.upsert({
        where: { id: `${pid(p.n).slice(0, -2)}${String(90 + i).padStart(2, "0")}` },
        update: {},
        create: {
          id: `${pid(p.n).slice(0, -2)}${String(90 + i).padStart(2, "0")}`,
          postId: pid(p.n),
          authorId: uid(author),
          body: p.comments[i],
          score: (i + 1) * 3,
          createdAt: new Date(createdAt.getTime() + (i + 1) * 900_000),
        },
      });
      commentCount++;
    }

    // Sticker reactions (PRD 6.5) — never affect ranking, exist for lurkers.
    const stickers = ["COOKIE", "SPARKLE", "SOB", "FIRE", "HEART_HANDS"] as const;
    for (let i = 0; i < 3; i++) {
      const reactor = ((p.n + i * 4) % DEMO_USERS.length) + 1;
      const sticker = stickers[(p.n + i) % stickers.length];
      await prisma.reaction.upsert({
        where: { userId_targetType_targetId_sticker: { userId: uid(reactor), targetType: "POST", targetId: pid(p.n), sticker } },
        update: {},
        create: { userId: uid(reactor), targetType: "POST", targetId: pid(p.n), sticker },
      });
    }

    // A few real votes so scores are not pure fiction.
    for (let i = 1; i <= Math.min(DEMO_USERS.length, 6); i++) {
      await prisma.postVote.upsert({
        where: { postId_userId: { postId: pid(p.n), userId: uid(i) } },
        update: {},
        create: { postId: pid(p.n), userId: uid(i), value: 1 },
      });
    }
  }
  console.log(`  posts   ${POSTS.length} (+${commentCount} comments)`);

  // ------------------------------------------------------------------ poll ---
  const poll = await prisma.poll.upsert({
    where: { postId: pid(9) },
    update: {},
    create: { id: tid(9), postId: pid(9), question: "COA mid-sem: how cooked are we", closesAt: hoursAgo(-48) },
  });
  const options = ["fully cooked 🔥", "medium rare", "I have not opened the book", "confident (lying)"];
  for (let i = 0; i < options.length; i++) {
    await prisma.pollOption.upsert({
      where: { pollId_idx: { pollId: poll.id, idx: i } },
      update: { label: options[i] },
      create: { pollId: poll.id, label: options[i], idx: i, count: [7, 2, 9, 1][i] },
    });
  }

  // ----------------------------------------------------- chats, den, signal ---
  // 1:1 DM between two mutuals (Buddies unlock direct DM — PRD 6.7).
  await prisma.thread.upsert({
    where: { id: tid(1) },
    update: {},
    create: { id: tid(1), type: "DM", createdById: uid(3), lastMessageAt: hoursAgo(1) },
  });
  for (const [i, u] of [3, 5].entries()) {
    await prisma.threadMember.upsert({
      where: { threadId_userId: { threadId: tid(1), userId: uid(u) } },
      update: {},
      create: { threadId: tid(1), userId: uid(u), role: i === 0 ? "OWNER" : "MEMBER", state: "ACTIVE" },
    });
  }
  const dmMessages: Array<[number, string, number]> = [
    [3, "did you get the dbms notes from zoya", 4],
    [5, "yeah they're in the note locker now, sem 3 → dbms", 3.8],
    [3, "you're a lifesaver 🫶", 3.5],
    [5, "burrow at 10? the quiet one", 1.2],
    [3, "yes. bringing the bad coffee", 1],
  ];
  for (const [i, [sender, body, hrs]] of dmMessages.entries()) {
    await prisma.message.upsert({
      where: { threadId_clientId: { threadId: tid(1), clientId: `seed-dm-${i}` } },
      update: {},
      create: {
        threadId: tid(1),
        senderId: uid(sender),
        kind: "TEXT",
        body,
        clientId: `seed-dm-${i}`,
        createdAt: hoursAgo(hrs),
      },
    });
  }

  // A Den (group chat, 256 cap) and a Signal (broadcast).
  await prisma.thread.upsert({
    where: { id: tid(2) },
    update: {},
    create: { id: tid(2), type: "DEN", title: "CSE Sem 3 — the good one", icon: "📚", createdById: uid(9), inviteCode: "sem3-den", lastMessageAt: hoursAgo(2) },
  });
  for (const u of [9, 5, 3, 7, 10]) {
    await prisma.threadMember.upsert({
      where: { threadId_userId: { threadId: tid(2), userId: uid(u) } },
      update: {},
      create: { threadId: tid(2), userId: uid(u), role: u === 9 ? "OWNER" : "MEMBER", state: "ACTIVE" },
    });
  }
  await prisma.message.upsert({
    where: { threadId_clientId: { threadId: tid(2), clientId: "seed-den-0" } },
    update: {},
    create: { threadId: tid(2), senderId: uid(9), kind: "TEXT", body: "dbms unit 3 pdf is up in the locker, go forth", clientId: "seed-den-0", createdAt: hoursAgo(2) },
  });

  await prisma.thread.upsert({
    where: { id: tid(3) },
    update: {},
    create: { id: tid(3), type: "SIGNAL", title: "Coding Club DCE", icon: "💻", createdById: uid(11), commentsEnabled: true, lastMessageAt: hoursAgo(20) },
  });
  await prisma.threadMember.upsert({
    where: { threadId_userId: { threadId: tid(3), userId: uid(11) } },
    update: {},
    create: { threadId: tid(3), userId: uid(11), role: "OWNER", state: "ACTIVE" },
  });
  for (const u of [2, 3, 5, 7, 9, 10]) {
    await prisma.threadMember.upsert({
      where: { threadId_userId: { threadId: tid(3), userId: uid(u) } },
      update: {},
      create: { threadId: tid(3), userId: uid(u), role: "SUBSCRIBER", state: "ACTIVE" },
    });
  }
  await prisma.message.upsert({
    where: { threadId_clientId: { threadId: tid(3), clientId: "seed-signal-0" } },
    update: {},
    create: { threadId: tid(3), senderId: uid(11), kind: "TEXT", body: "Contest Sat 7 PM. Beginners bracket is separate — first years, no excuses.", clientId: "seed-signal-0", createdAt: hoursAgo(20) },
  });
  console.log(`  chats   1 DM, 1 Den, 1 Signal`);

  // ----------------------------------------------------------- note locker ---
  // PRD 7.4 + 14: pre-load a semester of PYQs so the app is useful on a dead Tuesday.
  const NOTES = [
    { subject: "DBMS",              semester: 3, kind: "PYQ",   title: "DBMS mid-sem 2025 (with solutions)",   up: 41, uploader: 9 },
    { subject: "DBMS",              semester: 3, kind: "NOTES", title: "Normalisation — 1NF to BCNF, one page", up: 67, uploader: 9 },
    { subject: "Data Structures",   semester: 3, kind: "PYQ",   title: "DSA end-sem 2024 + 2025",               up: 88, uploader: 5 },
    { subject: "COA",               semester: 3, kind: "NOTES", title: "Pipelining hazards, actually readable", up: 34, uploader: 3 },
    { subject: "Discrete Maths",    semester: 3, kind: "PYQ",   title: "DM end-sem 2023-2025 bundle",           up: 52, uploader: 10 },
    { subject: "Signals & Systems", semester: 4, kind: "NOTES", title: "Fourier cheat sheet",                   up: 29, uploader: 8 },
    { subject: "Thermodynamics",    semester: 3, kind: "LAB",   title: "Lab manual + readings template",        up: 18, uploader: 6 },
    { subject: "OS",                semester: 5, kind: "PYQ",   title: "OS mid-sem 2025, all sections",         up: 44, uploader: 4 },
  ];
  for (const [i, note] of NOTES.entries()) {
    const id = `66666666-6666-4666-8666-${String(i + 1).padStart(12, "0")}`;
    await prisma.noteLockerItem.upsert({
      where: { id },
      update: { score: note.up },
      create: {
        id,
        uploaderId: uid(note.uploader),
        subject: note.subject,
        semester: note.semester,
        kind: note.kind,
        title: note.title,
        fileUrl: `https://storage.dronasphere.app/notes/${id}.pdf`,
        fileSize: 240_000 + i * 90_000,
        score: note.up,
        downloads: note.up * 6,
        createdAt: hoursAgo(24 * (i + 2)),
      },
    });
  }
  console.log(`  notes   ${NOTES.length}`);

  // -------------------------------------------------------- study burrows ----
  const BURROWS = [
    { n: 1, name: "The Quiet One",   subject: null,      focus: 50, brk: 10 },
    { n: 2, name: "Sem 3 Grind",     subject: "DBMS",    focus: 25, brk: 5 },
    { n: 3, name: "3 AM Club",       subject: null,      focus: 25, brk: 5 },
  ];
  for (const b of BURROWS) {
    const id = `77777777-7777-4777-8777-${String(b.n).padStart(12, "0")}`;
    await prisma.studyBurrow.upsert({
      where: { id },
      update: { name: b.name },
      create: { id, campusId: CAMPUS_ID, name: b.name, subject: b.subject, focusMinutes: b.focus, breakMinutes: b.brk },
    });
  }
  console.log(`  burrows ${BURROWS.length}`);

  // ------------------------------------------------------------ owl board ----
  const wk = weekKey();
  const owlPoints: Record<number, number> = { 1: 940, 2: 610, 3: 505, 4: 480, 6: 455, 8: 390, 11: 320, 5: 180, 9: 150, 7: 60, 10: 25, 12: 10 };
  const ordered = Object.entries(owlPoints).sort((a, b) => b[1] - a[1]);
  for (const [i, [n, points]] of ordered.entries()) {
    await prisma.owlScore.upsert({
      where: { userId_weekKey: { userId: uid(Number(n)), weekKey: wk } },
      update: { points, rank: i + 1 },
      create: { userId: uid(Number(n)), campusId: CAMPUS_ID, weekKey: wk, points, rank: i + 1, owlRank: DEMO_USERS[Number(n) - 1].rank as never },
    });
  }
  // Ira (7) is the Cocoon Bonus poster child — recovery outscores damage.
  const dayKey = new Date().toISOString().slice(0, 10);
  await prisma.cocoonClaim.upsert({
    where: { userId_dayKey: { userId: uid(7), dayKey } },
    update: {},
    create: { userId: uid(7), dayKey, sleepHours: 8.5, stardust: Number(process.env.COCOON_STARDUST ?? 250) },
  });
  console.log(`  owl     ${ordered.length} scores for ${wk}, 1 cocoon claim`);

  console.log(`
✨ done.

   campus     ${campus.name} — ${DEMO_USERS.length} verified students
   love finder ${DATING_PROFILES.length} cards in the deck
   sign in as  ${DEMO_USERS.map((u) => `${u.handle}@${EMAIL_DOMAIN}`).slice(0, 3).join("  ")}  …
   the OTP is printed by the API when MAILER=log.

   DATING_UNLOCK_MIN_USERS defaults to 400 — with ${DEMO_USERS.length} seeded
   here, Love Finder will report itself locked until you lower it in .env.
`);
}

main()
  .catch((e) => {
    console.error("seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
