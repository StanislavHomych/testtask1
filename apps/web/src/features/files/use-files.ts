import { useAuth } from '@clerk/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/api-error'
import { getApiBaseUrl } from '@/lib/api/api-client'
import { useApiRequest } from '@/lib/api/use-api-request'
import type {
  FileSummary,
  FileViewUrlResponse,
  UploadUrlResponse,
} from '@/types/domain'
import { folderKeys } from '@/features/folders/use-folders'

async function uploadFileContent(
  fileId: string,
  file: File,
  token: string,
): Promise<FileSummary> {
  const form = new FormData()
  form.append('file', file, file.name)

  const uploadResponse = await fetch(
    `${getApiBaseUrl()}/files/${fileId}/content`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    },
  )

  const payload: unknown = await uploadResponse.json().catch(() => null)

  if (!uploadResponse.ok) {
    throw new ApiError(
      uploadResponse.status,
      readUploadError(payload, uploadResponse.status),
    )
  }

  return payload as FileSummary
}

function readUploadError(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === 'string')
    ) {
      return message.join(', ')
    }
  }
  return `Upload failed with status ${status}`
}

export function useUploadPdf(folderId: string) {
  const request = useApiRequest()
  const { getToken } = useAuth()
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

      const token = await getToken()
      if (!token) {
        throw new ApiError(401, 'Missing Clerk session token')
      }

      return uploadFileContent(prepared.file.id, file, token)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: folderKeys.contents(folderId),
      })
    },
    onError: async () => {
      await queryClient.invalidateQueries({
        queryKey: folderKeys.contents(folderId),
      })
    },
  })
}

export function useRetryUpload(folderId: string) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ fileId, file }: { fileId: string; file: File }) => {
      const token = await getToken()
      if (!token) {
        throw new ApiError(401, 'Missing Clerk session token')
      }
      return uploadFileContent(fileId, file, token)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: folderKeys.contents(folderId),
      })
    },
    onError: async () => {
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
