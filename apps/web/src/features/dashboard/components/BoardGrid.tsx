"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useBoards } from "../hooks/useBoards"
import { BoardCard } from "./BoardCard"
import { CreateBoardCard } from "./CreateBoardCard"
import { CreateBoardDialog } from "./CreateBoardDialog"
import { Button } from "@/components/ui/button"
import { Paintbrush, RefreshCw } from "lucide-react"

export function BoardGrid() {
  const searchParams = useSearchParams()
  const search = searchParams.get("search") || ""
  const page = parseInt(searchParams.get("page") || "1", 10)

  const { data, isLoading, error, refetch } = useBoards(search, page, 12)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800/40 dark:bg-slate-900/50"
          >
            {/* Thumbnail skeleton */}
            <div className="aspect-video w-full animate-pulse bg-slate-200 dark:bg-slate-800/80" />
            {/* Info skeleton */}
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="h-5 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800/80" />
                <div className="h-5.5 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800/80" />
              </div>
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800/80" />
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800/80" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-75 w-full flex-col items-center justify-center text-center">
        <p className="mb-2 text-sm font-semibold text-red-500">
          Failed to load workspaces
        </p>
        <p className="mb-4 max-w-xs text-xs text-slate-500 dark:text-slate-400">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    )
  }

  const boards = data?.items || []

  // Check if it's the absolute empty state (no boards at all, no active search query)
  const isAbsoluteEmpty = boards.length === 0 && !search

  if (isAbsoluteEmpty) {
    return (
      <div className="flex min-h-90 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/20 p-8 text-center dark:border-slate-800 dark:bg-slate-900/10">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 shadow-inner dark:bg-violet-950/30">
          <Paintbrush className="h-8 w-8" />
        </div>
        <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-50">
          No boards yet
        </h3>
        <p className="mb-6 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Create your first board to start designing, mapping, and collaborating
          with your team in real time.
        </p>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-violet-600 font-semibold text-white shadow-md shadow-violet-500/10 hover:bg-violet-500"
        >
          Create Board
        </Button>
        <CreateBoardDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* Search results header */}
      {search && (
        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          Search Results ({boards.length})
        </p>
      )}

      {/* Grid Layout */}
      {boards.length === 0 && search ? (
        <div className="flex min-h-65 w-full flex-col items-center justify-center text-center">
          <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
            No boards found
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            We couldn&apos;t find any boards matching &quot;{search}&quot;. Try
            adjusting your keywords.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {/* Create board card is always the first item in the grid unless searching */}
          {!search && (
            <CreateBoardCard onClick={() => setCreateDialogOpen(true)} />
          )}

          {boards.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))}
        </div>
      )}

      {/* Dialog for creating board */}
      <CreateBoardDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  )
}
