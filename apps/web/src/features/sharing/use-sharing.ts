import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api/api-client'
import { useApiRequest } from '@/lib/api/use-api-request'
import type {
  ResourceType,
  ShareSummary,
  SharedResourceResponse,
} from '@/types/domain'

export const shareKeys = {
  all: ['shares'] as const,
  list: (resourceType: ResourceType, resourceId: string) =>
    [...shareKeys.all, resourceType, resourceId] as const,
  public: (token: string) => ['shared', token] as const,
}

export function useShares(resourceType: ResourceType, resourceId: string) {
  const request = useApiRequest()

  return useQuery({
    queryKey: shareKeys.list(resourceType, resourceId),
    enabled: Boolean(resourceId),
    queryFn: () =>
      request<{ items: ShareSummary[] }>(
        `/shares?resourceType=${resourceType}&resourceId=${resourceId}`,
      ),
  })
}

export function useCreateShare(resourceType: ResourceType, resourceId: string) {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      audience: 'USER' | 'PUBLIC'
      email?: string
    }) =>
      request<ShareSummary>('/shares', {
        method: 'POST',
        body: JSON.stringify({
          resourceType,
          resourceId,
          audience: input.audience,
          email: input.email,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: shareKeys.list(resourceType, resourceId),
      })
    },
  })
}

export function useRevokeShare(resourceType: ResourceType, resourceId: string) {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (shareId: string) =>
      request<void>(`/shares/${shareId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: shareKeys.list(resourceType, resourceId),
      })
    },
  })
}

export function useSharedResource(
  token: string | undefined,
  folderId?: string | null,
) {
  return useQuery({
    queryKey: [...shareKeys.public(token ?? ''), folderId ?? 'root'] as const,
    enabled: Boolean(token),
    queryFn: () => {
      const query = folderId ? `?folderId=${folderId}` : ''
      return apiRequest<SharedResourceResponse>(`/shared/${token}${query}`)
    },
  })
}

export function useSharedFileViewUrl(
  token: string | undefined,
  fileId: string | null,
) {
  return useQuery({
    queryKey: ['shared-file-view', token ?? '', fileId ?? ''] as const,
    enabled: Boolean(token && fileId),
    queryFn: () =>
      apiRequest<{
        url: string
        expiresInSeconds: number
        file: {
          id: string
          name: string
          mimeType: string
          size: string
          folderId: string
          status: string
        }
      }>(`/shared/${token}/files/${fileId}/view-url`),
  })
}
