package realtime

import (
	"sync"
)

// Hub tracks live connections per user inside this process. Fanout itself goes
// through the Bus; the hub exists so we know whether a user has any socket at
// all (presence, and "should we send a push instead") and so a signed-out user's
// sockets can be closed immediately.
type Hub struct {
	mu    sync.RWMutex
	conns map[string]map[*Conn]struct{} // userID -> set of connections
}

// NewHub returns an empty hub.
func NewHub() *Hub {
	return &Hub{conns: map[string]map[*Conn]struct{}{}}
}

// Add registers a connection and reports whether this is the user's first one,
// which is the transition worth broadcasting as "came online".
func (h *Hub) Add(c *Conn) (first bool) {
	h.mu.Lock()
	defer h.mu.Unlock()

	set, ok := h.conns[c.UserID]
	if !ok {
		set = map[*Conn]struct{}{}
		h.conns[c.UserID] = set
	}
	first = len(set) == 0
	set[c] = struct{}{}
	return first
}

// Remove deregisters a connection and reports whether the user has none left.
func (h *Hub) Remove(c *Conn) (last bool) {
	h.mu.Lock()
	defer h.mu.Unlock()

	set, ok := h.conns[c.UserID]
	if !ok {
		return true
	}
	delete(set, c)
	if len(set) == 0 {
		delete(h.conns, c.UserID)
		return true
	}
	return false
}

// IsOnline reports whether the user has a socket on this process.
func (h *Hub) IsOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.conns[userID]) > 0
}

// ConnectionCount is the total number of live sockets, for the metrics endpoint.
func (h *Hub) ConnectionCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	n := 0
	for _, set := range h.conns {
		n += len(set)
	}
	return n
}

// UserCount is the number of distinct users connected here.
func (h *Hub) UserCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.conns)
}

// CloseUser shuts every socket belonging to a user, e.g. on a ban or a
// sign-out-everywhere.
func (h *Hub) CloseUser(userID string) {
	h.mu.Lock()
	set := h.conns[userID]
	conns := make([]*Conn, 0, len(set))
	for c := range set {
		conns = append(conns, c)
	}
	h.mu.Unlock()

	for _, c := range conns {
		c.Close()
	}
}
