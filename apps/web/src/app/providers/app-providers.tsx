import { ClerkProvider } from '@clerk/react'
import { shadcn } from '@clerk/ui/themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type PropsWithChildren } from 'react'
import { SyncLocalUser } from '@/features/auth/sync-local-user'

const publishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ??
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  )

  if (!publishableKey) {
    throw new Error(
      'Missing VITE_CLERK_PUBLISHABLE_KEY. Copy apps/web/.env.example to .env.local.',
    )
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl="/"
      appearance={{ theme: shadcn }}
    >
      <QueryClientProvider client={queryClient}>
        <SyncLocalUser />
        {children}
      </QueryClientProvider>
    </ClerkProvider>
  )
}
