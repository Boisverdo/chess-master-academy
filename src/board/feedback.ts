/**
 * Retour sensoriel des coups : sons synthétisés (aucun fichier audio, aucune licence en jeu)
 * et vibration courte sur les appareils qui la proposent (Android ; pas Safari sur iPhone).
 * Les deux se règlent dans Paramètres ; le son est désactivé par défaut.
 */
export type MoveKind = 'move' | 'capture' | 'check';

/** Nombre de pièces dans la partie « placement » d'une FEN. */
export function pieceCount(fen: string): number {
  return (fen.split(' ')[0]!.match(/[prnbqk]/gi) ?? []).length;
}

/** Nature du coup qui mène de `prev` à `next` (une pièce de moins = prise). */
export function moveKind(prev: string, next: string, check: boolean): MoveKind {
  if (check) return 'check';
  return pieceCount(next) < pieceCount(prev) ? 'capture' : 'move';
}

export const canVibrate = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const PATTERNS: Record<MoveKind, number | number[]> = { move: 12, capture: [18, 40, 18], check: 45 };

export function vibrate(kind: MoveKind): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Vibration refusée par le navigateur : sans conséquence.
  }
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Petit « toc » de bois : bruit filtré très bref, plus une note grave. */
function knock(c: AudioContext, at: number, freq: number, gain: number): void {
  const len = Math.floor(c.sampleRate * 0.05);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq * 6;
  band.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = gain;
  noise.connect(band).connect(g).connect(c.destination);
  noise.start(at);

  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, at + 0.08);
  const og = c.createGain();
  og.gain.setValueAtTime(gain * 0.6, at);
  og.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  osc.connect(og).connect(c.destination);
  osc.start(at);
  osc.stop(at + 0.1);
}

export function playSound(kind: MoveKind): void {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.005;
  try {
    if (kind === 'move') knock(c, t, 190, 0.5);
    else if (kind === 'capture') {
      knock(c, t, 230, 0.6);
      knock(c, t + 0.06, 170, 0.45);
    } else {
      knock(c, t, 190, 0.5);
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 880;
      const g = c.createGain();
      g.gain.setValueAtTime(0.12, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(g).connect(c.destination);
      osc.start(t + 0.04);
      osc.stop(t + 0.32);
    }
  } catch {
    // Audio indisponible : sans conséquence.
  }
}

export function moveFeedback(kind: MoveKind, opts: { sound: boolean; vibration: boolean }): void {
  if (opts.sound) playSound(kind);
  if (opts.vibration) vibrate(kind);
}
