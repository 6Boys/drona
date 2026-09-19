import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/Toast";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serif-face",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-face",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const DESCRIPTION =
  "A campus-verified social platform: one feed, real chats, a night leaderboard that knows when to tell you to sleep, and a note locker that works on a dead Tuesday.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DronaSphere — your campus, in one place",
    template: "%s · DronaSphere",
  },
  description: DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "DronaSphere",
    title: "DronaSphere — your campus, in one place",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "DronaSphere — your campus, in one place",
    description: DESCRIPTION,
  },
  // iOS ignores the web manifest for "Add to Home Screen" polish — this is
  // the actual mechanism that gets a standalone (no Safari chrome) window,
  // the right title under the icon, and a sane status bar over a dark app.
  appleWebApp: {
    capable: true,
    title: "DronaSphere",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  // Matches --night-950 (app/globals.css) — dark is the default theme now,
  // so this is what most first loads should show in the browser chrome.
  themeColor: "#100f14",
  width: "device-width",
  initialScale: 1,
  // Lets content extend under the notch/home-indicator on iPhones when
  // installed as a standalone PWA, instead of a dead black bar there.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is scoped to this element only (React does not
    // propagate it to children) — it exists for exactly this case: the
    // theme-init script below intentionally sets class/style on <html>
    // before hydration, which would otherwise be flagged as a mismatch.
    <html
      lang="en"
      className={`${inter.variable} ${serif.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Dark is the default look (see lib/theme.ts) — this only needs to
            check for an explicit opt-out into light, stored by the toggle.
            Runs before hydration so that applies to the first paint too;
            without this, the page would flash light and then snap to dark a
            beat later. No user input reaches this string. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{if(localStorage.getItem("drona.theme")!=="light"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}}catch(e){}})();`}
        </Script>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[var(--r-sm)] focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-accent"
        >
          Skip to content
        </a>
        <ServiceWorkerRegister />
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
        {/* Mounted app-wide, not just inside AppShell — this is what calls
            preventDefault() on the browser's own beforeinstallprompt. Waiting
            until after login to capture that event means Chrome may already
            have shown its own default install banner (a plain OS-style
            notification bar) on someone's very first visit to the public
            marketing page, before this component ever mounted. */}
        <InstallPrompt />
      </body>
    </html>
  );
}
