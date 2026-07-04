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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Crown,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
} from "lucide-react"
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
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"
  const canAddMember = !isViewer

  // Form states for adding member
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState<"EDITOR" | "VIEWER">("VIEWER")

  // Use Query to fetch board members list
  const {
    data: members = [],
    isLoading,
  } = useQuery({
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
    mutationFn: (payload: { memberId: string; role: "OWNER" | "EDITOR" | "VIEWER" }) =>
      memberApi.updateMemberRole(boardId, payload.memberId, { role: payload.role }),
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
        <form onSubmit={handleAddMember} className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/30">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
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
              className="bg-background text-xs focus-visible:ring-violet-500"
            />

            <div className="flex gap-2">
              <Select
                value={newRole}
                onValueChange={(val: "EDITOR" | "VIEWER") => setNewRole(val)}
                disabled={isAdding}
              >
                <SelectTrigger className="w-full bg-background text-xs h-9">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDITOR" className="text-xs">
                    Editor (Can draw & edit)
                  </SelectItem>
                  <SelectItem value="VIEWER" className="text-xs">
                    Viewer (Read-only)
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="submit"
                disabled={isAdding}
                className="bg-violet-600 hover:bg-violet-500 font-semibold text-white text-xs h-9 px-4 flex items-center gap-1.5"
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
        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
          Active Members ({members.length})
        </Label>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-6 text-xs text-slate-400 dark:border-slate-800">
            <AlertCircle className="h-4 w-4" /> No active members.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
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
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-card p-2.5 dark:border-slate-800"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="h-8 w-8 border border-slate-200 shadow-xs dark:border-slate-800">
                      <AvatarImage src={member.user.avatarUrl || undefined} alt={member.user.name} />
                      <AvatarFallback
                        style={{ backgroundColor: member.user.avatarColor || "#6366f1" }}
                        className="text-[10px] font-bold text-white"
                      >
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                        {member.user.name} {isSelf && " (You)"}
                      </span>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div className="flex items-center gap-1.5 shrink-0">
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
                        className="rounded border border-slate-200 bg-background px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 focus:outline-none dark:border-slate-800 dark:text-slate-300"
                      >
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        isMemberOwner
                          ? "bg-amber-50 text-amber-600 border border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30"
                          : member.role === "EDITOR"
                            ? "bg-violet-50 text-violet-600 border border-violet-200/50 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/30"
                            : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                      }`}>
                        {member.role.toLowerCase()}
                      </span>
                    )}

                    {/* Owner-only Actions (Transfer & Remove) */}
                    {isOwner && !isSelf && (
                      <div className="flex items-center gap-0.5 ml-1 border-l border-slate-100 pl-1.5 dark:border-slate-800">
                        {/* Transfer Ownership */}
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Transfer Ownership"
                          onClick={() => {
                            if (confirm(`Transfer board ownership to ${member.user.name}? You will become an Editor.`)) {
                              updateRole({ memberId: member.user.id, role: "OWNER" })
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
                            if (confirm(`Remove ${member.user.name} from this board?`)) {
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
