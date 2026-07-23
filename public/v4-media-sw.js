self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/v4-media/')) return;

  const proxyUrl = new URL(url.pathname.replace('/v4-media/', '/functions/v1/v4-player-proxy/player/jobs/'), 'https://supabase-proxy.utuberpraveen.workers.dev');
  proxyUrl.search = url.search;

  const range = event.request.headers.get('Range');
  if (range) proxyUrl.searchParams.set('__range', range);

  event.respondWith(fetch(proxyUrl.toString(), { method: 'GET' }));
});