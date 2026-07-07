/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useBoardStore } from "@/stores/board.store"
import { boardApi } from "@/features/board/api/board.api"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Loader2,
  Check,
  Trash2,
  Lock,
  Globe,
  AlertTriangle,
  Upload,
  Download,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ImportLayoutDialog } from "./ImportLayoutDialog"

interface GeneralTabProps {
  boardId: string
}

export function GeneralTab({ boardId }: GeneralTabProps) {
  const router = useRouter()
  const boardName = useBoardStore((s) => s.boardName)
  const boardDescription = useBoardStore((s) => s.boardDescription)
  const boardVisibility = useBoardStore((s) => s.boardVisibility)
  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const updateBoardInfo = useBoardStore((s) => s.updateBoardInfo)
  const updateBoardVisibility = useBoardStore((s) => s.updateBoardVisibility)

  const isOwner = effectiveRole === "OWNER"
  const isViewer =
    effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"
  const canEdit = !isViewer

  // Local form states
  const [prevBoardName, setPrevBoardName] = useState(boardName)
  const [localName, setLocalName] = useState(boardName)
  const [prevBoardDesc, setPrevBoardDesc] = useState(boardDescription)
  const [localDesc, setLocalDesc] = useState(boardDescription || "")

  const [isSavingName, setIsSavingName] = useState(false)
  const [isSavingDesc, setIsSavingDesc] = useState(false)
  const [isSavingVisibility, setIsSavingVisibility] = useState(false)

  // Saved success indicators
  const [savedName, setSavedName] = useState(false)
  const [savedDesc, setSavedDesc] = useState(false)

  // Import/Export states
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importLayoutData, setImportLayoutData] = useState<any[] | null>(null)
  const [importLayoutDialogOpen, setImportLayoutDialogOpen] = useState(false)

  const handleExport = () => {
    const state = useBoardStore.getState()
    const exportData = {
      version: 1,
      board: {
        name: state.boardName,
        description: state.boardDescription,
      },
      objects: Array.from(state.objects.values()).map((obj) => ({
        type: obj.type,
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        points: obj.points,
        text: obj.text,
        rotation: obj.rotation,
        style: obj.style,
        zIndex: obj.zIndex,
      })),
    }

    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(exportData, null, 2))
    const downloadAnchor = document.createElement("a")
    downloadAnchor.setAttribute("href", dataStr)
    const sanitizedName = state.boardName
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()
    downloadAnchor.setAttribute("download", `${sanitizedName}_export.rctw`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast.success("Board layout exported successfully")
  }

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const parsed = JSON.parse(text)
        if (!Array.isArray(parsed.objects)) {
          toast.error("Invalid file format. Objects array is missing.")
          return
        }
        setImportLayoutData(parsed.objects)
        setImportLayoutDialogOpen(true)
      } catch (err) {
        toast.error("Failed to parse JSON file.")
      }
    }
    reader.readAsText(file)
    e.target.value = "" // Reset
  }

  // Adjust local states during rendering
  if (boardName !== prevBoardName) {
    setPrevBoardName(boardName)
    setLocalName(boardName)
    setIsSavingName(false)
  }

  if (boardDescription !== prevBoardDesc) {
    setPrevBoardDesc(boardDescription)
    setLocalDesc(boardDescription || "")
    setIsSavingDesc(false)
  }

  // Confirm delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Refs for first render guards in useEffect
  const isFirstRenderName = useRef(true)
  const isFirstRenderDesc = useRef(true)

  // Debounce autosave timers
  const nameTimerRef = useRef<NodeJS.Timeout | null>(null)
  const descTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Event handlers to synchronously set saving states on typing
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalName(val)
    const trimmed = val.trim()
    if (trimmed && trimmed !== boardName) {
      setIsSavingName(true)
      setSavedName(false)
    } else {
      setIsSavingName(false)
    }
  }

  const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setLocalDesc(val)
    const trimmed = val.trim() || null
    if (trimmed !== boardDescription) {
      setIsSavingDesc(true)
      setSavedDesc(false)
    } else {
      setIsSavingDesc(false)
    }
  }

  // Autosave Name on change (debounced 500ms)
  useEffect(() => {
    if (isFirstRenderName.current) {
      isFirstRenderName.current = false
      return
    }

    if (!canEdit) return

    if (nameTimerRef.current) clearTimeout(nameTimerRef.current)

    const trimmedName = localName.trim()
    if (!trimmedName || trimmedName === boardName) return

    nameTimerRef.current = setTimeout(async () => {
      try {
        await boardApi.updateBoardInfo(boardId, { name: trimmedName })
        updateBoardInfo(trimmedName, boardDescription)
        setSavedName(true)
        setTimeout(() => setSavedName(false), 2000)
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Failed to auto-save name")
      } finally {
        setIsSavingName(false)
      }
    }, 500)

    return () => {
      if (nameTimerRef.current) clearTimeout(nameTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localName])

  // Autosave Description on change (debounced 500ms)
  useEffect(() => {
    if (isFirstRenderDesc.current) {
      isFirstRenderDesc.current = false
      return
    }

    if (!canEdit) return

    if (descTimerRef.current) clearTimeout(descTimerRef.current)

    const value = localDesc.trim() || null
    if (value === boardDescription) return

    descTimerRef.current = setTimeout(async () => {
      try {
        await boardApi.updateBoardInfo(boardId, { description: value })
        updateBoardInfo(boardName, value)
        setSavedDesc(true)
        setTimeout(() => setSavedDesc(false), 2000)
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || "Failed to auto-save description",
        )
      } finally {
        setIsSavingDesc(false)
      }
    }, 500)

    return () => {
      if (descTimerRef.current) clearTimeout(descTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDesc])

  // Handle visibility update
  const handleToggleVisibility = async (
    newVisibility: "PRIVATE" | "PUBLIC",
  ) => {
    if (!isOwner) return
    setIsSavingVisibility(true)
    try {
      await boardApi.updateBoardSettings(boardId, { visibility: newVisibility })
      updateBoardVisibility(newVisibility)
      toast.success(`Board is now ${newVisibility.toLowerCase()}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update visibility")
    } finally {
      setIsSavingVisibility(false)
    }
  }

  // Handle board delete
  const handleDeleteBoard = async () => {
    if (!isOwner) return
    setIsDeleting(true)
    try {
      await boardApi.deleteBoard(boardId)
      toast.success("Board deleted successfully")
      router.push("/dashboard")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete board")
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Board Name field */}
      <div className="relative flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="general-board-name"
            className="font-bold tracking-wider uppercase text-muted-foreground"
          >
            Board Name
          </Label>
          <div className="flex h-4 items-center gap-1.5 text-sm">
            {isSavingName && (
              <span className="flex animate-pulse items-center gap-1 font-medium text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </span>
            )}
            {savedName && (
              <span className="animate-fade-in flex items-center gap-0.5 font-semibold text-emerald-500">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
        </div>
        <Input
          id="general-board-name"
          value={localName}
          onChange={handleNameChange}
          disabled={!canEdit}
          maxLength={100}
          className="bg-background text-sm font-semibold focus-visible:ring-violet-500"
          placeholder="whiteBoard Name"
        />
      </div>

      {/* Description field */}
      <div className="relative flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="general-board-desc"
            className="font-bold tracking-wider uppercase text-muted-foreground"
          >
            Description
          </Label>
          <div className="flex h-4 items-center gap-1.5 text-sm">
            {isSavingDesc && (
              <span className="flex animate-pulse items-center gap-1 font-medium text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </span>
            )}
            {savedDesc && (
              <span className="animate-fade-in flex items-center gap-0.5 font-semibold text-emerald-500">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
        </div>
        <Textarea
          id="general-board-desc"
          value={localDesc}
          onChange={handleDescChange}
          disabled={!canEdit}
          maxLength={500}
          rows={4}
          className="resize-none bg-background text-sm focus-visible:ring-violet-500"
          placeholder="Describe the purpose of this tactical whiteboard..."
        />
      </div>

      {/* Visibility Settings */}
      <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-4">
        <Label className="block font-bold tracking-wider uppercase text-muted-foreground">
          Board Visibility
        </Label>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "Configure who can view this board. Private boards require direct invites."
            : "Only the board Owner can modify visibility settings."}
        </p>

        <div className="mt-2.5 flex items-center gap-2">
          <Button
            size="sm"
            variant={boardVisibility === "PRIVATE" ? "default" : "outline"}
            disabled={!isOwner || isSavingVisibility}
            onClick={() => handleToggleVisibility("PRIVATE")}
            className={`flex flex-1 items-center justify-center gap-1.5 font-semibold ${
              boardVisibility === "PRIVATE"
                ? "bg-violet-600 hover:bg-violet-500"
                : ""
            }`}
          >
            {isSavingVisibility && boardVisibility === "PUBLIC" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            Private
          </Button>

          <Button
            size="sm"
            variant={boardVisibility === "PUBLIC" ? "default" : "outline"}
            disabled={!isOwner || isSavingVisibility}
            onClick={() => handleToggleVisibility("PUBLIC")}
            className={`flex flex-1 items-center justify-center gap-1.5 font-semibold ${
              boardVisibility === "PUBLIC"
                ? "bg-violet-600 hover:bg-violet-500"
                : ""
            }`}
          >
            {isSavingVisibility && boardVisibility === "PRIVATE" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Globe className="h-3.5 w-3.5" />
            )}
            Public
          </Button>
        </div>
      </div>

      {/* Import & Export */}
      <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-4">
        <Label className="block font-bold tracking-wider uppercase text-muted-foreground">
          Import & Export
        </Label>
        <p className="text-sm text-muted-foreground">
          Export this board&aposs tactical drawings, or import shapes from a
          `.rctw` or `.json` file.
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          {canEdit && (
            <>
              <input
                type="file"
                ref={importInputRef}
                onChange={handleImportFileChange}
                accept=".rctw,.json"
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => importInputRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 font-semibold"
              >
                <Upload className="h-3.5 w-3.5" /> Import Layout
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="flex flex-1 items-center justify-center gap-1.5 font-semibold"
          >
            <Download className="h-3.5 w-3.5" /> Export Layout
          </Button>
        </div>
      </div>

      {/* Danger Zone (Owner Only) */}
      {isOwner && (
        <div className="rounded-xl border border-red-200/50 bg-red-50/20 p-4 dark:border-red-950/20 dark:bg-red-950/5">
          <h3 className="flex items-center gap-1 font-bold tracking-wider text-red-500 uppercase dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Danger Zone
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-red-400">
            Deleting this board will permanently delete all objects, revisions,
            and member associations. This action is irreversible.
          </p>
          <Button
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 bg-red-600 font-semibold shadow-sm hover:bg-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete Whiteboard
          </Button>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="select-none sm:max-w-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Confirm Delete Whiteboard
            </DialogTitle>
            <DialogDescription className="">
              Are you sure you want to delete{" "}
              <span className="font-bold text-foreground">
                {boardName}
              </span>
              ? All tactical objects and drawings will be deleted permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="ghost"
              disabled={isDeleting}
              onClick={() => setDeleteOpen(false)}
              className="font-medium"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteBoard}
              className="flex items-center gap-1.5 bg-red-600 font-semibold hover:bg-red-500"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {importLayoutData && (
        <ImportLayoutDialog
          boardId={boardId}
          open={importLayoutDialogOpen}
          onOpenChange={setImportLayoutDialogOpen}
          objects={importLayoutData}
        />
      )}
    </div>
  )
}
