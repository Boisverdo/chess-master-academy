import { describe, expect, it } from 'vitest';
import { formatSan } from './notation';

describe('affichage de la notation', () => {
  it('notation française', () => {
    expect(formatSan('Nf3', 'w', 'french')).toBe('Cf3');
    expect(formatSan('Qxf7#', 'w', 'french')).toBe('Dxf7#');
    expect(formatSan('Rxe1+', 'b', 'french')).toBe('Txe1+');
    expect(formatSan('Bb5', 'w', 'french')).toBe('Fb5');
    expect(formatSan('Kd2', 'w', 'french')).toBe('Rd2');
    expect(formatSan('exd8=Q+', 'w', 'french')).toBe('exd8=D+');
    expect(formatSan('b1=N', 'b', 'french')).toBe('b1=C');
  });
  it('figurines selon la couleur', () => {
    expect(formatSan('Nf3', 'w', 'figurine')).toBe('♘f3');
    expect(formatSan('Nf6', 'b', 'figurine')).toBe('♞f6');
  });
  it('les pions, la colonne b et le roque restent intacts', () => {
    expect(formatSan('bxc3', 'w', 'french')).toBe('bxc3');
    expect(formatSan('O-O-O', 'b', 'figurine')).toBe('O-O-O');
    expect(formatSan('e4', 'w', 'english')).toBe('e4');
  });
});
