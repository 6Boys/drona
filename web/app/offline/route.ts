// Cached by sw.js at install time and served for any navigation that fails
// while offline. Deliberately a self-contained string, not a rendered React
// page — it has to work with zero network and zero JS bundle available.
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>You're offline · DronaSphere</title>
<style>
  html,body{height:100%;margin:0;background:#100f14;color:#f2f0ec;font-family:ui-sans-serif,system-ui,sans-serif}
  body{display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem}
  main{max-width:22rem}
  h1{font-size:1.25rem;font-weight:500;margin:0 0 .5rem}
  p{color:#a5a199;font-size:.9375rem;line-height:1.5;margin:0}
  button{margin-top:1.5rem;background:#9a5c90;color:#fff;border:none;border-radius:999px;padding:.625rem 1.25rem;font-size:.875rem;cursor:pointer}
</style>
</head>
<body>
<main>
  <h1>You're offline</h1>
  <p>DronaSphere needs a connection for your feed, chats and everything else. Reconnect and try again.</p>
  <button onclick="location.reload()">Retry</button>
</main>
</body>
</html>`;

export function GET() {
  return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
