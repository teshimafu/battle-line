'use client';

import { useEffect, useState } from 'react';

export interface TurnTimerProps {
  deadline: number;
  active: boolean;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TurnTimer({ deadline, active }: TurnTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, deadline]);

  if (!active) return null;
  const remaining = deadline - now;
  const danger = remaining <= 30_000;
  return <span className={`turn-timer${danger ? ' danger' : ''}`}>残り {formatRemaining(remaining)}</span>;
}
