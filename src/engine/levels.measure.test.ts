/**
 * Tournoi de mesure des niveaux (long : lancé seulement avec MEASURE=1).
 *   MEASURE=1 npx vitest run src/engine/levels.measure.test.ts
 * Résultats écrits dans docs/mesures-niveaux.json.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ChessGame } from '../core/game';
import { createNodeEngine } from './node-engine';
import { chooseMove, levelById, type LevelDef } from './levels';
import { toWhite } from './uci';

const RANDOM: LevelDef = { id: 1, name: 'Aléatoire', description: '', search: { depth: 1, multipv: 1 } };

describe.skipIf(!process.env.MEASURE)('mesure des niveaux', () => {
  it('chaque niveau bat le précédent', { timeout: 3_600_000 }, async () => {
    const engine = createNodeEngine();
    await engine.init();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    async function play(white: LevelDef | null, black: LevelDef | null): Promise<number> {
      let g = ChessGame.create();
      while (!g.status().over && g.length < 160) {
        const lvl = g.turn === 'w' ? white : black;
        let mv: string | null;
        if (!lvl) {
          const all = [...g.legalDests()].flatMap(([f, ts]) => ts.map((t) => f + t + (g.isPromotion(f, t) ? 'q' : '')));
          mv = all[Math.floor(rnd() * all.length)]!;
        } else {
          const r = await engine.search(g.fen, lvl.search);
          mv = chooseMove(r.lines, lvl, rnd) ?? r.bestmove;
        }
        const next = mv ? g.playUci(mv) : null;
        if (!next) throw new Error(`coup illégal ${mv} en ${g.fen}`);
        g = next;
      }
      const s = g.status();
      if (s.over) return s.result === '1-0' ? 1 : s.result === '0-1' ? 0 : 0.5;
      const ev = await engine.search(g.fen, { depth: 12 });
      const w = toWhite(ev.lines[0]!.score, g.turn);
      const v = w.mate !== undefined ? Math.sign(w.mate) * 10000 : w.cp;
      return v >= 300 ? 1 : v <= -300 ? 0 : 0.5; // arbitrage après 160 demi-coups
    }

    const pairs: [number | null, number, number][] = [
      [null, 1, 10],
      [1, 2, 12],
      [2, 3, 12],
      [3, 4, 12],
      [4, 5, 8],
      [5, 6, 8],
    ];
    const results: { weaker: string; stronger: string; games: number; strongerScore: number }[] = [];
    for (const [a, b, n] of pairs) {
      const weak = a === null ? null : levelById(a);
      const strong = levelById(b);
      let score = 0;
      for (let i = 0; i < n; i++) {
        score += i % 2 === 0 ? await play(strong, weak) : 1 - (await play(weak, strong));
      }
      results.push({ weaker: weak?.name ?? RANDOM.name, stronger: strong.name, games: n, strongerScore: score });
      fs.writeFileSync('docs/mesures-niveaux.json', JSON.stringify({ date: new Date().toISOString().slice(0, 10), engine: engine.name, results }, null, 1));
    }
    engine.terminate();
    for (const r of results) expect(r.strongerScore / r.games, `${r.stronger} contre ${r.weaker}`).toBeGreaterThan(0.5);
  });
});
