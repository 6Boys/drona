import {
  HomeIcon,
  CompassIcon,
  MessageIcon,
  MoonIcon,
  BookIcon,
  HeartIcon,
  FlameIcon,
  UserIcon,
} from "@/components/ui/Icons";
import type { ComponentType, CSSProperties } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string; style?: CSSProperties }>;
  /** The Love Finder tab re-themes its section; the nav hints at that before
   * you even click it. */
  romance?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/feed", label: "Nest", icon: HomeIcon },
  { href: "/dating", label: "Love Finder", icon: HeartIcon, romance: true },
  { href: "/afterhours", label: "AfterHours", icon: FlameIcon },
  { href: "/spaces", label: "Spaces", icon: CompassIcon },
  { href: "/chats", label: "Chats", icon: MessageIcon },
];

export const NIGHT_NAV: NavItem[] = [{ href: "/owl-board", label: "Night Shift", icon: MoonIcon }];

export const CAMPUS_NAV: NavItem[] = [{ href: "/notes", label: "Note Locker", icon: BookIcon }];

/** Five slots, and Love Finder holds one of them — it is a headline surface,
 * not something filed under "more". */
export const MOBILE_NAV: NavItem[] = [
  { href: "/feed", label: "Nest", icon: HomeIcon },
  { href: "/dating", label: "Love", icon: HeartIcon, romance: true },
  { href: "/chats", label: "Chats", icon: MessageIcon },
  { href: "/owl-board", label: "Night", icon: MoonIcon },
  { href: "/me", label: "You", icon: UserIcon },
];
