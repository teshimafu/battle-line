'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { JoinModal } from '@/components/organisms/JoinModal';
import { api } from '@/lib/battle-line/api';

function tokenKey(id: string) {
  return `bl_token_${id}`;
}

export function HomeTemplate() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);

  const createRoom = async (vsCom: boolean) => {
    try {
      const res = await api<{ roomId: string; token: string; seat: number }>('/api/rooms', {
        method: 'POST',
        body: { vsCom },
      });
      localStorage.setItem(tokenKey(res.roomId), res.token);
      if (vsCom) {
        await api(`/api/rooms/${res.roomId}/start`, { method: 'POST', body: { token: res.token } });
      }
      router.push(`/room/${res.roomId}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="view">
      <div className="home-inner">
        <p className="eyebrow">TWO-PLAYER CARD BATTLE</p>
        <h1 className="title">
          BATTLE<span className="title-rule" />
          LINE
        </h1>
        <p className="tagline">
          9本のフラッグを挟んで、編成の強さを競い合う。
          <br />
          5本、または隣接する3本を制した者が勝者となる。
        </p>
        <div className="home-actions">
          <Button variant="primary" onClick={() => createRoom(false)}>
            部屋を作る
          </Button>
          <Button variant="primary" onClick={() => createRoom(true)}>
            COMと対戦
          </Button>
          <Button onClick={() => setJoinOpen(true)}>部屋に入る</Button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>
      <JoinModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onSubmit={(id) => {
          setJoinOpen(false);
          router.push(`/room/${id}`);
        }}
      />
    </section>
  );
}
