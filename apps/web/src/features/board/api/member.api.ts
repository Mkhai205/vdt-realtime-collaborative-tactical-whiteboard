import { apiClient } from "@/lib/api/axios"
import type {
  ListBoardMembersResponse,
  BoardMemberSummary,
  AddBoardMemberRequest,
  UpdateBoardMemberRoleRequest,
} from "@rctw/shared-contracts"

export const memberApi = {
  listMembers: async (boardId: string): Promise<ListBoardMembersResponse> => {
    const { data } = await apiClient.get<ListBoardMembersResponse>(
      `/boards/${boardId}/members`,
    )
    return data
  },

  addMember: async (
    boardId: string,
    payload: AddBoardMemberRequest,
  ): Promise<BoardMemberSummary> => {
    const { data } = await apiClient.post<BoardMemberSummary>(
      `/boards/${boardId}/members`,
      payload,
    )
    return data
  },

  updateMemberRole: async (
    boardId: string,
    memberId: string,
    payload: UpdateBoardMemberRoleRequest,
  ): Promise<BoardMemberSummary> => {
    const { data } = await apiClient.patch<BoardMemberSummary>(
      `/boards/${boardId}/members/${memberId}`,
      payload,
    )
    return data
  },

  removeMember: async (boardId: string, memberId: string): Promise<void> => {
    await apiClient.delete(`/boards/${boardId}/members/${memberId}`)
  },
}
