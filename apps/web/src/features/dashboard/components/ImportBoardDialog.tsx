"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { boardApi } from "@/features/board/api/board.api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, FileJson, UploadCloud, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface ImportBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ImportData {
  version?: number
  board: {
    name: string
    description?: string | null
  }
  objects: any[]
}

export function ImportBoardDialog({
  open,
  onOpenChange,
}: ImportBoardDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [importData, setImportData] = useState<ImportData | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE")
  const [fileError, setFileError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileName, setFileName] = useState("")

  const resetForm = () => {
    setImportData(null)
    setName("")
    setDescription("")
    setVisibility("PRIVATE")
    setFileError(null)
    setFileName("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const processFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const parsed = JSON.parse(text)

        if (!parsed.board || typeof parsed.board.name !== "string" || !Array.isArray(parsed.objects)) {
          setFileError("Invalid file format. The file must contain board metadata and an objects array.")
          setImportData(null)
          return
        }

        setImportData(parsed)
        setName(parsed.board.name + " (Imported)")
        setDescription(parsed.board.description || "")
        setFileError(null)
      } catch (err) {
        setFileError("Failed to parse JSON. Please upload a valid JSON file.")
        setImportData(null)
      }
    }
    reader.readAsText(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importData) return

    if (!name.trim()) {
      toast.error("Board name is required")
      return
    }

    setIsPending(true)
    try {
      const newBoard = await boardApi.importBoard({
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        objects: importData.objects,
      })

      toast.success("Board imported successfully!")
      onOpenChange(false)
      resetForm()
      router.push(`/board/${newBoard.id}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to import board")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val)
      if (!val) resetForm()
    }}>
      <DialogContent className="p-6 sm:max-w-115 select-none">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-50">
            Import Board
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
            Create a new whiteboard by importing a previously exported `.rctw` or `.json` file.
          </DialogDescription>
        </DialogHeader>

        {!importData ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ${
              isDragOver
                ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/10"
                : fileError
                ? "border-red-300 bg-red-50/10 hover:border-red-400"
                : "border-slate-200 hover:border-violet-400 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-900/30"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".rctw,.json"
              className="hidden"
            />
            <UploadCloud className={`h-10 w-10 mb-3 ${isDragOver ? "text-violet-500" : "text-slate-400"}`} />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Drag and drop your file here, or <span className="text-violet-600 dark:text-violet-400">browse</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Supports `.rctw` or `.json` whiteboard exports
            </p>

            {fileError && (
              <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 text-left text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-3">
            {/* File Info Card */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800/80 dark:bg-slate-900/30">
              <div className="rounded-lg bg-violet-100 dark:bg-violet-950/30 p-2 text-violet-600 dark:text-violet-400">
                <FileJson className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {fileName}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                  <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Valid File
                  </span>
                  <span>•</span>
                  <span>{importData.objects.length} shapes & objects</span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Change
              </Button>
            </div>

            {/* Custom Board Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-board-name" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Board Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="import-board-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Project Alpha Planning"
                required
              />
            </div>

            {/* Custom Description */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-board-desc" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Description
              </Label>
              <Textarea
                id="import-board-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a brief summary of what this whiteboard will be used for..."
                className="min-h-20 resize-none"
              />
            </div>

            {/* Visibility */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-board-visibility" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Visibility
              </Label>
              <Select
                value={visibility}
                onValueChange={(val: "PRIVATE" | "PUBLIC") => setVisibility(val)}
              >
                <SelectTrigger id="import-board-visibility" className="w-full">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-semibold">Private 🔒</span>
                      <span className="text-[10px] text-slate-400">
                        Only invited users can view and edit
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="PUBLIC">
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-semibold">Public 🌐</span>
                      <span className="text-[10px] text-slate-400">
                        Anyone with the link can view
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onOpenChange(false)
                  resetForm()
                }}
                className="font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-violet-600 px-5 font-semibold text-white hover:bg-violet-500"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...
                  </>
                ) : (
                  "Import Board"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
