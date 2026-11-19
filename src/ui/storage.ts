/**
 * Accès protégé à localStorage (peut être bloqué : navigation privée, stockage désactivé).
 * Phase 2 seulement : la Phase 3 introduit IndexedDB (Dexie) pour le profil et l'historique.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : l'application continue sans persistance */
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignoré */
  }
}
