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
  const timedOut = game.winReason === '手番の時間切れ';
  const resultText = game.draw
    ? game.winReason
    : timedOut
      ? `${won ? '相手' : 'あなた'}が制限時間内に着手できなかったため、${won ? 'あなた' : '相手'}の勝利です。`
      : `${won ? 'あなた' : '相手'}が${game.winReason}しました。`;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal result-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="閉じる" onClick={onClose}>
          ×
        </button>
        <h2>{game.draw ? '引き分け' : won ? '勝利!' : '敗北…'}</h2>
        <p>{resultText}</p>
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
