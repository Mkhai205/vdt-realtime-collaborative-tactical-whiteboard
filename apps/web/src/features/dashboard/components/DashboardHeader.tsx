"use client"

import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { BoardSearch } from "./BoardSearch"
import { Paintbrush, LogOut, User, ChevronDown } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function DashboardHeader() {
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "US"

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md select-none dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm shadow-violet-500/20">
            <Paintbrush className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Tactical Canvas
            </span>
            <span className="text-[9px] font-medium tracking-widest text-slate-400 uppercase">
              Workspace
            </span>
          </div>
        </div>

        {/* Search Bar (Center) */}
        <div className="hidden max-w-md flex-1 sm:block">
          <BoardSearch />
        </div>

        {/* User Actions / Menu (Right) */}
        <div className="flex items-center gap-3">
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex cursor-pointer items-center gap-1.5 rounded-full p-1 transition-colors hover:bg-slate-100 focus:outline-none dark:hover:bg-slate-800"
            >
              <Avatar className="h-8 w-8 border border-slate-200 shadow-sm dark:border-slate-800">
                <AvatarImage
                  src={user?.avatarUrl || undefined}
                  alt={user?.name}
                />
                <AvatarFallback
                  style={{ backgroundColor: user?.avatarColor || "#6366f1" }}
                  className="text-xs font-bold text-white"
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
            </button>

            {/* Dropdown Popover */}
            {dropdownOpen && (
              <div className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-card p-1 shadow-lg ring-1 ring-black/5 focus:outline-none dark:border-slate-800">
                {/* User Info */}
                <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800/80">
                  <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Signed in as
                  </p>
                  <p className="mt-0.5 truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                    {user?.name}
                  </p>
                </div>

                {/* Dropdown Items */}
                <div className="py-1">
                  <div className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 select-none dark:text-slate-500">
                    <User className="h-3.5 w-3.5" /> ID: {user?.id.slice(0, 8)}
                    ...
                  </div>

                  <button
                    onClick={() => {
                      setDropdownOpen(false)
                      logout()
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="px-4 pb-3 sm:hidden">
        <BoardSearch />
      </div>
    </header>
  )
}
