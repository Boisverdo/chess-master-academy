import { afterEach, describe, expect, it, vi } from 'vitest';
import { moveFeedback, moveKind, pieceCount } from './feedback';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const CAPTURE_BEFORE = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const CAPTURE_AFTER = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';

describe('retour sensoriel des coups', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('distingue coup simple, prise et échec', () => {
    expect(pieceCount(START)).toBe(32);
    expect(moveKind(START, AFTER_E4, false)).toBe('move');
    expect(moveKind(CAPTURE_BEFORE, CAPTURE_AFTER, false)).toBe('capture');
    expect(moveKind(CAPTURE_BEFORE, CAPTURE_AFTER, true)).toBe('check');
  });

  it('vibre seulement si le réglage est actif et si l’appareil le permet', () => {
    const vib = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate: vib });
    moveFeedback('move', { sound: false, vibration: false });
    expect(vib).not.toHaveBeenCalled();
    moveFeedback('capture', { sound: false, vibration: true });
    expect(vib).toHaveBeenCalledWith([18, 40, 18]);
    vi.stubGlobal('navigator', {});
    expect(() => moveFeedback('move', { sound: false, vibration: true })).not.toThrow();
  });

  it('sans audio disponible, le son est ignoré sans erreur', () => {
    expect(() => moveFeedback('check', { sound: true, vibration: false })).not.toThrow();
  });
});
