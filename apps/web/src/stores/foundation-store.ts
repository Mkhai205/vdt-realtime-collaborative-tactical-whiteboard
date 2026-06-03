"use client";

import { create } from "zustand";

type FoundationState = {
  revision: number;
  incrementRevision: () => void;
};

export const useFoundationStore = create<FoundationState>((set) => ({
  revision: 0,
  incrementRevision: () => set((state) => ({ revision: state.revision + 1 })),
}));
