package realtime

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"github.com/aniketrathour/dronasphere/api/internal/auth"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
)

// Socket tuning. The write deadline is generous enough for a slow mobile
// connection and short enough that a dead socket is noticed.
const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxFrameBytes  = 4 << 10 // client frames are tiny; anything bigger is abuse
	sendBufferSize = 128
)

// Authorizer answers the only two questions the gateway asks the rest of the
// app: may this user listen here, and what should presence say.
type Authorizer interface {
	// CanSubscribe returns nil when userID may listen on channel.
	CanSubscribe(ctx context.Context, userID, channel string) error
	// Connected is called when a user's first socket opens.
	Connected(ctx context.Context, userID string) error
	// Disconnected is called when a user's last socket closes.
	Disconnected(ctx context.Context, userID string) error
	// TypingAllowed reports whether the user may emit a typing indicator in a
	// thread — indicators are toggleable per user (PRD 6.6).
	TypingAllowed(ctx context.Context, userID, threadID string) (bool, string, error)
}

// Conn is one client socket.
type Conn struct {
	UserID string
	Handle string

	ws   *websocket.Conn
	send chan Event
	sub  Subscription
	log  *slog.Logger

	closeOnce sync.Once
	done      chan struct{}
}

// Close tears the socket down once, whoever gets there first.
func (c *Conn) Close() {
	c.closeOnce.Do(func() {
		close(c.done)
		_ = c.ws.Close()
		if c.sub != nil {
			_ = c.sub.Close()
		}
	})
}

// Gateway upgrades HTTP requests into live sockets.
type Gateway struct {
	bus      Bus
	auth     Authorizer
	hub      *Hub
	log      *slog.Logger
	upgrader websocket.Upgrader
}

// NewGateway wires a gateway. allowedOrigins is checked on the upgrade, because
// a WebSocket is not covered by CORS.
func NewGateway(bus Bus, authorizer Authorizer, hub *Hub, log *slog.Logger, allowedOrigins []string) *Gateway {
	allowSet := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowSet[strings.TrimRight(strings.TrimSpace(o), "/")] = true
	}

	return &Gateway{
		bus:  bus,
		auth: authorizer,
		hub:  hub,
		log:  log,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 4096,
			// Same-origin policy for the socket. A missing Origin header is a
			// non-browser client (a mobile app, a test) and is allowed through;
			// the bearer token is what actually authenticates it.
			CheckOrigin: func(r *http.Request) bool {
				origin := strings.TrimRight(r.Header.Get("Origin"), "/")
				if origin == "" {
					return true
				}
				return allowSet[origin]
			},
		},
	}
}

// Hub exposes the connection registry.
func (g *Gateway) Hub() *Hub { return g.hub }

// Handle upgrades the request and runs the socket until it closes. It must sit
// behind auth.RequireAuth, which accepts ?token= for WebSocket upgrades.
func (g *Gateway) Handle(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	// A half-onboarded account has no feed and no threads to listen to.
	if !actor.IsOnboarded() {
		return httpx.OnboardingIncomplete(string(actor.OnboardingStep))
	}

	// Every socket starts subscribed to its own user channel.
	sub, err := g.bus.Subscribe(r.Context(), UserChannel(actor.UserID))
	if err != nil {
		return httpx.Internal("could not open the live connection").WithCause(err)
	}

	ws, err := g.upgrader.Upgrade(w, r, nil)
	if err != nil {
		_ = sub.Close()
		// Upgrade already wrote a response; do not write another.
		g.log.WarnContext(r.Context(), "websocket upgrade failed", "error", err)
		return nil
	}

	conn := &Conn{
		UserID: actor.UserID,
		Handle: actor.Handle,
		ws:     ws,
		send:   make(chan Event, sendBufferSize),
		sub:    sub,
		log:    g.log,
		done:   make(chan struct{}),
	}

	if first := g.hub.Add(conn); first {
		if err := g.auth.Connected(r.Context(), actor.UserID); err != nil {
			g.log.WarnContext(r.Context(), "presence on connect failed", "error", err, "user", actor.UserID)
		}
	}

	g.log.InfoContext(r.Context(), "socket open",
		"user", actor.UserID, "handle", actor.Handle, "connections", g.hub.ConnectionCount())

	// The socket outlives the request context, so give the pumps their own.
	ctx, cancel := context.WithCancel(context.WithoutCancel(r.Context()))

	var wg sync.WaitGroup
	wg.Add(3)
	go func() { defer wg.Done(); g.fanIn(ctx, conn) }()
	go func() { defer wg.Done(); g.writePump(conn) }()
	go func() { defer wg.Done(); g.readPump(ctx, conn) }()

	wg.Wait()
	cancel()
	conn.Close()

	if last := g.hub.Remove(conn); last {
		// Best effort: the request context is gone by now.
		bg, bgCancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
		if err := g.auth.Disconnected(bg, actor.UserID); err != nil {
			g.log.Warn("presence on disconnect failed", "error", err, "user", actor.UserID)
		}
		bgCancel()
	}

	g.log.Info("socket closed", "user", actor.UserID, "connections", g.hub.ConnectionCount())
	return nil
}

