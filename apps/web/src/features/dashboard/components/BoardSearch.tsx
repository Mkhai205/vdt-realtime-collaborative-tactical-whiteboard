"use client"

import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"

export function BoardSearch() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const initialQuery = searchParams.get("search") || ""

  const [prevQuery, setPrevQuery] = useState(initialQuery)
  const [value, setValue] = useState(initialQuery)

  // Adjust state during render when URL search param changes externally
  if (initialQuery !== prevQuery) {
    setPrevQuery(initialQuery)
    setValue(initialQuery)
  }

  useEffect(() => {
    const currentSearch = searchParams.get("search") || ""
    // Avoid pushing if the value matches the current URL state
    if (value.trim() === currentSearch) {
      return
    }

    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      const trimmedValue = value.trim()
      
      if (trimmedValue) {
        params.set("search", trimmedValue)
      } else {
        params.delete("search")
      }
      params.set("page", "1") // Reset to page 1 on new search
      
      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
      router.push(nextUrl)
    }, 300)

    return () => clearTimeout(handler)
  }, [value, pathname, router, searchParams])

  return (
    <div className="relative w-full select-none">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search boards by name..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full bg-muted/50 py-2 pr-8 pl-9 text-foreground transition-colors placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
