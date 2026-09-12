// Serves the mock API's routes (POST /v1/auth/otp/request, GET /v1/feed, ...)
// as part of this same Next.js deployment. On Vercel that means the frontend
// never has to reach out to a separate backend host — there isn't one to
// misconfigure, and there's no cross-origin request to get wrong — the API is
// just more of this same app, at the same origin.
//
// It's a thin adapter: build a Node-http-shaped {req, res} out of the
// Web-standard Request this route handler receives, hand it to the same
// `dispatch()` the standalone dev server (tools/mock-api/server.mjs) uses,
// then turn whatever `dispatch` wrote into a Response. See
// web/lib/mock-api/app.mjs for what actually handles each route.
//
// Not covered here: the realtime WebSocket at /v1/ws. Serverless functions
// can't hold a socket upgrade open, so that one only exists in the standalone
// dev server — lib/ws.ts already fails that connection quietly and the rest
// of the app works the same without it.

import { dispatch } from "@/lib/mock-api/app.mjs";

async function handle(request) {
  const url = new URL(request.url);

  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const bodyBuffer =
    request.method === "GET" || request.method === "HEAD" || request.method === "DELETE"
      ? Buffer.alloc(0)
      : Buffer.from(await request.arrayBuffer());

  const req = {
    method: request.method,
    url: url.pathname + url.search,
    headers,
    // `dispatch` reads the body with `for await (const chunk of req)` — a
    // single-chunk async iterable is all that needs to satisfy.
    async *[Symbol.asyncIterator]() {
      if (bodyBuffer.length) yield bodyBuffer;
    },
  };

  let status = 200;
  const outHeaders = {};
  const chunks = [];
  let ended = false;

  const res = {
    setHeader(key, value) {
      outHeaders[key] = value;
    },
    writeHead(code, extraHeaders) {
      status = code;
      if (extraHeaders) Object.assign(outHeaders, extraHeaders);
    },
    end(payload) {
      if (payload) chunks.push(Buffer.isBuffer(payload) ? payload : Buffer.from(payload));
      ended = true;
    },
    get headersSent() {
      return ended;
    },
  };

  await dispatch(req, res);

  return new Response(Buffer.concat(chunks), { status, headers: outHeaders });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
