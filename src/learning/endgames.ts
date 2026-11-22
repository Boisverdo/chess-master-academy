/**
 * Finales essentielles : positions à jouer contre Stockfish jusqu'à l'objectif.
 * Contenu original de Chess Master Academy. Chaque position est vérifiée par le moteur
 * (gagnable ou tenable contre le meilleur jeu) dans endgames.engine.test.ts.
 */
import type { Attempt } from '../storage/db';
import type { PlayStep } from './lessons/types';

export type EndgameGroup = 'mats' | 'pions' | 'tours' | 'dame';

export const ENDGAME_GROUPS: Record<EndgameGroup, string> = {
  mats: 'Mats de base',
  pions: 'Roi et pions',
  tours: 'Finales de tours',
  dame: 'Dame contre pion',
};

export interface Endgame {
  id: string;
  group: EndgameGroup;
  title: string;
  /** 1 : incontournable, 2 : important, 3 : difficile. */
  level: 1 | 2 | 3;
  /** L'idée à retenir, affichée avant de jouer. */
  idea: string;
  /** Leçon qui explique la technique en détail, si elle existe. */
  lesson?: string;
  step: PlayStep;
}

export const ENDGAMES: Endgame[] = [
  {
    id: 'mat-dame',
    group: 'mats',
    title: 'Roi et dame contre roi',
    level: 1,
    idea: 'La dame enferme le roi adverse dans une boîte de plus en plus petite, en restant à un saut de cavalier de lui. Ton roi vient ensuite aider. Attention au pat : laisse toujours une case au roi adverse tant que tu ne donnes pas mat.',
    lesson: 'finales-mats',
    step: { kind: 'play', prompt: 'Mate le roi noir en 15 coups au plus.', fen: '8/8/8/3k4/8/8/8/Q3K3 w - - 0 1', goal: 'mate', maxMoves: 15, hint: 'Rétrécis la boîte avec la dame, puis approche ton roi.', success: 'Mat ! Technique maîtrisée.' },
  },
  {
    id: 'mat-tour',
    group: 'mats',
    title: 'Roi et tour contre roi',
    level: 1,
    idea: 'La tour seule ne peut pas mater : les deux rois doivent se faire face. Quand le roi adverse est en opposition avec le tien, un échec de la tour le repousse d’une rangée.',
    lesson: 'finales-mats',
    step: { kind: 'play', prompt: 'Mate le roi noir en 25 coups au plus.', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', goal: 'mate', maxMoves: 25, hint: 'Coupe le roi avec la tour, approche ton roi, puis donne échec quand les rois sont face à face.', success: 'Mat avec la tour : une technique indispensable.' },
  },
  {
    id: 'mat-deux-tours',
    group: 'mats',
    title: 'Le mat de l’escalier (deux tours)',
    level: 1,
    idea: 'Les deux tours travaillent seules, sans l’aide du roi : l’une coupe une rangée, l’autre donne échec sur la rangée suivante, et ainsi de suite jusqu’au bord. Éloigne une tour si le roi adverse s’en approche.',
    step: { kind: 'play', prompt: 'Mate le roi noir en 12 coups au plus.', fen: '8/8/8/4k3/8/8/8/R3K2R w - - 0 1', goal: 'mate', maxMoves: 12, hint: 'Une tour coupe, l’autre donne échec : le roi recule d’une rangée à chaque fois.', success: 'Mat de l’escalier réussi.' },
  },
  {
    id: 'mat-deux-fous',
    group: 'mats',
    title: 'Roi et deux fous contre roi',
    level: 3,
    idea: 'Les deux fous côte à côte forment un mur que le roi adverse ne peut pas franchir. Avec ton roi, pousse-le vers un bord, puis vers un coin : le mat se donne dans le coin.',
    step: { kind: 'play', prompt: 'Mate le roi noir en 30 coups au plus.', fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', goal: 'mate', maxMoves: 30, hint: 'Place les fous côte à côte au centre, amène ton roi, et réduis l’espace diagonale après diagonale.', success: 'Mat avec les deux fous : une vraie technique de joueur confirmé.' },
  },
  {
    id: 'pion-cases-cles',
    group: 'pions',
    title: 'Roi et pion : atteindre une case clé',
    level: 1,
    idea: 'Les cases clés du pion e2 sont d4, e4 et f4. Si ton roi en occupe une, le pion va à dame quoi que fasse l’adversaire. Ici, les Blancs ont le trait : ils y arrivent.',
    lesson: 'finales-roi-pion',
    step: { kind: 'play', prompt: 'Les Blancs jouent : mène le pion à dame.', fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', goal: 'promote', maxMoves: 15, hint: 'Ke4 d’abord : le roi devant le pion, puis le pion suit.', success: 'Promotion ! Le roi devant le pion, c’est la clé.' },
  },
  {
    id: 'pion-opposition',
    group: 'pions',
    title: 'Roi et pion : défendre par l’opposition',
    level: 1,
    idea: 'C’est la même position, mais les Noirs ont le trait. En plaçant leur roi face au roi blanc (une case entre eux), ils gardent les cases clés : nulle.',
    lesson: 'finales-roi-pion',
    step: { kind: 'play', prompt: 'Avec les Noirs, tiens la nulle pendant 20 coups.', fen: '8/8/4k3/8/8/4K3/4P3/8 b - - 0 1', orientation: 'black', goal: 'draw', maxMoves: 20, hint: 'Ke5 ! prend l’opposition. Ensuite, quand le roi blanc avance, recule droit devant le pion.', success: 'Nulle tenue : l’opposition au bon moment.' },
  },
  {
    id: 'pion-de-tour',
    group: 'pions',
    title: 'Le pion de tour',
    level: 2,
    idea: 'Un pion de tour ne gagne pas si le roi défenseur atteint le coin de promotion : il ne peut plus en être chassé. Reste dans le coin ou juste à côté, sans t’en éloigner.',
    step: { kind: 'play', prompt: 'Avec les Noirs, tiens la nulle pendant 10 coups.', fen: '1k6/8/P1K5/8/8/8/8/8 b - - 0 1', orientation: 'black', goal: 'draw', maxMoves: 10, hint: 'Va dans le coin (a8) ou reste à côté : ne t’éloigne jamais vers c8.', success: 'Nulle : le coin est imprenable.' },
  },
  {
    id: 'regle-du-carre',
    group: 'pions',
    title: 'La règle du carré',
    level: 1,
    idea: 'Trace le carré du pion jusqu’à sa case de promotion (ici de a4 à e8). Si ton roi peut y entrer, il rattrape le pion. Va en diagonale : c’est le chemin le plus court.',
    lesson: 'finales-carre',
    step: { kind: 'play', prompt: 'Avec les Noirs, rattrape le pion blanc.', fen: '8/8/8/8/P3k3/8/8/7K b - - 0 1', orientation: 'black', goal: 'draw', maxMoves: 8, hint: 'Kd5, puis Kc6 : la diagonale vers la case de promotion.', success: 'Pion rattrapé : il ne reste que deux rois, nulle.' },
  },
  {
    id: 'percee',
    group: 'pions',
    title: 'La percée de pions',
    level: 2,
    idea: 'Trois pions contre trois, rois éloignés : en sacrifiant un pion au bon endroit, tu crées un pion passé que personne ne peut arrêter. Le coup clé se joue sur le pion du milieu.',
    step: { kind: 'play', prompt: 'Les Blancs jouent : obtiens une dame en 6 coups au plus.', fen: '7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1', goal: 'promote', maxMoves: 6, hint: 'b6 ! Si un pion noir prend, pousse le pion voisin du même côté de la prise pour sacrifier encore.', success: 'Percée réussie : un pion passé gagne la course.' },
  },
  {
    id: 'lucena',
    group: 'tours',
    title: 'La position de Lucena (construire un pont)',
    level: 2,
    idea: 'Ton pion est en 7e rangée, ton roi devant lui. Chasse d’abord le roi adverse avec un échec, puis place ta tour en 4e rangée : elle servira de « pont » pour arrêter les échecs de la tour adverse.',
    lesson: 'finales-tours',
    step: { kind: 'play', prompt: 'Promeus ton pion contre l’ordinateur.', fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', goal: 'promote', maxMoves: 15, hint: 'Td1+ chasse le roi noir ; ensuite Td4 prépare le pont.', success: 'Pont construit, pion promu : Lucena maîtrisée.' },
  },
  {
    id: 'philidor',
    group: 'tours',
    title: 'La défense de Philidor',
    level: 2,
    idea: 'Ta tour garde la 6e rangée pour empêcher le roi adverse d’avancer. Dès que le pion arrive sur cette rangée, ta tour part tout au fond et donne échec par derrière : le roi n’a plus d’abri.',
    lesson: 'finales-tours',
    step: { kind: 'play', prompt: 'Avec les Noirs, tiens la nulle pendant 15 coups.', fen: '4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1', orientation: 'black', goal: 'draw', maxMoves: 15, hint: 'Ta tour reste sur la 6e rangée tant que le pion n’y est pas arrivé.', success: 'Nulle tenue : la défense de Philidor.' },
  },
  {
    id: 'dame-contre-pion',
    group: 'dame',
    title: 'Dame contre pion en 7e rangée',
    level: 3,
    idea: 'Par des échecs et des clouages, oblige le roi adverse à se placer devant son pion : le pion est alors bloqué. Profite de ce temps pour rapprocher ton roi, et recommence jusqu’à prendre le pion.',
    step: { kind: 'play', prompt: 'Empêche la promotion et mate le roi noir en 45 coups au plus.', fen: 'K7/8/8/8/8/8/3pk3/7Q w - - 0 1', goal: 'mate', maxMoves: 45, hint: 'Échec ou clouage à chaque coup jusqu’à ce que le roi noir aille en d1, devant son pion. Alors seulement, avance ton roi.', success: 'Pion arrêté et roi maté : la technique est acquise.' },
  },
];

export const ENDGAME_BY_ID = new Map(ENDGAMES.map((e) => [e.id, e]));

export interface EndgameStatus {
  tries: number;
  successes: number;
  /** Réussie sans aide (sans « coup conseillé ») au moins une fois. */
  mastered: boolean;
  lastAt?: number;
}

/** État de chaque finale d'après les essais enregistrés (hints = 0 : réussie sans aide). */
export function endgameStatus(attempts: readonly Attempt[]): Map<string, EndgameStatus> {
  const out = new Map<string, EndgameStatus>();
  for (const a of attempts) {
    if (a.kind !== 'endgame' || !ENDGAME_BY_ID.has(a.refId)) continue;
    const s = out.get(a.refId) ?? { tries: 0, successes: 0, mastered: false };
    s.tries++;
    if (a.success) s.successes++;
    if (a.success && a.hints === 0) s.mastered = true;
    s.lastAt = Math.max(s.lastAt ?? 0, a.at);
    out.set(a.refId, s);
  }
  return out;
}
