import type { DatingCandidate, DatingLike } from "./types";

// Love Finder has no deck endpoint yet — the API exposes only the opt-in
// toggle (POST /v1/me/love-finder) and the account-level gates behind it.
// Everything here is local so the surface can be built and reviewed now; the
// shapes match what the API will return, so wiring it up is a swap, not a
// rewrite. Copy is written the way second-years actually write, because a deck
// full of brand voice is the fastest way to make a dating product feel fake.

export const MOCK_DECK: DatingCandidate[] = [
  {
    id: "d1",
    handle: "meher",
    displayName: "Meher",
    year: 2,
    branch: "ECE",
    batch: "2024-28",
    avatar: { hat: "flower", eyes: "wink", colour: "peach", accessory: "none" },
    vibe: "sings in the stairwell, unbothered",
    verified: true,
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
      {
        question: "Green flag I look for",
        answer: "shows up on time to the group project. bonus points for bringing snacks.",
      },
    ],
    distanceNote: "Same campus",
  },
  {
    id: "d2",
    handle: "kabir",
    displayName: "Kabir",
    year: 3,
    branch: "ME",
    batch: "2023-27",
    avatar: { hat: "bandana", eyes: "sparkle", colour: "butter", accessory: "scarf" },
    vibe: "workshop till 2am, chai after",
    verified: true,
    interests: ["workshop till 2am", "cycling", "filter coffee"],
    prompts: [
      {
        question: "My most useless skill",
        answer: "I can identify any lathe by sound. This has helped me zero times socially.",
      },
      {
        question: "First date, my choice",
        answer: "the canteen at 11pm when it's basically empty and the chai guy knows both our orders.",
      },
      {
        question: "I get way too competitive about",
        answer: "who can carry more stuff up to the third floor in one trip. I always lose. I keep trying.",
      },
    ],
    distanceNote: "Same campus",
  },
  {
    id: "d3",
    handle: "zoya",
    displayName: "Zoya",
    year: 2,
    branch: "CSE",
    batch: "2024-28",
    avatar: { hat: "headphones", eyes: "wide", colour: "mint", accessory: "glasses" },
    vibe: "note hoarder, chronically caffeinated",
    verified: true,
    interests: ["note hoarding", "kdramas", "chai at 3am"],
    prompts: [
      {
        question: "Two truths and a lie",
        answer: "I have every PYQ since 2019. I've never been to the canteen. I own four identical hoodies.",
      },
      {
        question: "I'll fall for you if",
        answer: "you actually return the notes you borrow. set the bar low, I know.",
      },
      {
        question: "My simple pleasures",
        answer: "a clean margin, a finished syllabus, and being right about a plot twist.",
      },
    ],
    distanceNote: "Same campus",
  },
  {
    id: "d4",
    handle: "devansh",
    displayName: "Devansh",
    year: 4,
    branch: "ECE",
    batch: "2022-26",
    avatar: { hat: "grad-cap", eyes: "sparkle", colour: "cocoa", accessory: "earbuds" },
    vibe: "robotics club, roof access",
    verified: false,
    interests: ["robotics club", "street photography", "biryani rankings"],
    prompts: [
      {
        question: "Best campus discovery",
        answer: "the roof of the ECE block at 6am. don't tell the guard I told you.",
      },
      {
        question: "Together we could",
        answer: "finally settle the biryani debate. I have a ranked list. I will defend it.",
      },
    ],
    distanceNote: "Same campus",
  },
  {
    id: "d5",
    handle: "ira",
    displayName: "Ira",
    year: 3,
    branch: "CSE",
    batch: "2023-27",
    avatar: { hat: "beanie", eyes: "closed", colour: "ube", accessory: "bowtie" },
    vibe: "eight hours of sleep, non-negotiable",
    verified: true,
    interests: ["eight hours of sleep", "crosswords", "long walks"],
    prompts: [
      {
        question: "An unpopular opinion I hold",
        answer: "the Owl Board is a trap and the Cocoon Bonus is the only correct strategy.",
      },
      {
        question: "Dating me is like",
        answer: "being gently but firmly told to go to sleep. I will not be negotiating this.",
      },
      {
        question: "The last thing that made me laugh",
        answer: "someone put a 'do not disturb, thesis in progress' sign on the library vending machine.",
      },
    ],
    distanceNote: "Same campus",
  },
  {
    id: "d6",
    handle: "rhea",
    displayName: "Rhea",
    year: 2,
    branch: "IT",
    batch: "2024-28",
    avatar: { hat: "none", eyes: "wink", colour: "cream", accessory: "none" },
    vibe: "debate society, reformed argumentative",
    verified: true,
    interests: ["debate society", "second-hand bookshops", "badminton"],
    prompts: [
      {
        question: "I'm convinced that",
        answer: "every good idea on this campus started as a complaint in the auto queue.",
      },
      {
        question: "Don't hate me if I",
        answer: "correct the motion mid-argument. it's a reflex. I'm working on it. slowly.",
      },
      {
        question: "A perfect Sunday",
        answer: "Daryaganj book market, then paratha, then regretting how many books I bought.",
      },
    ],
    distanceNote: "Same campus",
  },
  {
    id: "d7",
    handle: "arnav",
    displayName: "Arnav",
    year: 4,
    branch: "CIVIL",
    batch: "2022-26",
    avatar: { hat: "headphones", eyes: "wide", colour: "mint", accessory: "none" },
    vibe: "site visits, sketchbook, strong opinions on bridges",
    verified: true,
    interests: ["sketching buildings", "metro trivia", "filter coffee"],
    prompts: [
      {
        question: "My most controversial take",
        answer: "the Yellow Line is objectively the best line and the Blue Line is chaos with a schedule.",
      },
      {
        question: "Give me a Sunday and I'll",
        answer: "walk you around Mehrauli explaining arches until you visibly regret asking.",
      },
    ],
    distanceNote: "Same campus",
  },
];

