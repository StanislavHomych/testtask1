export type ShareRole = 'VIEWER' | 'EDITOR'
export type ResourceType = 'DATA_ROOM' | 'FOLDER' | 'FILE'
export type FileStatus =
  | 'PENDING_UPLOAD'
  | 'AVAILABLE'
  | 'FAILED'
  | 'DELETING'
  | 'DELETED'

export type AccessRole = 'OWNER' | 'VIEWER' | 'EDITOR'

export interface DataRoomSummary {
  id: string
  name: string
  role: AccessRole
  rootFolderId: string | null
  createdAt: string
  updatedAt: string
}

export interface DataRoomListResponse {
  items: DataRoomSummary[]
  nextCursor: string | null
  hasNextPage: boolean
}

export interface FolderSummary {
  id: string
  name: string
  dataRoomId: string
  parentId: string | null
  createdAt?: string
  updatedAt?: string
}

export interface FileSummary {
  id: string
  name: string
  mimeType: string
  size: string
  folderId: string
  status?: FileStatus
  currentVersion?: number
  createdAt?: string
  updatedAt?: string
  dataRoomId?: string
  originalName?: string
  viewUrl?: string
}

export interface FileVersionSummary {
  id: string
  fileId: string
  version: number
  name: string
  originalName: string
  mimeType: string
  size: string
  createdAt: string
  isCurrent: boolean
}

export interface FolderOption {
  id: string
  name: string
  parentId: string | null
  pathLabel: string
}

export interface CursorPageInfo {
  nextCursor: string | null
  hasNextPage: boolean
}

export interface FolderContentsResponse {
  folder: FolderSummary
  breadcrumbs: Array<{ id: string; name: string }>
  role: AccessRole
  canWrite: boolean
  folders: { items: FolderSummary[] } & CursorPageInfo
  files: { items: FileSummary[] } & CursorPageInfo
}

export interface UploadUrlResponse {
  file: FileSummary
  uploadUrl: string
  expiresInSeconds: number
}

export interface FileViewUrlResponse {
  url: string
  expiresInSeconds: number
  file: FileSummary
}

export interface ShareSummary {
  id: string
  resourceType: ResourceType
  dataRoomId: string | null
  folderId: string | null
  fileId: string | null
  role: ShareRole
  userEmail: string | null
  isPublic: boolean
  publicToken?: string
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
}

export interface SharedResourceResponse {
  resourceType: ResourceType
  role: 'VIEWER'
  dataRoom: {
    id: string
    name: string
    rootFolderId: string | null
  }
  folder: FolderSummary | null
  breadcrumbs: Array<{ id: string; name: string }>
  folders: { items: FolderSummary[] } & CursorPageInfo
  files: { items: FileSummary[] } & CursorPageInfo
  file: FileSummary | null
  viewUrl: string | null
  expiresInSeconds?: number
}
