/** Évaluation initiale : questions, calcul du niveau et de la fourchette indicative. */
import type { AssessmentResult, Level } from '../storage/db';
import type { ChoiceStep } from './lessons/types';

export const EXPERIENCE_OPTIONS = [
  { id: 'decouverte', label: 'Je découvre les échecs', score: 0 },
  { id: 'rarement', label: 'Je connais les règles mais je joue rarement', score: 0.33 },
  { id: 'regulier', label: 'Je joue régulièrement (en ligne ou entre amis)', score: 0.66 },
  { id: 'club', label: 'Je joue en club ou en tournoi', score: 1 },
] as const;

export const GOAL_OPTIONS = [
  'Apprendre les règles',
  'Faire moins de gaffes',
  'Progresser en tactique',
  'Connaître mes ouvertures',
  'Maîtriser les finales',
  'Comprendre mes erreurs en partie',
];

const DONT_KNOW = { label: 'Je ne sais pas', correct: false, feedback: 'Pas de souci : cette notion sera dans ton parcours.' };

export const RULES_QUESTIONS: ChoiceStep[] = [
  {
    kind: 'choice',
    prompt: 'Les Noirs ont le trait. Quelle est la situation ?',
    board: { fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1' },
    options: [
      { label: 'Pat : partie nulle', correct: true, feedback: '' },
      { label: 'Échec et mat', correct: false, feedback: '' },
      { label: 'Les Noirs peuvent jouer', correct: false, feedback: '' },
      DONT_KNOW,
    ],
  },
  {
    kind: 'choice',
    prompt: 'Les Blancs peuvent-ils faire le petit roque ?',
    board: { fen: '5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1' },
    options: [
      { label: 'Non', correct: true, feedback: '' },
      { label: 'Oui', correct: false, feedback: '' },
      DONT_KNOW,
    ],
  },
  {
    kind: 'choice',
    prompt: 'Le pion noir vient de jouer d7-d5. Le pion blanc e5 peut-il le prendre ?',
    board: { fen: 'rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3' },
    options: [
      { label: 'Oui, en passant, en allant en d6', correct: true, feedback: '' },
      { label: 'Non, les pions ne prennent pas de côté', correct: false, feedback: '' },
      DONT_KNOW,
    ],
  },
  {
    kind: 'choice',
    prompt: 'Roi et fou contre roi seul : quel est le résultat ?',
    board: { fen: '8/8/8/4k3/8/8/8/2B1K3 w - - 0 1' },
    options: [
      { label: 'Nulle', correct: true, feedback: '' },
      { label: 'Les Blancs peuvent gagner', correct: false, feedback: '' },
      DONT_KNOW,
    ],
  },
  {
    kind: 'choice',
    prompt: 'Les Blancs ont le trait. Sont-ils échec et mat ?',
    board: { fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3' },
    options: [
      { label: 'Oui', correct: true, feedback: '' },
      { label: 'Non, le roi peut fuir', correct: false, feedback: '' },
      DONT_KNOW,
    ],
  },
  {
    kind: 'choice',
    prompt: 'Un pion arrive sur la dernière rangée. Que se passe-t-il ?',
    options: [
      { label: 'Il devient une dame, une tour, un fou ou un cavalier', correct: true, feedback: '' },
      { label: 'Il devient obligatoirement une dame', correct: false, feedback: '' },
      { label: 'Il reste un pion', correct: false, feedback: '' },
      DONT_KNOW,
    ],
  },
];

export const STRATEGY_QUESTIONS: ChoiceStep[] = [
  {
    kind: 'choice',
    prompt: 'Après 1.e4 e5, quel coup des Blancs respecte le mieux les principes de l’ouverture ?',
    board: { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
    options: [
      { label: 'Cf3 : développe en attaquant e5', correct: true, feedback: '' },
      { label: 'Dh5 : attaque tout de suite', correct: false, feedback: '' },
      { label: 'a4 : gagne de l’espace', correct: false, feedback: '' },
      DONT_KNOW,
    ],
  },
  {
    kind: 'choice',
    prompt: 'Quelle pièce blanche est la plus mal placée ?',
    board: { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/N7/PPPP1PPP/R1BQKBNR w KQkq - 2 3' },
    options: [
      { label: 'Le cavalier a3', correct: true, feedback: '' },
      { label: 'Le pion e4', correct: false, feedback: '' },
      { label: 'Le roi e1', correct: false, feedback: '' },
      DONT_KNOW,
    ],
  },
  {
    kind: 'choice',
    prompt: 'Les deux camps se sont développés. Quel est le coup le plus important pour la sécurité du roi blanc ?',
    board: { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4' },
    options: [
      { label: 'Le petit roque', correct: true, feedback: '' },
      { label: 'h4, pour attaquer', correct: false, feedback: '' },
      { label: 'Re2', correct: false, feedback: '' },
      DONT_KNOW,
    ],
  },
];

/** Partie de démonstration (mat de Légal) suivie d'une question de compréhension. */
export const DEMO_GAME = {
  moves: ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'],
  question: {
    kind: 'choice',
    prompt: 'Les Noirs ont perdu cette partie très courte. Quelle a été leur erreur décisive ?',
    options: [
      { label: 'Prendre la dame (…Fxd1) sans voir le mat qui suivait', correct: true, feedback: '' },
      { label: 'Jouer 1…e5', correct: false, feedback: '' },
      { label: 'Développer le fou c8', correct: false, feedback: '' },
      DONT_KNOW,
    ],
  } as ChoiceStep,
};

/** Cotes visées pour les exercices de l'évaluation (difficulté croissante). */
export const ASSESSMENT_PUZZLE_RATINGS = [600, 900, 1200, 1500, 1800, 2100];

export interface AssessmentInput {
  experience: (typeof EXPERIENCE_OPTIONS)[number]['id'];
  rulesCorrect: number;
  rulesTotal: number;
  strategyCorrect: number;
  strategyTotal: number;
  /** Exercices tactiques présentés : cote et réussite. */
  puzzles: { rating: number; success: boolean }[];
}

/**
 * Performance de type Elo sur les exercices : moyenne des cotes + 400 × (réussites − échecs) / n.
 * Bornée à 400–2400. Ce n'est PAS un classement Elo officiel.
 */
export function puzzlePerformance(puzzles: AssessmentInput['puzzles']): number | undefined {
  if (puzzles.length === 0) return undefined;
  const avg = puzzles.reduce((s, p) => s + p.rating, 0) / puzzles.length;
  const net = puzzles.reduce((s, p) => s + (p.success ? 1 : -1), 0);
  return Math.round(Math.max(400, Math.min(2400, avg + (400 * net) / puzzles.length)));
}

export function computeAssessment(input: AssessmentInput, now = Date.now()): AssessmentResult {
  const rules = input.rulesTotal ? input.rulesCorrect / input.rulesTotal : 0;
  const strategy = input.strategyTotal ? input.strategyCorrect / input.strategyTotal : 0;
  const tactics = input.puzzles.length ? input.puzzles.filter((p) => p.success).length / input.puzzles.length : 0;
  const experience = EXPERIENCE_OPTIONS.find((e) => e.id === input.experience)?.score ?? 0;
  const perf = puzzlePerformance(input.puzzles);

  let level: Level;
  if (rules < 0.5 || (input.experience === 'decouverte' && rules < 0.84)) level = 'debutant-absolu';
  else if (rules < 0.84 || (perf ?? 0) < 1000) level = 'debutant';
  else if ((perf ?? 0) < 1600) level = 'intermediaire';
  else level = 'avance';
  if (level === 'avance' && strategy < 0.5) level = 'intermediaire';

  return {
    completedAt: now,
    scores: { rules, tactics, strategy, experience },
    level,
    estimate: perf !== undefined && level !== 'debutant-absolu' ? { low: Math.max(400, perf - 200), high: perf + 200 } : undefined,
  };
}
