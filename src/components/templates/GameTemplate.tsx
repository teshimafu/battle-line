'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { GameHeader } from '@/components/organisms/GameHeader';
import { OppHandRow } from '@/components/molecules/OppHandRow';
import { GameBoard } from '@/components/organisms/GameBoard';
import { PlayerHandPanel } from '@/components/organisms/PlayerHandPanel';
import { LogPanel } from '@/components/molecules/LogPanel';
import { HelpModal } from '@/components/organisms/HelpModal';
import { ResultModal } from '@/components/organisms/ResultModal';
import { Toast } from '@/components/atoms/Toast';
import { TACTIC_INFO, type Card, type Move, type SanitizedState } from '@/lib/battle-line/game';
import type { Action } from '@/hooks/useGameRoom';

export interface GameTemplateProps {
  game: SanitizedState;
  action: Action;
  setAction: (a: Action) => void;
  drawPref: 'troop' | 'tactic';
  setDrawPref: (v: 'troop' | 'tactic') => void;
  sendMove: (move: Move) => void;
  toastMsg: string | null;
  startGame: () => void;
}

export function GameTemplate({ game, action, setAction, drawPref, setDrawPref, sendMove, toastMsg, startGame }: GameTemplateProps) {
  const gameOver = game.winner != null || game.draw;
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(gameOver);
  const prevGameOver = useRef(gameOver);
  const myTurn = game.turn === game.seat && !gameOver;

  // 決着が新たについたタイミングで結果モーダルを開く(再戦後の再オープンにも対応)
  useEffect(() => {
    if (gameOver && !prevGameOver.current) setResultOpen(true);
    prevGameOver.current = gameOver;
  }, [gameOver]);

  const selectHandCard = (i: number) => {
    const c = game.hand[i];
    if (action.mode !== 'idle' && 'handIdx' in action && action.handIdx === i) {
      setAction({ mode: 'idle' });
      return;
    }

    if (c.type === 'troop' || (c.type === 'tactic' && (TACTIC_INFO[c.key].kind === 'morale' || TACTIC_INFO[c.key].kind === 'env'))) {
      setAction({ mode: 'placeCard', handIdx: i });
      return;
    }
    if (c.type === 'tactic' && c.key === 'scout') {
      if (!confirm('【偵察】を使用しますか?\n山札から3枚引き、そのあと手札から2枚を山札に戻します。')) return;
      const draws: ('troop' | 'tactic')[] = [];
      for (let n = 1; n <= 3; n++) {
        const t = game.decks.tactic > 0 && confirm(`${n}枚目: 戦術山札から引きますか?\n(キャンセル = 部隊山札)`);
        draws.push(t ? 'tactic' : 'troop');
      }
      sendMove({ type: 'tactic', handIdx: i, draws });
      return;
    }
    if (c.type === 'tactic' && (c.key === 'deserter' || c.key === 'traitor')) {
      setAction({ mode: 'pickEnemyCard', handIdx: i, tactic: c.key });
      return;
    }
    if (c.type === 'tactic' && c.key === 'redeploy') {
      setAction({ mode: 'pickMyCard', handIdx: i, tactic: 'redeploy' });
    }
  };

  const dropOnFlag = (fi: number) => {
    if (action.mode === 'placeCard') {
      const card = game.hand[action.handIdx];
      const type = card.type === 'troop' ? 'troop' : 'tactic';
      sendMove({ type, handIdx: action.handIdx, flag: fi });
    } else if (action.mode === 'pickDest') {
      sendMove({ type: 'tactic', handIdx: action.handIdx, flag: action.srcFlag, idx: action.srcIdx, destFlag: fi });
    }
  };

  const pickEnemyCard = (fi: number, ci: number, _card: Card) => {
    if (action.mode !== 'pickEnemyCard') return;
    if (action.tactic === 'deserter') {
      if (!confirm('【脱走】でこのカードを除外しますか?')) return;
      sendMove({ type: 'tactic', handIdx: action.handIdx, flag: fi, idx: ci });
    } else {
      setAction({ mode: 'pickDest', handIdx: action.handIdx, tactic: 'traitor', srcFlag: fi, srcIdx: ci });
    }
  };

  const pickMyCard = (fi: number, ci: number) => {
    if (action.mode !== 'pickMyCard') return;
    if (confirm('このカードを別のフラッグへ移動しますか?\n(キャンセル = ゲームから除外)')) {
      setAction({ mode: 'pickDest', handIdx: action.handIdx, tactic: 'redeploy', srcFlag: fi, srcIdx: ci });
    } else {
      sendMove({ type: 'tactic', handIdx: action.handIdx, flag: fi, idx: ci, destFlag: -1 });
    }
  };

  const toggleReturnPick = (i: number) => {
    if (action.mode !== 'scoutReturn') return;
    const p = action.picks;
    const at = p.indexOf(i);
    let next: number[];
    if (at >= 0) next = p.filter((x) => x !== i);
    else if (p.length < 2) next = [...p, i];
    else next = p;
    if (next.length === 2) {
      sendMove({ type: 'scoutReturn', handIdxs: next });
    } else {
      setAction({ mode: 'scoutReturn', picks: next });
    }
  };

  return (
    <section className="view view-game">
      <GameHeader game={game} myTurn={myTurn} onHelp={() => setHelpOpen(true)} />
      {gameOver && (
        <div className="post-game-bar">
          <span>{game.draw ? '引き分けです' : game.winner === game.seat ? 'あなたの勝利です' : 'あなたの敗北です'}</span>
          <div className="post-game-actions">
            {!resultOpen && (
              <button className="btn btn-ghost btn-small" onClick={() => setResultOpen(true)}>
                結果を見る
              </button>
            )}
            <Link href="/" className="btn btn-ghost btn-small">
              ホームに戻る
            </Link>
          </div>
        </div>
      )}
      <OppHandRow troop={game.oppHand.troop} tactic={game.oppHand.tactic} />
      <GameBoard
        game={game}
        myTurn={myTurn}
        action={action}
        onPickEnemyCard={pickEnemyCard}
        onPickMyCard={pickMyCard}
        onDropOnFlag={dropOnFlag}
      />
      <PlayerHandPanel
        game={game}
        myTurn={myTurn}
        action={action}
        drawPref={drawPref}
        onDrawPrefChange={setDrawPref}
        onSelectHandCard={selectHandCard}
        onToggleReturnPick={toggleReturnPick}
        onPass={() => sendMove({ type: 'pass' })}
        onCancel={() => setAction({ mode: 'idle' })}
      />
      <LogPanel log={game.log} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ResultModal game={game} open={resultOpen} onRematch={startGame} onClose={() => setResultOpen(false)} />
      <Toast message={toastMsg} />
    </section>
  );
}
