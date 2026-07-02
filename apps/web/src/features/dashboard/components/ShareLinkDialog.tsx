"use client"

import { useState } from "react"
import axios from "axios"
import { useQuery, useMutation } from "@tanstack/react-query"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Copy, Trash2, Loader2, Link2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface ShareLinkDialogProps {
  boardId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShareLinkDialog({
  boardId,
  open,
  onOpenChange,
}: ShareLinkDialogProps) {
  const [newLinkRole, setNewLinkRole] = useState<"EDITOR" | "VIEWER">("EDITOR")

  // Use TanStack Query to manage fetch, load, and cache state
  const {
    data: links = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["share-links", boardId],
    queryFn: () => boardApi.getShareLinks(boardId),
    enabled: open && !!boardId,
  })

  // Use TanStack Mutation for link creation
  const { mutate: createLink, isPending: isGenerating } = useMutation({
    mutationFn: (role: "EDITOR" | "VIEWER") =>
      boardApi.createShareLink(boardId, { role }),
    onSuccess: () => {
      refetch()
      toast.success("Share link generated!")
    },
    onError: (err: unknown) => {
      let errMsg = "Failed to create share link"
      if (axios.isAxiosError(err)) {
        errMsg = err.response?.data?.message || errMsg
      }
      toast.error(errMsg)
    },
  })

  // Use TanStack Mutation for link revocation
  const { mutate: revokeLink } = useMutation({
    mutationFn: (linkId: string) => boardApi.revokeShareLink(boardId, linkId),
    onSuccess: () => {
      refetch()
      toast.success("Link revoked successfully")
    },
    onError: (err: unknown) => {
      let errMsg = "Failed to revoke share link"
      if (axios.isAxiosError(err)) {
        errMsg = err.response?.data?.message || errMsg
      }
      toast.error(errMsg)
    },
  })

  const handleCreateLink = () => {
    createLink(newLinkRole)
  }

  const handleRevokeLink = (linkId: string) => {
    revokeLink(linkId)
  }

  const handleCopy = (url: string) => {
    // Generate full frontend URL using link token
    const urlObj = new URL(url)
    const token =
      urlObj.pathname.split("/").pop() || urlObj.searchParams.get("token") || ""
    const frontendUrl = `${window.location.origin}/join?token=${token}`

    navigator.clipboard.writeText(frontendUrl)
    toast.success("Copied to clipboard!")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6 select-none sm:max-w-120">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-50">
            Share Links
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
            Create invitation links that allow others to join this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Create New Link Section */}
          <div className="flex items-end gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label className="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Select Invite Role
              </Label>
              <Select
                value={newLinkRole}
                onValueChange={(val: "EDITOR" | "VIEWER") =>
                  setNewLinkRole(val)
                }
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDITOR">
                    Editor (Can draw & modify)
                  </SelectItem>
                  <SelectItem value="VIEWER">Viewer (Read-only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleCreateLink}
              disabled={isGenerating}
              className="bg-violet-600 font-semibold text-white hover:bg-violet-500"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Generate Link"
              )}
            </Button>
          </div>

          {/* Existing Links List */}
          <div className="space-y-3">
            <Label className="block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Active Share Links
            </Label>

            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : links.length === 0 ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-4 text-xs text-slate-400 dark:border-slate-800">
                <AlertCircle className="h-4 w-4 text-slate-400" /> No active
                share links found.
              </div>
            ) : (
              <div className="max-h-45 space-y-2.5 overflow-y-auto pr-1">
                {links.map((link) => {
                  const token = link.token
                  const frontendUrl = `${window.location.origin}/join?token=${token}`
                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-card p-3 transition-colors hover:bg-slate-50/30 dark:border-slate-800 dark:hover:bg-slate-900/10"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="h-3.5 w-3.5 text-violet-500" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {link.role}
                          </span>
                        </div>
                        <span className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">
                          {frontendUrl}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopy(frontendUrl)}
                          className="h-8 w-8 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRevokeLink(link.id)}
                          className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
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
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="font-medium"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
