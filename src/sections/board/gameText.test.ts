import { describe, expect, it } from 'vitest';
import { ChessGame } from '../../core/game';
import { describeStatus } from './gameText';

describe('phrases d’état', () => {
  it('trait et échec', () => {
    expect(describeStatus(ChessGame.create().status())).toBe('Trait aux Blancs');
    expect(describeStatus(ChessGame.fromSan(['e4', 'f5', 'Qh5+']).status())).toBe('Trait aux Noirs — échec !');
  });
  it('fins de partie', () => {
    expect(describeStatus(ChessGame.fromSan(['f3', 'e5', 'g4', 'Qh4#']).status())).toBe('Échec et mat — les Noirs gagnent');
    expect(describeStatus(ChessGame.create().resign('w').status())).toBe('Les Blancs abandonnent — les Noirs gagnent');
    expect(describeStatus(ChessGame.create().agreeDraw().status())).toBe('Nulle par accord mutuel');
  });
});
