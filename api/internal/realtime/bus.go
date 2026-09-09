package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"

	"github.com/redis/go-redis/v9"
)

// ErrBusClosed is returned once a subscription has been closed.
var ErrBusClosed = errors.New("bus subscription is closed")

// Bus is the fanout contract. Two implementations: Redis for real deployments,
// memory for tests and single-process development.
type Bus interface {
	Publish(ctx context.Context, ev Event) error
	Subscribe(ctx context.Context, channels ...string) (Subscription, error)
	Close() error
}

// Subscription is one listener's view of the bus. Channels can be added and
// removed while it is running, which is how a client subscribes to a thread it
// just opened.
type Subscription interface {
	Events() <-chan Event
	Add(ctx context.Context, channels ...string) error
	Remove(ctx context.Context, channels ...string) error
	Close() error
}

// ------------------------------------------------------------------- redis ----

// RedisBus fans out over Redis pub/sub.
type RedisBus struct {
	client *redis.Client
	log    *slog.Logger
	prefix string
}

// NewRedisBus builds a bus over an existing client.
func NewRedisBus(client *redis.Client, log *slog.Logger) *RedisBus {
	return &RedisBus{client: client, log: log, prefix: "rt:"}
}

// Publish sends an event to every subscriber of its channel, in this process
// and every other one.
func (b *RedisBus) Publish(ctx context.Context, ev Event) error {
	raw, err := json.Marshal(ev)
	if err != nil {
		return fmt.Errorf("encode event: %w", err)
	}
	if err := b.client.Publish(ctx, b.prefix+ev.Channel, raw).Err(); err != nil {
		return fmt.Errorf("publish %s: %w", ev.Channel, err)
	}
	return nil
}

// Subscribe opens a subscription on the given channels.
func (b *RedisBus) Subscribe(ctx context.Context, channels ...string) (Subscription, error) {
	prefixed := make([]string, len(channels))
	for i, c := range channels {
		prefixed[i] = b.prefix + c
	}

	pubsub := b.client.Subscribe(ctx, prefixed...)
	// Wait for the subscription to be confirmed, so a Publish immediately after
	// Subscribe is not silently dropped.
	if _, err := pubsub.Receive(ctx); err != nil {
		_ = pubsub.Close()
		return nil, fmt.Errorf("subscribe: %w", err)
	}

	sub := &redisSubscription{
		pubsub: pubsub,
		out:    make(chan Event, 64),
		done:   make(chan struct{}),
		bus:    b,
	}
	go sub.pump()
	return sub, nil
}

// Close is a no-op: the bus does not own the client.
func (b *RedisBus) Close() error { return nil }

type redisSubscription struct {
	pubsub    *redis.PubSub
	out       chan Event
	done      chan struct{}
	closeOnce sync.Once
	bus       *RedisBus
}

func (s *redisSubscription) pump() {
	defer close(s.out)
	ch := s.pubsub.Channel()
	for {
		select {
		case <-s.done:
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			var ev Event
			if err := json.Unmarshal([]byte(msg.Payload), &ev); err != nil {
				s.bus.log.Warn("dropping malformed realtime event", "error", err, "channel", msg.Channel)
				continue
			}
			select {
			case s.out <- ev:
			case <-s.done:
				return
			default:
				// A subscriber that cannot keep up is dropped from this event
				// rather than blocking every other subscriber behind it.
				s.bus.log.Warn("realtime subscriber is slow, dropping event",
					"channel", ev.Channel, "type", ev.Type)
			}
		}
	}
}

func (s *redisSubscription) Events() <-chan Event { return s.out }

func (s *redisSubscription) Add(ctx context.Context, channels ...string) error {
	if len(channels) == 0 {
		return nil
	}
	prefixed := make([]string, len(channels))
	for i, c := range channels {
		prefixed[i] = s.bus.prefix + c
	}
	return s.pubsub.Subscribe(ctx, prefixed...)
}

func (s *redisSubscription) Remove(ctx context.Context, channels ...string) error {
	if len(channels) == 0 {
		return nil
	}
	prefixed := make([]string, len(channels))
	for i, c := range channels {
		prefixed[i] = s.bus.prefix + c
	}
	return s.pubsub.Unsubscribe(ctx, prefixed...)
}

func (s *redisSubscription) Close() error {
	s.closeOnce.Do(func() { close(s.done) })
	return s.pubsub.Close()
}

// ------------------------------------------------------------------ memory ----

// MemoryBus is an in-process bus. It exists so the realtime layer can be tested
// without Redis, and so a single-process local run needs one fewer service.
type MemoryBus struct {
	mu   sync.RWMutex
	subs map[*memorySubscription]struct{}
}

// NewMemoryBus returns an in-process bus.
func NewMemoryBus() *MemoryBus {
	return &MemoryBus{subs: map[*memorySubscription]struct{}{}}
}

// Publish delivers to every matching subscription in this process.
func (b *MemoryBus) Publish(_ context.Context, ev Event) error {
	b.mu.RLock()
	targets := make([]*memorySubscription, 0, len(b.subs))
	for s := range b.subs {
		if s.listening(ev.Channel) {
			targets = append(targets, s)
		}
	}
	b.mu.RUnlock()

	for _, s := range targets {
		s.deliver(ev)
	}
	return nil
}

// Subscribe opens an in-process subscription.
func (b *MemoryBus) Subscribe(_ context.Context, channels ...string) (Subscription, error) {
	sub := &memorySubscription{
		bus:      b,
		channels: map[string]struct{}{},
		out:      make(chan Event, 64),
		done:     make(chan struct{}),
	}
	for _, c := range channels {
		sub.channels[c] = struct{}{}
	}

	b.mu.Lock()
	b.subs[sub] = struct{}{}
	b.mu.Unlock()
	return sub, nil
}

// Close drops every subscription.
func (b *MemoryBus) Close() error {
	b.mu.Lock()
	subs := make([]*memorySubscription, 0, len(b.subs))
	for s := range b.subs {
		subs = append(subs, s)
	}
	b.subs = map[*memorySubscription]struct{}{}
	b.mu.Unlock()

	for _, s := range subs {
		_ = s.Close()
	}
	return nil
}

type memorySubscription struct {
	bus       *MemoryBus
	mu        sync.RWMutex
	channels  map[string]struct{}
	out       chan Event
	done      chan struct{}
	closeOnce sync.Once
}

func (s *memorySubscription) listening(channel string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.channels[channel]
	return ok
}

func (s *memorySubscription) deliver(ev Event) {
	select {
	case <-s.done:
	case s.out <- ev:
	default: // slow subscriber, drop rather than block the publisher
	}
}

func (s *memorySubscription) Events() <-chan Event { return s.out }

func (s *memorySubscription) Add(_ context.Context, channels ...string) error {
	select {
	case <-s.done:
		return ErrBusClosed
	default:
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range channels {
		s.channels[c] = struct{}{}
	}
	return nil
}

func (s *memorySubscription) Remove(_ context.Context, channels ...string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range channels {
		delete(s.channels, c)
	}
	return nil
}

func (s *memorySubscription) Close() error {
	s.closeOnce.Do(func() {
		close(s.done)
		s.bus.mu.Lock()
		delete(s.bus.subs, s)
		s.bus.mu.Unlock()
		close(s.out)
	})
	return nil
}
