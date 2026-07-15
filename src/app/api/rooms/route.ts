import { NextRequest, NextResponse } from 'next/server';
import { createRoom } from '@/lib/battle-line/rooms';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { room, token } = createRoom(Boolean(body?.vsCom));
  return NextResponse.json({ roomId: room.id, token, seat: 0 });
}
