"use client"

import { AuthGuard } from "@/components/common/auth-guard"
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader"
import { BoardGrid } from "@/features/dashboard/components/BoardGrid"
import { useState } from "react"
import { CreateBoardDialog } from "@/features/dashboard/components/CreateBoardDialog"
import { ImportBoardDialog } from "@/features/dashboard/components/ImportBoardDialog"
import { Button } from "@/components/ui/button"
import { Plus, Upload } from "lucide-react"

export default function DashboardPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col bg-slate-50/50 font-sans dark:bg-slate-950/20">
        <DashboardHeader />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6">
            {/* Dashboard Title & Quick Actions */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col select-none">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  Whiteboards
                </h1>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Manage and access all your active planning sessions.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setImportDialogOpen(true)}
                  className="flex cursor-pointer items-center gap-1.5 border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-200"
                >
                  <Upload className="h-4 w-4" /> Import Board
                </Button>
                <Button
                  type="button"
                  onClick={() => setCreateDialogOpen(true)}
                  className="flex cursor-pointer items-center gap-1.5 bg-violet-600 font-semibold text-white shadow-md shadow-violet-500/10 hover:bg-violet-500"
                >
                  <Plus className="h-4.5 w-4.5" /> New Board
                </Button>
              </div>
            </div>

            {/* Board List / Grid */}
            <BoardGrid />
          </div>
        </main>

        <CreateBoardDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />

        <ImportBoardDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
        />
      </div>
    </AuthGuard>
  )
}
