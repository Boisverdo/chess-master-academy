/** Signale aux écrans que les données du joueur ont changé (pour qu'ils se rafraîchissent). */
const listeners = new Set<() => void>();

export function onDataChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyDataChange(): void {
  for (const fn of listeners) fn();
}
