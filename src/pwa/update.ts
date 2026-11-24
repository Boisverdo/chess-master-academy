/**
 * Mises à jour de l'application installée : la nouvelle version est préparée en arrière-plan,
 * puis proposée par un bandeau. Elle ne s'active que lorsque l'utilisateur choisit « Recharger ».
 */
type Listener = (ready: boolean) => void;

let waiting: ServiceWorker | null = null;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l(waiting !== null));

export function onUpdateReady(l: Listener): () => void {
  listeners.add(l);
  l(waiting !== null);
  return () => listeners.delete(l);
}

/** Active la nouvelle version, puis recharge la page quand elle a pris le relais. */
export function applyUpdate(): void {
  if (!waiting) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  waiting.postMessage('SKIP_WAITING');
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const offer = (w: ServiceWorker | null) => {
    // Sans service déjà actif, c'est une première installation : rien à proposer.
    if (!w || !navigator.serviceWorker.controller) return;
    waiting = w;
    notify();
  };
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => w.state === 'installed' && offer(w));
      });
      // Application laissée ouverte (téléphone) : chercher une mise à jour au retour.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
      });
    })
    .catch(() => {
      /* sans service worker, l'application fonctionne normalement en ligne */
    });
}
