const CACHE_NAME = 'dolar-elite-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    'https://cdn.jsdelivr.net/npm/apexcharts'
];

self.addEventListener('install', event => {
    // skipWaiting fuerza que el nuevo SW tome el control inmediatamente
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    // ESTRATEGIA: Red primero (Network First)
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Si la red responde, guardamos la nueva versión en caché
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si falla la red, buscamos en el caché
                return caches.match(event.request);
            })
    );
});

self.addEventListener('activate', event => {
    // claim permite al SW controlar la página inmediatamente
    event.waitUntil(clients.claim());
    
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});