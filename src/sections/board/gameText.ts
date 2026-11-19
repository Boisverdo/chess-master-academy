import type { GameStatus } from '../../core/game';

const SIDE = { w: 'Blancs', b: 'Noirs' } as const;

/** Phrase d'état de la partie, en français. */
export function describeStatus(s: GameStatus): string {
  if (!s.over) return `Trait aux ${SIDE[s.turn]}${s.inCheck ? ' — échec !' : ''}`;
  const winner = s.result === '1-0' ? 'les Blancs gagnent' : s.result === '0-1' ? 'les Noirs gagnent' : 'partie nulle';
  switch (s.termination) {
    case 'checkmate':
      return `Échec et mat — ${winner}`;
    case 'stalemate':
      return 'Pat — partie nulle';
    case 'threefold-repetition':
      return 'Nulle par triple répétition de la position';
    case 'fifty-move-rule':
      return 'Nulle par la règle des 50 coups';
    case 'insufficient-material':
      return 'Nulle par matériel insuffisant pour mater';
    case 'resignation':
      return `${s.result === '1-0' ? 'Les Noirs abandonnent' : 'Les Blancs abandonnent'} — ${winner}`;
    case 'agreement':
      return 'Nulle par accord mutuel';
    case 'recorded-result':
      return `Résultat enregistré : ${s.result} — ${winner}`;
    default:
      return `Partie terminée (${s.result})`;
  }
}
