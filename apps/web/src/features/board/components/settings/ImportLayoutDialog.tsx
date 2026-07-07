/* eslint-disable @typescript-eslint/no-explicit-any */
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
          : "Shapes appended successfully!",
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
      <DialogContent className="p-6 select-none sm:max-w-105">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">
            Import Layout Options
          </DialogTitle>
          <DialogDescription className="">
            Choose how you want to apply the {objects.length} tactical shapes
            onto the current board.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-3">
          {/* File Info Alert */}
          <div className="flex gap-2.5 rounded-xl border border-violet-100/50 bg-violet-50/50 p-3 dark:border-violet-900/30 dark:bg-violet-950/10">
            <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-violet-500" />
            <div className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">
                Current Board state:
              </span>{" "}
              Contains {currentObjectsCount} existing active shapes.
            </div>
          </div>

          {/* Mode Selection Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Append Mode */}
            <div
              onClick={() => setMode("APPEND")}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border p-4 text-center transition-all duration-200 ${
                mode === "APPEND"
                  ? "border-violet-500 bg-violet-50/10 dark:bg-violet-950/5"
                  : "border hover:border-border"
              }`}
            >
              <div
                className={`mb-2.5 rounded-lg p-2 ${mode === "APPEND" ? "bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400" : "bg-muted"}`}
              >
                <CopyPlus className="h-5 w-5" />
              </div>
              <span className="font-bold text-foreground">
                Append Shapes
              </span>
              <span className="mt-1 text-[9px] leading-tight text-muted-foreground">
                Add new shapes on top of the existing ones.
              </span>
            </div>

            {/* Overwrite Mode */}
            <div
              onClick={() => setMode("OVERWRITE")}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border p-4 text-center transition-all duration-200 ${
                mode === "OVERWRITE"
                  ? "border-violet-500 bg-violet-50/10 dark:bg-violet-950/5"
                  : "border hover:border-border"
              }`}
            >
              <div
                className={`mb-2.5 rounded-lg p-2 ${mode === "OVERWRITE" ? "bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400" : "bg-muted"}`}
              >
                <RefreshCcw className="h-5 w-5" />
              </div>
              <span className="font-bold text-foreground">
                Overwrite Board
              </span>
              <span className="mt-1 text-[9px] leading-tight text-muted-foreground">
                Delete all current drawings and start fresh.
              </span>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-violet-600 font-semibold hover:bg-violet-500"
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
