// UI-only demo data for the Love Finder swipe deck.
//
// There is no backend endpoint for this yet — api/internal/service has the
// account-level gates (age, photo verification, campus-size unlock,
// loveFinderEnabled toggle) fully wired to POST /v1/me/love-finder, but the
// Swipe/Match tables in prisma/schema.prisma have no store, service or route
// built on top of them yet. This file exists so the front end can be
// designed and demoed against realistic data now, in the exact shape
// (DatingCandidate) the real deck endpoint should return later — swapping
// this for a `GET /v1/dating/deck` call should be close to a drop-in change.
import type { DatingCandidate } from "./types";

export const MOCK_CANDIDATES: DatingCandidate[] = [
  {
    id: "cand-1",
    handle: "ira",
    displayName: "Ira Menon",
    year: 3,
    branch: "CSE",
    batch: "2023-27",
    photoUrl: "https://placehold.co/600x800/FFD9E0/5C2333?text=Ira",
    interests: ["🎨 sketching", "☕ chai over coffee", "🌙 night owl"],
    prompt: { question: "My most controversial opinion is", answer: "pineapple belongs on maggi, fight me" },
    distanceNote: "Same campus",
  },
  {
    id: "cand-2",
    handle: "devansh",
    displayName: "Devansh Rao",
    year: 4,
    branch: "ECE",
    batch: "2022-26",
    photoUrl: "https://placehold.co/600x800/FFE1E6/5C2333?text=Devansh",
    interests: ["🤖 robotics club", "🎮 valorant", "🏸 badminton"],
    prompt: { question: "Green flag I look for", answer: "someone who actually reads the group chat" },
    distanceNote: "Same campus",
  },
  {
    id: "cand-3",
    handle: "tanya",
    displayName: "Tanya Bose",
    year: 2,
    branch: "IT",
    batch: "2024-28",
    photoUrl: "https://placehold.co/600x800/FFCFC2/5C2333?text=Tanya",
    interests: ["📚 sem 3 survivor", "🎧 lo-fi playlists", "🍜 hostel food critic"],
    prompt: { question: "Let's debate this topic", answer: "is cornetto a meal or a mood" },
    distanceNote: "Same campus",
  },
  {
    id: "cand-4",
    handle: "kabir",
    displayName: "Kabir Sethi",
    year: 3,
    branch: "ME",
    batch: "2023-27",
    photoUrl: "https://placehold.co/600x800/FFE083/5C2333?text=Kabir",
    interests: ["🔧 workshop till 2am", "🎸 garage band", "🏍️ bike rides"],
    prompt: { question: "The way to win me over is", answer: "bring me actual good filter coffee" },
    distanceNote: "Same campus",
  },
  {
    id: "cand-5",
    handle: "zoya",
    displayName: "Zoya Ahmed",
    year: 2,
    branch: "CSE",
    batch: "2024-28",
    photoUrl: "https://placehold.co/600x800/FFB4A2/401726?text=Zoya",
    interests: ["📝 notes hoarder", "🎬 film club", "🌧️ monsoon walks"],
    prompt: { question: "Unpopular study habit", answer: "I annotate PYQs in four colours" },
    distanceNote: "Same campus",
  },
];
