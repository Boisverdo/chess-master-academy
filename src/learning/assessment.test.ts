import { describe, expect, it } from 'vitest';
import { ChessGame } from '../core/game';
import { computeAssessment, DEMO_GAME, puzzlePerformance, RULES_QUESTIONS, STRATEGY_QUESTIONS } from './assessment';
import { recommend } from './recommend';

describe('questions de l’évaluation', () => {
  it('positions valides et une seule bonne réponse', () => {
    for (const q of [...RULES_QUESTIONS, ...STRATEGY_QUESTIONS, DEMO_GAME.question]) {
      if (q.board) ChessGame.create(q.board.fen);
      expect(q.options.filter((o) => o.correct)).toHaveLength(1);
    }
  });
  it('les réponses factuelles sont vraies', () => {
    expect(ChessGame.create(RULES_QUESTIONS[0]!.board!.fen).status().termination).toBe('stalemate');
    expect(ChessGame.create(RULES_QUESTIONS[1]!.board!.fen).play('e1', 'g1')).toBeNull();
    expect(ChessGame.create(RULES_QUESTIONS[2]!.board!.fen).play('e5', 'd6')?.plies[0]?.isEnPassant).toBe(true);
    expect(ChessGame.create(RULES_QUESTIONS[3]!.board!.fen).status().termination).toBe('insufficient-material');
    expect(ChessGame.create(RULES_QUESTIONS[4]!.board!.fen).status().termination).toBe('checkmate');
    expect(ChessGame.fromSan(DEMO_GAME.moves).status().termination).toBe('checkmate');
  });
});

describe('calcul du niveau', () => {
  const base = { rulesTotal: 6, strategyTotal: 4 };
  it('débutant absolu si les règles ne sont pas connues', () => {
    expect(computeAssessment({ ...base, experience: 'decouverte', rulesCorrect: 2, strategyCorrect: 0, puzzles: [] }).level).toBe('debutant-absolu');
  });
  it('débutant si les règles sont connues mais la tactique faible', () => {
    const r = computeAssessment({ ...base, experience: 'rarement', rulesCorrect: 6, strategyCorrect: 2, puzzles: [{ rating: 600, success: true }, { rating: 900, success: false }, { rating: 1200, success: false }] });
    expect(r.level).toBe('debutant');
    expect(r.estimate).toBeDefined();
  });
  it('intermédiaire puis avancé selon la performance', () => {
    const mid = [600, 900, 1200, 1500].map((rating, i) => ({ rating, success: i < 3 }));
    expect(computeAssessment({ ...base, experience: 'regulier', rulesCorrect: 6, strategyCorrect: 3, puzzles: mid }).level).toBe('intermediaire');
    const strong = [600, 900, 1200, 1500, 1800, 2100].map((rating, i) => ({ rating, success: i < 5 }));
    expect(computeAssessment({ ...base, experience: 'club', rulesCorrect: 6, strategyCorrect: 4, puzzles: strong }).level).toBe('avance');
  });
  it('avancé ramené à intermédiaire si la stratégie est faible', () => {
    const strong = [600, 900, 1200, 1500, 1800, 2100].map((rating) => ({ rating, success: true }));
    expect(computeAssessment({ ...base, experience: 'club', rulesCorrect: 6, strategyCorrect: 1, puzzles: strong }).level).toBe('intermediaire');
  });
  it('performance bornée et sans exercice = pas d’estimation', () => {
    expect(puzzlePerformance([])).toBeUndefined();
    expect(puzzlePerformance([{ rating: 2100, success: true }])).toBe(2400);
    expect(puzzlePerformance([{ rating: 600, success: false }])).toBe(400);
  });
});

describe('séance du jour', () => {
  const now = 1_000_000_000;
  it('débutant : commence par les règles, puis tactique adaptée', () => {
    const r = recommend({ level: 'debutant', lessons: new Map(), openings: [], themeStats: [], now });
    expect(r[0]).toMatchObject({ kind: 'lesson', link: '/lecons/regles-echiquier' });
    expect(r.some((x) => x.link === '/tactiques')).toBe(true);
  });
  it('intermédiaire : principes d’abord', () => {
    const r = recommend({ level: 'intermediaire', lessons: new Map(), openings: [], themeStats: [], now });
    expect(r.find((x) => x.kind === 'lesson')?.link).toBe('/lecons/principes-verification');
  });
  it('priorité aux révisions dues et au thème faible', () => {
    const r = recommend({
      level: 'intermediaire',
      lessons: new Map(),
      openings: [{ openingId: 'italienne', reps: 1, ease: 2.5, intervalDays: 1, due: now - 1, lastSuccess: true, attempts: 1, updatedAt: 0 }],
      themeStats: [{ theme: 'fourchette', attempts: 8, successes: 2, rate: 0.25 }],
      now,
    });
    expect(r[0]).toMatchObject({ kind: 'opening', link: '/ouvertures/italienne' });
    expect(r.find((x) => x.kind === 'tactics')).toMatchObject({ link: '/tactiques?theme=fourchette' });
    expect(r.find((x) => x.kind === 'tactics')?.reason).toMatch(/25 %/);
  });
});
