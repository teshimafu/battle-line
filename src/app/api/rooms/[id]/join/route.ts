import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getRoom, seatOf } from '@/lib/battle-line/rooms';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = getRoom(id);
  if (!room) return NextResponse.json({ error: '部屋が見つかりません' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const existing = seatOf(room, body?.token);
  if (existing >= 0) return NextResponse.json({ roomId: room.id, token: room.players[existing].token, seat: existing });
  if (room.players.length >= 2) return NextResponse.json({ error: 'この部屋は満員です' }, { status: 403 });

  const token = crypto.randomBytes(16).toString('hex');
  room.players.push({ token });
  return NextResponse.json({ roomId: room.id, token, seat: 1 });
}
