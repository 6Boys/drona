"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { CodeInput } from "@/components/auth/CodeInput";
import { GlowInput, GradientSubmit } from "@/components/fx/SignupForm";
import { Glow } from "@/components/fx/Glow";
import { ShieldIcon } from "@/components/ui/Icons";
import { api, errorMessage } from "@/lib/api";
import { routeForStep, useAuth } from "@/lib/auth-context";
import type { OtpRequestResult, SessionResponse } from "@/lib/types";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-strong glass-panel relative p-7"
    >
      <Glow />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

function LoginFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn, me, loading } = useAuth();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<OtpRequestResult | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const next = params.get("next");

  // Already signed in — don't make someone re-authenticate to look at a form.
  useEffect(() => {
    if (!loading && me) router.replace(next || routeForStep(me.onboardingStep));
  }, [loading, me, router, next]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const request = useCallback(async (address: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<OtpRequestResult>("/v1/auth/otp/request", { email: address });
      setSent(result);
      setStep("code");
      setCooldown(60);
      // MAILER=log in local dev returns the code so nobody has to tail logs.
      if (result.devCode) setCode(result.devCode);
    } catch (err) {
      setError(errorMessage(err, "we could not send that code"));
    } finally {
      setBusy(false);
    }
  }, []);

  const verify = useCallback(
    async (value: string) => {
      setBusy(true);
      setError(null);
      try {
        const session = await api.post<SessionResponse>("/v1/auth/otp/verify", {
          email: sent?.email ?? email,
          code: value,
        });
        const account = await signIn(session);
        router.replace(next || routeForStep(account?.onboardingStep ?? session.onboardingStep));
      } catch (err) {
        setError(errorMessage(err, "that code did not work"));
        setCode("");
      } finally {
        setBusy(false);
      }
    },
    [sent, email, signIn, router, next],
  );

  return (
    <AnimatePresence mode="wait">
      {step === "code" ? (
        <motion.div key="code" exit={{ opacity: 0, y: -8 }}>
          <Card>
            <p className="mono-label">step 2 of 2</p>
            <h1 className="display mt-3 text-[2rem] text-text">
              {sent?.existing ? "Welcome back." : "Check your inbox."}
            </h1>
            <p className="mt-2 text-[0.875rem] text-muted">
              A 6-digit code is on its way to{" "}
              <span className="text-text">{sent?.email ?? email}</span>.
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length === 6) verify(code);
              }}
            >
              <CodeInput
                value={code}
                onChange={setCode}
                onComplete={verify}
                disabled={busy}
                invalid={!!error}
              />

              {error && <p className="text-xs text-danger">{error}</p>}

              {sent?.devCode && (
                <p className="rounded-[var(--r-sm)] border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-muted">
                  dev mode · code {sent.devCode}
                </p>
              )}

              <GradientSubmit loading={busy} disabled={code.length !== 6}>
                Verify and continue
              </GradientSubmit>
            </form>

            <div className="mt-5 flex items-center justify-between text-xs">
              <button
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="cursor-pointer text-muted transition-colors hover:text-text"
              >
                Use a different email
              </button>
              <button
                disabled={cooldown > 0 || busy}
                onClick={() => request(sent?.email ?? email)}
                className="cursor-pointer text-accent-hi transition-colors hover:underline disabled:cursor-not-allowed disabled:text-faint disabled:no-underline"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </Card>
        </motion.div>
      ) : (
        <motion.div key="email" exit={{ opacity: 0, y: -8 }}>
          <Card>
            <p className="mono-label">step 1 of 2</p>
            <h1 className="display mt-3 text-[2rem] text-text">Sign in to DronaSphere.</h1>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
              Your college email, and nothing else. There is no password to forget — we send a code
              instead.
            </p>

            <form
              className="mt-6 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) request(email.trim());
              }}
            >
              <GlowInput
                id="email"
                label="college email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="you@dronacharya.info"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error ?? undefined}
              />

              <GradientSubmit loading={busy} disabled={!email.trim()}>
                Send me a code
              </GradientSubmit>
            </form>

            <p className="mt-6 flex items-start gap-2 border-t border-border pt-5 text-xs leading-relaxed text-faint">
              <ShieldIcon size={14} className="mt-px shrink-0" />
              Not on a recognised campus domain? You can still join by submitting an ID card for
              manual review — we&apos;ll email you within 24 hours.
            </p>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout
      aside={
        <p className="text-center text-xs text-faint">
          New here?{" "}
          <Link href="/" className="text-muted underline-offset-2 hover:underline">
            See what DronaSphere is
          </Link>{" "}
          first.
        </p>
      }
    >
      <Suspense fallback={<div className="glass glass-panel h-80 animate-pulse" />}>
        <LoginFlow />
      </Suspense>
    </AuthLayout>
  );
}
