/**
 * Extrait un sous-ensemble de la base de puzzles Lichess (CC0, https://database.lichess.org/#puzzles)
 * vers src/data/puzzles.json. Chaque solution est rejouée et vérifiée avec chess.js.
 *
 * Usage : node scripts/extract-puzzles.mjs <chemin/lichess_db_puzzle.csv.zst>
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { Chess } from 'chess.js';

const PER_BAND = 25;
const BANDS = Array.from({ length: 10 }, (_, i) => 400 + i * 200); // 400‑599 … 2200‑2399
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

const input = process.argv[2];
if (!input) throw new Error('Chemin du fichier .csv.zst requis');

/** Pièce qui réalise la fourchette : premier coup du joueur qui attaque au moins deux cibles importantes. */
function forkPiece(fen, moves) {
  const chess = new Chess(fen);
  for (let i = 0; i < moves.length; i++) {
    const m = chess.move({ from: moves[i].slice(0, 2), to: moves[i].slice(2, 4), promotion: moves[i][4] });
    if (i % 2 === 0) continue; // coups de l'adversaire
    const me = m.color;
    let targets = 0;
    for (const row of chess.board())
      for (const sq of row)
        if (sq && sq.color !== me && VALUE[sq.type] >= 3 && chess.attackers(sq.square, me).includes(m.to)) targets++;
    if (targets >= 2) return m.piece;
  }
  return null;
}

function classify(fen, moves, lt) {
  const has = (t) => lt.includes(t);
  const out = new Set();
  if (has('fork')) {
    const p = forkPiece(fen, moves);
    if (p === 'n' || p === 'p') out.add('fourchette');
    else if (p) out.add('attaque-double');
  }
  if (has('pin')) out.add('clouage');
  if (has('skewer')) out.add('enfilade');
  if (has('discoveredCheck') || has('doubleCheck')) out.add('echec-decouverte');
  else if (has('discoveredAttack')) out.add('attaque-decouverte');
  if (has('deflection')) out.add('deviation');
  if (has('attraction')) out.add('attraction');
  if (has('sacrifice')) out.add('sacrifice');
  if (has('interference')) out.add('interference');
  if (has('capturingDefender')) out.add('elimination-defenseur');
  if (has('hangingPiece')) out.add('piece-en-prise');
  if (has('sacrifice') && (has('long') || has('veryLong'))) out.add('combinaison');
  if (has('mateIn1')) out.add('mat-en-1');
  if (has('mateIn2')) out.add('mat-en-2');
  if (has('mateIn3')) out.add('mat-en-3');
  if (has('mateIn4') || has('mateIn5')) out.add('mat-en-4');
  return [...out];
}

function verify(fen, moves, isMate) {
  try {
    const chess = new Chess(fen);
    for (const u of moves) chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    return isMate ? chess.isCheckmate() : true;
  } catch {
    return false;
  }
}

const buckets = new Map(); // `${theme}|${band}` -> count
const picked = [];
let rows = 0;
let rejected = 0;
let header = true;
const rl = readline.createInterface({ input: fs.createReadStream(input).pipe(zlib.createZstdDecompress()), crlfDelay: Infinity });

for await (const line of rl) {
  if (header) {
    header = false;
    continue;
  }
  rows++;
  const [id, fen, movesStr, rating, rd, popularity, plays, themesStr] = line.split(',');
  const r = Number(rating);
  if (Number(popularity) < 80 || Number(plays) < 500 || Number(rd) > 90 || r < 400 || r >= 2400) continue;
  const band = BANDS.findLast((b) => r >= b);
  const lt = themesStr.split(' ');
  const moves = movesStr.split(' ');
  const quick = ['fork', 'pin', 'skewer', 'discoveredAttack', 'discoveredCheck', 'doubleCheck', 'deflection', 'attraction', 'sacrifice', 'interference', 'capturingDefender', 'hangingPiece', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5'];
  if (!quick.some((t) => lt.includes(t))) continue;
  let themes;
  try {
    themes = classify(fen, moves, lt);
  } catch {
    rejected++;
    continue;
  }
  const needed = themes.filter((t) => (buckets.get(`${t}|${band}`) ?? 0) < PER_BAND);
  if (needed.length === 0) continue;
  if (!verify(fen, moves, lt.includes('mate'))) {
    rejected++;
    continue;
  }
  for (const t of themes) buckets.set(`${t}|${band}`, (buckets.get(`${t}|${band}`) ?? 0) + 1);
  picked.push({ id, fen, moves: movesStr, rating: r, themes });
}

const byTheme = {};
for (const p of picked) for (const t of p.themes) byTheme[t] = (byTheme[t] ?? 0) + 1;
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync(
  'src/data/puzzles.json',
  JSON.stringify({ source: 'Lichess puzzle database (CC0) — https://database.lichess.org/#puzzles', extractedAt: new Date().toISOString().slice(0, 10), puzzles: picked }),
);
console.log(JSON.stringify({ rows, picked: picked.length, rejected, byTheme }, null, 1));
