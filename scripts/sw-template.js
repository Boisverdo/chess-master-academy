/**
 * Service de mise en cache hors ligne de Chess Master Academy (généré à la compilation).
 * - À l'installation : tous les fichiers de l'application sont mis en cache (moteur et exercices compris).
 *   Lors d'une mise à jour, seuls les fichiers modifiés sont téléchargés : les autres (même empreinte)
 *   sont recopiés depuis le cache de la version précédente.
 * - La nouvelle version attend que l'utilisateur choisisse « Recharger » (message SKIP_WAITING) :
 *   une mise à jour ne s'active jamais au milieu d'une partie ou d'un exercice.
 * - Ensuite : les fichiers de l'application sont servis depuis le cache ; la page d'accueil est
 *   d'abord demandée au réseau (pour recevoir les mises à jour), puis au cache si hors ligne.
 * - Les requêtes vers d'autres sites (API Chess.com) ne sont jamais interceptées ni mises en cache ici.
 */
const CACHE = 'cma-__VERSION__';
/** [chemin, empreinte du contenu] */
const FILES = __FILES__;
const REVS = '__revisions__';

async function previousCopy(url, rev) {
  for (const key of await caches.keys()) {
    if (!key.startsWith('cma-') || key === CACHE) continue;
    const old = await caches.open(key);
    const revs = await old.match(REVS).then((r) => (r ? r.json() : {})).catch(() => ({}));
    if (revs[url] !== rev) continue;
    const hit = await old.match(url, { ignoreVary: true });
    if (hit) return hit;
  }
  return null;
}

async function install() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    FILES.map(async ([url, rev]) => {
      let res = await previousCopy(url, rev);
      if (!res) {
        res = await fetch(new Request(url, { cache: 'reload' }));
        if (!res.ok) throw new Error(`${url} : ${res.status}`);
      }
      await cache.put(url, res);
    }),
  );
  await cache.put(REVS, new Response(JSON.stringify(Object.fromEntries(FILES)), { headers: { 'Content-Type': 'application/json' } }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(install());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
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
      // La page reçue n'est pas recopiée dans le cache : celui-ci garde la page qui va avec ses fichiers
      // (sinon, hors ligne, une page plus récente réclamerait des fichiers absents du cache).
      fetch(req).catch(() => caches.match('./', { ignoreVary: true }).then((r) => r || caches.match('index.html', { ignoreVary: true }))),
    );
    return;
  }
  // ignoreVary : les modules chargés à la demande portent un en-tête Origin, alors que les fichiers
  // ont été mis en cache sans lui ; sans cette option, le cache (« Vary: Origin ») ne les trouverait pas.
  event.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req)));
});
