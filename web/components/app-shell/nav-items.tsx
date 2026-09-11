import {
  HomeIcon,
  SearchIcon,
  HeartIcon,
  MessageIcon,
  MoonIcon,
  BookIcon,
  UserIcon,
} from "@/components/ui/Icons";
import type { ComponentType } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Marks the one nav item whose section re-themes on entry (PRD ask: the
   * Love Finder tab visually promises the mode change before you even tap it). */
  romance?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/feed", label: "Nest", icon: HomeIcon },
  { href: "/spaces", label: "Explore", icon: SearchIcon },
  { href: "/dating", label: "Love Finder", icon: HeartIcon, romance: true },
  { href: "/chats", label: "Chats", icon: MessageIcon },
  { href: "/owl-board", label: "Owl Board", icon: MoonIcon },
  { href: "/notes", label: "Notes", icon: BookIcon },
];

export const PROFILE_ITEM: NavItem = { href: "/profile/me", label: "Profile", icon: UserIcon };
