"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Keyboard } from "lucide-react"

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground shadow-sm dark:bg-muted/40">
      {children}
    </kbd>
  )
}

interface ShortcutRowProps {
  label: string
  keys: React.ReactNode
}

function ShortcutRow({ label, keys }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-2.5 px-1 last:border-0 hover:bg-muted/20 rounded transition-colors">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      <div className="flex items-center gap-1.5">{keys}</div>
    </div>
  )
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 select-none sm:max-w-lg">
        <DialogHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <div className="rounded-lg bg-violet-100 p-2 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
            <Keyboard className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold">Keyboard Shortcuts</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Boost your speed with these canvas keyboard controls.
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs defaultValue="tools" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="edit">Edit & Actions</TabsTrigger>
            <TabsTrigger value="canvas">Canvas & Zoom</TabsTrigger>
          </TabsList>

          {/* ──── Tab 1: Tools ──── */}
          <TabsContent value="tools" className="mt-4 max-h-[350px] overflow-y-auto pr-1">
            <div className="space-y-0.5">
              <ShortcutRow label="Select Tool" keys={<Kbd>V</Kbd>} />
              <ShortcutRow label="Hand / Pan Tool" keys={<Kbd>H</Kbd>} />
              <ShortcutRow label="Draw / Freehand" keys={<Kbd>P</Kbd>} />
              <ShortcutRow label="Highlighter" keys={<Kbd>D</Kbd>} />
              <ShortcutRow label="Text Box" keys={<Kbd>T</Kbd>} />
              <ShortcutRow label="Line" keys={<Kbd>L</Kbd>} />
              <ShortcutRow label="Arrow" keys={<Kbd>A</Kbd>} />
              <ShortcutRow label="Rectangle" keys={<Kbd>R</Kbd>} />
              <ShortcutRow label="Circle" keys={<Kbd>C</Kbd>} />
              <ShortcutRow label="Diamond" keys={<Kbd>O</Kbd>} />
              <ShortcutRow label="Triangle" keys={<Kbd>Y</Kbd>} />
              <ShortcutRow label="Polygon" keys={<Kbd>G</Kbd>} />
              <ShortcutRow label="Icon Stamp" keys={<Kbd>I</Kbd>} />
              <ShortcutRow label="Image Tool" keys={<Kbd>U</Kbd>} />
              <ShortcutRow label="Laser Pointer" keys={<Kbd>K</Kbd>} />
              <ShortcutRow
                label="Cancel Drawing / Select Tool"
                keys={<Kbd>Esc</Kbd>}
              />
            </div>
          </TabsContent>

          {/* ──── Tab 2: Edit & Actions ──── */}
          <TabsContent value="edit" className="mt-4 max-h-[350px] overflow-y-auto pr-1">
            <div className="space-y-0.5">
              <ShortcutRow
                label="Delete Selected Objects"
                keys={
                  <>
                    <Kbd>Delete</Kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <Kbd>Backspace</Kbd>
                  </>
                }
              />
              <ShortcutRow
                label="Copy Selection"
                keys={
                  <>
                    <Kbd>Ctrl</Kbd>
                    <span>+</span>
                    <Kbd>C</Kbd>
                  </>
                }
              />
              <ShortcutRow
                label="Paste Selection"
                keys={
                  <>
                    <Kbd>Ctrl</Kbd>
                    <span>+</span>
                    <Kbd>V</Kbd>
                  </>
                }
              />
              <ShortcutRow
                label="Select All Objects"
                keys={
                  <>
                    <Kbd>Ctrl</Kbd>
                    <span>+</span>
                    <Kbd>A</Kbd>
                  </>
                }
              />
              <ShortcutRow
                label="Nudge Selection (1px)"
                keys={
                  <>
                    <Kbd>←</Kbd>
                    <Kbd>→</Kbd>
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd>
                  </>
                }
              />
              <ShortcutRow
                label="Nudge Selection (10px)"
                keys={
                  <>
                    <Kbd>Shift</Kbd>
                    <span>+</span>
                    <Kbd>←</Kbd>
                    <Kbd>→</Kbd>
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd>
                  </>
                }
              />
              <ShortcutRow
                label="Cancel Selection"
                keys={<Kbd>Esc</Kbd>}
              />
            </div>
          </TabsContent>

          {/* ──── Tab 3: Canvas & Zoom ──── */}
          <TabsContent value="canvas" className="mt-4 max-h-[350px] overflow-y-auto pr-1">
            <div className="space-y-0.5">
              <ShortcutRow
                label="Undo last change"
                keys={
                  <>
                    <Kbd>Ctrl</Kbd>
                    <span>+</span>
                    <Kbd>Z</Kbd>
                  </>
                }
              />
              <ShortcutRow
                label="Redo last change"
                keys={
                  <>
                    <Kbd>Ctrl</Kbd>
                    <span>+</span>
                    <Kbd>Y</Kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <Kbd>Ctrl</Kbd>
                    <span>+</span>
                    <Kbd>Shift</Kbd>
                    <span>+</span>
                    <Kbd>Z</Kbd>
                  </>
                }
              />
              <ShortcutRow
                label="Pan Canvas (Any tool)"
                keys={
                  <>
                    <Kbd>Space</Kbd>
                    <span>+</span>
                    <span className="text-sm text-muted-foreground font-medium">Drag mouse</span>
                  </>
                }
              />
              <ShortcutRow
                label="Reset Zoom (100%)"
                keys={
                  <>
                    <Kbd>Ctrl</Kbd>
                    <span>+</span>
                    <Kbd>0</Kbd>
                  </>
                }
              />
              <ShortcutRow
                label="Fit content in view"
                keys={
                  <>
                    <Kbd>Shift</Kbd>
                    <span>+</span>
                    <Kbd>1</Kbd>
                  </>
                }
              />
              <ShortcutRow
                label="Toggle Shortcut Guide"
                keys={<Kbd>?</Kbd>}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
