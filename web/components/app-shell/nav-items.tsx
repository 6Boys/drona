import {
  HomeIcon,
  CompassIcon,
  MessageIcon,
  MoonIcon,
  BookIcon,
  HeartIcon,
  TimerIcon,
  UserIcon,
  BookmarkIcon,
} from "@/components/ui/Icons";
import type { ComponentType } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** The Love Finder tab re-themes its section; the nav hints at that before
   * you even click it. */
  romance?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/feed", label: "Nest", icon: HomeIcon },
  { href: "/dating", label: "Love Finder", icon: HeartIcon, romance: true },
  { href: "/spaces", label: "Spaces", icon: CompassIcon },
  { href: "/chats", label: "Chats", icon: MessageIcon },
];

export const NIGHT_NAV: NavItem[] = [
  { href: "/owl-board", label: "Owl Board", icon: MoonIcon },
  { href: "/burrows", label: "Study Burrows", icon: TimerIcon },
];

export const CAMPUS_NAV: NavItem[] = [
  { href: "/notes", label: "Note Locker", icon: BookIcon },
  { href: "/saved", label: "Saved", icon: BookmarkIcon },
];

/** Five slots, and Love Finder holds one of them — it is a headline surface,
 * not something filed under "more". */
export const MOBILE_NAV: NavItem[] = [
  { href: "/feed", label: "Nest", icon: HomeIcon },
  { href: "/dating", label: "Love", icon: HeartIcon, romance: true },
  { href: "/chats", label: "Chats", icon: MessageIcon },
  { href: "/owl-board", label: "Owl", icon: MoonIcon },
  { href: "/me", label: "You", icon: UserIcon },
];
