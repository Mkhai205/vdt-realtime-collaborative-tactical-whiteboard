import Link from "next/link"
import { Button } from "@/components/ui/button"
import { googleOAuthStartUrl } from "@/lib/api-url"

export function AuthCallbackError({ reason = "unknown" }: { reason?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="flex w-full max-w-md flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Google login failed</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {reason
              ? `Reason: ${reason}.`
              : "The OAuth callback did not include a failure reason."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={googleOAuthStartUrl}>Try again</a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
