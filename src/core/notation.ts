/**
 * Affichage de la notation algébrique.
 * Le stockage et le PGN restent en notation anglaise (standard international) ;
 * seul l'affichage est converti selon la préférence du joueur.
 */
import type { Color } from './game';

export type NotationStyle = 'figurine' | 'french' | 'english';

const FIGURINES: Record<Color, Record<string, string>> = {
  w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' },
  b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' },
};
/** Roi, Dame, Tour, Fou, Cavalier. */
const FRENCH: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' };

export function formatSan(san: string, color: Color, style: NotationStyle): string {
  if (style === 'english' || san.startsWith('O-O')) return san;
  const map = style === 'figurine' ? FIGURINES[color] : FRENCH;
  return san.replace(/[KQRBN]/g, (c) => map[c] ?? c);
}

export const PIECE_NAMES_FR: Record<string, string> = { q: 'Dame', r: 'Tour', b: 'Fou', n: 'Cavalier', k: 'Roi', p: 'Pion' };
