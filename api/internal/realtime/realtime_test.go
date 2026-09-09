package realtime

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelNames(t *testing.T) {
	assert.Equal(t, "user:abc", UserChannel("abc"))
	assert.Equal(t, "thread:t1", ThreadChannel("t1"))
	assert.Equal(t, "space:s1", SpaceChannel("s1"))
	assert.Equal(t, "owl:c1", OwlChannel("c1"))
}

func TestSplitChannel(t *testing.T) {
	tests := []struct {
		in       string
		kind, id string
		ok       bool
	}{
		{in: "user:abc", kind: "user", id: "abc", ok: true},
		{in: "thread:uuid-with-dashes", kind: "thread", id: "uuid-with-dashes", ok: true},
		// An id containing a colon stays intact, which matters for the batch
		// board key campusId:batch.
		{in: "owl:campus:2024-28", kind: "owl", id: "campus:2024-28", ok: true},
		{in: "nocolon", ok: false},
		{in: ":no-kind", ok: false},
		{in: "no-id:", ok: false},
		{in: "", ok: false},
	}

	for _, tc := range tests {
		t.Run(tc.in, func(t *testing.T) {
			kind, id, ok := SplitChannel(tc.in)
			assert.Equal(t, tc.ok, ok)
			if tc.ok {
				assert.Equal(t, tc.kind, kind)
				assert.Equal(t, tc.id, id)
			}
		})
	}
}

func TestNewEvent(t *testing.T) {
	ev, err := NewEvent(EventMessageNew, ThreadChannel("t1"), map[string]string{"body": "hi"})
	require.NoError(t, err)

	assert.Equal(t, EventMessageNew, ev.Type)
	assert.Equal(t, "thread:t1", ev.Channel)
	assert.False(t, ev.At.IsZero())

	var payload map[string]string
	require.NoError(t, json.Unmarshal(ev.Payload, &payload))
	assert.Equal(t, "hi", payload["body"])

	t.Run("a nil payload is omitted, not encoded as null", func(t *testing.T) {
		ev, err := NewEvent(EventPong, "", nil)
		require.NoError(t, err)
		assert.Nil(t, ev.Payload)

		raw, err := json.Marshal(ev)
		require.NoError(t, err)
		assert.NotContains(t, string(raw), "payload")
	})

	t.Run("an unencodable payload is an error, not a panic", func(t *testing.T) {
		_, err := NewEvent(EventMessageNew, "thread:x", map[string]any{"fn": func() {}})
		assert.Error(t, err)
	})
}

func TestMemoryBus_DeliversOnlyToSubscribedChannels(t *testing.T) {
	bus := NewMemoryBus()
	defer bus.Close()
	ctx := context.Background()

	sub, err := bus.Subscribe(ctx, "thread:t1")
	require.NoError(t, err)
	defer sub.Close()

	wanted, _ := NewEvent(EventMessageNew, "thread:t1", map[string]string{"id": "m1"})
	unwanted, _ := NewEvent(EventMessageNew, "thread:other", map[string]string{"id": "m2"})

	require.NoError(t, bus.Publish(ctx, unwanted))
	require.NoError(t, bus.Publish(ctx, wanted))

	select {
	case got := <-sub.Events():
		assert.Equal(t, "thread:t1", got.Channel, "the other thread's event must not arrive")
		var p map[string]string
		require.NoError(t, json.Unmarshal(got.Payload, &p))
		assert.Equal(t, "m1", p["id"])
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for the event")
	}
}

func TestMemoryBus_FansOutToEverySubscriber(t *testing.T) {
	bus := NewMemoryBus()
	defer bus.Close()
	ctx := context.Background()

	const subscribers = 5
	subs := make([]Subscription, subscribers)
	for i := range subs {
		s, err := bus.Subscribe(ctx, "thread:t1")
		require.NoError(t, err)
		subs[i] = s
		defer s.Close()
	}

	ev, _ := NewEvent(EventMessageNew, "thread:t1", nil)
	require.NoError(t, bus.Publish(ctx, ev))

	var wg sync.WaitGroup
	for i, s := range subs {
		wg.Add(1)
		go func(i int, s Subscription) {
			defer wg.Done()
			select {
			case <-s.Events():
			case <-time.After(2 * time.Second):
				t.Errorf("subscriber %d never received the event", i)
			}
		}(i, s)
	}
	wg.Wait()
}

