import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Everything under /(app)/* and /onboarding is already noindex'd via its own
// route-segment metadata (app/(app)/layout.tsx, app/onboarding/layout.tsx) —
// that's what actually keeps a signed-in user's feed out of search results.
// Disallow here too so crawlers don't even spend a fetch on pages that need a
// session to render anything. Deliberately not blocking AI/LLM crawlers
// (GPTBot, ClaudeBot, etc.) on the public marketing routes — see llms.txt.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login"],
      disallow: ["/onboarding", "/feed", "/dating", "/grapevine", "/chats", "/settings", "/notes", "/owl-board", "/spaces", "/profile", "/search", "/saved", "/v1/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
