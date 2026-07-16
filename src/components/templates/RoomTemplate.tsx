'use client';

import { useGameRoom } from '@/hooks/useGameRoom';
import { WaitingRoomTemplate } from '@/components/templates/WaitingRoomTemplate';
import { GameTemplate } from '@/components/templates/GameTemplate';
import { Toast } from '@/components/atoms/Toast';

export interface RoomTemplateProps {
  roomId: string;
}

export function RoomTemplate({ roomId }: RoomTemplateProps) {
  const {
    state,
    joinError,
    toastMsg,
    toast,
    action,
    setAction,
    drawPref,
    setDrawPref,
    sendMove,
    startGame,
    pollingActive,
    resumePolling,
  } = useGameRoom(roomId);

  if (joinError) {
    return (
      <section className="view">
        <div className="home-inner">
          <p className="error-text">{joinError}</p>
        </div>
      </section>
    );
  }

  if (!state) return null;

  const showResumeNotice = !pollingActive && state.phase !== 'finished';

  if (state.phase === 'waiting' || !state.game) {
    return (
      <>
        {showResumeNotice && <PollingPausedBanner onResume={resumePolling} />}
        <WaitingRoomTemplate
          roomId={state.roomId}
          ready={state.playerCount >= 2}
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(roomId);
              toast('部屋IDをコピーしました');
            } catch {
              toast('コピーできませんでした');
            }
          }}
          onStart={startGame}
        />
        <Toast message={toastMsg} />
      </>
    );
  }

  return (
    <>
      {showResumeNotice && <PollingPausedBanner onResume={resumePolling} />}
      <GameTemplate
        game={state.game}
        action={action}
        setAction={setAction}
        drawPref={drawPref}
        setDrawPref={setDrawPref}
        sendMove={sendMove}
        toastMsg={toastMsg}
        startGame={startGame}
      />
    </>
  );
}

function PollingPausedBanner({ onResume }: { onResume: () => void }) {
  return (
    <div className="polling-paused-bar">
      <span>しばらく操作がなかったため自動更新を停止しています</span>
      <button className="btn btn-ghost btn-small" onClick={onResume}>
        再開する
      </button>
    </div>
  );
}
