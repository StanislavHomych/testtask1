import { useAuth } from '@clerk/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/api-error'
import { getApiBaseUrl } from '@/lib/api/api-client'
import { useApiRequest } from '@/lib/api/use-api-request'
import type {
  FileSummary,
  FileVersionSummary,
  FileViewUrlResponse,
  UploadUrlResponse,
} from '@/types/domain'
import { folderKeys } from '@/features/folders/use-folders'

export type UploadProgressEvent = {
  localId: string
  fileName: string
  progress: number
  status: 'uploading' | 'completing' | 'done' | 'error'
  error?: string
}

async function putToS3WithProgress(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'application/pdf')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new Error(`S3 upload failed with status ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('S3 upload network error'))
    xhr.send(file)
  })
}

async function uploadFileContent(
  fileId: string,
  file: File,
  token: string,
  onProgress: (percent: number) => void,
): Promise<FileSummary> {
  return await new Promise<FileSummary>((resolve, reject) => {
    const form = new FormData()
    form.append('file', file, file.name)
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', `${getApiBaseUrl()}/files/${fileId}/content`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as FileSummary)
        } catch {
          resolve({
            id: fileId,
            name: file.name,
            mimeType: file.type || 'application/pdf',
            size: String(file.size),
            folderId: '',
            status: 'AVAILABLE',
          })
        }
        return
      }
      let message = `Upload failed with status ${xhr.status}`
      try {
        const payload = JSON.parse(xhr.responseText) as { message?: unknown }
        if (typeof payload.message === 'string') {
          message = payload.message
        }
      } catch {
        // keep default
      }
      reject(new ApiError(xhr.status, message))
    }
    xhr.onerror = () => reject(new ApiError(0, 'Upload network error'))
    xhr.send(form)
  })
}

export async function uploadPdfFile(options: {
  folderId: string
  file: File
  token: string
  request: <T>(path: string, init?: RequestInit) => Promise<T>
  onProgress: (percent: number) => void
}): Promise<FileSummary> {
  const { folderId, file, token, request, onProgress } = options
  const prepared = await request<UploadUrlResponse>('/files/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      folderId,
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      size: file.size,
    }),
  })

  try {
    await putToS3WithProgress(prepared.uploadUrl, file, onProgress)
    onProgress(100)
    return await request<FileSummary>(`/files/${prepared.file.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  } catch (directError) {
    // Prefer API proxy when browser→S3 is blocked (CORS) or the PUT fails.
    // If the object already landed in S3, complete may still succeed via proxy path
    // only when content endpoint re-uploads; try complete once more first.
    try {
      return await request<FileSummary>(`/files/${prepared.file.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    } catch {
      void directError
      return uploadFileContent(prepared.file.id, file, token, onProgress)
    }
  }
}

export function useUploadPdfs(folderId: string) {
  const request = useApiRequest()
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      files,
      onItemProgress,
    }: {
      files: File[]
      onItemProgress: (event: UploadProgressEvent) => void
    }) => {
      const token = await getToken()
      if (!token) {
        throw new ApiError(401, 'Missing Clerk session token')
      }

      const results: FileSummary[] = []
      for (const [index, file] of files.entries()) {
        const localId = `${file.name}-${file.size}-${index}-${Date.now()}`
        onItemProgress({
          localId,
          fileName: file.name,
          progress: 0,
          status: 'uploading',
        })
        try {
          const uploaded = await uploadPdfFile({
            folderId,
            file,
            token,
            request,
            onProgress: (progress) => {
              onItemProgress({
                localId,
                fileName: file.name,
                progress,
                status: progress >= 100 ? 'completing' : 'uploading',
              })
            },
          })
          onItemProgress({
            localId,
            fileName: file.name,
            progress: 100,
            status: 'done',
          })
          results.push(uploaded)
        } catch (error) {
          onItemProgress({
            localId,
            fileName: file.name,
            progress: 0,
            status: 'error',
            error:
              error instanceof ApiError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : 'Upload failed',
          })
        }
      }
      return results
    },
    onSettled: async () => {
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
    mutationFn: async ({
      fileId,
      file,
      onProgress,
    }: {
      fileId: string
      file: File
      onProgress?: (percent: number) => void
    }) => {
      const token = await getToken()
      if (!token) {
        throw new ApiError(401, 'Missing Clerk session token')
      }
      // Retry always uses the API proxy against the existing pending row.
      return uploadFileContent(fileId, file, token, onProgress ?? (() => undefined))
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

export function useUploadNewVersion(folderId: string) {
  const request = useApiRequest()
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ fileId, file }: { fileId: string; file: File }) => {
      const token = await getToken()
      if (!token) {
        throw new ApiError(401, 'Missing Clerk session token')
      }

      try {
        const prepared = await request<{
          uploadUrl: string
          stagingKey: string
        }>(`/files/${fileId}/versions/upload-url`, {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            size: file.size,
          }),
        })
        await putToS3WithProgress(prepared.uploadUrl, file, () => undefined)
        return await request<FileSummary>(`/files/${fileId}/versions/complete`, {
          method: 'POST',
          body: JSON.stringify({
            stagingKey: prepared.stagingKey,
            fileName: file.name,
            size: file.size,
          }),
        })
      } catch {
        const form = new FormData()
        form.append('file', file, file.name)
        const uploadResponse = await fetch(
          `${getApiBaseUrl()}/files/${fileId}/versions/content`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          },
        )
        const payload: unknown = await uploadResponse.json().catch(() => null)
        if (!uploadResponse.ok) {
          throw new ApiError(
            uploadResponse.status,
            typeof payload === 'object' &&
              payload &&
              'message' in payload &&
              typeof (payload as { message: unknown }).message === 'string'
              ? ((payload as { message: string }).message)
              : `Version upload failed with status ${uploadResponse.status}`,
          )
        }
        return payload as FileSummary
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: folderKeys.contents(folderId),
      })
      await queryClient.invalidateQueries({ queryKey: ['file-versions'] })
    },
  })
}

export function useFileVersions(fileId: string | null) {
  const request = useApiRequest()
  return useQuery({
    queryKey: ['file-versions', fileId ?? ''] as const,
    enabled: Boolean(fileId),
    queryFn: () =>
      request<{ items: FileVersionSummary[] }>(`/files/${fileId}/versions`),
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

export function useOpenFileVersion() {
  const request = useApiRequest()

  return useMutation({
    mutationFn: ({
      fileId,
      versionId,
    }: {
      fileId: string
      versionId: string
    }) =>
      request<{ url: string; expiresInSeconds: number }>(
        `/files/${fileId}/versions/${versionId}/view-url`,
      ),
  })
}
