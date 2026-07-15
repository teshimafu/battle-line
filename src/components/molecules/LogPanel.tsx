'use client';

import { useEffect, useRef } from 'react';

export interface LogPanelProps {
  log: string[];
}

export function LogPanel({ log }: LogPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);
  return (
    <aside className="log-panel" ref={ref}>
      {log.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </aside>
  );
}
