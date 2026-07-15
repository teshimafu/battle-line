/* 部屋(対戦ルーム)のメモリ管理 */

import crypto from 'crypto';
import { applyMove, type GameState, type Seat, type Move } from './game';
import { chooseComMove } from './com';

export interface Player {
  token: string | null;
  isCom?: boolean;
}

export interface Room {
  id: string;
  players: Player[];
  phase: 'waiting' | 'playing' | 'finished';
  game: GameState | null;
  updated: number;
}

const ROOM_TTL = 1000 * 60 * 60 * 12; // 12時間

// Next.jsのHMRでモジュールが再読み込みされても状態を保つため globalThis に保持する
const globalForRooms = globalThis as unknown as { __battleLineRooms?: Map<string, Room> };
export const rooms: Map<string, Room> = globalForRooms.__battleLineRooms ?? new Map();
globalForRooms.__battleLineRooms = rooms;

const globalForCleanup = globalThis as unknown as { __battleLineCleanupStarted?: boolean };
if (!globalForCleanup.__battleLineCleanupStarted) {
  globalForCleanup.__battleLineCleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) if (now - room.updated > ROOM_TTL) rooms.delete(id);
  }, 1000 * 60 * 10);
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRoomId(): string {
  let id: string;
  do {
    id = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
  } while (rooms.has(id));
  return id;
}

export function getRoom(id: string): Room | undefined {
  const room = rooms.get(String(id || '').toUpperCase());
  if (room) room.updated = Date.now();
  return room;
}

export function seatOf(room: Room, token: string | null | undefined): number {
  if (!token) return -1;
  return room.players.findIndex((p) => p.token === token);
}

export function comSeatOf(room: Room): number {
  return room.players.findIndex((p) => p.isCom);
}

function namesOf(room: Room): [string, string] {
  return comSeatOf(room) >= 0 ? ['プレイヤー1', 'COM'] : ['プレイヤー1', 'プレイヤー2'];
}

// COMの手番なら、少し間を置いてから着手させる(考えている演出も兼ねる)
export function scheduleComTurn(room: Room): void {
  const comSeat = comSeatOf(room);
  if (comSeat < 0) return;
  const step = () => {
    if (!rooms.has(room.id)) return;
    if (!room.game || room.game.winner != null || room.game.turn !== comSeat) return;
    const names = namesOf(room);
    const move: Move = chooseComMove(room.game, comSeat as Seat);
    applyMove(room.game, comSeat as Seat, move, names);
    room.updated = Date.now();
    if (room.game.winner != null) { room.phase = 'finished'; return; }
    setTimeout(step, 500 + Math.floor(Math.random() * 700));
  };
  setTimeout(step, 500 + Math.floor(Math.random() * 700));
}

export function createRoom(vsCom: boolean): { room: Room; token: string } {
  const id = newRoomId();
  const token = crypto.randomBytes(16).toString('hex');
  const players: Player[] = [{ token }];
  if (vsCom) players.push({ token: null, isCom: true });
  const room: Room = { id, players, phase: 'waiting', game: null, updated: Date.now() };
  rooms.set(id, room);
  return { room, token };
}
