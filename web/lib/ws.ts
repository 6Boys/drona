"use client";

import { useEffect, useRef } from "react";
import { API_WS_URL, getAccessToken } from "./api";
import type { LiveEvent } from "./types";

type Handler = (event: LiveEvent) => void;

// One socket for the whole tab. Every surface that wants live updates attaches
// a handler to it rather than opening its own connection — the gateway counts
// connections per user, and a chat tab plus a feed tab plus an owl widget each
// dialling separately is three times the fanout for no benefit.
let socket: WebSocket | null = null;
let connecting = false;
let backoff = 1000;
const handlers = new Set<Handler>();
// Channel -> how many mounted components asked for it. Sidebar, NotificationBell
// and ThreadList all want the same `user:<id>` feed, so a plain set would let
// whichever unmounts first unsubscribe the channel out from under the others —
// and since the set is also what a reconnect replays, they'd never get it back.
const channels = new Map<string, number>();

function send(frame: Record<string, unknown>) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
}

function connect() {
  if (typeof window === "undefined" || connecting) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  const token = getAccessToken();
  if (!token) return;

  connecting = true;
  const ws = new WebSocket(`${API_WS_URL}?token=${encodeURIComponent(token)}`);
  socket = ws;

  ws.onopen = () => {
    connecting = false;
    backoff = 1000;
    for (const channel of channels.keys()) send({ type: "subscribe", channel });
  };

  ws.onmessage = (raw) => {
    let event: LiveEvent;
    try {
      event = JSON.parse(raw.data as string);
    } catch {
      return;
    }
    for (const handler of handlers) handler(event);
  };

  ws.onclose = () => {
    connecting = false;
    socket = null;
    if (handlers.size === 0) return;
    const delay = backoff;
    backoff = Math.min(backoff * 2, 30_000);
    setTimeout(connect, delay);
  };

  ws.onerror = () => ws.close();
}

export function sendTyping(threadId: string, typing: boolean) {
  send({ type: "typing", threadId, typing });
}

/**
 * Subscribes to live channels for as long as the component is mounted.
 * `channelList` is re-read on every render, so pass a stable array (or a
 * memoised one) when the set of channels is derived.
 */
export function useLive(channelList: string[], onEvent: Handler, enabled = true) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const key = channelList.join("|");

  useEffect(() => {
    if (!enabled || !key) return;

    const handler: Handler = (event) => handlerRef.current(event);
    handlers.add(handler);

    const mine = key.split("|");
    for (const channel of mine) {
      const next = (channels.get(channel) ?? 0) + 1;
      channels.set(channel, next);
      if (next === 1) send({ type: "subscribe", channel });
    }
    connect();

    return () => {
      handlers.delete(handler);
      for (const channel of mine) {
        const next = (channels.get(channel) ?? 1) - 1;
        if (next > 0) {
          channels.set(channel, next);
          continue;
        }
        channels.delete(channel);
        send({ type: "unsubscribe", channel });
      }
      if (handlers.size === 0) {
        socket?.close();
        socket = null;
      }
    };
  }, [key, enabled]);
}

export const channelFor = {
  thread: (id: string) => `thread:${id}`,
  user: (id: string) => `user:${id}`,
  space: (id: string) => `space:${id}`,
  owl: (campusId: string) => `owl:${campusId}`,
};