// fanIn moves bus events onto the connection's send queue.
func (g *Gateway) fanIn(ctx context.Context, c *Conn) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-c.done:
			return
		case ev, ok := <-c.sub.Events():
			if !ok {
				return
			}
			select {
			case c.send <- ev:
			case <-c.done:
				return
			default:
				// The client is not draining. Dropping a frame is better than
				// stalling the bus; the client re-syncs over REST on reconnect.
				g.log.Warn("dropping event for slow socket", "user", c.UserID, "type", ev.Type)
			}
		}
	}
}

// writePump serialises everything that goes out, including pings. Exactly one
// goroutine may write to a websocket.Conn, and this is it.
func (g *Gateway) writePump(c *Conn) {
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()

	for {
		select {
		case <-c.done:
			return

		case ev := <-c.send:
			_ = c.ws.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.ws.WriteJSON(ev); err != nil {
				if !isNormalClose(err) {
					g.log.Debug("socket write failed", "error", err, "user", c.UserID)
				}
				c.Close()
				return
			}

		case <-ticker.C:
			_ = c.ws.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				c.Close()
				return
			}
		}
	}
}

// readPump handles client frames: subscribe, unsubscribe, typing, ping.
func (g *Gateway) readPump(ctx context.Context, c *Conn) {
	defer c.Close()

	c.ws.SetReadLimit(maxFrameBytes)
	_ = c.ws.SetReadDeadline(time.Now().Add(pongWait))
	c.ws.SetPongHandler(func(string) error {
		return c.ws.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		var frame ClientFrame
		if err := c.ws.ReadJSON(&frame); err != nil {
			if !isNormalClose(err) {
				g.log.Debug("socket read ended", "error", err, "user", c.UserID)
			}
			return
		}

		switch frame.Type {
		case FrameSubscribe:
			g.handleSubscribe(ctx, c, frame)
		case FrameUnsubscribe:
			channel := frame.Channel
			if channel == "" && frame.ThreadID != "" {
				channel = ThreadChannel(frame.ThreadID)
			}
			if channel != "" {
				_ = c.sub.Remove(ctx, channel)
			}
		case FrameTyping:
			g.handleTyping(ctx, c, frame)
		case FramePing:
			g.enqueue(c, Event{Type: EventPong, At: time.Now().UTC()})
		default:
			g.sendError(c, "unknown frame type: "+frame.Type, "")
		}
	}
}

func (g *Gateway) handleSubscribe(ctx context.Context, c *Conn, frame ClientFrame) {
	channel := frame.Channel
	if channel == "" && frame.ThreadID != "" {
		channel = ThreadChannel(frame.ThreadID)
	}
	if channel == "" {
		g.sendError(c, "subscribe needs a channel", "")
		return
	}
	if _, _, ok := SplitChannel(channel); !ok {
		g.sendError(c, "that channel name is not valid", channel)
		return
	}

	// Authorisation happens here, on the server, every time. A client asking to
	// listen to a thread it is not in gets nothing.
	if err := g.auth.CanSubscribe(ctx, c.UserID, channel); err != nil {
		g.sendError(c, "you cannot listen to that channel", channel)
		return
	}
	if err := c.sub.Add(ctx, channel); err != nil {
		g.sendError(c, "could not subscribe, try again", channel)
		return
	}
}

func (g *Gateway) handleTyping(ctx context.Context, c *Conn, frame ClientFrame) {
	if frame.ThreadID == "" {
		return
	}
	allowed, handle, err := g.auth.TypingAllowed(ctx, c.UserID, frame.ThreadID)
	if err != nil || !allowed {
		return
	}
	if handle == "" {
		handle = c.Handle
	}

	ev, err := NewEvent(EventTyping, ThreadChannel(frame.ThreadID), TypingPayload{
		ThreadID: frame.ThreadID,
		UserID:   c.UserID,
		Handle:   handle,
		Typing:   frame.Typing,
	})
	if err != nil {
		return
	}
	if err := g.bus.Publish(ctx, ev); err != nil {
		g.log.Warn("publish typing failed", "error", err)
	}
}

func (g *Gateway) sendError(c *Conn, message, channel string) {
	ev, err := NewEvent(EventError, channel, ErrorPayload{Message: message, Channel: channel})
	if err != nil {
		return
	}
	g.enqueue(c, ev)
}

func (g *Gateway) enqueue(c *Conn, ev Event) {
	select {
	case c.send <- ev:
	case <-c.done:
	default:
	}
}

func isNormalClose(err error) bool {
	if err == nil {
		return true
	}
	if websocket.IsCloseError(err,
		websocket.CloseNormalClosure,
		websocket.CloseGoingAway,
		websocket.CloseNoStatusReceived,
		websocket.CloseAbnormalClosure,
	) {
		return true
	}
	return errors.Is(err, context.Canceled)
}
