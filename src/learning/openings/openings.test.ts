import { describe, expect, it } from 'vitest';
import { ChessGame } from '../../core/game';
import { OPENINGS, sanList } from './index';

describe('bibliothèque d’ouvertures', () => {
  it('7 ouvertures pour les Blancs, 7 pour les Noirs, identifiants uniques', () => {
    expect(OPENINGS.filter((o) => o.side === 'white')).toHaveLength(7);
    expect(OPENINGS.filter((o) => o.side === 'black')).toHaveLength(7);
    expect(new Set(OPENINGS.map((o) => o.id)).size).toBe(14);
  });

  for (const o of OPENINGS) {
    describe(o.name, () => {
      it('ligne principale légale, chaque coup expliqué', () => {
        const game = ChessGame.fromSan(o.mainLine.map(([san]) => san));
        expect(game.length).toBeGreaterThanOrEqual(10);
        for (const [san, why] of o.mainLine) expect(why.length, san).toBeGreaterThan(5);
      });
      it('variantes légales', () => {
        for (const v of o.variations) expect(() => ChessGame.fromSan(sanList(v.moves)), v.name).not.toThrow();
      });
      it('pièges légaux ; un piège « mat » se termine vraiment par un mat', () => {
        for (const t of o.traps) {
          const g = ChessGame.fromSan(sanList(t.moves));
          if (t.mate) expect(g.status().termination, t.name).toBe('checkmate');
          else expect(g.status().termination, t.name).not.toBe('checkmate');
        }
      });
      it('contenu pédagogique complet', () => {
        expect(o.ideas.length).toBeGreaterThanOrEqual(3);
        expect(o.plans.white.length).toBeGreaterThan(0);
        expect(o.plans.black.length).toBeGreaterThan(0);
        expect(o.mistakes.length).toBeGreaterThanOrEqual(3);
        expect(o.variations.length).toBeGreaterThanOrEqual(2);
      });
    });
  }
});
