import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiRequest } from '@/lib/api/use-api-request'
import type { FolderContentsResponse, FolderSummary } from '@/types/domain'

export const folderKeys = {
  all: ['folders'] as const,
  contents: (folderId: string) =>
    [...folderKeys.all, 'contents', folderId] as const,
}

export function useFolderContents(folderId: string | null | undefined) {
  const request = useApiRequest()

  return useQuery({
    queryKey: folderKeys.contents(folderId ?? ''),
    enabled: Boolean(folderId),
    queryFn: () =>
      request<FolderContentsResponse>(`/folders/${folderId}/contents`),
  })
}

export function useCreateFolder(parentFolderId: string) {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      request<FolderSummary>(`/folders/${parentFolderId}/folders`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: folderKeys.contents(parentFolderId),
      })
    },
  })
}

export function useRenameFolder(currentFolderId: string) {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      request<FolderSummary>(`/folders/${folderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: folderKeys.contents(currentFolderId),
      })
    },
  })
}

export function useMoveFolder(_currentFolderId: string) {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      folderId,
      targetParentId,
    }: {
      folderId: string
      targetParentId: string
    }) =>
      request<FolderSummary>(`/folders/${folderId}/move`, {
        method: 'POST',
        body: JSON.stringify({ targetParentId }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: folderKeys.all })
    },
  })
}

export function useDeleteFolder(currentFolderId: string) {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (folderId: string) =>
      request<void>(`/folders/${folderId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: folderKeys.contents(currentFolderId),
      })
    },
  })
}
