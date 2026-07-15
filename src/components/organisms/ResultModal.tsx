'use client';

import Link from 'next/link';
import { Button } from '@/components/atoms/Button';
import type { SanitizedState } from '@/lib/battle-line/game';

export interface ResultModalProps {
  game: SanitizedState;
  onRematch: () => void;
}

export function ResultModal({ game, onRematch }: ResultModalProps) {
  if (game.winner == null) return null;
  const won = game.winner === game.seat;
  return (
    <div className="modal-backdrop">
      <div className="modal result-modal">
        <h2>{won ? '勝利!' : '敗北…'}</h2>
        <p>
          {won ? 'あなた' : '相手'}が{game.winReason}しました。
        </p>
        <div className="modal-actions">
          <Button variant="primary" onClick={onRematch}>
            もう一度対戦する
          </Button>
          <Link href="/" className="btn btn-ghost">
            トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
