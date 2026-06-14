import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/providers/theme-provider"
import { ReactQueryProvider } from "@/providers/react-query-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Realtime Collaborator Tactical Whiteboard",
  description:
    "Realtime Collaborator Tactical Whiteboard is a web application that allows users to collaborate in real-time on a virtual whiteboard",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        <ThemeProvider>
          <ReactQueryProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster position="top-right" theme="system" richColors />
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
