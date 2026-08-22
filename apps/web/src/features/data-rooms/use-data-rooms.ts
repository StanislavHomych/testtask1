import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiRequest } from '@/lib/api/use-api-request'
import type { DataRoomListResponse, DataRoomSummary } from '@/types/domain'

export const dataRoomKeys = {
  all: ['data-rooms'] as const,
  list: () => [...dataRoomKeys.all, 'list'] as const,
  detail: (id: string) => [...dataRoomKeys.all, 'detail', id] as const,
}

export function useDataRooms() {
  const request = useApiRequest()

  return useQuery({
    queryKey: dataRoomKeys.list(),
    queryFn: () => apiList(request),
  })
}

export function useDataRoom(dataRoomId: string) {
  const request = useApiRequest()

  return useQuery({
    queryKey: dataRoomKeys.detail(dataRoomId),
    enabled: Boolean(dataRoomId),
    queryFn: () => request<DataRoomSummary>(`/data-rooms/${dataRoomId}`),
  })
}

export function useCreateDataRoom() {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      request<DataRoomSummary>('/data-rooms', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: async (dataRoom) => {
      await queryClient.invalidateQueries({ queryKey: dataRoomKeys.all })
      queryClient.setQueryData(dataRoomKeys.detail(dataRoom.id), dataRoom)
    },
  })
}

export function useUpdateDataRoom(dataRoomId: string) {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      request<DataRoomSummary>(`/data-rooms/${dataRoomId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    onSuccess: async (dataRoom) => {
      await queryClient.invalidateQueries({ queryKey: dataRoomKeys.all })
      queryClient.setQueryData(dataRoomKeys.detail(dataRoom.id), dataRoom)
    },
  })
}

export function useDeleteDataRoom() {
  const request = useApiRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dataRoomId: string) =>
      request<void>(`/data-rooms/${dataRoomId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dataRoomKeys.all })
    },
  })
}

async function apiList(
  request: <T>(path: string) => Promise<T>,
): Promise<DataRoomListResponse> {
  return request<DataRoomListResponse>('/data-rooms')
}
