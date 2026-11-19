import { describe, expect, it } from 'vitest';
import { ChessGame, START_FEN, RulesError } from './game';

const sanList = (s: string) => s.trim().split(/\s+/);

describe('coups illégaux refusés', () => {
  const g = ChessGame.create();
  it('refuse un déplacement impossible', () => expect(g.play('e2', 'e5')).toBeNull());
  it('refuse de jouer une pièce adverse', () => expect(g.play('e7', 'e5')).toBeNull());
  it('refuse une case vide comme départ', () => expect(g.play('e4', 'e5')).toBeNull());
  it('refuse de laisser son roi en échec (pièce clouée)', () => {
    // Le cavalier e2 est cloué par la dame e7 sur le roi e1.
    const pinned = ChessGame.create('4k3/4q3/8/8/8/8/4N3/4K3 w - - 0 1');
    expect(pinned.play('e2', 'c3')).toBeNull();
    expect(pinned.legalDests().get('e2')).toBeUndefined();
  });
  it('refuse de déplacer le roi sur une case attaquée', () => {
    const g2 = ChessGame.create('4k3/8/8/8/8/8/3r4/4K3 w - - 0 1');
    expect(g2.play('e1', 'e2')).toBeNull();
    expect(g2.play('e1', 'd2')).not.toBeNull(); // prise de la tour non défendue
  });
  it('refuse un SAN invalide', () => expect(g.playSan('Qh5')).toBeNull());
  it('refuse une FEN invalide', () => expect(() => ChessGame.create('pas une position')).toThrow(RulesError));
  it('refuse une position impossible (roi en échec sans avoir le trait)', () => {
    expect(() => ChessGame.create('7k/8/6K1/7P/8/8/8/B7 w - - 0 1')).toThrow(/Position impossible/);
  });
  it('fromSan signale le coup fautif', () => expect(() => ChessGame.fromSan(['e4', 'e5', 'Ke3'])).toThrow(/demi-coup 3/));
});

describe('roque', () => {
  const ready = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
  it('petit et grand roque blancs', () => {
    const g = ChessGame.create(ready);
    expect(g.play('e1', 'g1')?.plies[0]?.san).toBe('O-O');
    expect(g.play('e1', 'c1')?.plies[0]?.san).toBe('O-O-O');
    const after = g.play('e1', 'g1')!;
    expect(after.pieceAt('f1')).toEqual({ color: 'w', type: 'r' });
    expect(after.pieceAt('g1')).toEqual({ color: 'w', type: 'k' });
  });
  it('petit et grand roque noirs', () => {
    const g = ChessGame.create(ready.replace(' w ', ' b '));
    expect(g.play('e8', 'g8')?.plies[0]?.san).toBe('O-O');
    const long = g.play('e8', 'c8')!;
    expect(long.plies[0]?.san).toBe('O-O-O');
    expect(long.pieceAt('d8')).toEqual({ color: 'b', type: 'r' });
  });
  it('interdit si une pièce est entre le roi et la tour', () => {
    expect(ChessGame.create().play('e1', 'g1')).toBeNull();
    expect(ChessGame.create('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1').play('e1', 'c1')).toBeNull();
  });
  it('interdit en étant en échec', () => {
    expect(ChessGame.create('4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1').play('e1', 'g1')).toBeNull();
  });
  it('interdit si le roi traverse une case attaquée', () => {
    expect(ChessGame.create('5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1').play('e1', 'g1')).toBeNull();
    expect(ChessGame.create('3r2k1/8/8/8/8/8/8/R3K2R w KQ - 0 1').play('e1', 'c1')).toBeNull();
  });
  it('interdit si le roi arrive sur une case attaquée', () => {
    expect(ChessGame.create('1k4r1/8/8/8/8/8/8/R3K2R w KQ - 0 1').play('e1', 'g1')).toBeNull();
  });
  it('autorisé si seule la tour (b1) traverse une case attaquée au grand roque', () => {
    expect(ChessGame.create('1r4k1/8/8/8/8/8/8/R3K2R w KQ - 0 1').play('e1', 'c1')).not.toBeNull();
  });
  it('interdit après un déplacement du roi, même revenu', () => {
    const g = ChessGame.create(ready);
    const back = g.play('e1', 'f1')!.play('a7', 'a6')!.play('f1', 'e1')!.play('a6', 'a5')!;
    expect(back.play('e1', 'g1')).toBeNull();
    expect(back.play('e1', 'c1')).toBeNull();
  });
  it("interdit du côté d'une tour qui a bougé, permis de l'autre côté", () => {
    const g = ChessGame.create('r3k2r/p7/8/8/8/8/8/R3K2R w KQkq - 0 1').play('h1', 'h2')!.play('a7', 'a6')!.play('h2', 'h1')!.play('a6', 'a5')!;
    expect(g.play('e1', 'g1')).toBeNull();
    expect(g.play('e1', 'c1')).not.toBeNull();
  });
  it('interdit si la tour a été capturée', () => {
    const g = ChessGame.create('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1').play('g2', 'h1')!;
    expect(g.play('e1', 'g1')).toBeNull();
  });
});

