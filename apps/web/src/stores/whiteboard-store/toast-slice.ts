import type { StateCreator } from "zustand"
import type { WhiteboardState } from "./types"

export type ToastSlice = {
  dismissToast: (toastId: string) => void
}

export const createToastSlice: StateCreator<
  WhiteboardState,
  [],
  [],
  ToastSlice
> = (set) => ({
  dismissToast: (toastId) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== toastId),
    })),
})
