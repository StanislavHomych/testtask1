import { useAuth } from '@clerk/react'
import { useCallback } from 'react'
import { apiRequest, type ApiRequestOptions } from './api-client'

export function useApiRequest() {
  const { getToken } = useAuth()

  return useCallback(
    async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
      const token = await getToken()
      if (!token) {
        throw new Error('Missing Clerk session token')
      }
      return apiRequest<T>(path, { ...options, token })
    },
    [getToken],
  )
}
