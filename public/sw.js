// Minimal service worker: makes SplitPay installable. Everything goes to the network
// (money data must always be fresh), and shared files are handled by the server at /share-target.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
