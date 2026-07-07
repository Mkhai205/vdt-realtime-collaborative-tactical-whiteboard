"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useDeleteBoard } from "../hooks/useBoards"
import type { BoardSummary } from "@rctw/shared-contracts"
import { useAuthStore } from "@/stores/auth.store"
import { motion, AnimatePresence } from "framer-motion"
import { Globe, Lock, Trash2, ArrowUpRight, Copy, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useState } from "react"

interface BoardCardProps {
  board: BoardSummary
}

const gradients = [
  "from-pink-500 to-rose-500",
  "from-purple-500 to-indigo-500",
  "from-blue-500 to-cyan-500",
  "from-teal-500 to-emerald-500",
  "from-yellow-500 to-orange-500",
  "from-fuchsia-500 to-purple-500",
  "from-sky-500 to-blue-600",
  "from-violet-500 to-purple-600",
]

function getGradient(id: string) {
  let sum = 0
  for (let i = 0; i < id.length; i++) {
    sum += id.charCodeAt(i)
  }
  return gradients[sum % gradients.length]
}

export function BoardCard({ board }: BoardCardProps) {
  const currentUser = useAuthStore((state) => state.user)
  const isOwner = board.createdBy.id === currentUser?.id
  const gradient = getGradient(board.id)

  const { mutate: deleteBoard, isPending: isDeleting } = useDeleteBoard()
  const [isHovered, setIsHovered] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/board/${board.id}`
    navigator.clipboard.writeText(url)
    toast.success("Board link copied to clipboard!")
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowConfirmDelete(true)
  }

  const confirmDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    deleteBoard(board.id)
    setShowConfirmDelete(false)
  }

  const cancelDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowConfirmDelete(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative select-none"
    >
      <Link href={`/board/${board.id}`}>
        <Card className="overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-black/40">
          {/* Card Thumbnail Area */}
          <div className="relative aspect-video w-full overflow-hidden border-b bg-muted/40">
            {board.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={board.thumbnailUrl}
                alt={board.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div
                className={`relative h-full w-full bg-linear-to-tr ${gradient} flex items-center justify-center p-6`}
              >
                <div className="absolute inset-0 bg-black/10 transition-colors duration-300 group-hover:bg-black/20" />
                {/* Visual background lines */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-size-[14px_14px] opacity-10" />
                <span className="relative z-10 line-clamp-2 max-w-full px-4 text-center text-lg font-bold tracking-tight drop-shadow-sm select-none">
                  {board.name}
                </span>
              </div>
            )}

            {/* Dark tint overlay for card styling */}
            <div className="pointer-events-none absolute inset-0 bg-black/2 dark:bg-black/10" />

            {/* Hover Actions Overlay */}
            <AnimatePresence>
              {isHovered && !showConfirmDelete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 z-20 flex items-center justify-center gap-2.5 bg-black/40 backdrop-blur-[3px]"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="hover: h-9.5 w-9.5 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-white/20 dark:border-border/40 dark:bg-muted/40"
                        onClick={handleCopyLink}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy Link</TooltipContent>
                  </Tooltip>

                  <Button
                    variant="default"
                    className="flex h-9.5 items-center gap-1.5 rounded-xl border border-violet-500 bg-violet-600 px-4 font-semibold shadow-lg shadow-violet-500/20 transition-all duration-200 hover:scale-105 hover:bg-violet-500"
                  >
                    Open <ArrowUpRight className="h-4 w-4" />
                  </Button>

                  {isOwner && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="hover: h-9.5 w-9.5 rounded-xl border border-red-500/30 bg-red-600/10 text-red-200 backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-red-600"
                          disabled={isDeleting}
                          onClick={handleDelete}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete Board</TooltipContent>
                    </Tooltip>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Confirm Delete Overlay */}
            <AnimatePresence>
              {showConfirmDelete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 text-center backdrop-blur-sm"
                  onClick={(e) => e.preventDefault()}
                >
                  <p className="mb-1 font-semibold tracking-wider text-red-200 uppercase">
                    Are you sure?
                  </p>
                  <p className="mb-3 line-clamp-2 px-2 text-sm font-medium text-white/90">
                    This will delete all whiteboard history permanently.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={confirmDelete}
                      className="bg-red-600 hover:bg-red-600/90"
                    >
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={cancelDelete}
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Card Info Area */}
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="line-clamp-1 font-semibold text-foreground">
                {board.name}
              </span>
              <Badge
                variant={isOwner ? "default" : "secondary"}
                className={
                  isOwner
                    ? "bg-violet-600 hover:bg-violet-600/90"
                    : "bg-muted text-muted-foreground"
                }
              >
                {isOwner ? "OWNER" : "COLLABORATOR"}
              </Badge>
            </div>

            <p className="line-clamp-2 min-h-8">
              {board.description || "No description provided."}
            </p>

            <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                {board.visibility === "PUBLIC" ? (
                  <>
                    <Globe className="h-3 w-3 text-blue-500" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3 text-amber-500" /> Private
                  </>
                )}
              </span>
              <span>
                Updated {new Date(board.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  )
}
