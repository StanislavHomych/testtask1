import { useAuth } from '@clerk/react'
import type { PropsWithChildren } from 'react'
import { PageShell } from '@/components/layout/page-shell'
import { MarketingLanding } from '@/pages/marketing/marketing-landing'

export function RequireAuth({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <PageShell title="Loading" description="Checking your session.">
        <p className="text-sm text-muted-foreground">Please wait a moment.</p>
      </PageShell>
    )
  }

  if (!isSignedIn) {
    return <MarketingLanding />
  }

  return children
}
