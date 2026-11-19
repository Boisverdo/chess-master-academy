/** Moteur pour Node (tests et scripts uniquement — jamais importé par l'application). */
import { createRequire } from 'node:module';
import { Engine, type UciTransport } from './engine';

export function createNodeEngine(): Engine {
  const require = createRequire(import.meta.url);
  const listeners: ((l: string) => void)[] = [];
  const sf = require('stockfish')('lite-single', (line: string) => listeners.forEach((fn) => fn(line))) as {
    processCommand(c: string): void;
    terminate(): void;
  };
  const transport: UciTransport = { send: (c) => sf.processCommand(c), onLine: (fn) => listeners.push(fn), terminate: () => sf.terminate() };
  return new Engine(transport);
}
