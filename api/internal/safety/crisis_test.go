package safety

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheck_FlagsCrisisLanguage(t *testing.T) {
	// Phrasings a stressed student actually writes at 2 AM.
	flagged := []string{
		"i want to die",
		"honestly i just want to die, this sem is too much",
		"i can't do this anymore",
		"cant take it anymore",
		"thinking about ending it all",
		"i don't want to live",
		"dont want to be here",
		"everyone would be better without me",
		"i'm better off dead",
		"been having suicidal thoughts",
		"i feel suicidal",
		"thought about committing suicide",
		"i keep killing myself in my head",
		"kms",
		"no reason to live",
		"i've been hurting myself",
		"self-harm is the only thing that helps",
		"cutting myself again",
		"I WANT TO DIE",
		"i want to DIE!!!",
	}

	for _, text := range flagged {
		t.Run(text[:min(len(text), 30)], func(t *testing.T) {
			got := Check(text)
			assert.True(t, got.Flagged, "should flag: %q", text)
			assert.NotEmpty(t, got.Pattern, "the matched text is stored for the reviewer")
			require.NotNil(t, got.Card)
		})
	}
}

func TestCheck_DoesNotFlagOrdinaryExamSeasonHyperbole(t *testing.T) {
	// Casting too wide a net trains people to dismiss the card, which costs it
	// its meaning when it matters.
	clean := []string{
		"",
		"   ",
		"this exam is going to kill me",
		"i'm dying at the amount of syllabus left",
		"dead tired after that lab",
		"i'm dead 💀",
		"that meme killed me",
		"the mess food is killing us slowly",
		"i died laughing",
		"my laptop died mid-submission",
		"deadline is tomorrow and i'm cooked",
		"COA mid-sem: how cooked are we",
		"this assignment is the death of me",
		"i can't do this DP problem",
		"i want to sleep for a week",
		"suicide squad was a bad movie",
		"we read about the suicide rate in stats class",
		"my king is in a suicide position lol",
	}

	for _, text := range clean {
		t.Run(text, func(t *testing.T) {
			assert.False(t, Check(text).Flagged, "should not flag: %q", text)
		})
	}
}

func TestSupportCard_ListsWorkingIndianHelplines(t *testing.T) {
	card := Card()

	require.Len(t, card.Helplines, 3)

	numbers := map[string]bool{}
	for _, h := range card.Helplines {
		numbers[h.Number] = true
		assert.NotEmpty(t, h.Name)
		assert.NotEmpty(t, h.Description)
		assert.NotEmpty(t, h.Hours, "someone in crisis needs to know if the line is open")
	}

	// Named explicitly in PRD 10.
	assert.True(t, numbers["14416"], "Tele-MANAS")
	assert.True(t, numbers["9152987821"], "iCall")
}

// PRD 8: consent, safety, reporting, age-gate and privacy copy stays completely
// plain and literal. Cuteness there reads as manipulation.
func TestSupportCard_CopyIsPlainNotCute(t *testing.T) {
	card := Card()
	text := card.Title + " " + card.Body

	for _, forbidden := range []string{"Dronu", "🦉", "✨", "oops", "!", "hehe", "🫶", "cozy"} {
		assert.NotContains(t, text, forbidden,
			"a support card must not read as playful: found %q", forbidden)
	}

	assert.Contains(t, strings.ToLower(text), "support")
	assert.Contains(t, card.Body, "not removed",
		"the author needs to know their post was not silenced")
}

func TestCheck_TheCardIsACopyNotTheSharedValue(t *testing.T) {
	first := Check("i want to die")
	require.NotNil(t, first.Card)

	first.Card.Body = "mutated"

	second := Check("i want to die")
	require.NotNil(t, second.Card)
	assert.NotEqual(t, "mutated", second.Card.Body, "one caller must not be able to corrupt the card for everyone")
}
