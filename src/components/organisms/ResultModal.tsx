'use client';

import Link from 'next/link';
import { Button } from '@/components/atoms/Button';
import type { SanitizedState } from '@/lib/battle-line/game';

export interface ResultModalProps {
  game: SanitizedState;
  open: boolean;
  onRematch: () => void;
  onClose: () => void;
}

export function ResultModal({ game, open, onRematch, onClose }: ResultModalProps) {
  if ((game.winner == null && !game.draw) || !open) return null;
  const won = game.winner === game.seat;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal result-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="閉じる" onClick={onClose}>
          ×
        </button>
        <h2>{game.draw ? '引き分け' : won ? '勝利!' : '敗北…'}</h2>
        <p>{game.draw ? game.winReason : `${won ? 'あなた' : '相手'}が${game.winReason}しました。`}</p>
        <div className="modal-actions">
          <Button variant="primary" onClick={onRematch}>
            もう一度対戦する
          </Button>
          <Link href="/" className="btn btn-ghost">
            トップへ戻る
          </Link>
          <Button onClick={onClose}>盤面を確認する</Button>
        </div>
      </div>
    </div>
  );
}
