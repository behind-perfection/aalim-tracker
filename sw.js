/* Service worker for Aalim's Class 10 Command Centre.
   Keep CACHE in step with APP_VERSION in index.html: bump both together
   whenever you publish a new version, so phones pick up the update. */
const CACHE = "aalim-tracker-v44";
const LIBS = "aalim-libs"; // PDF reader engine, kept across app updates
const ASSETS = [
  "./",
  "index.html",
  "chemlab.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS).catch(() => Promise.all(ASSETS.map((a) => cache.add(a).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== LIBS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "cdnjs.cloudflare.com" && (url.pathname.includes("/pdf.js/") || url.pathname.includes("/jszip/"))) {
    event.respondWith(caches.open(LIBS).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== self.location.origin) return; // leave other sites alone

  // Pages: try the network first so updates show up, fall back to the cached copy when offline.
  // chemlab.html is also a "navigate" request (it loads inside an iframe), so it gets its own cache key.
  if (req.mode === "navigate") {
    const key = url.pathname.endsWith("chemlab.html") ? "chemlab.html" : "index.html";
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(key, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(key).then((r) => r || caches.match("./")))
    );
    return;
  }

  // Everything else (manifest, icons): cache first, refresh in the background.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => (cs.length ? cs[0].focus() : self.clients.openWindow("./"))));
});