/** People who already liked the viewer — Hinge's "Likes You", where the like
 * arrives attached to the exact thing they liked. */
export const INCOMING_LIKES: DatingLike[] = [
  {
    id: "l1",
    at: "2026-09-11T18:20:00.000Z",
    target: { kind: "prompt", index: 0 },
    note: "the ranked list better be defensible, because I have one too and mine is correct.",
    candidate: {
      id: "c1",
      handle: "tara",
      displayName: "Tara",
      year: 3,
      branch: "CSE",
      batch: "2023-27",
      avatar: { hat: "bandana", eyes: "sparkle", colour: "ube", accessory: "glasses" },
      vibe: "runs the 6am club, alone, most days",
      verified: true,
      interests: ["running", "film photography", "biryani rankings"],
      prompts: [
        {
          question: "My ranked list of campus food",
          answer: "gate 2 momos, then the ECE canteen chai, then everything else, then the library sandwich.",
        },
        {
          question: "I'm looking for",
          answer: "someone who'll come to the 6am run once, hate it, and still show up the next week.",
        },
        {
          question: "Best advice I've been given",
          answer: "finish the bad first draft. it applies to essays, labs and apparently texting people.",
        },
      ],
      distanceNote: "Same campus",
    },
  },
  {
    id: "l2",
    at: "2026-09-11T09:05:00.000Z",
    target: { kind: "photo" },
    twinkle: true,
    candidate: {
      id: "c2",
      handle: "nikhil",
      displayName: "Nikhil",
      year: 2,
      branch: "ME",
      batch: "2024-28",
      avatar: { hat: "grad-cap", eyes: "wide", colour: "peach", accessory: "none" },
      vibe: "plays bass badly, loudly, happily",
      verified: true,
      interests: ["bass", "open mics", "long bus rides"],
      prompts: [
        {
          question: "Two truths and a lie",
          answer: "I've played three open mics. I own two basses. I can read sheet music.",
        },
        {
          question: "The hill I will die on",
          answer: "the auditorium sound system is fine, people just don't know where to stand.",
        },
      ],
      distanceNote: "Same campus",
    },
  },
  {
    id: "l3",
    at: "2026-09-10T21:40:00.000Z",
    target: { kind: "prompt", index: 1 },
    note: "I also own four identical hoodies. we should probably talk about this.",
    candidate: {
      id: "c3",
      handle: "aisha",
      displayName: "Aisha",
      year: 4,
      branch: "IT",
      batch: "2022-26",
      avatar: { hat: "beanie", eyes: "closed", colour: "cocoa", accessory: "scarf" },
      vibe: "quiet in groups, unbearable one-on-one",
      verified: true,
      interests: ["chess", "crosswords", "ghazals"],
      prompts: [
        {
          question: "You should leave a comment if",
          answer: "you have a strong opinion about the Sunday crossword. correct opinions preferred.",
        },
        {
          question: "I'm weirdly attracted to",
          answer: "people who finish their sentences. it's a low bar and the campus keeps limbo-ing under it.",
        },
        {
          question: "Typical Friday night",
          answer: "three chess games, one loss I'm still thinking about, and dinner at an unreasonable hour.",
        },
      ],
      distanceNote: "Same campus",
    },
  },
  {
    id: "l4",
    at: "2026-09-09T16:10:00.000Z",
    target: { kind: "prompt", index: 0 },
    candidate: {
      id: "c4",
      handle: "vihaan",
      displayName: "Vihaan",
      year: 3,
      branch: "ECE",
      batch: "2023-27",
      avatar: { hat: "none", eyes: "sparkle", colour: "butter", accessory: "earbuds" },
      vibe: "fixes everyone's laptop, fixes nothing else",
      verified: false,
      interests: ["repair café", "synths", "badminton"],
      prompts: [
        {
          question: "The way to win me over is",
          answer: "bring me something broken. I will fix it and then talk about it for a week.",
        },
        {
          question: "A life goal of mine",
          answer: "build a synth from scratch that doesn't hum. currently 0 for 3.",
        },
      ],
      distanceNote: "Same campus",
    },
  },
];

/** Demo-only: liking one of these matches back instantly, so the celebration is
 * reachable without depending on a coin flip. Kept out of DatingCandidate —
 * that type mirrors a real match-service response, and "does this always match"
 * has no place in that contract. */
export const MOCK_MATCH_HANDLES = new Set(["meher", "zoya"]);

/** The prompt library people pick from when writing their own card. Short,
 * answerable, and none of them ask you to be funny on command. */
export const PROMPT_LIBRARY = [
  "The way to win me over is",
  "Two truths and a lie",
  "A shower thought I recently had",
  "My most useless skill",
  "First date, my choice",
  "Green flag I look for",
  "I'm looking for",
  "Don't hate me if I",
  "Together we could",
  "An unpopular opinion I hold",
  "The hill I will die on",
  "A perfect Sunday",
  "Best campus discovery",
  "I get way too competitive about",
  "You should leave a comment if",
];

/** Interest chips offered in the editor. Campus-specific on purpose — a generic
 * list of "travel / music / food" tells you nothing about anybody. */
export const INTEREST_LIBRARY = [
  "chai at 3am",
  "note hoarding",
  "stairwell singing",
  "robotics club",
  "debate society",
  "cycling",
  "badminton",
  "film photography",
  "open mics",
  "thrifting",
  "kdramas",
  "bad horror films",
  "crosswords",
  "long walks",
  "metro trivia",
  "second-hand bookshops",
  "biryani rankings",
  "repair café",
  "gym at 6am",
  "cricket on the ground floor",
];
