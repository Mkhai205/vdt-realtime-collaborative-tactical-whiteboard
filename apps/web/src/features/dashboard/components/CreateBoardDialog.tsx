"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCreateBoard } from "../hooks/useBoards"
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
import { Loader2 } from "lucide-react"

interface CreateBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateBoardDialog({
  open,
  onOpenChange,
}: CreateBoardDialogProps) {
  const router = useRouter()
  const { mutateAsync: createBoard, isPending } = useCreateBoard()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE")
  const [errors, setErrors] = useState<{ name?: string }>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Simple validation
    if (!name.trim()) {
      setErrors({ name: "Board name is required" })
      return
    }
    if (name.length > 50) {
      setErrors({ name: "Board name must be under 50 characters" })
      return
    }

    setErrors({})
    try {
      const newBoard = await createBoard({
        name: name.trim(),
        description: description.trim() || null,
        visibility,
      })
      onOpenChange(false)
      // Reset form
      setName("")
      setDescription("")
      setVisibility("PRIVATE")
      // Redirect to the newly created board
      router.push(`/board/${newBoard.id}`)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6 sm:max-w-115">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Create New Board
          </DialogTitle>
          <DialogDescription className="text-sm">
            Design a new whiteboard and invite your team members to collaborate.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          {/* Board Name */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="board-name"
              className="text-sm font-semibold text-foreground"
            >
              Board Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="board-name"
              placeholder="e.g. Project Alpha Planning"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) setErrors({})
              }}
              className={
                errors.name ? "border-red-500 focus-visible:ring-red-500" : ""
              }
            />
            {errors.name && (
              <span className="font-medium text-red-500">{errors.name}</span>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="board-desc"
              className="text-sm font-semibold text-foreground"
            >
              Description
            </Label>
            <Textarea
              id="board-desc"
              placeholder="Provide a brief summary of what this whiteboard will be used for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-22.5 resize-none"
            />
          </div>

          {/* Visibility */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="board-visibility"
              className="text-sm font-semibold text-foreground"
            >
              Visibility
            </Label>
            <Select
              value={visibility}
              onValueChange={(val: "PRIVATE" | "PUBLIC") => setVisibility(val)}
            >
              <SelectTrigger id="board-visibility" className="w-full">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRIVATE">
                  <div className="flex flex-col text-left">
                    <span className="font-semibold">Private 🔒</span>
                    <span className="text-sm text-muted-foreground">
                      Only invited users can view and edit
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="PUBLIC">
                  <div className="flex flex-col text-left">
                    <span className="font-semibold">Public 🌐</span>
                    <span className="text-sm text-muted-foreground">
                      Anyone with the link can view (Editor access requires
                      invitation)
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
              onClick={() => onOpenChange(false)}
              className="font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-violet-600 px-5 font-semibold hover:bg-violet-500"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                "Create Board"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
