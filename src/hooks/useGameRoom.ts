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

const POLL_INTERVAL_MS = 5000;
const POLL_IDLE_STOP_MS = 5 * 60 * 1000; // これ以上状態に変化がなければポーリングを止める

export function useGameRoom(roomId: string) {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<StateResponse | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [action, setAction] = useState<Action>({ mode: 'idle' });
  const [drawPref, setDrawPref] = useState<DrawPref>('troop');
  const [pollingActive, setPollingActive] = useState(true);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);
  const lastChangeAt = useRef<number>(Date.now());
  const lastSnapshot = useRef<string | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const stopPolling = useCallback(
    (reason?: string) => {
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
      setPollingActive(false);
      if (reason) toast(reason);
    },
    [toast]
  );

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
    if (pollTimer.current) clearTimeout(pollTimer.current);
    lastChangeAt.current = Date.now();
    setPollingActive(true);
    const tick = async () => {
      const t = tokenRef.current;
      if (t) {
        try {
          const s = await api<StateResponse>(`/api/rooms/${roomId}/state?token=${t}`);
          const snapshot = JSON.stringify(s);
          if (snapshot !== lastSnapshot.current) {
            lastSnapshot.current = snapshot;
            lastChangeAt.current = Date.now();
          }
          setState(s);
          if (s.phase === 'finished') {
            stopPolling();
            return;
          }
        } catch {
          // 一時的な通信断は無視
        }
      }
      if (Date.now() - lastChangeAt.current > POLL_IDLE_STOP_MS) {
        stopPolling('しばらく操作がなかったため自動更新を停止しました');
        return;
      }
      pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
  }, [roomId, stopPolling]);

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
      if (pollTimer.current) clearTimeout(pollTimer.current);
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
        const finished = res.game.winner != null || res.game.draw;
        setState((prev) => (prev ? { ...prev, phase: finished ? 'finished' : 'playing', game: res.game } : prev));
        lastChangeAt.current = Date.now();
        lastSnapshot.current = null;
        if (finished) stopPolling();
      } catch (e) {
        toast((e as Error).message);
      }
    },
    [roomId, drawPref, toast, stopPolling]
  );

  const startGame = useCallback(async () => {
    try {
      await api(`/api/rooms/${roomId}/start`, { method: 'POST', body: { token: tokenRef.current } });
      lastSnapshot.current = null;
      startPolling(); // 対戦開始/再戦のたびにポーリングを(必要なら)再開する
    } catch (e) {
      toast((e as Error).message);
    }
  }, [roomId, toast, startPolling]);

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
    pollingActive,
    resumePolling: startPolling,
  };
}
