import { BLACK_OPENINGS } from './black';
import type { Opening } from './types';
import { WHITE_OPENINGS } from './white';

export const OPENINGS: Opening[] = [...WHITE_OPENINGS, ...BLACK_OPENINGS];

export const findOpening = (id: string) => OPENINGS.find((o) => o.id === id);

export const sanList = (moves: string) => moves.trim().split(/\s+/);
