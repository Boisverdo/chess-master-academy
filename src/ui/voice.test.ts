import { describe, expect, it } from 'vitest';
import { speakable } from './voice';

describe('texte lu par la voix de l’entraîneur', () => {
  it('retire la mise en forme et lit la notation des coups', () => {
    expect(speakable('**Td1+** chasse le roi.')).toBe('tour d1, échec chasse le roi.');
    expect(speakable('Ta8 mat, Dxf7#, e8=D et O-O.')).toBe('tour a8 mat, dame prend en f7, échec et mat, e8, promotion en dame et petit roque.');
    expect(speakable('Kd5, puis Kc6 : exd5.')).toBe('roi d5, puis roi c6 : e prend en d5.');
  });
  it('laisse les cases et les mots ordinaires intacts', () => {
    expect(speakable('Ton roi va en e4. De plus, Ta tour reste.')).toBe('Ton roi va en e4. De plus, Ta tour reste.');
  });
});
