import { describe, expect, it } from 'vitest';
import { ChessGame } from '../core/game';
import type { Attempt, Drill } from '../storage/db';
import { ENDGAMES, endgameStatus } from './endgames';
import { drillQueue, drillTags, missedPuzzles } from './mistakes';
import type { Puzzle } from './puzzles/puzzle';
import { pickRushPuzzle, RUSH_MAX_PLIES, rushRecords, rushStart, rushTarget } from './rush';
import puzzlesFile from '../data/puzzles.json';

const all = (puzzlesFile as { puzzles: Puzzle[] }).puzzles;
const att = (o: Partial<Attempt> & Pick<Attempt, 'kind' | 'refId' | 'at'>): Attempt => ({ themes: [], success: true, hints: 0, ...o });

describe('course contre la montre', () => {
  it('difficulté : départ sous la cote, montée régulière, bornes', () => {
    expect(rushStart(1000)).toBe(600);
    expect(rushStart(200)).toBe(400);
    expect(rushStart(2600)).toBe(1600);
    expect(rushTarget(600, 0)).toBe(600);
    expect(rushTarget(600, 10)).toBe(1200);
    expect(rushTarget(1600, 100)).toBe(2500);
  });

  it('choix : proche de la cible, court, jamais deux fois le même', () => {
    const used = new Set<string>();
    let r = 0;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 40; i++) {
      const target = rushTarget(600, i);
      const p = pickRushPuzzle(all, target, used, rnd)!;
      expect(p).toBeTruthy();
      expect(used.has(p.id)).toBe(false);
      expect(p.moves.split(' ').length).toBeLessThanOrEqual(RUSH_MAX_PLIES);
      expect(Math.abs(p.rating - target)).toBeLessThanOrEqual(150);
      used.add(p.id);
    }
    expect(pickRushPuzzle([], 1000, new Set())).toBeUndefined();
  });

  it('records : meilleur score par mode, dernière série', () => {
    const rec = rushRecords([
      att({ kind: 'rush', refId: '3min', at: 1, score: 12 }),
      att({ kind: 'rush', refId: '3min', at: 2, score: 8 }),
      att({ kind: 'rush', refId: 'survie', at: 3, score: 20 }),
      att({ kind: 'puzzle', refId: '3min', at: 4, score: 99 }),
    ]);
    expect(rec['3min']).toEqual({ best: 12, runs: 2, last: 8 });
    expect(rec.survie.best).toBe(20);
    expect(rec['5min']).toEqual({ best: 0, runs: 0 });
  });
});

describe('finales essentielles', () => {
  it('positions légales, objectifs cohérents, identifiants uniques', () => {
    expect(new Set(ENDGAMES.map((e) => e.id)).size).toBe(ENDGAMES.length);
    for (const e of ENDGAMES) {
      const g = ChessGame.create(e.step.fen);
      expect(g.status().over, e.id).toBe(false);
      // Le joueur est le camp au trait ; l'orientation de l'échiquier lui correspond.
      expect(e.step.orientation ?? 'white', e.id).toBe(g.turn === 'w' ? 'white' : 'black');
    }
  });

  it('état : maîtrisée seulement si réussie sans aide', () => {
    const s = endgameStatus([
      att({ kind: 'endgame', refId: 'mat-dame', at: 1, success: false }),
      att({ kind: 'endgame', refId: 'mat-dame', at: 2, success: true, hints: 1 }),
      att({ kind: 'endgame', refId: 'mat-tour', at: 3, success: true }),
      att({ kind: 'endgame', refId: 'inconnue', at: 4 }),
    ]);
    expect(s.get('mat-dame')).toEqual({ tries: 2, successes: 1, mastered: false, lastAt: 2 });
    expect(s.get('mat-tour')?.mastered).toBe(true);
    expect(s.has('inconnue')).toBe(false);
  });
});

describe('revue de mes erreurs', () => {
  it('exercices manqués : retirés après une reprise réussie, y compris ceux de la course', () => {
    const list = missedPuzzles([
      att({ kind: 'puzzle', refId: 'A', at: 1, success: false }),
      att({ kind: 'puzzle', refId: 'B', at: 2, success: false }),
      att({ kind: 'puzzle-review', refId: 'B', at: 5, success: true }),
      att({ kind: 'puzzle', refId: 'C', at: 3, success: true }),
      att({ kind: 'rush', refId: '3min', at: 4, score: 5, missed: ['D', 'C'] }),
    ]);
    expect(list).toEqual([
      { id: 'C', at: 4, from: 'course' },
      { id: 'D', at: 4, from: 'course' },
      { id: 'A', at: 1, from: 'tactiques' },
    ]);
  });

  it('positions à retravailler : jamais réussies d’abord, filtre par étiquette', () => {
    const d = (id: string, o: Partial<Drill>): Drill => ({ id, gameId: 1, ply: 1, fen: '', best: '', played: '', tags: [], reps: 0, ease: 2.5, intervalDays: 0, due: 0, attempts: 0, createdAt: 0, ...o });
    const drills = [d('a', { lastSuccess: true, due: 1, tags: ['finale'] }), d('b', { due: 5, tags: ['finale', 'piece-en-prise'] }), d('c', { lastSuccess: false, due: 2 })];
    expect(drillQueue(drills).map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(drillQueue(drills, 'finale').map((x) => x.id)).toEqual(['b', 'a']);
    expect(Object.fromEntries(drillTags(drills))).toEqual({ finale: 2, 'piece-en-prise': 1 });
  });
});
