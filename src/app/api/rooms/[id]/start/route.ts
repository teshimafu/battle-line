import { NextRequest, NextResponse } from 'next/server';
import { newGame } from '@/lib/battle-line/game';
import { getRoom, seatOf, scheduleComTurn } from '@/lib/battle-line/rooms';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = getRoom(id);
  if (!room) return NextResponse.json({ error: '部屋が見つかりません' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const seat = seatOf(room, body?.token);
  if (seat < 0) return NextResponse.json({ error: 'この部屋の参加者ではありません' }, { status: 403 });
  if (room.players.length < 2) return NextResponse.json({ error: '対戦相手がまだ参加していません' }, { status: 400 });
  if (room.phase === 'playing') return NextResponse.json({ error: 'すでに開始しています' }, { status: 400 });

  room.game = newGame();
  room.phase = 'playing';
  scheduleComTurn(room);
  return NextResponse.json({ ok: true });
}
