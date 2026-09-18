"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import {
  BookIcon,
  CompassIcon,
  HeartIcon,
  HomeIcon,
  MessageIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/ui/Icons";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import type { Items, Space, User } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: typeof HomeIcon;
  run: () => void;
  group: string;
  avatar?: User;
}

/**
 * ⌘K / Ctrl-K. Navigation, space jumps and people search in one list, with
 * full keyboard control — the fastest way through the app once you know it.
 */
export function CommandPalette() {
  const router = useRouter();
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const spaces = useApi<Items<Space>>("/v1/spaces", undefined, open);
  const people = useApi<Items<User>>(
    "/v1/search/users",
    { q: query, limit: 6 },
    open && query.trim().length > 1,
  );

  // Global hotkey.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const go = useMemo(
    () => (href: string) => () => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = [
      { id: "feed", label: "The Nest", hint: "Campus feed", icon: HomeIcon, run: go("/feed"), group: "Go to" },
      { id: "spaces", label: "Spaces", hint: "Browse every space", icon: CompassIcon, run: go("/spaces"), group: "Go to" },
      { id: "chats", label: "Chats", hint: "DMs, Dens and Signals", icon: MessageIcon, run: go("/chats"), group: "Go to" },
      { id: "owl", label: "Night Shift", hint: "Night leaderboard", icon: MoonIcon, run: go("/owl-board"), group: "Go to" },
      { id: "notes", label: "Note Locker", hint: "PYQs and notes", icon: BookIcon, run: go("/notes"), group: "Go to" },
      { id: "saved", label: "Saved posts", hint: "Your bookmarks", icon: BookIcon, run: go("/saved"), group: "Go to" },
      { id: "dating", label: "Love Finder", hint: "Opt-in deck", icon: HeartIcon, run: go("/dating"), group: "Go to" },
      { id: "profile", label: "Your profile", icon: UserIcon, run: go("/me"), group: "Go to" },
      { id: "settings", label: "Settings", icon: SettingsIcon, run: go("/settings"), group: "Go to" },
    ];

    const actions: Command[] = [
      { id: "new-post", label: "New post", hint: "Write to the Nest", icon: PlusIcon, run: go("/feed?compose=1"), group: "Actions" },
      { id: "search", label: "Full search", hint: "People and spaces", icon: SearchIcon, run: go("/search"), group: "Actions" },
    ];

    const spaceCommands: Command[] = (spaces.data?.items ?? []).map((space) => ({
      id: `space-${space.id}`,
      label: space.name,
      hint: `#${space.slug}`,
      icon: CompassIcon,
      run: go(`/spaces/${space.slug}`),
      group: "Spaces",
    }));

    const peopleCommands: Command[] = (people.data?.items ?? []).map((user) => ({
      id: `user-${user.id}`,
      label: user.displayName,
      hint: `@${user.handle}`,
      icon: UserIcon,
      avatar: user,
      run: go(`/profile/${user.handle}`),
      group: "People",
    }));

    const all = [...nav, ...actions, ...spaceCommands, ...peopleCommands];
    const q = query.trim().toLowerCase();
    if (!q) return all;

    return all.filter((c) => `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(q));
  }, [go, spaces.data, people.data, query]);

  // Clamp the cursor whenever the result set shrinks under it.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, commands.length - 1)));
  }, [commands.length]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open || !me) return null;

  const grouped = commands.reduce<Record<string, Command[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  let index = -1;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 cursor-default bg-[rgb(22_21_15_/_0.3)] backdrop-blur-lg" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="glass glass-strong pop relative w-full max-w-xl overflow-hidden rounded-[var(--r-xl)]"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <SearchIcon size={17} className="shrink-0 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => (a + 1) % Math.max(1, commands.length));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => (a - 1 + commands.length) % Math.max(1, commands.length));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                commands[active]?.run();
              }
            }}
            placeholder="Jump to a page, space or person…"
            className="h-12 flex-1 bg-transparent text-sm text-text placeholder:text-faint focus:outline-none"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[0.625rem] text-faint sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[22rem] overflow-y-auto py-1.5">
          {!commands.length && (
            <p className="px-4 py-8 text-center text-sm text-faint">No matches for “{query}”.</p>
          )}

          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-1">
              <p className="mono-label px-4 pt-2 pb-1">{group}</p>
              {items.map((command) => {
                index += 1;
                const isActive = index === active;
                const position = index;
                const Icon = command.icon;

                return (
                  <button
                    key={command.id}
                    data-active={isActive}
                    onMouseEnter={() => setActive(position)}
                    onClick={command.run}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left transition-colors",
                      isActive ? "bg-accent-wash" : "hover:bg-surface",
                    )}
                  >
                    {command.avatar ? (
                      <Avatar user={command.avatar} size={22} />
                    ) : (
                      <Icon size={16} className={isActive ? "text-accent-hi" : "text-faint"} />
                    )}
                    <span className="flex-1 truncate text-[0.8125rem] text-text">{command.label}</span>
                    {command.hint && <span className="truncate text-xs text-faint">{command.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <footer className="flex items-center gap-4 border-t border-border px-4 py-2 text-[0.6875rem] text-faint">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1 font-mono">↑</kbd>
            <kbd className="rounded border border-border px-1 font-mono">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1 font-mono">↵</kbd>
            open
          </span>
        </footer>
      </div>
    </div>
  );
}
