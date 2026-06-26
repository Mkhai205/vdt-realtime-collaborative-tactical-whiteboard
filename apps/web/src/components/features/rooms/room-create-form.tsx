"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createRoom, getApiErrorMessage } from "@/lib/room-api"

export function RoomCreateForm() {
  const router = useRouter()
  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomDescription, setNewRoomDescription] = useState("")
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [createRoomError, setCreateRoomError] = useState("")

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
        visibility: "PRIVATE",
        linkAccess: "EDITOR",
      })
      router.push(`/rooms/${response.id}`)
    } catch (err) {
      setCreateRoomError(getApiErrorMessage(err))
      setIsCreatingRoom(false)
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Plus className="size-5 text-primary" />
          Create a Room
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleCreateRoom}>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="room-name">Room name</FieldLabel>
            <Input
              id="room-name"
              name="room-name"
              value={newRoomName}
              onChange={(e) => {
                setNewRoomName(e.target.value)
                setCreateRoomError("")
              }}
              placeholder="e.g. Sprint Planning Board"
              maxLength={160}
              className="h-10"
            />
          </Field>
          
          <Field>
            <FieldLabel htmlFor="room-description">Description (optional)</FieldLabel>
            <Input
              id="room-description"
              name="room-description"
              value={newRoomDescription}
              onChange={(e) => {
                setNewRoomDescription(e.target.value)
                setCreateRoomError("")
              }}
              placeholder="e.g. Workspace for detailing weekly goals"
              maxLength={500}
              className="h-10"
            />
          </Field>

          {createRoomError && (
            <p className="text-xs text-destructive">{createRoomError}</p>
          )}

          <Button type="submit" className="w-full" disabled={isCreatingRoom}>
            {isCreatingRoom ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Room"
            )}
          </Button>
        </CardContent>
      </form>
    </Card>
  )
}
