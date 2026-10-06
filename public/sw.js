// Cache applicatif : réseau d'abord, cache en secours.
//
// Le nom du cache porte une version. L'incrémenter purge l'ancien cache au moment de
// l'activation : c'est le seul moyen de garantir qu'une page périmée ne survit pas à une
// mise en production. Un service worker qui sert un ancien login.html pointant vers des
// scripts disparus produit une page de connexion sans aucun effet visible.
const CACHE = 'novexa-v2';
const STATIC = ['/login.html', '/dashboard.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(STATIC.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Ne mettre en cache que les réponses valides. Mémoriser un 404 ou un 502
        // transitoire le ferait resservir hors ligne comme s'il était définitif.
        if (res && res.ok && res.type === 'basic') {
          const copie = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copie)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
