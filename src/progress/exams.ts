/** Examens de connaissances (Module 14) : questions tirées du contenu vérifié de l'application. */
import { ChessGame } from '../core/game';
import { RULES_QUESTIONS } from '../learning/assessment';
import { REGLES } from '../learning/lessons/regles';
import { FINALES } from '../learning/lessons/finales';
import type { ChoiceStep, PlayStep } from '../learning/lessons/types';
import { OPENINGS } from '../learning/openings';
import type { Puzzle } from '../learning/puzzles/puzzle';

export type ExamId = 'examen-regles' | 'examen-tactique' | 'examen-ouvertures' | 'examen-finales';

export interface ExamDef {
  id: ExamId;
  title: string;
  description: string;
  /** Proportion de bonnes réponses requise. */
  pass: number;
}

export const EXAMS: ExamDef[] = [
  { id: 'examen-regles', title: 'Examen des règles', description: '10 questions sur les règles du jeu. Réussite : 80 %.', pass: 0.8 },
  { id: 'examen-tactique', title: 'Examen tactique', description: '10 exercices à ton niveau, un seul essai, sans indice. Réussite : 7 sur 10.', pass: 0.7 },
  { id: 'examen-ouvertures', title: 'Examen des ouvertures', description: '10 positions tirées des lignes principales : trouve le coup suivant. Réussite : 80 %.', pass: 0.8 },
  { id: 'examen-finales', title: 'Examen des finales', description: 'Trois positions à jouer contre l’ordinateur : mat avec la dame, Lucena, Philidor. Réussite : les trois.', pass: 1 },
];

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: readonly T[], rnd: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 10 questions de règles : questions des leçons et de l'évaluation (sans « Je ne sais pas »). */
export function rulesExam(seed: number): ChoiceStep[] {
  const fromLessons = REGLES.flatMap((l) => l.steps.filter((s): s is ChoiceStep => s.kind === 'choice'));
  const fromAssessment = RULES_QUESTIONS.map((q) => ({ ...q, options: q.options.filter((o) => o.label !== 'Je ne sais pas') }));
  const rnd = rng(seed);
  return shuffle([...fromLessons, ...fromAssessment], rnd)
    .slice(0, 10)
    .map((q) => ({ ...q, options: shuffle(q.options, rnd) }));
}

export interface OpeningQuestion extends ChoiceStep {
  openingName: string;
}

/** 10 questions « quel est le coup suivant de la ligne principale ? », avec deux coups légaux comme distracteurs. */
export function openingExam(seed: number): OpeningQuestion[] {
  const rnd = rng(seed);
  const out: OpeningQuestion[] = [];
  for (const o of shuffle(OPENINGS, rnd).slice(0, 10)) {
    const sans = o.mainLine.map(([s]) => s);
    const game = ChessGame.fromSan(sans);
    const mine = game.plies.filter((p) => (o.side === 'white' ? p.color === 'w' : p.color === 'b') && p.ply > 2);
    const target = mine[Math.floor(rnd() * mine.length)]!;
    const before = ChessGame.create(target.fenBefore);
    const legal = [...before.legalDests()].flatMap(([f, ts]) => ts.map((t) => before.play(f, t, before.isPromotion(f, t) ? 'q' : undefined)!.plies.at(-1)!.san));
    const distractors = shuffle(legal.filter((s) => s !== target.san), rnd).slice(0, 2);
    out.push({
      kind: 'choice',
      openingName: o.name,
      prompt: `${o.name} : quel est le coup suivant de la ligne principale ?`,
      board: { fen: target.fenBefore, orientation: o.side },
      options: shuffle([{ label: target.san, correct: true, feedback: o.mainLine[target.ply - 1]![1] }, ...distractors.map((d) => ({ label: d, correct: false, feedback: '' }))], rnd),
    });
  }
  return out;
}

/** 10 exercices proches de la cote du joueur, thèmes variés. */
export function tacticsExam(puzzles: readonly Puzzle[], rating: number, seed: number): Puzzle[] {
  const rnd = rng(seed);
  const near = shuffle(puzzles.filter((p) => Math.abs(p.rating - rating) <= 200), rnd);
  const out: Puzzle[] = [];
  const themes = new Set<string>();
  for (const p of near) {
    if (out.length === 10) break;
    if (p.themes.some((t) => themes.has(t)) && near.length > 40) continue;
    out.push(p);
    p.themes.forEach((t) => themes.add(t));
  }
  for (const p of near) if (out.length < 10 && !out.includes(p)) out.push(p);
  return out;
}

/** Les trois positions de l'examen de finales (déjà vérifiées par Stockfish dans les tests des leçons). */
export function endgameExam(): PlayStep[] {
  const plays = FINALES.flatMap((l) => l.steps.filter((s): s is PlayStep => s.kind === 'play'));
  const pick = (fen: string) => plays.find((p) => p.fen === fen)!;
  return [pick('8/8/8/4k3/8/8/8/4K2Q w - - 0 1'), pick('1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1'), pick('4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1')];
}
