import { QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

/**
 * Singleton QueryClient — shared across the app.
 * Created lazily so it works in both server and client environments.
 */
let queryClientInstance: QueryClient | null = null

export function getQueryClient(): QueryClient {
  if (!queryClientInstance) {
    queryClientInstance = new QueryClient({
      defaultOptions: {
        queries: {
          /** 30 seconds before data is considered stale */
          staleTime: 30 * 1000,
          /** Retry once on failure */
          retry: 1,
          /** Do not refetch when the window gains focus */
          refetchOnWindowFocus: false,
        },
        mutations: {
          onError: (error: Error) => {
            toast.error(error.message ?? "Something went wrong")
          },
        },
      },
    })
  }

  return queryClientInstance
}
