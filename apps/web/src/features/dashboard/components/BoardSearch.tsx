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
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        type="text"
        placeholder="Search boards by name..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full border-slate-200 bg-slate-50 py-2 pr-8 pl-9 text-slate-800 transition-colors placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-violet-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:bg-slate-950"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
