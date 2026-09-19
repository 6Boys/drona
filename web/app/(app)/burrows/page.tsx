"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TimerIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useNight } from "@/lib/night-context";
import type { OwlGrant } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Room {
  id: string;
  name: string;
  focus: number;
  brk: number;
  note: string;
}

const POMODORO: Room = {
  id: "sem3",
  name: "Sem 3 Grind",
  focus: 25,
  brk: 5,
  note: "Classic pomodoro for problem sets.",
};

const ROOMS: Room[] = [
  { id: "quiet", name: "The Quiet One", focus: 50, brk: 10, note: "Long haul. One subject, no switching." },
  POMODORO,
  { id: "3am", name: "3 AM Club", focus: 25, brk: 5, note: "For the night window. Counts toward the board." },
];

export default function BurrowsPage() {
  const toast = useToast();
  const { status, refresh } = useNight();

  const [room, setRoom] = useState<Room>(POMODORO);
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [left, setLeft] = useState(POMODORO.focus * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);

  // Credited server-side, per completed focus block — the one way to earn owl
  // points without posting anything (PRD 7.3).
  const credit = useCallback(
    async (minutes: number) => {
      try {
        const grant = await api.post<OwlGrant>("/v1/owl/burrow", { minutes });
        refresh();
        toast(
          grant.points > 0
            ? `+${grant.points} owl points for ${minutes} minutes of focus`
            : `${minutes} minutes logged. Points resume when the night window opens.`,
          grant.points > 0 ? "success" : "info",
        );
      } catch (err) {
        toast(errorMessage(err, "could not log that session"), "error");
      }
    },
    [refresh, toast],
  );

  const creditRef = useRef(credit);
  creditRef.current = credit;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((prev) => {
        if (prev > 1) return prev - 1;

        // Block finished: credit focus time, then flip to the other phase.
        setPhase((current) => {
          if (current === "focus") {
            creditRef.current(room.focus);
            setCompleted((c) => c + 1);
            setLeft(room.brk * 60);
            return "break";
          }
          setLeft(room.focus * 60);
          return "focus";
        });
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, room]);

  const selectRoom = (next: Room) => {
    setRoom(next);
    setPhase("focus");
    setLeft(next.focus * 60);
    setRunning(false);
  };

  const total = (phase === "focus" ? room.focus : room.brk) * 60;
  const progress = total > 0 ? 1 - left / total : 0;
  const minutes = Math.floor(left / 60);
  const seconds = left % 60;

  return (
    <>
      <TopBar title="Study Burrows" subtitle="Timed focus blocks. Minutes here count on the Owl Board." />

      <PageBody width="md">
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <section
            className={cn(
              "relative flex flex-col items-center overflow-hidden rounded-[var(--r-lg)] border p-8",
              phase === "focus"
                ? "border-[color-mix(in_oklab,var(--accent)_35%,transparent)] bg-surface"
                : "border-border bg-surface",
            )}
          >
            {running && phase === "focus" && <div className="cone -top-52 left-1/2 h-80 w-80 -translate-x-1/2 opacity-30" />}

            <div className="relative flex items-center gap-2">
              <TimerIcon size={15} className={phase === "focus" ? "text-accent-hi" : "text-positive"} />
              <span className="mono-label">{phase === "focus" ? "focus block" : "break"}</span>
            </div>

            <p className="tabnum relative mt-5 font-mono text-[4.5rem] leading-none font-medium tracking-tight text-text">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </p>

            <div className="relative mt-6 h-1 w-full max-w-sm overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>

            <div className="relative mt-6 flex items-center gap-2">
              <Button size="lg" onClick={() => setRunning((r) => !r)}>
                {running ? "Pause" : left === total ? "Start burrow" : "Resume"}
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => {
                  setRunning(false);
                  setPhase("focus");
                  setLeft(room.focus * 60);
                }}
              >
                Reset
              </Button>
            </div>

            <p className="relative mt-5 text-xs text-faint">
              {completed > 0
                ? `${completed} block${completed === 1 ? "" : "s"} done this session.`
                : "Finish a block to bank the minutes."}
            </p>
          </section>

          <aside className="space-y-3">
            <div className="card p-4">
              <h2 className="mono-label mb-2.5">rooms</h2>
              <ul className="space-y-1.5">
                {ROOMS.map((option) => (
                  <li key={option.id}>
                    <button
                      onClick={() => selectRoom(option)}
                      className={cn(
                        "w-full cursor-pointer rounded-[var(--r-md)] border px-3 py-2.5 text-left transition-colors",
                        option.id === room.id
                          ? "border-accent bg-accent-wash"
                          : "border-border hover:border-border-strong",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[0.8125rem] font-medium text-text">{option.name}</span>
                        <span className="tabnum font-mono text-[0.6875rem] text-faint">
                          {option.focus}/{option.brk}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[0.6875rem] text-muted">{option.note}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-4">
              <h2 className="mono-label mb-2">tonight</h2>
              {status ? (
                <>
                  <Badge tone={status.cozyMode ? "neutral" : status.nightOpen ? "accent" : "neutral"} mono>
                    {status.cozyMode ? "cozy mode" : status.nightOpen ? "window open" : "window closed"}
                  </Badge>
                  <p className="mt-2 text-xs text-muted">{status.message}</p>
                </>
              ) : (
                <p className="text-xs text-faint">Checking the clock…</p>
              )}
            </div>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
