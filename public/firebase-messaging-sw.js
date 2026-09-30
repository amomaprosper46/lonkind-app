importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAk4DcDNed4OWSahdV56ll1wI973-0wgS4",
  authDomain: "impactful-ideas.firebaseapp.com",
  databaseURL: "https://impactful-ideas-default-rtdb.firebaseio.com",
  projectId: "impactful-ideas",
  storageBucket: "impactful-ideas.firebasestorage.app",
  messagingSenderId: "494901200454",
  appId: "1:494901200454:web:0ea71cc5dbe22b22f6ac47"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload?.notification?.title || 'Lonkind';
  const notificationOptions = {
    body: payload?.notification?.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    // Deep-link data for click navigation
    data: payload?.data || {},
    // Show notification even if app is in focus (handled by foreground listener normally)
    requireInteraction: false,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — opens/focuses the app and navigates to the right page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.url || '/';

  // Fallback for older notifications that didn't send data.url
  if (!data.url) {
    if (data.type === 'new_comment' || data.type === 'new_reaction') {
      targetUrl = '/?view=home';
    } else if (data.type === 'new_message' && data.conversationId) {
      targetUrl = `/?view=messages&conversationId=${data.conversationId}`;
    } else if (data.type === 'new_follower' || data.type === 'friend_request') {
      targetUrl = '/?view=friends';
    } else if (data.type === 'payout_approved' || data.type === 'payout_rejected') {
      targetUrl = '/?view=wallet';
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
