/** Identifiants stables, identiques sur tous les appareils (synchronisation). */

/** Empreinte FNV-1a 32 bits (déterministe, sans dépendance ; sert à distinguer, pas à sécuriser). */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Identifiant d'une partie. Une partie Chess.com a le même identifiant sur tous les appareils (son adresse) :
 * importée deux fois, elle n'est pas dupliquée. Les autres parties sont identifiées par leur date et leur contenu.
 */
export function gameUid(g: { uid?: string; source: string; externalId?: string; createdAt: number; pgn: string }): string {
  if (g.uid) return g.uid;
  if (g.externalId) return `${g.source}:${g.externalId}`;
  return `${g.source}:${g.createdAt}:${fnv1a(g.pgn)}`;
}

/** Clé d'un essai (exercice, leçon, révision…) : un même essai n'est jamais compté deux fois. */
export function attemptKey(a: { kind: string; refId: string; at: number }): string {
  return `${a.kind}|${a.refId}|${a.at}`;
}
