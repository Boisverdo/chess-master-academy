/** Remonte en haut de la page (sans animation si l'utilisateur préfère réduire les animations). */
export function scrollToTop(): void {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo?.({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}
