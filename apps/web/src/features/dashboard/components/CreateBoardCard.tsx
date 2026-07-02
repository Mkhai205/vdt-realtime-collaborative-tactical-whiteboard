"use client"

import { Plus } from "lucide-react"

interface CreateBoardCardProps {
  onClick: () => void
}

export function CreateBoardCard({ onClick }: CreateBoardCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 text-slate-500 shadow-sm transition-all duration-300 hover:bg-slate-100/50 hover:text-slate-600 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400 dark:hover:bg-slate-900/50 dark:hover:text-slate-300"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200/60 transition-transform group-hover:scale-105 dark:bg-slate-800/80">
        <Plus className="h-6 w-6" />
      </div>
      <span className="text-sm font-semibold tracking-tight">
        New Whiteboard
      </span>
      <span className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
        Start a fresh planning canvas
      </span>
    </button>
  )
}
