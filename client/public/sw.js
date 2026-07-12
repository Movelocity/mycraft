const PRECACHE_VERSION = "__PRECACHE_VERSION__";
const CACHE_NAME = `web-minecraft-app-${PRECACHE_VERSION}`;
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/maskable-192.svg",
  "/icons/maskable-512.svg",
];
const BUILD_ASSETS = [
  /* __PRECACHE_ASSETS__ */
];
const PRECACHE_URLS = [...new Set([...APP_SHELL, ...BUILD_ASSETS])];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(appShellFirst(request));
    return;
  }

  if (
    url.pathname.startsWith("/assets/") ||
    APP_SHELL.includes(url.pathname) ||
    BUILD_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
  }
});

async function appShellFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedShell = (await cache.match("/index.html")) || (await cache.match("/"));
  if (!navigator.onLine && cachedShell) return cachedShell;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) || cachedShell;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}
