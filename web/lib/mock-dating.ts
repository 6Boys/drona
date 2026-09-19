// The two pick-lists the card editor offers. Everything else that used to
// live here — a fake deck, fake incoming likes, a set of handles that always
// matched — is gone: the deck, likes and matches are real rows now, served
// by /v1/dating/* out of Postgres.

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
