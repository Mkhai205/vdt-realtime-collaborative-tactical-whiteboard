"use client"

import { useEffect, useState } from "react"
import type { ConnectionStatus as Status } from "../../hooks/useBoardSocket"

interface ConnectionStatusProps {
  status: Status
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const [visible, setVisible] = useState(true)
  const [prevStatus, setPrevStatus] = useState<Status | null>(null)

  if (status !== prevStatus) {
    setPrevStatus(status)
    setVisible(true)
  }

  useEffect(() => {
    if (status === "connected") {
      // Auto-hide connected status after 3 seconds
      const timer = setTimeout(() => {
        setVisible(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [status])

  if (!visible) return null

  const config = {
    connected: {
      color: "#10b981", // emerald-500
      text: "Connected",
      className: "border-emerald-500/30 text-emerald-400 bg-emerald-950/20",
    },
    connecting: {
      color: "#3b82f6", // blue-500
      text: "Connecting...",
      className:
        "border-blue-500/30 text-blue-400 bg-blue-950/20 animate-pulse",
    },
    reconnecting: {
      color: "#f59e0b", // amber-500
      text: "Reconnecting...",
      className: "border-amber-500/30 text-amber-400 bg-amber-950/20",
    },
    disconnected: {
      color: "#ef4444", // red-500
      text: "Disconnected",
      className: "border-red-500/30 text-red-400 bg-red-950/20",
    },
  }[status]

  return (
    <div
      id="connection-status-indicator"
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        zIndex: 10,
        pointerEvents: "none",

        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 8,
        background: "rgba(15, 15, 25, 0.75)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",

        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        fontSize: 12,
        fontWeight: 500,
        color: "rgba(255, 255, 255, 0.8)",

        animation:
          "connection-status-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      {/* Status Dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: config.color,
          boxShadow: `0 0 8px ${config.color}`,
          display: "inline-block",
          animation:
            status === "reconnecting" || status === "connecting"
              ? "status-dot-pulse 1.2s infinite ease-in-out"
              : "none",
        }}
      />

      <span>{config.text}</span>

      <style>{`
        @keyframes connection-status-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes status-dot-pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50%      { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
