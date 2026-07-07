import { apiClient } from "@/lib/api/axios"
import type {
  CreateBoardRequest,
  BoardResponse,
  ListBoardsQuery,
  ListBoardsResponse,
  BoardDetailResponse,
  UpdateBoardInfoRequest,
  UpdateBoardSettingsRequest,
  BoardShareLinkResponse,
  CreateBoardShareLinkRequest,
  JoinBoardByLinkRequest,
  JoinBoardByLinkResponse,
  BoardSnapshotSummaryResponse,
  BoardSnapshotDetailResponse,
  ImportBoardRequest,
  ImportBoardObjectsRequest,
  BoardObjectsResponse,
} from "@rctw/shared-contracts"

export const boardApi = {
  createBoard: async (data: CreateBoardRequest): Promise<BoardResponse> => {
    const { data: responseData } = await apiClient.post<BoardResponse>(
      "/boards",
      data,
    )
    return responseData
  },

  listBoards: async (query: ListBoardsQuery): Promise<ListBoardsResponse> => {
    const { data: responseData } = await apiClient.get<ListBoardsResponse>(
      "/boards",
      {
        params: query,
      },
    )
    return responseData
  },

  getBoardDetail: async (boardId: string): Promise<BoardDetailResponse> => {
    const { data: responseData } = await apiClient.get<BoardDetailResponse>(
      `/boards/${boardId}`,
    )
    return responseData
  },

  updateBoardInfo: async (
    boardId: string,
    data: UpdateBoardInfoRequest,
  ): Promise<BoardResponse> => {
    const { data: responseData } = await apiClient.patch<BoardResponse>(
      `/boards/${boardId}`,
      data,
    )
    return responseData
  },

  updateBoardSettings: async (
    boardId: string,
    data: UpdateBoardSettingsRequest,
  ): Promise<BoardResponse> => {
    const { data: responseData } = await apiClient.patch<BoardResponse>(
      `/boards/${boardId}/settings`,
      data,
    )
    return responseData
  },

  deleteBoard: async (boardId: string): Promise<void> => {
    await apiClient.delete(`/boards/${boardId}`)
  },

  getShareLinks: async (boardId: string): Promise<BoardShareLinkResponse[]> => {
    const { data: responseData } = await apiClient.get<
      BoardShareLinkResponse[]
    >(`/boards/${boardId}/share-links`)
    return responseData
  },

  createShareLink: async (
    boardId: string,
    data: CreateBoardShareLinkRequest,
  ): Promise<BoardShareLinkResponse> => {
    const { data: responseData } = await apiClient.post<BoardShareLinkResponse>(
      `/boards/${boardId}/share-links`,
      data,
    )
    return responseData
  },

  revokeShareLink: async (boardId: string, linkId: string): Promise<void> => {
    await apiClient.delete(`/boards/${boardId}/share-links/${linkId}`)
  },

  joinBoardByLink: async (
    data: JoinBoardByLinkRequest,
  ): Promise<JoinBoardByLinkResponse> => {
    const { data: responseData } = await apiClient.post<JoinBoardByLinkResponse>(
      "/boards/join",
      data,
    )
    return responseData
  },

  uploadImage: async (
    boardId: string,
    file: File,
  ): Promise<{ url: string; filename: string }> => {
    const formData = new FormData()
    formData.append("file", file)
    const { data: responseData } = await apiClient.post<{
      url: string
      filename: string
    }>(`/boards/${boardId}/upload`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    return responseData
  },

  listSnapshots: async (
    boardId: string,
  ): Promise<BoardSnapshotSummaryResponse[]> => {
    const { data } = await apiClient.get<BoardSnapshotSummaryResponse[]>(
      `/boards/${boardId}/snapshots`,
    )
    return data
  },

  getSnapshot: async (
    boardId: string,
    snapshotId: string,
  ): Promise<BoardSnapshotDetailResponse> => {
    const { data } = await apiClient.get<BoardSnapshotDetailResponse>(
      `/boards/${boardId}/snapshots/${snapshotId}`,
    )
    return data
  },

  createSnapshot: async (
    boardId: string,
  ): Promise<BoardSnapshotDetailResponse> => {
    const { data } = await apiClient.post<BoardSnapshotDetailResponse>(
      `/boards/${boardId}/snapshots`,
    )
    return data
  },

  restoreSnapshot: async (
    boardId: string,
    snapshotId: string,
  ): Promise<BoardSnapshotDetailResponse> => {
    const { data } = await apiClient.post<BoardSnapshotDetailResponse>(
      `/boards/${boardId}/snapshots/${snapshotId}/restore`,
    )
    return data
  },

  importBoard: async (data: ImportBoardRequest): Promise<BoardResponse> => {
    const { data: responseData } = await apiClient.post<BoardResponse>(
      "/boards/import",
      data,
    )
    return responseData
  },

  importBoardObjects: async (
    boardId: string,
    data: ImportBoardObjectsRequest,
  ): Promise<BoardObjectsResponse> => {
    const { data: responseData } = await apiClient.post<BoardObjectsResponse>(
      `/boards/${boardId}/import`,
      data,
    )
    return responseData
  },
}
