const CACHE_NAME = "ronda-pet-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/db.js",
  "./js/config-firebase.js",
  "./js/data-default.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for our own files: always tries to fetch the latest version
// first (so updates show immediately), and only falls back to the cached
// copy when there's no connection (offline use).
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept cross-origin requests (Firestore, CDN scripts, fonts, etc.)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
