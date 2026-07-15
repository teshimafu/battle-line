'use client';

import type { DrawPref } from '@/lib/battle-line/game';

export interface DrawPrefToggleProps {
  value: DrawPref;
  onChange: (v: DrawPref) => void;
}

export function DrawPrefToggle({ value, onChange }: DrawPrefToggleProps) {
  return (
    <div className="draw-pref">
      <span>次に引く山札</span>
      <div className="seg">
        <button className={`seg-btn ${value === 'troop' ? 'active' : ''}`} onClick={() => onChange('troop')}>
          部隊
        </button>
        <button className={`seg-btn ${value === 'tactic' ? 'active' : ''}`} onClick={() => onChange('tactic')}>
          戦術
        </button>
      </div>
    </div>
  );
}
