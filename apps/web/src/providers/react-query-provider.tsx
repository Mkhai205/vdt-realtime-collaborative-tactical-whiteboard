"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/api/query-client"

export function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // Use the shared singleton — consistent across the entire app
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
