"use client";

import type { Avatar } from "@/lib/types";

// Dronu-style character rendering — used both for the pet mascot (empty
// states, loading, the match celebration) and for every user's own avatar,
// built in the onboarding avatar builder (PRD 6.1 / 7.5). One SVG, driven
// entirely by the four Avatar fields, so nothing here is a raster asset.

const BODY_COLOURS: Record<string, { base: string; belly: string; cheek: string }> = {
  ube: { base: "#A78BFA", belly: "#F3EEFF", cheek: "#FFB4A2" },
  peach: { base: "#FFB4A2", belly: "#FFF3ED", cheek: "#FF8A73" },
  mint: { base: "#8FDDB9", belly: "#EAFBF3", cheek: "#FFB4A2" },
  butter: { base: "#FFE29A", belly: "#FFF8E3", cheek: "#FF9D8A" },
  cocoa: { base: "#B08968", belly: "#F3E5D8", cheek: "#FFB4A2" },
  cream: { base: "#FFF3E6", belly: "#FFFDF9", cheek: "#FFB4A2" },
};

function Eyes({ eyes }: { eyes: string }) {
  switch (eyes) {
    case "sleepy":
      return (
        <g stroke="#4A3B34" strokeWidth="3.2" strokeLinecap="round" fill="none">
          <path d="M32 62 Q40 68 48 62" />
          <path d="M72 62 Q80 68 88 62" />
        </g>
      );
    case "wink":
      return (
        <g fill="#4A3B34">
          <circle cx="40" cy="60" r="6.5" />
          <path d="M72 60 Q80 66 88 60" stroke="#4A3B34" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        </g>
      );
    case "wide":
      return (
        <g>
          <circle cx="40" cy="60" r="11" fill="#fff" stroke="#4A3B34" strokeWidth="2.5" />
          <circle cx="80" cy="60" r="11" fill="#fff" stroke="#4A3B34" strokeWidth="2.5" />
          <circle cx="42" cy="58" r="5" fill="#4A3B34" />
          <circle cx="82" cy="58" r="5" fill="#4A3B34" />
        </g>
      );
    case "closed":
      return (
        <g stroke="#4A3B34" strokeWidth="3.2" strokeLinecap="round">
          <path d="M33 60 h14" />
          <path d="M73 60 h14" />
        </g>
      );
    case "sparkle":
    default:
      return (
        <g>
          <circle cx="40" cy="60" r="7.5" fill="#4A3B34" />
          <circle cx="80" cy="60" r="7.5" fill="#4A3B34" />
          <circle cx="37.5" cy="57" r="2.2" fill="#fff" />
          <circle cx="77.5" cy="57" r="2.2" fill="#fff" />
        </g>
      );
  }
}

function Hat({ hat, base }: { hat: string; base: string }) {
  switch (hat) {
    case "beanie":
      return (
        <g>
          <path d="M28 40 Q60 4 92 40 L92 46 L28 46 Z" fill="#7C5CE0" />
          <rect x="26" y="40" width="68" height="10" rx="5" fill="#6647C4" />
          <circle cx="60" cy="12" r="7" fill="#FFE29A" />
        </g>
      );
    case "grad-cap":
      return (
        <g>
          <rect x="42" y="18" width="36" height="10" rx="2" fill="#4A3B34" />
          <path d="M20 22 L60 8 L100 22 L60 36 Z" fill="#362B26" />
          <path d="M92 22 v16" stroke="#362B26" strokeWidth="2.5" />
          <circle cx="92" cy="40" r="3" fill="#FFE29A" />
        </g>
      );
    case "flower":
      return (
        <g transform="translate(78,20)">
          <g fill="#FFB4A2">
            <circle cx="0" cy="-9" r="6" />
            <circle cx="8" cy="-4" r="6" />
            <circle cx="8" cy="6" r="6" />
            <circle cx="0" cy="10" r="6" />
            <circle cx="-8" cy="6" r="6" />
            <circle cx="-8" cy="-4" r="6" />
          </g>
          <circle cx="0" cy="1" r="5.5" fill="#FFE29A" />
        </g>
      );
    case "headphones":
      return (
        <g fill="none" stroke="#4A3B34" strokeWidth="4" strokeLinecap="round">
          <path d="M22 52 Q28 6 60 6 Q92 6 98 52" />
          <rect x="14" y="46" width="14" height="22" rx="7" fill="#362B26" stroke="none" />
          <rect x="92" y="46" width="14" height="22" rx="7" fill="#362B26" stroke="none" />
        </g>
      );
    case "bandana":
      return (
        <g>
          <path d="M24 44 Q60 20 96 44 L96 52 Q60 34 24 52 Z" fill="#FF8A73" />
          <path d="M88 46 L100 58 L86 56 Z" fill="#FF8A73" />
        </g>
      );
    default:
      return null;
  }
}

