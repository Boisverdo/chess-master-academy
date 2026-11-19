/**
 * Copie le moteur Stockfish (WebAssembly, GPL-3.0) depuis node_modules vers public/engine,
 * d'où il est servi tel quel au navigateur. Lancé automatiquement avant dev, build et tests e2e.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'node_modules/stockfish/bin';
const DEST = 'public/engine';
const FILES = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm'];

fs.mkdirSync(DEST, { recursive: true });
for (const f of FILES) {
  const from = path.join(SRC, f);
  if (!fs.existsSync(from)) throw new Error(`Moteur introuvable : ${from}. Lancez « npm install ».`);
  fs.copyFileSync(from, path.join(DEST, f));
}
fs.copyFileSync('node_modules/stockfish/Copying.txt', path.join(DEST, 'COPYING-stockfish.txt'));
console.log(`Moteur Stockfish copié dans ${DEST}`);
