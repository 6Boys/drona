import type { Metadata, Viewport } from "next";
import { Baloo_2, Quicksand } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DronaSphere",
    template: "%s · DronaSphere",
  },
  description: "Your whole campus in one place — feed, chats, and a night-owl leaderboard.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff9f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1b33" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${baloo.variable} ${quicksand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
