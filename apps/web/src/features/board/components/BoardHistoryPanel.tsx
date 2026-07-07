"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, History, Plus, Eye, RotateCcw, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { boardApi } from "@/features/board/api/board.api"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import { toast } from "sonner"
import type { BoardSnapshotSummaryResponse } from "@rctw/shared-contracts"

interface BoardHistoryPanelProps {
  boardId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BoardHistoryPanel({
  boardId,
  open,
  onOpenChange,
}: BoardHistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<BoardSnapshotSummaryResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const currentRevision = useBoardStore((s) => s.revision)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  const previewSnapshot = useUIStore((s) => s.previewSnapshot)
  const setPreviewSnapshot = useUIStore((s) => s.setPreviewSnapshot)

  // Fetch snapshots when open
  useEffect(() => {
    if (open) {
      fetchSnapshots()
    }
  }, [open, boardId])

  const fetchSnapshots = async () => {
    setIsLoading(true)
    try {
      const data = await boardApi.listSnapshots(boardId)
      setSnapshots(data)
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load version history"
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSnapshot = async () => {
    setIsCreating(true)
    try {
      await boardApi.createSnapshot(boardId)
      toast.success("Snapshot version captured")
      await fetchSnapshots()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to capture snapshot")
    } finally {
      setIsCreating(false)
    }
  }

  const handlePreview = async (snapshotId: string) => {
    try {
      if (previewSnapshot && previewSnapshot.id === snapshotId) {
        setPreviewSnapshot(null)
        return
      }

      toast.loading("Loading version details...", { id: "preview-loading" })
      const data = await boardApi.getSnapshot(boardId, snapshotId)
      setPreviewSnapshot(data)
      toast.dismiss("preview-loading")
      toast.success(`Previewing Revision #${data.revision}`)
    } catch (err: any) {
      toast.dismiss("preview-loading")
      toast.error(
        err?.response?.data?.message || "Failed to load version details"
      )
    }
  }

  const handleRestore = async (snapshotId: string, revision: number) => {
    if (
      !window.confirm(
        `Are you sure you want to restore the board to Revision #${revision}? Current operations will be overwritten.`
      )
    ) {
      return
    }

    setRestoringId(snapshotId)
    try {
      toast.loading("Restoring board to previous version...", {
        id: "restore-loading",
      })
      await boardApi.restoreSnapshot(boardId, snapshotId)
      toast.dismiss("restore-loading")
      toast.success(`Board restored to Revision #${revision}`)
      setPreviewSnapshot(null)
      onOpenChange(false)
    } catch (err: any) {
      toast.dismiss("restore-loading")
      toast.error(
        err?.response?.data?.message || "Failed to restore board snapshot"
      )
    } finally {
      setRestoringId(null)
    }
  }

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleString()
    } catch {
      return isoString
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-xs select-none pointer-events-auto"
          />

          {/* Slide-over Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed top-0 right-0 bottom-0 z-50 flex h-full w-full flex-col border-l border-slate-200 bg-white/95 shadow-2xl backdrop-blur-md sm:max-w-105 dark:border-slate-800 dark:bg-slate-900/95 pointer-events-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
              <div>
                <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900 dark:text-slate-50">
                  <History className="h-4.5 w-4.5 text-violet-500" /> Version
                  History
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  View and restore past snapshots of this whiteboard.
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Quick Actions (Capture Snapshot manually) */}
            {!isViewer && (
              <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-slate-800/80 dark:bg-slate-900/30">
                <Button
                  size="sm"
                  onClick={handleCreateSnapshot}
                  disabled={isCreating}
                  className="w-full flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs py-2 shadow-xs rounded-lg"
                >
                  {isCreating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Capture Current Version
                </Button>
              </div>
            )}

            {/* Content Body / Snapshot list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                  <span className="mt-2 text-xs">Loading version history...</span>
                </div>
              ) : snapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <History className="h-8 w-8 opacity-40 text-slate-400 mb-2" />
                  <span className="text-xs font-medium">No snapshots captured yet.</span>
                  <span className="text-[10px] opacity-80 text-center px-6 mt-1">
                    Versions are auto-saved every 50 operations or can be created manually above.
                  </span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {snapshots.map((s) => {
                    const isActive = s.revision === currentRevision
                    const isPreviewing = previewSnapshot?.id === s.id
                    const isRestoring = restoringId === s.id

                    return (
                      <div
                        key={s.id}
                        className={`flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200 ${
                          isPreviewing
                            ? "border-violet-400 bg-violet-50/30 dark:border-violet-500/40 dark:bg-violet-950/10"
                            : isActive
                            ? "border-emerald-200 bg-emerald-50/10 dark:border-emerald-900/20 dark:bg-emerald-950/5"
                            : "border-slate-200/80 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                Revision #{s.revision}
                              </span>
                              {isActive && (
                                <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                  <Check className="h-2.5 w-2.5" /> Current
                                </span>
                              )}
                              {isPreviewing && (
                                <span className="rounded-full bg-violet-100 dark:bg-violet-950/40 px-2 py-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-400 animate-pulse">
                                  Previewing
                                </span>
                              )}
                            </div>
                            <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-400">
                              {formatTimestamp(s.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800/60">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePreview(s.id)}
                            className={`flex flex-1 items-center justify-center gap-1.5 h-8 text-[11px] font-semibold rounded-lg ${
                              isPreviewing
                                ? "bg-violet-100 text-violet-700 hover:bg-violet-100 hover:text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80"
                            }`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {isPreviewing ? "Exit Preview" : "Preview"}
                          </Button>

                          {!isViewer && !isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isRestoring}
                              onClick={() => handleRestore(s.id, s.revision)}
                              className="flex flex-1 items-center justify-center gap-1.5 h-8 text-[11px] font-semibold rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80 hover:text-rose-600 dark:hover:text-rose-400"
                            >
                              {isRestoring ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                              Restore
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
