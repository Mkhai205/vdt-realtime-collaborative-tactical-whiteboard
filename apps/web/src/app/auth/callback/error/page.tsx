import { AuthCallbackError } from "@/features/identity/auth-callback-error"

type GoogleAuthCallbackErrorPageProps = {
  searchParams: Promise<{
    reason?: string | string[]
  }>
}

export default async function GoogleAuthCallbackErrorPage({
  searchParams,
}: GoogleAuthCallbackErrorPageProps) {
  const params = await searchParams
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason

  return <AuthCallbackError reason={reason} />
}
