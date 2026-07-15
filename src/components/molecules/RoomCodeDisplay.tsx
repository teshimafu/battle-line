'use client';

import { Button } from '@/components/atoms/Button';

export interface RoomCodeDisplayProps {
  roomId: string;
  onCopy: () => void;
}

export function RoomCodeDisplay({ roomId, onCopy }: RoomCodeDisplayProps) {
  return (
    <div className="room-code-wrap">
      <span className="room-code">{roomId}</span>
      <Button small onClick={onCopy}>
        IDをコピー
      </Button>
    </div>
  );
}
