/**
 * BoardView — seul point de contact avec Chessground (GPL-3.0).
 * L'échiquier n'applique aucune règle : il affiche une position et les coups
 * légaux qu'on lui fournit, puis signale le déplacement choisi.
 * Remplacer Chessground ne demanderait de modifier que ce fichier.
 */
import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Key } from 'chessground/types';
import type { DrawShape } from 'chessground/draw';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import './board.css';
import { useOptionalSettings } from '../ui/settings';
import { moveFeedback, moveKind } from './feedback';

export type BoardColor = 'white' | 'black';

export interface BoardViewProps {
  fen: string;
  orientation: BoardColor;
  turnColor: BoardColor;
  /** Camp autorisé à bouger ; `undefined` = échiquier en lecture seule. */
  movableColor?: BoardColor;
  dests: Map<string, string[]>;
  lastMove?: [string, string];
  check: boolean;
  showDests: boolean;
  coordinates: boolean;
  /** Flèches et cercles imposés (ex. explications de l'entraîneur). */
  shapes?: DrawShape[];
  /** Change cette valeur pour forcer la resynchronisation (ex. promotion annulée). */
  syncKey?: number;
  onMove?: (from: string, to: string) => void;
  /** Clic sur une case (exercices de coordonnées). */
  onSelect?: (square: string) => void;
  ariaLabel?: string;
}

export function BoardView(props: BoardViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMoveRef = useRef(props.onMove);
  onMoveRef.current = props.onMove;
  const onSelectRef = useRef(props.onSelect);
  onSelectRef.current = props.onSelect;

  // Son et vibration quand un nouveau coup apparaît (le joueur, l'adversaire ou la navigation dans la partie).
  const settings = useOptionalSettings();
  const feedbackRef = useRef({ sound: settings.sound, vibration: settings.vibration });
  feedbackRef.current = { sound: settings.sound, vibration: settings.vibration };
  const prev = useRef({ fen: props.fen, last: props.lastMove?.join('') });
  useEffect(() => {
    const last = props.lastMove?.join('');
    const before = prev.current;
    prev.current = { fen: props.fen, last };
    if (!last || (last === before.last && props.fen === before.fen) || props.fen === before.fen) return;
    moveFeedback(moveKind(before.fen, props.fen, props.check), feedbackRef.current);
  }, [props.fen, props.lastMove, props.check]);

  const config = (): Config => ({
    fen: props.fen,
    orientation: props.orientation,
    turnColor: props.turnColor,
    check: props.check,
    lastMove: props.lastMove as Key[] | undefined,
    coordinates: props.coordinates,
    viewOnly: false,
    movable: {
      free: false,
      color: props.movableColor,
      dests: props.movableColor ? (props.dests as Map<Key, Key[]>) : new Map(),
      showDests: props.showDests,
      events: { after: (orig, dest) => onMoveRef.current?.(orig, dest) },
    },
    premovable: { enabled: false },
    draggable: { enabled: true, showGhost: true },
    selectable: { enabled: true },
    animation: { enabled: true, duration: 180 },
    highlight: { lastMove: true, check: true },
    drawable: { enabled: true, visible: true, autoShapes: props.shapes ?? [] },
    events: { select: (key) => onSelectRef.current?.(key) },
  });

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, config());
    return () => {
      api.current?.destroy();
      api.current = null;
    };
    // Création unique ; les mises à jour passent par l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.current?.set(config());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fen, props.orientation, props.turnColor, props.movableColor, props.dests, props.lastMove, props.check, props.showDests, props.coordinates, props.shapes, props.syncKey]);

  return (
    <div className="board-frame" role="application" aria-label={props.ariaLabel ?? 'Échiquier'}>
      <div ref={el} className="cg-wrap cma-board" data-testid="board" />
    </div>
  );
}
