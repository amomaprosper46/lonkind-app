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
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload?.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload?.notification?.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
