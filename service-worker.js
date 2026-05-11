const CACHE_NAME = 'cuenta-clara-v4-2-detalle-push';
const APP_SHELL = [
  './',
  './index.html',
  './logo.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then(res => res || caches.match('./index.html')))
  );
});

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data = {};

    try {
      data = event.data ? event.data.json() : {};
    } catch (e) {
      data = { body: event.data ? event.data.text() : '' };
    }

    if (!data || (!data.title && !data.body)) {
      try {
        const resp = await fetch('https://steep-butterfly-5ed1.jelr87.workers.dev/latest-notification?t=' + Date.now(), { cache: 'no-store' });
        const latest = await resp.json();
        if (resp.ok && latest && latest.ok) {
          data = latest;
        }
      } catch (e) {
        data = {};
      }
    }

    try {
      if (self.navigator && 'setAppBadge' in self.navigator) {
        await self.navigator.setAppBadge(1);
      }
    } catch (e) {
      // El badge puede no estar disponible en todos los navegadores.
    }

    const title = data.title || 'Cuenta Clara';
    const options = {
      body: data.body || 'Hay nuevos movimientos. Abre el visor para actualizar.',
      icon: data.icon || './icon-192.png',
      badge: data.badge || './icon-192.png',
      data: { url: data.url || 'https://aftvnowmty.github.io/excel/' },
      tag: 'cuenta-clara-actualizacion',
      renotify: true
    };

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : 'https://aftvnowmty.github.io/excel/';
  event.waitUntil((async () => {
    try {
      if (self.navigator && 'clearAppBadge' in self.navigator) {
        await self.navigator.clearAppBadge();
      }
    } catch (e) {
      // Ignorar si el sistema no permite limpiar badge.
    }

    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if ('focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
