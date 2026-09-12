"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/cn";

interface NightPoint {
  date: string;
  label: string;
  points: number;
  isTonight: boolean;
}

interface NightHistory {
  items: NightPoint[];
  best: number;
}

/**
 * Seven nights of owl points. One series, so no legend — the heading names it.
 * Bars carry a hover readout rather than a number printed on every column, and
 * only the best night is labelled directly.
 */
export function NightChart() {
  const { data, loading } = useApi<NightHistory>("/v1/owl/history");
  const [hovered, setHovered] = useState<number | null>(null);

  if (loading) return <Skeleton className="h-40 rounded-[var(--r-lg)]" />;
  if (!data?.items.length) return null;

  // Scale to the best night so a quiet week still reads, with headroom so the
  // tallest bar never touches the ceiling.
  const ceiling = Math.max(data.best, 10) * 1.15;
  const active = hovered !== null ? data.items[hovered] : null;

  return (
    <section className="card p-5">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-[0.9375rem] font-medium text-text">Your last seven nights</h2>
          <p className="mt-0.5 text-xs text-muted">Points earned inside the night window</p>
        </div>

        <p className="tabnum text-right text-sm text-muted">
          {active ? (
            <>
              <span className="font-medium text-text">{active.points}</span> on{" "}
              {new Date(active.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </>
          ) : (
            <>
              best <span className="font-medium text-text">{data.best}</span>
            </>
          )}
        </p>
      </header>

      <div className="mt-5 flex h-32 items-end gap-2" onMouseLeave={() => setHovered(null)}>
        {data.items.map((night, i) => {
          const height = Math.max(2, (night.points / ceiling) * 100);
          const isBest = night.points === data.best && data.best > 0;

          return (
            <div
              key={night.date}
              className="group relative flex h-full flex-1 cursor-default flex-col justify-end"
              onMouseEnter={() => setHovered(i)}
            >
              {isBest && (
                <span className="tabnum mb-1 text-center text-[0.6875rem] font-medium text-muted">
                  {night.points}
                </span>
              )}

              <div
                className={cn(
                  "w-full rounded-t-[4px] transition-[height,opacity] duration-500 ease-out",
                  hovered !== null && hovered !== i && "opacity-55",
                )}
                style={{
                  height: `${height}%`,
                  background: night.isTonight ? "var(--grad-gold)" : "var(--grad-night)",
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2 border-t border-border pt-2">
        {data.items.map((night) => (
          <span
            key={night.date}
            className={cn(
              "flex-1 text-center text-[0.6875rem]",
              night.isTonight ? "font-medium text-gold" : "text-faint",
            )}
          >
            {night.isTonight ? "Tonight" : night.label}
          </span>
        ))}
      </div>
    </section>
  );
}
