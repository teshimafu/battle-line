'use client';

import { TACTIC_INFO, type Card, type TacticKey } from '@/lib/battle-line/game';

const COLOR_VARS = ['--c0', '--c1', '--c2', '--c3', '--c4', '--c5'];

export const TACTIC_MARK: Record<TacticKey, string> = {
  alexander: 'A',
  darius: 'D',
  cavalry: 'C',
  shield: 'S',
  fog: 'F',
  mud: 'M',
  scout: 'Sc',
  redeploy: 'R',
  deserter: 'De',
  traitor: 'T',
};

export interface CardViewProps {
  card: Card;
  className?: string;
  onClick?: () => void;
}

export function CardView({ card, className = '', onClick }: CardViewProps) {
  if (card.type === 'troop') {
    return (
      <div
        className={`card ${className}`}
        style={{ background: `var(${COLOR_VARS[card.color]})` }}
        onClick={onClick}
      >
        {card.value}
      </div>
    );
  }
  const t = TACTIC_INFO[card.key];
  return (
    <div className={`card tactic ${className}`} title={t.desc} onClick={onClick}>
      <span className="t-mark">{TACTIC_MARK[card.key]}</span>
      {t.name}
    </div>
  );
}
