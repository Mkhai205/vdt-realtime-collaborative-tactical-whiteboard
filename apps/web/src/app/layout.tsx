import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/providers/theme-provider"
import { ReactQueryProvider } from "@/providers/react-query-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Tactical Whiteboard — Realtime Collaborative Canvas",
  description:
    "A realtime collaborative whiteboard for tactical planning. Draw, annotate, and coordinate with your team on a shared canvas.",
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
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
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
