import type { Metadata } from "next";
import AuthForm from "@/components/ui/auth-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in or create your DronaSphere account.",
};

export default function AuthPage() {
  return <AuthForm />;
}
