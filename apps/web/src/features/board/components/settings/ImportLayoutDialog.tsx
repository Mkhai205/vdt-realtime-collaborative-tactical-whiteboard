"use client"

import { useState } from "react"
import { boardApi } from "@/features/board/api/board.api"
import { useBoardStore } from "@/stores/board.store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2, Info, CopyPlus, RefreshCcw } from "lucide-react"

interface ImportLayoutDialogProps {
  boardId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  objects: any[]
}

export function ImportLayoutDialog({
  boardId,
  open,
  onOpenChange,
  objects,
}: ImportLayoutDialogProps) {
  const [mode, setMode] = useState<"APPEND" | "OVERWRITE">("APPEND")
  const [isPending, setIsPending] = useState(false)
  const currentObjectsCount = useBoardStore((s) => s.objects.size)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPending(true)
    try {
      await boardApi.importBoardObjects(boardId, {
        mode,
        objects,
      })

      toast.success(
        mode === "OVERWRITE"
          ? "Whiteboard layout overwritten successfully!"
          : "Shapes appended successfully!"
      )
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to import objects")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="select-none p-6 sm:max-w-105">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
            Import Layout Options
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Choose how you want to apply the {objects.length} tactical shapes onto the current board.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-3">
          {/* File Info Alert */}
          <div className="flex gap-2.5 rounded-xl bg-violet-50/50 p-3 dark:bg-violet-950/10 border border-violet-100/50 dark:border-violet-900/30">
            <Info className="h-4.5 w-4.5 text-violet-500 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Current Board state:</span>{" "}
              Contains {currentObjectsCount} existing active shapes.
            </div>
          </div>

          {/* Mode Selection Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Append Mode */}
            <div
              onClick={() => setMode("APPEND")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center cursor-pointer transition-all duration-200 ${
                mode === "APPEND"
                  ? "border-violet-500 bg-violet-50/10 dark:bg-violet-950/5"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
              }`}
            >
              <div className={`p-2 rounded-lg mb-2.5 ${mode === "APPEND" ? "bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                <CopyPlus className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Append Shapes
              </span>
              <span className="mt-1 text-[9px] text-slate-400 leading-tight">
                Add new shapes on top of the existing ones.
              </span>
            </div>

            {/* Overwrite Mode */}
            <div
              onClick={() => setMode("OVERWRITE")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center cursor-pointer transition-all duration-200 ${
                mode === "OVERWRITE"
                  ? "border-violet-500 bg-violet-50/10 dark:bg-violet-950/5"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
              }`}
            >
              <div className={`p-2 rounded-lg mb-2.5 ${mode === "OVERWRITE" ? "bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                <RefreshCcw className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Overwrite Board
              </span>
              <span className="mt-1 text-[9px] text-slate-400 leading-tight">
                Delete all current drawings and start fresh.
              </span>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Importing...
                </>
              ) : (
                "Confirm Import"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
