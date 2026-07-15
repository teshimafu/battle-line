'use client';

import { Button } from '@/components/atoms/Button';
import { TacticListItem } from '@/components/molecules/TacticListItem';
import { TACTIC_INFO } from '@/lib/battle-line/game';

export interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <h2 id="help-title">戦術カード一覧</h2>
        <div className="tactic-list">
          {(Object.keys(TACTIC_INFO) as (keyof typeof TACTIC_INFO)[]).map((key) => (
            <TacticListItem tacticKey={key} info={TACTIC_INFO[key]} key={key} />
          ))}
        </div>
        <div className="modal-actions">
          <Button variant="primary" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
}
