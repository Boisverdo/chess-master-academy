/**
 * L'entraîneur explique un coup à partir de faits calculés :
 * évaluations Stockfish, variantes du moteur, matériel, pièces attaquées.
 * Chaque phrase correspond à un fait vérifiable ; rien n'est supposé.
 */
import type { Color } from '../core/game';
import type { MoveReview, PositionEval } from '../analysis/review';
import { CLASS_LABELS } from '../analysis/review';
import { loosePieces, materialSwing, moveFacts, pieceMaterial, pieceName, pvToSan, theirPiece } from './facts';

export type Fmt = (san: string, color: Color) => string;

export interface Explanation {
  verdict: string;
  sentences: string[];
  /** Meilleure suite (SAN) depuis la position avant le coup. */
  bestLine: string[];
  /** Suite qui réfute le coup joué (SAN) depuis la position après le coup. */
  refutation: string[];
  lesson?: { text: string; link: string; label: string };
  /** Étiquettes servant à détecter les habitudes. */
  tags: string[];
}

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
const pct = (v: number) => `${Math.round(v)} %`;

function list(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`;
}

function sanLine(sans: string[], startColor: Color, fmt: Fmt): string {
  let c = startColor;
  return sans
    .map((s) => {
      const out = fmt(s, c);
      c = other(c);
      return out;
    })
    .join(' ');
}

const LESSONS: Record<string, { text: string; link: string; label: string }> = {
  'mat-subi': { text: 'Après chaque coup envisagé, regarde tous les échecs que l’adversaire pourrait donner.', link: '/lecons/principes-verification', label: 'Revoir la routine échecs-prises-menaces' },
  'piece-en-prise': { text: 'Avant de valider un coup, vérifie que chacune de tes pièces reste protégée.', link: '/tactiques?theme=piece-en-prise', label: 'Exercices : pièces en prise' },
  'fourchette-subie': { text: 'Repère les cases d’où un cavalier ou un pion adverse attaquerait deux de tes pièces.', link: '/tactiques?theme=fourchette', label: 'Exercices : fourchettes' },
  'attaque-double-subie': { text: 'Méfie-toi des pièces adverses qui peuvent créer deux menaces d’un coup.', link: '/tactiques?theme=attaque-double', label: 'Exercices : attaques doubles' },
  'echange-defavorable': { text: 'Avant d’échanger, compte ce que tu donnes et ce que tu reçois.', link: '/lecons/regles-valeur', label: 'Revoir la valeur des pièces' },
  'occasion-manquee': { text: 'Quand l’adversaire se trompe, cherche d’abord les coups forcés : échecs, prises, menaces.', link: '/tactiques', label: 'Exercices tactiques' },
  'gain-manque': { text: 'Le gain était là : entraîne-toi à repérer les coups qui gagnent du matériel.', link: '/tactiques?theme=piece-en-prise', label: 'Exercices : pièces en prise' },
  'dame-precoce': { text: 'Dans l’ouverture, développe d’abord cavaliers et fous ; la dame sortie trop tôt se fait chasser.', link: '/lecons/principes-developpement', label: 'Revoir le développement' },
};

/**
 * @param you vrai si le coup est celui du joueur (« ta dame ») ; faux pour un coup de l'adversaire
 *            ou d'une partie d'autres joueurs (« la dame des Noirs »).
 */
export function explainMove(m: MoveReview, before: PositionEval, after: PositionEval, fmt: Fmt, you = true): Explanation {
  const me = m.color;
  const side = me === 'w' ? 'des Blancs' : 'des Noirs';
  const own = (p: Parameters<typeof pieceName>[0]) => (you ? pieceName(p) : `${theirPiece(p)} ${side}`);
  const opp = other(me);
  const tags: string[] = [];
  const sentences: string[] = [];
  const played = fmt(m.san, me);
  const bestLine = pvToSan(m.fenBefore, before.pv);
  const refutation = after.terminal ? [] : pvToSan(m.fenAfter, after.pv);

  if (m.cls === 'theorie') return { verdict: `${played} : coup de théorie, il fait partie des lignes connues de l’ouverture.`, sentences: [], bestLine, refutation, tags };
  if (m.cls === 'meilleur') {
    const v = m.bestUci === m.uci ? `${played} : c’est le meilleur coup selon le moteur.` : `${played} : excellent coup, aussi bon que la recommandation du moteur.`;
    return { verdict: v, sentences: [], bestLine, refutation, tags };
  }
  if (m.cls === 'bon') return { verdict: `${played} : bon coup. ${m.bestSan ? `Le moteur préférait de peu ${fmt(m.bestSan, me)}.` : ''}`.trim(), sentences: [], bestLine, refutation, tags };

  const verdict = `${CLASS_LABELS[m.cls]} : avec ${played}, ${you ? 'ta probabilité de gain' : `la probabilité de gain ${side}`} passe de ${pct(m.winBefore)} à ${pct(m.winAfter)}.`;
  if (m.missed) {
    sentences.push('Occasion manquée : l’adversaire venait de commettre une erreur, et ce coup ne l’exploite pas.');
    tags.push('occasion-manquee');
  }

  // 1. Ce que permet le coup joué.
  const reply = after.pv[0];
  const swing = after.terminal ? 0 : materialSwing(m.fenAfter, after.pv, me);
  if (after.score.mate !== undefined && after.score.mate > 0 && !after.terminal) {
    sentences.push(`Ce coup permet à l’adversaire de forcer le mat en ${after.score.mate} : ${sanLine(refutation.slice(0, after.score.mate * 2 - 1), opp, fmt)}.`);
    tags.push('mat-subi');
  } else if (reply) {
    const rf = moveFacts(m.fenAfter, reply);
    const replySan = rf ? fmt(rf.san, opp) : reply;
    if (rf?.captured && rf.captured !== 'p' && swing <= -2) {
      sentences.push(`Il permet ${replySan}, qui prend ${own(rf.captured)} en ${rf.to}.`);
      tags.push('piece-en-prise');
      if (m.san.includes('x')) tags.push('echange-defavorable');
    } else if (rf && swing <= -2 && (rf.targets.length >= 2 || (rf.check && rf.targets.length >= 1))) {
      const what = [...(rf.check ? [you ? 'ton roi' : `le roi ${side}`] : []), ...rf.targets.map((t) => own(t))];
      sentences.push(`Après ${replySan}, l’adversaire attaque ${list(what)} en même temps : une ${rf.piece === 'n' || rf.piece === 'p' ? 'fourchette' : 'attaque double'}.`);
      tags.push(rf.piece === 'n' || rf.piece === 'p' ? 'fourchette-subie' : 'attaque-double-subie');
    } else {
      const loose = loosePieces(m.fenAfter, me);
      if (loose.length && swing <= -2) {
        sentences.push(`Il laisse ${list(loose.map((l) => `${own(l.piece)} en ${l.square}`))} insuffisamment ${loose.length > 1 ? 'protégées' : 'protégé'}.`);
        tags.push('piece-en-prise');
      } else if (swing <= -1) {
        sentences.push(swing === -1
          ? `Après ${replySan}, l’adversaire gagne un pion : ${sanLine(refutation.slice(0, 5), opp, fmt)}.`
          : `Après ${replySan}, l’adversaire gagne environ ${-swing} points de matériel : ${sanLine(refutation.slice(0, 5), opp, fmt)}.`);
        if (m.san.includes('x')) tags.push('echange-defavorable');
      } else {
        sentences.push(`Le matériel ne change pas tout de suite, mais la position se dégrade : l’adversaire répondrait ${replySan}.`);
      }
    }
  }

  // 2. Pourquoi le coup recommandé est meilleur.
  if (before.best && m.bestSan) {
    const bf = moveFacts(m.fenBefore, before.best);
    const bestSan = fmt(m.bestSan, me);
    const parts: string[] = [];
    if (bf?.mate) parts.push('fait échec et mat');
    else {
      if (bf?.captured) parts.push(`prend ${theirPiece(bf.captured)}`);
      if (bf?.check) parts.push('donne échec');
      if (bf && bf.targets.length >= 2) parts.push(`attaque à la fois ${list(bf.targets.map(theirPiece))}`);
      else if (bf && bf.targets.length === 1 && !bf.captured) parts.push(`attaque ${theirPiece(bf.targets[0]!)}`);
    }
    const bestSwing = materialSwing(m.fenBefore, before.pv, me);
    if (before.score.mate !== undefined && before.score.mate > 0 && !bf?.mate) parts.push(`force le mat en ${before.score.mate}`);
    else if (bestSwing >= 2) parts.push(`gagne environ ${bestSwing} points de matériel`);
    sentences.push(parts.length ? `Le coup recommandé était ${bestSan}, qui ${list(parts)}.` : `Le coup recommandé était ${bestSan} ; suite principale : ${sanLine(bestLine.slice(0, 5), me, fmt)}.`);
    if (bestSwing >= 3 && !tags.includes('occasion-manquee')) tags.push('gain-manque');
  }

  // 3. Contexte de la partie (sert à repérer les habitudes).
  if (m.ply <= 20) tags.push('ouverture');
  if (pieceMaterial(m.fenBefore, 'w') <= 13 && pieceMaterial(m.fenBefore, 'b') <= 13) tags.push('finale');
  if (m.san.startsWith('Q') && Math.ceil(m.ply / 2) <= 6) tags.push('dame-precoce');
  if ((m.san.includes('x') || m.san.includes('+')) && m.loss >= 15) tags.push('erreur-de-calcul');

  const key = ['mat-subi', 'piece-en-prise', 'fourchette-subie', 'attaque-double-subie', 'echange-defavorable', 'occasion-manquee', 'gain-manque', 'dame-precoce'].find((t) => tags.includes(t));
  return { verdict, sentences, bestLine, refutation, lesson: key ? LESSONS[key] : { text: 'Compare ton coup avec le coup recommandé : quel plan chacun sert-il ?', link: '/lecons/principes-verification', label: 'Revoir la routine de réflexion' }, tags };
}

/** Développement lent : au 10e coup du joueur, au moins deux pièces mineures n'ont jamais bougé. */
export function slowDevelopment(fenAtMove10: string, color: Color): boolean {
  const rank = fenAtMove10.split(' ')[0]!.split('/')[color === 'w' ? 7 : 0]!;
  let file = 0;
  const at: Record<number, string> = {};
  for (const ch of rank) {
    if (/\d/.test(ch)) file += Number(ch);
    else at[file++] = ch;
  }
  const expect = color === 'w' ? { 1: 'N', 2: 'B', 5: 'B', 6: 'N' } : { 1: 'n', 2: 'b', 5: 'b', 6: 'n' };
  return Object.entries(expect).filter(([f, p]) => at[Number(f)] === p).length >= 2;
}
