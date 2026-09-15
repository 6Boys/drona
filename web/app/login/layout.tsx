import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to DronaSphere with your college email — a code, not a password.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
