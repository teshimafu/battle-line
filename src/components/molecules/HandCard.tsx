'use client';

import { CardView } from '@/components/atoms/CardView';
import type { Card } from '@/lib/battle-line/game';

export interface HandCardProps {
  card: Card;
  selected?: boolean;
  returnSelected?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}

export function HandCard({ card, selected, returnSelected, disabled, title, onClick }: HandCardProps) {
  const cls = [selected ? 'selected' : '', returnSelected ? 'return-selected' : '', disabled ? 'disabled' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div title={title}>
      <CardView card={card} className={cls} onClick={disabled ? undefined : onClick} />
    </div>
  );
}
