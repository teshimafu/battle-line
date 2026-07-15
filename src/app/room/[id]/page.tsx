import { RoomTemplate } from '@/components/templates/RoomTemplate';

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoomTemplate roomId={id.toUpperCase()} />;
}
