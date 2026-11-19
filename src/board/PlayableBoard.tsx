/**
 * Échiquier « exercice » : affiche une position, propose ses coups légaux et gère la promotion.
 * Le parent reçoit le coup choisi et décide de la suite (vérification, réponse adverse…).
 */
import { useMemo, useState } from 'react';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { ChessGame, type PromotionPiece, type Square } from '../core/game';
import { PromotionPicker } from '../sections/board/PromotionPicker';
import { useSettings } from '../ui/settings';
import { BoardView, type BoardColor } from './BoardView';

export interface SimpleShape {
  orig: string;
  dest?: string;
  brush?: string;
}

interface Props {
  fen: string;
  orientation?: BoardColor;
  /** Faux = lecture seule. */
  interactive?: boolean;
  shapes?: SimpleShape[];
  lastMove?: [string, string];
  syncKey?: number;
  onMove?: (from: Square, to: Square, promotion?: PromotionPiece) => void;
  onSelect?: (square: string) => void;
  ariaLabel?: string;
}

const toColor = (c: 'w' | 'b'): BoardColor => (c === 'w' ? 'white' : 'black');
const EMPTY = new Map<Square, Square[]>();

export function PlayableBoard({ fen, orientation, interactive = false, shapes, lastMove, syncKey = 0, onMove, onSelect, ariaLabel }: Props) {
  const { settings } = useSettings();
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [localSync, setLocalSync] = useState(0);

  const game = useMemo(() => {
    try {
      return ChessGame.create(fen);
    } catch {
      return null; // échiquier d'illustration (ex. vide) : affichage seul
    }
  }, [fen]);

  const turn = game ? toColor(game.turn) : 'white';
  const dests = useMemo(() => (game && interactive ? game.legalDests() : EMPTY), [game, interactive]);
  const drawShapes = useMemo(() => (shapes ?? []).map((s) => ({ orig: s.orig as Key, dest: s.dest as Key | undefined, brush: s.brush ?? 'green' }) as DrawShape), [shapes]);

  const handleMove = (from: string, to: string) => {
    if (!game) return;
    if (game.isPromotion(from as Square, to as Square)) {
      setPromo({ from: from as Square, to: to as Square });
      return;
    }
    onMove?.(from as Square, to as Square);
  };

  return (
    <div className="board-holder">
      <BoardView
        fen={fen}
        orientation={orientation ?? 'white'}
        turnColor={turn}
        movableColor={interactive && game && !promo ? turn : undefined}
        dests={dests}
        lastMove={lastMove}
        check={game?.status().inCheck ?? false}
        showDests={settings.showLegalMoves}
        coordinates={settings.coordinates}
        shapes={drawShapes}
        syncKey={syncKey + localSync}
        onMove={handleMove}
        onSelect={onSelect}
        ariaLabel={ariaLabel}
      />
      {promo && (
        <PromotionPicker
          color={turn}
          onPick={(p) => {
            const m = promo;
            setPromo(null);
            onMove?.(m.from, m.to, p);
          }}
          onCancel={() => {
            setPromo(null);
            setLocalSync((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
