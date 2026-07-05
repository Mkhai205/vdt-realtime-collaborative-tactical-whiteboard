"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { boardApi } from "@/features/board/api/board.api"
import { invitationApi } from "@/features/board/api/invitation.api"
import { useBoardStore } from "@/stores/board.store"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Copy,
  Trash2,
  Loader2,
  Link2,
  AlertCircle,
  Mail,
  Plus,
  Clock,
  Globe,
  Lock,
} from "lucide-react"
import { toast } from "sonner"
import axios from "axios"


interface ShareTabProps {
  boardId: string
}

export function ShareTab({ boardId }: ShareTabProps) {
  const queryClient = useQueryClient()
  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const boardVisibility = useBoardStore((s) => s.boardVisibility)
  const isViewer =
    effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  // Form states
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"EDITOR" | "VIEWER">("VIEWER")
  const [newLinkRole, setNewLinkRole] = useState<"EDITOR" | "VIEWER">("EDITOR")

  // ── Query Active Share Links ──
  const { data: shareLinks = [], isLoading: loadingLinks } = useQuery({
    queryKey: ["share-links", boardId],
    queryFn: () => boardApi.getShareLinks(boardId),
    enabled: !isViewer,
  })

  // ── Query Pending Email Invitations ──
  const { data: invitations = [], isLoading: loadingInvites } = useQuery({
    queryKey: ["board-invitations", boardId],
    queryFn: () => invitationApi.listInvitations(boardId),
    enabled: !isViewer,
  })

  // ── Mutations for Share Links ──
  const { mutate: createLink, isPending: isGeneratingLink } = useMutation({
    mutationFn: (role: "EDITOR" | "VIEWER") =>
      boardApi.createShareLink(boardId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share-links", boardId] })
      toast.success("Share link generated!")
    },
    onError: (err: unknown) => {
      let errMsg = "Failed to generate share link"
      if (axios.isAxiosError(err)) {
        errMsg = err.response?.data?.message || errMsg
      }
      toast.error(errMsg)
    },
  })

  const { mutate: revokeLink } = useMutation({
    mutationFn: (linkId: string) => boardApi.revokeShareLink(boardId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share-links", boardId] })
      toast.success("Link revoked successfully")
    },
    onError: (err: unknown) => {
      let errMsg = "Failed to revoke link"
      if (axios.isAxiosError(err)) {
        errMsg = err.response?.data?.message || errMsg
      }
      toast.error(errMsg)
    },
  })

  // ── Mutations for Email Invitations ──
  const { mutate: sendInvite, isPending: isSendingInvite } = useMutation({
    mutationFn: (payload: { email: string; role: "EDITOR" | "VIEWER" }) =>
      invitationApi.createInvitation(boardId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board-invitations", boardId],
      })
      setInviteEmail("")
      toast.success("Email invitation sent successfully!")
    },
    onError: (err: unknown) => {
      let errMsg = "Failed to send invitation"
      if (axios.isAxiosError(err)) {
        errMsg = err.response?.data?.message || errMsg
      }
      toast.error(errMsg)
    },
  })

  const { mutate: revokeInvite } = useMutation({
    mutationFn: (inviteId: string) =>
      invitationApi.revokeInvitation(boardId, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board-invitations", boardId],
      })
      toast.success("Invitation revoked")
    },
    onError: (err: unknown) => {
      let errMsg = "Failed to revoke invitation"
      if (axios.isAxiosError(err)) {
        errMsg = err.response?.data?.message || errMsg
      }
      toast.error(errMsg)
    },
  })

  const handleCopyLink = (token: string) => {
    const frontendUrl = `${window.location.origin}/join?token=${token}`
    navigator.clipboard.writeText(frontendUrl)
    toast.success("Copied share link to clipboard!")
  }

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault()
    const emailTrimmed = inviteEmail.trim().toLowerCase()
    if (!emailTrimmed) {
      toast.error("Please enter a valid email address.")
      return
    }
    sendInvite({ email: emailTrimmed, role: inviteRole })
  }

  if (isViewer) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-slate-400 select-none dark:text-slate-500">
        <AlertCircle className="h-8 w-8 text-slate-400" />
        <h3 className="text-sm font-bold">Permissions Required</h3>
        <p className="max-w-70 text-[11px] leading-relaxed">
          Only board Owners and Editors can generate share links or send email
          invitations.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Direct Board Link Section ── */}
      <div className="space-y-2.5">
        <Label className="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          {boardVisibility === "PUBLIC" ? "Public Board Link" : "Direct Board Link"}
        </Label>
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/30">
          <div className="flex items-center gap-1.5 mb-2">
            {boardVisibility === "PUBLIC" ? (
              <>
                <Globe className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Public Access
                </span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Private Access
                </span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
            {boardVisibility === "PUBLIC"
              ? "Anyone on the internet with this link can view this board."
              : "Only invited members can view or edit this board."}
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={`${window.location.origin}/board/${boardId}`}
              className="h-9 bg-background text-xs text-slate-600 dark:text-slate-400 select-all focus-visible:ring-violet-500"
            />
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/board/${boardId}`)
                toast.success("Copied board link to clipboard!")
              }}
              className="bg-violet-600 h-9 font-semibold text-white hover:bg-violet-500 shrink-0"
            >
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
          </div>
        </div>
      </div>

      {/* ── Share Link Section ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Workspace Share Links
          </Label>
        </div>

        {/* Generate Link controls */}
        <div className="flex items-end gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/30">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Role
            </span>
            <Select
              value={newLinkRole}
              onValueChange={(val: "EDITOR" | "VIEWER") => setNewLinkRole(val)}
              disabled={isGeneratingLink}
            >
              <SelectTrigger className="h-9 w-full bg-background text-xs">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EDITOR" className="text-xs">
                  Editor
                </SelectItem>
                <SelectItem value="VIEWER" className="text-xs">
                  Viewer
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => createLink(newLinkRole)}
            disabled={isGeneratingLink}
            className="flex h-9 items-center gap-1 bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500"
          >
            {isGeneratingLink ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Generate Link
          </Button>
        </div>

        {/* Active links list */}
        {loadingLinks ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : shareLinks.length === 0 ? (
          <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 py-3.5 text-[11px] text-slate-400 dark:border-slate-800">
            <AlertCircle className="h-3.5 w-3.5" /> No active share links
            generated.
          </div>
        ) : (
          <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
            {shareLinks.map((link) => {
              const fullUrl = `${window.location.origin}/join?token=${link.token}`
              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-card p-2.5 dark:border-slate-800"
                >
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-[10px] font-bold tracking-wider text-slate-700 uppercase dark:text-slate-300">
                        {link.role} Link
                      </span>
                    </div>
                    <span className="mt-0.5 truncate text-[9px] text-slate-400 dark:text-slate-500">
                      {fullUrl}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopyLink(link.token)}
                      className="h-7.5 w-7.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => revokeLink(link.id)}
                      className="h-7.5 w-7.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Email Invitation Section ── */}
      <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800/80">
        <Label className="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          Email Invitations
        </Label>

        {/* Send Email invite controls */}
        <form
          onSubmit={handleSendInvite}
          className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/30"
        >
          <Input
            type="email"
            placeholder="invitee@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            disabled={isSendingInvite}
            required
            className="bg-background text-xs focus-visible:ring-violet-500"
          />

          <div className="flex gap-2">
            <Select
              value={inviteRole}
              onValueChange={(val: "EDITOR" | "VIEWER") => setInviteRole(val)}
              disabled={isSendingInvite}
            >
              <SelectTrigger className="h-9 w-full bg-background text-xs">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EDITOR" className="text-xs">
                  Editor
                </SelectItem>
                <SelectItem value="VIEWER" className="text-xs">
                  Viewer
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="submit"
              disabled={isSendingInvite}
              className="flex h-9 items-center gap-1.5 bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500"
            >
              {isSendingInvite ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              Send
            </Button>
          </div>
        </form>

        {/* Pending email invites list */}
        {loadingInvites ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : invitations.length === 0 ? (
          <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 py-3.5 text-[11px] text-slate-400 dark:border-slate-800">
            <AlertCircle className="h-3.5 w-3.5" /> No pending email
            invitations.
          </div>
        ) : (
          <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
            {invitations.map((invite) => {
              const expiresDate = new Date(invite.expiresAt)
              // eslint-disable-next-line react-hooks/purity
              const timeDiff = expiresDate.getTime() - Date.now()
              const hoursLeft = Math.max(
                0,
                Math.floor(timeDiff / (1000 * 60 * 60)),
              )

              return (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-card p-2.5 dark:border-slate-800"
                >
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                      {invite.email}
                    </span>
                    <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-400">
                      <span className="rounded bg-slate-100 px-1 font-semibold tracking-wider text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-400">
                        {invite.role}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> Exp. {hoursLeft}h
                      </span>
                    </div>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => revokeInvite(invite.id)}
                    className="h-7.5 w-7.5 shrink-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
