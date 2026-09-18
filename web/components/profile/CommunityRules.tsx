const RULES: { title: string; body: string }[] = [
  {
    title: "One account, one real person",
    body: "Verified with a college email. Impersonating someone else, or running a second account to get around a ban, ends both.",
  },
  {
    title: "Report and block work on everything",
    body: "Every post, message, and profile has both. Reports go to a human, with a 24-hour target — not a queue nobody reads.",
  },
  {
    title: "Love Finder is 18+, opt-in, campus-only",
    body: "Turning it on puts a real, verified photo in front of other students on your campus who also opted in. Nothing here is shown outside that.",
  },
  {
    title: "Harassment, doxxing, and threats are a permanent ban",
    body: "No warning, no second account. This applies the same way whether it happens in a comment, a DM, or a note upload.",
  },
  {
    title: "If a post or message reads like a crisis, it gets routed",
    body: "To Indian helplines (Tele-MANAS 14416, iCall) and a human reviewer — automatically, in addition to whatever else happens with it.",
  },
];

export function CommunityRules() {
  return (
    <div className="space-y-4">
      {RULES.map((rule) => (
        <div key={rule.title} className="border-t border-border pt-3 first:border-0 first:pt-0">
          <p className="text-[0.875rem] font-medium text-text">{rule.title}</p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{rule.body}</p>
        </div>
      ))}
    </div>
  );
}