func TestMemoryBus_AddAndRemoveChannelsWhileRunning(t *testing.T) {
	// This is what happens when a user opens a chat: the live socket subscribes
	// to a new thread without reconnecting.
	bus := NewMemoryBus()
	defer bus.Close()
	ctx := context.Background()

	sub, err := bus.Subscribe(ctx, "user:u1")
	require.NoError(t, err)
	defer sub.Close()

	ev, _ := NewEvent(EventMessageNew, "thread:t1", nil)
	require.NoError(t, bus.Publish(ctx, ev))
	assertNoEvent(t, sub, "not subscribed yet")

	require.NoError(t, sub.Add(ctx, "thread:t1"))
	require.NoError(t, bus.Publish(ctx, ev))
	assertEvent(t, sub, "thread:t1")

	require.NoError(t, sub.Remove(ctx, "thread:t1"))
	require.NoError(t, bus.Publish(ctx, ev))
	assertNoEvent(t, sub, "unsubscribed again")
}

func TestMemoryBus_ClosedSubscriptionStopsReceiving(t *testing.T) {
	bus := NewMemoryBus()
	ctx := context.Background()

	sub, err := bus.Subscribe(ctx, "user:u1")
	require.NoError(t, err)
	require.NoError(t, sub.Close())

	// Publishing after a close must not panic on a closed channel.
	ev, _ := NewEvent(EventFollow, "user:u1", nil)
	assert.NoError(t, bus.Publish(ctx, ev))

	assert.ErrorIs(t, sub.Add(ctx, "thread:t1"), ErrBusClosed)
	assert.NoError(t, sub.Close(), "close is idempotent")
}

func TestMemoryBus_SlowSubscriberDoesNotBlockThePublisher(t *testing.T) {
	// A tab that stopped draining must not stall everyone else's chat.
	bus := NewMemoryBus()
	defer bus.Close()
	ctx := context.Background()

	slow, err := bus.Subscribe(ctx, "thread:t1")
	require.NoError(t, err)
	defer slow.Close()

	ev, _ := NewEvent(EventMessageNew, "thread:t1", nil)

	done := make(chan struct{})
	go func() {
		defer close(done)
		// Far more than the 64-event buffer.
		for range 500 {
			_ = bus.Publish(ctx, ev)
		}
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("publishing blocked on a subscriber that was not reading")
	}
}

func TestHub(t *testing.T) {
	hub := NewHub()

	a1 := &Conn{UserID: "u1"}
	a2 := &Conn{UserID: "u1"}
	b1 := &Conn{UserID: "u2"}

	assert.True(t, hub.Add(a1), "the first connection for a user is the online transition")
	assert.False(t, hub.Add(a2), "a second tab is not a new arrival")
	assert.True(t, hub.Add(b1))

	assert.True(t, hub.IsOnline("u1"))
	assert.True(t, hub.IsOnline("u2"))
	assert.False(t, hub.IsOnline("nobody"))
	assert.Equal(t, 3, hub.ConnectionCount())
	assert.Equal(t, 2, hub.UserCount())

	assert.False(t, hub.Remove(a1), "one tab left, still online")
	assert.True(t, hub.IsOnline("u1"))

	assert.True(t, hub.Remove(a2), "the last one going is the offline transition")
	assert.False(t, hub.IsOnline("u1"))
	assert.Equal(t, 1, hub.ConnectionCount())
	assert.Equal(t, 1, hub.UserCount())

	assert.True(t, hub.Remove(&Conn{UserID: "never-added"}), "removing an unknown connection is safe")
}

func TestHub_ConcurrentAddRemoveIsRaceFree(t *testing.T) {
	// Run with -race; this is the real assertion.
	hub := NewHub()
	var wg sync.WaitGroup

	for i := range 50 {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			c := &Conn{UserID: "u" + string(rune('a'+i%5))}
			hub.Add(c)
			hub.IsOnline(c.UserID)
			hub.ConnectionCount()
			hub.Remove(c)
		}(i)
	}
	wg.Wait()

	assert.Equal(t, 0, hub.ConnectionCount())
	assert.Equal(t, 0, hub.UserCount())
}

func assertEvent(t *testing.T, sub Subscription, wantChannel string) {
	t.Helper()
	select {
	case got := <-sub.Events():
		assert.Equal(t, wantChannel, got.Channel)
	case <-time.After(time.Second):
		t.Fatalf("expected an event on %s", wantChannel)
	}
}

func assertNoEvent(t *testing.T, sub Subscription, why string) {
	t.Helper()
	select {
	case got := <-sub.Events():
		t.Fatalf("unexpected event on %s (%s)", got.Channel, why)
	case <-time.After(100 * time.Millisecond):
	}
}
