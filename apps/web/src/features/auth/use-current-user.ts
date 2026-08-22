import { useAuth } from '@clerk/react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api/api-client'

export interface CurrentUser {
  id: string
  clerkUserId: string
  email: string
  createdAt: string
  updatedAt: string
}

export function useCurrentUser() {
  const { isLoaded, isSignedIn, getToken } = useAuth()

  return useQuery({
    queryKey: ['users', 'me'],
    enabled: isLoaded && Boolean(isSignedIn),
    queryFn: async (): Promise<CurrentUser> => {
      const token = await getToken()
      if (!token) {
        throw new Error('Missing Clerk session token')
      }

      return apiRequest<CurrentUser>('/users/me', { token })
    },
  })
}
