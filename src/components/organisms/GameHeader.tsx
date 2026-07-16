'use client';

import { Badge } from '@/components/atoms/Badge';
import type { SanitizedState } from '@/lib/battle-line/game';

export interface GameHeaderProps {
  game: SanitizedState;
  myTurn: boolean;
  onHelp: () => void;
}

export function GameHeader({ game, myTurn, onHelp }: GameHeaderProps) {
  let bannerText: string;
  if (game.winner != null || game.draw) bannerText = 'ゲーム終了';
  else if (game.pendingScout === game.seat) bannerText = '偵察:2枚戻してください';
  else bannerText = myTurn ? 'あなたの手番' : '相手の手番…';

  return (
    <header className="game-header">
      <div className="opp-info">
        <Badge label="相手" tone="opp" />
        <span className="hand-count">
          手札 <b>{game.oppHand.troop}</b>
          <small>部隊</small> + <b>{game.oppHand.tactic}</b>
          <small>戦術</small>
        </span>
        <span className="hand-count">
          使用済戦術 <b>{game.tacticsPlayed[1 - game.seat]}</b>
        </span>
      </div>
      <div className={`turn-banner${myTurn ? ' mine' : ''}`}>{bannerText}</div>
      <div className="deck-info">
        <span>
          部隊山 <b>{game.decks.troop}</b>
        </span>
        <span>
          戦術山 <b>{game.decks.tactic}</b>
        </span>
        <button className="btn-help" title="戦術カード一覧" aria-label="戦術カード一覧" onClick={onHelp}>
          ?
        </button>
      </div>
    </header>
  );
}
