/* Sentinel AI — Service Worker
   Handles: static asset caching, offline fallback, background sync, push notifications
*/

const CACHE_VERSION = 'RIsiRXQmmXPmlP7a0aawc';
const STATIC_CACHE  = `sentinel-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `sentinel-runtime-${CACHE_VERSION}`;
const OFFLINE_URL   = '/offline.html';

// --- Install: precache the offline fallback ---------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon.svg', '/manifest.json']))
      .then(() => self.skipWaiting())
  );
});

// --- Activate: prune ALL sentinel-* caches from previous versions ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('sentinel-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// --- Fetch ------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests; skip API and WS
  if (request.method !== 'GET') return;
  if (url.hostname !== self.location.hostname) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return;

  // Exclude ALL /_next/* paths from SW caching.
  // Next.js chunks use content-hash filenames in production (handled by
  // browser HTTP cache with Cache-Control: immutable) and use plain names
  // in dev that change on every rebuild — SW caching either causes
  // stale webpack factory errors (TypeError: options.factory undefined).
  if (url.pathname.startsWith('/_next/')) return;

  // Public icons and manifests → cache-first.
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webp') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Navigation → network-first, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(
          (cached) => cached || caches.match(OFFLINE_URL)
        )
      )
    );
    return;
  }
});

// --- Background Sync --------------------------------------------------------
self.addEventListener('sync', (event) => {
  if (event.tag === 'incident-sync') {
    event.waitUntil(flushIncidentQueue());
  }
});

async function flushIncidentQueue() {
  let apiUrl = 'http://localhost:8000';
  try {
    const cache = await caches.open(STATIC_CACHE);
    const meta = await cache.match('/__sw_meta');
    if (meta) {
      const data = await meta.json();
      apiUrl = data.apiUrl || apiUrl;
    }
  } catch { /* use default */ }

  const db = await openDB();
  const tx  = db.transaction('queue', 'readwrite');
  const store = tx.objectStore('queue');
  const items = await idbGetAll(store);

  for (const item of items) {
    try {
      const res = await fetch(`${apiUrl}/api/incidents`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    item.body,
      });
      if (res.ok) {
        store.delete(item.id);
        const clients = await self.clients.matchAll();
        clients.forEach((c) => c.postMessage({ type: 'SYNC_COMPLETE', queueId: item.id }));
      }
    } catch { /* leave in queue */ }
  }
}

// --- Push Notifications -----------------------------------------------------
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Sentinel AI Alert', body: 'New incident reported' };
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Sentinel AI Alert', {
      body:  data.body ?? '',
      icon:  '/icons/icon.svg',
      badge: '/icons/icon.svg',
      tag:   data.tag ?? 'sentinel',
      data:  data,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(target));
      return existing ? existing.focus() : self.clients.openWindow(target);
    })
  );
});

// --- Messages from main thread ----------------------------------------------
self.addEventListener('message', async (event) => {
  if (event.data?.type === 'SET_API_URL') {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(
      '/__sw_meta',
      new Response(JSON.stringify({ apiUrl: event.data.url }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }
});

// --- Minimal IndexedDB helpers (same schema as offline-queue.ts) -----------
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('sentinel-offline', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}
