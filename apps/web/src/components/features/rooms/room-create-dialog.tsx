"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createRoom, getApiErrorMessage } from "@/lib/room-api"

export function RoomCreateDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomDescription, setNewRoomDescription] = useState("")
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [createRoomError, setCreateRoomError] = useState("")

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      // Reset form on close
      setNewRoomName("")
      setNewRoomDescription("")
      setCreateRoomError("")
    }
  }

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newRoomName.trim()
    if (!name) {
      setCreateRoomError("Room name is required.")
      return
    }

    setIsCreatingRoom(true)
    setCreateRoomError("")
    try {
      const response = await createRoom({
        name,
        description: newRoomDescription.trim() || undefined,
        isPublic: true,
        defaultJoinRole: "EDITOR",
      })
      setOpen(false)
      router.push(`/rooms/${response.id}`)
    } catch (err) {
      setCreateRoomError(getApiErrorMessage(err))
      setIsCreatingRoom(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 h-8 px-3">
          <Plus className="size-3.5" aria-hidden="true" />
          Create Room
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-base font-semibold">
            Create a new room
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            A whiteboard room lets your team collaborate on a shared canvas in realtime.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateRoom} className="flex flex-col gap-5 px-6 py-5">
          <Field>
            <FieldLabel htmlFor="dialog-room-name">
              Room name <span className="text-destructive" aria-hidden="true">*</span>
            </FieldLabel>
            <Input
              id="dialog-room-name"
              name="dialog-room-name"
              value={newRoomName}
              onChange={(e) => {
                setNewRoomName(e.target.value)
                setCreateRoomError("")
              }}
              placeholder="e.g. Sprint Planning Board"
              maxLength={160}
              className="h-9"
              autoFocus
              aria-required="true"
              aria-invalid={Boolean(createRoomError)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="dialog-room-description" className="flex items-center gap-1.5">
              Description
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id="dialog-room-description"
              name="dialog-room-description"
              value={newRoomDescription}
              onChange={(e) => setNewRoomDescription(e.target.value)}
              placeholder="e.g. Workspace for detailing weekly goals"
              maxLength={500}
              className="h-9"
            />
          </Field>

          {createRoomError && (
            <FieldDescription className="text-destructive -mt-2">
              {createRoomError}
            </FieldDescription>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              className="flex-1 h-9"
              disabled={isCreatingRoom || !newRoomName.trim()}
            >
              {isCreatingRoom ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-2" aria-hidden="true" />
                  Creating…
                </>
              ) : (
                "Create room"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 px-4"
              onClick={() => handleOpenChange(false)}
              disabled={isCreatingRoom}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
