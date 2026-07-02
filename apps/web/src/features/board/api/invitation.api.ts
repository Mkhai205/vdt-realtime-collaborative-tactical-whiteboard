import { apiClient } from "@/lib/api/axios"
import type {
  BoardInvitationResponse,
  CreateBoardInvitationRequest,
  AcceptBoardInvitationRequest,
} from "@rctw/shared-contracts"

export const invitationApi = {
  createInvitation: async (
    boardId: string,
    payload: CreateBoardInvitationRequest,
  ): Promise<BoardInvitationResponse> => {
    const { data } = await apiClient.post<BoardInvitationResponse>(
      `/boards/${boardId}/invitations`,
      payload,
    )
    return data
  },

  listInvitations: async (boardId: string): Promise<BoardInvitationResponse[]> => {
    const { data } = await apiClient.get<BoardInvitationResponse[]>(
      `/boards/${boardId}/invitations`,
    )
    return data
  },

  revokeInvitation: async (
    boardId: string,
    invitationId: string,
  ): Promise<void> => {
    await apiClient.delete(`/boards/${boardId}/invitations/${invitationId}`)
  },

  acceptInvitation: async (
    payload: AcceptBoardInvitationRequest,
  ): Promise<{ boardId: string; role: string }> => {
    const { data } = await apiClient.post<{ boardId: string; role: string }>(
      "/invitations/accept",
      payload,
    )
    return data
  },
}
