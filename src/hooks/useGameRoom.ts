'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/battle-line/api';
import type { DrawPref, Move, SanitizedState } from '@/lib/battle-line/game';

export interface StateResponse {
  roomId: string;
  phase: 'waiting' | 'playing' | 'finished';
  seat: number;
  playerCount: number;
  game?: SanitizedState;
}

export type Action =
  | { mode: 'idle' }
  | { mode: 'placeCard'; handIdx: number }
  | { mode: 'pickEnemyCard'; handIdx: number; tactic: 'deserter' | 'traitor' }
  | { mode: 'pickMyCard'; handIdx: number; tactic: 'redeploy' }
  | { mode: 'pickDest'; handIdx: number; tactic: 'traitor' | 'redeploy'; srcFlag: number; srcIdx: number }
  | { mode: 'scoutReturn'; picks: number[] };

function tokenKey(id: string) {
  return `bl_token_${id}`;
}

export function useGameRoom(roomId: string) {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<StateResponse | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [action, setAction] = useState<Action>({ mode: 'idle' });
  const [drawPref, setDrawPref] = useState<DrawPref>('troop');
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  // 偵察待ちに入ったら自動でscoutReturnモードへ、抜けたらidleへ戻す
  useEffect(() => {
    const g = state?.game;
    if (!g) return;
    const scoutMode = g.pendingScout === g.seat;
    if (scoutMode && action.mode !== 'scoutReturn') setAction({ mode: 'scoutReturn', picks: [] });
    if (!scoutMode && action.mode === 'scoutReturn') setAction({ mode: 'idle' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.game?.pendingScout, state?.game?.seat]);

  const startPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    const tick = async () => {
      const t = tokenRef.current;
      if (!t) return;
      try {
        const s = await api<StateResponse>(`/api/rooms/${roomId}/state?token=${t}`);
        setState(s);
      } catch {
        // 一時的な通信断は無視
      }
    };
    tick();
    pollTimer.current = setInterval(tick, 1500);
  }, [roomId]);

  const enterRoom = useCallback(async () => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(tokenKey(roomId)) : null;
    try {
      const res = await api<{ roomId: string; token: string; seat: number }>(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        body: { token: saved },
      });
      tokenRef.current = res.token;
      setToken(res.token);
      localStorage.setItem(tokenKey(roomId), res.token);
      startPolling();
    } catch (e) {
      setJoinError((e as Error).message);
    }
  }, [roomId, startPolling]);

  useEffect(() => {
    enterRoom();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMove = useCallback(
    async (move: Move) => {
      try {
        setAction({ mode: 'idle' });
        const res = await api<{ ok: boolean; game: SanitizedState }>(`/api/rooms/${roomId}/move`, {
          method: 'POST',
          body: { token: tokenRef.current, move: { ...move, draw: drawPref } },
        });
        setState((prev) =>
          prev ? { ...prev, phase: res.game.winner != null || res.game.draw ? 'finished' : 'playing', game: res.game } : prev
        );
      } catch (e) {
        toast((e as Error).message);
      }
    },
    [roomId, drawPref, toast]
  );

  const startGame = useCallback(async () => {
    try {
      await api(`/api/rooms/${roomId}/start`, { method: 'POST', body: { token: tokenRef.current } });
    } catch (e) {
      toast((e as Error).message);
    }
  }, [roomId, toast]);

  return {
    token,
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
  };
}
