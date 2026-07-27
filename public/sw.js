/// <reference lib="webworker" />

const CACHE_NAME = "atrium-v1";
const DATA_CACHE = "atrium-data-v1";

/** Assets to pre-cache on install */
const PRE_CACHE = ["/logo-v1.png", "/logo-v2.png", "/manifest.webmanifest", "/offline"];

/**
 * Portal data paths that use stale-while-revalidate.
 * Cached responses are served instantly; a fresh copy is fetched in the
 * background and the cache is updated for next time.
 */
const SWR_PATHS = [
  "/members",
  "/analytics",
  "/events",
  "/approvals",
  "/profile",
  "/notifications",
  "/pre-approved",
  "/position-requests",
  "/audit",
];

// ── Install: pre-cache critical assets ──────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE))
  );
  // Auto-activate without waiting for old tabs to close
  self.skipWaiting();
});

// ── Activate: clean up old caches ───────────────────────────────────
self.addEventListener("activate", (event) => {
  const keepCaches = new Set([CACHE_NAME, DATA_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => !keepCaches.has(key)).map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open tabs immediately (auto-update)
  self.clients.claim();
});

// ── Fetch ───────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ── Mutations (POST/PUT/DELETE) bust the data cache ───────────────
  if (request.method !== "GET") {
    event.respondWith(
      fetch(request).then((response) => {
        // Invalidate data cache so next navigation gets fresh data
        caches.delete(DATA_CACHE);
        return response;
      })
    );
    return;
  }

  // ── Skip: API routes & auth – always network ─────────────────────
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  // ── Stale-while-revalidate for portal data pages ─────────────────
  if (isSWRPath(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // ── Cache-first for static assets (images, fonts, CSS, JS) ───────
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // ── Network-first for everything else (HTML pages) ───────────────
  if (request.headers.get("accept")?.includes("text/html") || request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          
          return caches.match("/offline");
        })
    );
    return;
  }
});

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Stale-while-revalidate: return cached response immediately,
 * then fetch a fresh copy in the background and update the cache.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);

  // Always kick off a network fetch to update the cache
  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached); // If network fails, fall back to whatever we had

  // Return cached version instantly if available, otherwise wait for network
  return cached || networkFetch;
}

/** Check if pathname matches a stale-while-revalidate portal path */
function isSWRPath(pathname) {
  return SWR_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

/** Check if a pathname points to a static asset */
function isStaticAsset(pathname) {
  return /\.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|webp|avif)$/.test(
    pathname
  );
}

