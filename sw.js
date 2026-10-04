// Offline cache for the tracker. Bump CACHE when you upload a new version of index.html.
const CACHE = "aalim-tracker-v24";
const SHELL = "./";
const ASSETS = ["manifest.webmanifest", "icon-192.png", "icon-512.png"];

// Browsers refuse to show a navigation response that came from a redirect
// (Netlify redirects /index.html -> /). Re-wrap it as a clean, non-redirected response.
async function clean(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: 200, statusText: "OK", headers: res.headers });
}

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const shell = await fetch(SHELL, { cache: "reload" });
    if (shell.ok) await c.put(SHELL, await clean(shell));
    // Icons/manifest are optional for the app to run, so one failure must not block install.
    await Promise.all(ASSETS.map(a =>
      fetch(a, { cache: "reload" }).then(r => r.ok && c.put(a, r)).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pages: network first (so updates show up right away), cached copy if offline or slow.
async function handleNavigation() {
  const c = await caches.open(CACHE);
  const fromCache = () => c.match(SHELL);
  try {
    const net = fetch(SHELL, { cache: "no-cache" }).then(async res => {
      if (!res.ok) throw new Error("bad status");
      const fixed = await clean(res);
      c.put(SHELL, fixed.clone());
      return fixed;
    });
    const timeout = new Promise((_, rej) => setTimeout(rej, 4000));
    return await Promise.race([net, timeout]);
  } catch (err) {
    return (await fromCache()) || Response.error();
  }
}

// Everything else: serve from cache instantly, refresh in the background.
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  if (r.mode === "navigate") { e.respondWith(handleNavigation()); return; }
  e.respondWith(
    caches.match(r, { ignoreSearch: true }).then(hit => {
      const net = fetch(r).then(res => {
        if (res && res.ok && !res.redirected) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
        return res;
      });
      return hit || net.catch(() => Response.error());
    })
  );
});