describe('prise en passant', () => {
  it('possible juste après la double avance', () => {
    const g = ChessGame.fromSan(sanList('e4 a6 e5 d5'));
    const ep = g.play('e5', 'd6');
    expect(ep).not.toBeNull();
    expect(ep!.plies.at(-1)?.isEnPassant).toBe(true);
    expect(ep!.pieceAt('d5')).toBeUndefined();
    expect(ep!.plies.at(-1)?.san).toBe('exd6');
  });
  it('impossible un coup plus tard', () => {
    const g = ChessGame.fromSan(sanList('e4 a6 e5 d5 a3 h6'));
    expect(g.play('e5', 'd6')).toBeNull();
  });
  it('impossible si elle expose son propre roi (clouage horizontal)', () => {
    const g = ChessGame.create('8/8/8/KPp4r/8/8/8/7k w - c6 0 2');
    expect(g.play('b5', 'c6')).toBeNull();
    expect(g.legalDests().get('b5')).toEqual(['b6']);
  });
});

describe('promotion', () => {
  const fen = '1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1';
  it('détecte la promotion et exige le choix de la pièce', () => {
    const g = ChessGame.create(fen);
    expect(g.isPromotion('a7', 'a8')).toBe(true);
    expect(g.isPromotion('e1', 'e2')).toBe(false);
    expect(g.play('a7', 'a8')).toBeNull();
  });
  it.each(['q', 'r', 'b', 'n'] as const)('promotion en %s', (p) => {
    const g = ChessGame.create(fen).play('a7', 'a8', p)!;
    expect(g.pieceAt('a8')).toEqual({ color: 'w', type: p });
  });
  it('promotion avec prise', () => {
    const g = ChessGame.create(fen).play('a7', 'b8', 'q')!;
    expect(g.plies[0]?.san).toBe('axb8=Q+');
  });
  it('sous-promotion en cavalier, avec et sans échec', () => {
    const quiet = ChessGame.create('8/5P2/8/4k3/8/8/8/K7 w - - 0 1').play('f7', 'f8', 'n')!;
    expect(quiet.plies[0]?.san).toBe('f8=N');
    const check = ChessGame.create('8/5P2/4k3/8/8/8/8/K7 w - - 0 1').play('f7', 'f8', 'n')!;
    expect(check.status().inCheck).toBe(true);
  });
  it('refuse une pièce de promotion sur un coup normal', () => {
    expect(ChessGame.create().play('e2', 'e4', 'q')).toBeNull();
  });
});

