"use client"

import { create } from "zustand"
import type { WhiteboardState } from "./whiteboard-store/types"
import { initialWhiteboardState } from "./whiteboard-store/initial-state"
import { createViewportSlice } from "./whiteboard-store/viewport-slice"
import { createCollaborationSlice } from "./whiteboard-store/collaboration-slice"
import { createOperationsSlice } from "./whiteboard-store/operations-slice"

export * from "./whiteboard-store/types"

export const useWhiteboardStore = create<WhiteboardState>((set, get, store) => ({
  ...initialWhiteboardState,
  ...createViewportSlice(set, get, store),
  ...createCollaborationSlice(set, get, store),
  ...createOperationsSlice(set, get, store),
}))
