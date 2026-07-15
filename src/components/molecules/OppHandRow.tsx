'use client';

import { CardBack } from '@/components/atoms/CardBack';

export interface OppHandRowProps {
  troop: number;
  tactic: number;
}

export function OppHandRow({ troop, tactic }: OppHandRowProps) {
  return (
    <div className="opp-hand-row">
      {Array.from({ length: tactic }, (_, i) => (
        <CardBack kind="tactic" key={`t${i}`} />
      ))}
      {Array.from({ length: troop }, (_, i) => (
        <CardBack kind="troop" key={`r${i}`} />
      ))}
    </div>
  );
}
