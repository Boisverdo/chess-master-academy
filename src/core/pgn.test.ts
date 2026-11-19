import { describe, expect, it } from 'vitest';
import { ChessGame } from './game';
import { exportPgn, importPgn, parsePgn, splitPgn } from './pgn';

const IMMORTAL = `[Event "London"]
[Site "London ENG"]
[Date "1851.06.21"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5
9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6
16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8
22. Qf6+ Nxf6 23. Be7# 1-0`;

describe('import PGN', () => {
  it("lit la partie « Immortelle » jusqu'au mat", () => {
    const g = parsePgn(IMMORTAL);
    expect(g.length).toBe(45);
    expect(g.headers['White']).toBe('Adolf Anderssen');
    expect(g.status()).toMatchObject({ over: true, result: '1-0', termination: 'checkmate' });
  });
  it('accepte commentaires, variantes et NAG', () => {
    const g = parsePgn('1. e4 {meilleur coup} e5 (1... c5 2. Nf3) 2. Nf3! $1 Nc6 *');
    expect(g.plies.map((p) => p.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(g.status().over).toBe(false);
  });
  it('signale un coup illégal', () => {
    const r = importPgn('1. e4 e5 2. Ke3 *');
    expect(r.games).toHaveLength(0);
    expect(r.errors[0]?.message).toMatch(/illisible ou coup illégal/);
  });
  it('signale un texte vide', () => {
    expect(importPgn('   ').errors[0]?.message).toMatch(/Aucune partie/);
  });
  it('refuse les variantes non standard', () => {
    expect(() => parsePgn('[Variant "Chess960"]\n\n1. e4 *')).toThrow(/non prise en charge/);
  });
  it('importe plusieurs parties et isole celle qui est invalide', () => {
    const text = `${IMMORTAL}\n\n[Event "B"]\n[Result "*"]\n\n1. e4 e5 2. Ke3 *\n\n[Event "C"]\n[Result "0-1"]\n\n1. d4 d5 0-1\n`;
    expect(splitPgn(text)).toHaveLength(3);
    const r = importPgn(text);
    expect(r.games).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.gameIndex).toBe(1);
  });
  it('conserve un résultat enregistré sans mat (abandon, temps…)', () => {
    const g = parsePgn('[Result "0-1"]\n\n1. d4 d5 0-1');
    expect(g.status()).toMatchObject({ over: true, result: '0-1', termination: 'recorded-result' });
  });
  it('lit une partie commençant depuis une position FEN', () => {
    const g = parsePgn('[SetUp "1"]\n[FEN "7k/8/6K1/8/8/8/8/R7 w - - 0 1"]\n\n1. Ra8# 1-0');
    expect(g.status().termination).toBe('checkmate');
  });
  it('accepte les fins de ligne Windows', () => {
    expect(parsePgn(IMMORTAL.replace(/\n/g, '\r\n')).length).toBe(45);
  });
});

describe('export PGN', () => {
  it('aller-retour sans perte', () => {
    const g = parsePgn(IMMORTAL);
    const again = parsePgn(exportPgn(g));
    expect(again.plies.map((p) => p.san)).toEqual(g.plies.map((p) => p.san));
    expect(again.headers['Black']).toBe('Lionel Kieseritzky');
  });
  it('ajoute les en-têtes par défaut et le résultat', () => {
    const pgn = exportPgn(ChessGame.fromSan(['e4', 'e5']), new Date(2026, 10, 19));
    expect(pgn).toContain('[Date "2026.11.19"]');
    expect(pgn).toContain('[Result "*"]');
    expect(pgn.trim().endsWith('*')).toBe(true);
  });
  it('enregistre un abandon', () => {
    const pgn = exportPgn(ChessGame.fromSan(['e4']).resign('b'));
    expect(pgn).toContain('[Result "1-0"]');
    expect(pgn).toContain('[Termination "Abandon"]');
    expect(parsePgn(pgn).status().result).toBe('1-0');
  });
  it('conserve la position de départ FEN', () => {
    const g = ChessGame.create('7k/8/6K1/8/8/8/8/R7 w - - 0 1').play('a1', 'a8')!;
    const back = parsePgn(exportPgn(g));
    expect(back.startFen).toBe('7k/8/6K1/8/8/8/8/R7 w - - 0 1');
    expect(back.status().termination).toBe('checkmate');
  });
});
