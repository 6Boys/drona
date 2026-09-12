#!/usr/bin/env node
// DronaSphere mock API — standalone local-dev server.
//
// All the actual routing, seed data and handlers live in
// web/lib/mock-api/app.mjs, shared with the Next.js Route Handlers
// (web/app/v1/[...slug]/route.js) that serve the same API when this app is
// deployed to Vercel. This file just wires that shared logic into a real Node
// HTTP server and adds the one thing a serverless deploy can't do: a raw
// WebSocket upgrade for /v1/ws, so realtime (live threads, typing, owl status)
// works in local dev even though it degrades gracefully without it elsewhere.
//
//   node tools/mock-api/server.mjs        # listens on :8080
//
// Point the web app at it with NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
// if you want realtime while developing — by default (unset), the app talks
// to its own bundled /v1/* routes instead, and this process isn't needed at
// all for ordinary testing.
//
// Any 6-digit code verifies. Sign in as any seeded handle's email
// (e.g. aniket@dronacharya.info), a new address to walk onboarding, or an
// address containing "admin" (e.g. admin@gmail.com) to skip onboarding
// entirely for quick testing.

import { createServer } from "node:http";
import { dispatch, handleUpgrade, PORT } from "../../web/lib/mock-api/app.mjs";

const server = createServer(dispatch);
server.on("upgrade", handleUpgrade);

server.listen(PORT, () => {
  console.log(`DronaSphere mock API on http://localhost:${PORT}`);
  console.log(`  sign in as any seeded student, e.g. aniket@dronacharya.info`);
  console.log(`  any 6-digit code works (the UI prefills 123456)`);
  console.log(`  a brand-new address walks the full onboarding flow`);
  console.log(`  an address containing "admin" skips onboarding entirely`);
});
