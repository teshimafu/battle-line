import { NextRequest, NextResponse } from 'next/server';
import { sanitize, type Seat } from '@/lib/battle-line/game';
import { getRoom, seatOf, syncTimeout } from '@/lib/battle-line/rooms';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = getRoom(id);
  if (!room) return NextResponse.json({ error: '部屋が見つかりません' }, { status: 404 });

  const token = req.nextUrl.searchParams.get('token');
  const seat = seatOf(room, token);
  if (seat < 0) return NextResponse.json({ error: 'この部屋の参加者ではありません' }, { status: 403 });

  syncTimeout(room);
  const base = { roomId: room.id, phase: room.phase, seat, playerCount: room.players.length };
  if (!room.game) return NextResponse.json(base);
  return NextResponse.json({ ...base, game: sanitize(room.game, seat as Seat) });
}
