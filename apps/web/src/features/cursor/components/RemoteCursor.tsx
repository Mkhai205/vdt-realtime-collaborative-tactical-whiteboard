"use client"

import * as React from "react"

const CursorSvg = ({ color }: { color: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ transform: "rotate(-10deg) translate(-2px, -2px)" }}
  >
    <path
      d="M5.65376 12.3963L5.05031 4.82226C5.00693 4.2774 5.61746 3.91094 6.05928 4.23616L18.4239 13.3364C18.887 13.6772 18.6657 14.4244 18.0934 14.4552L13.8821 14.682L10.5985 20.3155C10.3188 20.7955 9.60156 20.6726 9.49397 20.1172L7.69708 14.4717L5.65376 12.3963Z"
      fill={color}
      stroke="#ffffff"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
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
      <CursorSvg color={avatarColor} />
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
