/** Sauvegarde de la partie en cours (fidèle : abandon et nulle par accord sont conservés). */
import { ChessGame, START_FEN } from '../../core/game';
import { readJson, writeJson } from '../../ui/storage';

const KEY = 'cma.board.currentGame.v1';

interface SavedGame {
  startFen: string;
  sans: string[];
  end?: { type: 'resignation'; loser: 'w' | 'b' } | { type: 'agreement' };
  orientation: 'white' | 'black';
}

export function saveGame(game: ChessGame, orientation: 'white' | 'black'): void {
  const s = game.status();
  const data: SavedGame = { startFen: game.startFen, sans: game.plies.map((p) => p.san), orientation };
  if (s.termination === 'resignation') data.end = { type: 'resignation', loser: s.result === '1-0' ? 'b' : 'w' };
  if (s.termination === 'agreement') data.end = { type: 'agreement' };
  writeJson(KEY, data);
}

export function loadGame(): { game: ChessGame; orientation: 'white' | 'black' } {
  const data = readJson<SavedGame | null>(KEY, null);
  if (!data) return { game: ChessGame.create(), orientation: 'white' };
  try {
    let game = ChessGame.fromSan(data.sans, data.startFen || START_FEN);
    if (data.end?.type === 'resignation') game = game.resign(data.end.loser);
    if (data.end?.type === 'agreement') game = game.agreeDraw();
    return { game, orientation: data.orientation === 'black' ? 'black' : 'white' };
  } catch {
    // Sauvegarde corrompue : on repart d'une partie neuve plutôt que de planter.
    return { game: ChessGame.create(), orientation: 'white' };
  }
}
