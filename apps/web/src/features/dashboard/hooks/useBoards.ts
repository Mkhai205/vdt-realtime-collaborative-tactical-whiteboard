/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { boardApi } from "@/features/board/api/board.api"
import type { CreateBoardRequest } from "@rctw/shared-contracts"
import { toast } from "sonner"

export function useBoards(search?: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ["boards", { search, page, limit }],
    queryFn: () => boardApi.listBoards({ search, page, limit }),
    staleTime: 30000,
  })
}

export function useCreateBoard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateBoardRequest) => boardApi.createBoard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] })
      toast.success("Board created successfully!")
    },
    onError: (error: any) => {
      const errMsg = error?.response?.data?.message || "Failed to create board"
      toast.error(errMsg)
    },
  })
}

export function useDeleteBoard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (boardId: string) => boardApi.deleteBoard(boardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] })
      toast.success("Board deleted successfully!")
    },
    onError: (error: any) => {
      const errMsg = error?.response?.data?.message || "Failed to delete board"
      toast.error(errMsg)
    },
  })
}
