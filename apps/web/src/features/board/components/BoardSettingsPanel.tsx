"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Settings, Users, Link2 } from "lucide-react"
import { GeneralTab } from "./settings/GeneralTab"
import { MembersTab } from "./settings/MembersTab"
import { ShareTab } from "./settings/ShareTab"
import { useBoardStore } from "@/stores/board.store"

interface BoardSettingsPanelProps {
  boardId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type TabType = "general" | "members" | "share"

export function BoardSettingsPanel({
  boardId,
  open,
  onOpenChange,
}: BoardSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("general")
  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer =
    effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="pointer-events-auto fixed inset-0 z-40 bg-background/20 backdrop-blur-xs select-none"
          />

          {/* Slide-over Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="pointer-events-auto fixed top-0 right-0 bottom-0 z-50 flex h-full w-full flex-col border-l bg-background/95 shadow-2xl backdrop-blur-md sm:max-w-105"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="flex items-center gap-1.5 text-base font-bold text-foreground">
                  <Settings className="h-4.5 w-4.5 text-violet-500" /> Board
                  Settings
                </h2>
                <p className="text-sm">
                  Manage this whiteboard and member permissions.
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Tab Selectors */}
            <div className="flex gap-1 border-b px-3 py-2 select-none">
              <button
                onClick={() => setActiveTab("general")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-semibold transition-all ${
                  activeTab === "general"
                    ? "border bg-background text-violet-600 shadow-xs dark:bg-muted dark:text-violet-400"
                    : "hover:bg-accent hover:text-foreground"
                }`}
              >
                <Settings className="h-3.5 w-3.5 text-sm" /> General
              </button>
              <button
                onClick={() => setActiveTab("members")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-semibold transition-all ${
                  activeTab === "members"
                    ? "border bg-background text-violet-600 shadow-xs dark:bg-muted dark:text-violet-400"
                    : "hover:bg-accent hover:text-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5 text-sm" /> Members
              </button>
              {!isViewer && (
                <button
                  onClick={() => setActiveTab("share")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-semibold transition-all ${
                    activeTab === "share"
                      ? "border bg-background text-violet-600 shadow-xs dark:bg-muted dark:text-violet-400"
                      : "hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Link2 className="h-3.5 w-3.5 text-sm" /> Share & Invite
                </button>
              )}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  {activeTab === "general" && <GeneralTab boardId={boardId} />}
                  {activeTab === "members" && <MembersTab boardId={boardId} />}
                  {activeTab === "share" && !isViewer && (
                    <ShareTab boardId={boardId} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
