// Shared state for the mock API, for when it runs as more than one process.
//
// Everything in app.mjs lives in module-level Maps, which is exactly right for
// `next dev` or the standalone server (one process, one memory) and exactly
// wrong on Vercel: parallel requests from the same browser land on separate
// function instances, each with its own copy of those Maps. Sign in on one,
// and the next request — on another — has never heard of your session. That
// is the "it keeps logging me out" bug; measured on the live deployment, 40
// parallel GET /v1/me calls with one valid token came back 3–7 × 200 and the
// rest 401.
//
// This keeps one canonical copy of the state in Redis (Upstash, via its plain
// HTTP API — no client library) and has every instance read it before a
// request and compare-and-swap it back after one. With no Redis configured it
// is simply off, and app.mjs behaves exactly as before.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const storeEnabled = Boolean(URL_ && TOKEN);

// Bump when a change to app.mjs's state shape would make an old snapshot
// unreadable — a demo backend can afford to start fresh; it can't afford to
// crash on a field it doesn't recognize. The environment is in the key so a
// preview deployment built from some other branch can never write over
// production's state, even when both are connected to the same database.
const STATE_SCHEMA = 1;
const PREFIX = `drona:mock:v${STATE_SCHEMA}:${process.env.VERCEL_ENV || "local"}`;
const VERSION_KEY = `${PREFIX}:version`;
const STATE_KEY = `${PREFIX}:state`;
const MEDIA_PREFIX = `${PREFIX}:media:`;

async function command(args) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`state store: ${json.error ?? `HTTP ${res.status}`}`);
  return json.result;
}

// One round trip: the version alone when the caller is already current (the
// common case, a few bytes), the version plus the whole state when it isn't,
// and "0" when nothing has been written yet. GET on a missing key is `false`
// inside Redis Lua, not nil.
const READ = `
local v = redis.call('GET', KEYS[1])
if not v then return {'0'} end
if v == ARGV[1] then return {v} end
return {v, redis.call('GET', KEYS[2])}
`;

// Write only if nobody else has since the version this instance read, and
// hand back the new version — or 0, which INCR can never produce, on a lost
// race. Versions are strings on both sides of the comparison.
const WRITE = `
local cur = redis.call('GET', KEYS[1]) or '0'
if cur ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2])
return redis.call('INCR', KEYS[1])
`;

/** `{ version, state }` — `state` is the stored JSON when it differs from
 * `knownVersion`, otherwise null (unchanged, or nothing stored yet: "0"). */
export async function readState(knownVersion) {
  const [version, state] = await command(["EVAL", READ, "2", VERSION_KEY, STATE_KEY, knownVersion || ""]);
  return { version: String(version), state: state ?? null };
}

/** The new version on success, null if another instance wrote first. */
export async function writeState(expectedVersion, json) {
  const next = await command(["EVAL", WRITE, "2", VERSION_KEY, STATE_KEY, expectedVersion || "0", json]);
  return Number(next) === 0 ? null : String(next);
}

// Uploaded pictures are kept out of the state blob — a single 5 MB photo is
// bigger than everything else combined, and the state is rewritten on every
// change. Stored once, by content hash, and served back by id.
export async function putMedia(id, contentType, buffer) {
  await command(["SET", `${MEDIA_PREFIX}${id}`, JSON.stringify({ contentType, data: buffer.toString("base64") })]);
}

export async function getMedia(id) {
  const raw = await command(["GET", `${MEDIA_PREFIX}${id}`]);
  if (!raw) return null;
  const { contentType, data } = JSON.parse(raw);
  return { contentType, buffer: Buffer.from(data, "base64") };
}

// Requests on one instance are handled one at a time — load, handle, save —
// because Vercel runs several concurrently in the same process. Without this,
// one request could reload the Maps out from under another that has changed
// them but not yet saved, and a save could then carry a stale version number
// over memory that no longer matches it.
let tail = Promise.resolve();
export function exclusive(fn) {
  const run = tail.then(fn, fn);
  tail = run.catch(() => {});
  return run;
}
