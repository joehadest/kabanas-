// =====================================================================
// Kabanas Delivery — Service Worker
// Estratégias:
//   - App shell (HTML de navegação): network-first com fallback offline
//   - Estáticos (JS/CSS/fonts/ícones da própria origem): network-first com fallback
//   - Imagens: cache-first com expiração simples (max entradas)
//   - API/Supabase: sempre network (dados dinâmicos, nunca cacheados)
// =====================================================================

const CACHE_VERSION = 'v3';
const APP_SHELL_CACHE = `kabanas-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `kabanas-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `kabanas-images-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

const APP_SHELL_URLS = ['/', OFFLINE_URL, '/manifest.json'];
const MAX_IMAGE_ENTRIES = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const validCaches = [APP_SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !validCaches.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxEntries);
  }
}

function isApiRequest(url) {
  return url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/');
}

function isImageRequest(request) {
  return request.destination === 'image';
}

function isStaticAsset(request) {
  return ['script', 'style', 'font'].includes(request.destination);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !isApiRequest(url)) return;

  // Nunca cachear chamadas dinâmicas (Supabase / API interna)
  if (isApiRequest(url)) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })));
    return;
  }

  // Navegação (HTML): network-first com fallback offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match(OFFLINE_URL))
    );
    return;
  }

  // Imagens: cache-first com limite de entradas
  if (isImageRequest(request)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(IMAGE_CACHE).then((cache) => {
            cache.put(request, clone);
            trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
          });
          return response;
        });
      })
    );
    return;
  }

  // JS/CSS/fonts: prioriza a rede para manter os bundles sincronizados ao HTML SSR.
  // O cache entra apenas como fallback quando o cliente estiver offline.
  if (isStaticAsset(request)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        try {
          const response = await fetch(request);
          cache.put(request, response.clone());
          return response;
        } catch {
          return (await cache.match(request)) || Response.error();
        }
      })
    );
  }
});

// Notificações push (status do pedido) — integrar com o backend futuramente
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kabanas Delivery', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