describe('fins de partie', () => {
  it('échec et mat (mat du lion)', () => {
    const g = ChessGame.fromSan(sanList('f3 e5 g4 Qh4#'));
    expect(g.status()).toMatchObject({ over: true, result: '0-1', termination: 'checkmate', inCheck: true });
    expect(g.legalDests().size).toBe(0);
    expect(g.play('a2', 'a3')).toBeNull();
  });
  it('mat du berger', () => {
    expect(ChessGame.fromSan(sanList('e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#')).status()).toMatchObject({ result: '1-0', termination: 'checkmate' });
  });
  it('pat', () => {
    const g = ChessGame.create('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(g.status()).toMatchObject({ over: true, result: '1/2-1/2', termination: 'stalemate', inCheck: false });
  });
  it.each([
    ['roi contre roi', '8/8/8/4k3/8/8/8/4K3 w - - 0 1'],
    ['roi et fou contre roi', '8/8/8/4k3/8/8/8/2B1K3 w - - 0 1'],
    ['roi et cavalier contre roi', '8/8/8/4k3/8/8/8/1N2K3 w - - 0 1'],
  ])('matériel insuffisant : %s', (_n, fen) => {
    expect(ChessGame.create(fen).status()).toMatchObject({ over: true, termination: 'insufficient-material' });
  });
  it('matériel suffisant : roi et tour contre roi', () => {
    expect(ChessGame.create('8/8/8/4k3/8/8/8/R3K3 w - - 0 1').status().over).toBe(false);
  });
  it('matériel insuffisant après la prise de la dernière pièce', () => {
    const g = ChessGame.create('8/8/8/4k3/8/8/4r3/4K3 w - - 0 1').play('e1', 'e2')!;
    expect(g.status().termination).toBe('insufficient-material');
  });
  it('triple répétition', () => {
    const g = ChessGame.fromSan(sanList('Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1'));
    expect(g.status().over).toBe(false);
    expect(g.playSan('Ng8')!.status()).toMatchObject({ over: true, termination: 'threefold-repetition', result: '1/2-1/2' });
  });
  it('règle des 50 coups', () => {
    const g = ChessGame.create('8/8/8/4k3/8/8/8/R3K3 w - - 99 80').play('a1', 'a2')!;
    expect(g.status()).toMatchObject({ over: true, termination: 'fifty-move-rule' });
  });
  it('un mat au 100e demi-coup prime sur la règle des 50 coups', () => {
    const g = ChessGame.create('7k/8/6K1/8/8/8/8/R7 w - - 99 80').play('a1', 'a8')!;
    expect(g.status()).toMatchObject({ termination: 'checkmate', result: '1-0' });
  });
  it('abandon et nulle par accord', () => {
    expect(ChessGame.create().resign('w').status()).toMatchObject({ over: true, result: '0-1', termination: 'resignation' });
    expect(ChessGame.create().resign('b').status().result).toBe('1-0');
    const draw = ChessGame.create().agreeDraw();
    expect(draw.status()).toMatchObject({ result: '1/2-1/2', termination: 'agreement' });
    expect(draw.play('e2', 'e4')).toBeNull();
  });
});

describe('historique et annulation', () => {
  const g = ChessGame.fromSan(sanList('e4 e5 Nf3 Nc6'));
  it('mémorise les positions de chaque demi-coup', () => {
    expect(g.length).toBe(4);
    expect(g.fenAt(0)).toBe(START_FEN);
    expect(g.fenAt(4)).toBe(g.fen);
    expect(g.fenAt(1)).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
  });
  it('annule un ou plusieurs demi-coups', () => {
    expect(g.undo().length).toBe(3);
    expect(g.undo(2).fen).toBe(g.fenAt(2));
    expect(g.undo(10).fen).toBe(START_FEN);
  });
  it('annuler après un abandon reprend la partie', () => {
    expect(g.resign('w').undo(0).status().over).toBe(false);
  });
  it("immutabilité : jouer ne modifie pas la partie d'origine", () => {
    g.play('f1', 'c4');
    expect(g.length).toBe(4);
  });
});

describe('notation UCI et pendule', () => {
  it('rejoue des coups UCI, promotion comprise', () => {
    const g = ChessGame.fromUci(['e2e4', 'e7e5', 'g1f3']);
    expect(g.plies.map((p) => p.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(ChessGame.create('4k3/P7/8/8/8/8/8/4K3 w - - 0 1').playUci('a7a8n')?.pieceAt('a8')).toEqual({ color: 'w', type: 'n' });
    expect(() => ChessGame.fromUci(['e2e5'])).toThrow(RulesError);
  });
  it('chute du drapeau : perte, ou nulle si l’adversaire ne peut pas mater', () => {
    expect(ChessGame.create().timeout('w').status()).toMatchObject({ over: true, result: '0-1', termination: 'timeout' });
    expect(ChessGame.create('4k3/8/8/8/8/8/3P4/4K1n1 w - - 0 1').timeout('w').status()).toMatchObject({ result: '1/2-1/2', termination: 'timeout-draw' });
    expect(ChessGame.create('4k3/7p/8/8/8/8/3P4/4K3 w - - 0 1').timeout('w').status().result).toBe('0-1');
  });
});
