'use client';

import { useEffect, useRef } from 'react';
import type { SanitizedLogEntry } from '@/lib/battle-line/game';

export interface LogPanelProps {
  log: SanitizedLogEntry[];
}

const WHO_LABEL: Record<SanitizedLogEntry['who'], string> = {
  you: '自分',
  opp: '相手',
  system: '',
};

export function LogPanel({ log }: LogPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);
  return (
    <aside className="log-panel" ref={ref}>
      {log.map((entry, i) => (
        <div key={i} className={`log-entry log-${entry.who}`}>
          {entry.who !== 'system' && <span className="log-who">{WHO_LABEL[entry.who]}</span>}
          {entry.text}
        </div>
      ))}
    </aside>
  );
}
