"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { memberApi } from "@/features/board/api/member.api"
import { useBoardStore } from "@/stores/board.store"
import { useAuthStore } from "@/stores/auth.store"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getAvatarColor } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Crown, Trash2, Plus, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import axios from "axios"

interface MembersTabProps {
  boardId: string
}

export function MembersTab({ boardId }: MembersTabProps) {
  const queryClient = useQueryClient()
  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const currentUserId = useAuthStore((s) => s.user?.id)

  const isOwner = effectiveRole === "OWNER"
  const isViewer =
    effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"
  const canAddMember = !isViewer

  // Form states for adding member
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState<"EDITOR" | "VIEWER">("VIEWER")

  // Use Query to fetch board members list
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["board-members", boardId],
    queryFn: () => memberApi.listMembers(boardId),
  })

  // Mutation to add new member
  const { mutate: addMember, isPending: isAdding } = useMutation({
    mutationFn: (payload: { email: string; role: "EDITOR" | "VIEWER" }) =>
      memberApi.addMember(boardId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-members", boardId] })
      setNewEmail("")
      toast.success("Member added successfully!")
    },
    onError: (err: unknown) => {
      let errMsg = "Failed to add member"
      if (axios.isAxiosError(err)) {
        errMsg = err.response?.data?.message || errMsg
      }
      toast.error(errMsg)
    },
  })

  // Mutation to update member role
  const { mutate: updateRole } = useMutation({
    mutationFn: (payload: {
      memberId: string
      role: "OWNER" | "EDITOR" | "VIEWER"
    }) =>
      memberApi.updateMemberRole(boardId, payload.memberId, {
        role: payload.role,
      }),
    onSuccess: (updatedMember) => {
      queryClient.invalidateQueries({ queryKey: ["board-members", boardId] })
      // If owner transferred ownership, refresh page to recalculate roles or notify
      if (updatedMember.role === "OWNER") {
        toast.success("Ownership transferred!")
        window.location.reload()
      } else {
        toast.success("Role updated successfully")
      }
    },
    onError: (err: unknown) => {
      let errMsg = "Failed to update role"
      if (axios.isAxiosError(err)) {
        errMsg = err.response?.data?.message || errMsg
      }
      toast.error(errMsg)
    },
  })

  // Mutation to remove member
  const { mutate: removeMember } = useMutation({
    mutationFn: (memberId: string) => memberApi.removeMember(boardId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-members", boardId] })
      toast.success("Member removed from board")
    },
    onError: (err: unknown) => {
      let errMsg = "Failed to remove member"
      if (axios.isAxiosError(err)) {
        errMsg = err.response?.data?.message || errMsg
      }
      toast.error(errMsg)
    },
  })

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault()
    const emailTrimmed = newEmail.trim().toLowerCase()
    if (!emailTrimmed) {
      toast.error("Please enter a valid email address.")
      return
    }
    addMember({ email: emailTrimmed, role: newRole })
  }

  return (
    <div className="space-y-5">
      {/* Add Member Section (EDITOR+) */}
      {canAddMember && (
        <form
          onSubmit={handleAddMember}
          className="space-y-3 rounded-xl border bg-muted/20 p-4"
        >
          <Label className="block font-bold tracking-wider uppercase text-muted-foreground">
            Add Board Member
          </Label>

          <div className="flex flex-col gap-2">
            <Input
              type="email"
              placeholder="user@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={isAdding}
              required
              className="bg-background focus-visible:ring-violet-500"
            />

            <div className="flex gap-2">
              <Select
                value={newRole}
                onValueChange={(val: "EDITOR" | "VIEWER") => setNewRole(val)}
                disabled={isAdding}
              >
                <SelectTrigger className="h-9 w-full bg-background">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDITOR" className="">
                    Editor (Can draw & edit)
                  </SelectItem>
                  <SelectItem value="VIEWER" className="">
                    Viewer (Read-only)
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="submit"
                disabled={isAdding}
                className="flex h-9 items-center gap-1.5 bg-violet-600 px-4 font-semibold hover:bg-violet-500"
              >
                {isAdding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Member List */}
      <div className="space-y-2.5">
        <Label className="block font-bold tracking-wider uppercase text-muted-foreground">
          Whiteboard Members
        </Label>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-6 text-muted-foreground">
            <AlertCircle className="h-4 w-4" /> No active members.
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {members.map((member) => {
              const isSelf = member.user.id === currentUserId
              const isMemberOwner = member.role === "OWNER"

              const userInitials = member.user.name
                ? member.user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "US"

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Avatar className="h-8 w-8 border shadow-xs">
                      <AvatarImage
                        src={member.user.avatarUrl || undefined}
                        alt={member.user.name}
                      />
                      <AvatarFallback
                        style={{
                          backgroundColor: getAvatarColor(member.user.id),
                        }}
                        className="text-sm font-bold"
                      >
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate font-bold text-foreground">
                        {member.user.name} {isSelf && " (You)"}
                      </span>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* Role Display / Dropdown */}
                    {isOwner && !isSelf && !isMemberOwner ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          updateRole({
                            memberId: member.user.id,
                            role: e.target.value as "EDITOR" | "VIEWER",
                          })
                        }
                        className="rounded border bg-background px-1.5 py-0.5 text-sm font-semibold text-muted-foreground focus:outline-none"
                      >
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    ) : (
                      <div
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase ${
                          isMemberOwner
                            ? "border border-amber-200/50 bg-amber-50 text-amber-600 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400"
                            : member.role === "EDITOR"
                              ? "border border-violet-200/50 bg-violet-50 text-violet-600 dark:border-violet-900/30 dark:bg-violet-950/20 dark:text-violet-400"
                              : "border bg-muted text-muted-foreground"
                        }`}
                      >
                        {member.role.toLowerCase()}
                      </div>
                    )}

                    {/* Owner-only Actions (Transfer & Remove) */}
                    {isOwner && !isSelf && (
                      <div className="ml-1 flex items-center gap-0.5 border-l pl-1.5">
                        {/* Transfer Ownership */}
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Transfer Ownership"
                          onClick={() => {
                            if (
                              confirm(
                                `Transfer board ownership to ${member.user.name}? You will become an Editor.`,
                              )
                            ) {
                              updateRole({
                                memberId: member.user.id,
                                role: "OWNER",
                              })
                            }
                          }}
                          className="h-7 w-7 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                        >
                          <Crown className="h-3.5 w-3.5" />
                        </Button>

                        {/* Remove Member */}
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Remove Member"
                          onClick={() => {
                            if (
                              confirm(
                                `Remove ${member.user.name} from this board?`,
                              )
                            ) {
                              removeMember(member.user.id)
                            }
                          }}
                          className="h-7 w-7 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
