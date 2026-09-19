// Tiny className joiner — this project doesn't need clsx's full surface.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
