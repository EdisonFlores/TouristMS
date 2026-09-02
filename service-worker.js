const CACHE_NAME = "moronabus-shell-v88";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/assets/icons/icon-maskable-512.png",
  "/css/styles.css",
  "/js/script.js",
  "/js/map/map.js",
  "/js/map/layers_ui.js",
  "/js/services/api.js",
  "/js/services/geoportal.js",
  "/data/geoportal/barrios.geojson",
  "/data/geoportal/parroquias.geojson",
  "/js/app/i18n.js",
  "/js/app/category_picker.js",
  "/js/app/service_status.js",
  "/js/app/tutorial.js",
  "/js/app/voice_assistant.js",
  "/assets/icons/favicon.svg",
  "/manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith("moronabus-shell-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Las solicitudes de terceros (por ejemplo GTM) deben resolverse fuera del
  // service worker. Interceptarlas provoca rechazos de FetchEvent cuando el
  // navegador, la red o un bloqueador impiden su descarga.
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/data/firestore/manifest.json") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response.ok) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || unavailableJson())
    );
    return;
  }

  if (url.pathname.startsWith("/data/firestore/") && url.pathname.endsWith(".json")) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (!response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      })).catch(() => unavailableJson())
    );
    return;
  }

  if (request.url.includes("/api/")) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ ok: false, error: "Se requiere internet para consultar datos actualizados" }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" }
        }
      ))
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () =>
        (await caches.match("/offline.html")) ||
        new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).catch(() =>
      new Response("Recurso no disponible", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    ))
  );
});

function unavailableJson() {
  return new Response(JSON.stringify({
    ok: false,
    error: "Sin conexión: estos datos todavía no están disponibles en el dispositivo"
  }), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
