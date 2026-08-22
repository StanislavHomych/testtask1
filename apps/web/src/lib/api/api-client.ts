import { ApiError } from './api-error'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export interface ApiRequestOptions extends RequestInit {
  token?: string | null
}

export async function apiRequest<T>(
  path: string,
  { token, headers, ...options }: ApiRequestOptions = {},
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

  if (response.status === 204) {
    return undefined as T
  }

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(response.status, readErrorMessage(payload, response.status))
  }

  return payload as T
}

function readErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message.join(', ')
    }
  }
  return `API request failed with status ${status}`
}
