"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "./input";
import { DronuAvatar } from "./DronuAvatar";

/* ─────────────── tiny canvas grain (same vibe as the landing hero) ─────────────── */
function GrainCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;

    function draw() {
      if (!canvas || !ctx) return;
      const w = (canvas.width = canvas.offsetWidth);
      const h = (canvas.height = canvas.offsetHeight);
      const img = ctx.createImageData(w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() - 0.5) * 30;
        d[i] = d[i + 1] = d[i + 2] = 128 + v;
        d[i + 3] = Math.abs(v) * 2.5;
      }
      ctx.putImageData(img, 0, 0);
      frame = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 z-0 opacity-[0.07]"
      style={{ mixBlendMode: "overlay" }}
    />
  );
}

/* ─────────────── floating orb background accent ─────────────── */
function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      {/* primary orb */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 420,
          height: 420,
          background:
            "radial-gradient(circle, hsla(200,80%,60%,0.18) 0%, hsla(220,70%,50%,0.06) 50%, transparent 70%)",
          top: "10%",
          left: "55%",
          filter: "blur(60px)",
        }}
        animate={{ x: [0, 30, -20, 0], y: [0, -25, 15, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* secondary orb */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 320,
          height: 320,
          background:
            "radial-gradient(circle, hsla(280,60%,50%,0.12) 0%, hsla(260,50%,40%,0.04) 50%, transparent 70%)",
          bottom: "5%",
          left: "20%",
          filter: "blur(50px)",
        }}
        animate={{ x: [0, -20, 25, 0], y: [0, 20, -15, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/* ─────────────── main form ─────────────── */
export default function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [dronuMood, setDronuMood] = useState<"idle" | "excited">("idle");

  const toggleMode = useCallback(() => {
    setDronuMood("excited");
    setMode((prev) => (prev === "login" ? "signup" : "login"));
    setTimeout(() => setDronuMood("idle"), 800);
  }, []);

  const isLogin = mode === "login";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black px-4 py-12">
      <FloatingOrbs />
      <GrainCanvas />

      {/* glass card */}
      <motion.div
        layout
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-2xl backdrop-blur-xl"
        style={{
          boxShadow:
            "0 0 80px -20px rgba(100,210,255,0.08), 0 25px 50px -12px rgba(0,0,0,0.5)",
        }}
        transition={{ layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}
      >
        {/* top accent bar */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

        <div className="flex flex-col items-center gap-6 px-8 pb-10 pt-8">
          {/* mascot */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.15 }}
          >
            <DronuAvatar
              avatar={{ hat: "beanie", eyes: "sparkle", colour: "ube", accessory: "none" }}
              size={72}
              mood={dronuMood}
            />
          </motion.div>

          {/* heading */}
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="text-center"
            >
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {isLogin ? "Welcome back" : "Join the Sphere"}
              </h1>
              <p className="mt-1 text-sm text-white/40">
                {isLogin
                  ? "Sign in to DronaSphere and dive back in."
                  : "Create your account. It only takes a second."}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* form */}
          <form
            className="flex w-full flex-col gap-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-4"
              >
                {!isLogin && (
                  <div className="flex gap-3">
                    <Input label="First name" type="text" autoComplete="given-name" />
                    <Input label="Last name" type="text" autoComplete="family-name" />
                  </div>
                )}
                <Input label="Email" type="email" autoComplete="email" />
                {!isLogin && (
                  <Input label="Username" type="text" autoComplete="username" />
                )}
                <Input label="Password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} />
              </motion.div>
            </AnimatePresence>

            {/* forgot password (login only) */}
            {isLogin && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-white/30 transition hover:text-cyan-300/70"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* submit */}
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="relative mt-2 w-full cursor-pointer rounded-xl bg-gradient-to-r from-cyan-500/80 to-blue-600/80 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-cyan-500/20 hover:shadow-xl"
            >
              <span className="relative z-10">
                {isLogin ? "Sign In" : "Create Account"}
              </span>
              {/* subtle glow */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-400/20 to-blue-500/20 opacity-0 transition-opacity duration-300 hover:opacity-100" />
            </motion.button>
          </form>

          {/* divider */}
          <div className="flex w-full items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.07]" />
            <span className="text-[0.65rem] uppercase tracking-widest text-white/20">
              or
            </span>
            <div className="h-px flex-1 bg-white/[0.07]" />
          </div>

          {/* social placeholder */}
          <div className="flex w-full gap-3">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white/80"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white/80"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </button>
          </div>

          {/* toggle */}
          <p className="text-sm text-white/30">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={toggleMode}
              className="font-medium text-cyan-400/70 transition hover:text-cyan-300 cursor-pointer"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
