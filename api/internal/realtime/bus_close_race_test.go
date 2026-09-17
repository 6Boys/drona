package realtime

import (
	"context"
	"sync"
	"testing"
)

// A subscription closing while a publish to one of its channels is in flight is
// the ordinary case, not an exotic one: it happens on every WebSocket
// disconnect. This used to panic with "send on closed channel" from the
// publisher's goroutine — which is not an HTTP handler, so the recover
// middleware never saw it and the whole process went down.
func TestMemoryBusPublishDuringClose(t *testing.T) {
	const rounds = 3000

	for i := 0; i < rounds; i++ {
		bus := NewMemoryBus()
		sub, err := bus.Subscribe(context.Background(), "thread:1")
		if err != nil {
			t.Fatalf("subscribe: %v", err)
		}

		var wg sync.WaitGroup
		wg.Add(2)

		go func() {
			defer wg.Done()
			_ = bus.Publish(context.Background(), Event{Channel: "thread:1", Type: "message.new"})
		}()
		go func() {
			defer wg.Done()
			_ = sub.Close()
		}()

		wg.Wait()
	}
}

// Closing twice must stay safe, and delivery after close must be a no-op rather
// than a panic.
func TestMemorySubscriptionCloseIsIdempotent(t *testing.T) {
	bus := NewMemoryBus()
	sub, err := bus.Subscribe(context.Background(), "user:1")
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}

	if err := sub.Close(); err != nil {
		t.Fatalf("first close: %v", err)
	}
	if err := sub.Close(); err != nil {
		t.Fatalf("second close: %v", err)
	}

	// Publishing to a closed subscription still in flight somewhere must not
	// panic, even though the bus has already forgotten it.
	if err := bus.Publish(context.Background(), Event{Channel: "user:1", Type: "noop"}); err != nil {
		t.Fatalf("publish after close: %v", err)
	}

	if _, ok := <-sub.Events(); ok {
		t.Fatal("expected the events channel to be closed")
	}
}
