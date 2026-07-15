'use client';

export interface BadgeProps {
  label: string;
  tone?: 'opp';
}

export function Badge({ label, tone }: BadgeProps) {
  const cls = ['side-label', tone === 'opp' ? 'side-opp' : ''].filter(Boolean).join(' ');
  return <span className={cls}>{label}</span>;
}
