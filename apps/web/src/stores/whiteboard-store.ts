"use client"

import { create } from "zustand"
import type { WhiteboardState } from "./whiteboard-store/types"
import { initialWhiteboardState } from "./whiteboard-store/initial-state"
import { createViewportSlice } from "./whiteboard-store/viewport-slice"
import { createCollaborationSlice } from "./whiteboard-store/collaboration-slice"
import { createSelectionSlice } from "./whiteboard-store/selection-slice"
import { createObjectCrudSlice } from "./whiteboard-store/object-crud-slice"
import { createHistorySlice } from "./whiteboard-store/history-slice"
import { createSyncSlice } from "./whiteboard-store/sync-slice"
import { createToastSlice } from "./whiteboard-store/toast-slice"
import { createOperationsSlice } from "./whiteboard-store/operations-slice"

export * from "./whiteboard-store/types"

export const useWhiteboardStore = create<WhiteboardState>((set, get, store) => ({
  ...initialWhiteboardState,
  ...createViewportSlice(set, get, store),
  ...createCollaborationSlice(set, get, store),
  ...createSelectionSlice(set, get, store),
  ...createObjectCrudSlice(set, get, store),
  ...createHistorySlice(set, get, store),
  ...createSyncSlice(set, get, store),
  ...createToastSlice(set, get, store),
  ...createOperationsSlice(set, get, store),
}))
