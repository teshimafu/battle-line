'use client';

export interface FlagMarkerProps {
  number: number;
  winner: 'you' | 'opp' | null;
  onClick?: () => void;
}

export function FlagMarker({ number, winner, onClick }: FlagMarkerProps) {
  const cls = ['flag-marker', winner === 'you' ? 'flag-you' : winner === 'opp' ? 'flag-opp' : ''].filter(Boolean).join(' ');
  return (
    <div className={cls} style={onClick ? { cursor: 'pointer' } : undefined} onClick={onClick}>
      ⚑
      <span className="flag-num">{number}</span>
    </div>
  );
}
