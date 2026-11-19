/** Client Chess.com de l'application, avec le cache local des mois terminés. */
import { db } from '../../storage/db';
import { ChessComClient } from './client';

let client: ChessComClient | null = null;

export function chessComClient(): ChessComClient {
  client ??= new ChessComClient({
    cache: {
      get: async (url) => (await db.monthCache.get(url))?.games,
      set: async (url, games) => void (await db.monthCache.put({ url, games, savedAt: Date.now() })),
    },
  });
  return client;
}
