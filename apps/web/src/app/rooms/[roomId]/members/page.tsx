import { MemberManagementPage } from "@/components/features/rooms/member-management-page"

type RoomMembersPageProps = {
  params: Promise<{
    roomId: string
  }>
}

export default async function RoomMembersPage({
  params,
}: RoomMembersPageProps) {
  const { roomId } = await params

  return <MemberManagementPage roomId={roomId} />
}
