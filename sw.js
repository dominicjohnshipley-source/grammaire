/* Grammaire service worker: works offline, picks up new versions when online. */
const CACHE = "grammaire-v2";
const CORE = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./favicon.png",
  "./barlow-400.woff2", "./barlow-500.woff2", "./barlow-600.woff2", "./barlow-700.woff2",
  "./barlow-sc-500.woff2", "./barlow-sc-600.woff2", "./barlow-sc-700.woff2", "./barlow-sc-800.woff2",
  "./newsreader-400.woff2", "./newsreader-400-italic.woff2", "./newsreader-600.woff2", "./newsreader-600-italic.woff2"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* The page itself: try the network first (so updates arrive), fall back to the cached copy
     if offline or if the network takes longer than 3 seconds. */
  if (req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) {
    const network = fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); }
      return res;
    });
    const cached = caches.match("./index.html");
    const timeout = new Promise(resolve => setTimeout(resolve, 3000));
    e.respondWith(
      Promise.race([network, timeout.then(() => cached)])
        .then(res => res || network)
        .catch(() => cached.then(r => r || network))
    );
    e.waitUntil(network.catch(() => {}));
    return;
  }

  /* Fonts, icons, manifest: cache first. */
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
