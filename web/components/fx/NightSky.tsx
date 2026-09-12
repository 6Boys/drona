"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   NightSky — a twinkling star field with the occasional shooting star.
   One canvas rather than a few hundred animated divs: the field is decorative,
   so it should cost one paint per frame and nothing on the layout thread. It
   parks itself entirely when the tab is hidden, the element scrolls out of
   view, or the reader has asked for reduced motion.
   -------------------------------------------------------------------------- */

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

interface Streak {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  len: number;
}

export function NightSky({
  className,
  density = 0.00016,
  shooting = true,
  tint = "255,255,255",
}: {
  className?: string;
  /** stars per CSS pixel² — 0.00016 is ~110 stars on a 900×760 band */
  density?: number;
  shooting?: boolean;
  tint?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let streaks: Streak[] = [];
    let frame = 0;
    let visible = true;
    let nextStreak = 900;

    const seed = () => {
      const count = Math.round(width * height * density);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.1 + 0.35,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.0016 + 0.0006,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const spawn = () => {
      const fromLeft = Math.random() > 0.35;
      const speed = 5 + Math.random() * 4;
      streaks.push({
        x: fromLeft ? -40 : width * (0.4 + Math.random() * 0.6),
        y: Math.random() * height * 0.55,
        vx: fromLeft ? speed : -speed,
        vy: speed * (0.35 + Math.random() * 0.25),
        life: 1,
        len: 90 + Math.random() * 90,
      });
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      for (const s of stars) {
        const a = 0.28 + Math.sin(time * s.speed + s.phase) * 0.32;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${tint},${Math.max(a, 0.05).toFixed(3)})`;
        ctx.fill();
      }

      if (shooting && !reduced) {
        if (time > nextStreak) {
          spawn();
          nextStreak = time + 1600 + Math.random() * 3600;
        }
        streaks = streaks.filter((k) => k.life > 0 && k.x < width + 160 && k.y < height + 160);
        for (const k of streaks) {
          const mag = Math.hypot(k.vx, k.vy) || 1;
          const tx = k.x - (k.vx / mag) * k.len;
          const ty = k.y - (k.vy / mag) * k.len;
          const grad = ctx.createLinearGradient(k.x, k.y, tx, ty);
          grad.addColorStop(0, `rgba(${tint},${(0.85 * k.life).toFixed(3)})`);
          grad.addColorStop(1, `rgba(${tint},0)`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(k.x, k.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          k.x += k.vx;
          k.y += k.vy;
          k.life -= 0.011;
        }
      }
    };

    const loop = (time: number) => {
      if (visible) draw(time);
      frame = requestAnimationFrame(loop);
    };

    resize();

    if (reduced) {
      draw(0);
    } else {
      frame = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    io.observe(canvas);

    const onVisibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density, shooting, tint]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    />
  );
}
