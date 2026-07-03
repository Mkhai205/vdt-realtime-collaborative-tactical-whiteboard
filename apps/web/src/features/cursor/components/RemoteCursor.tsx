"use client"

import * as React from "react"
import { MousePointer2 } from "lucide-react"

const CursorIcon = ({ color }: { color: string }) => (
  <MousePointer2
    size={18}
    fill={color}
    stroke="#ffffff"
    strokeWidth={1.5}
    style={{
      transform: "translate(-3px, -3px)",
    }}
  />
)

export function RemoteCursor({
  name,
  avatarColor,
  screenX,
  screenY,
}: {
  name: string
  avatarColor: string
  screenX: number
  screenY: number
}) {
  const isOut =
    screenX < 0 ||
    screenY < 0 ||
    screenX > (typeof window !== "undefined" ? window.innerWidth : 2000) ||
    screenY > (typeof window !== "undefined" ? window.innerHeight : 2000)

  if (isOut) return null

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
        transition: "transform 80ms ease-out",
        pointerEvents: "none",
        display: "flex",
        alignItems: "flex-start",
        gap: 2,
        zIndex: 9999,
      }}
    >
      <CursorIcon color={avatarColor} />
      <div
        style={{
          background: avatarColor,
          color: "#ffffff",
          padding: "3px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: 600,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.15)",
        }}
      >
        {name}
      </div>
    </div>
  )
}
