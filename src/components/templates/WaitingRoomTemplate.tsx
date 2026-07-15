'use client';

import { Button } from '@/components/atoms/Button';
import { RoomCodeDisplay } from '@/components/molecules/RoomCodeDisplay';

export interface WaitingRoomTemplateProps {
  roomId: string;
  ready: boolean;
  onCopy: () => void;
  onStart: () => void;
}

export function WaitingRoomTemplate({ roomId, ready, onCopy, onStart }: WaitingRoomTemplateProps) {
  return (
    <section className="view">
      <div className="home-inner">
        <p className="eyebrow">ROOM</p>
        <RoomCodeDisplay roomId={roomId} onCopy={onCopy} />
        <div className="waiting-status">
          {ready ? '対戦相手が参加しました。' : (
            <>
              <span className="pulse" />
              対戦相手の参加を待っています…
            </>
          )}
        </div>
        {ready && (
          <Button variant="primary" onClick={onStart}>
            ゲーム開始
          </Button>
        )}
        <p className="modal-help">このページのURLを相手に送るだけでも入室できます。</p>
      </div>
    </section>
  );
}
