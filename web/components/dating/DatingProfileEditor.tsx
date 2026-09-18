"use client";

import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ProfileCard } from "./ProfileCard";
import { Button } from "@/components/ui/Button";
import { precheck } from "@/components/ui/MediaUpload";
import { PlusIcon, XIcon, CheckIcon, SpinnerIcon } from "@/components/ui/Icons";
import { uploadMedia, errorMessage } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { INTEREST_LIBRARY, PROMPT_LIBRARY } from "@/lib/mock-dating";
import type { DatingCandidate, DatingPrompt, DatingProfile, User } from "@/lib/types";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   Your own card, edited beside a live copy of what other people will see.

   Three prompts maximum, because the fourth is always filler, and the preview
   is the real component rather than a mock of it — if the answer overflows the
   block here, it overflows in the deck too, and you find out before you publish
   rather than after.
   -------------------------------------------------------------------------- */

const MAX_PROMPTS = 3;
const MAX_INTERESTS = 6;
const ANSWER_LIMIT = 160;
const VIBE_LIMIT = 60;
const MIN_PHOTOS = 2;
const MAX_PHOTOS = 4;

function Chip({
  label,
  on,
  onClick,
  disabled,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !on}
      aria-pressed={on}
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1.5 text-[0.8125rem] transition-colors",
        on
          ? "border-accent bg-accent-wash text-accent"
          : "border-border bg-surface text-muted hover:border-border-strong hover:text-text",
        disabled && !on && "cursor-not-allowed opacity-40 hover:border-border hover:text-muted",
      )}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass glass-panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="mono-label">{label}</h3>
        {hint && <span className="text-[0.6875rem] text-faint">{hint}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A row of MIN_PHOTOS–MAX_PHOTOS square tiles: filled ones show the photo
 * with a remove button, the first empty one is an upload target, and any
 * slots after that stay disabled until it's filled — one clear next action
 * rather than four simultaneous drop zones. */
function PhotoSlots({ photos, onChange }: { photos: string[]; onChange: (next: string[]) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pick = async (file: File) => {
    const problem = precheck(file);
    if (problem) {
      toast(problem, "error");
      return;
    }
    setBusy(true);
    try {
      const result = await uploadMedia(file);
      onChange([...photos, result.url]);
    } catch (err) {
      toast(errorMessage(err, "that upload failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
      {Array.from({ length: MAX_PHOTOS }, (_, i) => {
        const url = photos[i];
        if (url) {
          return (
            <div key={i} className="relative aspect-square overflow-hidden rounded-[var(--r-md)] border border-border">
              <Image src={url} alt="" width={200} height={200} unoptimized className="size-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 flex size-6 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                <XIcon size={12} />
              </button>
            </div>
          );
        }
        const isNextSlot = i === photos.length;
        return (
          <button
            key={i}
            type="button"
            disabled={!isNextSlot || busy}
            aria-label="Add photo"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex aspect-square cursor-pointer items-center justify-center rounded-[var(--r-md)] border border-dashed transition-colors",
              isNextSlot
                ? "border-border-strong text-muted hover:border-accent hover:text-accent"
                : "cursor-not-allowed border-border text-faint",
            )}
          >
            {isNextSlot && busy ? <SpinnerIcon size={16} /> : <PlusIcon size={16} />}
          </button>
        );
      })}
    </div>
  );
}

export function DatingProfileEditor({
  user,
  profile,
  onSave,
}: {
  user: User;
  profile: DatingProfile;
  onSave: (profile: DatingProfile) => void;
}) {
  const [vibe, setVibe] = useState(profile.vibe);
  const [interests, setInterests] = useState<string[]>(profile.interests);
  const [prompts, setPrompts] = useState<DatingPrompt[]>(profile.prompts);
  // Defensive default: an account whose profile was written before `photos`
  // existed can hand back a response with no such field at all — this must
  // never crash the whole editor over it, so treat missing the same as empty
  // rather than trusting the type's promise that it's always an array.
  const [photos, setPhotos] = useState<string[]>(profile.photos ?? []);
  const [picking, setPicking] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty =
    vibe !== profile.vibe ||
    JSON.stringify(interests) !== JSON.stringify(profile.interests) ||
    JSON.stringify(prompts) !== JSON.stringify(profile.prompts) ||
    JSON.stringify(photos) !== JSON.stringify(profile.photos ?? []);

  const used = new Set(prompts.map((p) => p.question));

  const toggleInterest = (interest: string) =>
    setInterests((list) =>
      list.includes(interest)
        ? list.filter((i) => i !== interest)
        : list.length >= MAX_INTERESTS
          ? list
          : [...list, interest],
    );

  const addPrompt = (question: string) => {
    setPrompts((list) => (list.length >= MAX_PROMPTS ? list : [...list, { question, answer: "" }]));
    setPicking(false);
  };

  const setAnswer = (index: number, answer: string) =>
    setPrompts((list) => list.map((p, i) => (i === index ? { ...p, answer } : p)));

  const removePrompt = (index: number) => setPrompts((list) => list.filter((_, i) => i !== index));

  // The preview is a real DatingCandidate so it renders through the same card
  // the deck uses — no second implementation to drift out of sync.
  const preview: DatingCandidate = useMemo(
    () => ({
      ...user,
      branch: user.branch || "Your branch",
      vibe,
      interests,
      // A half-written block is not on your card yet, so it is not in the
      // preview either — the preview is what the deck would show right now.
      prompts: prompts.filter((p) => p.answer.trim()),
      photos,
    }),
    [user, vibe, interests, prompts, photos],
  );

  const answered = prompts.filter((p) => p.answer.trim()).length;
  const ready = answered >= 1 && interests.length >= 1 && photos.length >= MIN_PHOTOS;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_25rem]">
      {/* ------------------------------------------------------------ form -- */}
      <div className="space-y-4">
        <Field label="your photos" hint={`${photos.length}/${MAX_PHOTOS} · ${MIN_PHOTOS} minimum`}>
          <PhotoSlots photos={photos} onChange={setPhotos} />
        </Field>

        <Field label="one line about you" hint={`${vibe.length}/${VIBE_LIMIT}`}>
          <input
            value={vibe}
            maxLength={VIBE_LIMIT}
            onChange={(e) => setVibe(e.target.value)}
            placeholder="sings in the stairwell, unbothered"
            className="w-full rounded-[var(--r-md)] border border-border bg-surface px-3.5 py-2.5 text-[0.9375rem] text-text outline-none transition-colors placeholder:text-faint focus:border-accent"
          />
          <p className="mt-2 text-[0.75rem] text-muted">
            Lowercase, specific, and true. It sits under your name, so it is the second thing anyone
            reads.
          </p>
        </Field>

        <Field label="into" hint={`${interests.length}/${MAX_INTERESTS}`}>
          <div className="flex flex-wrap gap-2">
            {INTEREST_LIBRARY.map((interest) => (
              <Chip
                key={interest}
                label={interest}
                on={interests.includes(interest)}
                disabled={interests.length >= MAX_INTERESTS}
                onClick={() => toggleInterest(interest)}
              />
            ))}
          </div>
        </Field>

        <Field label="your answers" hint={`${prompts.length}/${MAX_PROMPTS}`}>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {prompts.map((prompt, index) => (
                <motion.div
                  key={prompt.question}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-[var(--r-md)] border border-border bg-surface p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="mono-label">{prompt.question}</p>
                    <button
                      onClick={() => removePrompt(index)}
                      aria-label={`Remove "${prompt.question}"`}
                      className="-mt-1 cursor-pointer rounded-full p-1 text-faint transition-colors hover:bg-surface-2 hover:text-danger"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                  <textarea
                    value={prompt.answer}
                    maxLength={ANSWER_LIMIT}
                    rows={2}
                    onChange={(e) => setAnswer(index, e.target.value)}
                    placeholder="Answer it like you'd say it out loud."
                    className="serif mt-2 w-full resize-none bg-transparent text-[1.0625rem] leading-snug text-text outline-none placeholder:font-sans placeholder:text-[0.875rem] placeholder:text-faint"
                  />
                  <p className="tabnum mt-1 text-right text-[0.6875rem] text-faint">
                    {ANSWER_LIMIT - prompt.answer.length}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>

            {prompts.length < MAX_PROMPTS && (
              <>
                <Button
                  variant="outline"
                  fullWidth
                  icon={<PlusIcon size={15} />}
                  onClick={() => setPicking((p) => !p)}
                >
                  {picking ? "Close the list" : "Add an answer"}
                </Button>

                <AnimatePresence>
                  {picking && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-2 pt-1">
                        {PROMPT_LIBRARY.filter((q) => !used.has(q)).map((question) => (
                          <button
                            key={question}
                            onClick={() => addPrompt(question)}
                            className="cursor-pointer rounded-full border border-border bg-surface px-3 py-1.5 text-[0.8125rem] text-muted transition-colors hover:border-accent hover:text-accent"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!dirty || !ready}
            icon={saved ? <CheckIcon size={15} /> : undefined}
            onClick={() => {
              onSave({
                vibe: vibe.trim(),
                interests,
                prompts: prompts.filter((p) => p.answer.trim()),
                photos,
              });
              setSaved(true);
              setTimeout(() => setSaved(false), 1800);
            }}
          >
            {saved ? "Saved" : "Save your card"}
          </Button>
          <p className="text-[0.8125rem] text-muted">
            {ready
              ? dirty
                ? "Unsaved changes."
                : "Your card is live in the deck."
              : `Add ${MIN_PHOTOS} photos, one answer and one interest before this goes live.`}
          </p>
        </div>
      </div>

      {/* --------------------------------------------------------- preview -- */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mono-label mb-3">what they see</p>
        <div className="h-[34rem]">
          <ProfileCard candidate={preview} />
        </div>
      </div>
    </div>
  );
}
