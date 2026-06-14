import { WhiteboardPage } from "@/components/features/whiteboard/whiteboard-page"

type RoomWhiteboardPageProps = {
  params: Promise<{
    roomId: string
  }>
}

export default async function RoomWhiteboardPage({
  params,
}: RoomWhiteboardPageProps) {
  const { roomId } = await params

  return <WhiteboardPage roomId={roomId} />
}
