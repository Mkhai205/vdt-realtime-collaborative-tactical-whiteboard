"use client"

import { useParams } from "next/navigation"
import { BoardCanvas } from "@/features/board/components/BoardCanvas"

export default function BoardPage() {
  const params = useParams()
  const boardId = params.boardId as string

  return <BoardCanvas boardId={boardId} />
}