function Accessory({ accessory, base }: { accessory: string; base: string }) {
  switch (accessory) {
    case "scarf":
      return (
        <g>
          <path d="M26 96 Q60 112 94 96 L94 106 Q60 122 26 106 Z" fill="#FF8A73" />
          <rect x="52" y="104" width="10" height="20" rx="3" fill="#FF8A73" />
        </g>
      );
    case "glasses":
      return (
        <g fill="none" stroke="#4A3B34" strokeWidth="3">
          <circle cx="40" cy="60" r="13" />
          <circle cx="80" cy="60" r="13" />
          <path d="M53 60 h14" />
          <path d="M27 58 h-6" />
          <path d="M93 58 h6" />
        </g>
      );
    case "earbuds":
      return (
        <g fill="#fff" stroke="#4A3B34" strokeWidth="2">
          <circle cx="22" cy="70" r="5" />
          <circle cx="98" cy="70" r="5" />
        </g>
      );
    case "bowtie":
      return (
        <g transform="translate(60,100)">
          <path d="M-16 -8 L0 0 L-16 8 Z" fill="#7C5CE0" />
          <path d="M16 -8 L0 0 L16 8 Z" fill="#7C5CE0" />
          <circle r="4" fill="#6647C4" />
        </g>
      );
    default:
      return null;
  }
}

interface DronuAvatarProps {
  avatar: Avatar;
  size?: number;
  className?: string;
  mood?: "idle" | "sleepy" | "excited";
}

const DEFAULT_PALETTE = { base: "#A78BFA", belly: "#F3EEFF", cheek: "#FFB4A2" };

export function DronuAvatar({ avatar, size = 48, className, mood = "idle" }: DronuAvatarProps) {
  const palette = (avatar.colour && BODY_COLOURS[avatar.colour]) || BODY_COLOURS.ube || DEFAULT_PALETTE;

  const eyes = mood === "sleepy" ? "sleepy" : avatar.eyes;

  return (
    <svg
      viewBox="0 0 120 130"
      width={size}
      height={size}
      className={className ? `${className} ${mood === "idle" ? "dronu-idle" : ""}` : mood === "idle" ? "dronu-idle" : undefined}
      role="img"
      aria-label="avatar"
    >
      {/* ear tufts */}
      <path d="M28 34 L18 10 L42 26 Z" fill={palette.base} />
      <path d="M92 34 L102 10 L78 26 Z" fill={palette.base} />
      {/* body */}
      <ellipse cx="60" cy="74" rx="46" ry="44" fill={palette.base} />
      {/* belly */}
      <ellipse cx="60" cy="84" rx="28" ry="26" fill={palette.belly} />
      {/* cheeks */}
      <circle cx="30" cy="72" r="7" fill={palette.cheek} opacity="0.55" />
      <circle cx="90" cy="72" r="7" fill={palette.cheek} opacity="0.55" />
      <Eyes eyes={eyes} />
      {/* beak */}
      <path d="M56 72 L64 72 L60 80 Z" fill="#FFB454" />
      <Accessory accessory={avatar.accessory} base={palette.base} />
      <Hat hat={avatar.hat} base={palette.base} />
    </svg>
  );
}
