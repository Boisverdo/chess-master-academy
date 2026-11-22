import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatSan } from '../../core/notation';
import type { PuzzleRun } from '../../learning/puzzles/puzzle';
import { solutionSteps, type WalkStep } from '../../learning/puzzles/walkthrough';
import { useSettings } from '../../ui/settings';

const VOICE_KEY = 'cma-voice';
const speechOk = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

function readVoicePref(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function frenchVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'fr-CA') ?? voices.find((v) => v.lang === 'fr-FR') ?? voices.find((v) => v.lang.toLowerCase().startsWith('fr'));
}

export interface Walkthrough {
  steps: WalkStep[];
  index: number;
  step: WalkStep;
  go: (i: number) => void;
}

/**
 * Lecteur de la solution : `active` vrai une fois l'exercice terminé.
 * Démarre sur la position finale (celle qui est déjà affichée).
 */
export function useWalkthrough(run: PuzzleRun | null, active: boolean): Walkthrough | null {
  const steps = useMemo(() => (run && active ? solutionSteps(run) : []), [run, active]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(Math.max(0, steps.length - 1)), [steps]);
  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(steps.length - 1, i))), [steps.length]);
  if (!steps.length) return null;
  const i = Math.min(index, steps.length - 1);
  return { steps, index: i, step: steps[i]!, go };
}

/** Explication de l'entraîneur, étape par étape, avec lecture à voix haute (synthèse vocale du navigateur). */
export function WalkthroughPanel({ walk }: { walk: Walkthrough }) {
  const { settings } = useSettings();
  const { steps, index, step, go } = walk;
  const [voice, setVoice] = useState(readVoicePref);
  const [playing, setPlaying] = useState(false);
  const canSpeak = speechOk();
  const timer = useRef<number | undefined>(undefined);
  const watchdog = useRef<number | undefined>(undefined);
  const latest = useRef({ index, playing, voice });
  latest.current = { index, playing, voice };

  const stopSpeech = () => {
    window.clearTimeout(timer.current);
    window.clearTimeout(watchdog.current);
    if (canSpeak) window.speechSynthesis.cancel();
  };

  // Lit l'étape ; en lecture automatique, passe à la suivante à la fin de la phrase.
  const say = useCallback(
    (i: number, auto: boolean) => {
      stopSpeech();
      const s = steps[i];
      if (!s) return;
      let moved = false;
      const advance = () => {
        if (moved || !auto || !latest.current.playing || latest.current.index !== i) return;
        moved = true;
        window.clearTimeout(watchdog.current);
        if (i + 1 < steps.length) {
          go(i + 1);
          timer.current = window.setTimeout(() => say(i + 1, true), 400);
        } else setPlaying(false);
      };
      if (canSpeak && latest.current.voice) {
        const u = new SpeechSynthesisUtterance(s.text);
        u.lang = 'fr-FR';
        const v = frenchVoice();
        if (v) {
          u.voice = v;
          u.lang = v.lang;
        }
        u.rate = 0.95;
        u.onend = () => (timer.current = window.setTimeout(advance, 700));
        u.onerror = () => (timer.current = window.setTimeout(advance, 2500));
        window.speechSynthesis.speak(u);
        // Certains appareils ne signalent jamais la fin de la phrase : on avance quand même.
        if (auto) watchdog.current = window.setTimeout(advance, 4000 + s.text.length * 110);
      } else if (auto) {
        // Sans voix : temps de lecture proportionnel à la longueur du texte.
        timer.current = window.setTimeout(advance, Math.min(9000, 1800 + s.text.length * 45));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps, go, canSpeak],
  );

  useEffect(() => () => stopSpeech(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (i: number) => {
    setPlaying(false);
    latest.current.playing = false;
    const j = Math.max(0, Math.min(steps.length - 1, i));
    go(j);
    say(j, false);
  };

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      latest.current.playing = false;
      stopSpeech();
      return;
    }
    const from = index >= steps.length - 1 ? 0 : index;
    setPlaying(true);
    latest.current.playing = true;
    go(from);
    latest.current.index = from;
    say(from, true);
  };

  const toggleVoice = () => {
    const v = !voice;
    setVoice(v);
    latest.current.voice = v;
    try {
      localStorage.setItem(VOICE_KEY, v ? 'on' : 'off');
    } catch {
      /* préférence non mémorisée */
    }
    if (!v) stopSpeech();
  };

  const moveNumber = (s: WalkStep) => (s.ply ? `${s.ply.fenBefore.split(' ')[5] ?? 1}${s.ply.color === 'w' ? '.' : '…'} ` : '');

  return (
    <div className="walkthrough" data-testid="walkthrough" data-step={index}>
      <div className="walk-head">
        <strong>Solution expliquée</strong>
        <span className="muted small" data-testid="walk-count">Étape {index + 1} / {steps.length}</span>
      </div>
      <ol className="walk-moves" aria-label="Coups de la solution">
        {steps.map((s, i) => (
          <li key={i}>
            <button type="button" className={`walk-move${i === index ? ' active' : ''}${s.mine ? ' mine' : ''}`} aria-current={i === index ? 'step' : undefined} onClick={() => goTo(i)}>
              {s.ply ? `${moveNumber(s)}${formatSan(s.ply.san, s.ply.color, settings.notation)}` : 'Départ'}
            </button>
          </li>
        ))}
      </ol>
      <div className={`walk-text feedback ${step.mine ? 'ok' : 'info'}`} aria-live="polite" data-testid="walk-text">
        <span className="walk-who">{step.ply ? (step.mine ? 'Ton coup' : 'Réponse de l’adversaire') : 'Position'}</span>
        <p>{step.text}</p>
      </div>
      <div className="row walk-controls">
        <button type="button" className="btn btn-small" onClick={() => goTo(index - 1)} disabled={index === 0} data-testid="walk-prev">◀ Précédent</button>
        <button type="button" className="btn btn-small btn-primary" onClick={togglePlay} data-testid="walk-play">
          {playing ? '⏸ Pause' : index >= steps.length - 1 ? '↺ Revoir depuis le début' : '▶ Lecture automatique'}
        </button>
        <button type="button" className="btn btn-small" onClick={() => goTo(index + 1)} disabled={index >= steps.length - 1} data-testid="walk-next">Suivant ▶</button>
        {canSpeak && (
          <button type="button" className={`btn btn-small${voice ? ' active' : ''}`} aria-pressed={voice} onClick={toggleVoice} data-testid="walk-voice">
            {voice ? '🔊 Voix' : '🔇 Voix coupée'}
          </button>
        )}
      </div>
      <p className="muted small">
        Flèche verte : ton coup · flèche bleue : l’adversaire · cercle rouge : pièce menacée · cercle jaune : pièce sacrifiée.
        {canSpeak ? ' La voix est celle de ton appareil.' : ''}
      </p>
    </div>
  );
}
