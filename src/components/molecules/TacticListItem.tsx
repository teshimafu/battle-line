'use client';

import { TACTIC_MARK } from '@/components/atoms/CardView';
import type { TacticInfo, TacticKey } from '@/lib/battle-line/game';

export interface TacticListItemProps {
  tacticKey: TacticKey;
  info: TacticInfo;
}

export function TacticListItem({ tacticKey, info }: TacticListItemProps) {
  return (
    <div className="tactic-item">
      <span className="t-mark">{TACTIC_MARK[tacticKey]}</span>
      <div className="tactic-body">
        <b>{info.name}</b>
        <span>{info.desc}</span>
      </div>
    </div>
  );
}
