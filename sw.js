// Sobe a versão do cache pra forçar a limpeza do cache antigo (que pode
// ter uma resposta "redirecionada" salva — era a causa do erro
// "Response served by service worker has redirections" no Safari/iOS).
const CACHE = "ronda-shell-v2";
const SHELL = [
  "./index.html",
  "./css/style.css",
  "./js/main.js",
  "./js/db.js",
  "./js/export.js",
  "./js/firebase-init.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Busca cada arquivo manualmente (em vez de cache.addAll) pra poder
      // ignorar qualquer resposta que tenha passado por redirecionamento
      // — o Safari recusa servir esse tipo de resposta pro app instalado.
      await Promise.all(SHELL.map(async (url) => {
        try {
          const res = await fetch(url, { cache: "reload" });
          if (res.ok && !res.redirected) await cache.put(url, res);
        } catch {
          // Sem rede no install: segue sem essa entrada, não trava o app.
        }
      }));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// App shell: cache-first for same-origin static assets.
// Firestore/API calls (cross-origin) always go to the network.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Navegação direto pra raiz ("/"): normaliza pro index.html cacheado,
  // evitando depender de como o servidor resolve "/" (que pode envolver
  // um redirecionamento — e é justamente isso que o Safari rejeita).
  const isNavigation = event.request.mode === "navigate";
  const cacheKey = isNavigation ? "./index.html" : event.request;

  event.respondWith(
    caches.match(cacheKey).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (event.request.method === "GET" && res.ok && !res.redirected) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(cacheKey, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
