"use client"

import { useParams } from "next/navigation"

export default function BoardPage() {
  const params = useParams()
  const boardId = params.boardId as string

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50 font-sans dark:bg-slate-950">
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
          Whiteboard Canvas
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Board ID: {boardId}
        </p>
        <p className="mt-4 animate-pulse text-xs text-violet-500">
          Canvas core loading scaffold...
        </p>
      </div>
    </div>
  )
}
