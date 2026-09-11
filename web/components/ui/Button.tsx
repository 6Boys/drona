import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-on-accent shadow-soft hover:bg-accent-strong",
  secondary: "bg-accent-wash text-accent-strong hover:bg-accent-soft/50",
  ghost: "bg-transparent text-text hover:bg-surface-2",
  outline: "bg-transparent text-text border border-border-strong hover:bg-surface-2",
  danger: "bg-negative text-white hover:brightness-95",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3.5 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
  icon: "size-10 p-0",
};

/** The app's one button. Every surface — feed, chat, dating — draws from it,
 * so a theme change (default → Love Finder) recolors every button for free. */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "pill-btn cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
