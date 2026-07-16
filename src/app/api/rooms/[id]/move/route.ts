import { NextRequest, NextResponse } from 'next/server';
import { applyMove, sanitize, type Move, type Seat } from '@/lib/battle-line/game';
import { getRoom, seatOf, comSeatOf, scheduleComTurn, syncTimeout } from '@/lib/battle-line/rooms';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = getRoom(id);
  if (!room) return NextResponse.json({ error: '部屋が見つかりません' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const seat = seatOf(room, body?.token);
  if (seat < 0) return NextResponse.json({ error: 'この部屋の参加者ではありません' }, { status: 403 });
  if (room.phase !== 'playing' || !room.game) return NextResponse.json({ error: 'ゲームが開始されていません' }, { status: 400 });

  syncTimeout(room);
  if (room.phase !== 'playing') return NextResponse.json({ ok: true, game: sanitize(room.game, seat as Seat) });

  const names: [string, string] = comSeatOf(room) >= 0 ? ['プレイヤー1', 'COM'] : ['プレイヤー1', 'プレイヤー2'];
  const move: Move = body?.move || {};
  const result = applyMove(room.game, seat as Seat, move, names);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  if (room.game.winner != null || room.game.draw) room.phase = 'finished';
  else scheduleComTurn(room);
  return NextResponse.json({ ok: true, game: sanitize(room.game, seat as Seat) });
}
