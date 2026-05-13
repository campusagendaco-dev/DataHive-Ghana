// SwiftData Ghana Background Service Worker Extensions
// Listens for push notification payloads from Deno/Supabase backend even when the tab is closed.

self.addEventListener('push', function(event) {
  console.log('[Push Worker] Push Received.');
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    console.error('Error parsing push message JSON:', err);
    // Fallback to text
    data = {
      title: 'SwiftData Update',
      body: event.data ? event.data.text() : 'You have a new update available.'
    };
  }

  const title = data.title || 'SwiftData Ghana';
  
  const options = {
    body: data.body || 'New alert received!',
    icon: data.icon || '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/dashboard',
      id: data.id
    },
    actions: [
      {
        action: 'open',
        title: 'Open SwiftData',
      }
    ],
    requireInteraction: false, // auto closes or stays until manually cleared depending on OS
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Push Worker] Notification Clicked.');
  
  event.notification.close();

  const targetUrl = event.notification.data.url || '/dashboard';

  // Focus on an existing client window if open, or open a new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If there's an active client matching or just open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return client.focus();
        }
      }
      // Otherwise, open it fresh
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
