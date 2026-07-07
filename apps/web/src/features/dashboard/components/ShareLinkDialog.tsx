"use client"

import { useState } from "react"
import axios from "axios"
import { useQuery, useMutation } from "@tanstack/react-query"
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
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
  Globe,
  Lock,
} from "lucide-react"
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

  const storeBoardId = useBoardStore((s) => s.boardId)
  const storeVisibility = useBoardStore((s) => s.boardVisibility)
  const boardVisibility = storeBoardId === boardId ? storeVisibility : "PRIVATE"

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
    navigator.clipboard.writeText(url)
    toast.success("Copied to clipboard!")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6 select-none sm:max-w-120">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Share Links</DialogTitle>
          <DialogDescription className="text-sm">
            Create invitation links that allow others to join this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Direct Board Link Section */}
          <div className="space-y-2.5">
            <Label className="block font-bold tracking-wider uppercase">
              {boardVisibility === "PUBLIC"
                ? "Public Board Link"
                : "Direct Board Link"}
            </Label>
            <div className="rounded-xl border p-4">
              <div className="mb-2 flex items-center gap-2">
                {boardVisibility === "PUBLIC" ? (
                  <>
                    <Globe className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold">Public Access</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold">Private Access</span>
                  </>
                )}
              </div>
              <p className="mb-3 text-sm">
                {boardVisibility === "PUBLIC"
                  ? "Anyone on the internet with this link can view this board."
                  : "Only invited members can view or edit this board."}
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/board/${boardId}`}
                />
                <Button
                  size="sm"
                  onClick={() =>
                    handleCopy(`${window.location.origin}/board/${boardId}`)
                  }
                  className="h-9 shrink-0 bg-violet-600 font-semibold hover:bg-violet-500"
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            </div>
          </div>

          {/* Create New Link Section */}
          <div className="flex items-end gap-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label className="font-bold tracking-wider uppercase text-muted-foreground">
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
              className="bg-violet-600 font-semibold hover:bg-violet-500"
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
            <Label className="block font-bold tracking-wider uppercase">
              Active Share Links
            </Label>

            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : links.length === 0 ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-4">
                <AlertCircle className="h-4 w-4 text-muted-foreground" /> No active
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
                      className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="h-3.5 w-3.5 text-violet-500" />
                          <span className="font-bold">{link.role}</span>
                        </div>
                        <span className="mt-0.5 truncate text-sm">
                          {frontendUrl}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopy(frontendUrl)}
                          className="h-8 w-8 hover:text-foreground"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => handleRevokeLink(link.id)}
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
