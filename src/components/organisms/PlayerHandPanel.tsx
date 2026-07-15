'use client';

import { Button } from '@/components/atoms/Button';
import { HandCard } from '@/components/molecules/HandCard';
import { DrawPrefToggle } from '@/components/molecules/DrawPrefToggle';
import type { DrawPref, SanitizedState } from '@/lib/battle-line/game';
import type { Action } from '@/hooks/useGameRoom';

export interface PlayerHandPanelProps {
  game: SanitizedState;
  myTurn: boolean;
  action: Action;
  drawPref: DrawPref;
  onDrawPrefChange: (v: DrawPref) => void;
  onSelectHandCard: (i: number) => void;
  onToggleReturnPick: (i: number) => void;
  onPass: () => void;
  onCancel: () => void;
}

const HINTS: Partial<Record<Action['mode'], string>> = {
  placeCard: '配置するフラッグを選んでください',
  pickMyCard: '移動する自分のカードを選んでください',
  pickDest: '移動先のフラッグ(自分側)を選んでください',
  scoutReturn: '山札に戻すカードを手札から2枚選んでください',
};

export function PlayerHandPanel({
  game,
  myTurn,
  action,
  drawPref,
  onDrawPrefChange,
  onSelectHandCard,
  onToggleReturnPick,
  onPass,
  onCancel,
}: PlayerHandPanelProps) {
  const tacticBlocked = game.tacticsPlayed[game.seat] > game.tacticsPlayed[1 - game.seat];

  let hint: string | undefined =
    action.mode === 'pickEnemyCard'
      ? action.tactic === 'traitor'
        ? '寝返らせる相手の部隊カードを選んでください'
        : '除外する相手のカードを選んでください'
      : HINTS[action.mode];

  const showPass = myTurn && game.canPass && game.pendingScout == null && action.mode === 'idle';
  const showCancel = action.mode !== 'idle' && action.mode !== 'scoutReturn';

  return (
    <>
      {hint && <div className="hint-bar">{hint}</div>}
      <footer className="game-footer">
        <div className="my-hand">
          {game.hand.map((c, i) => {
            if (action.mode === 'scoutReturn') {
              return (
                <HandCard
                  key={c.id}
                  card={c}
                  returnSelected={action.picks.includes(i)}
                  onClick={() => onToggleReturnPick(i)}
                />
              );
            }
            if (!myTurn) return <HandCard key={c.id} card={c} disabled />;
            const blocked = c.type === 'tactic' && (tacticBlocked || ((c.key === 'alexander' || c.key === 'darius') && game.leaderUsed));
            if (blocked) {
              return (
                <HandCard
                  key={c.id}
                  card={c}
                  disabled
                  title={tacticBlocked ? '相手より多く戦術を使用済みのため使えません' : 'リーダーは1ゲーム1枚まで'}
                />
              );
            }
            const selected = action.mode !== 'idle' && 'handIdx' in action && action.handIdx === i;
            return <HandCard key={c.id} card={c} selected={selected} onClick={() => onSelectHandCard(i)} />;
          })}
        </div>
        <div className="footer-side">
          <DrawPrefToggle value={drawPref} onChange={onDrawPrefChange} />
          {showPass && (
            <Button small onClick={onPass}>
              パス
            </Button>
          )}
          {showCancel && (
            <Button small onClick={onCancel}>
              選択をやめる
            </Button>
          )}
        </div>
      </footer>
    </>
  );
}
