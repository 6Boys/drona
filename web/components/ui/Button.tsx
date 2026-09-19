import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { SpinnerIcon } from "./Icons";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hi border border-transparent",
  secondary: "bg-surface-2 text-text hover:bg-accent-wash border border-border",
  ghost: "bg-transparent text-muted hover:text-text hover:bg-surface-2 border border-transparent",
  outline: "bg-transparent text-text border border-border-strong hover:border-accent hover:text-accent-hi",
  danger: "bg-danger text-white hover:brightness-110 border border-transparent",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem] gap-1.5 rounded-[var(--r-sm)]",
  md: "h-10 px-4 text-sm gap-2 rounded-[var(--r-md)]",
  lg: "h-12 px-6 text-[0.9375rem] gap-2 rounded-[var(--r-md)]",
  icon: "size-9 rounded-[var(--r-sm)]",
};

const BASE =
  "inline-flex items-center justify-center font-medium whitespace-nowrap " +
  "transition-[background-color,border-color,color,opacity] duration-150 " +
  "cursor-pointer disabled:cursor-not-allowed disabled:opacity-45";

const FULL = "w-full min-w-0";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  fullWidth,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && FULL, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <SpinnerIcon size={size === "sm" ? 14 : 16} /> : icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
}

/** A link that looks like a button. Kept separate so navigation never ends up
 * as a <button> inside an <a>, which is invalid and breaks keyboard users. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  fullWidth,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && FULL, className)}
      {...props}
    >
      {icon}
      {children}
    </Link>
  );
}
