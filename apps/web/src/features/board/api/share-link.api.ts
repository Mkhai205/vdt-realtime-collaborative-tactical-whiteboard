import { apiClient } from "@/lib/api/axios"
import type {
  BoardShareLinkResponse,
  CreateBoardShareLinkRequest,
  JoinBoardByLinkRequest,
  BoardDetailResponse,
} from "@rctw/shared-contracts"

export const shareLinkApi = {
  getShareLinks: async (boardId: string): Promise<BoardShareLinkResponse[]> => {
    const { data } = await apiClient.get<BoardShareLinkResponse[]>(
      `/boards/${boardId}/share-links`,
    )
    return data
  },

  createShareLink: async (
    boardId: string,
    payload: CreateBoardShareLinkRequest,
  ): Promise<BoardShareLinkResponse> => {
    const { data } = await apiClient.post<BoardShareLinkResponse>(
      `/boards/${boardId}/share-links`,
      payload,
    )
    return data
  },

  revokeShareLink: async (boardId: string, linkId: string): Promise<void> => {
    await apiClient.delete(`/boards/${boardId}/share-links/${linkId}`)
  },

  joinByLink: async (
    payload: JoinBoardByLinkRequest,
  ): Promise<BoardDetailResponse> => {
    const { data } = await apiClient.post<BoardDetailResponse>(
      "/boards/join",
      payload,
    )
    return data
  },
}
