const CACHE_NAME = 'taiyo-rental-v3';
const OFFLINE_URL = '/offline.html';

// Core app assets to cache immediately
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/index.css',
    '/src/styles/ios-theme.css'
];

// External CDN resources to cache
const CDN_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/html5-qrcode',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('PWA: Caching core assets');
            await cache.addAll(CORE_ASSETS);

            // Try to cache CDN assets (may fail due to CORS, that's OK)
            for (const url of CDN_ASSETS) {
                try {
                    await cache.add(url);
                    console.log('PWA: Cached CDN asset:', url);
                } catch (e) {
                    console.log('PWA: Could not cache CDN asset:', url);
                }
            }
        })
    );
    self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('taiyo-rental-') && name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event - Stale-While-Revalidate strategy for better performance
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // For API calls (Supabase), use network-first
    if (url.hostname.includes('supabase') || url.pathname.startsWith('/api')) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // For static assets and CDN, use stale-while-revalidate
    event.respondWith(staleWhileRevalidate(event.request));
});

// Network-first strategy for API calls
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw error;
    }
}

// Stale-while-revalidate for static assets
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    // Fetch in background to update cache
    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => null);

    // Return cached response immediately, or wait for network
    if (cachedResponse) {
        return cachedResponse;
    }

    const networkResponse = await fetchPromise;
    if (networkResponse) {
        return networkResponse;
    }

    // Fallback to offline page for navigation
    if (request.mode === 'navigate') {
        return cache.match(OFFLINE_URL);
    }

    return new Response('Offline', { status: 503 });
}

// Handle messages from the app
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
