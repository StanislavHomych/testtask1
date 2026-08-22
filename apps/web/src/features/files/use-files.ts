import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiRequest } from '@/lib/api/use-api-request'
import type {
  FileSummary,
  FileViewUrlResponse,
  UploadUrlResponse,
} from '@/types/domain'
import { folderKeys } from '@/features/folders/use-folders'

export function useUploadPdf(folderId: string) {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const prepared = await request<UploadUrlResponse>('/files/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          folderId,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          size: file.size,
        }),
      })

      const uploadResponse = await fetch(prepared.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/pdf',
        },
        body: file,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage')
      }

      return request<FileSummary>(`/files/${prepared.file.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: folderKeys.contents(folderId),
      })
    },
  })
}

export function useRenameFile(folderId: string) {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ fileId, name }: { fileId: string; name: string }) =>
      request<FileSummary>(`/files/${fileId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: folderKeys.contents(folderId),
      })
    },
  })
}

export function useDeleteFile(folderId: string) {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (fileId: string) =>
      request<void>(`/files/${fileId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: folderKeys.contents(folderId),
      })
    },
  })
}

export function useMoveFile(_currentFolderId: string) {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      fileId,
      targetFolderId,
    }: {
      fileId: string
      targetFolderId: string
    }) =>
      request<FileSummary>(`/files/${fileId}/move`, {
        method: 'POST',
        body: JSON.stringify({ targetFolderId }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: folderKeys.all })
    },
  })
}

export function useOpenFile() {
  const request = useApiRequest()

  return useMutation({
    mutationFn: (fileId: string) =>
      request<FileViewUrlResponse>(`/files/${fileId}/view-url`),
  })
}
