// Package safety implements the crisis routing required by PRD 10.
//
// The reasoning from the PRD, kept here because it explains why this file is not
// optional: DronaSphere is a night-focused app for stressed engineering students,
// used heaviest during exam season. Text matching self-harm patterns surfaces a
// support card with Indian helplines and is queued for a human reviewer.
//
// Two rules govern this code:
//
//  1. It never blocks the post. Silencing someone who is struggling is worse
//     than showing them a card they did not ask for.
//  2. The copy is plain. PRD 8 is explicit that cuteness in a safety surface
//     reads as manipulation, so Dronu stays out of it entirely.
package safety

import (
	"regexp"
	"strings"
)

// Helpline is a support contact shown on the card.
type Helpline struct {
	Name        string `json:"name"`
	Number      string `json:"number"`
	Description string `json:"description"`
	Hours       string `json:"hours"`
}

// SupportCard is what the client renders when a crisis pattern matches.
type SupportCard struct {
	// Plain, literal copy. No mascot, no jokes, no exclamation marks.
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	Helplines []Helpline `json:"helplines"`
}

// Helplines for India, as named in PRD 10.
var helplines = []Helpline{
	{
		Name:        "Tele-MANAS",
		Number:      "14416",
		Description: "Government of India mental health support line. Free, available in multiple languages.",
		Hours:       "24 hours",
	},
	{
		Name:        "iCall",
		Number:      "9152987821",
		Description: "Counselling by trained mental health professionals, run by TISS.",
		Hours:       "Monday to Saturday, 10am to 8pm",
	},
	{
		Name:        "AASRA",
		Number:      "9820466726",
		Description: "Crisis intervention and suicide prevention helpline.",
		Hours:       "24 hours",
	},
}

// card is built once; it never varies by user or context.
var card = SupportCard{
	Title: "Support is available",
	Body: "It sounds like you may be going through something difficult. " +
		"You can talk to someone about it right now, free and confidentially. " +
		"Your post was not removed or hidden.",
	Helplines: helplines,
}

// Patterns are intentionally narrow. A false positive costs a card nobody
// needed; casting the net too wide trains people to dismiss it, which costs the
// card its meaning. Each entry is a phrase, matched on word boundaries.
var crisisPatterns = []*regexp.Regexp{
	// First person and explicit. Note the absence of a bare "kill me": among
	// students "this exam is going to kill me" is overwhelmingly hyperbole, and
	// a card that fires on it teaches everyone to dismiss the card.
	regexp.MustCompile(`(?i)\bkill(?:ing)? my ?self\b`),
	regexp.MustCompile(`(?i)\bkms\b`),
	regexp.MustCompile(`(?i)\b(?:end|ending) (?:it all|my life)\b`),
	regexp.MustCompile(`(?i)\bwant to die\b`),
	regexp.MustCompile(`(?i)\bdon'?t want to (?:live|be here|exist)\b`),
	regexp.MustCompile(`(?i)\bno reason to (?:live|go on)\b`),
	regexp.MustCompile(`(?i)\bbetter off (?:dead|without me)\b`),
	// "suicidal" is nearly always self-referential; a bare "suicide" is not —
	// it is also a film, a chess opening and a news headline. Require intent.
	regexp.MustCompile(`(?i)\bsuicidal\b`),
	regexp.MustCompile(`(?i)\b(?:commit|committing|attempt(?:ing|ed)?)\s+suicide\b`),
	regexp.MustCompile(`(?i)\bsuicide\s+(?:thoughts|ideation|note|plan)\b`),
	regexp.MustCompile(`(?i)\bhurt(?:ing)? my ?self\b`),
	regexp.MustCompile(`(?i)\bself[- ]harm\b`),
	regexp.MustCompile(`(?i)\bcut(?:ting)? my ?self\b`),
	regexp.MustCompile(`(?i)\b(?:everyone|they'?d) (?:would )?be (?:happier|better) without me\b`),
	regexp.MustCompile(`(?i)\bcan'?t (?:do this|take (?:it|this)) any ?more\b`),
	regexp.MustCompile(`(?i)\bgive up on life\b`),
}

// Result is the outcome of a check.
type Result struct {
	// Flagged is true when the text matched a crisis pattern.
	Flagged bool
	// Pattern is the matched text, stored on the flag row for the reviewer.
	Pattern string
	// Card is non-nil when Flagged, and is returned to the author alongside a
	// successful response.
	Card *SupportCard
}

// Check tests text for crisis language.
//
// The post always succeeds; a match adds a card and a review flag. This runs on
// posts, comments, messages and whispers.
func Check(text string) Result {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return Result{}
	}

	for _, p := range crisisPatterns {
		if match := p.FindString(trimmed); match != "" {
			c := card
			return Result{Flagged: true, Pattern: match, Card: &c}
		}
	}
	return Result{}
}

// Card returns the support card, for surfaces that want to show it on request
// (a "get help" menu item, for instance) rather than on a match.
func Card() SupportCard { return card }
