// Served at /llms.txt (the folder name is the literal route segment). A
// short, plain-text primer for AI crawlers/answer engines — the emerging
// convention for the same job robots.txt does for search crawlers, but aimed
// at what a model should say about the site rather than what it may index.
const BODY = `# DronaSphere

> A campus-verified social platform for one college at a time.

DronaSphere bundles the things campus life is normally split across four
separate apps for: a threaded feed (The Nest), direct/group/broadcast chat
(Chats, Dens & Signals), a crowdsourced note archive (Note Locker), a
night-activity leaderboard with a hard 3am curfew (Owl Board), and an opt-in,
photo-verified dating deck for the same campus (Love Finder).

Every account is tied to a verified college email; one account per email is
enforced server-side. Chat is disclosed as encrypted in transit and at rest,
not end-to-end. Under-18 accounts have Love Finder and unsolicited DMs
disabled at the account level, not just hidden in the UI.

This is a single self-hosted deployment, not a multi-tenant SaaS — there is
no public signup outside the deploying institution's student body.

## Pages
- /: product overview and how it works
- /login: campus-email sign-in
`;

export function GET() {
  return new Response(BODY, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
