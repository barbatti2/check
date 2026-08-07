const CACHE = "ronda-pet-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/firebase.js",
  "./js/seed-data.js",
  "./js/export.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first para o app shell, network-first (sem cache) para tudo que é Firebase/API.
self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (url.includes("firestore") || url.includes("googleapis") || url.includes("gstatic") || url.includes("sheetjs") || url.includes("cdn")) {
    return; // deixa passar direto para a rede
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => cached))
  );
});
