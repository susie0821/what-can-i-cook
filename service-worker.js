// Lets the installed app open without internet: the app's own files are saved on
// the device, so our own cookbook still works offline. Online recipes still need a connection.
//
// Network first: when online, the newest version of each file is always used (and
// saved); the saved copy is only used when the network can't be reached.

const CACHE_NAME = "what-can-i-cook";
const APP_FILES = [
  "./",
  "index.html",
  "style.css",
  "data.js",
  "matching.js",
  "calories.js",
  "mealdb.js",
  "dummyjson.js",
  "stories.js",
  "app.js",
  "cooking.js",
  "receipt.js",
  "pixel-rain.js",
  "install.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Only the app's own files; recipe searches go straight to TheMealDB and DummyJSON.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});
