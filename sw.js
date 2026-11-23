/* Splendor Music service worker: makes the app installable and lets it open offline.
   - App files: network first (always fresh), cached copy when offline.
   - The music catalogue + collections (AtomicAssets API): network first, cached copy when offline.
   - Fonts: cache first.
   - Songs you save offline live in the "pp-offline-v1" cache (written by wallet.js) and play from there;
     their artwork is served from that cache too. Streaming audio and IPFS images are never intercepted. */
const SHELL = "pp-shell-v9", RUNTIME = "pp-runtime-v1", AUDIO = "pp-offline-v1";
const SHELL_FILES = ["./", "index.html", "style.css", "app.js", "wallet.js", "radio.js", "manifest.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png", "icons/favicon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("pp-shell-") && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const keep = (cacheName, req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(cacheName).then(c => c.put(req, copy)); } return res; };

/* songs saved on this device: served from the cache, with byte ranges so the player can seek */
async function serveOffline(req, url) {
  const r = await (await caches.open(AUDIO)).match(url.href, { ignoreVary: true, ignoreSearch: true });
  if (!r) return new Response("", { status: 404 });
  const range = req.headers.get("range"); if (!range) return r;
  const blob = await r.blob(), size = blob.size, m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const start = m[1] ? +m[1] : 0, end = Math.min(m[2] ? +m[2] : size - 1, size - 1);
  return new Response(blob.slice(start, end + 1), { status: 206, headers: { "Content-Type": r.headers.get("Content-Type") || "audio/wav",
    "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" } });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.includes("/offline/")) { e.respondWith(serveOffline(req, url)); return; }
  if (req.headers.has("range")) return;
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then(r => keep(SHELL, req, r))
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
    return;
  }
  if (url.hostname === "proton.api.atomicassets.io" && /\/(templates|assets|accounts)/.test(url.pathname)) {
    e.respondWith(fetch(req).then(r => keep(RUNTIME, req, r)).catch(() => caches.match(req)));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => keep(RUNTIME, req, res))));
    return;
  }
});
