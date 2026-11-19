/**
 * Service de mise en cache hors ligne de Chess Master Academy (généré à la compilation).
 * - À l'installation : tous les fichiers de l'application sont mis en cache (moteur et exercices compris).
 * - Ensuite : les fichiers de l'application sont servis depuis le cache ; la page d'accueil est
 *   d'abord demandée au réseau (pour recevoir les mises à jour), puis au cache si hors ligne.
 * - Les requêtes vers d'autres sites (API Chess.com) ne sont jamais interceptées ni mises en cache ici.
 */
const CACHE = 'cma-__VERSION__';
const FILES = __FILES__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cma-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', { ignoreVary: true }).then((r) => r || caches.match('index.html', { ignoreVary: true }))),
    );
    return;
  }
  // ignoreVary : les modules chargés à la demande portent un en-tête Origin, alors que les fichiers
  // ont été mis en cache sans lui ; sans cette option, le cache (« Vary: Origin ») ne les trouverait pas.
  event.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req)));
});
