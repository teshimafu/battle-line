'use client';

export interface CardBackProps {
  kind: 'troop' | 'tactic';
}

export function CardBack({ kind }: CardBackProps) {
  const cls = kind === 'tactic' ? 'card-back tactic-back' : 'card-back';
  const title = kind === 'tactic' ? '戦術カード' : '部隊カード';
  return <div className={cls} title={title} />;
}
