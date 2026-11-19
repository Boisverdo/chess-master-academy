import { afterAll, describe, expect, it } from 'vitest';
import { createNodeEngine } from '../engine/node-engine';
import { evaluatePosition } from '../analysis/runner';
import { describeThreat, nullMoveFen } from '../analysis/extras';
import { judgeMove } from './retry';

const fmt = (s: string) => s;

describe('« Comprendre mon erreur » et « Retente ta chance » (Stockfish réel)', () => {
  const engine = createNodeEngine();
  afterAll(() => engine.terminate());
  const scholar = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';

  it('la menace adverse est calculée : mat en f7', async () => {
    const t = await describeThreat(engine, scholar, 'b', fmt);
    expect(t).toContain('menaçait de mater en 1 : Qxf7#');
  });
  it('position « passe ton tour » impossible si l’on est en échec', () => {
    expect(nullMoveFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1')).toBeNull();
  });
  it('une bonne défense est acceptée, une mauvaise est expliquée', async () => {
    const before = await evaluatePosition(engine, scholar, { depth: 12 });
    const good = await judgeMove(engine, before, 'g7g6', fmt);
    expect(good?.ok).toBe(true);
    const bad = await judgeMove(engine, before, 'g8f6', fmt);
    expect(bad?.ok).toBe(false);
    expect(bad?.explanation.sentences.join(' ')).toContain('mat en 1');
    expect(await judgeMove(engine, before, 'e8e6', fmt)).toBeNull();
  });
});
