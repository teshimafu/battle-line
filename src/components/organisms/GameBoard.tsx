'use client';

import { useEffect, useState } from 'react';
import { CardView } from '@/components/atoms/CardView';
import { FlagMarker } from '@/components/atoms/FlagMarker';
import { TACTIC_INFO, type Card, type SanitizedState } from '@/lib/battle-line/game';
import type { Action } from '@/hooks/useGameRoom';

const RECENT_PLACEMENT_MS = 10_000;

export interface GameBoardProps {
  game: SanitizedState;
  myTurn: boolean;
  action: Action;
  onPickEnemyCard: (flag: number, idx: number, card: Card) => void;
  onPickMyCard: (flag: number, idx: number) => void;
  onDropOnFlag: (flag: number) => void;
}

function isEnemyCardPickable(action: Action, card: Card): boolean {
  if (action.mode !== 'pickEnemyCard') return false;
  if (action.tactic === 'traitor') return card.type === 'troop';
  return true; // deserter
}

function dropTargetOk(game: SanitizedState, action: Action, mine: Card[], need: number, winner: string | null): boolean {
  if (winner != null) return false;
  if (action.mode === 'placeCard') {
    const card = game.hand[action.handIdx];
    if (!card) return false;
    if (card.type === 'tactic' && TACTIC_INFO[card.key].kind === 'env') return true; // 霧/泥沼はどこでも
    return mine.length < need;
  }
  if (action.mode === 'pickDest') return mine.length < need;
  return false;
}

export function GameBoard({ game, myTurn, action, onPickEnemyCard, onPickMyCard, onDropOnFlag }: GameBoardProps) {
  const lp = game.lastPlacement;
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!lp) return;
    const remaining = lp.at + RECENT_PLACEMENT_MS - Date.now();
    if (remaining <= 0) return;
    const id = setTimeout(() => forceTick((n) => n + 1), remaining + 50);
    return () => clearTimeout(id);
  }, [lp]);
  const isRecentlyPlaced = (flag: number, cardId: string) =>
    !!lp && lp.flag === flag && lp.cardId === cardId && Date.now() - lp.at < RECENT_PLACEMENT_MS;

  return (
    <main className="board-scroll">
      <div className="board">
        {game.flags.map((f, fi) => {
          const canDrop = myTurn && dropTargetOk(game, action, f.mine, f.need, f.winner);
          return (
            <div className="lane" key={fi}>
              <div className={`slot-col theirs${action.mode === 'pickEnemyCard' && f.winner == null && f.theirs.length ? ' droppable-enemy' : ''}`}>
                {f.theirs.map((c, ci) => (
                  <CardView
                    key={c.id}
                    card={c}
                    className={[
                      myTurn && f.winner == null && isEnemyCardPickable(action, c) ? 'selectable-target' : '',
                      isRecentlyPlaced(fi, c.id) ? 'recent-placement' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={
                      myTurn && f.winner == null && isEnemyCardPickable(action, c)
                        ? () => onPickEnemyCard(fi, ci, c)
                        : undefined
                    }
                  />
                ))}
              </div>

              <div>
                <FlagMarker number={fi + 1} winner={f.winner} onClick={canDrop ? () => onDropOnFlag(fi) : undefined} />
                <div className="env-row">
                  {f.env.map((k, i) => (
                    <span className="env-chip" key={i}>
                      {TACTIC_INFO[k].name}
                    </span>
                  ))}
                </div>
              </div>

              <div
                className={`slot-col${canDrop ? ' droppable' : ''}`}
                onClick={canDrop ? () => onDropOnFlag(fi) : undefined}
              >
                {f.mine.map((c, ci) => (
                  <CardView
                    key={c.id}
                    card={c}
                    className={[
                      myTurn && f.winner == null && action.mode === 'pickMyCard' ? 'selectable-target' : '',
                      isRecentlyPlaced(fi, c.id) ? 'recent-placement' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={
                      myTurn && f.winner == null && action.mode === 'pickMyCard'
                        ? () => onPickMyCard(fi, ci)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
