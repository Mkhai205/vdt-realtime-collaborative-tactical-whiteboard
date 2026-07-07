"use client"

import { Plus } from "lucide-react"

interface CreateBoardCardProps {
  onClick: () => void
}

export function CreateBoardCard({ onClick }: CreateBoardCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/20 shadow-sm transition-all duration-300 hover:bg-muted/40 hover:text-foreground hover:shadow-md dark:text-muted-foreground dark:hover:text-foreground"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted transition-transform group-hover:scale-105">
        <Plus className="h-6 w-6" />
      </div>
      <span className="font-semibold tracking-tight">New Whiteboard</span>
      <span className="mt-1 text-sm">Start a fresh planning canvas</span>
    </button>
  )
}
