// StudyHub service worker
// Enables showNotification() from the page, which Chrome shows as a real
// desktop popup even when the tab is in the background.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
