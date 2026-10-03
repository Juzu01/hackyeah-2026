const CACHE_NAME = 'soleil-v3';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let data = { title: 'Soleil ☀️', body: 'Hej, jestem tu dla Ciebie!', url: '/' };
  if (event.data) { try { data = JSON.parse(event.data.text()); } catch {} }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logosoleil.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
