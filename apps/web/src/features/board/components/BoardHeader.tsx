/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useBoardStore } from "@/stores/board.store"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useIsAuthenticated } from "@/stores/auth.store"
import { boardApi } from "@/features/board/api/board.api"
import { ShareLinkDialog } from "@/features/dashboard/components/ShareLinkDialog"
import { BoardSettingsPanel } from "./BoardSettingsPanel"
import { PresenceBar } from "@/features/presence/components/PresenceBar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowLeft,
  Share2,
  Settings,
  LogOut,
  ChevronDown,
  Globe,
  Lock,
  Check,
  Loader2,
  Edit2,
} from "lucide-react"
import { Toolbar } from "./toolbar/Toolbar"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getAvatarColor } from "@/lib/utils"

interface BoardHeaderProps {
  boardId: string
}

export function BoardHeader({ boardId }: BoardHeaderProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const isAuthenticated = useIsAuthenticated()

  const boardName = useBoardStore((s) => s.boardName)
  const boardDescription = useBoardStore((s) => s.boardDescription)
  const boardVisibility = useBoardStore((s) => s.boardVisibility)
  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const updateBoardInfo = useBoardStore((s) => s.updateBoardInfo)

  const isViewer =
    effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"
  const canEdit = !isViewer

  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false)
  const [prevBoardName, setPrevBoardName] = useState(boardName)
  const [editNameValue, setEditNameValue] = useState(boardName)
  if (boardName !== prevBoardName) {
    setPrevBoardName(boardName)
    setEditNameValue(boardName)
  }

  const [isSavingName, setIsSavingName] = useState(false)
  const [showSavedCheck, setShowSavedCheck] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Dialogs and Drawer
  const [shareOpen, setShareOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }
  }, [isEditingName])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSaveName = async () => {
    const trimmed = editNameValue.trim()
    if (!trimmed || trimmed === boardName) {
      setIsEditingName(false)
      setEditNameValue(boardName)
      return
    }

    setIsSavingName(true)
    setIsEditingName(false)
    try {
      await boardApi.updateBoardInfo(boardId, { name: trimmed })
      updateBoardInfo(trimmed, boardDescription)
      setShowSavedCheck(true)
      setTimeout(() => setShowSavedCheck(false), 2000)
      toast.success("Board name updated")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update board name")
      setEditNameValue(boardName)
    } finally {
      setIsSavingName(false)
    }
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "US"

  return (
    <TooltipProvider delayDuration={200}>
      <header
        id="board-canvas-header"
        className="absolute top-0 right-0 left-0 z-30 flex h-16 items-start justify-between p-3 select-none pointer-events-none"
      >
        {/* Left Section: Back & Board Name */}
        <div className="flex min-w-0 items-center gap-3 bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 rounded-xl px-3 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md pointer-events-auto transition-all duration-200 hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)]">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="h-8.5 w-8.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Button>

          <div className="flex min-w-0 items-center gap-2">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName()
                  if (e.key === "Escape") {
                    setIsEditingName(false)
                    setEditNameValue(boardName)
                  }
                }}
                maxLength={100}
                className="h-7 w-48 rounded border border-violet-500 bg-background px-2 py-0.5 text-sm font-bold focus:ring-1 focus:ring-violet-500 focus:outline-none dark:border-violet-400"
              />
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <h1
                  onClick={() => canEdit && setIsEditingName(true)}
                  className={`truncate text-sm font-bold text-slate-900 dark:text-slate-50 ${
                    canEdit
                      ? "cursor-pointer rounded px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                      : ""
                  }`}
                >
                  {boardName || "Loading..."}
                </h1>
                {canEdit && (
                  <Edit2 className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                )}
              </div>
            )}

            {/* Visibility Badge */}
            <div className="flex items-center">
              {boardVisibility === "PUBLIC" ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <Globe className="h-2.5 w-2.5" /> Public
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Lock className="h-2.5 w-2.5" /> Private
                </span>
              )}
            </div>

            {/* Viewer Mode Badge */}
            {isViewer && (
              <span className="rounded-full border border-amber-200/50 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400">
                View Only
              </span>
            )}

            {/* Save Status Indicators */}
            {isSavingName && (
              <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
            )}
            {showSavedCheck && (
              <span className="animate-fade-in flex items-center text-[10px] font-medium text-emerald-500">
                <Check className="mr-0.5 h-3 w-3" /> Saved
              </span>
            )}
          </div>
        </div>

        {/* Middle Section: Toolbar */}
        <div className="pointer-events-auto transition-all duration-200 hover:scale-[1.02]">
          <Toolbar />
        </div>

        {/* Right Section: Presence, Share, Settings, User */}
        <div className="flex items-center gap-3 bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 rounded-xl px-3 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md pointer-events-auto transition-all duration-200 hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)]">
          {/* Presence avatars list */}
          <PresenceBar />

          {/* Quick Share Trigger */}
          {!isViewer && (
            <Button
              size="sm"
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 bg-violet-600 text-xs font-semibold text-white shadow-sm hover:bg-violet-500"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
          )}

          {/* Settings Panel Trigger */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSettingsOpen(true)}
            className="h-8.5 w-8.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Settings className="h-4.5 w-4.5" />
          </Button>

          {/* User Profile dropdown or Guest indicator */}
          {isAuthenticated ? (
            <div ref={userDropdownRef} className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex cursor-pointer items-center gap-1 rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar className="h-7 w-7 border border-slate-200 shadow-sm dark:border-slate-800">
                  <AvatarImage
                    src={user?.avatarUrl || undefined}
                    alt={user?.name}
                  />
                  <AvatarFallback
                    style={{ backgroundColor: getAvatarColor(user?.id) }}
                    className="text-[10px] font-bold text-white"
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 z-50 mt-1.5 w-52 origin-top-right rounded-xl border border-slate-200 bg-card p-1 shadow-lg dark:border-slate-800">
                  <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800/80">
                    <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                      Role: {effectiveRole}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                      {user?.name}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false)
                        logout()
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div ref={userDropdownRef} className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex cursor-pointer items-center gap-1 rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar className="h-7 w-7 border border-slate-200 shadow-sm dark:border-slate-800">
                  <AvatarFallback
                    style={{ backgroundColor: "#94a3b8" }}
                    className="text-[10px] font-bold text-white"
                  >
                    GT
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 z-50 mt-1.5 w-52 origin-top-right rounded-xl border border-slate-200 bg-card p-1 shadow-lg dark:border-slate-800">
                  <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800/80">
                    <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                      Role: PUBLIC_VIEWER
                    </p>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                      Guest User
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false)
                        router.push(`/login?redirect=/board/${boardId}`)
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign in
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Share link quick access Dialog */}
        <ShareLinkDialog
          boardId={boardId}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />

        {/* Sliding Settings Panel */}
        <BoardSettingsPanel
          boardId={boardId}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      </header>
    </TooltipProvider>
  )
}
