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
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

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
            className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-xs select-none pointer-events-auto"
          />

          {/* Slide-over Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed top-0 right-0 bottom-0 z-50 flex h-full w-full flex-col border-l border-slate-200 bg-white/95 shadow-2xl backdrop-blur-md sm:max-w-105 dark:border-slate-800 dark:bg-slate-900/95 pointer-events-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
              <div>
                <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900 dark:text-slate-50">
                  <Settings className="h-4.5 w-4.5 text-violet-500" /> Board
                  Settings
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Manage this whiteboard and member permissions.
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Tab Selectors */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 px-3 py-2 select-none dark:border-slate-800/80 dark:bg-slate-900/30">
              <button
                onClick={() => setActiveTab("general")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                  activeTab === "general"
                    ? "bg-white text-violet-600 shadow-xs dark:bg-slate-800 dark:text-violet-400"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
                }`}
              >
                <Settings className="h-3.5 w-3.5" /> General
              </button>
              <button
                onClick={() => setActiveTab("members")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                  activeTab === "members"
                    ? "bg-white text-violet-600 shadow-xs dark:bg-slate-800 dark:text-violet-400"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
                }`}
              >
                <Users className="h-3.5 w-3.5" /> Members
              </button>
              {!isViewer && (
                <button
                  onClick={() => setActiveTab("share")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                    activeTab === "share"
                      ? "bg-white text-violet-600 shadow-xs dark:bg-slate-800 dark:text-violet-400"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
                  }`}
                >
                  <Link2 className="h-3.5 w-3.5" /> Share & Invite
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
                  {activeTab === "share" && !isViewer && <ShareTab boardId={boardId} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
