/* Πρόγραμμα · offline support.
 * Pages and the schedule API: network first, last copy when offline.
 * Build assets, fonts and icons: cache first (their URLs are content-hashed or stable). */

const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const DATA = `data-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, ASSETS, DATA].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(woff2?|png|svg)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSETS));
  } else if (url.pathname === "/api/schedule") {
    event.respondWith(networkFirst(request, DATA, { ignoreSearch: true }));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES, { fallbackUrl: "/" }));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName, { ignoreSearch = false, fallbackUrl } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(ignoreSearch ? new URL(request.url).pathname : request, response.clone());
    return response;
  } catch (error) {
    const hit =
      (await cache.match(ignoreSearch ? new URL(request.url).pathname : request)) ||
      (await cache.match(request, { ignoreSearch: true })) ||
      (fallbackUrl && (await cache.match(fallbackUrl, { ignoreSearch: true }))) ||
      (await cache.keys().then((keys) => (keys[0] ? cache.match(keys[0]) : undefined)));
    if (hit) return hit;
    throw error;
  }
}
