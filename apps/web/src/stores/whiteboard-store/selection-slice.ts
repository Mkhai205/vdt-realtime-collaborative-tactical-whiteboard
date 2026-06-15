import type { StateCreator } from "zustand"
import type { WhiteboardState } from "./types"

export type SelectionSlice = {
  selectObject: (objectId: string | null) => void
  setTool: (tool: WhiteboardState["currentTool"]) => void
}

export const createSelectionSlice: StateCreator<
  WhiteboardState,
  [],
  [],
  SelectionSlice
> = (set, get) => ({
  selectObject: (objectId) => {
    let nextSelectedObjectId: string | null | undefined

    set((state) => {
      if (!objectId) {
        if (state.selectedObjectId === null) {
          return state
        }

        nextSelectedObjectId = null
        return { selectedObjectId: null }
      }

      const object = state.objects[objectId]

      if (!object || object.deletedAt || state.selectedObjectId === objectId) {
        return state
      }

      nextSelectedObjectId = objectId
      return { selectedObjectId: objectId }
    })

    if (nextSelectedObjectId !== undefined) {
      get().sendSelectionUpdate(nextSelectedObjectId)
    }
  },
  setTool: (tool) =>
    set((state) =>
      state.currentTool === tool
        ? state
        : {
            currentTool: tool,
            toolRevision: state.toolRevision + 1,
          },
    ),
})
